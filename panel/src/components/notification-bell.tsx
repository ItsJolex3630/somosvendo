"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import type { NotificationRow } from "@/lib/db/queries";

const TYPE_LABEL: Record<string, string> = {
  payment_due_soon: "Próximo a vencer",
  payment_overdue: "Pago vencido",
  suspension_suggested: "Sugerencia de suspensión",
};

export function NotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label="Notificaciones"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">Notificaciones</span>
            {count > 0 ? (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Check className="h-3 w-3" /> Marcar leídas
                </Button>
              </form>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sin notificaciones.
              </p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href="/cobros"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">
                      {TYPE_LABEL[n.type] ?? n.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm">{n.message}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
