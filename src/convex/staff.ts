import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { createAccount, invalidateSessions } from "@convex-dev/auth/server";
import { getCurrentUser, isAdminUser } from "./users";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, ActionCtx } from "./_generated/server";

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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const admin = await isAdminUser(user);
    if (!admin) throw new Error("Vetëm admini mund të shikojë stafin.");

    const tenantId = await resolveTenant(ctx, user);

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => {
        if (u.isAnonymous) return false;
        if (u._id === user._id) return false;
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
        role: u.role === "admin" ? ("store_manager" as const) : ("order_agent" as const),
        hasTenant: u.activeTenantId != null,
        _creationTime: u._creationTime,
      }));
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
    if (!user || user.role !== "admin") {
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
    if (!user || user.role !== "admin") {
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
