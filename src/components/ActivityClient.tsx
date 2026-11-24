"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  FileText,
  History,
  Search,
  Settings,
  Shield,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { formatDisplayDate } from "@/lib/constants";
import type { ActivityItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";

const ACTION_LABELS: Record<string, string> = {
  "document.uploaded": "Uploaded document",
  "document.created": "Added document manually",
  "document.updated": "Updated document",
  "document.deleted": "Deleted document",
  "document.processed": "Extracted document text",
  "reminder.created": "Created reminder",
  "reminder.completed": "Completed reminder",
  "reminder.snoozed": "Snoozed reminder",
  "reminder.deleted": "Deleted reminder",
  "ai.message": "Asked AI Assistant",
  "settings.updated": "Updated settings",
  "profile.updated": "Updated profile",
  "auth.registered": "Created account",
  "auth.login": "Signed in",
};

function EntityIcon({ entityType }: { entityType: string }) {
  switch (entityType) {
    case "document":
      return <FileText size={15} className="text-[#4568C7]" />;
    case "reminder":
      return <Clock size={15} className="text-[#E6A23C]" />;
    case "conversation":
      return <Sparkles size={15} className="text-[#8B7AE8]" />;
    case "settings":
      return <Settings size={15} className="text-[#667085]" />;
    case "profile":
      return <UserIcon size={15} className="text-[#243B64]" />;
    default:
      return <Shield size={15} className="text-[#16A36A]" />;
  }
}

export function ActivityClient({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const { settings } = useWorkspace();
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialActivities.filter((a) => {
      if (typeFilter !== "all" && a.entity_type !== typeFilter) return false;
      if (q) {
        const hay = `${a.action} ${a.entity_name || ""} ${a.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialActivities, typeFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
          Activity History
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Chronological audit log of document uploads, edits, reminders, AI queries,
          and account updates.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-2.5 text-[#667085]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter activity by document, action, or details..."
            className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] pl-9 pr-3 text-sm text-[#111827] focus:border-[#4568C7] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter activity by type"
          className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827]"
        >
          <option value="all">All events</option>
          <option value="document">Documents</option>
          <option value="reminder">Reminders</option>
          <option value="conversation">AI Assistant</option>
          <option value="settings">Settings</option>
          <option value="profile">Profile</option>
          <option value="auth">Authentication</option>
        </select>
      </div>

      {/* Activity Feed */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <History size={24} className="mx-auto text-[#9CA3AF]" />
          <p className="mt-3 text-sm font-semibold text-[#111827]">
            No matching activity events
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          {filtered.map((item) => {
            const label = ACTION_LABELS[item.action] || item.action;
            const timePart = new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F7F8FC]">
                    <EntityIcon entityType={item.entity_type} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111827]">
                      {label}
                      {item.entity_name && (
                        <>
                          {" · "}
                          {item.entity_type === "document" &&
                          item.entity_id &&
                          item.action !== "document.deleted" ? (
                            <Link
                              href={`/documents/${item.entity_id}`}
                              className="text-[#4568C7] hover:underline"
                            >
                              {item.entity_name}
                            </Link>
                          ) : (
                            <span className="text-[#243B64]">{item.entity_name}</span>
                          )}
                        </>
                      )}
                    </p>
                    {item.details && (
                      <p className="mt-0.5 text-xs text-[#667085]">{item.details}</p>
                    )}
                  </div>
                </div>

                <span className="shrink-0 pl-11 text-xs tabular-nums text-[#667085] sm:pl-0">
                  {formatDisplayDate(item.created_at, settings.date_format)} · {timePart}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
