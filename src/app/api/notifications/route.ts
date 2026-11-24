import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUserNotifications } from "@/lib/documents";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = listUserNotifications(user.id);
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = getDb();

    if (body?.markAll) {
      db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(user.id);
    } else if (body?.id) {
      db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(
        String(body.id),
        user.id
      );
    }

    return NextResponse.json(listUserNotifications(user.id));
  } catch {
    return NextResponse.json(
      { error: "Failed to update notifications." },
      { status: 500 }
    );
  }
}
