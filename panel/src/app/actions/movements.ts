"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { auditLog, movements } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { requireUser } from "@/lib/auth/session";
import { parseUsdToCents, partnerCents, roundPct } from "@/lib/money";
import { isSharedProfitCategory } from "@/lib/constants";
import { float, optionalS, s } from "@/lib/validators";
import { todayIso } from "@/lib/format";

export async function createMovement(formData: FormData) {
  const user = await requireUser();

  const kind = s(formData, "kind") === "expense" ? "expense" : "income";
  const category = s(formData, "category");
  const amountCents = parseUsdToCents(s(formData, "amount"));
  const movementDate = s(formData, "date") || todayIso();
  const description = optionalS(formData, "description");
  const clientId = optionalS(formData, "client_id");
  const clientServiceId = optionalS(formData, "client_service_id");

  if (!category) throw new Error("La categoría es obligatoria.");
  if (!amountCents || amountCents <= 0) throw new Error("El monto debe ser mayor a cero.");

  const shared = kind === "income" && isSharedProfitCategory(category);
  const vendoPct = shared ? roundPct(float(formData, "vendo_share_pct", 50)) : null;
  const mainId = nanoid();
  const now = new Date().toISOString();

  await auditedWrite(
    user.id,
    "movements",
    mainId,
    "create",
    null,
    { id: mainId, kind, category, amountCents, movementDate, description },
    async (tx) => {
      await tx.insert(movements).values({
        id: mainId,
        kind,
        category,
        amountCents,
        description,
        movementDate,
        clientId,
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
          clientId,
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
          newValues: JSON.stringify({
            id: partnerId,
            kind: "expense",
            category: "partner_payout",
            amountCents: pCents,
            linkedMovementId: mainId,
          }),
        });
      }
    },
  );

  revalidatePath("/");
  revalidatePath("/movimientos");
  redirect("/movimientos");
}

export async function updateMovement(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(movements).where(eq(movements.id, id)).limit(1))[0];
  if (!existing) throw new Error("Movimiento no encontrado.");

  const amountCents = parseUsdToCents(s(formData, "amount")) ?? existing.amountCents;
  const movementDate = s(formData, "date") || existing.movementDate;
  const description = optionalS(formData, "description");
  const clientId = optionalS(formData, "client_id");
  const vendoPct = existing.isSharedProfit
    ? roundPct(float(formData, "vendo_share_pct", existing.vendoSharePct ?? 50))
    : existing.vendoSharePct;
  const now = new Date().toISOString();

  await auditedWrite(
    user.id,
    "movements",
    id,
    "update",
    existing,
    { amountCents, movementDate, description, vendoSharePct: vendoPct },
    async (tx) => {
      await tx
        .update(movements)
        .set({ amountCents, movementDate, description, clientId, vendoSharePct: vendoPct, updatedAt: now })
        .where(eq(movements.id, id));

      if (existing.isSharedProfit && vendoPct !== null) {
        const pCents = partnerCents(amountCents, vendoPct);
        await tx
          .update(movements)
          .set({ amountCents: pCents, movementDate, updatedAt: now })
          .where(eq(movements.linkedMovementId, id));
      }
    },
  );

  revalidatePath("/");
  revalidatePath("/movimientos");
  redirect("/movimientos");
}

export async function deleteMovement(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(movements).where(eq(movements.id, id)).limit(1))[0];
  if (!existing) return;

  await auditedWrite(user.id, "movements", id, "delete", existing, null, async (tx) => {
    await tx.delete(movements).where(eq(movements.linkedMovementId, id));
    await tx.delete(movements).where(eq(movements.id, id));
  });

  revalidatePath("/");
  revalidatePath("/movimientos");
}
