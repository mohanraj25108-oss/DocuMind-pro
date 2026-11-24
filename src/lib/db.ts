import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const DB_PATH = path.join(DATA_DIR, "documind.db");

declare global {
  var __documindDb: DatabaseSync | undefined;
}

function initializeSchema(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#4568C7',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      currency TEXT NOT NULL DEFAULT 'USD',
      date_format TEXT NOT NULL DEFAULT 'MMM D, YYYY',
      expiring_soon_days INTEGER NOT NULL DEFAULT 30,
      auto_create_reminders INTEGER NOT NULL DEFAULT 1,
      default_reminder_days TEXT NOT NULL DEFAULT '[30,7,1]',
      auto_extract_on_upload INTEGER NOT NULL DEFAULT 1,
      sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
      in_app_notifications INTEGER NOT NULL DEFAULT 1,
      ai_provider TEXT NOT NULL DEFAULT 'local',
      ai_api_key_enc TEXT,
      ai_model TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      issuer TEXT NOT NULL DEFAULT '',
      purchase_date TEXT,
      expiry_date TEXT,
      warranty_duration TEXT NOT NULL DEFAULT '',
      policy_number TEXT NOT NULL DEFAULT '',
      amount REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      notes TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      file_path TEXT,
      original_filename TEXT,
      mime_type TEXT,
      file_size INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT NOT NULL DEFAULT '',
      ai_summary TEXT NOT NULL DEFAULT '',
      extraction_status TEXT NOT NULL DEFAULT 'manual',
      extracted_metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      UNIQUE(document_id, tag)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      lead_days INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'upcoming',
      priority TEXT NOT NULL DEFAULT 'medium',
      snoozed_until TEXT,
      is_auto INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
      reminder_id TEXT REFERENCES reminders(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      dedup_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      category_filter TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      provider TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(user_id, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(user_id, category);
    CREATE INDEX IF NOT EXISTS idx_doc_tags_user_tag ON document_tags(user_id, tag);
    CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON reminders(user_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_user_time ON activity_logs(user_id, created_at);
  `);
}

export function getDb(): DatabaseSync {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!globalThis.__documindDb) {
    const db = new DatabaseSync(DB_PATH);
    initializeSchema(db);
    globalThis.__documindDb = db;
  }
  return globalThis.__documindDb;
}
