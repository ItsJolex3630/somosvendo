import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/components/vendo/pages';
import { vendoHead } from '@/lib/vendo/meta';
export const Route = createFileRoute('/ajustes')({ head: () => vendoHead('Ajustes', 'Personaliza la información comercial y las preferencias de tu workspace VENDO.'), component: SettingsPage });
