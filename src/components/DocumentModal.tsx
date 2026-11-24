"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  SUPPORTED_CURRENCIES,
  formatBytes,
  type DocumentCategory,
} from "@/lib/constants";
import type { DocumentItem } from "@/lib/documents";

interface DocumentModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialDocument?: DocumentItem | null;
  defaultCurrency?: string;
  initialCategory?: DocumentCategory;
  onClose: () => void;
  onSaved: (doc: DocumentItem) => void;
}

export function DocumentModal({
  open,
  mode,
  initialDocument,
  defaultCurrency = "USD",
  initialCategory,
  onClose,
  onSaved,
}: DocumentModalProps) {
  const isEdit = mode === "edit" && Boolean(initialDocument);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entryType, setEntryType] = useState<"upload" | "manual">(
    isEdit ? "manual" : "upload"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);
  const [extractedText, setExtractedText] = useState(
    isEdit ? initialDocument?.extracted_text || "" : ""
  );
  const [aiSummary, setAiSummary] = useState(
    isEdit ? initialDocument?.ai_summary || "" : ""
  );
  const [extractionStatus, setExtractionStatus] = useState(
    isEdit ? initialDocument?.extraction_status || "manual" : "manual"
  );

  const [name, setName] = useState(isEdit ? initialDocument?.name || "" : "");
  const [category, setCategory] = useState<DocumentCategory>(
    isEdit && initialDocument
      ? initialDocument.category
      : initialCategory || "Warranty cards"
  );
  const [issuer, setIssuer] = useState(isEdit ? initialDocument?.issuer || "" : "");
  const [purchaseDate, setPurchaseDate] = useState(
    isEdit ? initialDocument?.purchase_date || "" : ""
  );
  const [expiryDate, setExpiryDate] = useState(
    isEdit ? initialDocument?.expiry_date || "" : ""
  );
  const [warrantyDuration, setWarrantyDuration] = useState(
    isEdit ? initialDocument?.warranty_duration || "" : ""
  );
  const [policyNumber, setPolicyNumber] = useState(
    isEdit ? initialDocument?.policy_number || "" : ""
  );
  const [amount, setAmount] = useState(
    isEdit && initialDocument && initialDocument.amount !== null
      ? String(initialDocument.amount)
      : ""
  );
  const [currency, setCurrency] = useState(
    isEdit && initialDocument ? initialDocument.currency || defaultCurrency : defaultCurrency
  );
  const [notes, setNotes] = useState(isEdit ? initialDocument?.notes || "" : "");
  const [tags, setTags] = useState<string[]>(
    isEdit && initialDocument ? initialDocument.tags || [] : []
  );
  const [tagInput, setTagInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleFilePicked = useCallback(
    async (file: File) => {
      setError("");
      const allowed = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];
      if (!allowed.includes(file.type)) {
        setError("Unsupported file type. Please upload PDF, PNG, JPG, or WEBP.");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError("File size must be under 15 MB.");
        return;
      }

      setSelectedFile(file);
      setExtracting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/documents/extract", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (res.ok && data.extracted) {
          const ext = data.extracted;
          setName(ext.suggestedName || file.name.replace(/\.[^/.]+$/, ""));
          setCategory(ext.category || "Other personal documents");
          setIssuer(ext.issuer || "");
          setPurchaseDate(ext.purchaseDate || "");
          setExpiryDate(ext.expiryDate || "");
          setWarrantyDuration(ext.warrantyDuration || "");
          setPolicyNumber(ext.policyNumber || "");
          setAmount(
            ext.amount !== null && ext.amount !== undefined ? String(ext.amount) : ""
          );
          setCurrency(ext.currency || defaultCurrency);
          setTags(Array.isArray(ext.tags) ? ext.tags : []);
          setExtractedText(ext.extractedText || "");
          setAiSummary(ext.aiSummary || "");
          setExtractionStatus(ext.extractionStatus || "processed");
          setDetectedFields(Array.isArray(ext.detectedFields) ? ext.detectedFields : []);
        } else {
          setName(file.name.replace(/\.[^/.]+$/, ""));
        }
      } catch {
        setName(file.name.replace(/\.[^/.]+$/, ""));
      } finally {
        setExtracting(false);
      }
    },
    [defaultCurrency]
  );

  const addTag = (raw: string) => {
    const cleaned = raw.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned) || tags.length >= 12) return;
    setTags([...tags, cleaned]);
    setTagInput("");
  };

  const calculateExpiryFromDuration = () => {
    if (!purchaseDate || !warrantyDuration) return;
    const m = warrantyDuration.match(
      /(\d+)\s*(year|yr|years|yrs|month|mo|months|day|days)/i
    );
    if (!m) return;
    const qty = Number(m[1]);
    const unit = m[2].toLowerCase();
    const dt = new Date(`${purchaseDate}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return;
    if (unit.startsWith("year") || unit.startsWith("yr")) {
      dt.setUTCFullYear(dt.getUTCFullYear() + qty);
    } else if (unit.startsWith("month") || unit.startsWith("mo")) {
      dt.setUTCMonth(dt.getUTCMonth() + qty);
    } else {
      dt.setUTCDate(dt.getUTCDate() + qty);
    }
    const y = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    setExpiryDate(`${y}-${mo}-${d}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter a document name.");
      return;
    }

    if (mode === "create" && entryType === "upload" && !selectedFile) {
      setError("Please select a PDF or image file to upload, or switch to Manual Entry.");
      return;
    }

    setSaving(true);
    try {
      let res: Response;

      if (mode === "edit" && initialDocument) {
        res = await fetch(`/api/documents/${initialDocument.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category,
            issuer: issuer.trim(),
            purchase_date: purchaseDate || null,
            expiry_date: expiryDate || null,
            warranty_duration: warrantyDuration.trim(),
            policy_number: policyNumber.trim(),
            amount: amount.trim() ? Number.parseFloat(amount) : null,
            currency,
            notes: notes.trim(),
            tags,
          }),
        });
      } else if (entryType === "upload" && selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("name", name.trim());
        fd.append("category", category);
        fd.append("issuer", issuer.trim());
        fd.append("purchase_date", purchaseDate);
        fd.append("expiry_date", expiryDate);
        fd.append("warranty_duration", warrantyDuration.trim());
        fd.append("policy_number", policyNumber.trim());
        if (amount.trim()) fd.append("amount", amount.trim());
        fd.append("currency", currency);
        fd.append("notes", notes.trim());
        fd.append("tags", JSON.stringify(tags));
        fd.append("extracted_text", extractedText);
        fd.append("ai_summary", aiSummary);
        fd.append("extraction_status", extractionStatus);
        res = await fetch("/api/documents", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            category,
            issuer: issuer.trim(),
            purchase_date: purchaseDate || null,
            expiry_date: expiryDate || null,
            warranty_duration: warrantyDuration.trim(),
            policy_number: policyNumber.trim(),
            amount: amount.trim() ? Number.parseFloat(amount) : null,
            currency,
            notes: notes.trim(),
            tags,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save document.");
        return;
      }

      onSaved(data.document);
      onClose();
    } catch {
      setError("Network error while saving document.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isDetected = (field: string) => detectedFields.includes(field);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-modal-title"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2
              id="doc-modal-title"
              className="text-base font-semibold text-[#111827]"
            >
              {mode === "edit" ? "Edit document details" : "Add document"}
            </h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              {mode === "edit"
                ? "Update metadata, expiry tracking, or custom tags."
                : "Upload a PDF or image for automatic extraction, or enter details manually."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {mode === "create" && (
            <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-1">
              <button
                type="button"
                onClick={() => setEntryType("upload")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  entryType === "upload"
                    ? "bg-white text-[#111827] shadow-xs border border-[#E5E7EB]"
                    : "text-[#667085] hover:text-[#111827]"
                }`}
              >
                Upload file (PDF / Image)
              </button>
              <button
                type="button"
                onClick={() => setEntryType("manual")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  entryType === "manual"
                    ? "bg-white text-[#111827] shadow-xs border border-[#E5E7EB]"
                    : "text-[#667085] hover:text-[#111827]"
                }`}
              >
                Add manually
              </button>
            </div>
          )}

          {mode === "create" && entryType === "upload" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePicked(file);
                }}
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFilePicked(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border border-dashed p-5 text-center transition-colors ${
                  isDragging
                    ? "border-[#4568C7] bg-[#EEF2FB]/60"
                    : "border-[#D0D5DD] bg-[#F7F8FC] hover:border-[#4568C7]"
                }`}
              >
                {extracting ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 size={22} className="animate-spin text-[#8B7AE8]" />
                    <p className="text-sm font-medium text-[#111827]">
                      Scanning document and extracting fields...
                    </p>
                    <p className="text-xs text-[#667085]">
                      Detecting category, dates, issuer, policy numbers, and value
                    </p>
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#4568C7]">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#111827]">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-[#667085]">
                          {formatBytes(selectedFile.size)}
                          {detectedFields.length > 0
                            ? ` · ${detectedFields.length} fields auto-extracted`
                            : " · Ready to save"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="shrink-0 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#4568C7]">
                      <FileUp size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#111827]">
                        Drop your document here, or{" "}
                        <span className="text-[#4568C7]">browse device</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        Supports PDF, PNG, JPG, and WEBP up to 15 MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {detectedFields.length > 0 && !extracting && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-[#E2DDF8] bg-[#F6F4FE] px-3 py-2 text-xs text-[#5948BA]">
                  <Sparkles size={14} className="shrink-0 text-[#8B7AE8]" />
                  <span>
                    DocuMind pre-filled{" "}
                    <strong>{detectedFields.length} field(s)</strong> from your
                    file. Review and adjust anything below before saving.
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3.5 py-2.5 text-xs font-medium text-[#DC5252]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>
                  Document name <span className="text-[#DC5252]">*</span>
                </span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., MacBook Pro AppleCare+ Plan"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Category</span>
                {isDetected("category") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#4568C7] focus:outline-none"
              >
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Issuer or company</span>
                {isDetected("issuer") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g., Apple, Allianz, Amazon"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Purchase / issue date</span>
                {isDetected("purchaseDate") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Expiry / renewal date</span>
                {isDetected("expiryDate") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Warranty / term duration</span>
                {purchaseDate && warrantyDuration && (
                  <button
                    type="button"
                    onClick={calculateExpiryFromDuration}
                    className="text-[11px] font-medium text-[#4568C7] hover:underline"
                  >
                    Compute expiry
                  </button>
                )}
              </label>
              <input
                type="text"
                value={warrantyDuration}
                onChange={(e) => setWarrantyDuration(e.target.value)}
                placeholder="e.g., 24 months, 2 years"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Policy / reference number</span>
                {isDetected("policyNumber") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <input
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder="e.g., POL-849201 or INV-2026"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 font-mono text-sm text-[#111827] placeholder:font-sans placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#111827]">
                <span>Amount or value</span>
                {isDetected("amount") && (
                  <span className="text-[11px] font-medium text-[#8B7AE8]">
                    Auto-detected
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-24 shrink-0 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm text-[#111827] focus:border-[#4568C7] focus:outline-none"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm tabular-nums text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Custom tags
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-2.5 text-[#9CA3AF]"
                  />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Add tag + Enter"
                    className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-8 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB]"
                  aria-label="Add tag"
                >
                  <Plus size={15} />
                </button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F7F8FC] px-2 py-0.5 text-xs text-[#243B64]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        className="text-[#667085] hover:text-[#DC5252]"
                        aria-label={`Remove ${tag}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Coverage conditions, store location, claim instructions, or personal notes..."
                className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#4568C7] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E5E7EB] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || extracting}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#4568C7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3756AC] disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {mode === "edit" ? "Save changes" : "Save document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
