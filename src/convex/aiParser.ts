import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUserSafe } from "./authHelpers";

const PARSER_PROMPT = `You are an order data extraction engine for an Albanian e-commerce order management system focused on Kosovo.
The user uploads a screenshot of a chat conversation (Instagram DM, WhatsApp, Facebook Messenger) between a customer and a seller.
Extract the customer's ORDER information from the conversation text and return ONLY a valid JSON object with exactly these keys:

{
  "full_name": "String - customer full name ( Albanian names )",
  "phone_number": "String - customer phone number, Kosovo format preferred: 044 123 456 or +383 44 123 456",
  "city": "String - delivery city (Kosovo first: Prishtinë, Prizren, Ferizaj, Pejë, Gjakovë, Gjilan, Mitrovicë, Podujevë, Vushtrri; then Albania: Tiranë, Durrës, Vlorë, Shkodër, Elbasan; then Macedonia: Shkup, Tetovë, Manastir)",
  "address": "String - full delivery address (Kosovo street format preferred, e.g. Rruga Agim Ramadani, Nr. 12)",
  "product_notes": "String - product names, sizes, colors or other order notes",
  "postal_fee_eur": "Number - shipping/postal fee in EUR — if you see a shipping fee stated in the chat, extract it in EUR; if it is stated only in Lek, convert 1 EUR = 100 Lek (e.g. 200 Lek -> 2.0)",
  "total_amount_eur": "Number - total order amount in EUR. If the chat states the amount only in Lek, convert using 1 EUR = 100 Lek (e.g. 2500 Lek -> 25.00). If it is already in EUR, return that value. Never return Lek amounts as the EUR value."
}

Rules:
- Kosovo comes first. If the screenshot mentions both Kosovo and another country, prefer the Kosovo interpretation.
- Prioritize Kosovo phone patterns: 044, 045, 049, 043, 048, 046, 047 and international +383.
- Prioritize Kosovo municipalities: Prishtinë, Prizren, Ferizaj, Pejë, Gjakovë, Gjilan, Mitrovicë, Podujevë, Vushtrri, Obiliq, Suharekë, Drenas, Lipjan.
- If a field is not present in the conversation, use an empty string for strings and 0 for numbers.
- phone_number must keep digits only plus optional + prefix (e.g. "+38344123456" or "044123456"). No spaces in the raw extracted value; the frontend will format it for display.
- total_amount_eur and postal_fee_eur must be plain numbers (e.g. 25.50), no currency symbols.
- Return ONLY the JSON object, no markdown fences, no explanations.`;

interface ParsedOrder {
  full_name: string;
  phone_number: string;
  city: string;
  address: string;
  product_notes: string;
  postal_fee_eur: number;
  total_amount_eur: number;
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
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    return {
      full_name: String(obj.full_name ?? ""),
      phone_number: String(obj.phone_number ?? ""),
      city: String(obj.city ?? ""),
      address: String(obj.address ?? ""),
      product_notes: String(obj.product_notes ?? ""),
      postal_fee_eur: Number(obj.postal_fee_eur ?? 0) || 0,
      total_amount_eur: Number(obj.total_amount_eur ?? 0) || 0,
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
        full_name: parsed.full_name,
        phone_number: parsed.phone_number,
        city: parsed.city,
        address: parsed.address,
        product_notes: parsed.product_notes,
        total_amount: parsed.total_amount_eur,
        postal_fee_eur: parsed.postal_fee_eur,
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
