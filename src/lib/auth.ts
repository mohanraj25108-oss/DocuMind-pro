import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import {
  generateSessionToken,
  hashSessionToken,
  signValue,
  verifySignedValue,
} from "./crypto";
import type { DateFormatOption } from "./constants";

export const SESSION_COOKIE_NAME = "documind_session";
const SESSION_TTL_DAYS = 30;

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  avatar_color: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsRecord {
  user_id: string;
  currency: string;
  date_format: DateFormatOption;
  expiring_soon_days: number;
  auto_create_reminders: boolean;
  default_reminder_days: number[];
  auto_extract_on_upload: boolean;
  sidebar_collapsed: boolean;
  in_app_notifications: boolean;
  ai_provider: "local" | "openai" | "gemini";
  has_ai_api_key: boolean;
  ai_model: string;
  updated_at: string;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);
  const hdrs = await headers();
  const ua = hdrs.get("user-agent") || "";

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    userId,
    tokenHash,
    ua.slice(0, 250),
    expires.toISOString(),
    now.toISOString()
  );

  const signed = signValue(token);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "1",
  });
  return token;
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!rawCookie) return null;

    const token = verifySignedValue(rawCookie);
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const db = getDb();
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.avatar_color, u.timezone, u.created_at, u.updated_at, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as
      | (UserRecord & { expires_at: string })
      | undefined;

    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
      return null;
    }

    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      avatar_color: String(row.avatar_color),
      timezone: String(row.timezone),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawCookie) {
    const token = verifySignedValue(rawCookie);
    if (token) {
      const db = getDb();
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function ensureUserSettings(userId: string): UserSettingsRecord {
  const db = getDb();
  let row = db
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)`
    ).run(userId, now);
    row = db
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .get(userId) as Record<string, unknown>;
  }

  let leadDays = [30, 7, 1];
  try {
    const parsed = JSON.parse(String(row.default_reminder_days || "[30,7,1]"));
    if (Array.isArray(parsed)) {
      leadDays = parsed.map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    }
  } catch {
    leadDays = [30, 7, 1];
  }

  const provider = String(row.ai_provider || "local");
  const normalizedProvider =
    provider === "openai" || provider === "gemini" ? provider : "local";

  return {
    user_id: String(row.user_id),
    currency: String(row.currency || "USD"),
    date_format: (String(row.date_format || "MMM D, YYYY") as DateFormatOption),
    expiring_soon_days: Number(row.expiring_soon_days ?? 30),
    auto_create_reminders: Boolean(row.auto_create_reminders),
    default_reminder_days: leadDays,
    auto_extract_on_upload: Boolean(row.auto_extract_on_upload),
    sidebar_collapsed: Boolean(row.sidebar_collapsed),
    in_app_notifications: Boolean(row.in_app_notifications),
    ai_provider: normalizedProvider,
    has_ai_api_key: Boolean(row.ai_api_key_enc),
    ai_model: String(row.ai_model || ""),
    updated_at: String(row.updated_at),
  };
}

export function logActivity(params: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  details?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, entity_name, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    params.userId,
    params.action,
    params.entityType,
    params.entityId ?? null,
    params.entityName ?? null,
    params.details ?? "",
    new Date().toISOString()
  );
}
