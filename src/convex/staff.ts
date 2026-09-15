import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";

/** Staff management — admin only. Agents see the list but cannot change roles. */

export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const admin = await isAdminUser(user);
    if (!admin) throw new Error("Vetëm admini mund të shikojë stafin.");

    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isAnonymous)
      .map((u) => ({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        role: u.role ?? "agent",
        _creationTime: u._creationTime,
      }));
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("agent")) },
  handler: async (ctx, { userId, role }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të ndryshojë rolet.");
    }
    await ctx.db.patch(userId, {
      role: role === "admin" ? "admin" : "member",
    });
  },
});

/** Self-assign role: the very first registered user becomes admin automatically. */
export const claimFirstAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (user.role === "admin") return "already-admin";

    const staff = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    if (!staff) {
      await ctx.db.patch(user._id, { role: "admin" });
      return "promoted";
    }
    return "has-admin";
  },
});
