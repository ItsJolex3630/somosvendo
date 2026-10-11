import { logout } from "@/app/login/actions";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import type { NotificationRow } from "@/lib/db/queries";

export function Header({
  user,
  notifications,
}: {
  user: SessionUser;
  notifications: NotificationRow[];
}) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-card/40 px-4 md:px-6">
      <div className="font-semibold md:hidden">Vendo</div>
      <div className="ml-auto flex items-center gap-3">
        <NotificationBell notifications={notifications} />
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight">{user.displayName}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Salir
          </Button>
        </form>
      </div>
    </header>
  );
}
