export type Role = "customer" | "agent" | "admin";

export type OrderStatus =
  | "pending"
  | "active"
  | "delivered"
  | "refused"
  | "cancelled";

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  walletBalance: number; // €
  createdAt: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  specs: ProductSpec[];
  price: number; // €
  postalFee: number; // €
  stock: number;
  images: string[];
  active: boolean;
  createdAt: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  // Të dhënat e klientit
  firstName: string;
  lastName: string;
  phone: string;
  instagram: string;
  // Adresa & Posta
  postalProvider: string;
  country: string;
  city: string;
  address: string;
  addressDetails: string;
  // Produkti & Financat (€)
  productId: string | null;
  productDescription: string;
  productPrice: number;
  postalFee: number;
  totalAmount: number;
  // Opsionet e Dorëzimit
  deliveryOpen: boolean;
  deliveryExchange: boolean;
  // Status & meta
  status: OrderStatus;
  source: "ai-gemini" | "ai-local" | "catalog" | "manual";
  createdAt: number;
}

export type NewOrderInput = Omit<Order, "id" | "orderNumber" | "createdAt">;

/** Full state of the order entry form (pre-fillable by parser / catalog). */
export interface OrderFormState {
  firstName: string;
  lastName: string;
  phone: string;
  instagram: string;
  postalProvider: string;
  country: string;
  city: string;
  address: string;
  addressDetails: string;
  productId: string | null;
  productDescription: string;
  productPrice: number;
  postalFee: number;
  deliveryOpen: boolean;
  deliveryExchange: boolean;
}

export const EMPTY_ORDER_FORM: OrderFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  instagram: "",
  postalProvider: "Posta Cheetah",
  country: "Kosovë",
  city: "",
  address: "",
  addressDetails: "",
  productId: null,
  productDescription: "",
  productPrice: 0,
  postalFee: 0,
  deliveryOpen: false,
  deliveryExchange: false,
};
