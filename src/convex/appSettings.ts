import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";

/**
 * App settings store (e.g. Gemini API key, per-country shipping rates).
 *
 * ZERO-THROW CONTRACT: every query in this module is wrapped so it can never
 * produce a "[CONVEX Q(...)] Server Error" on the client — not when the table
 * is uninitialized, not when rows are missing, not on any unexpected read
 * failure. /orders/new and /settings subscribe to these reactively; a thrown
 * exception would crash those views, so the absolute fallback objects below
 * are returned instead.
 *
 * NOTE: this module intentionally has NO imports from outside convex/ —
 * module-evaluation failures in imported app code bypass handler try/catch
 * entirely and would surface as Server Errors.
 */

// Absolute fallback — NEVER THROW. Mirrored client-side in NewOrder.tsx
// (DEFAULT_APP_SETTINGS) so loading/error states show the same defaults.
const FALLBACK_PUBLIC_SETTINGS = {
  hasGeminiKey: false,
  geminiKeyMask: null as string | null,
  defaultCurrency: "EUR",
  courierProvider: "cheetah",
  shippingRates: {
    "Kosovë": 2.0,
    "Shqipëri": 3.0,
    "Maqedoni": 3.0,
  } as Record<string, number>,
};

// Self-contained key builder (was imported from lib/order-types — kept inline
// so this module stays dependency-free).
function shippingRateKey(country: string): string {
  return `shipping_rate_${country.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

// Returns only whether a key is set (never the secret itself) plus a masked
// hint. Also exposes configured per-country shipping rates (EUR) so the order
// form can auto-fill Tarifa Postare (€) from saved defaults.
export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user) {
        // Unauthenticated subscription (session race during load): defaults,
        // never an error.
        return FALLBACK_PUBLIC_SETTINGS;
      }

      const gemini = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
        .first();

      const masked = gemini?.value
        ? `${gemini.value.slice(0, 4)}••••${gemini.value.slice(-4)}`
        : null;

      const rates = await loadShippingRates(ctx);

      return {
        hasGeminiKey: Boolean(gemini?.value),
        geminiKeyMask: masked,
        defaultCurrency: FALLBACK_PUBLIC_SETTINGS.defaultCurrency,
        courierProvider: FALLBACK_PUBLIC_SETTINGS.courierProvider,
        shippingRates: rates,
      };
    } catch (err) {
      // Log for observability but never propagate to the client.
      console.error("getPublicSettings failed, returning defaults:", err);
      return FALLBACK_PUBLIC_SETTINGS;
    }
  },
});

const DEFAULT_SHIPPING_RATES: Record<string, number> = {
  "Kosovë": 2.0,
  "Shqipëri": 3.0,
  "Maqedoni": 3.0,
};

// Returns whether the Gemini API key is configured (used by /orders/new to
// decide the parse engine). NEVER throws — a failed/missing read simply means
// "not configured" and the local parser engine is used.
export const hasGeminiKey = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user) return false;
      const gemini = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
        .first();
      return Boolean(gemini?.value);
    } catch (err) {
      console.error("hasGeminiKey failed, treating as not configured:", err);
      return false;
    }
  },
});

// Admin only: read the actual secret (used server-side by the parse action).
// NEVER throws — returns null on any missing/unauthorized/failed read.
export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user || !(await isAdminUser(user))) {
        return null;
      }
      const setting = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      return setting?.value ?? null;
    } catch (err) {
      console.error(`getSetting(${key}) failed:`, err);
      return null;
    }
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
      rates[country] =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_SHIPPING_RATES[country];
    } catch {
      rates[country] = DEFAULT_SHIPPING_RATES[country];
    }
  }
  return rates;
}

// Admin only: upsert a setting. Throws only on authorization/validation
// problems (surfaced to the UI as toasts); DB read races are handled safely.
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

    let existing: { _id: any } | null = null;
    try {
      existing = await ctx.db
        .query("app_settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
    } catch (err) {
      console.error(`setSetting(${key}) read failed, will insert:`, err);
      existing = null;
    }
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
