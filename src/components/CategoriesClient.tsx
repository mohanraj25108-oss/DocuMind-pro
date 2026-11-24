"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { CATEGORY_META, formatCurrency, type DocumentCategory } from "@/lib/constants";
import type { DocumentItem } from "@/lib/documents";
import { useWorkspace } from "./AppShell";
import { CategoryIcon } from "./CategoryIcon";

interface CategoryStat {
  category: DocumentCategory;
  shortLabel: string;
  accentColor: string;
  count: number;
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  totalValue: number;
  latestDoc: DocumentItem | null;
}

export function CategoriesClient({
  categories,
}: {
  categories: CategoryStat[];
}) {
  const { settings, openCreateModal } = useWorkspace();
  const totalDocs = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
            Categories
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Organised across 8 structured document types ({totalDocs} total record
            {totalDocs === 1 ? "" : "s"}).
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
        >
          <Plus size={16} />
          Add document
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat.category];
          return (
            <div
              key={cat.category}
              className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <CategoryIcon category={cat.category} size={18} withTile />
                  <span className="font-display text-2xl font-bold tabular-nums text-[#111827]">
                    {cat.count}
                  </span>
                </div>

                <h2 className="mt-4 text-sm font-semibold text-[#111827]">
                  {cat.category}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#667085]">
                  {meta.description}
                </p>

                {cat.count > 0 && (
                  <div className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-3 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {cat.activeCount > 0 && (
                        <span className="rounded bg-[#ECFDF3] px-2 py-0.5 font-medium text-[#16A36A]">
                          {cat.activeCount} active
                        </span>
                      )}
                      {cat.expiringCount > 0 && (
                        <span className="rounded bg-[#FEF6E7] px-2 py-0.5 font-medium text-[#B87A14]">
                          {cat.expiringCount} expiring soon
                        </span>
                      )}
                      {cat.expiredCount > 0 && (
                        <span className="rounded bg-[#FEF0F0] px-2 py-0.5 font-medium text-[#DC5252]">
                          {cat.expiredCount} expired
                        </span>
                      )}
                    </div>

                    {cat.totalValue > 0 && (
                      <p className="font-medium tabular-nums text-[#111827]">
                        Tracked value:{" "}
                        {formatCurrency(cat.totalValue, settings.currency)}
                      </p>
                    )}

                    {cat.latestDoc && (
                      <Link
                        href={`/documents/${cat.latestDoc.id}`}
                        className="block truncate text-[#4568C7] hover:underline"
                      >
                        Latest: {cat.latestDoc.name}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                <Link
                  href={`/documents?category=${encodeURIComponent(cat.category)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#4568C7] hover:underline"
                >
                  View documents
                  <ArrowRight size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => openCreateModal(cat.category)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
