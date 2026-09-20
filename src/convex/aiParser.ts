import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { getCurrentUserSafe } from "./authHelpers";

const PARSER_PROMPT = `You are a precise data extraction engine for chat screenshots (Instagram, WhatsApp, Messenger, Viber) for an Albanian e-commerce order management system focused on Kosovo.
The user uploads a screenshot of a chat conversation between a customer and a seller.
Analyze the screenshot carefully and extract the customer's ORDER details into the required JSON format following these rules:

Return a JSON object with EXACTLY these 10 keys and nothing else:

{
  "first_name": "string — the customer's real human FIRST name only (e.g. \"Mafir\"). Never include the surname, usernames, or brand names here.",
  "last_name": "string — the customer's real human SURNAME/last name only (e.g. \"Beliu\"). Empty string if not stated.",
  "phone": "string — the customer's phone number in clean digit-only format with optional leading 0 or +383 (e.g. \"044123245\" or \"+38344123245\"). No spaces or dashes.",
  "city": "string — the delivery city, matched to a Kosovo municipality when possible (e.g. \"Fushë Kosovë\", \"Prishtinë\", \"Prizren\"). Kosovo comes first; then Albania (Tiranë, Durrës…) then North Macedonia (Shkup, Tetovë…).",
  "address": "string — street name and building details ONLY (e.g. \"Rruga Bajram Beg\" or \"Rruga Agim Ramadani Nr. 12\"). Do NOT include the city here.",
  "address_details": "string — floor, apartment number, entrance, or extra landmarks (e.g. \"Kati 3, Apartamenti 12\"). Empty string if not stated.",
  "product_description": "string — the product name and details: item, size, color, quantity (e.g. \"Kamizolë e zezë, madhësia M\").",
  "quantity": "number — the numeric quantity ordered (e.g. 2). Default to 1 if not specified.",
  "notes": "string — extra details, delivery instructions or preferences from the customer (e.g. 'Dërgesa pas ores 18:00'). Empty string if none.",
  "price": "number — the item price WITHOUT currency symbols (e.g. 25 or 25.50). If the amount is stated in Lek, convert using 1 EUR = 100 Lek (2500 Lek -> 25). If the chat shows a separate shipping fee, do NOT add it to this price; the shipping fee is not part of the item price."
}

Field rules:
1. customer name fields: Extract ONLY the recipient's real human name. Do NOT mix this with address or phone number.
2. phone: Extract ONLY valid phone numbers (e.g. +38349123456, 044123456, +35569123456, +38970123456). Clean out stray spaces or text.
3. city: Extract ONLY the city/town name (e.g. Prishtinë, Pejë, Gjakovë, Ferizaj, Gjilan, Mitrovicë, Prizren, Tiranë, Durrës, Shkup, etj.) — never the street.
4. address: Extract ONLY street name, neighborhood, building/apartment numbers, or landmarks — never the city.
5. quantity: numeric quantity, default 1.
6. price: ONLY the total price numeric value, no currency symbols.
7. notes: extra details (delivery instructions or preferences).

Rules:
- Extract REAL HUMAN NAMES only. Instagram handles, brand names, and seller names must NOT be treated as first_name/last_name.
- NEVER put street keywords (Rruga, Rr., Bulevardi, Bulevard, Lagja, Lagjja, Shtëpia, Shtepia, Hyrja, Te, Tek, Nr.) into first_name or last_name — those belong in address. A line like "Fushe Kosove Rr. Bajram Beg h.B kt 4" contains the CITY + ADDRESS, never a name.
- Isolate the customer's full human name wherever it appears in the text, even on its own line or mid-message (e.g. "Mafir Beliu" → first_name: "Mafir", last_name: "Beliu").
- CITY must be an OFFICIAL Kosovo municipality (or Albania/North Macedonia if clearly abroad). Standardize spelling variations automatically: "Fushe Kosove", "F.Kosove", "Fushë Kosovë" → "Fushë Kosovë"; "Prishtine" → "Prishtinë"; "Malisheva" → "Malishevë"; "Klina" → "Klinë"; "Vitia" → "Vitia".
- PHONE must be a clean 9-digit local Kosovo number starting with 04 (e.g. "044123245") or the international "+383…" form. Strip all spaces, dashes and parentheses.
- Kosovo comes first. If the screenshot mentions both Kosovo and another country, prefer the Kosovo interpretation.
- Prioritize Kosovo phone patterns: 044, 045, 049, 043, 048, 046, 047 and international +383.
- Do NOT hallucinate. Do NOT put address text into the name fields, or vice versa.
- If a field is not present in the conversation, use an empty string for strings, 1 for quantity and 0 for price.
- "price" must be a plain number, never a string, no currency symbols.
- Return ONLY the JSON object, no markdown fences, no explanations.

Example — extract the human name, never street names:
Input text:
"Pershendetje desha me porosit me posta
Mafir Beliu
044 123 245
Fushe Kosove Rr. Bajram Beg h.B kt 4
Patikat te zeza numri 43
Sa eshte kushtojne? 45€ me gjith poste"
Required output:
{"first_name": "Mafir", "last_name": "Beliu", "phone": "044123245", "city": "Fushë Kosovë", "address": "Rruga Bajram Beg", "address_details": "Hyrja B, Kat 4", "product_description": "Patika të zeza numri 43", "price": 45}
Notice: "Fushe Kosove" was standardized to the official municipality "Fushë Kosovë" and did NOT leak into the name fields; "Rr. Bajram Beg" stayed in address; "h.B kt 4" became address_details.`;

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
    quantity: { type: "NUMBER" },
    notes: { type: "STRING" },
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
    "quantity",
    "notes",
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
    "quantity",
    "notes",
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
  quantity: number;
  notes: string;
  price: number;
  /** Inferred shipping country (Kosovë/Shqipëri/Maqedoni) or null. */
  country: string | null;
}

/** Official Kosovo municipalities (the canonical output forms). */
const KOSOVO_MUNICIPALITIES = [
  "Prishtinë", "Fushë Kosovë", "Prizren", "Ferizaj", "Pejë",
  "Gjakovë", "Gjilan", "Mitrovicë", "Podujevë", "Vushtrri",
  "Obiliq", "Drenas", "Suharekë", "Lipjan", "Klinë", "Istog",
  "Deçan", "Kaçanik", "Vitia", "Kamenica", "Malishevë",
] as const;

// Fuzzy-match aliases: common spellings / abbreviations → official form.
const CITY_ALIASES: Record<string, string> = {
  "fushe kosove": "Fushë Kosovë",
  "fushekosove": "Fushë Kosovë",
  "f.kosove": "Fushë Kosovë",
  "fkosove": "Fushë Kosovë",
  "f.kosova": "Fushë Kosovë",
  "prishtine": "Prishtinë",
  "prishtina": "Prishtinë",
  "pristina": "Prishtinë",
  "prizreni": "Prizren",
  "ferizaji": "Ferizaj",
  "ufk": "Fushë Kosovë",
  "peja": "Pejë",
  "gjakova": "Gjakovë",
  "gjilani": "Gjilan",
  "mitrovice": "Mitrovicë",
  "podujeva": "Podujevë",
  "vushtrria": "Vushtrri",
  "obiliq": "Obiliq",
  "kastriot": "Obiliq",
  "drenasi": "Drenas",
  "glogovac": "Drenas",
  "suhareka": "Suharekë",
  "theranda": "Suharekë",
  "lipjani": "Lipjan",
  "klina": "Klinë",
  "kline": "Klinë",
  "istogu": "Istog",
  "decani": "Deçan",
  "kacanik": "Kaçanik",
  "vitia": "Vitia",
  "viti": "Vitia",
  "kamenice": "Kamenica",
  "drenica": "Drenas",
  "malisheva": "Malishevë",
  "malisheve": "Malishevë",
};

/** Street keywords that must never leak into first/last name fields. */
const STREET_KEYWORDS =
  /\b(rruga|rr\.|rr|bulevardi|bulevard|blv|lagja|lagjja|shtepia|shtëpia|hyrja|hyrje|te|tek|nr\.|number)\b/i;

/**
 * Fuzzy-match a raw city string against official Kosovo municipalities.
 * Normalizes diacritics and applies known aliases first.
 */
function normalizeCity(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const lower = value.toLowerCase();

  // Exact official form wins immediately.
  const official = KOSOVO_MUNICIPALITIES.find(
    (m) => m.toLowerCase() === lower,
  );
  if (official) return official;

  // Alias table (covers "Fushe Kosove", "F.Kosove", …).
  const stripped = lower.replace(/[ëe]/g, (m) => (m === "ë" ? "e" : m));
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower];
  if (CITY_ALIASES[stripped]) return CITY_ALIASES[stripped];

  // Diacritic-insensitive fuzzy match against official municipalities.
  const fold = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const foldedInput = fold(value);
  const match = KOSOVO_MUNICIPALITIES.find((m) => fold(m) === foldedInput);
  if (match) return match;

  // Substring fallback: input contains an official name or vice versa.
  const contains = KOSOVO_MUNICIPALITIES.find(
    (m) => {
      const fm = fold(m);
      return fm.length >= 4 && (foldedInput.includes(fm) || fm.includes(foldedInput));
    },
  );
  return contains ?? value;
}

/** Remove street keywords that leaked into a name field. */
function scrubStreetKeywords(name: string): string {
  if (!name) return "";
  if (STREET_KEYWORDS.test(name)) {
    return ""; // A street fragment is never a human name.
  }
  return name;
}

/**
 * Split a full human name into first + last.
 *
 * LLMs occasionally dump the whole name into ONE field ("Arben Krasniqi"
 * in last_name with a junk fragment like "EN" in first_name) or the entire
 * name into first_name with an empty last_name. This normalizes both cases:
 *   ("EN", "Arben Krasniqi")    → ("Arben", "Krasniqi")
 *   ("Arben Krasniqi", "")      → ("Arben", "Krasniqi")
 *   ("Arben", "")               → ("Arben", "")
 */
function splitFullName(rawFirst: string, rawLast: string): {
  first_name: string;
  last_name: string;
} {
  const f = rawFirst.trim();
  const l = rawLast.trim();
  const fWords = f.split(/\s+/).filter(Boolean);
  const lWords = l.split(/\s+/).filter(Boolean);

  // last_name holds ≥2 words → it is likely the FULL name. Its first word
  // wins as the given name; the rest is the surname.
  if (lWords.length >= 2) {
    return {
      first_name: lWords[0],
      last_name: lWords.slice(1).join(" "),
    };
  }

  // first_name holds multiple words and last is empty → split it.
  if (fWords.length >= 2 && lWords.length === 0) {
    return {
      first_name: fWords[0],
      last_name: fWords.slice(1).join(" "),
    };
  }

  return { first_name: f, last_name: l };
}

/** Diacritic-insensitive fold used for city → country inference. */
function foldCity(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

const AL_COUNTRY_CITIES = [
  "tirane", "tirona", "durres", "durels", "vlore", "shkoder", "elbasan",
  "fier", "korçe", "korce", "berat", "lushnje", "kavaje", "sarande",
] as const;
const MK_COUNTRY_CITIES = [
  "shkup", "skopje", "tetove", "tetovo", "manastir", "bitola", "oher",
  "ohrid", "kumanove", "gostivar",
] as const;
const XK_COUNTRY_CITIES = [
  "prishtine", "pristina", "prizren", "ferizaj", "ujeqe", "peje", "peja",
  "gjakove", "gjakova", "gjilan", "mitrovice", "podujeve", "vushtrri",
  "fushekosove", "suhareke", "drenas", "lipjan", "kline", "malisheve",
  "decan", "kacanik", "gjilan",
] as const;

/**
 * Infer the shipping country from phone prefix and/or city.
 * Kosovo first; Albania (+355 / 068/069 / Tiranë…), then North Macedonia.
 * Returns null when the evidence is inconclusive (caller keeps its current
 * country instead of guessing).
 */
function inferCountry(phone: string, city: string): string | null {
  const p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+383") || p.startsWith("383")) return "Kosovë";
  if (p.startsWith("+355") || p.startsWith("355") || /^0?6[89]/.test(p)) return "Shqipëri";
  if (p.startsWith("+389") || p.startsWith("389")) return "Maqedoni";

  const c = foldCity(city);
  if (!c) return null;
  if (XK_COUNTRY_CITIES.some((x) => c.includes(x))) return "Kosovë";
  if (AL_COUNTRY_CITIES.some((x) => c.includes(x))) return "Shqipëri";
  if (MK_COUNTRY_CITIES.some((x) => c.includes(x))) return "Maqedoni";
  return null;
}

/**
 * Normalize a phone to a clean dialable form.
 * Kosovo (+383/0…) → local 04…; Albania (+355) and North Macedonia (+389)
 * keep their international form so nothing is silently mangled.
 */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+383")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("383")) {
    digits = "0" + digits.slice(3);
  }
  // Any other international number (+355…, +389…) stays as-is.
  return digits;
}

/** Apply all post-processing normalizers to a raw parsed object. */
function sanitizeParsedOrder(obj: Record<string, unknown>): ParsedOrder {
  const names = splitFullName(
    scrubStreetKeywords(String(obj.first_name ?? "").trim()),
    scrubStreetKeywords(String(obj.last_name ?? "").trim()),
  );
  const phone = normalizePhone(String(obj.phone ?? "").replace(/[\s-]/g, "").trim());
  const city = normalizeCity(String(obj.city ?? "").trim());
  return {
    first_name: names.first_name,
    last_name: names.last_name,
    phone,
    city,
    address: String(obj.address ?? "").trim(),
    address_details: String(obj.address_details ?? "").trim(),
    product_description: String(obj.product_description ?? "").trim(),
    quantity: Math.max(1, Number(obj.quantity ?? 1) || 1),
    notes: String(obj.notes ?? "").trim(),
    price: Number(obj.price ?? 0) || 0,
    country: inferCountry(phone, city),
  };
}

/** Exported so the frontend can type the parser response explicitly. */
export interface GeminiParseResult {
  engine: "gemini" | null;
  parsed: ParsedOrder | null;
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
    return sanitizeParsedOrder(obj);
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
  handler: async (ctx, { imageBase64, mimeType }): Promise<GeminiParseResult> => {
    const user = await getCurrentUserSafe(ctx);
    if (!user) throw new Error("Not authenticated");

    // Read the Gemini key from app settings (admin-managed)
    const setting = await ctx.runQuery(api.appSettings.getSetting, {
      key: "gemini_api_key",
    });

    // Also allow platform-managed key via env
    const apiKey = setting || process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return { engine: null, parsed: null } satisfies GeminiParseResult;
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
        quantity: parsed.quantity,
        notes: parsed.notes,
        price: parsed.price,
        country: parsed.country,
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
