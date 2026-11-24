"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  FileText,
  FileUp,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  formatCurrency,
  formatDisplayDate,
  type ExpiryStatus,
} from "@/lib/constants";
import type { DocumentItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";

interface DocumentsClientProps {
  initialDocuments: DocumentItem[];
  initialTags: Array<{ tag: string; count: number }>;
  initialSearch?: string;
  initialCategory?: string;
  initialExpiryStatus?: string;
  initialTag?: string;
}

export function DocumentsClient({
  initialDocuments,
  initialTags,
  initialSearch = "",
  initialCategory = "all",
  initialExpiryStatus = "all",
  initialTag = "all",
}: DocumentsClientProps) {
  const { settings, openCreateModal, openEditModal, refreshHeaderState } =
    useWorkspace();

  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [tags, setTags] = useState(initialTags);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [expiryStatus, setExpiryStatus] = useState(initialExpiryStatus);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [sortBy, setSortBy] = useState<
    "uploaded" | "purchase" | "expiry" | "name" | "amount"
  >("uploaded");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [draggingOver, setDraggingOver] = useState(false);
  const [quickUploading, setQuickUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reloadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const docs: DocumentItem[] = data.documents || [];
        setDocuments(docs);

        const tagMap = new Map<string, number>();
        for (const d of docs) {
          for (const t of d.tags) {
            tagMap.set(t, (tagMap.get(t) || 0) + 1);
          }
        }
        setTags(
          Array.from(tagMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      reloadDocuments();
    };
    window.addEventListener("documind:document-changed", handler);
    return () => window.removeEventListener("documind:document-changed", handler);
  }, [reloadDocuments]);

  const handleDirectDropUpload = async (file: File) => {
    setUploadNotice(null);
    if (!ACCEPTED_UPLOAD_MIME_TYPES.has(file.type)) {
      setUploadNotice({
        type: "error",
        text: "Unsupported file format. Upload PDF, PNG, JPG, or WEBP.",
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadNotice({
        type: "error",
        text: "File exceeds the 15 MB limit.",
      });
      return;
    }

    setQuickUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadNotice({
          type: "error",
          text: data.error || "Upload failed.",
        });
        return;
      }
      setUploadNotice({
        type: "success",
        text: `Processed and saved "${data.document.name}" (${data.document.category}).`,
      });
      await reloadDocuments();
      await refreshHeaderState();
    } catch {
      setUploadNotice({
        type: "error",
        text: "Network error while uploading file.",
      });
    } finally {
      setQuickUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        await reloadDocuments();
        await refreshHeaderState();
      }
    } finally {
      setDeleting(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = documents.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (expiryStatus !== "all" && d.expiry_status !== expiryStatus) return false;
      if (
        selectedTag !== "all" &&
        !d.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase())
      ) {
        return false;
      }
      if (q) {
        const hay = [
          d.name,
          d.category,
          d.issuer,
          d.policy_number,
          d.warranty_duration,
          d.notes,
          d.extracted_text,
          d.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
      if (sortBy === "purchase") {
        const av = a.purchase_date || (dir > 0 ? "9999-99-99" : "");
        const bv = b.purchase_date || (dir > 0 ? "9999-99-99" : "");
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "expiry") {
        const av = a.expiry_date || (dir > 0 ? "9999-99-99" : "");
        const bv = b.expiry_date || (dir > 0 ? "9999-99-99" : "");
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === "amount") {
        return ((a.amount ?? -1) - (b.amount ?? -1)) * dir;
      }
      return a.created_at.localeCompare(b.created_at) * dir;
    });

    return list;
  }, [documents, search, category, expiryStatus, selectedTag, sortBy, sortDir]);

  const statusChips: Array<{ value: "all" | ExpiryStatus; label: string }> = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "expiring_soon", label: "Expiring soon" },
    { value: "expired", label: "Expired" },
    { value: "no_expiry", label: "No expiry" },
  ];

  const hasFilters =
    search.trim() !== "" ||
    category !== "all" ||
    expiryStatus !== "all" ||
    selectedTag !== "all";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
            My Documents
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            {documents.length} total record{documents.length === 1 ? "" : "s"} · Search,
            preview, download, or organise with custom tags.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
          >
            <Plus size={16} />
            Add / Upload Document
          </button>
        </div>
      </div>

      {/* Drag & Drop Quick Upload Bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDraggingOver(true);
        }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleDirectDropUpload(file);
        }}
        className={`rounded-xl border border-dashed px-4 py-3.5 transition-colors ${
          draggingOver
            ? "border-[#4568C7] bg-[#EEF2FB]/70"
            : "border-[#D0D5DD] bg-white"
        }`}
      >
        <input
          ref={dropInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleDirectDropUpload(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] text-[#4568C7]">
              {quickUploading ? (
                <Loader2 size={17} className="animate-spin text-[#8B7AE8]" />
              ) : (
                <FileUp size={17} />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[#111827]">
                {quickUploading
                  ? "Extracting document metadata and saving..."
                  : "Drag & drop a PDF or image here for instant intelligent upload"}
              </p>
              <p className="text-xs text-[#667085]">
                Auto-detects category, issuer, dates, warranty terms, and totals (PDF,
                PNG, JPG, WEBP up to 15 MB).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={quickUploading}
              onClick={() => dropInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] px-3 text-xs font-medium text-[#111827] hover:bg-[#EEF2FB]"
            >
              Browse device
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#4568C7] hover:bg-[#F7F8FC]"
            >
              <Sparkles size={13} className="text-[#8B7AE8]" />
              Review &amp; edit form
            </button>
          </div>
        </div>

        {uploadNotice && (
          <div
            className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium ${
              uploadNotice.type === "error"
                ? "border-[#F7CACA] bg-[#FEF0F0] text-[#DC5252]"
                : "border-[#CBEFD9] bg-[#ECFDF3] text-[#16A36A]"
            }`}
          >
            <span>{uploadNotice.text}</span>
            <button
              type="button"
              onClick={() => setUploadNotice(null)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-2.5 text-[#667085]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, issuer, policy #, tags, or extracted text..."
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] pl-9 pr-8 text-sm text-[#111827] placeholder:text-[#667085] focus:border-[#4568C7] focus:bg-white focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-[#667085] hover:text-[#111827]"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category + Tag + Sort + View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] focus:border-[#4568C7] focus:outline-none"
            >
              <option value="all">All categories</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                aria-label="Filter by tag"
                className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] focus:border-[#4568C7] focus:outline-none"
              >
                <option value="all">All tags</option>
                {tags.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    #{t.tag} ({t.count})
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center">
              <select
                value={sortBy}
                onChange={(e) => {
                  const next = e.target.value as typeof sortBy;
                  setSortBy(next);
                  setSortDir(next === "name" || next === "expiry" ? "asc" : "desc");
                }}
                aria-label="Sort documents"
                className="h-9 rounded-l-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] focus:border-[#4568C7] focus:outline-none"
              >
                <option value="uploaded">Sort: Uploaded date</option>
                <option value="expiry">Sort: Expiry date</option>
                <option value="purchase">Sort: Purchase date</option>
                <option value="name">Sort: Name</option>
                <option value="amount">Sort: Amount</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                title={`Direction: ${sortDir === "asc" ? "Ascending" : "Descending"}`}
                aria-label="Toggle sort direction"
                className="inline-flex h-9 items-center justify-center rounded-r-lg border border-l-0 border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#667085] hover:bg-[#F7F8FC] hover:text-[#111827]"
              >
                <ArrowUpDown size={14} />
              </button>
            </div>

            <div className="hidden md:inline-flex rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-md p-1.5 ${
                  viewMode === "table"
                    ? "bg-white text-[#111827] shadow-xs"
                    : "text-[#667085] hover:text-[#111827]"
                }`}
                aria-label="Table view"
              >
                <List size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-1.5 ${
                  viewMode === "grid"
                    ? "bg-white text-[#111827] shadow-xs"
                    : "text-[#667085] hover:text-[#111827]"
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Chips + Clear Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusChips.map((chip) => {
              const active = expiryStatus === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setExpiryStatus(chip.value)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#4568C7] bg-[#EEF2FB] text-[#243B64]"
                      : "border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F7F8FC] hover:text-[#111827]"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setExpiryStatus("all");
                setSelectedTag("all");
              }}
              className="text-xs font-medium text-[#4568C7] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Empty States or Document List */}
      {documents.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8FC] text-[#4568C7]">
            <FilePlus2 size={22} />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-[#111827]">
            No documents yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#667085]">
            Upload your first warranty card, insurance policy, gift card, invoice,
            receipt, or agreement to start tracking everything in one place.
          </p>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#4568C7] px-5 text-sm font-semibold text-white hover:bg-[#3756AC]"
          >
            <Plus size={16} />
            Upload your first document
          </button>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <FileText size={24} className="mx-auto text-[#9CA3AF]" />
          <h2 className="mt-3 text-base font-semibold text-[#111827]">
            No matching documents
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Try adjusting your search query, category filter, or expiry status.
          </p>
        </div>
      ) : (
        <>
          {/* Table View (Desktop/Tablet md+ when viewMode === 'table') */}
          {viewMode === "table" && (
            <div className="hidden md:block overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F7F8FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                      <th className="px-4 py-3">Document</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Uploaded</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-sm">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#FAFBFD]">
                        <td className="px-4 py-3.5 max-w-[300px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <CategoryIcon category={doc.category} size={16} withTile />
                            <div className="min-w-0">
                              <Link
                                href={`/documents/${doc.id}`}
                                className="block truncate font-medium text-[#111827] hover:text-[#4568C7]"
                              >
                                {doc.name}
                              </Link>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
                                {doc.issuer && <span className="truncate">{doc.issuer}</span>}
                                {doc.policy_number && (
                                  <span className="font-mono text-[11px] text-[#667085]">
                                    #{doc.policy_number}
                                  </span>
                                )}
                                {doc.has_file && doc.file_size > 0 && (
                                  <span>· {formatBytes(doc.file_size)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-[#243B64]">
                          {doc.category}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge
                              status={doc.expiry_status}
                              daysUntilExpiry={doc.days_until_expiry}
                              compact
                            />
                            {doc.expiry_date && (
                              <span className="text-[11px] tabular-nums text-[#667085]">
                                {formatDisplayDate(doc.expiry_date, settings.date_format)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium tabular-nums text-[#111827]">
                          {doc.amount !== null
                            ? formatCurrency(doc.amount, doc.currency)
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs tabular-nums text-[#667085]">
                          {formatDisplayDate(doc.created_at, settings.date_format)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/documents/${doc.id}`}
                              title="View details and preview"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
                            >
                              <Eye size={15} />
                            </Link>
                            {doc.has_file && (
                              <a
                                href={`/api/documents/${doc.id}/file`}
                                title="Download original file"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
                              >
                                <Download size={15} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(doc)}
                              title="Edit details"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F3F4F6] hover:text-[#111827]"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(doc)}
                              title="Delete document"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#FEF0F0] hover:text-[#DC5252]"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card Grid View (always shown on mobile < md, or on md+ when viewMode === 'grid') */}
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
              viewMode === "table" ? "md:hidden" : ""
            }`}
          >
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-4 transition-colors hover:border-[#C7D2FE]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIcon category={doc.category} size={16} withTile />
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="block truncate text-sm font-semibold text-[#111827] hover:text-[#4568C7]"
                        >
                          {doc.name}
                        </Link>
                        <p className="truncate text-xs text-[#667085]">
                          {doc.category}
                          {doc.issuer ? ` · ${doc.issuer}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge
                      status={doc.expiry_status}
                      daysUntilExpiry={doc.days_until_expiry}
                      compact
                    />
                    {doc.amount !== null && (
                      <span className="text-xs font-semibold tabular-nums text-[#111827]">
                        {formatCurrency(doc.amount, doc.currency)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-[#667085]">
                    {doc.expiry_date && (
                      <p className="tabular-nums">
                        Expires: {formatDisplayDate(doc.expiry_date, settings.date_format)}
                      </p>
                    )}
                    {doc.policy_number && (
                      <p className="font-mono text-[11px]">Ref: {doc.policy_number}</p>
                    )}
                  </div>

                  {doc.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {doc.tags.slice(0, 4).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTag(t)}
                          className="inline-flex items-center gap-1 rounded border border-[#E5E7EB] bg-[#F7F8FC] px-1.5 py-0.5 text-[11px] text-[#243B64] hover:border-[#4568C7]"
                        >
                          <Tag size={10} />
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4568C7] hover:underline"
                  >
                    <Eye size={14} />
                    Inspect &amp; preview
                  </Link>
                  <div className="flex items-center gap-1">
                    {doc.has_file && (
                      <a
                        href={`/api/documents/${doc.id}/file`}
                        aria-label={`Download ${doc.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F3F4F6]"
                      >
                        <Download size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(doc)}
                      aria-label={`Edit ${doc.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F3F4F6]"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(doc)}
                      aria-label={`Delete ${doc.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#FEF0F0] hover:text-[#DC5252]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete document?"
        description={`"${deleteTarget?.name || ""}" and any attached file or automatic reminders will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete document"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
