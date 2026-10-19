import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const devVarsPath = join(here, '..', '.dev.vars');

try {
  const content = readFileSync(devVarsPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match && !process.env[match[1]]) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  }
} catch {
  // opcional
}

const rawUrl = String(process.env.TURSO_DATABASE_URL || '').trim();
const token = String(process.env.TURSO_AUTH_TOKEN || '').trim();
if (!rawUrl || !token) {
  console.error('Faltan TURSO_DATABASE_URL y/o TURSO_AUTH_TOKEN (.dev.vars).');
  process.exit(1);
}
const base = rawUrl.replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '');

const text = (value) => ({ type: 'text', value });

const statements = [
  {
    sql: 'UPDATE tenants SET color_primario = ?, color_secundario = ?, color_fondo = ?, logo_url = ?, updated_at = datetime(\'now\') WHERE slug = ?',
    args: [text('#40201a'), text('#c9a577'), text('#f5ebd4'), text('/assets/clients/masafacil-logo.svg'), text('masafacil')],
  },
  {
    sql: "INSERT OR IGNORE INTO admins (email, nombre, rol) VALUES (?, ?, 'superadmin')",
    args: [text('jolex3630@gmail.com'), text('Jolex')],
  },
  {
    sql: "INSERT OR IGNORE INTO admins (email, nombre, rol) VALUES (?, ?, 'superadmin')",
    args: [text('somosvendo@gmail.com'), text('VENDO')],
  },
  {
    sql: "INSERT OR IGNORE INTO admins (email, nombre, rol) VALUES (?, ?, 'superadmin')",
    args: [text('sebastiiam.castellanoopsu2026@gmail.com'), text('Sebastián')],
  },
];

const requests = statements.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: s.args } }));
requests.push({ type: 'close' });

const response = await fetch(`${base}/v2/pipeline`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
  process.exit(1);
}
const data = JSON.parse(body);
let failed = 0;
(data.results || []).forEach((item, index) => {
  if (item.type !== 'ok') {
    failed += 1;
    console.error(`✗ [${index}] ${JSON.stringify(item.error || item).slice(0, 300)}`);
  }
});
if (failed) {
  console.error(`${failed} de ${statements.length} sentencias fallaron.`);
  process.exit(1);
}
console.log(`✓ Patch de branding aplicado (${statements.length} sentencias).`);
