import { NextResponse } from "next/server";
import { ensureUserSettings, getCurrentUser, logActivity } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  type DateFormatOption,
} from "@/lib/constants";
import { listUserDocuments, syncDocumentAutoReminders } from "@/lib/documents";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ settings: ensureUserSettings(user.id) });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const current = ensureUserSettings(user.id);
    const body = await request.json();

    const currencyCodes: string[] = SUPPORTED_CURRENCIES.map((c) => c.code);
    const currency =
      body?.currency && currencyCodes.includes(String(body.currency))
        ? String(body.currency)
        : current.currency;

    const dateFormat: DateFormatOption =
      body?.date_format &&
      (SUPPORTED_DATE_FORMATS as readonly string[]).includes(String(body.date_format))
        ? (String(body.date_format) as DateFormatOption)
        : current.date_format;

    const expiringSoonDays =
      body?.expiring_soon_days !== undefined
        ? Math.max(1, Math.min(365, Number(body.expiring_soon_days) || 30))
        : current.expiring_soon_days;

    const autoCreateReminders =
      body?.auto_create_reminders !== undefined
        ? Boolean(body.auto_create_reminders)
        : current.auto_create_reminders;

    let defaultReminderDays = current.default_reminder_days;
    if (Array.isArray(body?.default_reminder_days)) {
      const cleaned = Array.from(
        new Set<number>(
          body.default_reminder_days
            .map((n: unknown) => Number(n))
            .filter((n: number) => Number.isFinite(n) && n >= 0 && n <= 365)
        )
      ).sort((a, b) => b - a);
      if (cleaned.length > 0) defaultReminderDays = cleaned;
    }

    const autoExtractOnUpload =
      body?.auto_extract_on_upload !== undefined
        ? Boolean(body.auto_extract_on_upload)
        : current.auto_extract_on_upload;

    const sidebarCollapsed =
      body?.sidebar_collapsed !== undefined
        ? Boolean(body.sidebar_collapsed)
        : current.sidebar_collapsed;

    const inAppNotifications =
      body?.in_app_notifications !== undefined
        ? Boolean(body.in_app_notifications)
        : current.in_app_notifications;

    const aiProvider =
      body?.ai_provider && ["local", "openai", "gemini"].includes(String(body.ai_provider))
        ? String(body.ai_provider)
        : current.ai_provider;

    const aiModel =
      body?.ai_model !== undefined ? String(body.ai_model).trim().slice(0, 80) : current.ai_model;

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE user_settings SET
        currency = ?,
        date_format = ?,
        expiring_soon_days = ?,
        auto_create_reminders = ?,
        default_reminder_days = ?,
        auto_extract_on_upload = ?,
        sidebar_collapsed = ?,
        in_app_notifications = ?,
        ai_provider = ?,
        ai_model = ?,
        updated_at = ?
       WHERE user_id = ?`
    ).run(
      currency,
      dateFormat,
      expiringSoonDays,
      autoCreateReminders ? 1 : 0,
      JSON.stringify(defaultReminderDays),
      autoExtractOnUpload ? 1 : 0,
      sidebarCollapsed ? 1 : 0,
      inAppNotifications ? 1 : 0,
      aiProvider,
      aiModel,
      now,
      user.id
    );

    if (body?.ai_api_key !== undefined) {
      const keyVal = String(body.ai_api_key).trim();
      const encrypted = keyVal ? encryptSecret(keyVal) : null;
      db.prepare("UPDATE user_settings SET ai_api_key_enc = ? WHERE user_id = ?").run(
        encrypted,
        user.id
      );
    }

    // Only log and re-sync reminders when user updates functional settings (not just sidebar toggle)
    const keysChanged = Object.keys(body || {});
    const isOnlySidebar =
      keysChanged.length === 1 && keysChanged[0] === "sidebar_collapsed";

    if (!isOnlySidebar) {
      if (
        body?.auto_create_reminders !== undefined ||
        body?.default_reminder_days !== undefined ||
        body?.expiring_soon_days !== undefined
      ) {
        const docs = listUserDocuments(user.id);
        for (const doc of docs) {
          syncDocumentAutoReminders(user.id, doc.id, doc.name, doc.expiry_date);
        }
      }

      logActivity({
        userId: user.id,
        action: "settings.updated",
        entityType: "settings",
        entityId: user.id,
        entityName: "Workspace Settings",
        details: `Updated workspace preferences`,
      });
    }

    return NextResponse.json({ settings: ensureUserSettings(user.id) });
  } catch {
    return NextResponse.json(
      { error: "Failed to save settings." },
      { status: 500 }
    );
  }
}
