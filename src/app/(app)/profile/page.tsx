import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ProfileClient } from "@/components/ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as docCount, COALESCE(SUM(file_size), 0) as totalBytes FROM documents WHERE user_id = ?"
    )
    .get(user.id) as Record<string, unknown>;

  return (
    <ProfileClient
      initialUser={user}
      docCount={Number(row?.docCount || 0)}
      totalBytes={Number(row?.totalBytes || 0)}
    />
  );
}
