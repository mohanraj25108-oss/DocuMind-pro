export const DOCUMENT_CATEGORIES = [
  "Warranty cards",
  "Insurance policies",
  "Gift cards",
  "Vouchers and coupons",
  "Purchase invoices",
  "Receipts",
  "Agreements",
  "Other personal documents",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface CategoryMeta {
  id: DocumentCategory;
  shortLabel: string;
  description: string;
  icon:
    | "ShieldCheck"
    | "HeartHandshake"
    | "Gift"
    | "TicketPercent"
    | "FileSpreadsheet"
    | "Receipt"
    | "FileSignature"
    | "FolderOpen";
  accentColor: string;
  tintBg: string;
  hasPolicyField: boolean;
  hasWarrantyField: boolean;
}

export const CATEGORY_META: Record<DocumentCategory, CategoryMeta> = {
  "Warranty cards": {
    id: "Warranty cards",
    shortLabel: "Warranties",
    description: "Product protection plans, serial warranties, and coverage periods.",
    icon: "ShieldCheck",
    accentColor: "#4568C7",
    tintBg: "#EEF2FB",
    hasPolicyField: true,
    hasWarrantyField: true,
  },
  "Insurance policies": {
    id: "Insurance policies",
    shortLabel: "Insurance",
    description: "Health, auto, home, life, and travel policy schedules and renewals.",
    icon: "HeartHandshake",
    accentColor: "#243B64",
    tintBg: "#EAEEF6",
    hasPolicyField: true,
    hasWarrantyField: false,
  },
  "Gift cards": {
    id: "Gift cards",
    shortLabel: "Gift cards",
    description: "Digital and physical retail gift balances with expiration tracking.",
    icon: "Gift",
    accentColor: "#8B7AE8",
    tintBg: "#F3F1FC",
    hasPolicyField: true,
    hasWarrantyField: false,
  },
  "Vouchers and coupons": {
    id: "Vouchers and coupons",
    shortLabel: "Vouchers",
    description: "Store credits, promotional codes, and redeemable vouchers.",
    icon: "TicketPercent",
    accentColor: "#E6A23C",
    tintBg: "#FDF5E8",
    hasPolicyField: true,
    hasWarrantyField: false,
  },
  "Purchase invoices": {
    id: "Purchase invoices",
    shortLabel: "Invoices",
    description: "Tax invoices, hardware bills, and high-value purchase records.",
    icon: "FileSpreadsheet",
    accentColor: "#4568C7",
    tintBg: "#EEF2FB",
    hasPolicyField: true,
    hasWarrantyField: true,
  },
  Receipts: {
    id: "Receipts",
    shortLabel: "Receipts",
    description: "Everyday expense receipts, proof of purchase, and return slips.",
    icon: "Receipt",
    accentColor: "#16A36A",
    tintBg: "#EAF8F1",
    hasPolicyField: false,
    hasWarrantyField: false,
  },
  Agreements: {
    id: "Agreements",
    shortLabel: "Agreements",
    description: "Leases, NDAs, service contracts, and signed personal agreements.",
    icon: "FileSignature",
    accentColor: "#243B64",
    tintBg: "#EAEEF6",
    hasPolicyField: true,
    hasWarrantyField: false,
  },
  "Other personal documents": {
    id: "Other personal documents",
    shortLabel: "Other",
    description: "Certificates, registrations, IDs, and miscellaneous records.",
    icon: "FolderOpen",
    accentColor: "#667085",
    tintBg: "#F2F4F7",
    hasPolicyField: true,
    hasWarrantyField: false,
  },
};

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar (USD)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (INR)" },
  { code: "EUR", symbol: "€", label: "Euro (EUR)" },
  { code: "GBP", symbol: "£", label: "British Pound (GBP)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (AUD)" },
] as const;

export const SUPPORTED_DATE_FORMATS = [
  "MMM D, YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
] as const;

export type DateFormatOption = (typeof SUPPORTED_DATE_FORMATS)[number];
export type ExpiryStatus = "active" | "expiring_soon" | "expired" | "no_expiry";

export function toIsoDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayIso(): string {
  return toIsoDateOnly(new Date());
}

export function daysUntil(isoDate: string | null | undefined, fromIso?: string): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return null;
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const baseStr = fromIso || getTodayIso();
  const base = new Date(`${baseStr.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(base.getTime())) return null;
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function getExpiryStatus(
  expiryDate: string | null | undefined,
  expiringSoonDays = 30
): ExpiryStatus {
  const diff = daysUntil(expiryDate);
  if (diff === null) return "no_expiry";
  if (diff < 0) return "expired";
  if (diff <= expiringSoonDays) return "expiring_soon";
  return "active";
}

export function formatCurrency(
  amount: number | null | undefined,
  currencyCode = "USD"
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDisplayDate(
  value: string | null | undefined,
  format: DateFormatOption = "MMM D, YYYY"
): string {
  if (!value) return "—";
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDisplayDate(toIsoDateOnly(parsed), format);
  }
  const [y, m, d] = datePart.split("-").map(Number);
  if (format === "YYYY-MM-DD") return datePart;
  if (format === "DD/MM/YYYY") {
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatRelativeDays(diff: number | null): string {
  if (diff === null) return "No expiry";
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Expires tomorrow";
  if (diff === -1) return "Expired yesterday";
  if (diff < 0) return `Expired ${Math.abs(diff)}d ago`;
  return `In ${diff}d`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isValidCategory(val: string): val is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(val);
}

export const AVATAR_COLORS = [
  "#243B64",
  "#4568C7",
  "#8B7AE8",
  "#16A36A",
  "#E6A23C",
] as const;

export const ACCEPTED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
