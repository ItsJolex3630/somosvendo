# Documento de Contexto y Arquitectura de Producto: VÉNDO Conecta & Vendo Club

**Propósito:** Proveer a Kimi Code el contexto comercial, técnico y la arquitectura de rutas exacta para diseñar el plan de implementación definitivo sin ambigüedades.  
**Plataforma base:** `somosvendo.pages.dev` (Cloudflare Pages + Functions + Turso DB).

---

## 1. Visión y Modelo de Negocio

Vendo es una agencia de desarrollo web y presencia digital que evoluciona hacia un modelo de **ingresos recurrentes mensuales (MRR)** a través de su nuevo servicio estrella: **VÉNDO Conecta**.

### Las dos líneas de monetización:
1. **Línea B2B (Nos pagan a Vendo):** Los comercios (panaderías, restaurantes, tiendas) pagan una mensualidad a Vendo por el servicio de **VÉNDO Conecta** (gestión del canal activo de WhatsApp, plataforma de fidelización y campañas de retención para que sus clientes vuelvan a comprar).
2. **Línea B2C (Club del comercio / Revenue Share):** Los clientes finales pagan una membresía mensual al comercio (ej. $5 a $10/mes) para acceder a beneficios VIP (descuentos fijos, delivery gratis, etc.). Vendo puede comisionar un porcentaje o fee por operarles la plataforma.

---

## 2. El Problema Actual que se Debe Corregir

Actualmente hay una confusión en la arquitectura de rutas y en el diseño visual:
1. Al entrar a `https://somosvendo.pages.dev/club/`, la página asume por defecto a Masafácil y muestra de inmediato el formulario para pagar la membresía de Masafácil.
2. Esa pantalla de pago tiene la identidad visual de Vendo (colores oscuros verde lima/bosque), lo cual rompe la experiencia de marca blanca del comercio.
3. No existe una página dedicada donde un dueño de negocio pueda entender a fondo qué es **VÉNDO Conecta**, cuánto cuesta y cómo contratarlo.

---

## 3. Arquitectura de Rutas Deseada (Separación Limpia)

```
                                  Rutas de VENDO Club
                                          │
       ┌──────────────────────────────────┴──────────────────────────────────┐
       ▼                                                                     ▼
1. PÁGINA DE PRODUCTO B2B                                           2. CHECKOUT DE MARCA BLANCA
  somosvendo.pages.dev/club/                                         somosvendo.pages.dev/club/:comercio
  (Para dueños de negocios)                                          (Para clientes finales)
  - Identidad 100% VENDO                                             - Identidad 100% DEL COMERCIO
  - Explica a fondo VÉNDO CONECTA                                    - Colores, logo y estética del negocio
  - Botón para contratar el servicio                                 - Ejemplo: /club/masafacil (100% MasaFácil)
  - Botón: "¿Ya eres miembro? Ver mi carnet"
    (redirige a /mi-membresia/)
```

---

## 4. Especificación Detallada por Pantalla

### 4.1. Página de Producto B2B — `/club/` (Estilo Vendo)
* **Público objetivo:** Dueños de negocios locales (restaurantes, panaderías, cafeterías, tiendas).
* **Identidad visual:** 100% VENDO (Ink `#01110a`, Forest `#01442c`, Lime `#cef17b`, Cream `#f8ffe6`).
* **Contenido principal:**
  1. **Propuesta de valor:** *"Tu negocio presente. Tus clientes de vuelta."* Explicación profunda de por qué la retención y la recompra constante son la clave del crecimiento local.
  2. **Los 3 pilares de VÉNDO Conecta:**
     - Comunicación mensual activa por WhatsApp (ocasiones de compra, avisos de temporada).
     - Plataforma de club llave en mano con carnet digital para cada cliente.
     - Cero carga operativa: Vendo gestiona la tecnología y las campañas.
  3. **Demostración de casos reales:** Enlace destacado para ver en vivo cómo opera el club de Masafácil (`/club/masafacil`).
  4. **Llamados a la Acción (CTA):**
     - Botón principal: `Contratar VÉNDO Conecta para mi negocio` (abre el modal de cotización o contacto con el asesor comercial).
     - Acceso directo para clientes finales: Botón secundario visible: `¿Ya tienes membresía en algún comercio? Consulta tu carnet digital aquí` ➔ redirige a `/mi-membresia/`.

---

### 4.2. Checkout de Membresía Multi-Tenant (Marca Blanca) — `/club/:comercio`
* **Ejemplo de ruta:** `https://somosvendo.pages.dev/club/masafacil` (o `?t=masafacil` manejado con rewrite limpio).
* **Público objetivo:** Clientes finales del comercio (compradores habituales de Masafácil, Jolie Fragrances, etc.).
* **Identidad visual:** **100% MARCA BLANCA DEL COMERCIO AFILIADO**.
  - Si es Masafácil (`slug = 'masafacil'`), la página debe adoptar completamente el estilo de Masafácil:
    - Colores: Fondo crema/tan (`#f5ebd4`, `#c9a577`), marrón oscuro cálido (`#40201a`), verde salvia.
    - Logo oficial de Masafácil y tipografía amigable.
    - Los clientes deben sentir que están en la web oficial de Masafácil haciéndose miembros VIP.
  - Al final de la página, solo un discreto pie de página: `Tecnología por VÉNDO Conecta`.
* **Flujo de pago:**
  1. Explicación de los beneficios VIP del club del comercio (descuentos en cada pedido, regalos de cumpleaños, envíos preferenciales).
  2. Formulario de inscripción (Nombre, WhatsApp, Correo).
  3. Instrucciones de Pago Móvil / Zelle con los datos bancarios del comercio.
  4. Reporte de comprobante de pago (referencia bancaria).
  5. Confirmación inmediata y enlace directo a ver su carnet.

---

### 4.3. Portal de Autogestión del Cliente — `/mi-membresia/`
* **Público objetivo:** Clientes que ya pagaron y quieren ver su estado o renovar.
* **Acceso ligero:** Consulta por correo electrónico + últimos 4 dígitos de su teléfono (sin contraseñas).
* **Contenido:**
  - **Carnet VIP Virtual:** Estilo tarjeta digital con el nombre del club al que pertenece, estado actual (`Activo` en verde, `En Gracia` en amarillo, `Vencido` en rojo) y días restantes de vigencia.
  - Botón de **Renovación Directa** (lo manda nuevamente al checkout de su club para pagar el siguiente mes).
  - Botón directo para escribir al WhatsApp de atención al cliente del comercio.

---

### 4.4. El Centro de Operaciones Unificado — `/admin/`
* **Público objetivo:** Exclusivo para los dos administradores de Vendo (`jolex3630@gmail.com` y `somosvendo@gmail.com`).
* **Seguridad:** Google Sign-In oficial (con el Client ID de Google Cloud `somos-vendo`) validando contra la tabla `admins` en Turso.
* **Funcionalidad (Plan KIMI v1.1):**
  - **Dashboard Financiero:** Métricas de ingresos, gastos, ganancia neta consolidada y evolución mensual.
  - **Gestión de Movimientos:** Registro contable con cálculo automático de comisiones compartidas (split de fotografía y creación de marca).
  - **Directorio de Clientes:** Fichas de negocios, servicios contratados y registro de pagos.
  - **Control de Cobros Recurrentes:** Semáforo de estados de pago y botones de WhatsApp (`wa.me`) con plantillas pre-redactadas listas para enviar en 1 toque.
  - **Cola de Verificación de Pagos de Clubs:** Aprobar o rechazar pagos de membresías reportados por clientes finales.

---

## 5. Instrucciones para Kimi Code

Con este contexto, por favor genera el **Plan de Implementación Técnico Paso a Paso** para:
1. Crear la página de producto B2B `/club/index.html` con la estética y copywriting de Vendo Conecta.
2. Adaptar `/club/:slug` (o `/club/index.html?t=:slug`) para que renderice un diseño de **marca blanca 100% dinámico** inyectando temas CSS según los datos del tenant leídos desde Turso (`color_fondo`, `color_primario`, `color_secundario`, `logo_url`).
3. Mantener `/mi-membresia/` conectado al carnet virtual.
4. Asegurar que `/admin/` cargue el panel de administración unificado bajo la misma URL sin redirecciones externas rotas.
