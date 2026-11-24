import { requireUser } from "@/lib/auth";
import { listUserActivity } from "@/lib/documents";
import { ActivityClient } from "@/components/ActivityClient";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const user = await requireUser();
  const activities = listUserActivity(user.id, 150);
  return <ActivityClient initialActivities={activities} />;
}
