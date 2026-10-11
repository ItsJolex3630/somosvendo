import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/vendo/dashboard';
import { vendoHead } from '@/lib/vendo/meta';
export const Route = createFileRoute('/')({ head: () => vendoHead('Dashboard', 'La perspectiva ejecutiva de VENDO: balance, flujo de efectivo, ingresos y relaciones con clientes.'), component: Dashboard });
