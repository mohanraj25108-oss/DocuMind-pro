"use client";

import { useState } from "react";
import { Check, Download, Loader2, Sparkles } from "lucide-react";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  type DateFormatOption,
} from "@/lib/constants";
import type { UserSettingsRecord } from "@/lib/auth";
import { useWorkspace } from "./AppShell";

const LEAD_DAY_OPTIONS = [60, 30, 14, 7, 3, 1, 0];

export function SettingsClient({
  initialSettings,
}: {
  initialSettings: UserSettingsRecord;
}) {
  const { updateLocalSettings, refreshHeaderState } = useWorkspace();

  const [currency, setCurrency] = useState(initialSettings.currency);
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(
    initialSettings.date_format
  );
  const [expiringSoonDays, setExpiringSoonDays] = useState(
    initialSettings.expiring_soon_days
  );
  const [autoCreateReminders, setAutoCreateReminders] = useState(
    initialSettings.auto_create_reminders
  );
  const [leadDays, setLeadDays] = useState<number[]>(
    initialSettings.default_reminder_days
  );
  const [autoExtractOnUpload, setAutoExtractOnUpload] = useState(
    initialSettings.auto_extract_on_upload
  );
  const [inAppNotifications, setInAppNotifications] = useState(
    initialSettings.in_app_notifications
  );
  const [aiProvider, setAiProvider] = useState<"local" | "openai" | "gemini">(
    initialSettings.ai_provider
  );
  const [aiModel, setAiModel] = useState(initialSettings.ai_model);
  const [aiApiKey, setAiApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initialSettings.has_ai_api_key);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  const toggleLeadDay = (day: number) => {
    if (leadDays.includes(day)) {
      if (leadDays.length === 1) return;
      setLeadDays(leadDays.filter((d) => d !== day));
    } else {
      setLeadDays([...leadDays, day].sort((a, b) => b - a));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    setError("");

    try {
      const payload: Record<string, unknown> = {
        currency,
        date_format: dateFormat,
        expiring_soon_days: expiringSoonDays,
        auto_create_reminders: autoCreateReminders,
        default_reminder_days: leadDays,
        auto_extract_on_upload: autoExtractOnUpload,
        in_app_notifications: inAppNotifications,
        ai_provider: aiProvider,
        ai_model: aiModel,
      };
      if (aiApiKey.trim()) {
        payload.ai_api_key = aiApiKey.trim();
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save settings.");
        return;
      }

      updateLocalSettings(data.settings);
      setHasKey(Boolean(data.settings?.has_ai_api_key));
      setAiApiKey("");
      setSavedMsg("Settings saved and reminder schedules updated.");
      await refreshHeaderState();
    } catch {
      setError("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Configure regional formatting, expiry alert rules, document extraction, and AI
          assistant providers.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-[#F7CACA] bg-[#FEF0F0] px-4 py-3 text-xs font-medium text-[#DC5252]">
            {error}
          </div>
        )}
        {savedMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-[#CBEFD9] bg-[#ECFDF3] px-4 py-3 text-xs font-medium text-[#16A36A]">
            <Check size={15} />
            {savedMsg}
          </div>
        )}

        {/* Regional Preferences */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#111827]">
            Display &amp; Regional Preferences
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Default currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                Date format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatOption)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                {SUPPORTED_DATE_FORMATS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Expiry & Reminder Rules */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#111827]">
            Expiry Threshold &amp; Reminder Automation
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                &ldquo;Expiring soon&rdquo; window (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiringSoonDays}
                onChange={(e) =>
                  setExpiringSoonDays(Math.max(1, Number(e.target.value) || 30))
                }
                className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm tabular-nums text-[#111827]"
              />
              <p className="mt-1 text-[11px] text-[#667085]">
                Documents expiring within this window appear in Dashboard &amp; alerts.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-medium text-[#111827]">
                  Auto-create reminders on expiry dates
                </span>
                <input
                  type="checkbox"
                  checked={autoCreateReminders}
                  onChange={(e) => setAutoCreateReminders(e.target.checked)}
                  className="h-4 w-4 accent-[#4568C7]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-medium text-[#111827]">
                  In-app expiry notifications
                </span>
                <input
                  type="checkbox"
                  checked={inAppNotifications}
                  onChange={(e) => setInAppNotifications(e.target.checked)}
                  className="h-4 w-4 accent-[#4568C7]"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[#111827]">
              Automatic reminder lead times (days before expiry)
            </p>
            <div className="flex flex-wrap gap-2">
              {LEAD_DAY_OPTIONS.map((d) => {
                const selected = leadDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleLeadDay(d)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-[#4568C7] bg-[#EEF2FB] text-[#243B64]"
                        : "border-[#E5E7EB] bg-white text-[#667085] hover:bg-[#F7F8FC]"
                    }`}
                  >
                    {d === 0 ? "Day of expiry" : `${d} day${d === 1 ? "" : "s"} before`}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* AI & Document Extraction */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#8B7AE8]" />
            <h2 className="text-sm font-semibold text-[#111827]">
              Document Processing &amp; AI Provider
            </h2>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-xs font-medium text-[#111827]">
                Automatically extract PDF/image text &amp; metadata on upload
              </p>
              <p className="text-[11px] text-[#667085]">
                Pre-fills category, issuer, dates, policy number, and totals during upload.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoExtractOnUpload}
              onChange={(e) => setAutoExtractOnUpload(e.target.checked)}
              className="h-4 w-4 accent-[#4568C7]"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 border-t border-[#E5E7EB] pt-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                AI Assistant engine
              </label>
              <select
                value={aiProvider}
                onChange={(e) =>
                  setAiProvider(e.target.value as "local" | "openai" | "gemini")
                }
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                <option value="local">DocuMind Local Engine (Built-in)</option>
                <option value="openai">OpenAI (API Key)</option>
                <option value="gemini">Google Gemini (API Key)</option>
              </select>
            </div>

            {aiProvider !== "local" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                    Model override (optional)
                  </label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder={
                      aiProvider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash"
                    }
                    className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#111827]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-[#111827]">
                    {aiProvider === "openai" ? "OpenAI API Key" : "Gemini API Key"}
                  </label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={
                      hasKey
                        ? "Encrypted key saved — enter a new key to replace"
                        : "Paste API key (encrypted at rest)"
                    }
                    className="h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm text-[#111827]"
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Data Portability */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111827]">
            Data Backup &amp; Portability
          </h2>
          <p className="mt-1 text-xs text-[#667085]">
            Download your structured document metadata, reminders, or calendar feed
            anytime.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href="/api/export?format=json"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
            >
              <Download size={14} />
              Download JSON backup
            </a>
            <a
              href="/api/export?format=ics"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-xs font-medium text-[#111827] hover:bg-[#F7F8FC]"
            >
              <Download size={14} />
              Download .ics Expiry Calendar
            </a>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#243B64] px-5 text-sm font-semibold text-white hover:bg-[#1C2F50] disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Save preferences
          </button>
        </div>
      </form>
    </div>
  );
}
