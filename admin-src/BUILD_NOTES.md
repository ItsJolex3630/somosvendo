# BUILD_NOTES — Panel /admin/ (replica estática del proyecto Lovable)

Este proyecto es una copia de `../lovable-export` (TanStack Start) compilada como
**sitio estático** para servirse desde Cloudflare Pages en `/admin/`, sin SSR en
runtime y **sin `_worker.js`** (para no anular `Website/functions/`).

## Opciones exactas usadas (`vite.config.ts`)

- `nitro: false` — desactiva la integración Nitro que el wrapper de Lovable activa
  por defecto con preset `cloudflare-module` y que emitiría `_worker.js`.
  Fuente: tipos de `@lovable.dev/vite-tanstack-config` → `LovableViteTanstackOptions.nitro`
  ("false: skip nitro entirely").
- `tanstackStart.router.basepath: "/admin"` — el router vive bajo el subdirectorio.
- `tanstackStart.prerender: { enabled: true, autoSubfolderIndex: true,
  autoStaticPathsDiscovery: true, crawlLinks: true, failOnError: true }` — genera
  HTML estático por ruta (`/index.html`, `/movimientos/index.html`, …) en lugar del
  modo SPA con `/_shell.html`, porque `Website/_redirects` (intocable) no tiene un
  catch-all al shell.
  Fuente: https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering
- `vite.base: "/admin/"` — assets y links servidos desde `/admin/`.
  Fuente: https://vite.dev/config/shared-options.html#base

## Flujo de build / salida

```bash
cd Website/admin-src
bun install          # respeta bun.lock
bun run build        # vite build (client + ssr) + prerender → dist/
# salida estática = dist/client/  (sin dist/server/)
rsync -a dist/client/ ../admin/
```

El paso de prerender ejecuta el bundle SSR con **Node desde `dist/server`** dentro de
`admin-src` (donde sí resuelve `node_modules`). Por eso **no** se usa `build.outDir`
fuera del proyecto: si se compila directamente a `../admin`, el prerender falla con
`ERR_MODULE_NOT_FOUND: Cannot find package 'react'` (la resolución de Node parte de
`../admin/server` y no encuentra `node_modules`). Se compila a `dist/` y se copia
`dist/client/` a `../admin/`.

## Rutas resultantes (5×200)

`admin/index.html`, `admin/movimientos/index.html`, `admin/clientes/index.html`,
`admin/cobros/index.html`, `admin/ajustes/index.html`.

## Scripts inline vs. CSP (desviación necesaria, aprobada por el usuario)

El SSR de TanStack Start emite **3 scripts inline** por página (scroll-restoration,
bootstrap `$_TSR` y el boundary de streaming). El CSP vigente en `Website/_headers`
es `script-src 'self' https://accounts.google.com/gsi/client`, **sin `'unsafe-inline'`
ni nonce**, por lo que el navegador los bloquea y la hidratación falla
(`PAGEERROR: Cannot set properties of undefined`). No existe opción nativa para
externalizarlos (solo se admite `ssr.nonce` y `scriptFormat: 'module'|'iife'`), y
`_headers` es intocable por el plan.

Solución (dentro del alcance `admin-src/` + `admin/`, sin tocar `_headers`):
`scripts/externalize-inline-scripts.mjs` recorre `dist/client/**/*.html`, extrae cada
`<script>` sin `src` a `dist/client/assets/inline-<hash>.js` (mismo origen → permitido
por `'self'`) y lo reemplaza por `<script src="/admin/assets/inline-<hash>.js">`
preservando orden y atributos. Se ejecuta al final de `bun run build`.

Verificado con `wrangler pages dev` (CSP real): 5 rutas hidratan con 0 errores de
consola y 0 peticiones fallidas.

## Recursos externos

El bundle solo referencia por red `fonts.googleapis.com` / `fonts.gstatic.com`
(permitidos por el CSP vigente). `react.dev` y `tailwindcss.com` aparecen únicamente
como strings en mensajes de error del código minificado, no como cargas de recursos.
