// Post-build: mueve los scripts INLINE del HTML prerenderizado a ficheros externos.
//
// Motivo: el CSP vigente (`Website/_headers`) es `script-src 'self' ...` sin
// 'unsafe-inline' ni nonce, por lo que TanStack Start no puede hidratar si deja sus
// scripts de arranque inline (`$_TSR`, scroll-restoration y boundary). Este paso los
// externaliza a `/admin/assets/inline-*.js` (mismo origen → permitidos por 'self'),
// preservando orden y atributos. No toca _headers ni el código de la app.
//
// Uso: node scripts/externalize-inline-scripts.mjs   (procesa dist/client/**/*.html)
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const clientDir = join(root, "..", "dist", "client");
const adminOutDir = join(root, "..", "..", "admin");
const assetsDir = join(clientDir, "assets");
mkdirSync(assetsDir, { recursive: true });

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".html")) out.push(full);
  }
  return out;
}

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
let totalFiles = 0;
let totalTags = 0;

for (const file of walk(clientDir)) {
  let html = readFileSync(file, "utf8");
  let fileTags = 0;
  html = html.replace(SCRIPT_RE, (whole, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return whole; // ya es externo
    if (!body.trim()) return whole; // vacío, no hace falta
    const hash = createHash("sha1").update(body).digest("hex").slice(0, 12);
    const assetName = `inline-${hash}.js`;
    writeFileSync(join(assetsDir, assetName), body, "utf8");
    const cleanAttrs = attrs.replace(/\s+$/, "");
    fileTags += 1;
    totalTags += 1;
    return `<script${cleanAttrs} src="/admin/assets/${assetName}"></script>`;
  });
  if (fileTags > 0) {
    writeFileSync(file, html, "utf8");
    totalFiles += 1;
    console.log(`  externalized ${fileTags} inline script(s) in ${file.slice(clientDir.length + 1)}`);
  }
}

console.log(`[externalize-inline-scripts] ${totalTags} script(s) across ${totalFiles} file(s).`);

rmSync(adminOutDir, { recursive: true, force: true });
mkdirSync(adminOutDir, { recursive: true });
cpSync(clientDir, adminOutDir, { recursive: true });
console.log(`[externalize-inline-scripts] synced dist/client -> ../admin/`);
