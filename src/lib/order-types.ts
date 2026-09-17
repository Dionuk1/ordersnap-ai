export interface ParsedOrder {
  first_name: string;
  last_name: string;
  phone: string;
  instagram: string;
  city: string;
  address: string;
  addressDetails: string;
  country: string;
  productDescription: string;
  productPrice: number;
  postalFee: number;
  totalAmount: number;
  deliveryOpen: boolean;
  deliveryExchange: boolean;
}

// ------------------- Kosovo-first defaults -------------------
const _KOSOVO_DEFAULT = "Kosovë";
export const KOSOVO_DEFAULT = _KOSOVO_DEFAULT;

export const EMPTY_PARSED_ORDER: ParsedOrder = {
  first_name: "",
  last_name: "",
  phone: "",
  instagram: "",
  city: "",
  address: "",
  addressDetails: "",
  country: KOSOVO_DEFAULT,
  productDescription: "",
  productPrice: 0,
  postalFee: 0,
  totalAmount: 0,
  deliveryOpen: false,
  deliveryExchange: false,
};

// Country list used in order forms and settings. Kosovo is always first.
export const COUNTRIES = [
  "Kosovë",
  "Shqipëri",
  "Maqedoni",
] as const;

export type Country = (typeof COUNTRIES)[number];

// Official display names used in UI copy where full names read better than the
// short country keys used in DB/storage. Keep Kosovo-first ordering.
export const COUNTRY_LABELS: Record<string, string> = {
  "Kosovë": "Kosovë",
  "Shqipëri": "Shqipëri",
  "Maqedoni": "Maqedoni e Veriut",
};

// Default postal rates per country (EUR). Admin-configurable via app_settings
// keys: "shipping_rate_kosove", "shipping_rate_shqipëri", "shipping_rate_maqedoni".
// Defaults match the requested regional rates.
export const DEFAULT_SHIPPING_RATES: Record<string, number> = {
  "Kosovë": 2.0,
  "Shqipëri": 6.0,
  "Maqedoni": 3.0,
};

// Key used to fetch per-country rates from Convex app settings.
export function shippingRateKey(country: string): string {
  return `shipping_rate_${country.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

// Kosovo municipalities prioritized during OCR/AI extraction.
export const KOSOVO_CITIES = [
  "Prishtinë",
  "Prizren",
  "Ferizaj",
  "Pejë",
  "Gjakovë",
  "Gjilan",
  "Mitrovicë",
  "Podujevë",
  "Vushtrri",
  "Obiliq",
  "Suharekë",
  "Drenas",
  "Lipjan",
  "Kamenicë",
  "Rahovec",
  "Viti",
  "Deçan",
  "Klinë",
  "Malisheva",
  "Ferizaj",
] as const;

export const ALBANIAN_CITIES = [
  "Tiranë",
  "Durrës",
  "Vlorë",
  "Shkodër",
  "Elbasan",
  "Fier",
  "Korçë",
  "Berat",
  "Lushnjë",
  "Kavajë",
] as const;

export const MACEDONIAN_CITIES = [
  "Shkup",
  "Tetovë",
  "Manastir",
  "Ohër",
  "Kumanovë",
] as const;

// Kosovo mobile prefix patterns we prioritize during extraction & formatting.
export const KOSOVO_MOBILE_PREFIXES = [
  "044",
  "045",
  "049",
  "043",
  "048",
  "046",
  "047",
] as const;

export const COUNTRY_ISO_CODE: Record<string, string> = {
  "Kosovë": "+383",
  "Shqipëri": "+355",
  "Maqedoni": "+389",
};

// ------------------- Formatting helpers -------------------

/**
 * Format a raw numeric value into Euro display text, e.g. 45 -> "45.00 €".
 * Every monetary value shown in the UI should pass through this helper.
 */
export function formatEuro(centsOrUnits: number, decimals = 2): string {
  const value = Number(centsOrUnits) || 0;
  return `${value.toFixed(decimals)} €`;
}

/**
 * Parse a Euro-formatted input string back to a number of euros, e.g.
 * "45.00 €" -> 45.00, "2,250.50" -> 2250.5. Used when reading manual edits.
 */
export function parseEuroInput(raw: string): number {
  const cleaned = String(raw)
    .replace(/€/g, "")
    .replace(/EUR/i, "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!cleaned) return 0;

  // If both commas and dots exist, treat the last one as the decimal separator.
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot >= 0 || lastComma >= 0) {
    const lastSep = Math.max(lastDot, lastComma);
    const before = cleaned.slice(0, lastSep).replace(/[.,]/g, "");
    const after = cleaned.slice(lastSep + 1);
    const decimal = after.padEnd(2, "0").slice(0, 2);
    const intPart = before.replace(/[.,]/g, "");
    const num = Number(`${intPart || "0"}.${decimal}`);
    return Number.isFinite(num) ? num : 0;
  }

  const straight = cleaned.replace(/[.,]/g, "");
  const num = Number(straight);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Raw number -> readable Euro numeric string without currency symbol.
 * Used where symbols must be omitted (inputs, exports, totals shown without unit).
 */
export function formatEuroNumeric(value: number, decimals = 2): string {
  const num = Number(value) || 0;
  return num.toFixed(decimals);
}

/**
 * Format a total as Euro with thousands separator, e.g. 45.00 € or 1.234,50 €.
 * Keeps Euro formatting consistent across cards, tables, and exports.
 */
export function formatEuroFull(value: number): string {
  const num = Number(value) || 0;
  const [intPart, decPart] = num.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${decPart} €`;
}

// ------------------- Phone formatting (Kosovo-first) -------------------

/**
 * Normalize a Kosovo phone string into a clean local format, e.g.
 * "+38344123456" -> "044 123 456"
 * "044123456" -> "044 123 456"
 * "044 123 456" -> "044 123 456"
 *
 * Returns the cleaned local form (no +383) when the number looks like a
 * Kosovo mobile; otherwise returns the stripped digits unchanged.
 */
export function formatKosovoPhone(raw: string): string {
  const digits = String(raw).replace(/[^\d+]/g, "");

  // International form: strip the +383 prefix.
  if (digits.startsWith("+383") || digits.startsWith("383")) {
    let mobile = digits.replace(/^\+?383/, "");
    return formatKosovoMobileLocal(mobile);
  }

  // Local form starting with a Kosovo mobile prefix.
  for (const prefix of KOSOVO_MOBILE_PREFIXES) {
    if (digits.startsWith(prefix)) {
      const mobile = digits.slice(prefix.length);
      return `${prefix} ${formatKosovoMobileLocal(mobile)}`;
    }
  }

  // Fallback: just collapse spaces/dashes and keep as-is.
  return digits;
}

function formatKosovoMobileLocal(mobile: string): string {
  const digits = String(mobile).replace(/[^\d]/g, "");
  if (digits.length < 6) return digits;
  // Kosovo mobile numbers are 7 digits after the prefix, displayed as 3+4.
  if (digits.length === 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length >= 3) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return digits;
}

/**
 * Convert a Kosovo local number (e.g. "044 123 456") into an international
 * payload form (e.g. "+383 44 123 456") suitable for courier/email payloads.
 */
export function toInternationalPhone(raw: string): string {
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length >= 7 && !digits.startsWith("383") && !digits.startsWith("355") && !digits.startsWith("389")) {
    return `+383 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`.trim();
  }
  if (digits.startsWith("383")) {
    const mobile = digits.slice(3);
    return `+383 ${mobile.slice(0, 2)} ${mobile.slice(2, 5)} ${mobile.slice(5)}`.trim();
  }
  if (digits.startsWith("355")) {
    const rest = digits.slice(3).replace(/^0+/, "");
    return `+355 ${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
  }
  if (digits.startsWith("389")) {
    const rest = digits.slice(3);
    return `+389 ${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
  }
  if (digits.startsWith("+")) {
    return raw.trim();
  }
  return `+383 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`.trim();
}

/**
 * Strip everything except digits and + so raw payloads stay clean.
 */
export function stripPhone(raw: string): string {
  let s = String(raw).trim();
  if (s.startsWith("+")) {
    return "+" + s.slice(1).replace(/[^\d]/g, "");
  }
  return s.replace(/[^\d]/g, "");
}

// ------------------- Status labels & UI constants -------------------

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "E re",
  active: "Aktive",
  delivered: "Dorëzuar",
  refused: "Refuzuar",
  cancelled: "Anuluar",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  active: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  refused: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

export const ORDER_STATUSES = ["pending", "active", "delivered", "refused", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const COURIER_FILTER_TABS = [
  { key: "all", label: "Të gjitha" },
  { key: "active", label: "Aktive" },
  { key: "delivered", label: "Dorëzuar" },
  { key: "refused", label: "Refuzuar" },
] as const;

