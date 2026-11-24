"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/constants";
import type { ReminderItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";
import { ConfirmDialog } from "./ConfirmDialog";

export function RemindersClient({
  initialReminders,
  documents,
}: {
  initialReminders: ReminderItem[];
  documents: Array<{ id: string; name: string; category: string }>;
}) {
  const { settings, refreshHeaderState } = useWorkspace();
  const [reminders, setReminders] = useState<ReminderItem[]>(initialReminders);
  const [tab, setTab] = useState<
    "upcoming" | "overdue" | "snoozed" | "completed" | "all"
  >("upcoming");

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ReminderItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reloadReminders = useCallback(async () => {
    const res = await fetch("/api/reminders", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setReminders(data.reminders || []);
    }
    await refreshHeaderState();
  }, [refreshHeaderState]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          due_date: dueDate,
          document_id: documentId || null,
          priority,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create reminder.");
        return;
      }
      setTitle("");
      setDueDate("");
      setDocumentId("");
      setNotes("");
      setShowAdd(false);
      await reloadReminders();
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (
    id: string,
    action: "complete" | "reopen" | "snooze",
    days?: number
  ) => {
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, days }),
    });
    await reloadReminders();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/reminders/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await reloadReminders();
    } finally {
      setDeleting(false);
    }
  };

  const counts = {
    upcoming: reminders.filter((r) => r.status === "upcoming" && !r.is_overdue).length,
    overdue: reminders.filter((r) => r.is_overdue).length,
    snoozed: reminders.filter((r) => r.status === "snoozed").length,
    completed: reminders.filter((r) => r.status === "completed").length,
    all: reminders.length,
  };

  const visibleReminders = reminders.filter((r) => {
    if (tab === "upcoming") return r.status === "upcoming" && !r.is_overdue;
    if (tab === "overdue") return r.is_overdue;
    if (tab === "snoozed") return r.status === "snoozed";
    if (tab === "completed") return r.status === "completed";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
            Reminders
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Automatic expiry alerts plus custom renewal and warranty follow-ups.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
        >
          <Plus size={16} />
          New reminder
        </button>
      </div>

      {/* Add Reminder Form */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-[#111827]">
            Create custom reminder
          </h2>

          {error && (
            <div className="rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-3 py-2 text-xs text-[#DC5252]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Reminder title <span className="text-[#DC5252]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Renew health insurance before grace period"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Due date <span className="text-[#DC5252]">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm focus:border-[#4568C7] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "medium" | "high")
                }
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:border-[#4568C7] focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Linked document (optional)
              </label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:border-[#4568C7] focus:outline-none"
              >
                <option value="">Standalone reminder</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional details or claim contact info"
                className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm focus:border-[#4568C7] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="h-9 rounded-lg border border-[#E5E7EB] px-4 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-[#4568C7] px-4 text-xs font-semibold text-white hover:bg-[#3756AC]"
            >
              {saving ? "Saving..." : "Create reminder"}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E7EB] pb-3">
        {(
          [
            ["upcoming", "Upcoming"],
            ["overdue", "Overdue"],
            ["snoozed", "Snoozed"],
            ["completed", "Completed"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key
                ? "border-[#4568C7] bg-[#EEF2FB] text-[#243B64]"
                : "border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F7F8FC]"
            }`}
          >
            <span>{label}</span>
            <span className="rounded bg-white/80 px-1.5 py-0.2 text-[11px] tabular-nums text-[#111827]">
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Reminders List */}
      {visibleReminders.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <Clock size={24} className="mx-auto text-[#9CA3AF]" />
          <p className="mt-3 text-sm font-semibold text-[#111827]">
            No {tab === "all" ? "" : tab} reminders
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Reminders are generated automatically when you save documents with expiry
            dates, or you can create custom reminders anytime.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleReminders.map((rem) => (
            <div
              key={rem.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      rem.status === "completed"
                        ? "line-through text-[#667085]"
                        : "text-[#111827]"
                    }`}
                  >
                    {rem.title}
                  </p>
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-medium capitalize"
                    style={{
                      backgroundColor:
                        rem.priority === "high"
                          ? "#FEF0F0"
                          : rem.priority === "medium"
                            ? "#FEF6E7"
                            : "#F3F4F6",
                      color:
                        rem.priority === "high"
                          ? "#DC5252"
                          : rem.priority === "medium"
                            ? "#B87A14"
                            : "#667085",
                    }}
                  >
                    {rem.priority}
                  </span>
                  {rem.is_auto && (
                    <span className="rounded border border-[#E5E7EB] bg-[#F7F8FC] px-2 py-0.5 text-[11px] text-[#667085]">
                      Auto-expiry
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#667085]">
                  <span className="tabular-nums">
                    Due: {formatDisplayDate(rem.due_date, settings.date_format)}
                    {rem.is_overdue
                      ? ` (${Math.abs(rem.days_until_due)}d overdue)`
                      : rem.status === "upcoming"
                        ? rem.days_until_due === 0
                          ? " (Today)"
                          : ` (in ${rem.days_until_due}d)`
                        : ""}
                  </span>

                  {rem.document_id && rem.document_name && (
                    <Link
                      href={`/documents/${rem.document_id}`}
                      className="inline-flex items-center gap-1 font-medium text-[#4568C7] hover:underline"
                    >
                      <FileText size={12} />
                      {rem.document_name}
                    </Link>
                  )}
                </div>

                {rem.notes && (
                  <p className="text-xs text-[#667085]">{rem.notes}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {rem.status !== "completed" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(rem.id, "complete")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CBEFD9] bg-[#ECFDF3] px-3 text-xs font-medium text-[#16A36A] hover:bg-[#DCFCE7]"
                    >
                      <CheckCircle2 size={14} />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(rem.id, "snooze", 7)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
                    >
                      <AlarmClock size={14} />
                      Snooze 7d
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction(rem.id, "reopen")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
                  >
                    <RotateCcw size={13} />
                    Reopen
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteTarget(rem)}
                  aria-label="Delete reminder"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#667085] hover:bg-[#FEF0F0] hover:text-[#DC5252]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete reminder?"
        description={`Are you sure you want to remove "${deleteTarget?.title || ""}"?`}
        confirmLabel="Delete reminder"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
