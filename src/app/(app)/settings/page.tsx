import { requireAuth } from "@/lib/auth-guard";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Configurações</h2>
      <SettingsForm user={{ name: session.user.name ?? "", email: session.user.email ?? "" }} />
    </div>
  );
}
