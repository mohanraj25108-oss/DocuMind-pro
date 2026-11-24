import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createSession, logActivity } from "@/lib/auth";
import { syncUserRemindersAndNotifications } from "@/lib/documents";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(password, String(row.password_hash || ""))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const userId = String(row.id);
    await createSession(userId);
    syncUserRemindersAndNotifications(userId);

    logActivity({
      userId,
      action: "auth.login",
      entityType: "auth",
      entityId: userId,
      entityName: String(row.name),
      details: "Signed in to workspace",
    });

    return NextResponse.json({
      user: {
        id: userId,
        name: String(row.name),
        email: String(row.email),
        avatar_color: String(row.avatar_color),
        timezone: String(row.timezone),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
