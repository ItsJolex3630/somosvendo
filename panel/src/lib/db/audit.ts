import { nanoid } from "nanoid";
import { db } from "./client";
import { auditLog } from "./schema";

export type AuditedTable =
  | "clients"
  | "client_services"
  | "movements"
  | "memberships"
  | "settings";

export type AuditAction = "create" | "update" | "delete";

// Drizzle transaction handle. Kept loose on purpose: the transaction callback
// exposes a typed `tx` that varies per driver version.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Único punto de escritura permitido para tablas auditadas.
 * La escritura real y su registro en `audit_log` ocurren en la misma transacción:
 * o se guardan ambas o no se guarda nada.
 */
export async function auditedWrite<T>(
  userId: string | null,
  table: AuditedTable,
  recordId: string,
  action: AuditAction,
  oldValues: object | null,
  newValues: object | null,
  writeFn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await writeFn(tx);
    await tx.insert(auditLog).values({
      id: nanoid(),
      userId,
      tableName: table,
      recordId,
      action,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
    });
    return result;
  });
}
