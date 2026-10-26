import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { categoryLabel, money, type Transaction } from '@/lib/vendo/data';
import { useVendo } from './store';

const incomeColor = 'var(--chart-income)';
const expenseColor = 'var(--chart-expense)';
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

type Point = { day: string; income: number; expense: number };

function bucketDay(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS_SHORT[date.getMonth()]}`;
}

function buildSeries(transactions: Transaction[], days: number, weekly: boolean): Point[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { key: string; label: string; income: number; expense: number }[] = [];
  if (weekly) {
    const weeks = Math.ceil(days / 7);
    for (let w = weeks - 1; w >= 0; w -= 1) {
      const start = new Date(today);
      start.setDate(start.getDate() - (w * 7 + 6));
      buckets.push({ key: `w${w}`, label: bucketDay(start), income: 0, expense: 0 });
    }
    for (const t of transactions) {
      const d = new Date(`${t.date.slice(0, 10)}T12:00:00`);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
      if (diff < 0 || diff >= days) continue;
      const idx = weeks - 1 - Math.floor(diff / 7);
      const bucket = buckets[idx];
      if (!bucket) continue;
      if (t.type === 'Ingreso') bucket.income += t.amount;
      else bucket.expense += t.amount;
    }
  } else {
    const map = new Map<string, { key: string; label: string; income: number; expense: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { key, label: bucketDay(d), income: 0, expense: 0 });
    }
    for (const t of transactions) {
      const bucket = map.get(t.date.slice(0, 10));
      if (!bucket) continue;
      if (t.type === 'Ingreso') bucket.income += t.amount;
      else bucket.expense += t.amount;
    }
    buckets.push(...map.values());
  }
  return buckets.map((b) => ({ day: b.label, income: b.income, expense: b.expense }));
}

function windowIncome(transactions: Transaction[], fromDaysAgo: number, toDaysAgo: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'Ingreso') continue;
    const d = new Date(`${t.date.slice(0, 10)}T12:00:00`);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    if (diff >= fromDaysAgo && diff < toDaysAgo) total += t.amount;
  }
  return total;
}

export function CashflowChart() {
  const { transactions } = useVendo();
  const [period, setPeriod] = useState('month');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const data = useMemo(
    () => buildSeries(transactions, period === 'week' ? 7 : period === 'quarter' ? 90 : 30, period === 'quarter'),
    [transactions, period],
  );
  const days = period === 'week' ? 7 : period === 'quarter' ? 90 : 30;
  const total = data.reduce((s, p) => s + p.income, 0);
  const current = windowIncome(transactions, 0, days);
  const previous = windowIncome(transactions, days, days * 2);
  const change = previous ? `${(((current - previous) / Math.abs(previous)) * 100).toFixed(1)}%` : '';

  return <section className="panel"><div className="panel-head"><div><h2>Flujo de efectivo</h2><p>Una visión clara de tus ingresos y egresos.</p></div><select aria-label="Periodo del flujo" className="text-[9px] py-1.5" value={period} onChange={e => setPeriod(e.target.value)}><option value="month">Este mes</option><option value="week">Esta semana</option><option value="quarter">Este trimestre</option></select></div><div className="chart-summary"><strong>{money(total)}</strong>{change && <span className="text-primary text-[9px] flex items-center gap-1"><ArrowUpRight size={12}/>{change}</span>}<div className="legend"><span><i/>Ingresos</span><span><i className="expense"/>Egresos</span></div></div><div className="chart-box" aria-label="Gráfica de flujo de efectivo">{ready && <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:10,right:8,left:0,bottom:0}}><defs><linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={incomeColor} stopOpacity={.17}/><stop offset="100%" stopColor={incomeColor} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 5"/><XAxis dataKey="day" axisLine={false} tickLine={false} minTickGap={30} dy={10}/><YAxis axisLine={false} tickLine={false} tickFormatter={v => `$${v/1000}k`} width={48} tickCount={5}/><Tooltip content={({active,payload,label}) => active && payload?.length ? <div className="chart-tooltip"><p className="mb-2 text-muted-foreground">{label}</p>{payload.map(p => <p key={p.dataKey} className={p.dataKey === 'income' ? 'text-primary' : 'text-teal'}>{p.dataKey === 'income' ? 'Ingresos' : 'Egresos'}: {money(Number(p.value))}</p>)}</div> : null}/><Area type="monotone" dataKey="expense" stroke={expenseColor} fill="transparent" strokeWidth={1.5} strokeDasharray="5 4"/><Area type="monotone" dataKey="income" stroke={incomeColor} fill="url(#cash-fill)" strokeWidth={2}/></AreaChart></ResponsiveContainer>}</div><div className="chart-foot"><span className="flex items-center gap-1.5"><ArrowUpRight size={12} className="text-primary"/>Ingresos acumulados del periodo.</span><span>vs. periodo anterior</span></div></section>;
}

export function IncomeBreakdown() {
  const { incomeByCategory, expenseByCategory, customCategories } = useVendo();
  const [mode, setMode] = useState<'income' | 'expense'>('income');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const source = mode === 'income' ? incomeByCategory : expenseByCategory;
  const data = source
    .filter((c) => c.total_cents > 0)
    .map((c) => ({ name: categoryLabel(c.category, customCategories), value: c.total_cents / 100 }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = mode === 'income'
    ? [incomeColor, 'var(--teal)', expenseColor, 'var(--blue)', 'var(--warning)']
    : [expenseColor, 'var(--warning)', 'var(--blue)', 'var(--teal)', incomeColor];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{mode === 'income' ? 'Ingresos por categoría' : 'Gastos por categoría'}</h2>
          <p>{mode === 'income' ? 'El valor de lo que hacemos.' : 'En qué se invierte y gasta.'}</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-[9px]">
          <button
            type="button"
            onClick={() => setMode('income')}
            className={`px-2 py-1 rounded ${mode === 'income' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'}`}
          >
            Ingresos
          </button>
          <button
            type="button"
            onClick={() => setMode('expense')}
            className={`px-2 py-1 rounded ${mode === 'expense' ? 'bg-destructive text-white font-medium' : 'text-muted-foreground'}`}
          >
            Gastos
          </button>
        </div>
      </div>
      <div className="service-donut">
        {ready && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={61} outerRadius={74} paddingAngle={5} stroke="none" cornerRadius={3} startAngle={90} endAngle={-270}>
                {data.map((d, i) => <Cell key={d.name} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip">{payload[0]?.name}<br />{money(Number(payload[0]?.value))}</div> : null} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="donut-center">
          <span>{mode === 'income' ? 'Total de ingresos' : 'Total de gastos'}</span>
          <strong>{money(total)}</strong>
          <span className="mt-1">USD</span>
        </div>
      </div>
      <div className="service-list">
        {data.length ? data.map((d) => (
          <div key={d.name} className="service-row">
            <i />
            <span>{d.name}</span>
            <span>{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        )) : (
          <div className="empty">{mode === 'income' ? 'Sin ingresos este mes.' : 'Sin gastos este mes.'}</div>
        )}
      </div>
    </section>
  );
}
