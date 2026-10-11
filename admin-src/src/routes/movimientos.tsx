import { createFileRoute } from '@tanstack/react-router';
import { TransactionsPage } from '@/components/vendo/pages';
import { vendoHead } from '@/lib/vendo/meta';
export const Route = createFileRoute('/movimientos')({ head: () => vendoHead('Movimientos', 'Todos los ingresos y egresos de VENDO en un libro de movimientos claro y organizado.'), component: TransactionsPage });
