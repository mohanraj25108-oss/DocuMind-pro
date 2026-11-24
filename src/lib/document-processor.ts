import fs from "node:fs";
import path from "node:path";
import { extractText, getMeta } from "unpdf";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
  toIsoDateOnly,
} from "./constants";

export interface ExtractedMetadata {
  suggestedName: string;
  category: DocumentCategory;
  issuer: string;
  purchaseDate: string | null;
  expiryDate: string | null;
  warrantyDuration: string;
  policyNumber: string;
  amount: number | null;
  currency: string;
  tags: string[];
  aiSummary: string;
  extractedText: string;
  extractionStatus: "processed" | "partial" | "failed";
  detectedFields: string[];
}

const TESSDATA_DIR = path.join(process.cwd(), "data", "tessdata");

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function makeValidIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1980 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateCandidate(raw: string): string | null {
  const cleaned = raw.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  let m = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    return makeValidIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  m = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) return makeValidIsoDate(y, b, a);
    if (b > 12) return makeValidIsoDate(y, a, b);
    // Default to DD/MM/YYYY when ambiguous on receipts/invoices unless month <= 12
    return makeValidIsoDate(y, b, a) || makeValidIsoDate(y, a, b);
  }

  // DD MMM YYYY or DD-MMM-YYYY
  m = cleaned.match(/^(\d{1,2})[\s,-]+([A-Za-z]{3,9})[\s,-]+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return makeValidIsoDate(Number(m[3]), mon, Number(m[1]));
  }

  // MMM DD, YYYY
  m = cleaned.match(/^([A-Za-z]{3,9})[\s.]+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (mon) return makeValidIsoDate(Number(m[3]), mon, Number(m[2]));
  }

  return null;
}

function addDurationToIso(isoDate: string, durationText: string): string | null {
  const m = durationText.match(/(\d+)\s*(year|yr|years|yrs|month|mo|months|day|days)/i);
  if (!m) return null;
  const qty = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;

  if (unit.startsWith("year") || unit.startsWith("yr")) {
    base.setUTCFullYear(base.getUTCFullYear() + qty);
  } else if (unit.startsWith("month") || unit.startsWith("mo")) {
    base.setUTCMonth(base.getUTCMonth() + qty);
  } else {
    base.setUTCDate(base.getUTCDate() + qty);
  }
  return toIsoDateOnly(new Date(base.getTime()));
}

function cleanFilenameToTitle(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, "");
  const normalized = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled Document";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectCategory(combinedText: string): DocumentCategory {
  const lower = combinedText.toLowerCase();

  const rules: Array<{ category: DocumentCategory; keywords: Array<[string, number]> }> = [
    {
      category: "Warranty cards",
      keywords: [
        ["warranty", 5],
        ["applecare", 5],
        ["protection plan", 4],
        ["extended care", 4],
        ["serial number", 2],
        ["manufacturer guarantee", 4],
        ["service coverage", 3],
      ],
    },
    {
      category: "Insurance policies",
      keywords: [
        ["insurance", 5],
        ["policy number", 4],
        ["policy no", 4],
        ["premium", 3],
        ["sum insured", 4],
        ["deductible", 4],
        ["beneficiary", 3],
        ["underwriter", 4],
        ["coverage limit", 3],
      ],
    },
    {
      category: "Gift cards",
      keywords: [
        ["gift card", 6],
        ["giftcard", 6],
        ["egift", 5],
        ["gift certificate", 5],
        ["redeemable", 2],
        ["card balance", 3],
        ["pin code", 2],
      ],
    },
    {
      category: "Vouchers and coupons",
      keywords: [
        ["voucher", 5],
        ["coupon", 5],
        ["promo code", 5],
        ["discount code", 4],
        ["store credit", 4],
        ["cashback", 3],
        ["offer valid", 3],
      ],
    },
    {
      category: "Purchase invoices",
      keywords: [
        ["tax invoice", 6],
        ["invoice", 4],
        ["invoice no", 4],
        ["billed to", 3],
        ["gstin", 4],
        ["order confirmation", 3],
        ["billing address", 3],
        ["subtotal", 2],
      ],
    },
    {
      category: "Receipts",
      keywords: [
        ["receipt", 5],
        ["pos", 3],
        ["cashier", 3],
        ["paid via", 3],
        ["payment receipt", 5],
        ["thank you for shopping", 4],
        ["change due", 4],
      ],
    },
    {
      category: "Agreements",
      keywords: [
        ["agreement", 5],
        ["lease", 4],
        ["contract", 4],
        ["non-disclosure", 5],
        ["nda", 4],
        ["whereas", 4],
        ["landlord", 4],
        ["tenant", 4],
        ["signed by", 3],
        ["terms and conditions", 2],
      ],
    },
  ];

  let bestCat: DocumentCategory = "Other personal documents";
  let bestScore = 0;

  for (const rule of rules) {
    let score = 0;
    for (const [kw, weight] of rule.keywords) {
      if (lower.includes(kw)) {
        score += weight;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = rule.category;
    }
  }

  return DOCUMENT_CATEGORIES.includes(bestCat) ? bestCat : "Other personal documents";
}

function detectIssuer(text: string, filename: string): string {
  const labeled = text.match(
    /(?:issued by|issuer|company|merchant|vendor|insurer|provider|seller|brand|store|from)\s*[:\-]\s*([^\n,;]{2,50})/i
  );
  if (labeled?.[1]) {
    return labeled[1].trim();
  }

  const knownBrands = [
    "Apple",
    "Samsung",
    "Sony",
    "Dell",
    "HP",
    "Lenovo",
    "LG",
    "Microsoft",
    "Amazon",
    "Flipkart",
    "Best Buy",
    "Target",
    "Walmart",
    "Costco",
    "IKEA",
    "HDFC ERGO",
    "ICICI Lombard",
    "LIC",
    "Aetna",
    "BlueCross",
    "Geico",
    "State Farm",
    "Progressive",
    "Allianz",
    "AXA",
    "Starbucks",
    "Uber",
    "Airbnb",
  ];
  const combined = `${text}\n${filename}`.toLowerCase();
  for (const brand of knownBrands) {
    if (combined.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 50 && !/^\d+$/.test(l));

  for (const line of lines.slice(0, 6)) {
    if (
      !/^(tax invoice|invoice|receipt|warranty|policy|certificate|agreement|page \d)/i.test(
        line
      ) &&
      /[A-Za-z]{2,}/.test(line)
    ) {
      return line.replace(/\s{2,}/g, " ");
    }
  }
  return "";
}

function detectDates(text: string): {
  purchaseDate: string | null;
  expiryDate: string | null;
} {
  const dateRegexStr =
    "(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|\\d{1,2}[\\s,-]+[A-Za-z]{3,9}[\\s,-]+\\d{4}|[A-Za-z]{3,9}[\\s.]+\\d{1,2},?\\s+\\d{4})";

  const expiryMatch = text.match(
    new RegExp(
      `(?:expir(?:y|es|ation)|valid\\s*(?:until|thru|through|till)|renewal\\s*date|end\\s*date|coverage\\s*ends|maturity\\s*date|redeem\\s*by)\\s*[:\\-]?\\s*${dateRegexStr}`,
      "i"
    )
  );

  const purchaseMatch = text.match(
    new RegExp(
      `(?:purchase\\s*date|invoice\\s*date|order\\s*date|issue\\s*date|issued\\s*on|effective\\s*date|start\\s*date|date\\s*of\\s*purchase|billed\\s*on|transaction\\s*date|date)\\s*[:\\-]?\\s*${dateRegexStr}`,
      "i"
    )
  );

  let expiryDate = expiryMatch?.[1] ? parseDateCandidate(expiryMatch[1]) : null;
  let purchaseDate = purchaseMatch?.[1] ? parseDateCandidate(purchaseMatch[1]) : null;

  if (!purchaseDate || !expiryDate) {
    const allMatches = [...text.matchAll(new RegExp(dateRegexStr, "g"))]
      .map((m) => parseDateCandidate(m[1]))
      .filter((d): d is string => Boolean(d));
    const uniqueSorted = Array.from(new Set(allMatches)).sort();
    if (!purchaseDate && uniqueSorted.length >= 1) {
      purchaseDate = uniqueSorted[0];
    }
    if (!expiryDate && uniqueSorted.length >= 2) {
      const last = uniqueSorted[uniqueSorted.length - 1];
      if (last !== purchaseDate) expiryDate = last;
    }
  }

  return { purchaseDate, expiryDate };
}

function detectWarrantyDuration(text: string): string {
  const m = text.match(
    /(?:warranty(?:\s+period|\s+duration)?\s*[:\-]?\s*|covered\s+for\s+|limited\s+warranty\s+(?:of\s+)?)(\d{1,3}\s*(?:years?|yrs?|months?|mos?|days?))|(\d{1,3}[-\s]*(?:year|yr|month|mo))\s+(?:limited\s+|extended\s+|manufacturer\s+)?warranty/i
  );
  const raw = (m?.[1] || m?.[2] || "").trim();
  if (!raw) return "";
  return raw.replace(/-/g, " ").replace(/\s+/g, " ");
}

function detectPolicyOrRefNumber(text: string): string {
  const m = text.match(
    /(?:policy\s*(?:no\.?|number|#)|invoice\s*(?:no\.?|number|#)|receipt\s*(?:no\.?|number|#)|voucher\s*(?:code|#)|coupon\s*code|card\s*(?:no\.?|number|#)|contract\s*(?:id|no\.?|#)|order\s*(?:id|no\.?|#)|serial\s*(?:no\.?|number|#)|ref(?:erence)?\s*(?:no\.?|#))\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,28})/i
  );
  return m?.[1] ? m[1].trim() : "";
}

function detectAmountAndCurrency(
  text: string,
  defaultCurrency: string
): { amount: number | null; currency: string } {
  const prioritized = text.match(
    /(?:grand\s*total|total\s*amount|amount\s*paid|total\s*paid|net\s*amount|premium\s*amount|balance|card\s*value|value|total)\s*[:\-]?\s*(USD|INR|EUR|GBP|CAD|AUD|₹|\$|€|£|Rs\.?)?\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,2})?)/i
  );

  const fallback =
    prioritized ||
    text.match(
      /(USD|INR|EUR|GBP|CAD|AUD|₹|\$|€|£|Rs\.?)\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,2})?)/i
    );

  if (!fallback) {
    return { amount: null, currency: defaultCurrency };
  }

  const symbol = (fallback[1] || "").trim().toUpperCase();
  const numStr = (fallback[2] || "").replace(/,/g, "");
  const amount = Number.parseFloat(numStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { amount: null, currency: defaultCurrency };
  }

  let currency = defaultCurrency;
  if (symbol === "₹" || symbol === "RS." || symbol === "RS" || symbol === "INR") {
    currency = "INR";
  } else if (symbol === "$" || symbol === "USD") {
    currency = "USD";
  } else if (symbol === "€" || symbol === "EUR") {
    currency = "EUR";
  } else if (symbol === "£" || symbol === "GBP") {
    currency = "GBP";
  } else if (symbol === "CAD") {
    currency = "CAD";
  } else if (symbol === "AUD") {
    currency = "AUD";
  }

  return { amount, currency };
}

function buildTags(
  category: DocumentCategory,
  issuer: string,
  purchaseDate: string | null,
  warrantyDuration: string
): string[] {
  const tags = new Set<string>();
  if (issuer && issuer.length <= 24) {
    tags.add(issuer.toLowerCase());
  }
  const catShort: Record<DocumentCategory, string> = {
    "Warranty cards": "warranty",
    "Insurance policies": "insurance",
    "Gift cards": "gift-card",
    "Vouchers and coupons": "voucher",
    "Purchase invoices": "invoice",
    Receipts: "receipt",
    Agreements: "agreement",
    "Other personal documents": "personal",
  };
  tags.add(catShort[category]);
  if (purchaseDate) {
    tags.add(purchaseDate.slice(0, 4));
  }
  if (warrantyDuration) {
    tags.add("covered");
  }
  return Array.from(tags).slice(0, 5);
}

function buildSummary(params: {
  name: string;
  category: DocumentCategory;
  issuer: string;
  purchaseDate: string | null;
  expiryDate: string | null;
  warrantyDuration: string;
  policyNumber: string;
  amount: number | null;
  currency: string;
  extractedText: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `${params.category.slice(0, -1).replace(/ie$/, "y")} "${params.name}"${
      params.issuer ? ` issued by ${params.issuer}` : ""
    }.`
  );
  if (params.amount !== null) {
    parts.push(`Recorded value/amount: ${params.currency} ${params.amount.toLocaleString()}.`);
  }
  if (params.policyNumber) {
    parts.push(`Reference/Policy #${params.policyNumber}.`);
  }
  if (params.warrantyDuration || params.expiryDate || params.purchaseDate) {
    const timeline: string[] = [];
    if (params.purchaseDate) timeline.push(`dated ${params.purchaseDate}`);
    if (params.warrantyDuration) timeline.push(`${params.warrantyDuration} warranty`);
    if (params.expiryDate) timeline.push(`valid until ${params.expiryDate}`);
    parts.push(`Timeline: ${timeline.join(", ")}.`);
  }
  if (!params.extractedText.trim()) {
    parts.push("No embedded text was extracted; metadata can be edited anytime.");
  }
  return parts.join(" ");
}

export async function extractTextFromFileBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pdfTitle?: string; status: "processed" | "partial" | "failed" }> {
  if (mimeType === "application/pdf") {
    try {
      const uint8 = new Uint8Array(buffer);
      const result = await extractText(uint8, { mergePages: true });
      let pdfTitle: string | undefined;
      try {
        const meta = await getMeta(uint8);
        if (meta?.info?.Title && typeof meta.info.Title === "string") {
          pdfTitle = meta.info.Title.trim();
        }
      } catch {
        // Ignore optional metadata errors
      }
      const normalized = (typeof result.text === "string" ? result.text : "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .trim();
      return {
        text: normalized,
        pdfTitle,
        status: normalized.length > 0 ? "processed" : "partial",
      };
    } catch {
      return { text: "", status: "failed" };
    }
  }

  if (mimeType.startsWith("image/")) {
    try {
      const localLangPath = path.join(
        process.cwd(),
        "node_modules",
        "@tesseract.js-data",
        "eng",
        "4.0.0"
      );
      const hasLocalData = fs.existsSync(
        path.join(localLangPath, "eng.traineddata.gz")
      );
      if (!hasLocalData && !fs.existsSync(TESSDATA_DIR)) {
        fs.mkdirSync(TESSDATA_DIR, { recursive: true });
      }
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        ...(hasLocalData
          ? { langPath: localLangPath, gzip: true, cacheMethod: "none" }
          : { cachePath: TESSDATA_DIR }),
        logger: () => {},
        errorHandler: () => {},
      });
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("OCR timeout")), 18_000);
        });
        const ocrResult = await Promise.race([worker.recognize(buffer), timeoutPromise]);
        const normalized = (ocrResult?.data?.text || "")
          .replace(/\r\n/g, "\n")
          .replace(/[ \t]+/g, " ")
          .trim();
        return {
          text: normalized,
          status: normalized.length > 0 ? "processed" : "partial",
        };
      } finally {
        await worker.terminate().catch(() => {});
      }
    } catch {
      return { text: "", status: "partial" };
    }
  }

  return { text: "", status: "partial" };
}

export async function processUploadedDocument(params: {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  defaultCurrency: string;
  autoExtract?: boolean;
}): Promise<ExtractedMetadata> {
  const baseTitle = cleanFilenameToTitle(params.originalFilename);

  if (params.autoExtract === false) {
    return {
      suggestedName: baseTitle,
      category: "Other personal documents",
      issuer: "",
      purchaseDate: null,
      expiryDate: null,
      warrantyDuration: "",
      policyNumber: "",
      amount: null,
      currency: params.defaultCurrency,
      tags: [],
      aiSummary: `Uploaded "${baseTitle}" (${params.originalFilename}).`,
      extractedText: "",
      extractionStatus: "partial",
      detectedFields: [],
    };
  }

  const { text, pdfTitle, status } = await extractTextFromFileBuffer(
    params.buffer,
    params.mimeType
  );

  const combinedForDetection = `${pdfTitle || ""}\n${params.originalFilename}\n${text}`;
  const category = detectCategory(combinedForDetection);
  const issuer = detectIssuer(text, params.originalFilename);
  const { purchaseDate, expiryDate: explicitExpiry } = detectDates(text);
  const warrantyDuration = detectWarrantyDuration(text);
  const expiryDate =
    explicitExpiry ||
    (purchaseDate && warrantyDuration
      ? addDurationToIso(purchaseDate, warrantyDuration)
      : null);
  const policyNumber = detectPolicyOrRefNumber(text);
  const { amount, currency } = detectAmountAndCurrency(text, params.defaultCurrency);

  let suggestedName = baseTitle;
  if (
    pdfTitle &&
    pdfTitle.length >= 4 &&
    pdfTitle.length <= 72 &&
    !/^(untitled|microsoft word|document)/i.test(pdfTitle)
  ) {
    suggestedName = pdfTitle;
  } else if (issuer && baseTitle.toLowerCase().includes("scan")) {
    suggestedName = `${issuer} ${category.slice(0, -1)}`;
  }

  const tags = buildTags(category, issuer, purchaseDate, warrantyDuration);
  const detectedFields: string[] = [];
  if (category !== "Other personal documents") detectedFields.push("category");
  if (issuer) detectedFields.push("issuer");
  if (purchaseDate) detectedFields.push("purchaseDate");
  if (expiryDate) detectedFields.push("expiryDate");
  if (warrantyDuration) detectedFields.push("warrantyDuration");
  if (policyNumber) detectedFields.push("policyNumber");
  if (amount !== null) detectedFields.push("amount");

  const aiSummary = buildSummary({
    name: suggestedName,
    category,
    issuer,
    purchaseDate,
    expiryDate,
    warrantyDuration,
    policyNumber,
    amount,
    currency,
    extractedText: text,
  });

  return {
    suggestedName,
    category,
    issuer,
    purchaseDate,
    expiryDate,
    warrantyDuration,
    policyNumber,
    amount,
    currency,
    tags,
    aiSummary,
    extractedText: text,
    extractionStatus: status,
    detectedFields,
  };
}
