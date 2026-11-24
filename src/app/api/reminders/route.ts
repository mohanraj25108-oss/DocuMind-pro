import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  getDocumentById,
  listUserReminders,
  syncUserRemindersAndNotifications,
} from "@/lib/documents";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  syncUserRemindersAndNotifications(user.id);
  const reminders = listUserReminders(user.id);
  return NextResponse.json({ reminders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = String(body?.title || "").trim();
    const dueDate = String(body?.due_date || "").trim();
    const notes = String(body?.notes || "").trim();
    const documentId = body?.document_id ? String(body.document_id).trim() : null;
    const priority = ["low", "medium", "high"].includes(String(body?.priority))
      ? String(body.priority)
      : "medium";

    if (!title) {
      return NextResponse.json({ error: "Reminder title is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return NextResponse.json(
        { error: "Please provide a valid due date (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    if (documentId) {
      const doc = getDocumentById(user.id, documentId);
      if (!doc) {
        return NextResponse.json({ error: "Linked document not found." }, { status: 404 });
      }
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO reminders (
        id, user_id, document_id, title, notes, due_date, lead_days, status,
        priority, is_auto, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 'upcoming', ?, 0, ?, ?)`
    ).run(id, user.id, documentId, title, notes, dueDate, priority, now, now);

    logActivity({
      userId: user.id,
      action: "reminder.created",
      entityType: "reminder",
      entityId: id,
      entityName: title,
      details: `Due ${dueDate}`,
    });

    syncUserRemindersAndNotifications(user.id);
    const created = listUserReminders(user.id).find((r) => r.id === id);
    return NextResponse.json({ reminder: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create reminder." },
      { status: 500 }
    );
  }
}
