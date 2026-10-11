// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// VENDO admin panel — variante ESTÁTICA (ver BUILD_NOTES.md):
//   - nitro: false  → sin `_worker.js` (no debe anular `Website/functions/`).
//   - prerender     → genera HTML estático por ruta bajo `../admin/`.
//   - base /admin/  → assets y links servidos desde el subdirectorio /admin/.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Sin Nitro: el panel es 100% estático y se sirve por Cloudflare Pages desde /admin/.
  // Evita el preset cloudflare-module y por tanto la emisión de `_worker.js`.
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // Sigue usándose en build-time para el prerender, no en runtime.
    server: { entry: "server" },
    // El router vive bajo /admin/ (coincide con base de Vite).
    router: { basepath: "/admin" },
    prerender: {
      enabled: true,
      // Emite `movimientos.html` (no `movimientos/index.html`): Cloudflare Pages
      // sirve `/admin/movimientos` con 200 directo, sin el 308 de directorio.
      autoSubfolderIndex: false,
      autoStaticPathsDiscovery: true,
      crawlLinks: true,
      failOnError: true,
    },
  },
  vite: {
    base: "/admin/",
    // La salida se deja en `dist/` (dentro de admin-src) para que el paso de
    // prerender resuelva node_modules; luego se copia a ../admin/. Ver BUILD_NOTES.md.
  },
});
