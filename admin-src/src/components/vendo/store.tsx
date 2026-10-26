import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteMovement,
  fetchClients,
  fetchCobros,
  fetchCustomCategories,
  fetchMovements,
  fetchNotifications,
  fetchSettings,
  fetchSummary,
  getStoredEmail,
  postClient,
  postClientService,
  postCustomCategory,
  postMovement,
  postPayment,
  putMovement,
  putSettings,
} from '@/lib/vendo/api';
import {
  categoryLabel,
  initialsOf,
  MEMBERSHIP_STATUS_LABELS,
  serviceLabel,
  toneFor,
  type Alert,
  type ApiSettings,
  type Client,
  type Cobro,
  type CustomCategory,
  type Movement,
  type MovementFrequency,
  type SummaryResponse,
  type Transaction,
} from '@/lib/vendo/data';

const LOCAL_KEY = 'vendo_settings_local';

type LocalSettings = { company: string; email: string; notifications: boolean; reminders: boolean };

export type SettingsFull = LocalSettings &
  ApiSettings & { currency: 'USD' };

export type ModalKind = 'client' | 'payment' | 'expense' | null;

type NewClientInput = { full_name: string; email?: string; whatsapp_number?: string; notes?: string };
export type NewTransactionInput = {
  kind?: 'income' | 'expense';
  frequency?: MovementFrequency;
  new_category_label?: string;
  client_id?: string;
  description: string;
  category: string;
  amount_usd: number | string;
  date?: string;
};
type NewServiceInput = {
  service_type: string;
  payment_kind: string;
  amount_usd: number | string;
  billing_day?: number;
};

type Store = {
  summary: SummaryResponse | undefined;
  series: SummaryResponse['series'];
  incomeByCategory: SummaryResponse['income_by_category'];
  expenseByCategory: SummaryResponse['expense_by_category'];
  movements: Movement[];
  transactions: Transaction[];
  customCategories: CustomCategory[];
  clients: Client[];
  cobros: Cobro[];
  alerts: Alert[];
  settings: SettingsFull;
  loading: boolean;
  error: string;
  addClient: (input: NewClientInput) => Promise<void>;
  addService: (clientId: string, input: NewServiceInput) => Promise<void>;
  addTransaction: (input: NewTransactionInput) => Promise<void>;
  removeMovement: (id: string) => Promise<void>;
  updateMovement: (
    id: string,
    input: {
      amount_usd?: number | string;
      date?: string;
      description?: string;
      category?: string;
      frequency?: MovementFrequency;
      client_id?: string | null;
    },
  ) => Promise<void>;
  addCustomCategory: (input: { kind: 'income' | 'expense'; label: string; frequency_default?: MovementFrequency }) => Promise<CustomCategory>;
  markPaid: (cobro: Cobro, date?: string) => Promise<void>;
  saveSettings: (input: Partial<SettingsFull>) => Promise<void>;
  refresh: () => void;
  search: string;
  setSearch: (value: string) => void;
  modal: ModalKind;
  modalClientId: string | null;
  setModal: (value: ModalKind, clientId?: string | null) => void;
  doOpen: boolean;
  setDoOpen: (open: boolean) => void;
};

const Context = createContext<Store | null>(null);

function readLocal(): LocalSettings {
  const fallback: LocalSettings = {
    company: 'VENDO Studio',
    email: getStoredEmail(),
    notifications: true,
    reminders: true,
  };
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return fallback;
    const parsed = { ...fallback, ...(JSON.parse(raw) as Partial<LocalSettings>) };
    if (!parsed.email) parsed.email = fallback.email;
    return parsed;
  } catch {
    return fallback;
  }
}

function writeLocal(value: Partial<LocalSettings>) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...readLocal(), ...value }));
  } catch {
    /* noop */
  }
}

export function VendoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModalState] = useState<ModalKind>(null);
  const [modalClientId, setModalClientId] = useState<string | null>(null);
  const [doOpen, setDoOpen] = useState(false);
  const [local, setLocal] = useState<LocalSettings>(() => readLocal());

  const summaryQuery = useQuery({ queryKey: ['summary', 'this_month'], queryFn: () => fetchSummary('this_month') });
  const seriesQuery = useQuery({ queryKey: ['summary', 'last_6'], queryFn: () => fetchSummary('last_6') });
  const movementsQuery = useQuery({ queryKey: ['movements'], queryFn: () => fetchMovements() });
  const customCategoriesQuery = useQuery({ queryKey: ['custom_categories'], queryFn: () => fetchCustomCategories() });
  const clientsQuery = useQuery({ queryKey: ['clients'], queryFn: () => fetchClients() });
  const cobrosQuery = useQuery({ queryKey: ['cobros'], queryFn: () => fetchCobros() });
  const notificationsQuery = useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications() });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => fetchSettings() });

  const customCategories = customCategoriesQuery.data?.categories ?? [];
  const movements = movementsQuery.data?.movements ?? [];

  const transactions = useMemo<Transaction[]>(
    () =>
      movements.map((m) => ({
        id: m.id,
        clientId: m.client_id || '',
        clientName: m.client_name || (m.kind === 'expense' ? 'VENDO Operativo' : '—'),
        description: m.description || '—',
        category: m.category,
        service: categoryLabel(m.category, customCategories),
        amount: m.amount_cents / 100,
        date: m.movement_date,
        status: 'Completado',
        type: m.kind === 'income' ? 'Ingreso' : 'Egreso',
        frequency: m.frequency || 'one_time',
      })),
    [movements, customCategories],
  );

  const clients = useMemo<Client[]>(
    () =>
      (clientsQuery.data?.clients ?? []).map((c, index) => ({
        id: c.id,
        name: c.full_name,
        company: c.full_name,
        email: c.email || '',
        whatsapp: c.whatsapp_number || '',
        service: c.services[0] ? serviceLabel(c.services[0].service_type) : '—',
        initials: initialsOf(c.full_name),
        tone: toneFor(index),
        status: c.worst_status
          ? MEMBERSHIP_STATUS_LABELS[c.worst_status] || c.worst_status
          : c.is_active
            ? 'Activo'
            : 'Inactivo',
        isEntrepreneur: c.is_entrepreneur,
        services: c.services.map((s) => ({
          id: s.id,
          serviceType: s.service_type,
          serviceLabel: serviceLabel(s.service_type),
          paymentKind: s.payment_kind,
          amountCents: s.amount_cents,
          nextDueDate: s.next_due_date,
          status: s.status,
        })),
      })),
    [clientsQuery.data],
  );

  const settings = useMemo<SettingsFull>(() => {
    const api = settingsQuery.data?.settings;
    return {
      company: local.company,
      email: local.email,
      notifications: local.notifications,
      reminders: local.reminders,
      photography_vendo_pct: api?.photography_vendo_pct ?? '50',
      branding_vendo_pct: api?.branding_vendo_pct ?? '50',
      days_before_due_warning: api?.days_before_due_warning ?? '5',
      days_overdue_to_suspend: api?.days_overdue_to_suspend ?? '7',
      whatsapp_reminder_template: api?.whatsapp_reminder_template ?? '',
      email_reminder_subject: api?.email_reminder_subject ?? '',
      email_reminder_template: api?.email_reminder_template ?? '',
      currency: 'USD',
    };
  }, [settingsQuery.data, local]);

  const error =
    (summaryQuery.error as Error | null)?.message ||
    (movementsQuery.error as Error | null)?.message ||
    (clientsQuery.error as Error | null)?.message ||
    (cobrosQuery.error as Error | null)?.message ||
    '';
  const loading =
    summaryQuery.isLoading || movementsQuery.isLoading || clientsQuery.isLoading || cobrosQuery.isLoading;

  const invalidateCore = () => {
    queryClient.invalidateQueries({ queryKey: ['summary'] });
    queryClient.invalidateQueries({ queryKey: ['movements'] });
    queryClient.invalidateQueries({ queryKey: ['cobros'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['custom_categories'] });
  };

  const addClientMutation = useMutation({
    mutationFn: (input: NewClientInput) => postClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
  const addServiceMutation = useMutation({
    mutationFn: ({ clientId, input }: { clientId: string; input: NewServiceInput }) =>
      postClientService(clientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const addTransactionMutation = useMutation({
    mutationFn: (input: NewTransactionInput) =>
      postMovement({
        kind: input.kind || 'income',
        frequency: input.frequency || 'one_time',
        new_category_label: input.new_category_label,
        category: input.category,
        amount_usd: input.amount_usd,
        date: input.date,
        description: input.description,
        client_id: input.client_id,
      }),
    onSuccess: invalidateCore,
  });
  const removeMovementMutation = useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: invalidateCore,
  });
  const updateMovementMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof putMovement>[1] }) =>
      putMovement(id, input),
    onSuccess: invalidateCore,
  });
  const addCategoryMutation = useMutation({
    mutationFn: (input: { kind: 'income' | 'expense'; label: string; frequency_default?: MovementFrequency }) =>
      postCustomCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom_categories'] }),
  });
  const markPaidMutation = useMutation({
    mutationFn: ({ cobro, date }: { cobro: Cobro; date?: string }) =>
      postPayment({ client_service_id: cobro.client_service_id, amount_usd: (cobro.amount_cents / 100).toFixed(2), date }),
    onSuccess: invalidateCore,
  });
  const saveSettingsMutation = useMutation({
    mutationFn: (input: Partial<SettingsFull>) =>
      putSettings({
        photography_vendo_pct: input.photography_vendo_pct,
        branding_vendo_pct: input.branding_vendo_pct,
        days_before_due_warning: input.days_before_due_warning,
        days_overdue_to_suspend: input.days_overdue_to_suspend,
        whatsapp_reminder_template: input.whatsapp_reminder_template,
        email_reminder_subject: input.email_reminder_subject,
        email_reminder_template: input.email_reminder_template,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const value: Store = {
    summary: summaryQuery.data,
    series: seriesQuery.data?.series ?? [],
    incomeByCategory: summaryQuery.data?.income_by_category ?? [],
    expenseByCategory: summaryQuery.data?.expense_by_category ?? [],
    movements,
    transactions,
    customCategories,
    clients,
    cobros: cobrosQuery.data?.cobros ?? [],
    alerts: notificationsQuery.data?.alerts ?? [],
    settings,
    loading,
    error,
    addClient: async (input) => {
      await addClientMutation.mutateAsync(input);
    },
    addService: async (clientId, input) => {
      await addServiceMutation.mutateAsync({ clientId, input });
    },
    addTransaction: async (input) => {
      await addTransactionMutation.mutateAsync(input);
    },
    removeMovement: async (id) => {
      await removeMovementMutation.mutateAsync(id);
    },
    updateMovement: async (id, input) => {
      await updateMovementMutation.mutateAsync({ id, input });
    },
    addCustomCategory: async (input) => {
      const res = await addCategoryMutation.mutateAsync(input);
      return res.category;
    },
    markPaid: async (cobro, date) => {
      await markPaidMutation.mutateAsync({ cobro, date });
    },
    saveSettings: async (input) => {
      const localPatch = {
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.notifications !== undefined ? { notifications: input.notifications } : {}),
        ...(input.reminders !== undefined ? { reminders: input.reminders } : {}),
      };
      setLocal((prev) => ({ ...prev, ...localPatch }));
      writeLocal(localPatch);
      await saveSettingsMutation.mutateAsync(input);
    },
    refresh: () => {
      invalidateCore();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    search,
    setSearch,
    modal,
    modalClientId,
    setModal: (value, clientId = null) => {
      setModalClientId(value === 'payment' || value === 'expense' ? clientId : null);
      setModalState(value);
    },
    doOpen,
    setDoOpen,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVendo(): Store {
  const value = useContext(Context);
  if (!value) throw new Error('useVendo must be used within VendoProvider');
  return value;
}
