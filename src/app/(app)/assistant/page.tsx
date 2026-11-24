import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUserDocuments } from "@/lib/documents";
import { AssistantClient } from "@/components/AssistantClient";

export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const db = getDb();

  const docs = listUserDocuments(user.id).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
  }));

  const convRows = db
    .prepare(
      `SELECT c.*, d.name as document_name,
         (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) as message_count
       FROM ai_conversations c
       LEFT JOIN documents d ON d.id = c.document_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(user.id);

  const conversations = convRows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    document_id: r.document_id ? String(r.document_id) : null,
    document_name: r.document_name ? String(r.document_name) : null,
    category_filter: r.category_filter ? String(r.category_filter) : null,
    message_count: Number(r.message_count || 0),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));

  return (
    <AssistantClient
      initialConversations={conversations}
      documents={docs}
      initialDocumentId={sp.documentId || ""}
    />
  );
}
