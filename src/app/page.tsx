import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileSearch,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { CategoryIcon } from "@/components/CategoryIcon";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#111827]">
      {/* Top Bar */}
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#243B64] text-white">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            </div>
            <span className="font-display text-base font-bold tracking-tight text-[#111827]">
              DocuMind
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#243B64] px-4 text-sm font-medium text-white hover:bg-[#1C2F50]"
            >
              Get started
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#243B64]">
              <ShieldCheck size={14} className="text-[#4568C7]" />
              <span>Personal Document Intelligence</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-[#111827] sm:text-5xl sm:leading-[1.12]">
              Your documents, understood and organised.
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[#667085] sm:text-lg">
              Store warranties, insurance policies, gift cards, invoices, receipts, and
              agreements in one private workspace. Extract key dates automatically,
              never miss an expiry, and ask questions across everything you own.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4568C7] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3756AC]"
              >
                Create your workspace
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-5 text-sm font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
              >
                Sign in to existing account
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs text-[#667085]">
                <CheckCircle2 size={15} className="shrink-0 text-[#16A36A]" />
                <span>PDF & image text extraction</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#667085]">
                <CheckCircle2 size={15} className="shrink-0 text-[#16A36A]" />
                <span>Automated expiry reminders</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#667085]">
                <CheckCircle2 size={15} className="shrink-0 text-[#16A36A]" />
                <span>Grounded AI document Q&A</span>
              </div>
            </div>
          </div>

          {/* Right structured capabilities surface */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
                  Workspace Capabilities
                </span>
                <Lock size={14} className="text-[#667085]" />
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3.5">
                  <FileSearch size={18} className="mt-0.5 shrink-0 text-[#4568C7]" />
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      Intelligent field extraction
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#667085]">
                      Upload PDFs or photos of receipts and policies to detect issuers,
                      purchase dates, warranty terms, policy numbers, and totals.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3.5">
                  <CalendarClock size={18} className="mt-0.5 shrink-0 text-[#E6A23C]" />
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      Expiry calendar & reminders
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#667085]">
                      Track upcoming warranty expirations, insurance renewals, and voucher
                      deadlines on one timeline with configurable alerts.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3.5">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-[#8B7AE8]" />
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">
                      AI document assistant
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[#667085]">
                      Ask natural questions across your saved records and receive cited
                      answers grounded strictly in your uploaded documents.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Supported Categories */}
        <section className="mt-14 border-t border-[#E5E7EB] pt-10">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-[#111827]">
              Designed for every personal record
            </h2>
            <p className="mt-1 text-sm text-[#667085]">
              Eight structured document categories built for everyday households and
              professionals.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DOCUMENT_CATEGORIES.map((category) => (
              <div
                key={category}
                className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3.5"
              >
                <CategoryIcon category={category} size={16} withTile />
                <span className="text-sm font-medium text-[#111827]">{category}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
