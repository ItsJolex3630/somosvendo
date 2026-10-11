"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { auditedWrite } from "@/lib/db/audit";
import { requireUser } from "@/lib/auth/session";
import { SETTINGS_ID } from "@/lib/settings";
import { roundPct } from "@/lib/money";
import { clampInt, float, int, s } from "@/lib/validators";

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  const existing = (
    await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1)
  )[0];
  if (!existing) throw new Error("Falta la fila global de settings. Corre `npm run seed`.");

  const payload = {
    photographyVendoPct: roundPct(
      float(formData, "photography_vendo_pct", existing.photographyVendoPct),
    ),
    brandingVendoPct: roundPct(float(formData, "branding_vendo_pct", existing.brandingVendoPct)),
    daysBeforeDueWarning: clampInt(
      int(formData, "days_before_due_warning", existing.daysBeforeDueWarning),
      0,
      60,
    ),
    daysOverdueToSuspend: clampInt(
      int(formData, "days_overdue_to_suspend", existing.daysOverdueToSuspend),
      0,
      120,
    ),
    whatsappReminderTemplate:
      s(formData, "whatsapp_reminder_template") || existing.whatsappReminderTemplate,
    emailReminderSubject: s(formData, "email_reminder_subject") || existing.emailReminderSubject,
    emailReminderTemplate:
      s(formData, "email_reminder_template") || existing.emailReminderTemplate,
  };

  const now = new Date().toISOString();
  await auditedWrite(user.id, "settings", SETTINGS_ID, "update", existing, payload, async (tx) => {
    await tx.update(settings).set({ ...payload, updatedAt: now }).where(eq(settings.id, SETTINGS_ID));
  });

  revalidatePath("/ajustes");
  revalidatePath("/cobros");
}
