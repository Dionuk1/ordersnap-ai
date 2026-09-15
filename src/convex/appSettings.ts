import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";

/**
 * App settings store (e.g. Gemini API key). Admin only.
 * Settings are stored per key in the `app_settings` table.
 */

// Returns only whether a key is set (never the secret itself) plus a masked hint
export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { hasGeminiKey: false, geminiKeyMask: null };

    const gemini = await ctx.db
      .query("app_settings")
      .withIndex("by_key", (q) => q.eq("key", "gemini_api_key"))
      .first();

    const masked = gemini?.value
      ? `${gemini.value.slice(0, 4)}••••${gemini.value.slice(-4)}`
      : null;

    return {
      hasGeminiKey: Boolean(gemini?.value),
      geminiKeyMask: masked,
    };
  },
});

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

// Admin only: upsert a setting
export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të modifikojë konfigurimet.");
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
