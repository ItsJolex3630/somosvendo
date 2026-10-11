# 💎 Sistema de Diseño VENDO — Obsidian Emerald Luxury Fintech

Este sistema de diseño fue generado utilizando **Google Stitch** y **Lovable AI** para transformar el panel de administración de **VENDO** en una experiencia ejecutiva de ultra-alta fidelidad (nivel *Linear*, *Raycast* y *Stripe Treasury*).

---

## 1. Referencias de Fuentes y Artefactos Exportados

| Recurso | Plataforma | Identificador / Ubicación | Enlace / Archivo Local |
| :--- | :--- | :--- | :--- |
| **Proyecto Stitch** | Google Stitch | `12061719213589360847` | [Stitch Project Console](https://stitch.withgoogle.com) |
| **Pantalla Desktop** | Google Stitch | `a0192ec31c7a40608996ec21c08cb22f` | [`Website/admin/design/stitch-desktop.html`](file:///home/joel/Proyectos/Vendo/Website/admin/design/stitch-desktop.html) |
| **Pantalla Mobile** | Google Stitch | `d2758cf024fb484d8fc089a1c59a5235` | [`Website/admin/design/stitch-mobile.html`](file:///home/joel/Proyectos/Vendo/Website/admin/design/stitch-mobile.html) |
| **Captura Desktop** | Google Stitch | Archivo CDN | [Ver Captura Desktop](https://lh3.googleusercontent.com/aida/AEtjO1WKPfPM0dtIP-NCCFZj5XLbcZiHERzThLHQsmzS6mH4miK8VkJ72R67V4mKH63u8Dl9SPMx4YsF4m0ba1JrPxlLII64s_I01fc-BUhO7uc3Un-MhnSPAKd8nQh5rCxe7k2vtoGdJWQ9eyy36cbi1GJAVe6XTv_NEHuZrdBG-QjRB86Rfy0pBxgRcAOgvFXP5wjRAq1ItLtNSWLZRj1PeUZxnvdHMSPgJlJ28ncHbiB9G4WlpvP2pprr2u3O) |
| **Captura Mobile** | Google Stitch | Archivo CDN | [Ver Captura Mobile](https://lh3.googleusercontent.com/aida/AEtjO1Vmus8NFcsMUZc2446YWWMV_2NRZKu-8QmbWIh5ZQrlYi7baFQ95vzNNYXMDcmq7bEmiDXKY4y7etak9Bz8m6eLSboCpyvWUB_kfu-jz8BTnbDtEYYKa_puRvwEpGkNQwUK77bAWdzivw-9aWVUdQwE5RgtDCjHFBI_u-gGgJKOfeFrAHSVIzh0UhkEY0_0MkxlQ2aqPuRkEheNxntqLRhKqESJUZQbSa6QqDL60Q_XePg9pkaCighO_pmY) |
| **Proyecto Lovable** | Lovable AI | `2ae56048-9ecd-4241-9a39-54966614d921` | [Lovable Editor](https://lovable.dev/projects/2ae56048-9ecd-4241-9a39-54966614d921) / [Live Preview](https://id-preview--2ae56048-9ecd-4241-9a39-54966614d921.lovable.app) |

---

## 2. Paleta de Colores y Tokens CSS

```css
:root {
  /* Fondos y Superficies Obsidian */
  --bg-canvas: #01110a;               /* Fondo base ultra-oscuro */
  --bg-surface-1: #01180f;            /* Barra lateral, barra inferior, cabeceras */
  --bg-surface-2: #022216;            /* Tarjetas elevadas, módulos KPI */
  --bg-surface-3: #032d1d;            /* Modales, menús contextuales, popovers */
  --bg-surface-hover: rgba(206, 241, 123, 0.05);

  /* Acentos de Radiación Neón y Marca */
  --primary-lime: #cef17b;             /* Verde lima neón distintivo de VENDO */
  --primary-lime-dim: #b1d361;         /* Lima atenuado */
  --primary-glow: rgba(206, 241, 123, 0.25);
  --primary-glow-subtle: rgba(206, 241, 123, 0.12);

  /* Tipografía y Textos */
  --text-primary: #f8ffe6;            /* Blanco crema de alto contraste */
  --text-secondary: rgba(248, 255, 230, 0.65); /* Etiquetas y subtítulos */
  --text-muted: rgba(248, 255, 230, 0.38);     /* Metadatos y placeholders */

  /* Líneas de Borde Submilimétricas */
  --border-subtle: rgba(206, 241, 123, 0.10);  /* Bordes de tarjetas y divisores */
  --border-active: rgba(206, 241, 123, 0.28);  /* Tarjeta activa o input enfocado */
  --border-highlight: rgba(206, 241, 123, 0.50);

  /* Estados Semánticos Financieros */
  --status-income: #cef17b;           /* Ingresos / Completado */
  --status-expense: #f87171;          /* Egresos / Rechazado */
  --status-pending: #fbbf24;          /* En revisión / Pendiente */
  --status-info: #68fcbf;             /* Sincronizado / Activo */
}
```

---

## 3. Tipografía y Jerarquía

1. **Titulares y Nombres de Sección:** `Outfit`, sans-serif (pesos 500 y 600) con espaciado `-0.02em`.
2. **Cuerpo de Texto y Formularios:** `Plus Jakarta Sans` o `Inter` (pesos 400 y 500) para máxima legibilidad.
3. **Métricas Financieras y Números:** `JetBrains Mono` o `Space Mono` (pesos 500, 600 y 700) para evitar desajustes tabulares al actualizar montos en tiempo real (`$1,280.00`).
4. **Micro-Badges y Metadatos:** Monospace en mayúsculas (`text-[9px]` o `text-[10px]`, `tracking-widest`).

---

## 4. Elevación y Efecto Glassmorphism

- **Translucidez:** Los paneles superiores e inferiores usan `backdrop-filter: blur(16px)` combinado con `rgba(1, 24, 15, 0.88)` para dejar entrever sutilmente el contenido en desplazamiento.
- **Micro-Bordes:** En lugar de sombras pesadas que ensucian los modos oscuros, se utilizan bordes de `1px` con `rgba(206, 241, 123, 0.12)`.
- **Destello Activo (Glow):** La pestaña activa o el botón principal tiene un halo ligero: `box-shadow: 0 0 16px rgba(206, 241, 123, 0.25)`.
