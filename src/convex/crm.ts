import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";

/**
 * Client CRM — aggregates per-client stats from the orders table
 * (no separate sync needed: everything derives from live order data).
 *
 * A "client" is identified by their phone number, which is the unique
 * customer key in this market (Kosovo 04X / +383 numbers).
 */

export interface ClientRow {
  _id: string; // synthetic: phone-based
  first_name: string;
  last_name: string;
  phone: string;
  instagram: string | null;
  city: string;
  country: string;
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  refusedOrders: number;
  refusalRate: number; // 0-100
  lastOrderAt: number;
}

export const listClients = query({
  args: {
    search: v.optional(v.string()),
    problematicOnly: v.optional(v.boolean()),
    minOrders: v.optional(v.number()),
  },
  handler: async (ctx, { search, problematicOnly, minOrders }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const admin = await isAdminUser(user);

    const all = await ctx.db.query("orders").collect();
    const visible = admin ? all : all.filter((o) => o.createdBy === user._id);

    // Aggregate by phone
    const byPhone = new Map<string, ClientRow>();
    for (const o of visible) {
      if (o.deletedAt) continue;
      const key = o.phone.replace(/\D/g, "");
      if (!key) continue;
      const existing = byPhone.get(key);
      const isDelivered = o.status === "delivered";
      const isRefused = o.status === "refused";

      if (existing) {
        existing.totalOrders += 1;
        if (isDelivered) {
          existing.deliveredOrders += 1;
          existing.totalSpent += o.totalAmount ?? 0;
        }
        if (isRefused) existing.refusedOrders += 1;
        // Keep the most recent identity info
        if (o._creationTime > existing.lastOrderAt) {
          existing.lastOrderAt = o._creationTime;
          existing.first_name = o.first_name;
          existing.last_name = o.last_name ?? "";
          existing.city = o.city;
          existing.country = o.country;
        }
        if (o.instagram) existing.instagram = o.instagram;
      } else {
        byPhone.set(key, {
          _id: key,
          first_name: o.first_name,
          last_name: o.last_name ?? "",
          phone: o.phone,
          instagram: o.instagram ?? null,
          city: o.city,
          country: o.country,
          totalOrders: 1,
          totalSpent: isDelivered ? (o.totalAmount ?? 0) : 0,
          deliveredOrders: isDelivered ? 1 : 0,
          refusedOrders: isRefused ? 1 : 0,
          refusalRate: 0,
          lastOrderAt: o._creationTime,
        });
      }
    }

    let rows = Array.from(byPhone.values());
    for (const row of rows) {
      row.refusalRate =
        row.totalOrders > 0
          ? Math.round((row.refusedOrders / row.totalOrders) * 100)
          : 0;
    }

    // Filters
    if (search && search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          c.first_name.toLowerCase().includes(needle) ||
          (c.last_name ?? "").toLowerCase().includes(needle) ||
          c.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "∅") ||
          c.city.toLowerCase().includes(needle),
      );
    }
    if (problematicOnly) {
      rows = rows.filter((c) => c.refusalRate >= 50 && c.totalOrders >= 2);
    }
    if (minOrders !== undefined && minOrders > 0) {
      rows = rows.filter((c) => c.totalOrders >= minOrders);
    }

    // Most valuable / most recent first
    rows.sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders);

    return rows;
  },
});

/** Overview aggregates for the CRM header cards. */
export const clientStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const admin = await isAdminUser(user);

    const all = await ctx.db.query("orders").collect();
    const visible = (admin ? all : all.filter((o) => o.createdBy === user._id)).filter(
      (o) => !o.deletedAt,
    );

    const phones = new Set(visible.map((o) => o.phone.replace(/\D/g, "")).filter(Boolean));
    const totalSpent = visible
      .filter((o) => o.status === "delivered")
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const refused = visible.filter((o) => o.status === "refused").length;

    return {
      totalClients: phones.size,
      totalOrders: visible.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      refusalRate:
        visible.length > 0 ? Math.round((refused / visible.length) * 100) : 0,
    };
  },
});
