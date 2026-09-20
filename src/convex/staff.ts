import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { createAccount, invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { getCurrentUser, isAdminUser } from "./users";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, ActionCtx, MutationCtx } from "./_generated/server";

/**
 * Staff management — company-scoped. Staff records are `users` bound to the
 * admin's active tenant via `activeTenantId` (their store assignment), so
 * every staff member can only access their own company's data.
 */

/** Resolve the tenant a store admin manages (activeTenantId → ownerEmail fallback). */
async function resolveTenant(
  ctx: QueryCtx,
  user: Pick<Doc<"users">, "_id" | "activeTenantId" | "email">,
): Promise<Id<"tenants"> | null> {
  if (user.activeTenantId) return user.activeTenantId;
  if (user.email) {
    const t = await ctx.db
      .query("tenants")
      .withIndex("by_ownerEmail", (q) => q.eq("ownerEmail", user.email!.toLowerCase()))
      .first();
    if (t) return t._id;
  }
  return null;
}

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    // ZERO-THROW CONTRACT: any failure (unauthenticated session race,
    // role check, uninitialized tenant) returns [] instead of a
    // "[CONVEX Q(staff:listStaff)] Server Error" on the client.
    try {
      const user = await getCurrentUser(ctx);
      if (!user) return [];
      const admin = await isAdminUser(user);
      if (!admin) return [];

      const tenantId = await resolveTenant(ctx, user);

      const users = await ctx.db.query("users").collect();
      return users
        .filter((u) => {
          if (u.isAnonymous) return false;
          if (u._id === user._id) return false;
          // Super-admins manage the SaaS platform centrally — they are NEVER
          // tenant staff, even when their session is tenant-bound
          // (e.g. after impersonation). They appear only in /admin.
          if (u.isSuperAdmin) return false;
          if (tenantId) return u.activeTenantId === tenantId;
          // No tenant bound yet: fall back to email-listed membership.
          return false;
        })
        .map((u) => ({
          _id: u._id,
          name: u.name ?? null,
          email: u.email ?? null,
          image: u.image ?? null,
          // "Store Manager" | "Order Agent" (mapped from role)
          role:
            u.role === "admin" || u.role === "owner"
              ? ("store_manager" as const)
              : ("order_agent" as const),
          hasTenant: u.activeTenantId != null,
          isActive: u.isActive !== false,
          _creationTime: u._creationTime,
        }));
    } catch (err) {
      console.error("staff:listStaff failed, returning empty list:", err);
      return [];
    }
  },
});

/**
 * Unique-email lookup used by the create action. Auth-gated: returns only a
 * boolean existence answer to any signed-in company admin.
 */
export const emailExists = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Not authenticated");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return existing != null;
  },
});

/**
 * Create a staff member under the current company admin's tenant.
 * Runs as an action because Convex Auth's `createAccount` performs the
 * password hashing (scrypt) outside mutation contexts.
 */
export const createStaffMember = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.union(v.literal("store_manager"), v.literal("order_agent")),
  },
  handler: async (ctx, { name: rawName, email: rawEmail, password, role }) => {
    const user = await ctx.runQuery(api.users.currentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Vetëm admini i kompanisë mund të shtojë staf.");
    }

    // 1. Validate + trim credentials.
    const name = rawName.trim();
    const email = rawEmail.trim().toLowerCase();
    if (name.length < 2) throw new Error("Shkruani emrin dhe mbiemrin.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email-i nuk është i vlefshëm.");
    }
    if (password.trim().length < 8) {
      throw new Error("Fjalëkalimi duhet të ketë së paku 8 karaktere.");
    }

    // 2. Resolve and require the admin's store binding.
    let tenantId = (user.activeTenantId ?? null) as Id<"tenants"> | null;
    if (!tenantId && user.email) {
      const t = await ctx.runQuery(api.tenants.resolveByEmail, { email: user.email });
      tenantId = t ? (t as unknown as { _id: Id<"tenants"> })._id : null;
    }
    if (!tenantId) {
      throw new Error("Nuk u gjet kompania juaj — konfiguroni kompaninë në Cilësimet e Dyqanit.");
    }

    // 3. Reject duplicates.
    const emailTaken = await ctx.runQuery(api.staff.emailExists, { email });
    if (emailTaken) {
      throw new Error("Ekziston tashmë një anëtar stafi me këtë email.");
    }

    // 4. Register with Convex Auth (password hashed by the Password provider)
    //    and bind the store so the member can only access this company.
    await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password.trim() },
      profile: {
        name,
        email,
        role: role === "store_manager" ? "admin" : "member",
        activeTenantId: tenantId,
      },
    });

    return { ok: true as const };
  },
});

/** Remove a staff member's access to this company (unbind + kill sessions). */
export const removeStaffAccess = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(api.users.currentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Vetëm admini i kompanisë mund të heqë qasje.");
    }
    const target = await ctx.runQuery(api.users.currentUserById, { userId });
    if (!target) throw new Error("Anëtari nuk u gjet.");

    // Tenant isolation in the action ctx: re-derive the admin's tenant via
    // an internal query wrapper (ctx.db unavailable in actions).
    const tenantId = (user.activeTenantId ?? null) as Id<"tenants"> | null;
    if (!tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }

    await ctx.runMutation(api.staff.unbindStaff, { userId });
    await invalidateSessions(ctx, { userId });
    return { ok: true as const };
  },
});

/**
 * Clear a staff member's tenant binding. Re-checks permissions inside the
 * mutation (mutation ctx has both db and auth) so it is safe as a public API.
 */
export const unbindStaff = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini i kompanisë mund të heqë qasje.");
    }
    const tenantId = await resolveTenant(ctx, user);
    const target = await ctx.db.get(userId);
    if (!target || !tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }
    await ctx.db.patch(userId, { activeTenantId: undefined });
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("member")) },
  handler: async (ctx, { userId, role }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të ndryshojë rolet.");
    }
    // Tenant isolation: only members of the admin's own store.
    const tenantId = await resolveTenant(ctx, user);
    const target = await ctx.db.get(userId);
    if (!target || !tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }
    await ctx.db.patch(userId, { role });
  },
});

// ── Credential & Access Management ("Rivendos" / "Heq Qasje" / "Fshi") ──

/**
 * Internal: patch the user's profile email AND keep Convex Auth's password
 * account consistent. The password account is keyed by email — changing one
 * without the other breaks sign-in — so both move together.
 */
async function renameAuthAccount(
  ctx: MutationCtx,
  oldEmail: string,
  newEmail: string,
) {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q: any) =>
      q.eq("provider", "password").eq("providerAccountId", oldEmail),
    )
    .unique();
  if (!account) return;
  await ctx.db.patch(account._id, { providerAccountId: newEmail });
}

/**
 * "Rivendos" — update a staff member's email and/or set a new password.
 *
 * SECURITY: Convex Auth hashes secrets with scrypt inside the Password
 * provider. Direct `passwordHash` patching is impossible from a mutation, so
 * the new password is set by an internal action that calls the auth
 * component's `modifyAccount` store mutation (proper hashing).
 */
export const resetStaffCredentials = action({
  args: {
    staffId: v.id("users"),
    newEmail: v.optional(v.string()),
    newPassword: v.optional(v.string()),
  },
  handler: async (ctx, { staffId, newEmail: rawEmail, newPassword }) => {
    const user = await ctx.runQuery(api.users.currentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Vetëm admini i kompanisë mund të rivendosë kredencialet.");
    }
    const staffUser = await ctx.runQuery(api.users.currentUserById, { userId: staffId });
    if (!staffUser) throw new Error("Anëtari i stafit nuk u gjet");

    // Tenant isolation: the target must belong to the admin's own store.
    const tenantId = (user.activeTenantId ?? null) as Id<"tenants"> | null;
    if (!tenantId || staffUser.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }

    const newEmail = rawEmail?.trim().toLowerCase();
    if (newEmail !== undefined && newEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new Error("Email-i i ri nuk është i vlefshëm.");
    }
    if (newPassword !== undefined && newPassword !== "" && newPassword.length < 8) {
      throw new Error("Fjalëkalimi i ri duhet të ketë së paku 8 karaktere.");
    }

    const oldEmail = staffUser.email ?? null;

    // 1. New password → proper provider-side hash via Convex Auth.
    if (newPassword) {
      const accountId = newEmail || oldEmail;
      if (!accountId) throw new Error("Anëtari nuk ka email të konfiguruar.");
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: accountId, secret: newPassword },
      });
    }

    // 2. Email change → patch profile + move the password account key.
    if (newEmail && newEmail !== oldEmail) {
      if (oldEmail) await ctx.runMutation(api.staff.renameStaffAccount, { staffId, newEmail });
    }

    // 3. Any credential change kills the member's sessions — they sign in
    //    again with the new credentials.
    await invalidateSessions(ctx, { userId: staffId });

    return { ok: true as const };
  },
});

/**
 * Email rename: updates the user profile and the Convex Auth account key in
 * one mutation. Permission re-checked here (mutation ctx has db + auth) so
 * it is safe as a public API.
 */
export const renameStaffAccount = mutation({
  args: { staffId: v.id("users"), newEmail: v.string() },
  handler: async (ctx, { staffId, newEmail }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini i kompanisë mund të ndryshojë email-in.");
    }
    const tenantId = await resolveTenant(ctx, user);
    const target = await ctx.db.get(staffId);
    if (!target || !tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }
    const email = newEmail.trim().toLowerCase();
    if (target.email) {
      await renameAuthAccount(ctx, target.email, email);
    }
    await ctx.db.patch(staffId, { email });
  },
});

/**
 * "Heq Qasje" / "Rikthe Qasje" — toggle store access without deleting the
 * account. Deactivation kills all active sessions immediately; login and
 * data access are refused while `isActive === false`. Historical data is
 * preserved.
 */
export const toggleStaffAccess = mutation({
  args: { staffId: v.id("users"), isActive: v.boolean() },
  handler: async (ctx, { staffId, isActive }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini i kompanisë mund të ndryshojë qasjen.");
    }
    const tenantId = await resolveTenant(ctx, user);
    const target = await ctx.db.get(staffId);
    if (!target || !tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }
    await ctx.db.patch(staffId, { isActive });
    if (!isActive) {
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", staffId))
        .collect();
      for (const s of sessions) {
        await ctx.db.delete(s._id);
      }
    }
  },
});

/**
 * "Fshi" — permanently delete the staff member after tenant-scoped
 * verification: auth account, sessions, refresh tokens, then the user doc.
 */
export const deleteStaff = mutation({
  args: { staffId: v.id("users") },
  handler: async (ctx, { staffId }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini i kompanisë mund të fshijë staf.");
    }
    const tenantId = await resolveTenant(ctx, user);
    const target = await ctx.db.get(staffId);
    if (!target || !tenantId || target.activeTenantId !== tenantId) {
      throw new Error("Anëtari nuk i përket kompanisë tuaj.");
    }

    // Auth account (password provider, keyed by email).
    if (target.email) {
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", target.email!),
        )
        .unique();
      if (account) await ctx.db.delete(account._id);
    }

    // Sessions + their refresh tokens.
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", staffId))
      .collect();
    for (const s of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
        .collect();
      for (const t of tokens) await ctx.db.delete(t._id);
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(staffId);
    return { ok: true as const };
  },
});

/** Self-assign role: the very first registered user becomes admin automatically. */
export const claimFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (user.role === "admin") return "already-admin";

    const staff = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!staff) {
      await ctx.db.patch(user._id, { role: "admin" });
      return "promoted";
    }
    return "has-admin";
  },
});
