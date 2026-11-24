import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { runAssistantTurn } from "@/lib/ai-assistant";
import { isValidCategory } from "@/lib/constants";

function serializeMessages(rows: Record<string, unknown>[]) {
  return rows.map((m) => {
    let citations = [];
    try {
      citations = JSON.parse(String(m.citations_json || "[]"));
    } catch {
      citations = [];
    }
    return {
      id: String(m.id),
      role: String(m.role) as "user" | "assistant",
      content: String(m.content),
      citations,
      provider: String(m.provider || "local"),
      created_at: String(m.created_at),
    };
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  const conv = db
    .prepare(
      `SELECT c.*, d.name as document_name
       FROM ai_conversations c
       LEFT JOIN documents d ON d.id = c.document_id
       WHERE c.id = ? AND c.user_id = ?`
    )
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const msgRows = db
    .prepare(
      `SELECT id, role, content, citations_json, provider, created_at
       FROM ai_messages
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at ASC`
    )
    .all(id, user.id);

  return NextResponse.json({
    conversation: {
      id: String(conv.id),
      title: String(conv.title),
      document_id: conv.document_id ? String(conv.document_id) : null,
      document_name: conv.document_name ? String(conv.document_name) : null,
      category_filter: conv.category_filter ? String(conv.category_filter) : null,
      created_at: String(conv.created_at),
      updated_at: String(conv.updated_at),
    },
    messages: serializeMessages(msgRows),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDb();
  const conv = db
    .prepare("SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?")
    .get(id, user.id) as Record<string, unknown> | undefined;

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();
    if (!question) {
      return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
    }

    const documentId =
      body?.documentId !== undefined
        ? body.documentId
          ? String(body.documentId)
          : null
        : conv.document_id
          ? String(conv.document_id)
          : null;

    const categoryFilter =
      body?.categoryFilter !== undefined
        ? body.categoryFilter && isValidCategory(String(body.categoryFilter))
          ? String(body.categoryFilter)
          : null
        : conv.category_filter
          ? String(conv.category_filter)
          : null;

    if (
      body?.documentId !== undefined ||
      body?.categoryFilter !== undefined
    ) {
      db.prepare(
        "UPDATE ai_conversations SET document_id = ?, category_filter = ? WHERE id = ? AND user_id = ?"
      ).run(documentId, categoryFilter, id, user.id);
    }

    await runAssistantTurn({
      userId: user.id,
      conversationId: id,
      question,
      documentId,
      categoryFilter,
    });

    const msgRows = db
      .prepare(
        `SELECT id, role, content, citations_json, provider, created_at
         FROM ai_messages
         WHERE conversation_id = ? AND user_id = ?
         ORDER BY created_at ASC`
      )
      .all(id, user.id);

    const updatedConv = db
      .prepare("SELECT title, updated_at, document_id, category_filter FROM ai_conversations WHERE id = ?")
      .get(id) as Record<string, unknown>;

    return NextResponse.json({
      conversation: {
        id,
        title: String(updatedConv.title),
        document_id: updatedConv.document_id ? String(updatedConv.document_id) : null,
        category_filter: updatedConv.category_filter
          ? String(updatedConv.category_filter)
          : null,
        updated_at: String(updatedConv.updated_at),
      },
      messages: serializeMessages(msgRows),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process message." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
  }

  const db = getDb();
  const res = db
    .prepare("UPDATE ai_conversations SET title = ? WHERE id = ? AND user_id = ?")
    .run(title.slice(0, 80), id, user.id);

  if (Number(res.changes) === 0) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, title: title.slice(0, 80) });
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
  const res = db
    .prepare("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?")
    .run(id, user.id);

  if (Number(res.changes) === 0) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
