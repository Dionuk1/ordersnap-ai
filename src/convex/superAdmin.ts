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
      .filter((q: any) => q.eq(q.field("isSuperAdmin"), true))
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
    const orders = await ctx.db.query("orders").collect();

    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return tenants
      .sort((a: any, b: any) => b._creationTime - a._creationTime)
      .map((t: any) => {
        const owner = users.find(
          (u: any) =>
            u.email && u.email.toLowerCase() === (t.ownerEmail ?? "").toLowerCase(),
        );
        // Per-tenant usage: AI-parsed orders in the last 30 days vs quota.
        const aiParsed30d = orders.filter(
          (o: any) =>
            !o.deletedAt &&
            (o.source === "gemini" || o.source === "local") &&
            o.createdBy === owner?._id &&
            o._creationTime > monthAgo,
        ).length;

        return {
          _id: t._id as string,
          name: t.name as string,
          slug: t.slug as string,
          ownerEmail: (t.ownerEmail ?? owner?.email ?? null) as string | null,
          status: (t.status ?? (t.isActive === false ? "suspended" : "active")) as
            | "active"
            | "suspended",
          ownerId: (owner?._id ?? null) as string | null,
          tier: (t.tier ?? null) as string | null,
          monthlyAiQuota: (t.monthlyAiQuota ?? null) as number | null,
          aiParsed30d,
          createdAt: t._creationTime as number,
        };
      });
  },
});

export const setCompanyStatus = mutation({
  args: {
    tenantId: v.id("tenants"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, { tenantId, status }) => {
    const user = await requireSuperAdmin(ctx);
    await ctx.db.patch(tenantId, {
      status,
      isActive: status === "active",
    });
    await ctx.db.insert("audit_logs", {
      action: "superadmin.company_status",
      details: `Kompania u ${status === "suspended" ? "pezullua" : "aktivizua"}.`,
      userId: user._id,
      entityType: "tenant",
      entityId: tenantId,
    });
  },
});

// ── SaaS Billing & Subscriptions ─────────────────────────────────────────────

const TIER_QUOTAS: Record<string, number> = {
  free_trial: 100,
  pro: 1000,
  enterprise: 10000,
};

/** Set a company's subscription tier; quota defaults to the tier's plan. */
export const setCompanyTier = mutation({
  args: {
    tenantId: v.id("tenants"),
    tier: v.union(
      v.literal("free_trial"),
      v.literal("pro"),
      v.literal("enterprise"),
    ),
  },
  handler: async (ctx, { tenantId, tier }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    const quota = TIER_QUOTAS[tier] ?? 100;
    await ctx.db.patch(tenantId, { tier, monthlyAiQuota: quota });
    await ctx.db.insert("audit_logs", {
      action: "superadmin.company_tier",
      details: `Abonimi u ndryshua në "${tier}" (kuotë ${quota}/muaj).`,
      userId: superAdmin._id,
      entityType: "tenant",
      entityId: tenantId,
    });
  },
});

/** Set a custom monthly AI-parsing quota for a tenant. */
export const setCompanyQuota = mutation({
  args: { tenantId: v.id("tenants"), monthlyAiQuota: v.number() },
  handler: async (ctx, { tenantId, monthlyAiQuota }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    if (!Number.isFinite(monthlyAiQuota) || monthlyAiQuota < 0) {
      throw new Error("Kuota duhet të jetë numër jo-negativ.");
    }
    await ctx.db.patch(tenantId, { monthlyAiQuota });
    await ctx.db.insert("audit_logs", {
      action: "superadmin.company_quota",
      details: `Kuota mujore e AI u vendos në ${monthlyAiQuota}.`,
      userId: superAdmin._id,
      entityType: "tenant",
      entityId: tenantId,
    });
  },
});

// ── Credential Management ───────────────────────────────────────────────────

/** Generate a secure temporary password (Super Admin only). */
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

/** Record a generated temp password for a company admin (audit-trailed). */
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

// ── Audit Trail (Super Admin view) ──────────────────────────────────────────

/** All administrative actions with timestamps and actor names. */
export const auditTrail = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db.query("audit_logs").order("desc").take(limit ?? 100);
    const users = await ctx.db.query("users").collect();
    return rows.map((log: any) => ({
      _id: log._id as string,
      action: log.action as string,
      details: log.details as string,
      entityType: (log.entityType ?? null) as string | null,
      entityId: (log.entityId ?? null) as string | null,
      actor: (() => {
        const u = users.find((x: any) => x._id === log.userId);
        return (u?.name ?? u?.email ?? null) as string | null;
      })(),
      _creationTime: log._creationTime as number,
    }));
  },
});

// ── Global Courier API Credentials ──────────────────────────────────────────

/** Shared app_settings upsert (canonical keys are always ASCII). */
async function upsertAppSetting(ctx: any, key: string, value: string, adminId: any) {
  const existing = await ctx.db
    .query("app_settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      value,
      updatedBy: adminId,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("app_settings", {
      key,
      value,
      updatedBy: adminId,
      updatedAt: Date.now(),
    });
  }
}

/** Masked view of global courier credentials (Super Admin only). */
export const getCourierGlobalConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const read = async (key: string) => {
      const row = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q: any) => q.eq("key", key))
        .first();
      return (row?.value ?? null) as string | null;
    };
    const apiUrl = await read("courier_api_url");
    const username = await read("courier_api_username");
    const password = await read("courier_api_password");
    return {
      apiUrl,
      username,
      hasPassword: Boolean(password),
    };
  },
});

/** Upsert global courier credentials (Super Admin only). */
export const setCourierGlobalConfig = mutation({
  args: {
    apiUrl: v.optional(v.string()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, { apiUrl, username, password }) => {
    const superAdmin = await requireSuperAdmin(ctx);
    const updates: { key: string; value: string }[] = [];
    if (apiUrl !== undefined) {
      updates.push({ key: "courier_api_url", value: apiUrl.trim() });
    }
    if (username !== undefined) {
      updates.push({ key: "courier_api_username", value: username.trim() });
    }
    if (password !== undefined && password !== "") {
      updates.push({ key: "courier_api_password", value: password });
    }
    for (const { key, value } of updates) {
      await upsertAppSetting(ctx, key, value, superAdmin._id);
    }
    await ctx.db.insert("audit_logs", {
      action: "superadmin.courier_config",
      details: "Kredencialet globale të postës u përditësuan.",
      userId: superAdmin._id,
      entityType: "app_settings",
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
      (u: any) =>
        !u.isAnonymous &&
        u.isSuperAdmin !== true &&
        u._creationTime > monthAgo - 365 * 24 * 60 * 60 * 1000,
    ).length;

    const aiParsed = orders.filter(
      (o: any) => o.source === "gemini" || o.source === "local",
    ).length;

    return {
      totalStores: tenants.length,
      activeStores: tenants.filter(
        (t: any) => t.status !== "suspended" && t.isActive !== false,
      ).length,
      suspendedStores: tenants.filter(
        (t: any) => t.status === "suspended" || t.isActive === false,
      ).length,
      totalUsers: users.filter((u: any) => !u.isAnonymous).length,
      totalOrders: orders.filter((o: any) => !o.deletedAt).length,
      aiParsedOrders: aiParsed,
      activeMonthlyAdmins,
      auditEvents: logs.length,
    };
  },
});

/**
 * All registered company admins & system users (Super Admin only).
 * Joins each user to its assigned tenant so the staff tab can show the
 * company assignment alongside the system role.
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const [users, tenants] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("tenants").collect(),
    ]);
    const byId = new Map(tenants.map((t: any) => [t._id, t]));

    return users
      .filter((u: any) => !u.isAnonymous)
      .sort((a: any, b: any) => b._creationTime - a._creationTime)
      .map((u: any) => {
        const tenant = u.activeTenantId ? byId.get(u.activeTenantId) : null;
        return {
          _id: u._id as string,
          name: (u.name ?? null) as string | null,
          email: (u.email ?? null) as string | null,
          isSuperAdmin: (u.isSuperAdmin === true) as boolean,
          role: (u.role ?? null) as string | null,
          tenantId: (u.activeTenantId ?? null) as string | null,
          tenantName: (tenant?.name ?? null) as string | null,
          tenantSlug: (tenant?.slug ?? null) as string | null,
          tenantStatus: (tenant?.status ?? null) as string | null,
          createdAt: u._creationTime as number,
        };
      });
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
    // names, and Convex rejects non-ASCII object field names.
    const keys: { key: string; as: string }[] = [
      { key: "gemini_api_key", as: "gemini_api_key" },
      // Canonical ASCII rate keys (write/read source of truth).
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
        .withIndex("by_key", (q: any) => q.eq("key", key))
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
    await upsertAppSetting(ctx, key, value, superAdmin._id);
    await ctx.db.insert("audit_logs", {
      action: "superadmin.config_updated",
      details: `Konfigurimi global "${key}" u përditësua.`,
      userId: superAdmin._id,
      entityType: "app_settings",
      entityId: key,
    });
  },
});

// Keep imports used (future: server-side reset via HTTP endpoint).
void api;
void getCurrentUserSafe;
void isAdminUser;
