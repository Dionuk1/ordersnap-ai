import type { ParsedOrder } from "./order-types";

export const EMPTY_PARSED_ORDER_FALLBACK: ParsedOrder = {
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

const KOSOVO_CITIES_LC = [
  "prishtinë", "prizren", "ferizaj", "pejë", "gjakovë",
  "gjilan", "mitrovicë", "podujevë", "vushtrri",
];

export function parseOrderTextLocal(text: string): ParsedOrder {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const result = { ...EMPTY_PARSED_ORDER_FALLBACK };

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!result.phone) {
      const phoneMatch = line.match(/(\+?383[\s-]?\d{7,8})/) ?? line.match(/0\d{8}/);
      if (phoneMatch) { result.phone = phoneMatch[0].replace(/[\s-]/g, ""); continue; }
    }
    if (!result.totalAmount) {
      const priceMatch = line.match(/(\d[\d.,]*)\s*(€|eur|lek)/i);
      if (priceMatch) { result.productPrice = Number(priceMatch[1].replace(/[^\d]/g, "")); continue; }
    }
    if (!result.city) {
      for (const c of KOSOVO_CITIES_LC) { if (lower.includes(c)) { result.city = c; break; } }
    }
  }

  if (!result.first_name) {
    for (const line of lines) {
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 3 && /^[A-Za-zÇËçë.\s'-]+$/.test(line) && line.length < 40) {
        const parts = line.split(/\s+/);
        result.first_name = parts[0];
        result.last_name = parts.slice(1).join(" ");
        break;
      }
    }
  }

  return result;
}
