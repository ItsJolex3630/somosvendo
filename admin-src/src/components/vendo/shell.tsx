import { Link } from '@tanstack/react-router';
import { LayoutDashboard, ArrowLeftRight, Users, CreditCard, Settings, Search, Bell, ChevronDown, ArrowUpRight, CircleHelp, ShieldCheck, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useVendo } from './store';
import { useAuth } from './auth';
import { VendoModals } from './modals';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/cobros', label: 'Cobros', icon: CreditCard },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
] as const;

export function Brand() {
  return <div className="brand"><svg className="brand-mark" viewBox="0 0 32 34" fill="none" aria-label="VENDO"><path d="M1 3h9l7 17-4 11L1 3Z" fill="currentColor" /><path d="M23 3h9L19 32h-9L23 3Z" fill="currentColor" /></svg><span>VENDO<span className="text-primary">.</span></span></div>;
}

export function VendoShell({ children }: { children: ReactNode }) {
  const { search, setSearch, alerts, error, refresh } = useVendo();
  const { email } = useAuth();
  const [notifications, setNotifications] = useState(false);
  const initials = (email || 'V').slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <>
      <aside className="app-sidebar">
        <Link to="/" aria-label="VENDO inicio"><Brand /></Link>
        <p className="brand-sub">BUSINESS, IN BALANCE.</p>
        <div className="nav-heading">WORKSPACE</div>
        <nav>{nav.map((n) => <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="nav-link"><n.icon size={18} strokeWidth={1.6} />{n.label}</Link>)}</nav>
        <div className="nav-heading mt-8">SOPORTE</div>
        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground" onClick={() => { setNotifications(true); }}><CircleHelp size={18} />Centro de ayuda<ArrowUpRight className="ml-auto" /></Button>
        <div className="workspace-chip">
          <div className="flex items-center gap-3">
            <span className="avatar rounded-md">V</span>
            <div><div className="text-xs">VENDO Studio</div><div className="mt-1 text-[9px] text-muted-foreground">Workspace profesional</div></div>
            <ShieldCheck className="ml-auto text-primary" size={16} />
          </div>
        </div>
        <div className="sidebar-bottom"><span className="status-dot" />Todos los sistemas operativos</div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="top-search">
            <Search size={16} />
            <input aria-label="Buscar clientes o movimientos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clientes, movimientos..." />
            <kbd>⌘ K</kbd>
            {search && <Button variant="ghost" size="icon" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X /></Button>}
          </div>
          <Link className="mobile-brand" to="/"><Brand /></Link>
          <div className="top-actions">
            <span className="top-date text-[10px] text-muted-foreground">{todayLabel}</span>
            <Button variant="ghost" size="icon" aria-label="Notificaciones" title="Notificaciones" className="relative text-muted-foreground" onClick={() => setNotifications((v) => !v)}>
              <Bell size={18} />
              {alerts.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[8px] font-semibold text-background">{alerts.length}</span>}
            </Button>
            <Link to="/ajustes" className="profile">
              <span className="avatar">{initials}</span>
              <div className="profile-name"><div className="text-[11px]">{email || 'Administrador'}</div><div className="text-[9px] text-muted-foreground mt-1">Administrador</div></div>
              <ChevronDown size={13} className="text-muted-foreground" />
            </Link>
          </div>
          {notifications && (
            <div className="notifications-pop">
              <div className="flex justify-between"><h3>Tu actividad</h3><Button variant="ghost" size="icon" aria-label="Cerrar notificaciones" onClick={() => setNotifications(false)}><X /></Button></div>
              {alerts.length ? alerts.map((a, i) => <p key={`${a.type}-${a.membership_id || i}`}>{a.message}</p>) : <p>Sin notificaciones por ahora.</p>}
              <p>Consulta los detalles en <Link className="text-primary" to="/cobros" onClick={() => setNotifications(false)}>Cobros</Link>.</p>
            </div>
          )}
        </header>
        <main>
          {error && (
            <div className="error-banner">
              <span>No se pudieron cargar los datos: {error}</span>
              <button type="button" onClick={refresh}>Reintentar</button>
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="bottom-dock" aria-label="Navegación móvil">
        {nav.map((n) => <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="dock-link"><span className="dock-icon"><n.icon strokeWidth={1.6} /></span>{n.label}</Link>)}
      </nav>
      <VendoModals />
    </>
  );
}
