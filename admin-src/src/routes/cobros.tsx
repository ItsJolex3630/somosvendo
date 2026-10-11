import { createFileRoute } from '@tanstack/react-router';
import { TransactionsPage } from '@/components/vendo/pages';
import { vendoHead } from '@/lib/vendo/meta';
export const Route = createFileRoute('/cobros')({ head: () => vendoHead('Cobros', 'Controla los cobros completados, pendientes y vencidos de VENDO.'), component: () => <TransactionsPage billing/> });
