CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  logo_url TEXT,
  color_primario TEXT NOT NULL DEFAULT '#cef17b',
  color_secundario TEXT NOT NULL DEFAULT '#01442c',
  color_fondo TEXT NOT NULL DEFAULT '#01110a',
  precio REAL NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'USD',
  beneficios TEXT NOT NULL DEFAULT '[]',
  metodos_pago TEXT NOT NULL DEFAULT '{}',
  whatsapp TEXT,
  instrucciones_pago TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS miembros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','activo','gracia','vencido','rechazado')),
  fecha_inicio TEXT,
  fecha_fin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  miembro_id INTEGER NOT NULL,
  referencia TEXT NOT NULL,
  metodo TEXT NOT NULL,
  monto REAL,
  moneda TEXT,
  captura_url TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','rechazado')),
  motivo_rechazo TEXT,
  revisado_por TEXT,
  revisado_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, referencia),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  evento TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','fallido')),
  intentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  procesado_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin','superadmin','revisor')),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reglas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, clave),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_miembros_tenant ON miembros (tenant_id);
CREATE INDEX IF NOT EXISTS idx_miembros_estado ON miembros (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_pagos_tenant_estado ON pagos (tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_pagos_miembro ON pagos (miembro_id);
CREATE INDEX IF NOT EXISTS idx_pagos_referencia ON pagos (tenant_id, referencia);
CREATE INDEX IF NOT EXISTS idx_webhooks_estado ON webhook_eventos (estado);
CREATE INDEX IF NOT EXISTS idx_reglas_tenant ON reglas (tenant_id);

INSERT OR IGNORE INTO tenants (slug, nombre, descripcion, color_primario, color_secundario, color_fondo, precio, moneda, beneficios, metodos_pago, whatsapp, instrucciones_pago, activo) VALUES ('masafacil', 'MasaFácil', 'Club de fidelización de clientes de MasaFácil', '#cef17b', '#01442c', '#01110a', 10, 'USD', '["Descuento exclusivo de miembro en cada compra","Envío gratis en pedidos seleccionados","Ofertas y combos solo para el club","Atención preferencial por WhatsApp"]', '{"pago_movil":{"banco":"","telefono":"","cedula":"","titular":""},"zelle":{"correo":"","titular":""}}', '+584149428999', 'Realiza tu pago y reporta la referencia. Un administrador verificará y activará tu membresía por 30 días.', 1);

INSERT OR IGNORE INTO admins (email, nombre, rol) VALUES
  ('somosvendo.ve@gmail.com', 'VENDO Superadmin', 'superadmin'),
  ('admin@somosvendo.ve', 'Administrador VENDO', 'superadmin');

INSERT OR IGNORE INTO reglas (tenant_id, clave, valor, descripcion) SELECT id, 'duracion_dias', '30', 'Días de vigencia al confirmar un pago' FROM tenants WHERE slug = 'masafacil';
INSERT OR IGNORE INTO reglas (tenant_id, clave, valor, descripcion) SELECT id, 'gracia_dias', '3', 'Días de gracia tras el vencimiento' FROM tenants WHERE slug = 'masafacil';
INSERT OR IGNORE INTO reglas (tenant_id, clave, valor, descripcion) SELECT id, 'recordatorio_dias', '5', 'Días antes del vencimiento para recordar la renovación' FROM tenants WHERE slug = 'masafacil';
