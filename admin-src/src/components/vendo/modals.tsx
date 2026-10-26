import { useState, useEffect, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVendo, type NewTransactionInput } from './store';
import {
  categoryLabel,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  todayIso,
  type MovementFrequency,
} from '@/lib/vendo/data';
import { toast } from 'sonner';

const QUICK_EXPENSE_PRESETS = [
  { label: '⚡ Créditos IA / Tokens', category: 'ai_credits', freq: 'one_time' as const, hint: 'Recarga de créditos / tokens IA' },
  { label: '🔁 Suscripción Software', category: 'software_sub', freq: 'recurring' as const, hint: 'Suscripción mensual de plataforma' },
  { label: '📢 Publicidad / Ads', category: 'advertising', freq: 'one_time' as const, hint: 'Campaña publicitaria Meta / Google' },
  { label: '🏷️ Etiquetas NFC', category: 'nfc_reinvestment', freq: 'one_time' as const, hint: 'Compra de tarjetas / etiquetas NFC' },
  { label: '🌐 Dominio / Servidor', category: 'domains_servers', freq: 'recurring' as const, hint: 'Renovación de dominio o servidor' },
  { label: '🛠️ Gasto Único del Momento', category: 'unexpected', freq: 'one_time' as const, hint: 'Gasto rápido imprevisto' },
];

export function VendoModals() {
  const { modal, setModal, clients, modalClientId, addClient, addTransaction } = useVendo();
  const isClient = modal === 'client';
  const defaultKind = modal === 'expense' ? 'expense' : 'income';

  return (
    <Dialog open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}>
      <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isClient ? 'Nuevo cliente' : modal === 'expense' ? 'Registrar gasto o egreso' : 'Registrar movimiento'}
          </DialogTitle>
          <DialogDescription>
            {isClient
              ? 'Un nuevo vínculo comercial en la base de datos de VENDO.'
              : 'Registra ganancias o gastos (fijos mensuales o únicos del momento) directamente en Turso DB.'}
          </DialogDescription>
        </DialogHeader>
        {isClient ? (
          <ClientForm
            onSave={async (data) => {
              await addClient(data);
              setModal(null);
              toast.success('Cliente añadido en la base de datos');
            }}
          />
        ) : (
          <MovementForm
            defaultKind={defaultKind}
            clients={clients}
            presetClientId={modalClientId}
            onSave={async (data) => {
              await addTransaction(data);
              setModal(null);
              toast.success(data.kind === 'expense' ? 'Gasto registrado correctamente' : 'Ingreso registrado correctamente');
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ClientInput = { full_name: string; email?: string; whatsapp_number?: string; notes?: string };

function ClientForm({ onSave }: { onSave: (data: ClientInput) => Promise<void> }) {
  const [error, setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      await onSave({
        full_name: String(d.get('full_name') || '').trim(),
        email: String(d.get('email') || '') || undefined,
        whatsapp_number: String(d.get('whatsapp_number') || '') || undefined,
        notes: String(d.get('notes') || '') || undefined,
      });
    } catch (err) {
      setError((err as Error).message || 'No se pudo crear el cliente');
    }
  };
  return (
    <form className="modal-form" onSubmit={submit}>
      <label className="field">Nombre completo o Empresa<Input name="full_name" required placeholder="Ej. Kimtoug, Masa Fácil..." /></label>
      <label className="field">Correo electrónico<Input name="email" type="email" placeholder="nombre@empresa.com" /></label>
      <label className="field">WhatsApp (dígitos con código de país)<Input name="whatsapp_number" placeholder="584121234567" /></label>
      <label className="field">Notas<Input name="notes" placeholder="Notas internas del cliente" /></label>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
      <Button type="submit" className="h-11">Crear cliente</Button>
    </form>
  );
}

function MovementForm({
  defaultKind,
  clients,
  presetClientId,
  onSave,
}: {
  defaultKind: 'income' | 'expense';
  clients: ReturnType<typeof useVendo>['clients'];
  presetClientId: string | null;
  onSave: (data: NewTransactionInput) => Promise<void>;
}) {
  const { customCategories } = useVendo();
  const [kind, setKind] = useState<'income' | 'expense'>(defaultKind);
  const [frequency, setFrequency] = useState<MovementFrequency>('one_time');
  const [category, setCategory] = useState<string>(defaultKind === 'expense' ? 'ai_credits' : INCOME_CATEGORIES[0]);
  const [creatingCustomCat, setCreatingCustomCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [clientId, setClientId] = useState(presetClientId || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setKind(defaultKind);
    setCategory(defaultKind === 'expense' ? 'ai_credits' : INCOME_CATEGORIES[0]);
  }, [defaultKind]);

  const baseList = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const userCats = customCategories.filter((c) => c.kind === kind);

  const handleKindSwitch = (nextKind: 'income' | 'expense') => {
    setKind(nextKind);
    setCreatingCustomCat(false);
    setCategory(nextKind === 'expense' ? 'ai_credits' : INCOME_CATEGORIES[0]);
  };

  const applyPreset = (preset: typeof QUICK_EXPENSE_PRESETS[number]) => {
    setKind('expense');
    setCategory(preset.category);
    setFrequency(preset.freq);
    setCreatingCustomCat(false);
    if (!description) setDescription(preset.hint);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      await onSave({
        kind,
        frequency,
        category: creatingCustomCat ? 'custom_item' : category,
        new_category_label: creatingCustomCat && newCatLabel.trim() ? newCatLabel.trim() : undefined,
        client_id: clientId || undefined,
        description: description.trim() || (creatingCustomCat ? newCatLabel.trim() : categoryLabel(category, customCategories)),
        amount_usd: amount,
        date: String(d.get('date') || '') || undefined,
      });
    } catch (err) {
      setError((err as Error).message || 'No se pudo registrar el movimiento');
    }
  };

  return (
    <form className="modal-form space-y-4" onSubmit={submit}>
      {/* Selector Tipo de Movimiento: Ingreso vs Gasto */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-secondary/40 border border-border">
        <button
          type="button"
          onClick={() => handleKindSwitch('income')}
          className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
            kind === 'income' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          💰 Ingreso / Ganancia
        </button>
        <button
          type="button"
          onClick={() => handleKindSwitch('expense')}
          className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
            kind === 'expense' ? 'bg-destructive text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          💸 Gasto / Egreso
        </button>
      </div>

      {/* Atajos rápidos para Gastos comunes */}
      {kind === 'expense' && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Atajos de gasto rápido:</span>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_EXPENSE_PRESETS.map((p) => (
              <button
                key={p.category}
                type="button"
                onClick={() => applyPreset(p)}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                  category === p.category && !creatingCustomCat
                    ? 'border-primary bg-primary/15 text-primary font-medium'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Frecuencia: Único del momento vs Fijo mensual */}
      <div className="field">
        <span>Modalidad del {kind === 'expense' ? 'gasto' : 'ingreso'}</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            type="button"
            onClick={() => setFrequency('one_time')}
            className={`py-2 px-2.5 rounded-md border text-[11px] text-left transition-all ${
              frequency === 'one_time' ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground'
            }`}
          >
            ⚡ Único (por el momento)
          </button>
          <button
            type="button"
            onClick={() => setFrequency('recurring')}
            className={`py-2 px-2.5 rounded-md border text-[11px] text-left transition-all ${
              frequency === 'recurring' ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground'
            }`}
          >
            🔁 Fijo / Recurrente (mensual)
          </button>
        </div>
      </div>

      {/* Categoría + Opción de crear nueva categoría personalizada */}
      <div className="field">
        <div className="flex justify-between items-center">
          <span>Categoría</span>
          <button
            type="button"
            onClick={() => setCreatingCustomCat((v) => !v)}
            className="text-[10px] text-primary hover:underline"
          >
            {creatingCustomCat ? '← Elegir categoría existente' : '+ Crear nuevo tipo / categoría'}
          </button>
        </div>
        {creatingCustomCat ? (
          <Input
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            required
            placeholder={kind === 'expense' ? 'Ej. Créditos Kimi, Freelancer, Transporte...' : 'Ej. Consultoría SEO, Mantenimiento...'}
          />
        ) : (
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <optgroup label={kind === 'expense' ? 'Tipos de Gastos' : 'Tipos de Ingresos'}>
              {baseList.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, customCategories)}
                </option>
              ))}
            </optgroup>
            {userCats.length > 0 && (
              <optgroup label="Categorías Personalizadas">
                {userCats.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      {/* Concepto / Descripción libre */}
      <label className="field">
        Concepto / Descripción detallada
        <Input
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder={
            kind === 'expense'
              ? 'Ej. Recarga urgente de créditos IA $10 para terminar página web'
              : 'Ej. Pago desarrollo web catálogo interactivo'
          }
        />
      </label>

      {/* Cliente vinculado (Opcional en ambos para permitir ganancias/gastos generales) */}
      <label className="field">
        Cliente vinculado (opcional)
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— General VENDO (Sin cliente específico) —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company}
            </option>
          ))}
        </select>
      </label>

      <div className="form-columns">
        <label className="field">
          Importe (USD)
          <Input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
          />
        </label>
        <label className="field">
          Fecha
          <Input name="date" type="date" required defaultValue={todayIso()} />
        </label>
      </div>

      {error && <p className="text-destructive text-[11px]">{error}</p>}
      <Button type="submit" className="h-11 w-full">
        {kind === 'expense' ? 'Registrar Gasto en Base de Datos' : 'Registrar Ingreso en Base de Datos'}
      </Button>
    </form>
  );
}
