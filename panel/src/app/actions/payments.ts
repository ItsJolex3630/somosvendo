"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { auditLog, clientServices, memberships, movements } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { requireUser } from "@/lib/auth/session";
import { partnerCents, parseUsdToCents, roundPct } from "@/lib/money";
import {
  SERVICE_TO_CATEGORY,
  isSharedProfitCategory,
  type ServiceType,
} from "@/lib/constants";
import { float, optionalS, s } from "@/lib/validators";
import { nextDueDate, todayIso } from "@/lib/format";

/**
 * Registra el pago de un servicio: crea el ingreso en el CRM y, si el servicio
 * es recurrente, avanza la membresía (last_payment_date + next_due_date) en la
 * misma transacción auditada.
 */
export async function registerPayment(formData: FormData) {
  const user = await requireUser();
  const clientServiceId = s(formData, "client_service_id");

  const service = (
    await db.select().from(clientServices).where(eq(clientServices.id, clientServiceId)).limit(1)
  )[0];
  if (!service) throw new Error("Servicio no encontrado.");

  const amountCents = parseUsdToCents(s(formData, "amount")) ?? service.amountCents;
  if (!amountCents || amountCents <= 0) throw new Error("El monto debe ser mayor a cero.");

  const movementDate = s(formData, "date") || todayIso();
  const category =
    s(formData, "category") || SERVICE_TO_CATEGORY[service.serviceType as ServiceType] || "web_sale";
  const description = optionalS(formData, "description") || `Pago — ${service.serviceType}`;
  const shared = isSharedProfitCategory(category);
  const vendoPct = shared ? roundPct(float(formData, "vendo_share_pct", 50)) : null;
  const now = new Date().toISOString();
  const redirectTo = s(formData, "redirect_to") || "/cobros";

  const membership = (
    await db.select().from(memberships).where(eq(memberships.clientServiceId, clientServiceId)).limit(1)
  )[0];

  const mainId = nanoid();

  await auditedWrite(
    user.id,
    "movements",
    mainId,
    "create",
    null,
    { id: mainId, kind: "income", category, amountCents, movementDate, clientServiceId },
    async (tx) => {
      await tx.insert(movements).values({
        id: mainId,
        kind: "income",
        category,
        amountCents,
        description,
        movementDate,
        clientId: service.clientId,
        clientServiceId,
        isSharedProfit: shared ? 1 : 0,
        vendoSharePct: vendoPct,
        createdBy: user.id,
        updatedAt: now,
      });

      if (shared && vendoPct !== null) {
        const pCents = partnerCents(amountCents, vendoPct);
        const partnerId = nanoid();
        await tx.insert(movements).values({
          id: partnerId,
          kind: "expense",
          category: "partner_payout",
          amountCents: pCents,
          description: `Pago a socio — ${category}`,
          movementDate,
          clientId: service.clientId,
          clientServiceId,
          isSharedProfit: 0,
          linkedMovementId: mainId,
          createdBy: user.id,
          updatedAt: now,
        });
        await tx.insert(auditLog).values({
          id: nanoid(),
          userId: user.id,
          tableName: "movements",
          recordId: partnerId,
          action: "create",
          newValues: JSON.stringify({ id: partnerId, category: "partner_payout", amountCents: pCents, linkedMovementId: mainId }),
        });
      }

      if (membership) {
        const nextDue = nextDueDate(membership.billingDay);
        await tx
          .update(memberships)
          .set({
            lastPaymentDate: movementDate,
            nextDueDate: nextDue,
            status: "al_dia",
            suspensionDate: null,
            updatedAt: now,
          })
          .where(eq(memberships.id, membership.id));
        await tx.insert(auditLog).values({
          id: nanoid(),
          userId: user.id,
          tableName: "memberships",
          recordId: membership.id,
          action: "update",
          oldValues: JSON.stringify({ status: membership.status, nextDueDate: membership.nextDueDate }),
          newValues: JSON.stringify({ status: "al_dia", nextDueDate: nextDue, lastPaymentDate: movementDate }),
        });
      }
    },
  );

  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/cobros");
  revalidatePath(`/clientes/${service.clientId}`);
  redirect(redirectTo);
}
