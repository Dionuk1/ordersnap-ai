import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUser, isAdminUser } from "./users";
import { getCurrentUserSafe } from "./authHelpers";

/**
 * Konfigurimi i Postës (Posta Cheetah) — Posta Cheetah Express integration.
 *
 * Credentials are stored in the `courier_integrations` table (one row per
 * admin, provider "cheetah"). The login test and dispatch calls hit the
 * Cheetah Express REST API directly with fetch().
 */

const CHEETAH_DEFAULT_BASE = "https://apigw.posta-ime.com";

function cheetahBase(customUrl?: string | null): string {
  const raw = (customUrl ?? "").trim();
  if (!raw) return CHEETAH_DEFAULT_BASE;
  return raw.replace(/\/+$/, "");
}

async function loadCheetahConfig(ctx: any) {
  const user = await getCurrentUser(ctx);
  if (!user || !(await isAdminUser(user))) return null;
  const row = await ctx.db
    .query("courier_integrations")
    .withIndex("by_user", (q: any) => q.eq("userId", user._id))
    .filter((q: any) => q.eq(q.field("provider"), "cheetah"))
    .first();
  return row ?? null;
}

/** Admin only: public view of the Cheetah config (secrets masked). ZERO-THROW:
 *  any read failure (uninitialized table/index, session race) returns the
 *  disabled-config shape instead of crashing subscribers like /orders/new. */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    try {
      const row = await loadCheetahConfig(ctx);
      if (!row) {
        return CHEETAH_CONFIG_DISABLED;
      }
      return {
        hasCredentials: Boolean(row.username && row.password),
        username: row.username ?? null,
        apiUrl: row.apiUrl ?? null,
        autoDispatch: row.autoDispatch ?? false,
        lastSyncAt: row.lastSyncAt ?? null,
      };
    } catch (err) {
      console.error("cheetah.getConfig failed, returning disabled config:", err);
      return CHEETAH_CONFIG_DISABLED;
    }
  },
});

// Safe fallback shape used whenever the courier config cannot be read.
const CHEETAH_CONFIG_DISABLED = {
  hasCredentials: false,
  username: null as string | null,
  apiUrl: null as string | null,
  autoDispatch: false,
  lastSyncAt: null as number | null,
};

/** Admin only: save Cheetah credentials + auto-dispatch preference. */
export const saveConfig = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    apiUrl: v.optional(v.string()),
    autoDispatch: v.boolean(),
  },
  handler: async (ctx, { username, password, apiUrl, autoDispatch }) => {
    const user = await getCurrentUser(ctx);
    if (!user || !(await isAdminUser(user))) {
      throw new Error("Vetëm admini mund të konfigurojë postën.");
    }
    const existing = await ctx.db
      .query("courier_integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("provider"), "cheetah"))
      .first();

    const patch = {
      username: username.trim(),
      password: password,
      apiUrl: apiUrl?.trim() || undefined,
      autoDispatch,
      isEnabled: Boolean(username.trim() && password),
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, lastSyncAt: existing.lastSyncAt });
    } else {
      await ctx.db.insert("courier_integrations", {
        userId: user._id,
        provider: "cheetah",
        ...patch,
      });
    }

    await ctx.db.insert("audit_logs", {
      action: "cheetah.config_saved",
      details: `Kredencialet e Postës Cheetah u ruajtën (autoDispatch: ${autoDispatch}).`,
      userId: user._id,
      entityType: "courier_integration",
    });
  },
});

export type CheetahTestResult = {
  ok: boolean;
  message: string;
  tokenReceived?: boolean;
};

/**
 * Admin only: "Testo Lidhjen" — sends the auth request to the Cheetah Express
 * login endpoint using Shfrytëzuesi & Fjalëkalimi and reports success/error.
 */
export const testConnection = action({
  args: {
    username: v.string(),
    password: v.string(),
    apiUrl: v.optional(v.string()),
  },
  handler: async (ctx, { username, password, apiUrl }): Promise<CheetahTestResult> => {
    const user = await getCurrentUserSafe(ctx);
    if (!user || !(await isAdminUser(user))) {
      return { ok: false, message: "Vetëm admini mund të testojë lidhjen." };
    }
    if (!username.trim() || !password) {
      return { ok: false, message: "Plotësoni Shfrytëzuesin dhe Fjalëkalimin." };
    }

    const base = cheetahBase(apiUrl);
    try {
      const res = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        return {
          ok: false,
          message:
            res.status === 401 || res.status === 403
              ? "Kredencialet janë të pasakta (401)."
              : `Serveri i Cheetah u përgjigj me status ${res.status}.`,
        };
      }

      // Successful login should yield a token of some shape.
      const data: any = await res.json().catch(() => null);
      const token =
        data?.token ?? data?.access_token ?? data?.data?.token ?? data?.data?.access_token ?? null;
      return {
        ok: true,
        message: "Lidhja me Postën Cheetah funksionoi. ✅",
        tokenReceived: Boolean(token),
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? `Gabim rrjeti: ${err.message}` : "Gabim rrjeti i panjohur.",
      };
    }
  },
});

export type CheetahDispatchResult = {
  ok: boolean;
  message: string;
  trackingBarcode?: string;
};

/**
 * Auto-dispatch: called by the NewOrder flow after an order is created when
 * "Dërgo automatikisht në postë" is on. Logs in, creates the shipment, saves
 * the tracking barcode back onto the order.
 */
export const dispatchOrder = action({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }): Promise<CheetahDispatchResult> => {
    const user = await getCurrentUserSafe(ctx);
    if (!user || !(await isAdminUser(user))) {
      return { ok: false, message: "Vetëm admini mund të dërgojë porosi në postë." };
    }

    const config = await ctx.runQuery(api.cheetah.getConfigInternal, {});
    if (!config?.hasCredentials) {
      return { ok: false, message: "Kredencialet e Postës Cheetah nuk janë konfiguruar." };
    }

    const order = await ctx.runQuery(api.orders.get, { id: orderId });
    if (!order) return { ok: false, message: "Porosia nuk u gjet." };
    if (order.trackingBarcode) {
      return { ok: true, message: "Porosia është tashmë e dërguar.", trackingBarcode: order.trackingBarcode };
    }

    const base = cheetahBase(config.apiUrl);
    try {
      // 1) Login
      const loginRes = await fetch(`${base}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username: config.username, password: config.password }),
      });
      if (!loginRes.ok) {
        const msg = `Hyrja në Cheetah dështoi (status ${loginRes.status}).`;
        await ctx.runMutation(api.orders.markCourierSynced, { id: orderId, error: msg });
        return { ok: false, message: msg };
      }
      const loginData: any = await loginRes.json().catch(() => null);
      const token: string | undefined =
        loginData?.token ?? loginData?.access_token ?? loginData?.data?.token ?? loginData?.data?.access_token;
      if (!token) {
        const msg = "Cheetah nuk ktheu token pas hyrjes.";
        await ctx.runMutation(api.orders.markCourierSynced, { id: orderId, error: msg });
        return { ok: false, message: msg };
      }

      // 2) Create the shipment
      const shipmentRes = await fetch(`${base}/api/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reference: order.orderNumber,
          recipient: {
            name: `${order.first_name} ${order.last_name ?? ""}`.trim(),
            phone: order.phone,
          },
          address: {
            country: order.country,
            city: order.city,
            street: order.address,
            details: order.addressDetails ?? "",
          },
          cod_amount: order.totalAmount,
          description: order.productDescription,
          open_package: order.deliveryOpen ?? false,
          exchange: order.deliveryExchange ?? false,
        }),
      });
      const shipmentData: any = await shipmentRes.json().catch(() => null);
      if (!shipmentRes.ok) {
        const msg = `Krijimi i dërgesës dështoi (status ${shipmentRes.status}).`;
        await ctx.runMutation(api.orders.markCourierSynced, { id: orderId, error: msg });
        return { ok: false, message: msg };
      }

      const barcode: string | undefined =
        shipmentData?.barcode ??
        shipmentData?.tracking_number ??
        shipmentData?.data?.barcode ??
        shipmentData?.data?.tracking_number ??
        undefined;

      await ctx.runMutation(api.orders.markCourierSynced, {
        id: orderId,
        shipmentId: shipmentData?.id ?? shipmentData?.data?.id ?? undefined,
        error: undefined,
      });

      if (barcode) {
        await ctx.runMutation(api.orders.saveTrackingBarcode, { id: orderId, barcode });
      }

      return {
        ok: true,
        message: barcode
          ? `Porosia u dërgua në Postën Cheetah. Kodi: ${barcode}`
          : "Porosia u dërgua në Postën Cheetah.",
        trackingBarcode: barcode,
      };
    } catch (err) {
      const msg = err instanceof Error ? `Gabim rrjeti: ${err.message}` : "Gabim rrjeti i panjohur.";
      await ctx.runMutation(api.orders.markCourierSynced, { id: orderId, error: msg }).catch(() => {});
      return { ok: false, message: msg };
    }
  },
});

/** Internal read of stored Cheetah credentials (used by dispatchOrder).
 *  ZERO-THROW: a failed read simply reports "no credentials". */
export const getConfigInternal = query({
  args: {},
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user || !(await isAdminUser(user))) return null;
      const row = await ctx.db
        .query("courier_integrations")
        .withIndex("by_user", (q: any) => q.eq("userId", user._id))
        .filter((q: any) => q.eq(q.field("provider"), "cheetah"))
        .first();
      if (!row) return null;
      return {
        hasCredentials: Boolean(row.username && row.password),
        username: row.username ?? null,
        password: row.password ?? null,
        apiUrl: row.apiUrl ?? null,
        autoDispatch: row.autoDispatch ?? false,
      };
    } catch (err) {
      console.error("cheetah.getConfigInternal failed:", err);
      return null;
    }
  },
});
