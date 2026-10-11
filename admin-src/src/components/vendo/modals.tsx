import { useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVendo } from './store';
import { categoryLabel, INCOME_CATEGORIES, todayIso } from '@/lib/vendo/data';
import { toast } from 'sonner';

export function VendoModals() {
  const { modal, setModal, clients, modalClientId, addClient, addTransaction } = useVendo();
  return (
    <Dialog open={modal !== null} onOpenChange={(open) => { if (!open) setModal(null); }}>
      <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modal === 'client' ? 'Nuevo cliente' : 'Registrar cobro'}</DialogTitle>
          <DialogDescription>{modal === 'client' ? 'Un nuevo vínculo para tu negocio.' : 'Cada movimiento, en su lugar.'}</DialogDescription>
        </DialogHeader>
        {modal === 'client'
          ? <ClientForm onSave={async (data) => { await addClient(data); setModal(null); toast.success('Cliente añadido'); }} />
          : <PaymentForm clients={clients} presetClientId={modalClientId} onSave={async (data) => { await addTransaction(data); setModal(null); toast.success('Cobro registrado'); }} />}
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
      <label className="field">Nombre completo<Input name="full_name" required placeholder="Nombre y apellido" /></label>
      <label className="field">Correo electrónico<Input name="email" type="email" placeholder="nombre@empresa.com" /></label>
      <label className="field">WhatsApp (dígitos con código de país)<Input name="whatsapp_number" placeholder="584121234567" /></label>
      <label className="field">Notas<Input name="notes" placeholder="Notas internas" /></label>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
      <Button type="submit" className="h-11">Crear cliente</Button>
    </form>
  );
}

type TransactionInput = { client_id?: string; description: string; category: string; amount_usd: number | string; date?: string };

function PaymentForm({ clients, presetClientId, onSave }: { clients: ReturnType<typeof useVendo>['clients']; presetClientId: string | null; onSave: (data: TransactionInput) => Promise<void> }) {
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const d = new FormData(e.currentTarget);
    try {
      await onSave({
        client_id: String(d.get('client_id') || '') || undefined,
        description: String(d.get('description') || '').trim(),
        category,
        amount_usd: String(d.get('amount') || ''),
        date: String(d.get('date') || '') || undefined,
      });
    } catch (err) {
      setError((err as Error).message || 'No se pudo registrar el cobro');
    }
  };
  return (
    <form className="modal-form" onSubmit={submit}>
      <label className="field">Cliente<select name="client_id" required defaultValue={presetClientId || ''}>{clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</select></label>
      <label className="field">Concepto<Input name="description" required placeholder="Descripción del cobro" /></label>
      <label className="field">Categoría<select value={category} onChange={(e) => setCategory(e.target.value)}>{INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label>
      <div className="form-columns">
        <label className="field">Importe (USD)<Input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
        <label className="field">Fecha<Input name="date" type="date" required defaultValue={todayIso()} /></label>
      </div>
      {error && <p className="text-destructive text-[11px]">{error}</p>}
      <Button type="submit" className="h-11">Registrar cobro</Button>
    </form>
  );
}
