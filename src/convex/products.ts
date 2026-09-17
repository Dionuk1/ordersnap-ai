import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Product catalog: listing, filtering, details and demo seeding. */

export type ProductSort = "newest" | "price_asc" | "price_desc" | "name_asc";

const SORT_FIELDS: Record<ProductSort, "name" | "price"> = {
  newest: "name",
  price_asc: "price",
  price_desc: "price",
  name_asc: "name",
};

/** Public catalog list — search, category filter, sort. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(v.string()),
  },
  handler: async (ctx, { search, category, sort }) => {
    const sortKey = (SORT_FIELDS[(sort ?? "newest") as ProductSort] ?? "name") as
      | "name"
      | "price";

    let products = ctx.db.query("products").withIndex("by_active", (q) => q.eq("isActive", true));

    if (category && category !== "all") {
      products = ctx.db.query("products").withIndex("by_category", (q) =>
        q.eq("category", category),
      ) as typeof products;
    }

    let rows = await products.collect();

    // Search across name/description/category
    if (search && search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.description ?? "").toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle),
      );
    }

    switch (sortKey) {
      case "price":
        rows.sort((a, b) =>
          sort === "price_desc" ? b.price - a.price : a.price - b.price,
        );
        break;
      default:
        rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    return rows;
  },
});

/** Public product detail by id. */
export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/** Distinct active categories for the filter chips. */
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return [...new Set(rows.map((p) => p.category))].sort();
  },
});

/**
 * Idempotent demo catalog seeder so /catalog is populated out of the box.
 * Creates one product per slug if it doesn't already exist.
 */
export const ensureDemoProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const demo = [
      {
        slug: "fustan-veror-elegance",
        name: "Fustan Veror Elegance",
        category: "Veshje",
        price: 34.9,
        compareAtPrice: 44.9,
        stock: 12,
        description:
          "Fustan i lehtë veror me material të frymëmarrë, ideal për ditët e nxehta. Prerje moderne, ngjyrë neutral.",
        images: [],
        specs: [
          { key: "Materiali", value: "Viskozë 95%, Elastan 5%" },
          { key: "Madhësitë", value: "S / M / L / XL" },
          { key: "Ngjyra", value: "Bezhë, E zezë, Blu e errët" },
          { key: "Origjina", value: "Shqipëri" },
        ],
      },
      {
        slug: "kendishe-sport-nike-air",
        name: "Këpucë Sport AirFlex",
        category: "Këpucë",
        price: 59.0,
        stock: 8,
        description:
          "Këpucë sportive me themel amortizues dhe pjesë të sipërme të frymëmarrë. Për vrapim dhe përditshmëri.",
        images: [],
        specs: [
          { key: "Materiali", value: "Mesh tekstil, gome" },
          { key: "Madhësitë", value: "39 - 45" },
          { key: "Pesha", value: "280g (madhësia 42)" },
          { key: "Garanci", value: "12 mujore" },
        ],
      },
      {
        slug: "ore-intelligente-smartwatch-x2",
        name: "Smartwatch X2 Pro",
        category: "Elektronikë",
        price: 79.5,
        compareAtPrice: 99.0,
        stock: 0,
        description:
          "Ore e zgjuar me ekran AMOLED, matje të rrahjeve të zemrës, SpO2 dhe bateri 10-ditore.",
        images: [],
        specs: [
          { key: "Ekrani", value: "1.43\" AMOLED 466×466" },
          { key: "Bateria", value: "410 mAh — deri 10 ditë" },
          { key: "Rezistenca", value: "IP68" },
          { key: "Lidhshmëria", value: "Bluetooth 5.2" },
        ],
      },
      {
        slug: "cante-globe-lekur",
        name: "Çantë Globe Lëkur",
        category: "Aksesorë",
        price: 45.0,
        stock: 15,
        description:
          "Çantë lëkuri e punuar me dorë, me hapësirë për laptop 15\" dhe organizim të brendshëm praktik.",
        images: [],
        specs: [
          { key: "Materiali", value: "Lëkurë natyrale" },
          { key: "Dimensionet", value: "38 × 28 × 10 cm" },
          { key: "Ngjyra", value: "Kafe, E zezë" },
        ],
      },
      {
        slug: "trikotazh-basic-pack-3",
        name: "Trikotazh Basic (Pakët 3)",
        category: "Veshje",
        price: 19.9,
        stock: 30,
        description:
          "Pakët me 3 trikotazh bazë, pambuk 100%, prerje e rregullt që nuk deformohet pas larjes.",
        images: [],
        specs: [
          { key: "Materiali", value: "Pambuk 100%" },
          { key: "Madhësitë", value: "S - XXL" },
          { key: "Përmbajtja", value: "3 copë / pakët" },
        ],
      },
      {
        slug: "audiefone-bluetooth-basspro",
        name: "Audiefone Bluetooth BassPro",
        category: "Elektronikë",
        price: 29.9,
        compareAtPrice: 39.9,
        stock: 22,
        description:
          "Audiefone pa tela me reduktim zhurmash, 30 orë luajtje dhe mikrofon i integruar për thirrje.",
        images: [],
        specs: [
          { key: "Bateria", value: "30 orë luajtje" },
          { key: "Bluetooth", value: "5.3, rreze 10m" },
          { key: "Rezistenca", value: "IPX5 (ujë)" },
        ],
      },
    ];

    const created: string[] = [];
    for (const item of demo) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .unique();
      if (existing) continue;
      const id = await ctx.db.insert("products", {
        ...item,
        isActive: true,
      });
      created.push(id);
    }
    return created.length;
  },
});
