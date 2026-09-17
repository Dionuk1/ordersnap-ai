import { v } from "convex/values";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";
import { ORDER_STATUSES, type OrderStatus } from "./schema";

const generateOrderNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `OS-${y}${m}${d}-${rand}`;
};

export const list = query({
  args: {
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { status, search, paginationOpts }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const admin = await isAdminUser(user);

    let results;
    if (status && ORDER_STATUSES.includes(status as OrderStatus)) {
      results = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", status as OrderStatus))
        .order("desc")
        .paginate(paginationOpts);
    } else {
      results = await ctx.db
        .query("orders")
        .order("desc")
        .paginate(paginationOpts);
    }

    if (!admin) {
      results = {
        ...results,
        page: results.page.filter((o) => o.createdBy === user._id),
      };
    }

    const filtered = search
      ? results.page.filter((o) => {
          const s = search.toLowerCase();
          return (
            o.first_name.toLowerCase().includes(s) ||
            (o.last_name?.toLowerCase().includes(s) ?? false) ||
            o.phone.toLowerCase().includes(s) ||
            o.city.toLowerCase().includes(s) ||
            o.orderNumber.toLowerCase().includes(s)
          );
        })
      : results.page;

    return { ...results, page: filtered } as PaginationResult<
      (typeof results)["page"][number]
    >;
  },
});

export const get = query({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const order = await ctx.db.get(id);
    if (!order || order.deletedAt) return null;
    const admin = await isAdminUser(user);
    if (!admin && order.createdBy !== user._id) return null;
    return order;
  },
});

export const create = mutation({
  args: {
    first_name: v.string(),
    last_name: v.optional(v.string()),
    phone: v.string(),
    instagram: v.optional(v.string()),
    postalProvider: v.optional(v.string()),
    country: v.string(),
    city: v.string(),
    address: v.string(),
    addressDetails: v.optional(v.string()),
    productDescription: v.string(),
    productPrice: v.number(),
    postalFee: v.optional(v.number()),
    totalAmount: v.number(),
    deliveryOpen: v.optional(v.boolean()),
    deliveryExchange: v.optional(v.boolean()),
    source: v.optional(v.string()),
    trackingBarcode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const id = await ctx.db.insert("orders", {
      ...args,
      orderNumber: generateOrderNumber(),
      status: "pending",
      createdBy: user._id,
      postalProvider: args.postalProvider ?? "Cheetah",
    });

    await ctx.db.insert("audit_logs", {
      action: "order.created",
      details: `Porosi e re ${args.first_name} ${args.phone} — €${args.totalAmount}`,
      userId: user._id,
      entityType: "order",
      entityId: id,
    });

    return id;
  },
});

export const updateStatus = mutation({
  args: { id: v.id("orders"), status: v.string() },
  handler: async (ctx, { id, status }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const order = await ctx.db.get(id);
    if (!order || order.deletedAt) throw new Error("Porosia nuk u gjet");
    const admin = await isAdminUser(user);
    if (!admin && order.createdBy !== user._id) {
      throw new Error("Nuk kini leje për këtë porosi");
    }
    if (!ORDER_STATUSES.includes(status as OrderStatus)) {
      throw new Error("Status i pavlefshëm");
    }
    await ctx.db.patch(id, { status: status as OrderStatus });
  },
});

export const remove = mutation({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Strict ID type validation + pre-deletion existence check: never throw
    // on a missing/already-deleted order — return null so the client sees a
    // graceful no-op instead of a runtime crash (real-time subscriptions
    // can race the UI: a row may vanish before the delete request lands).
    if (!id) return null;
    const existingOrder = await ctx.db.get(id);
    if (!existingOrder || existingOrder.deletedAt) return null;

    const admin = await isAdminUser(user);
    if (!admin && existingOrder.createdBy !== user._id) {
      throw new Error("Nuk kini leje për këtë porosi");
    }

    await ctx.db.patch(id, { deletedAt: Date.now() });

    await ctx.db.insert("audit_logs", {
      action: "order.removed",
      details: `Porosia ${existingOrder.orderNumber} u fshij (soft-delete).`,
      userId: user._id,
      entityType: "order",
      entityId: id,
    });

    return id;
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const admin = await isAdminUser(user);

    const all = await ctx.db.query("orders").collect();
    const visible = admin ? all : all.filter((o) => o.createdBy === user._id);
    const active = visible.filter((o) => !o.deletedAt);

    const byStatus: Record<string, number> = {};
    for (const s of ORDER_STATUSES) byStatus[s] = 0;
    for (const o of active) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

    const revenue = active
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

    // Wallet balance: collected cash on delivered orders minus shipped-but-
    // not-yet-paid balance. Delivered = money in, everything else pending.
    const deliveredSum = revenue;
    const pipelineSum = active
      .filter((o) => o.status === "active")
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

    return {
      total: active.length,
      byStatus,
      revenue,
      todayCount: active.filter(
        (o) => o._creationTime > Date.now() - 24 * 60 * 60 * 1000,
      ).length,
      wallet: Math.round((deliveredSum - pipelineSum) * 100) / 100,
    };
  },
});

export const markCourierSynced = mutation({
  args: { id: v.id("orders"), shipmentId: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { id, shipmentId, error }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const order = await ctx.db.get(id);
    if (!order || order.deletedAt) throw new Error("Porosia nuk u gjet");
    await ctx.db.patch(id, {
      courierShipmentId: shipmentId,
      courierSyncedAt: Date.now(),
      courierSyncError: error,
    });
  },
});

export const saveTrackingBarcode = mutation({
  args: { id: v.id("orders"), barcode: v.string() },
  handler: async (ctx, { id, barcode }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const order = await ctx.db.get(id);
    if (!order || order.deletedAt) throw new Error("Porosia nuk u gjet");
    await ctx.db.patch(id, { trackingBarcode: barcode });
  },
});

// Recent orders for dashboard widget
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const admin = await isAdminUser(user);
    const orders = await ctx.db
      .query("orders")
      .order("desc")
      .take(limit ?? 5);
    if (admin) return orders;
    return orders.filter((o) => o.createdBy === user._id);
  },
});
