"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/client";
import { auditLog, clientServices, clients, memberships } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { requireUser } from "@/lib/auth/session";
import { parseUsdToCents } from "@/lib/money";
import { nextDueDate, todayIso } from "@/lib/format";
import { clampInt, int, normalizeWhatsapp, optionalS, s } from "@/lib/validators";

/* -------------------------------------------------------------------------- */
/*  Clientes                                                                  */
/* -------------------------------------------------------------------------- */

export async function createClient(formData: FormData) {
  const user = await requireUser();
  const fullName = s(formData, "full_name");
  if (!fullName) throw new Error("El nombre del cliente es obligatorio.");

  const id = nanoid();
  const now = new Date().toISOString();
  const payload = {
    fullName,
    email: optionalS(formData, "email"),
    whatsappNumber: normalizeWhatsapp(optionalS(formData, "whatsapp")),
    notes: optionalS(formData, "notes"),
  };

  await auditedWrite(user.id, "clients", id, "create", null, { id, ...payload }, async (tx) => {
    await tx.insert(clients).values({ id, ...payload, isActive: 1, updatedAt: now });
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function updateClient(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(clients).where(eq(clients.id, id)).limit(1))[0];
  if (!existing) throw new Error("Cliente no encontrado.");

  const payload = {
    fullName: s(formData, "full_name") || existing.fullName,
    email: optionalS(formData, "email"),
    whatsappNumber: normalizeWhatsapp(optionalS(formData, "whatsapp")),
    notes: optionalS(formData, "notes"),
    isActive: s(formData, "is_active") === "0" ? 0 : 1,
  };
  const now = new Date().toISOString();

  await auditedWrite(user.id, "clients", id, "update", existing, payload, async (tx) => {
    await tx.update(clients).set({ ...payload, updatedAt: now }).where(eq(clients.id, id));
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function deleteClient(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(clients).where(eq(clients.id, id)).limit(1))[0];
  if (!existing) return;

  await auditedWrite(user.id, "clients", id, "delete", existing, null, async (tx) => {
    await tx.delete(clients).where(eq(clients.id, id));
  });

  revalidatePath("/clientes");
  redirect("/clientes");
}

/* -------------------------------------------------------------------------- */
/*  Servicios                                                                 */
/* -------------------------------------------------------------------------- */

export async function createService(formData: FormData) {
  const user = await requireUser();
  const clientId = s(formData, "client_id");
  const serviceType = s(formData, "service_type");
  const paymentKind = s(formData, "payment_kind") === "recurring" ? "recurring" : "one_time";
  const amountCents = parseUsdToCents(s(formData, "amount"));
  const status = s(formData, "status") || "active";
  const startDate = s(formData, "start_date") || todayIso();
  const billingDay = clampInt(int(formData, "billing_day", 1), 1, 28);

  if (!clientId || !serviceType) throw new Error("Datos del servicio incompletos.");
  if (!amountCents || amountCents <= 0) throw new Error("El precio debe ser mayor a cero.");

  const id = nanoid();
  const now = new Date().toISOString();

  await auditedWrite(
    user.id,
    "client_services",
    id,
    "create",
    null,
    { id, clientId, serviceType, paymentKind, amountCents, status, startDate },
    async (tx) => {
      await tx.insert(clientServices).values({
        id,
        clientId,
        serviceType,
        paymentKind,
        amountCents,
        status,
        startDate,
        updatedAt: now,
      });

      if (paymentKind === "recurring") {
        const membershipId = nanoid();
        const nextDue = nextDueDate(billingDay, new Date(`${startDate}T00:00:00Z`));
        await tx.insert(memberships).values({
          id: membershipId,
          clientServiceId: id,
          billingDay,
          nextDueDate: nextDue,
          status: "al_dia",
          updatedAt: now,
        });
        await tx.insert(auditLog).values({
          id: nanoid(),
          userId: user.id,
          tableName: "memberships",
          recordId: membershipId,
          action: "create",
          newValues: JSON.stringify({ id: membershipId, clientServiceId: id, billingDay, nextDueDate: nextDue }),
        });
      }
    },
  );

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/cobros");
  redirect(`/clientes/${clientId}`);
}

export async function updateService(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(clientServices).where(eq(clientServices.id, id)).limit(1))[0];
  if (!existing) throw new Error("Servicio no encontrado.");

  const serviceType = s(formData, "service_type") || existing.serviceType;
  const paymentKind = s(formData, "payment_kind") === "recurring" ? "recurring" : "one_time";
  const amountCents = parseUsdToCents(s(formData, "amount")) ?? existing.amountCents;
  const status = s(formData, "status") || existing.status;
  const startDate = s(formData, "start_date") || existing.startDate;
  const billingDay = clampInt(int(formData, "billing_day", 1), 1, 28);
  const now = new Date().toISOString();
  const membership = (
    await db.select().from(memberships).where(eq(memberships.clientServiceId, id)).limit(1)
  )[0];

  await auditedWrite(
    user.id,
    "client_services",
    id,
    "update",
    existing,
    { serviceType, paymentKind, amountCents, status, startDate },
    async (tx) => {
      await tx
        .update(clientServices)
        .set({ serviceType, paymentKind, amountCents, status, startDate, updatedAt: now })
        .where(eq(clientServices.id, id));

      if (paymentKind === "recurring") {
        if (membership) {
          await tx.update(memberships).set({ billingDay, updatedAt: now }).where(eq(memberships.id, membership.id));
        } else {
          const membershipId = nanoid();
          const nextDue = nextDueDate(billingDay, new Date(`${startDate}T00:00:00Z`));
          await tx.insert(memberships).values({
            id: membershipId,
            clientServiceId: id,
            billingDay,
            nextDueDate: nextDue,
            status: "al_dia",
            updatedAt: now,
          });
        }
      } else if (membership) {
        await tx.delete(memberships).where(eq(memberships.id, membership.id));
      }
    },
  );

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/cobros");
  redirect(`/clientes/${existing.clientId}`);
}

export async function deleteService(formData: FormData) {
  const user = await requireUser();
  const id = s(formData, "id");
  const existing = (await db.select().from(clientServices).where(eq(clientServices.id, id)).limit(1))[0];
  if (!existing) return;

  await auditedWrite(user.id, "client_services", id, "delete", existing, null, async (tx) => {
    await tx.delete(clientServices).where(eq(clientServices.id, id));
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/cobros");
  redirect(`/clientes/${existing.clientId}`);
}
