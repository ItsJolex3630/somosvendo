import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'db', 'schema.sql');
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
  // .dev.vars opcional si ya están en el entorno
}

const rawUrl = String(process.env.TURSO_DATABASE_URL || '').trim();
const token = String(process.env.TURSO_AUTH_TOKEN || '').trim();

if (!rawUrl || !token) {
  console.error('Faltan TURSO_DATABASE_URL y/o TURSO_AUTH_TOKEN en el entorno o en .dev.vars.');
  console.error('Uso: TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/migrate.mjs');
  process.exit(1);
}

const base = rawUrl.replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '');

const sql = readFileSync(schemaPath, 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const statements = sql
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);

if (!statements.length) {
  console.error('No se encontraron sentencias en db/schema.sql');
  process.exit(1);
}

console.log(`Aplicando ${statements.length} sentencias en ${base}`);

const requests = statements.map((statement) => ({
  type: 'execute',
  stmt: { sql: statement, args: [] },
}));
requests.push({ type: 'close' });

const response = await fetch(`${base}/v2/pipeline`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ requests }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(body);
} catch {
  console.error('Respuesta no válida de Turso:', body.slice(0, 300));
  process.exit(1);
}

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

console.log(`✓ Migración completada (${statements.length} sentencias aplicadas).`);
