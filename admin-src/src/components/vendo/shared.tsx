import { ArrowDownLeft, ArrowUpRight, Wallet, Plus, Download, CalendarDays, MoreHorizontal } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useVendo } from './store';
import { money, shortDate, exportCsv, type Transaction } from '@/lib/vendo/data';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function currentMonthLabel(): string {
  const label = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pctChange(current: number, previous: number): string {
  if (!previous) return '';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export function PageHeading({ title, subtitle, eyebrow = 'TU NEGOCIO, EN PERSPECTIVA', client = false, dashboard = false }: { title: string; subtitle: string; eyebrow?: string; client?: boolean; dashboard?: boolean }) {
  const { setModal, transactions, clients } = useVendo();
  return <div className="page-heading"><div className="min-w-0"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{dashboard ? <div className="date-button flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-[10px]"><CalendarDays size={13}/>{currentMonthLabel()}</div> : <Button className="export-button" variant="outline" onClick={() => exportCsv(transactions, clients)}><Download/>Exportar</Button>}<Button className="primary-action h-10 text-[11px]" onClick={() => setModal(client ? 'client' : 'payment')}><Plus size={14}/>{client ? 'Nuevo Cliente' : 'Registrar Cobro'}</Button></div></div>;
}

export function Kpis({ billing = false }: { billing?: boolean }) {
  const { summary, cobros, series, settings } = useVendo();
  const income = (summary?.summary.income_cents ?? 0) / 100;
  const net = (summary?.summary.net_cents ?? 0) / 100;
  const pendingCobros = cobros.filter((c) => c.status !== 'al_dia' && c.status !== 'suspendido');
  const overdueCobros = cobros.filter((c) => c.status === 'vencido');
  const pendingTotal = pendingCobros.reduce((s, c) => s + c.amount_cents, 0) / 100;
  const overdueTotal = overdueCobros.reduce((s, c) => s + c.amount_cents, 0) / 100;
  const previous = series.length >= 2 ? series[series.length - 2] : undefined;
  const incomeChange = previous ? pctChange(income, previous.income_cents / 100) : '';
  const netChange = previous ? pctChange(net, previous.net_cents / 100) : '';

  const metrics = billing
    ? [
        { label: 'Cobros recibidos', value: income, change: incomeChange, icon: ArrowDownLeft, sub: 'vs. mes anterior' },
        { label: 'Por cobrar', value: pendingTotal, change: `${pendingCobros.length} cobros`, icon: Wallet, sub: 'pendientes de pago' },
        { label: 'Cobros vencidos', value: overdueTotal, change: `${overdueCobros.length} cobros`, icon: ArrowUpRight, sub: 'requieren seguimiento' },
      ]
    : [
        { label: 'Balance total', value: net, change: netChange, icon: Wallet, sub: 'vs. mes anterior' },
        { label: 'Ingresos del mes', value: income, change: incomeChange, icon: ArrowDownLeft, sub: 'vs. mes anterior' },
        { label: 'Cobros pendientes', value: pendingTotal, change: `${pendingCobros.length} cobros`, icon: ArrowUpRight, sub: 'por cobrar este mes' },
      ];

  return <div className="kpi-grid">{metrics.map((m, i) => <article key={m.label} className={`kpi ${i === 0 ? 'kpi-featured' : ''}`}><div className="kpi-top"><span>{m.label}</span><span className="kpi-icon"><m.icon size={15} strokeWidth={1.6}/></span></div><div className="kpi-value">{money(m.value, settings.currency)}<small>USD</small></div><div className="kpi-bottom"><span className="kpi-change">{i < 2 && m.change ? <ArrowUpRight size={11}/> : null} {m.change}</span><span>{m.sub}</span></div></article>)}</div>;
}

export function Status({ status }: { status: Transaction['status'] }) { return <span className={`status ${status === 'Pendiente' ? 'pending' : status === 'Vencido' ? 'overdue' : ''}`}>{status}</span>; }

export function TransactionTable({ rows }: { rows: Transaction[] }) {
  const { clients, settings } = useVendo();
  const [selected, setSelected] = useState<Transaction | null>(null);
  return <>{rows.length ? <table className="transaction-table"><thead><tr><th>CLIENTE / CONCEPTO</th><th>CATEGORÍA</th><th>FECHA</th><th>IMPORTE</th><th>ESTADO</th><th/></tr></thead><tbody>{rows.map(t => { const c = clients.find(c => c.id === t.clientId); return <tr key={t.id}><td><div className="client-cell"><span className={`client-avatar ${c?.tone || ''}`}>{c?.initials || t.clientName.slice(0, 2).toUpperCase()}</span><div>{t.clientName}<small>{t.description}</small></div></div></td><td><span className="service-tag">{t.service}</span></td><td className="text-muted-foreground whitespace-nowrap">{shortDate(t.date)}</td><td><span className={`amount ${t.type === 'Ingreso' ? 'text-primary' : 'text-muted-foreground'}`}>{t.type === 'Ingreso' ? '+' : '−'}{money(t.amount, settings.currency)}</span></td><td><Status status={t.status}/></td><td><Button variant="ghost" size="icon" title="Ver movimiento" aria-label={`Ver ${t.id}`} onClick={() => setSelected(t)}><MoreHorizontal size={15}/></Button></td></tr>; })}</tbody></table> : <div className="empty">No hay movimientos con estos filtros.</div>}<Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg"><DialogHeader><DialogTitle>Detalle del movimiento</DialogTitle><DialogDescription>{selected?.id}</DialogDescription></DialogHeader>{selected && <div className="space-y-5"><p className="text-2xl font-mono">{money(selected.amount, settings.currency)}</p><p>{selected.clientName}</p><p className="text-muted-foreground">{selected.description} · {selected.service}</p><div className="flex justify-between"><span>{shortDate(selected.date)}</span><Status status={selected.status}/></div></div>}</DialogContent></Dialog></>;
}

export function Footer() { return <footer className="page-footer"><span>© {new Date().getFullYear()} VENDO. Cada detalle cuenta.</span><span className="flex gap-2 items-center"><span className="status-dot"/>Datos en vivo · USD</span></footer>; }

export function RecentTransactions() {
  const { transactions, search } = useVendo();
  const rows = transactions.filter(t => `${t.clientName} ${t.description} ${t.service}`.toLowerCase().includes(search.toLowerCase())).slice(0, 5);
  return <section className="panel transactions-panel"><div className="panel-head"><div><h2>Últimos movimientos</h2><p>La actividad más reciente de tu negocio.</p></div><Button variant="link" asChild className="h-auto p-0 text-[10px]"><Link to="/movimientos">Ver todos <ArrowUpRight size={12}/></Link></Button></div><TransactionTable rows={rows}/></section>;
}
