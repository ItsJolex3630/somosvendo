-- ============================================
-- Migración 0001 — Esquema inicial Panel Vendo
-- Motor: libSQL / SQLite (Turso)
-- No inserta datos de negocio (ver scripts/seed.ts)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT,
  whatsapp_number TEXT,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_services (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN
                 ('web_dev','hosting','vendo_conecta','nfc_cards',
                  'photography','branding','feature_implementation')),
  payment_kind TEXT NOT NULL CHECK (payment_kind IN ('one_time','recurring')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN
                 ('active','completed','suspended','cancelled')),
  start_date   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id                 TEXT PRIMARY KEY,
  client_service_id  TEXT NOT NULL UNIQUE REFERENCES client_services(id) ON DELETE CASCADE,
  billing_day        INTEGER NOT NULL CHECK (billing_day BETWEEN 1 AND 28),
  next_due_date      TEXT NOT NULL,
  last_payment_date  TEXT,
  status             TEXT NOT NULL DEFAULT 'al_dia' CHECK (status IN
                       ('al_dia','proximo_a_vencer','vencido','suspendido')),
  suspension_date    TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS movements (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('income','expense')),
  category          TEXT NOT NULL CHECK (category IN
                      ('web_sale','hosting_monthly','vendo_conecta_monthly',
                       'feature_implementation','photography','branding',
                       'subscription','nfc_reinvestment','unexpected',
                       'savings','partner_payout')),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  description       TEXT,
  movement_date     TEXT NOT NULL,
  client_id         TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_service_id TEXT REFERENCES client_services(id) ON DELETE SET NULL,
  is_shared_profit  INTEGER NOT NULL DEFAULT 0,
  vendo_share_pct   REAL CHECK (vendo_share_pct IS NULL OR (vendo_share_pct BETWEEN 0 AND 100)),
  linked_movement_id TEXT REFERENCES movements(id) ON DELETE SET NULL,
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id                        TEXT PRIMARY KEY CHECK (id = 'global'),
  photography_vendo_pct     REAL NOT NULL DEFAULT 50.0 CHECK (photography_vendo_pct BETWEEN 0 AND 100),
  branding_vendo_pct        REAL NOT NULL DEFAULT 50.0 CHECK (branding_vendo_pct BETWEEN 0 AND 100),
  days_before_due_warning   INTEGER NOT NULL DEFAULT 5,
  days_overdue_to_suspend   INTEGER NOT NULL DEFAULT 7,
  whatsapp_reminder_template TEXT NOT NULL,
  email_reminder_subject    TEXT NOT NULL,
  email_reminder_template   TEXT NOT NULL,
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN
                  ('payment_due_soon','payment_overdue','suspension_suggested')),
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_services_client   ON client_services(client_id);
CREATE INDEX IF NOT EXISTS idx_movements_date    ON movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_movements_client  ON movements(client_id);
CREATE INDEX IF NOT EXISTS idx_movements_kind    ON movements(kind, category);
CREATE INDEX IF NOT EXISTS idx_memberships_due   ON memberships(next_due_date, status);
CREATE INDEX IF NOT EXISTS idx_notifications     ON notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_record      ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
