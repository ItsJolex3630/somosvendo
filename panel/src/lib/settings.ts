import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { settings } from "./db/schema";

export type Settings = typeof settings.$inferSelect;

export const SETTINGS_ID = "global";

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
  if (!rows[0]) {
    throw new Error("No existe la fila 'global' de settings. Ejecuta `npm run seed`.");
  }
  return rows[0];
}
