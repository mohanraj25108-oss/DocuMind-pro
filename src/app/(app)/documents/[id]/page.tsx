import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDocumentById, listUserReminders } from "@/lib/documents";
import { DocumentDetailClient } from "@/components/DocumentDetailClient";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const doc = getDocumentById(user.id, id);
  if (!doc) {
    notFound();
  }

  const reminders = listUserReminders(user.id).filter((r) => r.document_id === id);
  return <DocumentDetailClient initialDocument={doc} initialReminders={reminders} />;
}
