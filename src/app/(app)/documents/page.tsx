import { requireUser } from "@/lib/auth";
import { listUserDocuments, listUserTags } from "@/lib/documents";
import { DocumentsClient } from "@/components/DocumentsClient";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string;
    expiryStatus?: string;
    tag?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const initialDocs = listUserDocuments(user.id);
  const initialTags = listUserTags(user.id);

  return (
    <DocumentsClient
      initialDocuments={initialDocs}
      initialTags={initialTags}
      initialSearch={sp.search || ""}
      initialCategory={sp.category || "all"}
      initialExpiryStatus={sp.expiryStatus || "all"}
      initialTag={sp.tag || "all"}
    />
  );
}
