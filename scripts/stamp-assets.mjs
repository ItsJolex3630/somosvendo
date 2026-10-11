// Versiona (cache-busting) los assets referenciados en index.html.
//
// Motivo: el landing referencia `assets/css/main.css` y `assets/js/main.js` con
// nombre fijo. Un navegador que guardó una copia vieja (con una cabecera de caché
// anterior) puede seguir sirviéndola y mostrar el sitio "atrasado". Añadir
// `?v=<hash>` fuerza una URL nueva cuando el contenido cambia, sin tocar el
// nombre del archivo.
//
// Uso:  node scripts/stamp-assets.mjs
// Ejecútalo cada vez que cambies assets/css/main.css o assets/js/main.js (y antes
// de desplegar). Es idempotente.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "index.html");
let html = readFileSync(htmlPath, "utf8");

const refs = [...html.matchAll(/(?:href|src)="(assets\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g)].map((m) => m[1]);
const unique = [...new Set(refs)];

let stamped = 0;
for (const rel of unique) {
  const hash = createHash("sha1").update(readFileSync(join(root, rel))).digest("hex").slice(0, 8);
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(href|src)="${escaped}(?:\\?v=[^"]*)?"`, "g");
  html = html.replace(re, `$1="${rel}?v=${hash}"`);
  stamped += 1;
}

writeFileSync(htmlPath, html);
console.log(`[stamp-assets] ${stamped} asset(s) versionados: ${unique.join(", ")}`);
