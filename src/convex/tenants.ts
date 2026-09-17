import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, isAdminUser } from "./users";

/** Multi-tenant workspaces: branding + active-workspace binding. */

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, "-");
}

/** Public branding lookup used by /login?tenant={slug}. null when not found. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const normalized = normalizeSlug(slug);
    if (!normalized) return null;
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", normalized))
      .unique();
    return tenant ?? null;
  },
});

/**
 * Public lookup by the tenant owner's email, used by the login page to
 * auto-populate the dedicated company link box as the user types.
 */
export const resolveByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) return null;
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_ownerEmail", (q) => q.eq("ownerEmail", normalized))
      .first();
    if (!tenant || tenant.isActive === false) return null;
    return { slug: tenant.slug, name: tenant.name };
  },
});

/** Active workspace of the signed-in user (null when none bound). */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user?.activeTenantId) return null;
    return (await ctx.db.get(user.activeTenantId)) ?? null;
  },
});

/**
 * Bind the signed-in user's session/workspace to a tenant. Called right after
 * a successful tenant-specific sign-in; passing no tenantId clears the scope.
 */
export const setActiveTenant = mutation({
  args: { tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, { tenantId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    if (tenantId) {
      const tenant = await ctx.db.get(tenantId);
      if (!tenant) throw new Error("Kompania nuk u gjet");
    }
    await ctx.db.patch(user._id, { activeTenantId: tenantId });
  },
});

/** Admin upsert for a company's branded login page. */
export const upsert = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    subtitle: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    ownerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të menaxhojë kompanitë.");
    }
    const slug = normalizeSlug(args.slug);
    if (!slug) throw new Error("Slug i pavlefshëm");

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    const patch = {
      name: args.name,
      subtitle: args.subtitle,
      logoUrl: args.logoUrl,
      accentColor: args.accentColor,
      isActive: args.isActive,
      ownerEmail: args.ownerEmail?.trim().toLowerCase(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("tenants", {
      ...patch,
      slug,
      createdBy: user._id,
    });
  },
});

/**
 * Idempotent demo tenant ("flladituks") so the branded login flow is
 * demoable out of the box. Public on purpose: it can only ever create the
 * single fixed demo document and returns the existing one otherwise.
 */
export const ensureDemoTenant = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", "flladituks"))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("tenants", {
      slug: "flladituks",
      name: "FlladituKS",
      subtitle: "Hyr në llogarinë tënde",
      ownerEmail: "flladituksshop@hotmail.com",
      isActive: true,
    });
  },
});
