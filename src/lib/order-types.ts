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

export const EMPTY_PARSED_ORDER: ParsedOrder = {
  first_name: "",
  last_name: "",
  phone: "",
  instagram: "",
  city: "",
  address: "",
  addressDetails: "",
  country: "Kosovë",
  productDescription: "",
  productPrice: 0,
  postalFee: 0,
  totalAmount: 0,
  deliveryOpen: false,
  deliveryExchange: false,
};

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

export const COUNTRIES = ["Kosovë", "Shqipëri", "Maqedoni"] as const;

export const KOSOVO_CITIES = [
  "Prishtinë", "Prizren", "Ferizaj", "Pejë", "Gjakovë",
  "Gjilan", "Mitrovicë", "Podujevë", "Vushtrri", "Kamenicë",
  "Rahovec", "Suharekë", "Viti", "Deçan", "Klinë",
];

export const ALBANIAN_CITIES = [
  "Tiranë", "Durrës", "Vlorë", "Shkodër", "Elbasan",
  "Fier", "Korçë", "Berat", "Lushnjë", "Kavajë",
];

export const MACEDONIAN_CITIES = [
  "Shkup", "Tetovë", "Manastir", "Ohër", "Kumanovë",
];

export const COURIER_FILTER_TABS = [
  { key: "all", label: "Të gjitha" },
  { key: "active", label: "Aktive" },
  { key: "delivered", label: "Dorëzuar" },
  { key: "refused", label: "Refuzuar" },
] as const;
