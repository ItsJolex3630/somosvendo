# 🖥️ Especificación UI Desktop — VENDO Executive Treasury & CRM

Archivo fuente exportado de Stitch: [`Website/admin/design/stitch-desktop.html`](file:///home/joel/Proyectos/Vendo/Website/admin/design/stitch-desktop.html)  
Captura de pantalla: [Ver Imagen Alta Resolución](https://lh3.googleusercontent.com/aida/AEtjO1WKPfPM0dtIP-NCCFZj5XLbcZiHERzThLHQsmzS6mH4miK8VkJ72R67V4mKH63u8Dl9SPMx4YsF4m0ba1JrPxlLII64s_I01fc-BUhO7uc3Un-MhnSPAKd8nQh5rCxe7k2vtoGdJWQ9eyy36cbi1GJAVe6XTv_NEHuZrdBG-QjRB86Rfy0pBxgRcAOgvFXP5wjRAq1ItLtNSWLZRj1PeUZxnvdHMSPgJlJ28ncHbiB9G4WlpvP2pprr2u3O)

---

## 1. Arquitectura del Layout de Escritorio

```
+---------------------------------------------------------------------------------------------------+
| SIDEBAR (240px Fijo) | TOPBAR: Buscador rápido [⌘K] | Alertas (3) | Estado Vault | + Nuevo Cobro  |
|                      +----------------------------------------------------------------------------+
| [V] VENDO Admin      | KPI ROW (3 Tarjetas Glassmorphic):                                         |
|                      |   1. Balance Neto ($1,280)  |  2. Total Cobrado ($3,450)  | 3. Pendientes  |
|  * Dashboard (Activo)+----------------------------------------------------------------------------+
|  * Movimientos       | GRÁFICO CASHFLOW & PROYECCIÓN (SVG / Canvas interactivo con toggle 30D/90D) |
|  * Clientes          +---------------------------------------------------+------------------------+
|  * Cobros            | TABLA ÚLTIMOS MOVIMIENTOS (~65% ancho)            | DESGLOSE POR SERVICIO  |
|  * Ajustes           |   - Tipo, Cliente, Servicio, Fecha, Monto, Acc.   |   - Web Dev (62%)      |
|                      |                                                   |   - Hosting (24%)      |
| [Avatar + Admin Info]|                                                   |   - NFC Cards (14%)    |
+--------------------------------------------------------------------------+------------------------+
```

---

## 2. Barra Lateral (Sidebar)

- **Dimensiones:** Ancho fijo de `240px` a `260px`, `height: 100vh`, `position: sticky; top: 0`.
- **Fondo:** `#01180f` con borde lateral derecho `1px solid rgba(206, 241, 123, 0.10)`.
- **Logotipo:**
  - Badge estilizado `V` en verde lima `#cef17b` con texto oscuro y ligero resplandor.
  - Tipografía `VENDO` en blanco crema + subtítulo micro `TREASURY & CRM`.
- **Enlaces de Navegación:**
  1. `Dashboard` (Icono: `query_stats` / `grid_view`)
  2. `Movimientos` (Icono: `receipt_long` / `swap_horiz`, con badge contador `12 nuevos`)
  3. `Clientes` (Icono: `contacts` / `group`, con contador total de clientes)
  4. `Cobros` (Icono: `payments` / `account_balance_wallet`)
  5. `Ajustes` (Icono: `tune` / `settings`)
- **Estado Activo:** Pastilla con fondo `rgba(206, 241, 123, 0.14)`, texto en `#cef17b`, y una barra de acento vertical a la izquierda de `3px` con resplandor neón.
- **Pie del Sidebar:** Chip del administrador conectado con avatar circular, correo (`somosvendo.ve@gmail.com` / `jolex3630@gmail.com`), punto pulsante de estado en línea y botón de cerrar sesión.

---

## 3. Barra Superior (Topbar)

- **Altura:** `64px`, `position: sticky; top: 0; z-index: 40`.
- **Efecto Glassmorphism:** Fondo `rgba(1, 17, 10, 0.82)` con `backdrop-filter: blur(12px)` y borde inferior sutil.
- **Buscador Rápido Central:**
  - Input con fondo `#01180f`, borde `rgba(206, 241, 123, 0.12)`, placeholder `Buscar cliente, movimiento o servicio...`.
  - Atajo de teclado visual `⌘K` o `/`.
- **Acciones a la Derecha:**
  - Píldora de estado del sistema: *Bóveda Sincronizada* con punto verde.
  - Campana de notificaciones con badge animado `3`.
  - Botón principal de acción rápida: `+ Registrar Cobro` (fondo lima `#cef17b`, texto negro, efecto hover glow).

---

## 4. Sección Principal de Métricas (KPI Cards)

Tres tarjetas con micro-bordes y gradientes radiales de luz:
1. **Balance Neto / Margen Operativo:**
   - Valor principal en `Space Mono`: `$1,280.00 USD` (Tamaño `30px`, font-bold).
   - Chip de variación: `+12.4% vs mes anterior` (Verde).
   - Mini sparkline gráfico en la esquina inferior.
2. **Total Facturado / Cobrado:**
   - Valor: `$3,450.00 USD`.
   - Subtexto: `38 transacciones exitosas en el mes`.
3. **Pagos Pendientes por Confirmar:**
   - Valor: `$420.00 USD`.
   - Chip de advertencia: `3 facturas por vencer` (Ámbar `#fbbf24`).

---

## 5. Tabla de Movimientos y Desglose de Servicios

- **Tabla de Movimientos:**
  - Cabeceras en mayúsculas `JetBrains Mono` con espaciado amplio.
  - Filas con efecto `hover` iluminado en verde suave (`rgba(206, 241, 123, 0.04)`).
  - Importes con signo positivo en verde neón (`+$1,200.00`) y egresos en rojo tenue (`-$180.00`).
  - Menú de 3 puntos `...` para editar, ver recibo o cambiar estado.
- **Desglose de Ingresos:**
  - Barras de progreso con bordes redondeados y colores vivos para cada servicio:
    - *Desarrollo Web & E-Commerce*: 62%
    - *Hosting & Mantenimiento*: 24%
    - *Tarjetas NFC & Soluciones*: 14%
