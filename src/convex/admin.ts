import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Dedicated Admin Control Panel backend (used by /admin).
 *
 * Access control: functions are restricted to users with the `admin` role.
 * Additionally, every mutation accepts an optional `masterPasskey` argument —
 * when the ADMIN_MASTER_PASSKEY environment variable is configured, a caller
 * with a valid passkey can perform admin actions even without the admin role.
 */

const MASTER_PASSKEY_ENV = "ADMIN_MASTER_PASSKEY";

/** Resolve whether the caller may perform admin actions. */
async function canAdminister(
  ctx: unknown,
  masterPasskey?: string | null,
): Promise<boolean> {
  const user = await getCurrentUser(ctx as never);
  if (user && (await isAdminUser(user))) return true;

  const passkey = (process.env[MASTER_PASSKEY_ENV] ?? "").trim();
  if (passkey && masterPasskey && masterPasskey.trim() === passkey) return true;

  return false;
}
void canAdminister;

// Minimal structural type so helpers work in both query and mutation contexts.
interface QueryLike {
  db: {
    get(id: Id<"users">): Promise<Doc<"users"> | null>;
    insert(table: "audit_logs", doc: {
      action: string;
      details: string;
      userId: Id<"users">;
      entityType?: string;
      entityId?: string;
    }): Promise<Id<"audit_logs">>;
  };
}

async function requireAdmin(
  ctx: unknown,
  masterPasskey?: string | null,
): Promise<Doc<"users"> & { _id: Id<"users"> }> {
  const user = await getCurrentUser(ctx as never);
  if (!user || !(await isAdminUser(user))) {
    const passkey = (process.env[MASTER_PASSKEY_ENV] ?? "").trim();
    if (passkey && masterPasskey && masterPasskey.trim() === passkey) {
      // Passkey-only access is allowed without a user record.
      return null as never;
    }
    throw new Error("Akses i kufizuar: vetëm administratorët.");
  }
  return user as Doc<"users"> & { _id: Id<"users"> };
}

// ── System Overview ────────────────────────────────────────────────────────

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Akses i kufizuar: vetëm administratorët.");
    }

    const [users, orders, tenants, logs] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("tenants").collect(),
      ctx.db.query("audit_logs").collect(),
    ]);

    const realUsers = users.filter((u) => !u.isAnonymous);
    const activeOrders = orders.filter((o) => !o.deletedAt);

    const revenue = activeOrders
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

    const pipeline = activeOrders
      .filter((o) => o.status === "active")
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const ordersToday = activeOrders.filter(
      (o) => o._creationTime > last24h,
    ).length;

    // Courier (Posta Cheetah) status
    const courierRows = await ctx.db.query("courier_integrations").collect();
    const cheetah = courierRows.find((r) => r.provider === "cheetah");
    const dispatched = activeOrders.filter(
      (o) => o.trackingBarcode || o.courierShipmentId,
    ).length;
    const dispatchErrors = activeOrders.filter(
      (o) => o.courierSyncError,
    ).length;

    // API usage: count of AI parses logged in audit trail
    const aiParses = logs.filter(
      (l) => l.action === "order.created" && l.details.includes("€"),
    ).length;

    return {
      totalUsers: realUsers.length,
      totalTenants: tenants.length,
      totalOrders: activeOrders.length,
      ordersToday,
      revenue: Math.round(revenue * 100) / 100,
      pipeline: Math.round(pipeline * 100) / 100,
      courier: {
        configured: Boolean(cheetah?.username && cheetah?.password),
        autoDispatch: cheetah?.autoDispatch ?? false,
        dispatched,
        dispatchErrors,
        lastSyncAt: cheetah?.lastSyncAt ?? null,
      },
      recentAuditCount: logs.length,
    };
  },
});

// ── User Directory ────────────────────────────────────────────────────────

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Akses i kufizuar: vetëm administratorët.");
    }
    const users = await ctx.db.query("users").collect();
    const tenants = await ctx.db.query("tenants").collect();

    return users
      .filter((u) => !u.isAnonymous)
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((u) => {
        const tenant = tenants.find((t) => t.ownerEmail === u.email);
        return {
          _id: u._id,
          name: u.name ?? null,
          email: u.email ?? null,
          image: u.image ?? null,
          role: u.role ?? "member",
          companySlug: tenant?.slug ?? null,
          companyName: tenant?.name ?? null,
          _creationTime: u._creationTime,
        };
      });
  },
});

const DIRECTORY_ROLES = ["admin", "user", "member"] as const;

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("user"),
      v.literal("member"),
    ),
    masterPasskey: v.optional(v.string()),
  },
  handler: async (ctx, { userId, role, masterPasskey }) => {
    const user = await requireAdmin(ctx, masterPasskey);
    if (!user) throw new Error("Akses i kufizuar.");
    if (user._id === userId && role !== "admin") {
      throw new Error("Nuk mund t'i hiqni vetes rolin e adminit.");
    }
    if (!DIRECTORY_ROLES.includes(role as (typeof DIRECTORY_ROLES)[number])) {
      throw new Error("Rol i pavlefshëm.");
    }
    await ctx.db.patch(userId, { role });
    await ctx.db.insert("audit_logs", {
      action: "user.role_changed",
      details: `Roli i përdoruesit u ndryshua në "${role}".`,
      userId: user._id,
      entityType: "user",
      entityId: userId,
    });
  },
});

// ── System Audit Trail ────────────────────────────────────────────────────

export const auditTrail = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Akses i kufizuar: vetëm administratorët.");
    }
    const rows = await ctx.db
      .query("audit_logs")
      .order("desc")
      .take(limit ?? 50);

    // Resolve user names for display
    const users = await ctx.db.query("users").collect();
    return rows.map((log) => ({
      _id: log._id,
      action: log.action,
      details: log.details,
      entityType: log.entityType ?? null,
      entityId: log.entityId ?? null,
      user: (() => {
        const u = users.find((x) => x._id === log.userId);
        return u?.name ?? u?.email ?? null;
      })(),
      _creationTime: log._creationTime,
    }));
  },
});
