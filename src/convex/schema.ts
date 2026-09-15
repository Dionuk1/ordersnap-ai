import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
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

// Order lifecycle status
export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const orderStatusValidator = v.union(
  ...ORDER_STATUSES.map((s) => v.literal(s)),
);
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // Secure app configuration (Gemini API key etc.), admin only
    app_settings: defineTable({
      key: v.string(),
      value: v.string(),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.optional(v.number()),
    }).index("by_key", ["key"]),

    // Express courier API integration config (per user, admin only)
    courier_integrations: defineTable({
      userId: v.id("users"),
      provider: v.string(),
      apiUrl: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      username: v.optional(v.string()),
      password: v.optional(v.string()),
      isEnabled: v.boolean(),
      lastSyncAt: v.optional(v.number()),
    }).index("by_user", ["userId"]),

    // Orders parsed from screenshots or entered manually
    orders: defineTable({
      orderNumber: v.string(),
      full_name: v.string(),
      phone_number: v.string(),
      city: v.string(),
      address: v.string(),
      product_notes: v.string(),
      total_amount: v.number(),
      status: orderStatusValidator,
      // which engine produced the parse: "gemini" | "local"
      parsedBy: v.optional(v.string()),
      // raw JSON string returned by the parser (for audit)
      rawResponse: v.optional(v.string()),
      // the user who created the order (agent or admin)
      createdBy: v.id("users"),
      courierShipmentId: v.optional(v.string()),
      courierSyncedAt: v.optional(v.number()),
      courierSyncError: v.optional(v.string()),
      deletedAt: v.optional(v.number()),
    })
      .index("by_createdBy", ["createdBy"])
      .index("by_status", ["status"])
      .index("by_orderNumber", ["orderNumber"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
