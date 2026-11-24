"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Clock,
  FilePlus2,
  FileText,
  FolderOpen,
  History,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useWorkspace } from "./AppShell";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";
import {
  formatCurrency,
  formatDisplayDate,
  formatRelativeDays,
} from "@/lib/constants";
import type { getDashboardData } from "@/lib/documents";

type DashboardData = ReturnType<typeof getDashboardData>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    "document.uploaded": "Uploaded document",
    "document.created": "Added document",
    "document.updated": "Updated document",
    "document.deleted": "Deleted document",
    "document.processed": "Processed document text",
    "reminder.created": "Created reminder",
    "reminder.completed": "Completed reminder",
    "reminder.snoozed": "Snoozed reminder",
    "reminder.deleted": "Deleted reminder",
    "ai.message": "AI Assistant query",
    "settings.updated": "Updated settings",
    "profile.updated": "Updated profile",
    "auth.registered": "Account created",
    "auth.login": "Signed in",
  };
  return map[action] || action;
}

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const { user, settings, openCreateModal } = useWorkspace();
  const [data, setData] = useState<DashboardData>(initialData);

  const reloadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      reloadDashboard();
    };
    window.addEventListener("documind:document-changed", handler);
    return () => window.removeEventListener("documind:document-changed", handler);
  }, [reloadDashboard]);

  const firstName = user.name.split(/\s+/)[0] || user.name;
  const nonEmptyCategories = data.categoryDistribution.filter((c) => c.count > 0);
  const totalDistCount = nonEmptyCategories.reduce((acc, c) => acc + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Personalised Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827] sm:text-[26px]">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            {data.totalDocuments === 0
              ? "Your document workspace is ready. Upload your first record to start tracking expirations and insights."
              : `Tracking ${data.totalDocuments} document${data.totalDocuments === 1 ? "" : "s"} across ${nonEmptyCategories.length} categor${nonEmptyCategories.length === 1 ? "y" : "ies"}${
                  data.upcomingExpirations > 0
                    ? ` · ${data.upcomingExpirations} expiring within ${settings.expiring_soon_days} days`
                    : ""
                }.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/assistant"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Sparkles size={15} className="text-[#8B7AE8]" />
            Ask AI Assistant
          </Link>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
          >
            <Plus size={16} />
            Upload document
          </button>
        </div>
      </div>

      {/* Empty State for New Accounts */}
      {data.totalDocuments === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 sm:p-10">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8FC] text-[#4568C7]">
              <FilePlus2 size={22} />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-[#111827]">
              Upload your first document
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#667085]">
              Add a warranty card, insurance policy, receipt, gift card, or agreement.
              DocuMind extracts key dates, reference numbers, and totals automatically
              from PDFs and images.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4568C7] px-5 text-sm font-semibold text-white hover:bg-[#3756AC]"
              >
                <Plus size={16} />
                Upload PDF or Image
              </button>
              <Link
                href="/documents"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
              >
                Go to My Documents
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Core Metric Cards (Always calculated strictly from real DB records) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/documents"
          className="group rounded-xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#C7D2FE]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#667085]">Total documents</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FB] text-[#4568C7]">
              <FileText size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {data.totalDocuments}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            {nonEmptyCategories.length} active categor{nonEmptyCategories.length === 1 ? "y" : "ies"}
          </p>
        </Link>

        <Link
          href="/documents?category=Warranty+cards"
          className="group rounded-xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#C7D2FE]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#667085]">Active warranties</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#16A36A]">
              <ShieldCheck size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {data.activeWarranties}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Covered &amp; non-expired items
          </p>
        </Link>

        <Link
          href="/documents?expiryStatus=expiring_soon"
          className="group rounded-xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#F8DFB1]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#667085]">
              Upcoming expirations
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF6E7] text-[#E6A23C]">
              <CalendarClock size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {data.upcomingExpirations}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Within next {settings.expiring_soon_days} days
          </p>
        </Link>

        <Link
          href="/documents?expiryStatus=expired"
          className="group rounded-xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#F7CACA]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#667085]">Expired documents</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF0F0] text-[#DC5252]">
              <AlertCircle size={16} />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums text-[#111827]">
            {data.expiredDocuments}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Needs renewal or archival
          </p>
        </Link>
      </div>

      {/* Main Content Grid */}
      {data.totalDocuments > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 columns: Recently Uploaded + Upcoming Expiry Timeline */}
          <div className="space-y-6 lg:col-span-7">
            {/* Upcoming Expiry Timeline */}
            <section className="rounded-xl border border-[#E5E7EB] bg-white">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#4568C7]" />
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Upcoming expiry timeline
                  </h2>
                </div>
                <Link
                  href="/calendar"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4568C7] hover:underline"
                >
                  Open calendar
                  <ArrowRight size={13} />
                </Link>
              </div>

              {data.upcomingTimeline.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-[#667085]">
                  No documents with expiry dates yet. Add an expiry date to track
                  renewals here.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {data.upcomingTimeline.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#F7F8FC]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon category={doc.category} size={15} withTile />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#111827]">
                            {doc.name}
                          </p>
                          <p className="truncate text-xs text-[#667085]">
                            {doc.category}
                            {doc.issuer ? ` · ${doc.issuer}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge
                          status={doc.expiry_status}
                          daysUntilExpiry={doc.days_until_expiry}
                          compact
                        />
                        <span className="text-[11px] tabular-nums text-[#667085]">
                          {formatDisplayDate(doc.expiry_date, settings.date_format)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Recently Uploaded Documents */}
            <section className="rounded-xl border border-[#E5E7EB] bg-white">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#243B64]" />
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Recently uploaded documents
                  </h2>
                </div>
                <Link
                  href="/documents"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4568C7] hover:underline"
                >
                  View all
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="divide-y divide-[#E5E7EB]">
                {data.recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#F7F8FC]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={doc.category} size={15} withTile />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#111827]">
                          {doc.name}
                        </p>
                        <p className="truncate text-xs text-[#667085]">
                          {doc.issuer || doc.category} · Added{" "}
                          {formatDisplayDate(doc.created_at, settings.date_format)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {doc.amount !== null && (
                        <span className="hidden text-xs font-medium tabular-nums text-[#111827] sm:inline">
                          {formatCurrency(doc.amount, doc.currency)}
                        </span>
                      )}
                      <StatusBadge
                        status={doc.expiry_status}
                        daysUntilExpiry={doc.days_until_expiry}
                        compact
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Right 5 columns: Category Distribution + Recent Activity */}
          <div className="space-y-6 lg:col-span-5">
            {/* Category Distribution */}
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-[#4568C7]" />
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Category distribution
                  </h2>
                </div>
                <Link
                  href="/categories"
                  className="text-xs font-medium text-[#4568C7] hover:underline"
                >
                  Details
                </Link>
              </div>

              {/* Segmented distribution bar */}
              {totalDistCount > 0 && (
                <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                  {nonEmptyCategories.map((cat) => (
                    <div
                      key={cat.category}
                      title={`${cat.category}: ${cat.count}`}
                      style={{
                        width: `${(cat.count / totalDistCount) * 100}%`,
                        backgroundColor: cat.accentColor,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2.5">
                {nonEmptyCategories.map((cat) => {
                  const pct =
                    totalDistCount > 0
                      ? Math.round((cat.count / totalDistCount) * 100)
                      : 0;
                  return (
                    <Link
                      key={cat.category}
                      href={`/documents?category=${encodeURIComponent(cat.category)}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#F7F8FC]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: cat.accentColor }}
                        />
                        <span className="truncate text-xs font-medium text-[#111827]">
                          {cat.category}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5 text-xs tabular-nums">
                        {cat.totalValue > 0 && (
                          <span className="text-[#667085]">
                            {formatCurrency(cat.totalValue, settings.currency)}
                          </span>
                        )}
                        <span className="font-semibold text-[#111827]">
                          {cat.count}
                        </span>
                        <span className="w-8 text-right text-[#667085]">{pct}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Recent Activity */}
            <section className="rounded-xl border border-[#E5E7EB] bg-white">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#667085]" />
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Recent activity
                  </h2>
                </div>
                <Link
                  href="/activity"
                  className="text-xs font-medium text-[#4568C7] hover:underline"
                >
                  Full log
                </Link>
              </div>

              {data.recentActivity.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-[#667085]">
                  No activity recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {data.recentActivity.map((act) => (
                    <div key={act.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#111827]">
                          {formatActionLabel(act.action)}
                          {act.entity_name ? (
                            <span className="text-[#4568C7]"> · {act.entity_name}</span>
                          ) : null}
                        </p>
                        <span className="shrink-0 text-[11px] tabular-nums text-[#667085]">
                          {formatDisplayDate(act.created_at, settings.date_format)}
                        </span>
                      </div>
                      {act.details && (
                        <p className="mt-0.5 truncate text-xs text-[#667085]">
                          {act.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Subtle footer helper when documents = 0 but user has account activity */}
      {data.totalDocuments === 0 && data.recentActivity.length > 0 && (
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <h2 className="text-sm font-semibold text-[#111827]">Recent activity</h2>
            <span className="text-xs text-[#667085]">
              {formatRelativeDays(0) ? "Live audit trail" : ""}
            </span>
          </div>
          <div className="mt-3 divide-y divide-[#E5E7EB]">
            {data.recentActivity.slice(0, 4).map((act) => (
              <div key={act.id} className="flex items-center justify-between py-2.5 text-xs">
                <span className="text-[#111827]">
                  {formatActionLabel(act.action)}
                  {act.details ? ` — ${act.details}` : ""}
                </span>
                <span className="tabular-nums text-[#667085]">
                  {formatDisplayDate(act.created_at, settings.date_format)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
