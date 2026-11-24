"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  formatCurrency,
  formatDisplayDate,
  getTodayIso,
} from "@/lib/constants";
import type { DocumentItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function CalendarClient({
  initialDocuments,
}: {
  initialDocuments: DocumentItem[];
}) {
  const { settings, openCreateModal } = useWorkspace();
  const todayIso = getTodayIso();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  const filteredDocs = useMemo(
    () =>
      initialDocuments.filter((d) =>
        categoryFilter === "all" ? true : d.category === categoryFilter
      ),
    [initialDocuments, categoryFilter]
  );

  const docsByDate = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const d of filteredDocs) {
      if (!d.expiry_date) continue;
      const key = d.expiry_date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [filteredDocs]);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDocs = useMemo(
    () =>
      filteredDocs
        .filter((d) => d.expiry_date?.startsWith(monthPrefix))
        .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || "")),
    [filteredDocs, monthPrefix]
  );

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ day: null, iso: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, iso });
    }
    return cells;
  }, [year, month]);

  const goPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const selectedDayDocs = docsByDate.get(selectedDate) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
            Expiry Calendar
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Track warranty expirations, policy renewals, and gift card deadlines by
            month.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export?format=ics"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Download size={14} />
            Export .ics
          </a>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
          >
            <Plus size={16} />
            Add document
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#111827] hover:bg-[#F7F8FC]"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="min-w-[150px] text-center font-display text-base font-semibold text-[#111827]">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#111827] hover:bg-[#F7F8FC]"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              setYear(t.getFullYear());
              setMonth(t.getMonth());
              setSelectedDate(todayIso);
            }}
            className="ml-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-[#4568C7] hover:bg-[#EEF2FB]"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[#667085]">
            {monthDocs.length} expiring in {MONTH_NAMES[month]}
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter calendar by category"
            className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-medium text-[#111827]"
          >
            <option value="all">All categories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar + Agenda Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white lg:col-span-8">
          <div className="grid grid-cols-7 border-b border-[#E5E7EB] bg-[#F7F8FC]">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#667085]"
              >
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.iso) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[58px] border-b border-r border-[#E5E7EB] bg-[#FAFBFD] sm:min-h-[88px]"
                  />
                );
              }
              const items = docsByDate.get(cell.iso) || [];
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedDate;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelectedDate(cell.iso!)}
                  className={`flex min-h-[58px] flex-col justify-between border-b border-r border-[#E5E7EB] p-1.5 text-left transition-colors sm:min-h-[88px] sm:p-2 ${
                    isSelected
                      ? "bg-[#EEF2FB]/75 ring-1 ring-inset ring-[#4568C7]"
                      : "hover:bg-[#F7F8FC]"
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                      isToday
                        ? "bg-[#243B64] text-white"
                        : "text-[#111827]"
                    }`}
                  >
                    {cell.day}
                  </span>

                  {items.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {/* Dots on mobile */}
                      <div className="flex flex-wrap gap-1 sm:hidden">
                        {items.slice(0, 3).map((d) => (
                          <span
                            key={d.id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                d.expiry_status === "expired"
                                  ? "#DC5252"
                                  : d.expiry_status === "expiring_soon"
                                    ? "#E6A23C"
                                    : "#16A36A",
                            }}
                          />
                        ))}
                      </div>
                      {/* Labels on sm+ */}
                      <div className="hidden sm:block space-y-1">
                        {items.slice(0, 2).map((d) => (
                          <div
                            key={d.id}
                            className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor:
                                d.expiry_status === "expired"
                                  ? "#FEF0F0"
                                  : d.expiry_status === "expiring_soon"
                                    ? "#FEF6E7"
                                    : "#ECFDF3",
                              color:
                                d.expiry_status === "expired"
                                  ? "#DC5252"
                                  : d.expiry_status === "expiring_soon"
                                    ? "#B87A14"
                                    : "#16A36A",
                            }}
                          >
                            {d.name}
                          </div>
                        ))}
                        {items.length > 2 && (
                          <p className="text-[10px] font-medium text-[#667085]">
                            +{items.length - 2} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day + Month Agenda */}
        <div className="space-y-6 lg:col-span-4">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
              <CalendarIcon size={16} className="text-[#4568C7]" />
              <h3 className="text-sm font-semibold text-[#111827]">
                {formatDisplayDate(selectedDate, settings.date_format)}
              </h3>
            </div>

            <div className="mt-3 space-y-2.5">
              {selectedDayDocs.length === 0 ? (
                <p className="py-4 text-xs text-[#667085]">
                  No documents expiring on this date.
                </p>
              ) : (
                selectedDayDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="block rounded-lg border border-[#E5E7EB] p-3 hover:border-[#4568C7]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon category={doc.category} size={14} withTile />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#111827]">
                            {doc.name}
                          </p>
                          <p className="truncate text-[11px] text-[#667085]">
                            {doc.issuer || doc.category}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={doc.expiry_status} compact />
                    </div>
                    {doc.amount !== null && (
                      <p className="mt-2 text-xs font-medium tabular-nums text-[#111827]">
                        Value: {formatCurrency(doc.amount, doc.currency)}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <h3 className="border-b border-[#E5E7EB] pb-3 text-sm font-semibold text-[#111827]">
              {MONTH_NAMES[month]} expirations ({monthDocs.length})
            </h3>
            <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
              {monthDocs.length === 0 ? (
                <p className="py-4 text-xs text-[#667085]">
                  No expirations scheduled in {MONTH_NAMES[month]}.
                </p>
              ) : (
                monthDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 hover:bg-[#F7F8FC]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#111827]">
                        {doc.name}
                      </p>
                      <p className="text-[11px] tabular-nums text-[#667085]">
                        {formatDisplayDate(doc.expiry_date, settings.date_format)}
                      </p>
                    </div>
                    <StatusBadge status={doc.expiry_status} compact />
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
