import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { runAssistantTurn } from "@/lib/ai-assistant";
import { isValidCategory } from "@/lib/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, d.name as document_name,
         (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) as message_count
       FROM ai_conversations c
       LEFT JOIN documents d ON d.id = c.document_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(user.id);

  const conversations = rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    document_id: r.document_id ? String(r.document_id) : null,
    document_name: r.document_name ? String(r.document_name) : null,
    category_filter: r.category_filter ? String(r.category_filter) : null,
    message_count: Number(r.message_count || 0),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const documentId = body?.documentId ? String(body.documentId).trim() : null;
    const categoryFilter =
      body?.categoryFilter && isValidCategory(String(body.categoryFilter))
        ? String(body.categoryFilter)
        : null;
    const initialQuestion = body?.question ? String(body.question).trim() : "";
    const title = String(body?.title || "").trim() || "New conversation";

    const db = getDb();
    if (documentId) {
      const doc = db
        .prepare("SELECT id FROM documents WHERE id = ? AND user_id = ?")
        .get(documentId, user.id);
      if (!doc) {
        return NextResponse.json({ error: "Selected document not found." }, { status: 404 });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO ai_conversations (id, user_id, title, document_id, category_filter, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, user.id, title, documentId, categoryFilter, now, now);

    let turnResult = null;
    if (initialQuestion) {
      turnResult = await runAssistantTurn({
        userId: user.id,
        conversationId: id,
        question: initialQuestion,
        documentId,
        categoryFilter,
      });
    }

    const row = db
      .prepare(
        `SELECT c.*, d.name as document_name
         FROM ai_conversations c
         LEFT JOIN documents d ON d.id = c.document_id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(id, user.id) as Record<string, unknown>;

    return NextResponse.json(
      {
        conversation: {
          id: String(row.id),
          title: String(row.title),
          document_id: row.document_id ? String(row.document_id) : null,
          document_name: row.document_name ? String(row.document_name) : null,
          category_filter: row.category_filter ? String(row.category_filter) : null,
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
        },
        turnResult,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to start conversation." },
      { status: 500 }
    );
  }
}
