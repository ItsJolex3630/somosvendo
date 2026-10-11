# 📱 Especificación UI Mobile — VENDO Executive Mobile Vault

Archivo fuente exportado de Stitch: [`Website/admin/design/stitch-mobile.html`](file:///home/joel/Proyectos/Vendo/Website/admin/design/stitch-mobile.html)  
Captura de pantalla: [Ver Imagen Alta Resolución](https://lh3.googleusercontent.com/aida/AEtjO1Vmus8NFcsMUZc2446YWWMV_2NRZKu-8QmbWIh5ZQrlYi7baFQ95vzNNYXMDcmq7bEmiDXKY4y7etak9Bz8m6eLSboCpyvWUB_kfu-jz8BTnbDtEYYKa_puRvwEpGkNQwUK77bAWdzivw-9aWVUdQwE5RgtDCjHFBI_u-gGgJKOfeFrAHSVIzh0UhkEY0_0MkxlQ2aqPuRkEheNxntqLRhKqESJUZQbSa6QqDL60Q_XePg9pkaCighO_pmY)

---

## 1. El Requerimiento Clave: Barra Inferior Fija (Bottom Navigation Dock)

En dispositivos móviles (`@media (max-width: 820px)`), la barra lateral se oculta y la navegación principal pasa **completamente a una barra inferior acoplada** (Dock ergonómico estilo iOS nativo).

```
+-------------------------------------------------------------+
| [V] VENDO Admin                         [🔔 3] [Avatar (●)]  | <- Topbar compacta
+-------------------------------------------------------------+
| Hola, Alejandro                                             |
| US-EAST-VAULT · Bóveda Sincronizada                         |
|                                                             |
| [ Balance $1,280 ] [ Cobrado $3,450 ] [ Pendiente $420 ]    | <- Carrusel táctil
|                                                             |
| [+ Nuevo Cobro]   [Ver Clientes]   [Exportar]               | <- Acciones rápidas
|                                                             |
| GRÁFICO FLUJO DE CAJA (Compacto 30D con tooltip táctil)     |
|                                                             |
| ÚLTIMOS MOVIMIENTOS (Tarjetas verticales táctiles):         |
|   NovaCorp Enterprise  +$1,200.00   [Completado]            |
|   Quantum Labs          +$450.00   [Completado]            |
|   AWS Cloud Infra       -$180.00   [Egreso]                |
|                                                             |
| (Espacio de scroll inferior: pb-32 para evitar solapamiento)|
+-------------------------------------------------------------+
|  [ 📊 ]      [ 📄 12 ]     [ 👥 ]       [ 💳 ]       [ ⚙️ ]   | <- BARRA INFERIOR
| Dashboard   Movimientos   Clientes     Cobros      Ajustes  |    (Glassmorphism)
|  (ACTIVO)                                                   |
+-------------------------------------------------------------+
```

---

## 2. Especificación Técnica de la Barra Inferior (`bottom-nav`)

```html
<nav aria-label="Navegación Móvil" class="fixed bottom-0 left-0 right-0 z-50 bg-[#01180f]/95 backdrop-blur-xl border-t border-[rgba(206,241,123,0.15)] pt-2 pb-7 px-3 flex justify-around items-center">
  <!-- 1. Dashboard -->
  <button type="button" class="bottom-tab active" data-view="dashboard">
    <div class="tab-icon-wrap">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
      </svg>
      <span class="active-capsule-glow"></span>
    </div>
    <span class="tab-label">Dashboard</span>
  </button>

  <!-- 2. Movimientos -->
  <button type="button" class="bottom-tab" data-view="movimientos">
    <div class="tab-icon-wrap">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
      </svg>
      <span class="tab-badge">12</span>
    </div>
    <span class="tab-label">Movimientos</span>
  </button>

  <!-- 3. Clientes -->
  <button type="button" class="bottom-tab" data-view="clientes">
    <div class="tab-icon-wrap">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <span class="tab-label">Clientes</span>
  </button>

  <!-- 4. Cobros -->
  <button type="button" class="bottom-tab" data-view="cobros">
    <div class="tab-icon-wrap">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    </div>
    <span class="tab-label">Cobros</span>
  </button>

  <!-- 5. Ajustes -->
  <button type="button" class="bottom-tab" data-view="ajustes">
    <div class="tab-icon-wrap">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </div>
    <span class="tab-label">Ajustes</span>
  </button>
</nav>
```

---

## 3. Ergonomía y Estados Táctiles

1. **Objetivo Táctil Mínimo:** Cada botón de la barra tiene al menos `54px × 48px` para evitar pulsaciones erróneas.
2. **Pestaña Activa:**
   - Color del icono y texto: Verde Lima `#cef17b`.
   - Cápsula iluminada superior: Una pequeña barra de `24px × 3px` con `border-radius: 99px` y resplandor neón `box-shadow: 0 0 10px #cef17b`.
3. **Pestañas Inactivas:**
   - Color del icono: `rgba(248, 255, 230, 0.55)`.
   - Al tocar (feedback táctil): `transform: scale(0.94); transition: transform 0.15s ease`.
4. **Espacio Seguro Inferior:** Se aplican `padding-bottom: env(safe-area-inset-bottom, 24px)` para adaptarse a la barra gestual de iPhone y Android modernos.
5. **Padding de Contenido:** El contenedor `<main>` debe tener `padding-bottom: 96px;` para que la última tarjeta nunca quede oculta detrás de la barra inferior.
