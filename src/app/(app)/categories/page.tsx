import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/documents";
import { CategoriesClient } from "@/components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const user = await requireUser();
  const dash = getDashboardData(user.id);
  return <CategoriesClient categories={dash.categoryDistribution} />;
}
