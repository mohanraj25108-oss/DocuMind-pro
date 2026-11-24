import { requireUser } from "@/lib/auth";
import { listUserDocuments } from "@/lib/documents";
import { CalendarClient } from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser();
  const docs = listUserDocuments(user.id).filter((d) => Boolean(d.expiry_date));
  return <CalendarClient initialDocuments={docs} />;
}
