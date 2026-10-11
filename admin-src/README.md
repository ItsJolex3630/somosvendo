# Vendo Suite Love

Create a luxury executive finance and CRM admin panel for VENDO (Treasury, Ledger, Clients, Invoicing & Settings).
Brand Identity:
- Deep obsidian dark background #01110a, surface container #01180f and #022216.
- Subtle neon lime #cef17b accent color, off-white text #f8ffe6, translucent glass borders rgba(206,241,123,0.15).
- Clean fonts: Plus Jakarta Sans / Outfit with JetBrains Mono / Space Mono for currency and telemetry numbers.

Key Responsive Architecture:
1. DESKTOP LAYOUT (screen >= 768px):
   - Fixed sleek left sidebar (240px) with VENDO geometric logo, navigation links with minimalist SVG icons:
     * Dashboard
     * Movimientos (Transactions)
     * Clientes (CRM)
     * Cobros (Billing)
     * Ajustes (Settings)
   - Sticky top bar with search, notification bell and user profile chip.
   - Main content grid with 3 KPI metric cards, interactive cashflow chart (Recharts), recent transactions table, and income breakdown by service.

2. MOBILE SMARTPHONE LAYOUT (screen < 768px):
   - FIXED BOTTOM NAVIGATION DOCK (Barra inferior):
     * Glassmorphism background with backdrop blur (bg-[#01180f]/85 backdrop-blur-xl border-t border-[#cef17b]/15).
     * 5 minimalist icons with labels: Dashboard (home), Movimientos (arrow-left-right), Clientes (users), Cobros (credit-card), Ajustes (settings).
     * Active tab has neon lime pill glow and elevated icon.
     * Thumb-friendly touch targets with iOS safe-area bottom padding.
   - Mobile top bar with compact brand and notification bell.
   - Swipeable / stacked KPI cards, mobile responsive charts, and touch list for transactions.

Build all 5 views with real state management, mock data for VENDO's real services (Desarrollo Web, Hosting, Tarjetas NFC), modals for '+ Registrar Cobro' and '+ Nuevo Cliente', and smooth transitions.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vendo-suite-love.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2ae56048-9ecd-4241-9a39-54966614d921).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
