"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";

export async function markAllNotificationsRead() {
  await requireUser();
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.isRead, 0));
  revalidatePath("/");
  revalidatePath("/cobros");
}
