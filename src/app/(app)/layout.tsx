import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/server/auth/session";
import { navFor, quickCreateFor } from "@/server/nav";
import { liveSnapshot } from "@/server/services/live";
import { currentView } from "@/server/view";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [view, live] = await Promise.all([currentView(user), liveSnapshot(user)]);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, initials: user.initials, role: user.role }}
      nav={navFor(user)}
      quickCreate={quickCreateFor(user)}
      view={{ value: view.value, canSwitch: view.canSwitch, partners: view.partners }}
      live={live}
    >
      {children}
    </AppShell>
  );
}
