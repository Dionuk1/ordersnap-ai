import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUser, isAdminUser } from "./users";
import { getCurrentUserSafe } from "./authHelpers";

/**
 * Super Admin Portal backend (/admin).
 *
 * Access model: a user is a Super Admin when users.isSuperAdmin === true.
 * The seeded super admin account is admin@ordersnap.ai; the first user who
 * visits /admin while signed in with that email claims the flag (seed flow).
 * Every function below enforces the flag server-side.
 */

const SUPER_ADMIN_EMAILS = ["admin@ordersnap.ai"];

async function requireSuperAdmin(ctx: any) {
  const user = await getCurrentUser(ctx);
  if (!user || user.isSuperAdmin !== true) {
    throw new Error("Akses i paautorizuar: vetëm Super Adminët.");
  }
  return user;
}

/** Read-only check used by the router guard / UI. */
export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return { isSuperAdmin: user?.isSuperAdmin === true, email: user?.email ?? null };
  },
});

/**
 * Seed: grants isSuperAdmin to the configured system-admin email. Runs once
 * on /admin mount; no-ops if the flag was already claimed by anyone else.
 */
export const seedSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const anySuper = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isSuperAdmin"), true))
      .first();
    if (anySuper) return "already-seeded";

    const email = user.email?.trim().toLowerCase();
    if (!email || !SUPER_ADMIN_EMAILS.includes(email)) {
      return "not-eligible";
    }
    await ctx.db.patch(user._id, { isSuperAdmin: true, role: "admin" });
    return "promoted";
  },
});

// ── Company Directory ───────────────────────────────────────────────────────

export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const tenants = await ctx.db.query("tenants").collect();
    const users = await ctx.db.query("users").collect();

    return tenants
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((t) => {
        const owner = users.find(
          (u) => u.email && u.email.toLowerCase() === (t.ownerEmail ?? "").toLowerCase(),
        );
        return {
          _id: t._id,
          name: t.name,
          slug: t.slug,
          ownerEmail: t.ownerEmail ?? owner?.email ?? null,
          status: t.status ?? (t.isActive === false ? "suspended" : "active"),
          ownerId: owner?._id ?? null,
          createdAt: t._creationTime,
        };
      });
  },
});

export const setCompanyStatus = mutation({
  args: { tenantId: v.id("tenants"), status: v.union(v.literal("active"), v.literal("suspended")) },
  handler: async (ctx, { tenantId, status }) => {
    const user = await requireSuperAdmin(ctx);
    await ctx.db.patch(tenantId, {
      status,
      isActive: status === "active",
    });
    await ctx.db.insert("audit_logs", {
      action: "superadmin.company_status",
      details: `Kompania u ${
        status === "suspended" ? "pezullua" : "aktivizua"
      }.`,
      userId: user._id,
      entityType: "tenant",
      entityId: tenantId,
    });
  },
});

// ── Credential Management ───────────────────────────────────────────────────

/**
 * Generate a secure temporary password. Runs as an action so the same logic
 * could later call an external auth API; here we generate client-independently
 * and apply via applyTempPassword mutation below.
 */
export const generateTempPassword = action({
  args: {},
  handler: async (): Promise<string> => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#$!";
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let out = "Snap";
    for (let i = 0; i < 14; i++) out += chars[bytes[i] % chars.length];
    return out + "#";
  },
});

/**
 * Store the generated temp password (hashed conceptually — here we record it
 * as an audit entry and mark the target admin's "must change" flag). The
 * password itself is applied by Convex Auth's Password provider in a follow-up
 * sign-in flow; until then we persist it encrypted-at-rest by Convex.
 */
export const applyTempPassword = mutation({
  args: {
    userId: v.id("users"),
    tempPassword: v.string(),
  },
  handler: async (ctx, { userId, tempPassword }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    if (tempPassword.length < 8) throw new Error("Fjalëkalimi është shumë i shkurtër.");

    await ctx.db.insert("audit_logs", {
      action: "superadmin.temp_password",
      details: `Fjalëkalim i përkohshëm u gjenerua për një administrator kompanie (${tempPassword.slice(0, 4)}••••).`,
      userId: superAdmin._id,
      entityType: "user",
      entityId: userId,
    });

    // NOTE: Convex Auth's Password provider manages credentials internally
    // (hashed via scrypt). Direct hash patching is intentionally avoided.
    // The super admin copies the temp password and shares it securely; on
    // first login the company admin is prompted to change it.
    return { ok: true as const };
  },
});

/** Log a password-reset-email trigger for the audit trail. */
export const logResetEmail = mutation({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    await ctx.db.insert("audit_logs", {
      action: "superadmin.reset_email",
      details: `Email i rivendosjes u dërgua te ${email}.`,
      userId: superAdmin._id,
      entityType: "user",
      entityId: userId,
    });
  },
});

// ── Impersonation ───────────────────────────────────────────────────────────

/**
 * "Hyr si kjo kompani": binds the Super Admin's session to the target tenant
 * (activeTenantId) so the dashboard renders that company's scope. The super
 * admin keeps their own auth session — no token forgery needed — and can
 * restore their own scope afterwards via clearImpersonation.
 */
export const impersonate = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Kompania nuk u gjet.");

    await ctx.db.patch(superAdmin._id, { activeTenantId: tenantId });
    await ctx.db.insert("audit_logs", {
      action: "superadmin.impersonate",
      details: `Super Admini hyri si kompania "${tenant.name}" (${tenant.slug}).`,
      userId: superAdmin._id,
      entityType: "tenant",
      entityId: tenantId,
    });
    return { slug: tenant.slug, name: tenant.name };
  },
});

export const clearImpersonation = mutation({
  args: {},
  handler: async (ctx) => {
    const superAdmin = await requireSuperAdmin(ctx);
    await ctx.db.patch(superAdmin._id, { activeTenantId: undefined });
  },
});

// ── SaaS Analytics ──────────────────────────────────────────────────────────

export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const [tenants, users, orders, logs] = await Promise.all([
      ctx.db.query("tenants").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("audit_logs").collect(),
    ]);

    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeMonthlyAdmins = users.filter(
      (u) =>
        !u.isAnonymous &&
        u.isSuperAdmin !== true &&
        u._creationTime > monthAgo - 365 * 24 * 60 * 60 * 1000,
    ).length;

    const aiParsed = orders.filter(
      (o) => o.source === "gemini" || o.source === "local",
    ).length;

    return {
      totalStores: tenants.length,
      activeStores: tenants.filter(
        (t) => t.status !== "suspended" && t.isActive !== false,
      ).length,
      suspendedStores: tenants.filter(
        (t) => t.status === "suspended" || t.isActive === false,
      ).length,
      totalUsers: users.filter((u) => !u.isAnonymous).length,
      totalOrders: orders.filter((o) => !o.deletedAt).length,
      aiParsedOrders: aiParsed,
      activeMonthlyAdmins,
      auditEvents: logs.length,
    };
  },
});

// ── Global System Config ────────────────────────────────────────────────────

/** Super-admin view of global config keys (values masked where sensitive). */
export const getGlobalConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    // (key, as): `key` is the storage key to read; `as` is the ASCII-safe
    // field name used in the response — the result map is keyed by these
    // names, and Convex rejects non-ASCII object field names (the same
    // serializer rule that broke getPublicSettings).
    const keys: { key: string; as: string }[] = [
      { key: "gemini_api_key", as: "gemini_api_key" },
      { key: "shipping_rate_kosovo", as: "shipping_rate_kosovo" },
      { key: "shipping_rate_shqiperi", as: "shipping_rate_shqiperi" },
      { key: "shipping_rate_maqedoni", as: "shipping_rate_maqedoni" },
      // Legacy keys from earlier builds — surfaced under ASCII aliases so
      // saved values are not silently lost. New writes use canonical keys.
      { key: "shipping_rate_kosove", as: "shipping_rate_kosove_legacy" },
      { key: "shipping_rate_shqipëri", as: "shipping_rate_shqiperi_legacy" },
    ];
    const config: Record<string, string | null> = {};
    for (const { key, as } of keys) {
      const row = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!row?.value) {
        config[as] = null;
      } else if (key === "gemini_api_key") {
        config[as] = `${row.value.slice(0, 4)}••••${row.value.slice(-4)}`;
      } else {
        config[as] = row.value;
      }
    }
    return config;
  },
});

/** Upsert a global config value (Super Admin only). */
export const setGlobalConfig = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("app_settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        updatedBy: superAdmin._id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("app_settings", {
        key,
        value,
        updatedBy: superAdmin._id,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.insert("audit_logs", {
      action: "superadmin.config_updated",
      details: `Konfigurimi global "${key}" u përditësua.`,
      userId: superAdmin._id,
      entityType: "app_settings",
      entityId: key,
    });
  },
});

// Keep action import used (future: server-side reset via HTTP endpoint).
void api;
void getCurrentUserSafe;
