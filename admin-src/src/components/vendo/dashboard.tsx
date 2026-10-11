import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageHeading, Kpis, RecentTransactions, Footer } from './shared';
import { CashflowChart, IncomeBreakdown } from './charts';
import { useAuth } from './auth';
import sculpture from '@/assets/treasury-sculpture.jpg';

function displayName(email: string): string {
  if (!email) return 'de nuevo';
  const local = email.split('@')[0].split(/[._-]+/)[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function Dashboard() {
  const { email } = useAuth();
  return (
    <div className="page">
      <PageHeading title="Todo en equilibrio." subtitle={`Bienvenido, ${displayName(email)}. Así se mueve tu negocio hoy.`} dashboard />
      <Kpis />
      <div className="analytics-grid">
        <CashflowChart />
        <IncomeBreakdown />
      </div>
      <RecentTransactions />
      <div className="dashboard-bottom">
        <section className="treasury-banner">
          <img src={sculpture} width={1152} height={576} loading="lazy" alt="Escultura de metal verde de VENDO" />
          <div className="banner-copy">
            <div className="eyebrow text-primary flex items-center gap-1.5"><Sparkles size={11} />VENDO, MÁS ALLÁ DE LOS NÚMEROS</div>
            <h3>Buenas relaciones. Grandes resultados.</h3>
            <p>Tu siguiente oportunidad comienza con una conexión.</p>
            <Button variant="link" asChild className="h-auto p-0 text-[10px]"><Link to="/clientes">Explorar clientes <ArrowUpRight size={12} /></Link></Button>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
