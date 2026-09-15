import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUserSafe } from "./authHelpers";

const PARSER_PROMPT = `You are an order data extraction engine for an Albanian e-commerce order management system.
The user uploads a screenshot of a chat conversation (Instagram DM, WhatsApp, Facebook Messenger) between a customer and a seller.
Extract the customer's ORDER information from the conversation text and return ONLY a valid JSON object with exactly these keys:

{
  "full_name": "String - customer full name",
  "phone_number": "String - customer phone number (digits, may include +355)",
  "city": "String - delivery city",
  "address": "String - full delivery address",
  "product_notes": "String - product names, sizes, colors or other order notes",
  "total_amount": "Number - total order amount in Albanian Lek (ALL), numeric only"
}

Rules:
- Read carefully; names may appear in Albanian.
- If a field is not present in the conversation, use an empty string ("" for strings, 0 for numbers).
- total_amount must be a plain number (e.g. 2500), no currency symbols.
- Return ONLY the JSON object, no markdown fences, no explanations.`;

interface ParsedOrder {
  full_name: string;
  phone_number: string;
  city: string;
  address: string;
  product_notes: string;
  total_amount: number;
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
      total_amount: Number(obj.total_amount ?? 0) || 0,
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
    return { engine: "gemini" as const, parsed };
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

    const result: ParsedOrder = {
      full_name: "",
      phone_number: "",
      city: "",
      address: "",
      product_notes: "",
      total_amount: 0,
    };

    // Albanian city hints
    const cities = [
      "Tirana", "Tiranë", "Durres", "Durrës", "Vlora", "Vlorë", "Shkodra",
      "Shkodër", "Elbasan", "Fier", "Korca", "Korçë", "Berat", "Lushnja",
      "Kavaja", "Gjirokastra", "Gjirokastër", "Saranda", "Sarandë", "Lezha",
      "Lezhë", "Kamza", "Pogradec", "Kruja", "Patos",
    ];

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Phone: Albanian numbers 06XXXXXXXX or +355XXXXXXXXX or generic digit runs
      if (!result.phone_number) {
        const phoneMatch = line.match(/(\+?355[\s-]?\d{6,9})|((?:\+?\d[\s-]?){9,13})/) 
          ?? line.match(/0\d{8,9}/);
        if (phoneMatch && lower.replace(/\D/g, "").length >= 8) {
          result.phone_number = phoneMatch[0].replace(/[\s-]/g, "");
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

      // Total amount: look for currency hints or labeled total
      if (!result.total_amount) {
        const totalLabel = lower.match(/(total|shuma|cmim\s*i\s*total|pagesa)[:\s]*(\d[\d.,\s]*)/);
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

      // City detection from bare line
      if (!result.city) {
        for (const c of cities) {
          if (lower.includes(c.toLowerCase())) {
            result.city = c;
            break;
          }
        }
      }
    }

    // Heuristic name: a line of 2-3 words, mostly alphabetic, not containing digits
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

    // Fallback address: longest line containing digits (street numbers)
    if (!result.address) {
      const addrLine = lines
        .filter((l) => /\d/.test(l) && !/^\+?\d[\d\s-]{7,}$/.test(l))
        .sort((a, b) => b.length - a.length)[0];
      if (addrLine) result.address = addrLine;
    }

    // Anything left goes to product notes
    if (!result.product_notes) {
      const known = [result.full_name, result.phone_number, result.city, result.address];
      const leftover = lines.filter((l) => l.length > 3 && !known.includes(l));
      result.product_notes = leftover.slice(0, 3).join(" | ");
    }

    return { engine: "local" as const, parsed: result };
  },
});
