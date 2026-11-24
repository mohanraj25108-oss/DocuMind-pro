import { requireUser } from "@/lib/auth";
import {
  listUserDocuments,
  listUserReminders,
  syncUserRemindersAndNotifications,
} from "@/lib/documents";
import { RemindersClient } from "@/components/RemindersClient";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await requireUser();
  syncUserRemindersAndNotifications(user.id);
  const reminders = listUserReminders(user.id);
  const docs = listUserDocuments(user.id).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
  }));

  return <RemindersClient initialReminders={reminders} documents={docs} />;
}
