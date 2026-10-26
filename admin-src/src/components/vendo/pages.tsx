import { useEffect, useState, type FormEvent } from 'react';
import { Search, ArrowUpRight, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { useVendo } from './store';
import { useAuth } from './auth';
import { PageHeading, TransactionTable, Kpis, Footer } from './shared';
import {
  ALL_CATEGORIES,
  categoryLabel,
  exportCsv,
  money,
  SERVICE_TYPES,
  serviceLabel,
  shortDate,
  type Client,
  type Cobro,
} from '@/lib/vendo/data';
import { toast } from 'sonner';

const COBRO_STATUS: Record<string, { label: string; className: string }> = {
  al_dia: { label: 'Al día', className: '' },
  proximo_a_vencer: { label: 'Próximo a vencer', className: 'pending' },
  vencido: { label: 'Vencido', className: 'overdue' },
  suspendido: { label: 'Suspendido', className: 'overdue' },
};

function cobroTone(status: string): string {
  if (status === 'al_dia') return 'Completado';
  if (status === 'vencido') return 'Vencido';
  if (status === 'suspendido') return 'Suspendido';
  return 'Pendiente';
}

export function TransactionsPage({ billing = false }: { billing?: boolean }) {
  const { transactions, clients, search, settings, markPaid, customCategories } = useVendo();
  const { cobros } = useVendo();
  const [filter, setFilter] = useState('Todos');
  const [category, setCategory] = useState('Todas');
  const [localSearch, setLocalSearch] = useState('');

  if (billing) {
    const rows = cobros.filter((c) => filter === 'Todos' || cobroTone(c.status) === filter);
    const handlePay = async (cobro: Cobro) => {
      try {
        await markPaid(cobro);
        toast.success('Cobro marcado como pagado');
      } catch (error) {
        toast.error((error as Error).message || 'No se pudo registrar el pago');
      }
    };
    return (
      <div className="page">
        <PageHeading title="Cada cobro, bajo control." eyebrow="COBROS & FACTURACIÓN" subtitle="Gestiona tus ingresos y mantén tus cuentas al día." />
        <Kpis billing />
        <div className="filter-bar">
          <div className="segmented">
            {['Todos', 'Completado', 'Pendiente', 'Vencido'].map((f) => (
              <Button variant="ghost" size="sm" key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</Button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className="space-y-3">
            {rows.map((c, index) => {
              const initials = c.client_name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
              const status = COBRO_STATUS[c.status] || { label: c.status, className: '' };
              return (
                <article className="panel p-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center" key={c.client_service_id}>
                  <div className="client-cell min-w-0">
                    <span className={`client-avatar ${['lime', 'teal', 'sand', 'blue', 'rose'][index % 5]}`}>{initials}</span>
                    <div className="min-w-0">
                      <h2 className="text-sm truncate">{c.client_name}</h2>
                      <small>{serviceLabel(c.service_type)} · vence {shortDate(c.next_due_date)}</small>
                      {c.days_overdue > 0 && <p className="mt-2 text-[10px] text-destructive">{c.days_overdue} día(s) de mora</p>}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="amount">{money(c.amount_cents / 100, settings.currency)}</p>
                    <span className={`status ${status.className}`}>{status.label}</span>
                    {c.status !== 'al_dia' && c.status !== 'suspendido' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handlePay(c)}><Check />Marcar pagado</Button>
                        {c.status === 'vencido' && c.whatsapp_url && (
                          <Button size="sm" variant="outline" onClick={() => window.open(c.whatsapp_url, '_blank', 'noopener')}>Vencido · Cobrar</Button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">No hay cobros con este filtro.</div>
        )}
        <Footer />
      </div>
    );
  }

  const rows = transactions.filter(
    (t) =>
      (filter === 'Todos' || t.type === filter) &&
      (category === 'Todas' || t.category === category) &&
      `${t.clientName} ${t.description} ${t.service}`.toLowerCase().includes((search || localSearch).toLowerCase()),
  );

  return (
    <div className="page">
      <PageHeading title="El pulso de tu negocio." eyebrow="TU LIBRO DE MOVIMIENTOS" subtitle="Cada ingreso y egreso. Sin perder ningún detalle." />
      <div className="filter-bar">
        <div className="segmented">
          {['Todos', 'Ingreso', 'Egreso'].map((f) => (
            <Button variant="ghost" size="sm" key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
              {f === 'Ingreso' ? 'Ingresos' : f === 'Egreso' ? 'Egresos' : f}
            </Button>
          ))}
        </div>
        <div className="filter-inputs flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar en movimientos"
            className="flex-1 sm:max-w-44 min-w-[120px]"
          />
          <select
            aria-label="Filtrar por categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 sm:w-auto min-w-0 max-w-full text-xs"
          >
            <option value="Todas">Todas las categorías</option>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c, customCategories)}</option>)}
            {customCategories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => exportCsv(rows, clients)}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>
      <section className="panel transactions-panel"><TransactionTable rows={rows} /></section>
      <Footer />
    </div>
  );
}

export function ClientsPage() {
  const { clients, transactions, search, setModal, settings } = useVendo();
  const [query, setQuery] = useState('');
  const [service, setService] = useState('Todos los servicios');
  const [selected, setSelected] = useState<Client | null>(null);
  const rows = clients.filter(
    (c) =>
      `${c.name} ${c.company} ${c.email} ${c.whatsapp}`.toLowerCase().includes((search || query).toLowerCase()) &&
      (service === 'Todos los servicios' || c.services.some((s) => s.serviceLabel === service)),
  );
  const totalFor = (clientId: string) =>
    transactions.filter((t) => t.clientId === clientId && t.type === 'Ingreso').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="page">
      <PageHeading title="Conexiones que crean valor." eyebrow="RELACIONES & CLIENTES" subtitle={`${clients.length} clientes. Un mundo de posibilidades.`} client />
      <div className="filter-bar">
        <div className="flex items-center gap-2 w-full max-w-sm">
          <Search size={16} className="text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, empresa o correo" aria-label="Buscar clientes" />
        </div>
        <select value={service} aria-label="Servicio de clientes" onChange={(e) => setService(e.target.value)}>
          <option>Todos los servicios</option>
          {SERVICE_TYPES.map((s) => <option key={s}>{serviceLabel(s)}</option>)}
        </select>
      </div>
      <div className="client-grid">
        {rows.map((c) => (
          <article key={c.id} className="panel client-card">
            <div className="flex justify-between">
              <span className={`client-avatar ${c.tone}`}>{c.initials}</span>
              <span className="status h-fit">{c.status}</span>
            </div>
            <h2>{c.company}</h2>
            <p>{c.email || c.whatsapp || 'Sin contacto'}</p>
            <div className="mt-5"><span className="service-tag">{c.service}</span></div>
            <footer>
              <span className="text-[10px] text-muted-foreground">{c.isEntrepreneur ? 'Emprendedor' : 'Cliente VENDO'}</span>
              <Button variant="link" className="p-0 h-auto text-[10px]" onClick={() => setSelected(c)}>Ver perfil<ArrowUpRight size={12} /></Button>
            </footer>
          </article>
        ))}
      </div>
      {!rows.length && <div className="empty">No se encontraron clientes.</div>}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.company}</DialogTitle>
            <DialogDescription>{selected?.email || selected?.whatsapp || 'Sin contacto'}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground text-xs mb-2">Total facturado</p>
                <p className="font-mono text-xl">{money(totalFor(selected.id), settings.currency)}</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-muted-foreground text-xs mb-3">Servicios</p>
                {selected.services.length ? selected.services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 text-[11px]">
                    <div>
                      <p>{s.serviceLabel}</p>
                      <p className="text-muted-foreground text-[9px]">{money(s.amountCents / 100, settings.currency)} · {s.paymentKind === 'recurring' ? 'Mensual' : 'Pago único'}{s.nextDueDate ? ` · vence ${shortDate(s.nextDueDate)}` : ''}</p>
                    </div>
                  </div>
                )) : <p className="text-muted-foreground text-[11px]">Sin servicios.</p>}
              </div>
              <Button className="w-full" onClick={() => { setModal('payment', selected.id); setSelected(null); }}>Registrar Cobro</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}

export function SettingsPage() {
  const { settings, saveSettings } = useVendo();
  const { email } = useAuth();
  const [draft, setDraft] = useState(settings);
  useEffect(() => { setDraft(settings); }, [settings]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await saveSettings(draft);
      toast.success('Ajustes guardados');
    } catch (error) {
      toast.error((error as Error).message || 'No se pudieron guardar los ajustes');
    }
  };

  return (
    <div className="page">
      <div className="page-heading"><div><div className="eyebrow">TU WORKSPACE, A TU MANERA</div><h1>Los detalles hacen la diferencia.</h1><p>Configura tu negocio y tus preferencias.</p></div></div>
      <form onSubmit={submit}>
        <section className="settings-section pt-0">
          <h2>Información del negocio</h2>
          <div className="settings-grid">
            <label className="field">Nombre comercial<Input required value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></label>
            <label className="field">Correo de contacto<Input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
            <label className="field">Zona horaria<Input readOnly value="UTC" /></label>
            <label className="field">Moneda<span className="text-muted-foreground text-[11px]">USD (el panel opera en dólares)</span></label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Ganancias compartidas y cobros</h2>
          <div className="settings-grid">
            <label className="field">% Vendo en fotografía<Input type="number" min="0" max="100" step="0.01" value={draft.photography_vendo_pct} onChange={(e) => setDraft({ ...draft, photography_vendo_pct: e.target.value })} /></label>
            <label className="field">% Vendo en creación de marca<Input type="number" min="0" max="100" step="0.01" value={draft.branding_vendo_pct} onChange={(e) => setDraft({ ...draft, branding_vendo_pct: e.target.value })} /></label>
            <label className="field">Días de advertencia previa<Input type="number" min="0" max="60" value={draft.days_before_due_warning} onChange={(e) => setDraft({ ...draft, days_before_due_warning: e.target.value })} /></label>
            <label className="field">Días de mora para suspensión<Input type="number" min="0" max="120" value={draft.days_overdue_to_suspend} onChange={(e) => setDraft({ ...draft, days_overdue_to_suspend: e.target.value })} /></label>
          </div>
          <label className="field mt-5">Plantilla de WhatsApp<Textarea rows={3} value={draft.whatsapp_reminder_template} onChange={(e) => setDraft({ ...draft, whatsapp_reminder_template: e.target.value })} /></label>
          <p className="text-muted-foreground text-[9px] mt-2">Variables: {'{nombre} {monto} {servicio} {fecha} {dias_mora}'}</p>
          <label className="field mt-5">Asunto del correo<Input value={draft.email_reminder_subject} onChange={(e) => setDraft({ ...draft, email_reminder_subject: e.target.value })} /></label>
          <label className="field mt-5">Plantilla de correo<Textarea rows={3} value={draft.email_reminder_template} onChange={(e) => setDraft({ ...draft, email_reminder_template: e.target.value })} /></label>
        </section>

        <section className="settings-section">
          <h2>Notificaciones</h2>
          <div className="settings-toggle">
            <div><label htmlFor="payment-notifications">Actividad de cobros</label><p>Recibe notificaciones al registrar un pago.</p></div>
            <Switch id="payment-notifications" checked={draft.notifications} onCheckedChange={(v) => setDraft({ ...draft, notifications: v })} />
          </div>
          <div className="settings-toggle">
            <div><label htmlFor="payment-reminders">Recordatorios de vencimiento</label><p>Mantén a la vista los cobros pendientes.</p></div>
            <Switch id="payment-reminders" checked={draft.reminders} onCheckedChange={(v) => setDraft({ ...draft, reminders: v })} />
          </div>
        </section>

        <section className="settings-section">
          <h2>Mi perfil</h2>
          <div className="flex items-center gap-4">
            <span className="avatar h-12 w-12">{(email || 'V')[0].toUpperCase()}</span>
            <div><p>{email || 'Administrador'}</p><p className="mt-1 text-muted-foreground text-[10px]">Administrador del panel</p></div>
          </div>
        </section>

        <div className="pt-6">
          <Button type="submit">Guardar cambios</Button>
        </div>
      </form>
      <Footer />
    </div>
  );
}
