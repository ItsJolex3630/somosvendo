import { createFileRoute } from '@tanstack/react-router';
import { ClientsPage } from '@/components/vendo/pages';
import { vendoHead } from '@/lib/vendo/meta';
export const Route = createFileRoute('/clientes')({ head: () => vendoHead('Clientes', 'Gestiona las relaciones, servicios y perfiles de clientes de VENDO.'), component: ClientsPage });
