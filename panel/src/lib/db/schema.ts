import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(datetime('now'))`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({ idx_sessions_user: index("idx_sessions_user").on(t.userId) }),
);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  whatsappNumber: text("whatsapp_number"),
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const clientServices = sqliteTable(
  "client_services",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    serviceType: text("service_type").notNull(),
    paymentKind: text("payment_kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("active"),
    startDate: text("start_date").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({ idx_services_client: index("idx_services_client").on(t.clientId) }),
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    clientServiceId: text("client_service_id")
      .notNull()
      .unique()
      .references(() => clientServices.id, { onDelete: "cascade" }),
    billingDay: integer("billing_day").notNull(),
    nextDueDate: text("next_due_date").notNull(),
    lastPaymentDate: text("last_payment_date"),
    status: text("status").notNull().default("al_dia"),
    suspensionDate: text("suspension_date"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({ idx_memberships_due: index("idx_memberships_due").on(t.nextDueDate, t.status) }),
);

export const movements = sqliteTable(
  "movements",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
    movementDate: text("movement_date").notNull(),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    clientServiceId: text("client_service_id").references(() => clientServices.id, {
      onDelete: "set null",
    }),
    isSharedProfit: integer("is_shared_profit").notNull().default(0),
    vendoSharePct: real("vendo_share_pct"),
    linkedMovementId: text("linked_movement_id"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => ({
    idx_movements_date: index("idx_movements_date").on(t.movementDate),
    idx_movements_client: index("idx_movements_client").on(t.clientId),
    idx_movements_kind: index("idx_movements_kind").on(t.kind, t.category),
  }),
);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  photographyVendoPct: real("photography_vendo_pct").notNull().default(50),
  brandingVendoPct: real("branding_vendo_pct").notNull().default(50),
  daysBeforeDueWarning: integer("days_before_due_warning").notNull().default(5),
  daysOverdueToSuspend: integer("days_overdue_to_suspend").notNull().default(7),
  whatsappReminderTemplate: text("whatsapp_reminder_template").notNull(),
  emailReminderSubject: text("email_reminder_subject").notNull(),
  emailReminderTemplate: text("email_reminder_template").notNull(),
  updatedAt: text("updated_at").notNull().default(now),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    membershipId: text("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isRead: integer("is_read").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({ idx_notifications: index("idx_notifications").on(t.isRead, t.createdAt) }),
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    action: text("action").notNull(),
    oldValues: text("old_values"),
    newValues: text("new_values"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => ({ idx_audit_record: index("idx_audit_record").on(t.tableName, t.recordId) }),
);
