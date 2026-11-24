import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/documents";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const dash = getDashboardData(user.id);

  return (
    <AppShell
      initialUser={user}
      initialSettings={dash.settings}
      initialUnreadNotifications={dash.unreadNotificationsCount}
      initialPendingReminders={dash.pendingRemindersCount}
    >
      {children}
    </AppShell>
  );
}
