import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUserReminders } from "@/lib/documents";
import { toIsoDateOnly } from "@/lib/constants";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM reminders WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const now = new Date().toISOString();

    if (body?.action === "complete") {
      db.prepare(
        `UPDATE reminders SET status = 'completed', completed_at = ?, snoozed_until = NULL, updated_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(now, now, id, user.id);

      logActivity({
        userId: user.id,
        action: "reminder.completed",
        entityType: "reminder",
        entityId: id,
        entityName: String(existing.title),
        details: "Marked reminder completed",
      });
    } else if (body?.action === "reopen") {
      db.prepare(
        `UPDATE reminders SET status = 'upcoming', completed_at = NULL, snoozed_until = NULL, updated_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(now, id, user.id);
    } else if (body?.action === "snooze") {
      const days = Math.max(1, Math.min(90, Number(body?.days || 3)));
      const wakeDate = new Date(Date.now() + days * 86_400_000);
      const wakeIso = toIsoDateOnly(wakeDate);
      db.prepare(
        `UPDATE reminders SET status = 'snoozed', snoozed_until = ?, due_date = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(wakeIso, wakeIso, now, id, user.id);

      logActivity({
        userId: user.id,
        action: "reminder.snoozed",
        entityType: "reminder",
        entityId: id,
        entityName: String(existing.title),
        details: `Snoozed until ${wakeIso}`,
      });
    } else {
      const nextTitle =
        body?.title !== undefined ? String(body.title).trim() : String(existing.title);
      const nextNotes =
        body?.notes !== undefined ? String(body.notes).trim() : String(existing.notes || "");
      const nextDue =
        body?.due_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date))
          ? String(body.due_date)
          : String(existing.due_date);
      const nextPriority = ["low", "medium", "high"].includes(String(body?.priority))
        ? String(body.priority)
        : String(existing.priority);

      if (!nextTitle) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }

      db.prepare(
        `UPDATE reminders SET title = ?, notes = ?, due_date = ?, priority = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(nextTitle, nextNotes, nextDue, nextPriority, now, id, user.id);
    }

    const updated = listUserReminders(user.id).find((r) => r.id === id);
    return NextResponse.json({ reminder: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update reminder." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  const existing = db
    .prepare("SELECT title FROM reminders WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
  }

  db.prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?").run(id, user.id);

  logActivity({
    userId: user.id,
    action: "reminder.deleted",
    entityType: "reminder",
    entityId: id,
    entityName: String(existing.title),
    details: "Removed reminder",
  });

  return NextResponse.json({ ok: true });
}
