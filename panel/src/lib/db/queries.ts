import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  auditLog,
  clients,
  clientServices,
  memberships,
  movements,
  notifications,
  users,
} from "./schema";
import type { MembershipStatus, ServiceStatus, ServiceType, PaymentKind } from "@/lib/constants";
import { daysOverdue, daysUntilDue, monthKey } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/*  Dashboard: resumen, serie mensual y desglose por categoría                 */
/* -------------------------------------------------------------------------- */

export type Summary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export async function getSummary(from: string, to: string): Promise<Summary> {
  const rows = await db
    .select({
      kind: movements.kind,
      total: sql<number>`coalesce(sum(${movements.amountCents}), 0)`,
    })
    .from(movements)
    .where(and(gte(movements.movementDate, from), lte(movements.movementDate, to)))
    .groupBy(movements.kind);

  let incomeCents = 0;
  let expenseCents = 0;
  for (const row of rows) {
    const total = Number(row.total) || 0;
    if (row.kind === "income") incomeCents += total;
    else expenseCents += total;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export type SeriesPoint = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

function monthKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export async function getMonthlySeries(from: string, to: string): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      month: sql<string>`substr(${movements.movementDate}, 1, 7)`,
      kind: movements.kind,
      total: sql<number>`coalesce(sum(${movements.amountCents}), 0)`,
    })
    .from(movements)
    .where(and(gte(movements.movementDate, from), lte(movements.movementDate, to)))
    .groupBy(sql`substr(${movements.movementDate}, 1, 7)`, movements.kind);

  const map = new Map<string, SeriesPoint>();
  for (const key of monthKeysBetween(from, to)) {
    map.set(key, { month: key, incomeCents: 0, expenseCents: 0, netCents: 0 });
  }
  for (const row of rows) {
    const point = map.get(row.month);
    if (!point) continue;
    const total = Number(row.total) || 0;
    if (row.kind === "income") point.incomeCents += total;
    else point.expenseCents += total;
    point.netCents = point.incomeCents - point.expenseCents;
  }
  return Array.from(map.values());
}

export type CategoryTotal = { category: string; totalCents: number };

export async function getCategoryBreakdown(
  from: string,
  to: string,
  kind: "income" | "expense",
): Promise<CategoryTotal[]> {
  const rows = await db
    .select({
      category: movements.category,
      total: sql<number>`coalesce(sum(${movements.amountCents}), 0)`,
    })
    .from(movements)
    .where(
      and(
        eq(movements.kind, kind),
        gte(movements.movementDate, from),
        lte(movements.movementDate, to),
      ),
    )
    .groupBy(movements.category)
    .orderBy(desc(sql`coalesce(sum(${movements.amountCents}), 0)`));

  return rows.map((r) => ({ category: r.category, totalCents: Number(r.total) || 0 }));
}

/* -------------------------------------------------------------------------- */
/*  Movimientos                                                               */
/* -------------------------------------------------------------------------- */

export type MovementRow = {
  id: string;
  kind: "income" | "expense";
  category: string;
  amountCents: number;
  description: string | null;
  movementDate: string;
  clientId: string | null;
  clientName: string | null;
  isSharedProfit: number;
  vendoSharePct: number | null;
  linkedMovementId: string | null;
  createdAt: string;
};

export type MovementFilters = {
  kind?: "income" | "expense";
  category?: string;
  from?: string;
  to?: string;
  clientId?: string;
  q?: string;
};

export async function listMovements(filters: MovementFilters = {}): Promise<MovementRow[]> {
  const conditions = [];
  if (filters.kind) conditions.push(eq(movements.kind, filters.kind));
  if (filters.category) conditions.push(eq(movements.category, filters.category));
  if (filters.from) conditions.push(gte(movements.movementDate, filters.from));
  if (filters.to) conditions.push(lte(movements.movementDate, filters.to));
  if (filters.clientId) conditions.push(eq(movements.clientId, filters.clientId));
  if (filters.q) conditions.push(like(movements.description, `%${filters.q}%`));

  const rows = await db
    .select({
      id: movements.id,
      kind: movements.kind,
      category: movements.category,
      amountCents: movements.amountCents,
      description: movements.description,
      movementDate: movements.movementDate,
      clientId: movements.clientId,
      clientName: clients.fullName,
      isSharedProfit: movements.isSharedProfit,
      vendoSharePct: movements.vendoSharePct,
      linkedMovementId: movements.linkedMovementId,
      createdAt: movements.createdAt,
    })
    .from(movements)
    .leftJoin(clients, eq(clients.id, movements.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(movements.movementDate), desc(movements.createdAt))
    .limit(500);

  return rows as MovementRow[];
}

export async function getMovementById(id: string): Promise<MovementRow | null> {
  const rows = await db
    .select({
      id: movements.id,
      kind: movements.kind,
      category: movements.category,
      amountCents: movements.amountCents,
      description: movements.description,
      movementDate: movements.movementDate,
      clientId: movements.clientId,
      clientName: clients.fullName,
      isSharedProfit: movements.isSharedProfit,
      vendoSharePct: movements.vendoSharePct,
      linkedMovementId: movements.linkedMovementId,
      createdAt: movements.createdAt,
    })
    .from(movements)
    .leftJoin(clients, eq(clients.id, movements.clientId))
    .where(eq(movements.id, id))
    .limit(1);
  return (rows[0] as MovementRow) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Clientes                                                                  */
/* -------------------------------------------------------------------------- */

export type ClientServiceRow = {
  id: string;
  serviceType: ServiceType;
  paymentKind: PaymentKind;
  amountCents: number;
  status: ServiceStatus;
  startDate: string;
  membershipId: string | null;
  nextDueDate: string | null;
  billingDay: number | null;
  membershipStatus: MembershipStatus | null;
  lastPaymentDate: string | null;
};

export type ClientSummary = {
  id: string;
  fullName: string;
  email: string | null;
  whatsappNumber: string | null;
  notes: string | null;
  isActive: number;
  createdAt: string;
  services: ClientServiceRow[];
  isEntrepreneur: boolean;
  worstStatus: MembershipStatus | null;
};

const STATUS_RANK: Record<MembershipStatus, number> = {
  al_dia: 1,
  proximo_a_vencer: 2,
  vencido: 3,
  suspendido: 4,
};

function worstStatusOf(statuses: MembershipStatus[]): MembershipStatus | null {
  if (!statuses.length) return null;
  return statuses.reduce((worst, current) =>
    STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst,
  );
}

async function loadServicesByClient(): Promise<Map<string, ClientServiceRow[]>> {
  const rows = await db
    .select({
      id: clientServices.id,
      clientId: clientServices.clientId,
      serviceType: clientServices.serviceType,
      paymentKind: clientServices.paymentKind,
      amountCents: clientServices.amountCents,
      status: clientServices.status,
      startDate: clientServices.startDate,
      membershipId: memberships.id,
      nextDueDate: memberships.nextDueDate,
      billingDay: memberships.billingDay,
      membershipStatus: memberships.status,
      lastPaymentDate: memberships.lastPaymentDate,
    })
    .from(clientServices)
    .leftJoin(memberships, eq(memberships.clientServiceId, clientServices.id))
    .orderBy(clientServices.startDate);

  const map = new Map<string, ClientServiceRow[]>();
  for (const row of rows) {
    const list = map.get(row.clientId) ?? [];
    list.push({
      id: row.id,
      serviceType: row.serviceType as ServiceType,
      paymentKind: row.paymentKind as PaymentKind,
      amountCents: Number(row.amountCents),
      status: row.status as ServiceStatus,
      startDate: row.startDate,
      membershipId: row.membershipId,
      nextDueDate: row.nextDueDate,
      billingDay: row.billingDay,
      membershipStatus: (row.membershipStatus as MembershipStatus) ?? null,
      lastPaymentDate: row.lastPaymentDate,
    });
    map.set(row.clientId, list);
  }
  return map;
}

export async function listClients(filters: { q?: string; serviceType?: string } = {}): Promise<
  ClientSummary[]
> {
  const conditions = [];
  if (filters.q) {
    conditions.push(
      or(
        like(clients.fullName, `%${filters.q}%`),
        like(clients.email, `%${filters.q}%`),
        like(clients.whatsappNumber, `%${filters.q}%`),
      ),
    );
  }

  const clientRows = await db
    .select()
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(clients.createdAt));

  const servicesMap = await loadServicesByClient();

  const result: ClientSummary[] = clientRows.map((client) => {
    const services = servicesMap.get(client.id) ?? [];
    const recurringActive = services.filter(
      (svc) => svc.paymentKind === "recurring" && svc.status === "active",
    );
    const statuses = recurringActive
      .map((svc) => svc.membershipStatus)
      .filter((value): value is MembershipStatus => Boolean(value));
    return {
      id: client.id,
      fullName: client.fullName,
      email: client.email,
      whatsappNumber: client.whatsappNumber,
      notes: client.notes,
      isActive: client.isActive,
      createdAt: client.createdAt,
      services,
      isEntrepreneur: recurringActive.length > 0,
      worstStatus: worstStatusOf(statuses),
    };
  });

  if (filters.serviceType) {
    return result.filter((c) => c.services.some((svc) => svc.serviceType === filters.serviceType));
  }
  return result;
}

export async function getClientDetail(id: string): Promise<ClientSummary | null> {
  const clientRows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  const client = clientRows[0];
  if (!client) return null;
  const servicesMap = await loadServicesByClient();
  const services = servicesMap.get(client.id) ?? [];
  const recurringActive = services.filter(
    (svc) => svc.paymentKind === "recurring" && svc.status === "active",
  );
  const statuses = recurringActive
    .map((svc) => svc.membershipStatus)
    .filter((value): value is MembershipStatus => Boolean(value));
  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email,
    whatsappNumber: client.whatsappNumber,
    notes: client.notes,
    isActive: client.isActive,
    createdAt: client.createdAt,
    services,
    isEntrepreneur: recurringActive.length > 0,
    worstStatus: worstStatusOf(statuses),
  };
}

export async function listClientsBasic(): Promise<{ id: string; fullName: string }[]> {
  return db
    .select({ id: clients.id, fullName: clients.fullName })
    .from(clients)
    .orderBy(clients.fullName);
}

/* -------------------------------------------------------------------------- */
/*  Cobros recurrentes                                                        */
/* -------------------------------------------------------------------------- */

export type MembershipOverviewRow = {
  membershipId: string;
  clientServiceId: string;
  clientId: string;
  clientName: string;
  whatsappNumber: string | null;
  email: string | null;
  serviceType: ServiceType;
  amountCents: number;
  billingDay: number;
  startDate: string;
  nextDueDate: string;
  lastPaymentDate: string | null;
  status: MembershipStatus;
  suspensionDate: string | null;
  daysOverdue: number;
  daysUntilDue: number;
};

export async function listMembershipOverview(): Promise<MembershipOverviewRow[]> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      clientServiceId: clientServices.id,
      clientId: clients.id,
      clientName: clients.fullName,
      whatsappNumber: clients.whatsappNumber,
      email: clients.email,
      serviceType: clientServices.serviceType,
      amountCents: clientServices.amountCents,
      billingDay: memberships.billingDay,
      startDate: clientServices.startDate,
      nextDueDate: memberships.nextDueDate,
      lastPaymentDate: memberships.lastPaymentDate,
      status: memberships.status,
      suspensionDate: memberships.suspensionDate,
    })
    .from(memberships)
    .innerJoin(clientServices, eq(clientServices.id, memberships.clientServiceId))
    .innerJoin(clients, eq(clients.id, clientServices.clientId))
    .orderBy(memberships.nextDueDate);

  return rows.map((row) => ({
    membershipId: row.membershipId,
    clientServiceId: row.clientServiceId,
    clientId: row.clientId,
    clientName: row.clientName,
    whatsappNumber: row.whatsappNumber,
    email: row.email,
    serviceType: row.serviceType as ServiceType,
    amountCents: Number(row.amountCents),
    billingDay: row.billingDay,
    startDate: row.startDate,
    nextDueDate: row.nextDueDate,
    lastPaymentDate: row.lastPaymentDate,
    status: row.status as MembershipStatus,
    suspensionDate: row.suspensionDate,
    daysOverdue: daysOverdue(row.nextDueDate),
    daysUntilDue: daysUntilDue(row.nextDueDate),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Notificaciones                                                            */
/* -------------------------------------------------------------------------- */

export type NotificationRow = {
  id: string;
  type: string;
  membershipId: string;
  clientId: string;
  clientName: string;
  message: string;
  isRead: number;
  createdAt: string;
};

export async function countUnreadNotifications(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, 0));
  return Number(rows[0]?.total) || 0;
}

export async function listUnreadNotifications(limit = 30): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      membershipId: notifications.membershipId,
      clientId: clients.id,
      clientName: clients.fullName,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(memberships, eq(memberships.id, notifications.membershipId))
    .innerJoin(clientServices, eq(clientServices.id, memberships.clientServiceId))
    .innerJoin(clients, eq(clients.id, clientServices.clientId))
    .where(eq(notifications.isRead, 0))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows as NotificationRow[];
}

/* -------------------------------------------------------------------------- */
/*  Audit log                                                                 */
/* -------------------------------------------------------------------------- */

export type AuditRow = {
  id: string;
  userName: string | null;
  tableName: string;
  recordId: string;
  action: string;
  oldValues: string | null;
  newValues: string | null;
  createdAt: string;
};

export async function listAuditLog(
  filters: { tableName?: string; userId?: string } = {},
  limit = 200,
): Promise<AuditRow[]> {
  const conditions = [];
  if (filters.tableName) conditions.push(eq(auditLog.tableName, filters.tableName));
  if (filters.userId) conditions.push(eq(auditLog.userId, filters.userId));

  const rows = await db
    .select({
      id: auditLog.id,
      userName: users.displayName,
      tableName: auditLog.tableName,
      recordId: auditLog.recordId,
      action: auditLog.action,
      oldValues: auditLog.oldValues,
      newValues: auditLog.newValues,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows as AuditRow[];
}
