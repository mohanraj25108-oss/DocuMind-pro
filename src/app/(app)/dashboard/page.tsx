import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/documents";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const initialData = getDashboardData(user.id);
  return <DashboardClient initialData={initialData} />;
}
