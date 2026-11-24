import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createSession, logActivity } from "@/lib/auth";
import { AVATAR_COLORS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const timezone = String(body?.timezone || "UTC").trim() || "UTC";

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Please enter your full name (2 to 80 characters)." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const avatarColor =
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const passwordHash = hashPassword(password);

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, avatar_color, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, name, email, passwordHash, avatarColor, timezone, now, now);

    db.prepare(
      `INSERT INTO user_settings (user_id, updated_at) VALUES (?, ?)`
    ).run(userId, now);

    await createSession(userId);
    logActivity({
      userId,
      action: "auth.registered",
      entityType: "auth",
      entityId: userId,
      entityName: name,
      details: "Created DocuMind account",
    });

    return NextResponse.json(
      {
        user: {
          id: userId,
          name,
          email,
          avatar_color: avatarColor,
          timezone,
          created_at: now,
          updated_at: now,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to create account right now." },
      { status: 500 }
    );
  }
}
