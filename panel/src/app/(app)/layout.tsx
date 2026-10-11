import { requireUser } from "@/lib/auth/session";
import { listUnreadNotifications } from "@/lib/db/queries";
import { Header } from "@/components/header";
import { MobileNav, Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await listUnreadNotifications(20);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen w-full flex-col">
        <Header user={user} notifications={notifications} />
        <MobileNav />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
