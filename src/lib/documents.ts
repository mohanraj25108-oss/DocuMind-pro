import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb, UPLOADS_DIR } from "./db";
import { ensureUserSettings, logActivity } from "./auth";
import {
  CATEGORY_META,
  DOCUMENT_CATEGORIES,
  daysUntil,
  getExpiryStatus,
  getTodayIso,
  isValidCategory,
  toIsoDateOnly,
  type DocumentCategory,
  type ExpiryStatus,
} from "./constants";

export interface DocumentItem {
  id: string;
  user_id: string;
  name: string;
  category: DocumentCategory;
  issuer: string;
  purchase_date: string | null;
  expiry_date: string | null;
  warranty_duration: string;
  policy_number: string;
  amount: number | null;
  currency: string;
  notes: string;
  tags: string[];
  has_file: boolean;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number;
  extracted_text: string;
  ai_summary: string;
  extraction_status: string;
  created_at: string;
  updated_at: string;
  expiry_status: ExpiryStatus;
  days_until_expiry: number | null;
}

export interface ReminderItem {
  id: string;
  user_id: string;
  document_id: string | null;
  document_name: string | null;
  document_category: DocumentCategory | null;
  title: string;
  notes: string;
  due_date: string;
  lead_days: number;
  status: "upcoming" | "completed" | "snoozed";
  priority: "low" | "medium" | "high";
  snoozed_until: string | null;
  is_auto: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  days_until_due: number;
  is_overdue: boolean;
}

export interface NotificationItem {
  id: string;
  document_id: string | null;
  reminder_id: string | null;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  is_read: boolean;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: string;
  created_at: string;
}

function parseTags(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || "[]"));
    if (Array.isArray(parsed)) {
      return parsed
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  } catch {
    // ignore
  }
  return [];
}

export function serializeDocumentRow(
  row: Record<string, unknown>,
  expiringSoonDays: number
): DocumentItem {
  const rawCategory = String(row.category || "Other personal documents");
  const category: DocumentCategory = isValidCategory(rawCategory)
    ? rawCategory
    : "Other personal documents";
  const expiryDate = row.expiry_date ? String(row.expiry_date) : null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name),
    category,
    issuer: String(row.issuer || ""),
    purchase_date: row.purchase_date ? String(row.purchase_date) : null,
    expiry_date: expiryDate,
    warranty_duration: String(row.warranty_duration || ""),
    policy_number: String(row.policy_number || ""),
    amount:
      row.amount !== null && row.amount !== undefined && row.amount !== ""
        ? Number(row.amount)
        : null,
    currency: String(row.currency || "USD"),
    notes: String(row.notes || ""),
    tags: parseTags(row.tags_json),
    has_file: Boolean(row.file_path),
    original_filename: row.original_filename ? String(row.original_filename) : null,
    mime_type: row.mime_type ? String(row.mime_type) : null,
    file_size: Number(row.file_size || 0),
    extracted_text: String(row.extracted_text || ""),
    ai_summary: String(row.ai_summary || ""),
    extraction_status: String(row.extraction_status || "manual"),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    expiry_status: getExpiryStatus(expiryDate, expiringSoonDays),
    days_until_expiry: daysUntil(expiryDate),
  };
}

export function listUserDocuments(
  userId: string,
  options?: {
    search?: string;
    category?: string;
    expiryStatus?: string;
    tag?: string;
    sortBy?: "uploaded" | "purchase" | "expiry" | "name" | "amount";
    sortDir?: "asc" | "desc";
  }
): DocumentItem[] {
  const db = getDb();
  const settings = ensureUserSettings(userId);
  const rows = db
    .prepare("SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);

  let docs = rows.map((r) => serializeDocumentRow(r, settings.expiring_soon_days));

  if (options?.category && options.category !== "all") {
    docs = docs.filter((d) => d.category === options.category);
  }

  if (options?.expiryStatus && options.expiryStatus !== "all") {
    docs = docs.filter((d) => d.expiry_status === options.expiryStatus);
  }

  if (options?.tag && options.tag !== "all") {
    const targetTag = options.tag.toLowerCase();
    docs = docs.filter((d) => d.tags.some((t) => t.toLowerCase() === targetTag));
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    docs = docs.filter((d) => {
      const hay = [
        d.name,
        d.category,
        d.issuer,
        d.policy_number,
        d.warranty_duration,
        d.notes,
        d.ai_summary,
        d.extracted_text,
        d.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const sortBy = options?.sortBy || "uploaded";
  const sortDir = options?.sortDir || (sortBy === "name" || sortBy === "expiry" ? "asc" : "desc");
  const dir = sortDir === "asc" ? 1 : -1;

  docs.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name) * dir;
    }
    if (sortBy === "purchase") {
      const av = a.purchase_date || (dir > 0 ? "9999-99-99" : "");
      const bv = b.purchase_date || (dir > 0 ? "9999-99-99" : "");
      return av.localeCompare(bv) * dir;
    }
    if (sortBy === "expiry") {
      const av = a.expiry_date || (dir > 0 ? "9999-99-99" : "");
      const bv = b.expiry_date || (dir > 0 ? "9999-99-99" : "");
      return av.localeCompare(bv) * dir;
    }
    if (sortBy === "amount") {
      return ((a.amount ?? -1) - (b.amount ?? -1)) * dir;
    }
    return a.created_at.localeCompare(b.created_at) * dir;
  });

  return docs;
}

export function getDocumentById(userId: string, documentId: string): DocumentItem | null {
  const db = getDb();
  const settings = ensureUserSettings(userId);
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND user_id = ?")
    .get(documentId, userId);
  if (!row) return null;
  return serializeDocumentRow(row, settings.expiring_soon_days);
}

export function getDocumentFileDetails(
  userId: string,
  documentId: string
): { absolutePath: string; originalFilename: string; mimeType: string } | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT file_path, original_filename, mime_type, name FROM documents WHERE id = ? AND user_id = ?"
    )
    .get(documentId, userId) as Record<string, unknown> | undefined;
  if (!row || !row.file_path) return null;

  const userDir = path.resolve(UPLOADS_DIR, userId);
  const abs = path.resolve(userDir, String(row.file_path));
  if (!abs.startsWith(userDir + path.sep) || !fs.existsSync(abs)) {
    return null;
  }

  return {
    absolutePath: abs,
    originalFilename: String(row.original_filename || `${row.name || "document"}`),
    mimeType: String(row.mime_type || "application/octet-stream"),
  };
}

function replaceDocumentTags(
  userId: string,
  documentId: string,
  tags: string[]
): string[] {
  const db = getDb();
  const cleanTags = Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 32)
    )
  ).slice(0, 12);

  db.prepare("DELETE FROM document_tags WHERE document_id = ? AND user_id = ?").run(
    documentId,
    userId
  );

  const insert = db.prepare(
    "INSERT OR IGNORE INTO document_tags (id, user_id, document_id, tag) VALUES (?, ?, ?, ?)"
  );
  for (const tag of cleanTags) {
    insert.run(crypto.randomUUID(), userId, documentId, tag);
  }
  return cleanTags;
}

export function syncDocumentAutoReminders(
  userId: string,
  documentId: string,
  docName: string,
  expiryDate: string | null
): void {
  const db = getDb();
  const settings = ensureUserSettings(userId);

  // Remove untouched upcoming auto-reminders for this document before recalculating
  db.prepare(
    "DELETE FROM reminders WHERE user_id = ? AND document_id = ? AND is_auto = 1 AND status = 'upcoming'"
  ).run(userId, documentId);

  if (!settings.auto_create_reminders || !expiryDate || !/^\d{4}-\d{2}-\d{2}/.test(expiryDate)) {
    return;
  }

  const expiry = new Date(`${expiryDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiry.getTime())) return;

  const todayIso = getTodayIso();
  const diffFromToday = daysUntil(expiryDate) ?? 0;
  const nowIso = new Date().toISOString();

  const insert = db.prepare(
    `INSERT INTO reminders (id, user_id, document_id, title, notes, due_date, lead_days, status, priority, is_auto, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, 1, ?, ?)`
  );

  const leadDaysList = settings.default_reminder_days.length
    ? settings.default_reminder_days
    : [30, 7, 1];

  let createdAny = false;
  for (const lead of leadDaysList) {
    const due = new Date(expiry.getTime() - lead * 86_400_000);
    const dueIso = toIsoDateOnly(due);
    if (dueIso >= todayIso) {
      const priority = lead <= 3 ? "high" : lead <= 14 ? "medium" : "low";
      const title =
        lead === 0
          ? `${docName} expires today`
          : `${docName} expires in ${lead} day${lead === 1 ? "" : "s"}`;
      insert.run(
        crypto.randomUUID(),
        userId,
        documentId,
        title,
        `Automatic expiry reminder for ${docName} (expires ${expiryDate.slice(0, 10)}).`,
        dueIso,
        lead,
        priority,
        nowIso,
        nowIso
      );
      createdAny = true;
    }
  }

  // If document expires within window and all lead-day dates passed, create immediate reminder for today
  if (!createdAny && diffFromToday >= 0 && diffFromToday <= settings.expiring_soon_days) {
    insert.run(
      crypto.randomUUID(),
      userId,
      documentId,
      `${docName} expires ${diffFromToday === 0 ? "today" : `in ${diffFromToday} day(s)`}`,
      `Immediate expiry reminder (expires ${expiryDate.slice(0, 10)}).`,
      todayIso,
      diffFromToday,
      "high",
      nowIso,
      nowIso
    );
  }
}

export interface DocumentInput {
  name: string;
  category: DocumentCategory;
  issuer?: string;
  purchase_date?: string | null;
  expiry_date?: string | null;
  warranty_duration?: string;
  policy_number?: string;
  amount?: number | null;
  currency?: string;
  notes?: string;
  tags?: string[];
  file_path?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number;
  extracted_text?: string;
  ai_summary?: string;
  extraction_status?: string;
  extracted_metadata_json?: string;
}

export function createDocumentRecord(userId: string, input: DocumentInput): DocumentItem {
  const db = getDb();
  const settings = ensureUserSettings(userId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const category: DocumentCategory = isValidCategory(input.category)
    ? input.category
    : "Other personal documents";

  const cleanTags = Array.from(
    new Set(
      (input.tags || [])
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 32)
    )
  ).slice(0, 12);

  const summary =
    input.ai_summary ||
    `${category.slice(0, -1)} "${input.name}"${input.issuer ? ` from ${input.issuer}` : ""}.`;

  db.prepare(
    `INSERT INTO documents (
      id, user_id, name, category, issuer, purchase_date, expiry_date, warranty_duration,
      policy_number, amount, currency, notes, tags_json, file_path, original_filename,
      mime_type, file_size, extracted_text, ai_summary, extraction_status,
      extracted_metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    input.name.trim(),
    category,
    (input.issuer || "").trim(),
    input.purchase_date || null,
    input.expiry_date || null,
    (input.warranty_duration || "").trim(),
    (input.policy_number || "").trim(),
    input.amount ?? null,
    input.currency || settings.currency || "USD",
    (input.notes || "").trim(),
    JSON.stringify(cleanTags),
    input.file_path || null,
    input.original_filename || null,
    input.mime_type || null,
    input.file_size || 0,
    input.extracted_text || "",
    summary,
    input.extraction_status || (input.file_path ? "processed" : "manual"),
    input.extracted_metadata_json || "{}",
    now,
    now
  );

  replaceDocumentTags(userId, id, cleanTags);
  syncDocumentAutoReminders(userId, id, input.name.trim(), input.expiry_date || null);

  logActivity({
    userId,
    action: input.file_path ? "document.uploaded" : "document.created",
    entityType: "document",
    entityId: id,
    entityName: input.name.trim(),
    details: `${category}${input.issuer ? ` • ${input.issuer}` : ""}`,
  });

  syncUserRemindersAndNotifications(userId);
  return getDocumentById(userId, id)!;
}

export function updateDocumentRecord(
  userId: string,
  documentId: string,
  input: Partial<DocumentInput>
): DocumentItem | null {
  const existing = getDocumentById(userId, documentId);
  if (!existing) return null;

  const db = getDb();
  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  const nextCat: DocumentCategory =
    input.category && isValidCategory(input.category) ? input.category : existing.category;
  const nextTags =
    input.tags !== undefined
      ? replaceDocumentTags(userId, documentId, input.tags)
      : existing.tags;
  const nextExpiry =
    input.expiry_date !== undefined ? input.expiry_date || null : existing.expiry_date;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE documents SET
      name = ?, category = ?, issuer = ?, purchase_date = ?, expiry_date = ?,
      warranty_duration = ?, policy_number = ?, amount = ?, currency = ?, notes = ?,
      tags_json = ?, ai_summary = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    nextName,
    nextCat,
    input.issuer !== undefined ? input.issuer.trim() : existing.issuer,
    input.purchase_date !== undefined ? input.purchase_date || null : existing.purchase_date,
    nextExpiry,
    input.warranty_duration !== undefined
      ? input.warranty_duration.trim()
      : existing.warranty_duration,
    input.policy_number !== undefined ? input.policy_number.trim() : existing.policy_number,
    input.amount !== undefined ? input.amount : existing.amount,
    input.currency !== undefined ? input.currency : existing.currency,
    input.notes !== undefined ? input.notes.trim() : existing.notes,
    JSON.stringify(nextTags),
    input.ai_summary !== undefined ? input.ai_summary : existing.ai_summary,
    now,
    documentId,
    userId
  );

  syncDocumentAutoReminders(userId, documentId, nextName, nextExpiry);

  logActivity({
    userId,
    action: "document.updated",
    entityType: "document",
    entityId: documentId,
    entityName: nextName,
    details: `Updated details in ${nextCat}`,
  });

  syncUserRemindersAndNotifications(userId);
  return getDocumentById(userId, documentId);
}

export function deleteDocumentRecord(userId: string, documentId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id, name, category, file_path FROM documents WHERE id = ? AND user_id = ?")
    .get(documentId, userId) as Record<string, unknown> | undefined;

  if (!row) return false;

  if (row.file_path) {
    const userDir = path.resolve(UPLOADS_DIR, userId);
    const abs = path.resolve(userDir, String(row.file_path));
    if (abs.startsWith(userDir + path.sep) && fs.existsSync(abs)) {
      fs.unlinkSync(abs);
    }
  }

  db.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").run(documentId, userId);

  logActivity({
    userId,
    action: "document.deleted",
    entityType: "document",
    entityId: documentId,
    entityName: String(row.name),
    details: `Removed from ${String(row.category)}`,
  });

  return true;
}

export function listUserTags(userId: string): Array<{ tag: string; count: number }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tag, COUNT(*) as count
       FROM document_tags
       WHERE user_id = ?
       GROUP BY tag
       ORDER BY count DESC, tag ASC`
    )
    .all(userId);
  return rows.map((r) => ({ tag: String(r.tag), count: Number(r.count) }));
}

export function listUserReminders(userId: string): ReminderItem[] {
  const db = getDb();
  const todayIso = getTodayIso();

  // Automatically wake up snoozed reminders whose snooze date passed
  db.prepare(
    `UPDATE reminders
     SET status = 'upcoming', snoozed_until = NULL, updated_at = ?
     WHERE user_id = ? AND status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?`
  ).run(new Date().toISOString(), userId, todayIso);

  const rows = db
    .prepare(
      `SELECT r.*, d.name as document_name, d.category as document_category
       FROM reminders r
       LEFT JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = ?
       ORDER BY
         CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END ASC,
         r.due_date ASC`
    )
    .all(userId);

  return rows.map((r) => {
    const dueDate = String(r.due_date);
    const diff = daysUntil(dueDate) ?? 0;
    const status = String(r.status) as "upcoming" | "completed" | "snoozed";
    const docCat = r.document_category ? String(r.document_category) : null;
    return {
      id: String(r.id),
      user_id: String(r.user_id),
      document_id: r.document_id ? String(r.document_id) : null,
      document_name: r.document_name ? String(r.document_name) : null,
      document_category:
        docCat && isValidCategory(docCat) ? (docCat as DocumentCategory) : null,
      title: String(r.title),
      notes: String(r.notes || ""),
      due_date: dueDate,
      lead_days: Number(r.lead_days || 0),
      status,
      priority: (String(r.priority || "medium") as "low" | "medium" | "high"),
      snoozed_until: r.snoozed_until ? String(r.snoozed_until) : null,
      is_auto: Boolean(r.is_auto),
      completed_at: r.completed_at ? String(r.completed_at) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      days_until_due: diff,
      is_overdue: status === "upcoming" && diff < 0,
    };
  });
}

export function syncUserRemindersAndNotifications(userId: string): void {
  const db = getDb();
  const settings = ensureUserSettings(userId);
  if (!settings.in_app_notifications) return;

  const docs = listUserDocuments(userId);
  const reminders = listUserReminders(userId);
  const nowIso = new Date().toISOString();

  const insertNotif = db.prepare(
    `INSERT OR IGNORE INTO notifications
     (id, user_id, document_id, reminder_id, title, message, type, is_read, dedup_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );

  for (const doc of docs) {
    if (doc.expiry_status === "expired" && doc.expiry_date) {
      const dedup = `${userId}:doc-expired:${doc.id}:${doc.expiry_date}`;
      insertNotif.run(
        crypto.randomUUID(),
        userId,
        doc.id,
        null,
        `${doc.name} has expired`,
        `Expired on ${doc.expiry_date.slice(0, 10)}${doc.issuer ? ` (${doc.issuer})` : ""}.`,
        "error",
        dedup,
        nowIso
      );
    } else if (doc.expiry_status === "expiring_soon" && doc.expiry_date) {
      const dedup = `${userId}:doc-soon:${doc.id}:${doc.expiry_date}`;
      insertNotif.run(
        crypto.randomUUID(),
        userId,
        doc.id,
        null,
        `${doc.name} expiring soon`,
        `Expires ${
          doc.days_until_expiry === 0
            ? "today"
            : `in ${doc.days_until_expiry} day${doc.days_until_expiry === 1 ? "" : "s"}`
        } (${doc.expiry_date.slice(0, 10)}).`,
        "warning",
        dedup,
        nowIso
      );
    }
  }

  for (const rem of reminders) {
    if (rem.status === "upcoming" && rem.days_until_due <= 1) {
      const dedup = `${userId}:rem-due:${rem.id}:${rem.due_date}`;
      insertNotif.run(
        crypto.randomUUID(),
        userId,
        rem.document_id,
        rem.id,
        rem.is_overdue ? `Overdue reminder: ${rem.title}` : `Reminder due: ${rem.title}`,
        `Scheduled for ${rem.due_date}.`,
        rem.is_overdue ? "error" : "info",
        dedup,
        nowIso
      );
    }
  }
}

export function listUserNotifications(userId: string): {
  notifications: NotificationItem[];
  unreadCount: number;
} {
  syncUserRemindersAndNotifications(userId);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, document_id, reminder_id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT 40`
    )
    .all(userId);

  const notifications: NotificationItem[] = rows.map((r) => ({
    id: String(r.id),
    document_id: r.document_id ? String(r.document_id) : null,
    reminder_id: r.reminder_id ? String(r.reminder_id) : null,
    title: String(r.title),
    message: String(r.message),
    type: String(r.type || "info") as "info" | "warning" | "error" | "success",
    is_read: Boolean(r.is_read),
    created_at: String(r.created_at),
  }));

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  return { notifications, unreadCount };
}

export function listUserActivity(userId: string, limit = 100): ActivityItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, action, entity_type, entity_id, entity_name, details, created_at
       FROM activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(userId, limit);

  return rows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    entity_type: String(r.entity_type),
    entity_id: r.entity_id ? String(r.entity_id) : null,
    entity_name: r.entity_name ? String(r.entity_name) : null,
    details: String(r.details || ""),
    created_at: String(r.created_at),
  }));
}

export function getDashboardData(userId: string) {
  syncUserRemindersAndNotifications(userId);
  const docs = listUserDocuments(userId);
  const reminders = listUserReminders(userId);
  const { unreadCount } = listUserNotifications(userId);
  const recentActivity = listUserActivity(userId, 8);
  const settings = ensureUserSettings(userId);

  const totalDocuments = docs.length;
  const activeWarranties = docs.filter(
    (d) =>
      (d.category === "Warranty cards" || Boolean(d.warranty_duration)) &&
      d.expiry_status !== "expired"
  ).length;
  const upcomingExpirations = docs.filter((d) => d.expiry_status === "expiring_soon").length;
  const expiredDocuments = docs.filter((d) => d.expiry_status === "expired").length;

  const recentDocuments = docs.slice(0, 5);
  const upcomingTimeline = docs
    .filter((d) => d.expiry_date !== null)
    .sort((a, b) => (a.expiry_date || "").localeCompare(b.expiry_date || ""))
    .filter((d) => (d.days_until_expiry ?? 9999) >= -30)
    .slice(0, 7);

  const categoryDistribution = DOCUMENT_CATEGORIES.map((category) => {
    const items = docs.filter((d) => d.category === category);
    const totalValue = items.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    return {
      category,
      shortLabel: CATEGORY_META[category].shortLabel,
      accentColor: CATEGORY_META[category].accentColor,
      count: items.length,
      activeCount: items.filter((d) => d.expiry_status === "active").length,
      expiringCount: items.filter((d) => d.expiry_status === "expiring_soon").length,
      expiredCount: items.filter((d) => d.expiry_status === "expired").length,
      totalValue,
      latestDoc: items[0] || null,
    };
  });

  const pendingRemindersCount = reminders.filter((r) => r.status === "upcoming").length;
  const totalStorageBytes = docs.reduce((acc, d) => acc + d.file_size, 0);

  return {
    settings,
    totalDocuments,
    activeWarranties,
    upcomingExpirations,
    expiredDocuments,
    recentDocuments,
    upcomingTimeline,
    categoryDistribution,
    recentActivity,
    pendingRemindersCount,
    unreadNotificationsCount: unreadCount,
    totalStorageBytes,
  };
}
