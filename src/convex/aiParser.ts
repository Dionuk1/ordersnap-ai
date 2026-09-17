import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUserSafe } from "./authHelpers";

const PARSER_PROMPT = `You are an order data extraction engine for an Albanian e-commerce order management system focused on Kosovo.
The user uploads a screenshot of a chat conversation (Instagram DM, WhatsApp, Facebook Messenger) between a customer and a seller.
Extract the customer's ORDER information from the conversation and return a JSON object with EXACTLY these 8 keys and nothing else:

{
  "first_name": "string — the customer's real human FIRST name only (e.g. \"Mafir\"). Never include the surname, usernames, or brand names here.",
  "last_name": "string — the customer's real human SURNAME/last name only (e.g. \"Beliu\"). Empty string if not stated.",
  "phone": "string — the customer's phone number in clean digit-only format with optional leading 0 or +383 (e.g. \"044123245\" or \"+38344123245\"). No spaces or dashes.",
  "city": "string — the delivery city, matched to a Kosovo municipality when possible (e.g. \"Fushë Kosovë\", \"Prishtinë\", \"Prizren\"). Kosovo comes first; then Albania (Tiranë, Durrës…) then North Macedonia (Shkup, Tetovë…).",
  "address": "string — street name and building details ONLY (e.g. \"Rruga Bajram Beg\" or \"Rruga Agim Ramadani Nr. 12\"). Do NOT include the city here.",
  "address_details": "string — floor, apartment number, entrance, or extra landmarks (e.g. \"Kati 3, Apartamenti 12\"). Empty string if not stated.",
  "product_description": "string — the product name and details: item, size, color, quantity (e.g. \"Kamizolë e zezë, madhësia M\").",
  "price": "number — the item price WITHOUT currency symbols (e.g. 25 or 25.50). If the amount is stated in Lek, convert using 1 EUR = 100 Lek (2500 Lek -> 25). If the chat shows a separate shipping fee, do NOT add it to this price; the shipping fee is not part of the item price."
}

Rules:
- Extract REAL HUMAN NAMES only. Instagram handles, brand names, and seller names must NOT be treated as first_name/last_name.
- Kosovo comes first. If the screenshot mentions both Kosovo and another country, prefer the Kosovo interpretation.
- Prioritize Kosovo phone patterns: 044, 045, 049, 043, 048, 046, 047 and international +383.
- Prioritize Kosovo municipalities: Prishtinë, Prizren, Ferizaj, Pejë, Gjakovë, Gjilan, Mitrovicë, Podujevë, Vushtrri, Obiliq, Suharekë, Drenas, Lipjan, Fushë Kosovë, Kamenicë, Rahovec, Viti, Deçan, Klinë, Malisheva.
- If a field is not present in the conversation, use an empty string for strings and 0 for numbers.
- "price" must be a plain number, never a string, no currency symbols.
- Return ONLY the JSON object, no markdown fences, no explanations.`;

// Gemini structured-output schema — enforces the exact 8-field JSON contract.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    first_name: { type: "STRING" },
    last_name: { type: "STRING" },
    phone: { type: "STRING" },
    city: { type: "STRING" },
    address: { type: "STRING" },
    address_details: { type: "STRING" },
    product_description: { type: "STRING" },
    price: { type: "NUMBER" },
  },
  required: [
    "first_name",
    "last_name",
    "phone",
    "city",
    "address",
    "address_details",
    "product_description",
    "price",
  ],
  propertyOrdering: [
    "first_name",
    "last_name",
    "phone",
    "city",
    "address",
    "address_details",
    "product_description",
    "price",
  ],
} as const;

interface ParsedOrder {
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  address: string;
  address_details: string;
  product_description: string;
  price: number;
}

function extractJson(text: string): ParsedOrder | null {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      first_name: String(obj.first_name ?? "").trim(),
      last_name: String(obj.last_name ?? "").trim(),
      phone: String(obj.phone ?? "").replace(/[\s-]/g, "").trim(),
      city: String(obj.city ?? "").trim(),
      address: String(obj.address ?? "").trim(),
      address_details: String(obj.address_details ?? "").trim(),
      product_description: String(obj.product_description ?? "").trim(),
      price: Number(obj.price ?? 0) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Parse an order screenshot with Gemini 2.5 Flash using the Gemini API key
 * stored in app_settings. Falls back to client-side text parsing when no key
 * exists (the client handles OCR with tesseract.js and calls parseOrderText).
 */
export const parseWithGemini = action({
  args: { imageBase64: v.string(), mimeType: v.string() },
  handler: async (ctx, { imageBase64, mimeType }) => {
    const user = await getCurrentUserSafe(ctx);
    if (!user) throw new Error("Not authenticated");

    // Read the Gemini key from app settings (admin-managed)
    const setting = await ctx.runQuery(api.appSettings.getSetting, {
      key: "gemini_api_key",
    });

    // Also allow platform-managed key via env
    const apiKey = setting || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return { engine: null as string | null, parsed: null };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PARSER_PROMPT },
                {
                  inlineData: {
                    mimeType: mimeType || "image/png",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
      "";
    const parsed = extractJson(text);
    if (!parsed) {
      throw new Error("Përgjigja e Gemini nuk mund të interpretohej si JSON.");
    }
    return {
      engine: "gemini" as const,
      parsed: {
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        phone: parsed.phone,
        city: parsed.city,
        address: parsed.address,
        address_details: parsed.address_details,
        product_description: parsed.product_description,
        price: parsed.price,
      },
    };
  },
});

/**
 * Heuristic parser for raw OCR text — the built-in local fallback engine.
 * Runs fully server-side, no API key needed.
 */
export const parseOrderText = action({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const user = await getCurrentUserSafe(ctx);
    if (!user) throw new Error("Not authenticated");

    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const result: NewParserOrder = {
      full_name: "",
      phone_number: "",
      city: "",
      address: "",
      product_notes: "",
      postal_fee_eur: 0,
      total_amount_eur: 0,
    };

    // Kosovo-first city list
    const kosovoFragments = [
      "prishtinë", "prizren", "ferizaj", "pejë", "gjakovë",
      "gjilan", "mitrovicë", "podujevë", "vushtrri", "obiliq",
      "suharekë", "drenas", "lipjan", "kamenicë", "rahovec",
    ];
    const albanianFragments = [
      "tirana", "tiranë", "durrës", "vlorë", "shkodër", "elbasan",
      "fier", "korçë", "berat", "lushnjë", "kavajë",
    ];
    const macedonianFragments = [
      "shkup", "tetovë", "manastir", "ohër", "kumanovë",
    ];

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Phone: prefer Kosovo patterns (04X, +383).
      if (!result.phone_number) {
        let match: RegExpMatchArray | null = null;
        match = line.match(/(\+383\s?[\d]{2,3}[\s-]?[\d]{4,6})/);
        if (match) {
          result.phone_number = match[0].replace(/[\s-]/g, "");
          continue;
        }
        for (const prefix of ["044", "045", "049", "043", "048", "046", "047"]) {
          const p = line.match(new RegExp(`(${prefix}[\\s-]?[\\d]{4,6})`));
          if (p) {
            result.phone_number = p[1].replace(/\s/g, "");
            continue;
          }
        }
        match = line.match(/(\+383[\s-]?\d{7,8})/) ?? line.match(/(0\d{8})/);
        if (match) {
          result.phone_number = match[0].replace(/[\s-]/g, "");
          continue;
        }
        // Fallback to Albanian/Macedonian patterns only if no Kosovo match yet.
        match = line.match(/(\+?355[\s-]?\d{6,9})|((?:\+?\d[\s-]?){9,13})/)
          ?? line.match(/0\d{8,9}/);
        if (match && lower.replace(/\D/g, "").length >= 8) {
          result.phone_number = match[0].replace(/[\s-]/g, "");
          continue;
        }
      }

      // Labeled fields
      const labelMatch = lower.match(
        /^(emer|mbiemer|emri|mbiemri|name|fullname|full[_\s]?name)\s*[:\-]\s*(.+)/,
      );
      if (labelMatch && !result.full_name) {
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

      // Pricing: EUR first, then Lek converted to EUR (1 EUR = 100 Lek).
      if (!result.total_amount_eur) {
        const euroMatch = line.match(/(\d[\d.,]*)\s*(€|eur|euro)/i);
        if (euroMatch) {
          result.total_amount_eur = parseNumericEuro(euroMatch[1]);
          continue;
        }
        const lekMatch = line.match(/(\d[\d.,]*)\s*(lek|all|leke)/i);
        if (lekMatch) {
          const lekVal = parseNumericEuro(lekMatch[1]);
          if (lekVal > 0) {
            result.total_amount_eur = Math.round((lekVal / 100) * 100) / 100;
            continue;
          }
        }
        const totalLabel = lower.match(/(total|shuma|cmim\s*i\s*total|pagesa)[:\s]*(\d[\d.,\s]*)/);
        if (totalLabel) {
          const num = totalLabel[2].replace(/[^\d]/g, "");
          if (num) result.total_amount_eur = Number(num);
          continue;
        }
      }

      // City detection: Kosovo first, then Albania, then Macedonia.
      if (!result.city) {
        for (const c of kosovoFragments) {
          if (lower.includes(c)) {
            result.city = kosovoFragments.find((k) => k === c)?.toString() ?? c;
            break;
          }
        }
      }
      if (!result.city) {
        for (const c of albanianFragments) {
          if (lower.includes(c)) {
            result.city = albanianFragments.find((k) => k === c)?.toString() ?? c;
            break;
          }
        }
      }
      if (!result.city) {
        for (const c of macedonianFragments) {
          if (lower.includes(c)) {
            result.city = macedonianFragments.find((k) => k === c)?.toString() ?? c;
            break;
          }
        }
      }
    }

    // Heuristic name: 2-3 word alphabetic line, no digits/no currency.
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

    // Fallback address: longest line that contains a digit but is not a phone.
    if (!result.address) {
      const addrLine = lines
        .filter((l) => /\d/.test(l) && !/^\+?\d[\d\s-]{7,}$/.test(l))
        .sort((a, b) => b.length - a.length)[0];
      if (addrLine) result.address = addrLine;
    }

    // Leftovers go to product_notes.
    if (!result.product_notes) {
      const known = [result.full_name, result.phone_number, result.city, result.address];
      const leftover = lines.filter((l) => l.length > 3 && !known.includes(l));
      result.product_notes = leftover.slice(0, 3).join(" | ");
    }

    return { engine: "local" as const, parsed: result };
  },
});

interface NewParserOrder {
  full_name: string;
  phone_number: string;
  city: string;
  address: string;
  product_notes: string;
  postal_fee_eur: number;
  total_amount_eur: number;
}

function parseNumericEuro(raw: string): number {
  const cleaned = String(raw)
    .replace(/[^\d.,]/g, "")
    .trim();
  if (!cleaned) return 0;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const last = Math.max(lastDot, lastComma);
    const before = cleaned.slice(0, last).replace(/[.,]/g, "");
    const after = cleaned.slice(last + 1);
    const decimal = after.padEnd(2, "0").slice(0, 2);
    const num = Number(`${before || "0"}.${decimal}`);
    return Number.isFinite(num) ? num : 0;
  }
  if (lastDot >= 0) {
    const before = cleaned.slice(0, lastDot).replace(/\./g, "");
    const after = cleaned.slice(lastDot + 1);
    const decimal = after.padEnd(2, "0").slice(0, 2);
    const num = Number(`${before || "0"}.${decimal}`);
    return Number.isFinite(num) ? num : 0;
  }
  if (lastComma >= 0) {
    const before = cleaned.slice(0, lastComma).replace(/,/g, "");
    const after = cleaned.slice(lastComma + 1);
    const decimal = after.padEnd(2, "0").slice(0, 2);
    const num = Number(`${before || "0"}.${decimal}`);
    return Number.isFinite(num) ? num : 0;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}
