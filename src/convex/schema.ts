import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const ORDER_STATUSES = [
  "pending",
  "active",
  "delivered",
  "refused",
  "cancelled",
] as const;

export const orderStatusValidator = v.union(
  ...ORDER_STATUSES.map((s) => v.literal(s)),
);
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      activeTenantId: v.optional(v.id("tenants")),
    }).index("email", ["email"]),

    // Multi-tenant workspaces resolved via /login?tenant={slug}
    tenants: defineTable({
      slug: v.string(),
      name: v.string(),
      subtitle: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      isActive: v.optional(v.boolean()),
      ownerEmail: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_slug", ["slug"])
      .index("by_ownerEmail", ["ownerEmail"]),

    app_settings: defineTable({
      key: v.string(),
      value: v.string(),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.optional(v.number()),
    }).index("by_key", ["key"]),

    courier_integrations: defineTable({
      userId: v.id("users"),
      provider: v.string(),
      apiUrl: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      username: v.optional(v.string()),
      password: v.optional(v.string()),
      isEnabled: v.boolean(),
      autoDispatch: v.optional(v.boolean()),
      lastSyncAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    orders: defineTable({
      orderNumber: v.string(),
      // Client data
      first_name: v.string(),
      last_name: v.optional(v.string()),
      phone: v.string(),
      instagram: v.optional(v.string()),
      // Address & postal
      postalProvider: v.optional(v.string()),
      country: v.string(),
      city: v.string(),
      address: v.string(),
      addressDetails: v.optional(v.string()),
      // Product & pricing
      productDescription: v.string(),
      productPrice: v.number(),
      postalFee: v.optional(v.number()),
      totalAmount: v.number(),
      // Delivery options
      deliveryOpen: v.optional(v.boolean()),
      deliveryExchange: v.optional(v.boolean()),
      // Status & tracking
      status: orderStatusValidator,
      trackingBarcode: v.optional(v.string()),
      // Audit
      source: v.optional(v.string()),
      createdBy: v.id("users"),
      courierShipmentId: v.optional(v.string()),
      courierSyncedAt: v.optional(v.number()),
      courierSyncError: v.optional(v.string()),
      deletedAt: v.optional(v.number()),
    })
      .index("by_createdBy", ["createdBy"])
      .index("by_status", ["status"])
      .index("by_orderNumber", ["orderNumber"])
      .index("by_phone", ["phone"]),

    clients: defineTable({
      first_name: v.string(),
      last_name: v.optional(v.string()),
      phone: v.string(),
      instagram: v.optional(v.string()),
      city: v.string(),
      country: v.optional(v.string()),
      totalOrders: v.number(),
      totalSpent: v.number(),
      refusedOrders: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_phone", ["phone"])
      .index("by_createdBy", ["createdBy"]),

    audit_logs: defineTable({
      action: v.string(),
      details: v.string(),
      userId: v.id("users"),
      entityType: v.optional(v.string()),
      entityId: v.optional(v.string()),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
