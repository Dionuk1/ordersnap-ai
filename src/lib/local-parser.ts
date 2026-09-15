import type { ParsedOrder } from "./order-types";

export type { ParsedOrder };

export const EMPTY_PARSED_ORDER: ParsedOrder = {
  full_name: "",
  phone_number: "",
  city: "",
  address: "",
  product_notes: "",
  total_amount: 0,
};

/**
 * Local fallback parser — same heuristics as the server-side parseOrderText
 * action, used when the Gemini API key is missing or Gemini fails.
 */
export function parseOrderTextLocal(text: string): ParsedOrder {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedOrder = { ...EMPTY_PARSED_ORDER };

  const cities = [
    "Tirana", "Tiranë", "Durres", "Durrës", "Vlora", "Vlorë", "Shkodra",
    "Shkodër", "Elbasan", "Fier", "Korca", "Korçë", "Berat", "Lushnja",
    "Kavaja", "Gjirokastra", "Gjirokastër", "Saranda", "Sarandë", "Lezha",
    "Lezhë", "Kamza", "Pogradec", "Kruja", "Patos",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (!result.phone_number) {
      const phoneMatch =
        line.match(/(\+?355[\s-]?\d{6,9})/) ?? line.match(/0\d{8,9}/);
      if (phoneMatch) {
        result.phone_number = phoneMatch[0].replace(/[\s-]/g, "");
        continue;
      }
    }

    if (/^(emer|mbiemer|emri|mbiemri|name|fullname|full[_\s]?name)\s*[:\-]/.test(lower) && !result.full_name) {
      result.full_name = line.slice(line.indexOf(":") + 1).trim();
      continue;
    }
    if (/^(qytet|city)\s*[:\-]/.test(lower) && !result.city) {
      result.city = line.slice(line.indexOf(":") + 1).trim();
      continue;
    }
    if (/^(adres|address|adresa)\s*[:\-]/.test(lower) && !result.address) {
      result.address = line.slice(line.indexOf(":") + 1).trim();
      continue;
    }

    if (!result.total_amount) {
      const totalLabel = lower.match(
        /(total|shuma|pagesa)[:\s]*(\d[\d.,\s]*)/,
      );
      if (totalLabel) {
        const num = totalLabel[2].replace(/[^\d]/g, "");
        if (num) result.total_amount = Number(num);
        continue;
      }
      const currencyMatch = line.match(/(\d[\d.,]*)\s*(lek|all|leke|€|eur|\$)/i);
      if (currencyMatch) {
        const num = currencyMatch[1].replace(/[^\d]/g, "");
        if (num) result.total_amount = Number(num);
        continue;
      }
    }

    if (!result.city) {
      for (const c of cities) {
        if (lower.includes(c.toLowerCase())) {
          result.city = c;
          break;
        }
      }
    }
  }

  if (!result.full_name) {
    for (const line of lines) {
      const words = line.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 3 &&
        /^[A-Za-zÇËçë.\s'-]+$/.test(line) &&
        !/lek|all|€|\$/i.test(line) &&
        line.length < 40
      ) {
        result.full_name = line;
        break;
      }
    }
  }

  if (!result.address) {
    const addrLine = lines
      .filter((l) => /\d/.test(l) && !/^\+?\d[\d\s-]{7,}$/.test(l))
      .sort((a, b) => b.length - a.length)[0];
    if (addrLine) result.address = addrLine;
  }

  if (!result.product_notes) {
    const known = [
      result.full_name,
      result.phone_number,
      result.city,
      result.address,
    ];
    const leftover = lines.filter((l) => l.length > 3 && !known.includes(l));
    result.product_notes = leftover.slice(0, 3).join(" | ");
  }

  return result;
}
