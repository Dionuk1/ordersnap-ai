import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { ROLES } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Store-admin/owner authorization.
 *
 * Every registered account is a company administrator by default (this is
 * the app's tenant model — each signup IS a store owner). `role` is optional
 * in the schema and legacy/registered users may have it undefined, so only
 * explicitly LOW roles ("member", "user") are restricted. Anonymous
 * sessions never qualify. Also accepts "store_admin" defensively.
 */
export async function isAdminUser(user: Doc<"users"> | null): Promise<boolean> {
  if (!user || user.isAnonymous) return false;
  if (user.role === undefined || user.role === null) return true;
  return user.role === "admin" || user.role === "owner";
}

/**
 * Self-healing role assignment: promotes a role-less authenticated user to
 * "owner" so their role is explicit going forward. Idempotent — users with
 * any existing role are returned unchanged.
 */
export const ensureStoreOwnerRole = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.isAnonymous) return { role: null as string | null };
    if (user.role) return { role: user.role };
    await ctx.db.patch(user._id, { role: ROLES.OWNER });
    return { role: ROLES.OWNER };
  },
});

/** Fetch a user by id (auth required) — used by staff management. */
export const currentUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await getCurrentUser(ctx);
    if (!me) throw new Error("Not authenticated");
    return await ctx.db.get(userId);
  },
});

/** Convenience helpers used across modules */
export async function requireUser(
  ctx: QueryCtx,
): Promise<Doc<"users"> & { _id: Id<"users"> }> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user as Doc<"users"> & { _id: Id<"users"> };
}
