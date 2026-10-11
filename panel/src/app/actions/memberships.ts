"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { requireUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/format";
import { s } from "@/lib/validators";

export async function suspendMembership(formData: FormData) {
  const user = await requireUser();
  const membershipId = s(formData, "membership_id");
  const existing = (
    await db.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1)
  )[0];
  if (!existing) return;

  const now = new Date().toISOString();
  await auditedWrite(
    user.id,
    "memberships",
    membershipId,
    "update",
    existing,
    { status: "suspendido", suspensionDate: todayIso() },
    async (tx) => {
      await tx
        .update(memberships)
        .set({ status: "suspendido", suspensionDate: todayIso(), updatedAt: now })
        .where(eq(memberships.id, membershipId));
    },
  );

  revalidatePath("/cobros");
  revalidatePath("/");
}
