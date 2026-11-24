import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb, UPLOADS_DIR } from "@/lib/db";
import {
  deleteCurrentSession,
  ensureUserSettings,
  getCurrentUser,
  logActivity,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { AVATAR_COLORS } from "@/lib/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = ensureUserSettings(user.id);
  const db = getDb();
  const storageRow = db
    .prepare(
      "SELECT COUNT(*) as docCount, COALESCE(SUM(file_size), 0) as totalBytes FROM documents WHERE user_id = ?"
    )
    .get(user.id) as Record<string, unknown>;

  return NextResponse.json({
    user,
    settings,
    stats: {
      docCount: Number(storageRow?.docCount || 0),
      totalBytes: Number(storageRow?.totalBytes || 0),
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getDb();

    // Password change flow
    if (body?.currentPassword !== undefined || body?.newPassword !== undefined) {
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters long." },
          { status: 400 }
        );
      }

      const row = db
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .get(user.id) as Record<string, unknown> | undefined;

      if (!row || !verifyPassword(currentPassword, String(row.password_hash || ""))) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
        hashPassword(newPassword),
        now,
        user.id
      );

      logActivity({
        userId: user.id,
        action: "profile.updated",
        entityType: "profile",
        entityId: user.id,
        entityName: user.name,
        details: "Updated account password",
      });

      return NextResponse.json({ ok: true });
    }

    // Profile info update flow
    const name = body?.name !== undefined ? String(body.name).trim() : user.name;
    const email =
      body?.email !== undefined ? String(body.email).trim().toLowerCase() : user.email;
    const timezone =
      body?.timezone !== undefined ? String(body.timezone).trim() : user.timezone;
    const avatarColor =
      body?.avatar_color &&
      (AVATAR_COLORS as readonly string[]).includes(String(body.avatar_color))
        ? String(body.avatar_color)
        : user.avatar_color;

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Name must be between 2 and 80 characters." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (email !== user.email) {
      const taken = db
        .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .get(email, user.id);
      if (taken) {
        return NextResponse.json(
          { error: "That email address is already in use." },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET name = ?, email = ?, timezone = ?, avatar_color = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, email, timezone || "UTC", avatarColor, now, user.id);

    logActivity({
      userId: user.id,
      action: "profile.updated",
      entityType: "profile",
      entityId: user.id,
      entityName: name,
      details: "Updated profile information",
    });

    return NextResponse.json({
      user: {
        ...user,
        name,
        email,
        timezone: timezone || "UTC",
        avatar_color: avatarColor,
        updated_at: now,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const password = String(body?.password || "");
    const db = getDb();
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash || ""))) {
      return NextResponse.json(
        { error: "Incorrect password. Account deletion cancelled." },
        { status: 400 }
      );
    }

    const userDir = path.resolve(UPLOADS_DIR, user.id);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    await deleteCurrentSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete account." },
      { status: 500 }
    );
  }
}
