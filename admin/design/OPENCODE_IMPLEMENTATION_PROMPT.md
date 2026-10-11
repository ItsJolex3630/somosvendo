# Prompt de Implementación para OpenCode — Rediseño Premium del Panel Admin

Copia y pega el siguiente bloque completo en tu conversación con **OpenCode**:

```markdown
Hola OpenCode. Necesito que implementes el rediseño visual de alta fidelidad para el Panel de Administración de VENDO (somosvendo.pages.dev/admin/).

Hemos exportado los diseños, pantallas y sistemas de diseño utilizando **Google Stitch** y **Lovable AI**, y ya están almacenados localmente en nuestro repositorio.

### 📁 Archivos de Referencia y Diseños Disponibles:
1. **Sistema de Diseño y Tokens:** `Website/admin/design/DESIGN_SYSTEM_VENDO.md`
2. **Especificación UI Desktop:** `Website/admin/design/DESKTOP_UI_SPEC.md`
3. **Especificación UI Mobile (con Barra Inferior):** `Website/admin/design/MOBILE_UI_SPEC.md`
4. **Pantalla Completa Desktop (HTML/Tailwind generado por Stitch):** `Website/admin/design/stitch-desktop.html`
5. **Pantalla Completa Mobile (HTML/Tailwind generado por Stitch):** `Website/admin/design/stitch-mobile.html`
6. **Capturas de Pantalla de Alta Resolución:**
   - Desktop: https://lh3.googleusercontent.com/aida/AEtjO1WKPfPM0dtIP-NCCFZj5XLbcZiHERzThLHQsmzS6mH4miK8VkJ72R67V4mKH63u8Dl9SPMx4YsF4m0ba1JrPxlLII64s_I01fc-BUhO7uc3Un-MhnSPAKd8nQh5rCxe7k2vtoGdJWQ9eyy36cbi1GJAVe6XTv_NEHuZrdBG-QjRB86Rfy0pBxgRcAOgvFXP5wjRAq1ItLtNSWLZRj1PeUZxnvdHMSPgJlJ28ncHbiB9G4WlpvP2pprr2u3O
   - Mobile: https://lh3.googleusercontent.com/aida/AEtjO1Vmus8NFcsMUZc2446YWWMV_2NRZKu-8QmbWIh5ZQrlYi7baFQ95vzNNYXMDcmq7bEmiDXKY4y7etak9Bz8m6eLSboCpyvWUB_kfu-jz8BTnbDtEYYKa_puRvwEpGkNQwUK77bAWdzivw-9aWVUdQwE5RgtDCjHFBI_u-gGgJKOfeFrAHSVIzh0UhkEY0_0MkxlQ2aqPuRkEheNxntqLRhKqESJUZQbSa6QqDL60Q_XePg9pkaCighO_pmY
7. **Proyecto React / Tailwind en Lovable:** https://lovable.dev/projects/2ae56048-9ecd-4241-9a39-54966614d921 (Live: https://id-preview--2ae56048-9ecd-4241-9a39-54966614d921.lovable.app)

---

### 🎯 Requerimientos de Implementación:

#### 1. REGLA DE ORO (No romper la funcionalidad existente):
- Mantén intacta toda la lógica JS de `assets/js/admin.js`:
  - Autenticación Google Sign-In (Client ID, tokens, validación de correos).
  - Rutas hash (`#/dashboard`, `#/movimientos`, `#/clientes`, `#/cobros`, `#/ajustes`).
  - Conexión con los endpoints de la API (`/api/admin/dashboard`, `/api/admin/movimientos`, `/api/admin/clientes`, `/api/admin/cobros`, `/api/admin/ajustes`).
  - Modales de nuevo movimiento y nuevo cliente.

#### 2. Experiencia en Ordenador (Desktop >= 820px):
- Sidebar lateral izquierdo estilizado:
  - Fondo esmeralda oscuro `#01180f`, borde translúcido `rgba(206, 241, 123, 0.12)`.
  - Logotipo V con destello neón lima `#cef17b`.
  - Iconos minimalistas SVG elegantes junto al texto de cada sección:
    * Dashboard (Home / métricas)
    * Movimientos (Transferencia / flechas)
    * Clientes (Usuarios / CRM)
    * Cobros (Factura / tarjeta)
    * Ajustes (Engranaje / sliders)
  - Pestaña activa con pastilla brillante y acento verde lima neón.
- Topbar con buscador rápido, campana de alertas con badge interactivo y chip de usuario conectado.
- Tarjetas KPI con números en tipografía monospace (`Space Mono` o `JetBrains Mono`), fondo `#022216` con bordes micro y gradiente sutil.

#### 3. Experiencia en Teléfono Móvil (Mobile < 820px) — BARRA INFERIOR (Dock):
- **Ocultar completamente el menú hamburguesa tradicional y la barra lateral en móvil.**
- Implementar la **Barra Inferior Flotante/Fija (Bottom Navigation Dock)** en `admin/index.html` y `assets/css/admin.css`:
  - Fija en la parte inferior: `position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;`
  - Estilo glassmorphism: `background: rgba(1, 24, 15, 0.92); backdrop-filter: blur(16px); border-top: 1px solid rgba(206, 241, 123, 0.15);`
  - 5 pestañas con iconos minimalistas SVG y micro-etiquetas:
    1. **Dashboard**
    2. **Movimientos** (con microbadge numérico si hay pendientes)
    3. **Clientes**
    4. **Cobros**
    5. **Ajustes**
  - La pestaña activa debe iluminarse en verde lima `#cef17b` con una pequeña cápsula brillante en la parte superior.
  - Altura táctil ergonómica de al menos 48px y padding inferior seguro para iPhone/Android (`env(safe-area-inset-bottom, 20px)`).
  - Añadir padding inferior al contenedor de contenido (`padding-bottom: 96px;`) para que ningún elemento quede tapado por la barra inferior.

#### 4. Archivos a modificar:
- `Website/admin/index.html`: Estructura HTML con la barra inferior añadida e iconos SVG integrados.
- `Website/assets/css/admin.css`: Estilos de escritorio, barra inferior móvil, paleta Obsidian Emerald y micro-bordes.
- `Website/assets/js/admin.js`: Sincronización del estado `active` entre el sidebar de escritorio y la barra inferior de móvil según la ruta hash actual (`location.hash`).

Por favor, revisa primero los archivos de especificación en `Website/admin/design/` y aplica los cambios paso a paso con máxima precisión y elegancia.
```
