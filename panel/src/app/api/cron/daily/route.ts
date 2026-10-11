import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { clientServices, clients, memberships, notifications } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { serviceTypeLabel } from "@/lib/constants";
import { daysOverdue, daysUntilDue, todayIso } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const settings = await getSettings();
  const now = new Date().toISOString();

  const rows = await db
    .select({
      membershipId: memberships.id,
      status: memberships.status,
      nextDueDate: memberships.nextDueDate,
      serviceType: clientServices.serviceType,
      clientName: clients.fullName,
    })
    .from(memberships)
    .innerJoin(clientServices, eq(clientServices.id, memberships.clientServiceId))
    .innerJoin(clients, eq(clients.id, clientServices.clientId));

  let statusChanges = 0;
  let notificationsCreated = 0;

  for (const row of rows) {
    if (row.status === "suspendido") continue;

    const overdue = daysOverdue(row.nextDueDate);
    const untilDue = daysUntilDue(row.nextDueDate);

    let nextStatus: "al_dia" | "proximo_a_vencer" | "vencido";
    if (overdue > 0) nextStatus = "vencido";
    else if (untilDue <= settings.daysBeforeDueWarning) nextStatus = "proximo_a_vencer";
    else nextStatus = "al_dia";

    if (nextStatus !== row.status) {
      await auditedWrite(
        null,
        "memberships",
        row.membershipId,
        "update",
        { status: row.status },
        { status: nextStatus },
        async (tx) => {
          await tx
            .update(memberships)
            .set({ status: nextStatus, updatedAt: now })
            .where(eq(memberships.id, row.membershipId));
        },
      );
      statusChanges += 1;
    }

    const servicio = serviceTypeLabel(row.serviceType);
    const events: { type: string; message: string }[] = [];

    if (nextStatus === "proximo_a_vencer") {
      events.push({
        type: "payment_due_soon",
        message: `${row.clientName}: ${servicio} vence el ${row.nextDueDate} (${untilDue} día(s)).`,
      });
    }
    if (nextStatus === "vencido") {
      events.push({
        type: "payment_overdue",
        message: `${row.clientName}: ${servicio} venció el ${row.nextDueDate} (${overdue} día(s) de mora).`,
      });
    }
    if (overdue >= settings.daysOverdueToSuspend) {
      events.push({
        type: "suspension_suggested",
        message: `${row.clientName}: ${servicio} supera ${settings.daysOverdueToSuspend} días de mora. Sugerimos suspender el servicio.`,
      });
    }

    for (const event of events) {
      const existing = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.membershipId, row.membershipId),
            eq(notifications.type, event.type),
            sql`date(${notifications.createdAt}) = ${todayIso()}`,
          ),
        )
        .limit(1);
      if (existing.length) continue;

      await db.insert(notifications).values({
        id: nanoid(),
        type: event.type,
        membershipId: row.membershipId,
        message: event.message,
      });
      notificationsCreated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    total: rows.length,
    statusChanges,
    notificationsCreated,
  });
}
