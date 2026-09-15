import { getAuthUserId } from "@convex-dev/auth/server";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

/**
 * Get the current user inside an action context (ctx.db is not available
 * there, so we run the currentUser query instead).
 */
export async function getCurrentUserSafe(
  ctx: ActionCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.runQuery(api.users.currentUser, {});
  return user ?? null;
}
