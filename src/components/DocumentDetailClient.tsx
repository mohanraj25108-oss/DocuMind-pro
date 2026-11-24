"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BellPlus,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { formatBytes, formatCurrency, formatDisplayDate } from "@/lib/constants";
import type { DocumentItem, ReminderItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";
import { ConfirmDialog } from "./ConfirmDialog";

export function DocumentDetailClient({
  initialDocument,
  initialReminders,
}: {
  initialDocument: DocumentItem;
  initialReminders: ReminderItem[];
}) {
  const router = useRouter();
  const { settings, openEditModal, refreshHeaderState } = useWorkspace();
  const [doc, setDoc] = useState<DocumentItem>(initialDocument);
  const [reminders, setReminders] = useState<ReminderItem[]>(initialReminders);

  const [zoomed, setZoomed] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Quick inline tag add
  const [newTag, setNewTag] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  // Quick inline reminder add
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [remDate, setRemDate] = useState(initialDocument.expiry_date || "");
  const [remPriority, setRemPriority] = useState<"low" | "medium" | "high">("medium");
  const [savingReminder, setSavingReminder] = useState(false);

  const reloadDetail = useCallback(async () => {
    const res = await fetch(`/api/documents/${doc.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setDoc(data.document);
      setReminders(data.reminders || []);
    }
  }, [doc.id]);

  useEffect(() => {
    const handler = () => {
      reloadDetail();
    };
    window.addEventListener("documind:document-changed", handler);
    return () => window.removeEventListener("documind:document-changed", handler);
  }, [reloadDetail]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/reprocess`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setDoc(data.document);
      }
    } finally {
      setReprocessing(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTag.trim().toLowerCase();
    if (!cleaned || doc.tags.includes(cleaned)) {
      setNewTag("");
      return;
    }
    setSavingTag(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [...doc.tags, cleaned] }),
      });
      if (res.ok) {
        const data = await res.json();
        setDoc(data.document);
        setNewTag("");
      }
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = doc.tags.filter((t) => t !== tagToRemove);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
    if (res.ok) {
      const data = await res.json();
      setDoc(data.document);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim() || !remDate) return;
    setSavingReminder(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: remTitle.trim(),
          due_date: remDate,
          priority: remPriority,
          document_id: doc.id,
        }),
      });
      if (res.ok) {
        setRemTitle("");
        setShowReminderForm(false);
        await reloadDetail();
        await refreshHeaderState();
      }
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDeleteDocument = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshHeaderState();
        router.push("/documents");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  const isPdf = doc.mime_type === "application/pdf";
  const isImage = Boolean(doc.mime_type?.startsWith("image/"));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb + Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 min-w-0">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#667085] hover:text-[#111827]"
          >
            <ArrowLeft size={14} />
            Back to My Documents
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <CategoryIcon category={doc.category} size={18} withTile />
            <h1 className="font-display text-xl font-bold tracking-tight text-[#111827] sm:text-2xl">
              {doc.name}
            </h1>
            <StatusBadge
              status={doc.expiry_status}
              daysUntilExpiry={doc.days_until_expiry}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/assistant?documentId=${doc.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2DDF8] bg-[#F6F4FE] px-3.5 text-xs font-semibold text-[#5948BA] hover:bg-[#ECE8FC]"
          >
            <Sparkles size={14} className="text-[#8B7AE8]" />
            Ask AI about this
          </Link>
          {doc.has_file && (
            <a
              href={`/api/documents/${doc.id}/file`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Download size={14} />
              Download file
            </a>
          )}
          <button
            type="button"
            onClick={() => openEditModal(doc)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Edit3 size={14} />
            Edit details
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3.5 text-xs font-medium text-[#DC5252] hover:bg-[#FCE2E2]"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: File Preview + Extracted Text */}
        <div className="space-y-6 lg:col-span-7">
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="shrink-0 text-[#4568C7]" />
                <span className="truncate text-xs font-semibold text-[#111827]">
                  {doc.original_filename || "Document preview"}
                </span>
                {doc.file_size > 0 && (
                  <span className="shrink-0 text-xs text-[#667085]">
                    ({formatBytes(doc.file_size)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isImage && (
                  <button
                    type="button"
                    onClick={() => setZoomed(!zoomed)}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#667085] hover:bg-[#F7F8FC]"
                  >
                    {zoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    {zoomed ? "Fit" : "Zoom"}
                  </button>
                )}
                {doc.has_file && (
                  <a
                    href={`/api/documents/${doc.id}/file?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#667085] hover:bg-[#F7F8FC]"
                  >
                    <ExternalLink size={13} />
                    Open
                  </a>
                )}
              </div>
            </div>

            {!doc.has_file ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center bg-[#FAFBFD]">
                <FileText size={28} className="text-[#9CA3AF]" />
                <p className="mt-3 text-sm font-medium text-[#111827]">
                  Manually entered document record
                </p>
                <p className="mt-1 max-w-sm text-xs text-[#667085]">
                  No binary PDF or image file is attached to this entry. All structured
                  metadata, expiry tracking, and reminders remain active.
                </p>
              </div>
            ) : isPdf ? (
              <div className="bg-[#F7F8FC]">
                <iframe
                  src={`/api/documents/${doc.id}/file?inline=1`}
                  title={doc.name}
                  className="h-[460px] w-full border-0 sm:h-[560px]"
                />
              </div>
            ) : isImage ? (
              <div className="flex max-h-[560px] items-center justify-center overflow-auto bg-[#F7F8FC] p-4">
                <Image
                  src={`/api/documents/${doc.id}/file?inline=1`}
                  alt={doc.name}
                  width={1200}
                  height={900}
                  unoptimized
                  className={`rounded-lg border border-[#E5E7EB] bg-white transition-all ${
                    zoomed ? "max-w-none w-auto h-auto" : "max-h-[500px] w-auto h-auto object-contain"
                  }`}
                />
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-[#667085]">
                  Preview unavailable for this file type. Use Download to open locally.
                </p>
              </div>
            )}
          </section>

          {/* AI Summary + Extracted Text */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#8B7AE8]" />
                <h2 className="text-sm font-semibold text-[#111827]">
                  Document understanding &amp; extracted text
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {doc.has_file && (
                  <button
                    type="button"
                    onClick={handleReprocess}
                    disabled={reprocessing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={12}
                      className={reprocessing ? "animate-spin" : ""}
                    />
                    {reprocessing ? "Scanning..." : "Re-scan file"}
                  </button>
                )}
                {doc.extracted_text && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(doc.extracted_text);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#667085] hover:bg-[#F7F8FC]"
                  >
                    {copiedText ? <Check size={12} /> : <Copy size={12} />}
                    {copiedText ? "Copied" : "Copy text"}
                  </button>
                )}
              </div>
            </div>

            {doc.ai_summary && (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3.5 text-xs leading-relaxed text-[#111827]">
                {doc.ai_summary}
              </div>
            )}

            {doc.extracted_text ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  Extracted text content
                </p>
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E5E7EB] bg-[#FAFBFD] p-3 font-mono text-xs leading-relaxed text-[#374151]">
                  {doc.extracted_text}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-[#667085]">
                No raw text extracted for this record yet.
              </p>
            )}
          </section>
        </div>

        {/* Right: Structured Metadata + Tags + Linked Reminders */}
        <div className="space-y-6 lg:col-span-5">
          {/* Structured Metadata Card */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Document details</h2>
            <dl className="mt-4 divide-y divide-[#E5E7EB] text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Category</dt>
                <dd className="text-right text-xs font-medium text-[#111827]">{doc.category}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Issuer / company</dt>
                <dd className="text-right break-words text-xs font-medium text-[#111827]">
                  {doc.issuer || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Purchase date</dt>
                <dd className="text-right text-xs font-medium tabular-nums text-[#111827]">
                  {formatDisplayDate(doc.purchase_date, settings.date_format)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Expiry date</dt>
                <dd className="text-right text-xs font-medium tabular-nums text-[#111827]">
                  {formatDisplayDate(doc.expiry_date, settings.date_format)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Warranty duration</dt>
                <dd className="text-right text-xs font-medium text-[#111827]">
                  {doc.warranty_duration || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Policy / reference #</dt>
                <dd className="text-right break-all font-mono text-xs font-medium text-[#111827]">
                  {doc.policy_number || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Amount / value</dt>
                <dd className="text-right text-xs font-semibold tabular-nums text-[#111827]">
                  {doc.amount !== null
                    ? formatCurrency(doc.amount, doc.currency)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="shrink-0 text-xs text-[#667085]">Uploaded</dt>
                <dd className="text-right text-xs tabular-nums text-[#667085]">
                  {formatDisplayDate(doc.created_at, settings.date_format)}
                </dd>
              </div>
            </dl>

            {doc.notes && (
              <div className="mt-4 border-t border-[#E5E7EB] pt-3.5">
                <p className="text-xs font-medium text-[#667085]">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[#111827]">
                  {doc.notes}
                </p>
              </div>
            )}
          </section>

          {/* Custom Tags */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#111827]">Tags</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {doc.tags.length === 0 ? (
                <p className="text-xs text-[#667085]">No tags added yet.</p>
              ) : (
                doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F7F8FC] px-2 py-1 text-xs font-medium text-[#243B64]"
                  >
                    <Tag size={11} />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="text-[#667085] hover:text-[#DC5252]"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>

            <form onSubmit={handleAddTag} className="mt-3 flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add custom tag..."
                className="h-8 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] px-3 text-xs text-[#111827] focus:border-[#4568C7] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingTag || !newTag.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC] disabled:opacity-50"
              >
                <Plus size={13} />
                Add
              </button>
            </form>
          </section>

          {/* Linked Reminders */}
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#111827]">Reminders</h2>
              <button
                type="button"
                onClick={() => setShowReminderForm(!showReminderForm)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#4568C7] hover:underline"
              >
                <BellPlus size={13} />
                Add reminder
              </button>
            </div>

            {showReminderForm && (
              <form
                onSubmit={handleCreateReminder}
                className="mt-3 space-y-2.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3"
              >
                <input
                  type="text"
                  required
                  value={remTitle}
                  onChange={(e) => setRemTitle(e.target.value)}
                  placeholder={`e.g., Renew ${doc.name}`}
                  className="h-8 w-full rounded-md border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#111827] focus:border-[#4568C7] focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    required
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#111827] focus:border-[#4568C7] focus:outline-none"
                  />
                  <select
                    value={remPriority}
                    onChange={(e) =>
                      setRemPriority(e.target.value as "low" | "medium" | "high")
                    }
                    className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-xs text-[#111827]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReminderForm(false)}
                    className="h-7 rounded-md px-2.5 text-xs text-[#667085] hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingReminder}
                    className="h-7 rounded-md bg-[#4568C7] px-3 text-xs font-medium text-white hover:bg-[#3756AC]"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            <div className="mt-3 space-y-2">
              {reminders.length === 0 ? (
                <p className="text-xs text-[#667085]">
                  No reminders linked to this document.
                </p>
              ) : (
                reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p
                        className={`truncate text-xs font-medium ${
                          rem.status === "completed"
                            ? "line-through text-[#667085]"
                            : "text-[#111827]"
                        }`}
                      >
                        {rem.title}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-[#667085]">
                        Due {formatDisplayDate(rem.due_date, settings.date_format)} ·{" "}
                        {rem.is_auto ? "Automatic" : "Custom"}
                      </p>
                    </div>
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-medium capitalize"
                      style={{
                        backgroundColor:
                          rem.status === "completed"
                            ? "#ECFDF3"
                            : rem.is_overdue
                              ? "#FEF0F0"
                              : "#EEF2FB",
                        color:
                          rem.status === "completed"
                            ? "#16A36A"
                            : rem.is_overdue
                              ? "#DC5252"
                              : "#243B64",
                      }}
                    >
                      {rem.is_overdue ? "Overdue" : rem.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete document?"
        description={`"${doc.name}" and any attached file or automatic reminders will be permanently deleted.`}
        confirmLabel="Delete document"
        loading={deleting}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
