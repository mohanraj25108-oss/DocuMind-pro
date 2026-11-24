import { ensureUserSettings, requireUser } from "@/lib/auth";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = ensureUserSettings(user.id);
  return <SettingsClient initialSettings={settings} />;
}
