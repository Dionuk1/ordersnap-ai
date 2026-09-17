import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";
import { shippingRateKey } from "../lib/order-types";

/**
 * App settings store (e.g. Gemini API key, per-country shipping rates).
 * Admin only.
 *
 * Settings are stored per key in the `app_settings` table. Keys used by the
 * platform:
 *
 *  - gemini_api_key
 *  - shipping_rate_kosove
 *  - shipping_rate_shqipëri
 *  - shipping_rate_maqedoni
 */

// Returns only whether a key is set (never the secret itself) plus a masked hint.
// Also exposes configured per-country shipping rates (EUR) so the order form can
// auto-fill Tarifa Postare (€) from saved defaults.
//
// IMPORTANT: this query must NEVER throw. /orders/new and /settings both
// subscribe to it reactively — a thrown exception would crash those views.
// If the settings row(s) don't exist yet (fresh database, race with seeding,
// or an unexpected read error), we return a safe default object instead.
export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => {
    // Safe defaults used whenever the database has no settings yet or the
    // read fails for any reason (e.g. index not yet built after a push).
    const FALLBACK = {
      hasGeminiKey: false,
      geminiKeyMask: null as string | null,
      shippingRates: { ...DEFAULT_SHIPPING_RATES },
    };

    try {
      const user = await getCurrentUser(ctx);
      if (!user) {
        return FALLBACK;
      }

      const gemini = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
        .first();

      const masked = gemini?.value
        ? `${gemini.value.slice(0, 4)}••••${gemini.value.slice(-4)}`
        : null;

      const rates = await loadShippingRates(ctx as any);

      return {
        hasGeminiKey: Boolean(gemini?.value),
        geminiKeyMask: masked,
        shippingRates: rates,
      };
    } catch (err) {
      // Log for observability but never propagate to the client.
      console.error("getPublicSettings failed, returning defaults:", err);
      return FALLBACK;
    }
  },
});

const DEFAULT_SHIPPING_RATES: Record<string, number> = {
  "Kosovë": 2.0,
  "Shqipëri": 3.0,
  "Maqedoni": 3.0,
};

// Returns whether the Gemini API key is configured (used by /orders/new to decide engine)
export const hasGeminiKey = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    const gemini = await ctx.db
      .query("app_settings")
      .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
      .first();
    return Boolean(gemini?.value);
  },
});

// Admin only: read the actual secret (used server-side by the parse action)
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      return null;
    }
    const setting = await ctx.db
      .query("app_settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return setting?.value ?? null;
  },
});

// Read configured per-country shipping rates (EUR). Falls back to defaults
// for any country that has no saved value yet. Also wrapped defensively so a
// missing/failed read can never break the parent query.
async function loadShippingRates(ctx: any) {
  const rates: Record<string, number> = {};
  for (const country of ["Kosovë", "Shqipëri", "Maqedoni"]) {
    try {
      const row = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q: any) => q.eq("key", shippingRateKey(country)))
        .first();
      const parsed = parseFloat(row?.value ?? "");
      rates[country] = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SHIPPING_RATES[country];
    } catch {
      rates[country] = DEFAULT_SHIPPING_RATES[country];
    }
  }
  return rates;
}


// Admin only: upsert a setting
export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të modifikojë konfigurimet.");
    }

    // Shipping-rate keys must store valid positive EUR amounts.
    if (key.startsWith("shipping_rate_")) {
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Tarifa duhet të jetë numër i vlefshëm në €.");
      }
    }

    const existing = await ctx.db
      .query("app_settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("app_settings", {
        key,
        value,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
    }
  },
});


