'use client';
import { useEffect, useState } from 'react';
import { Users, Stethoscope, Building2, CalendarDays, UserCog, FlaskConical, Pill, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, StatCard } from '@/components/ui';
import { RevenueChart, VisitsChart } from '@/components/charts';

const money = (n) => (n ?? 0).toLocaleString();
export default function AdminPage() {
  const [s, setS] = useState(null); const [sum, setSum] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    const to = new Date(), from = new Date(Date.now() - 13 * 864e5); const iso = (d) => d.toISOString().slice(0, 10);
    api('/stats/admin').then(setS).catch((e) => setErr(e.message));
    api('/reports/summary', { query: { from: iso(from), to: iso(to) } }).then(setSum).catch((e) => setErr(e.message));
  }, []);
  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Full system overview and control" />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Patients" value={s?.patients} icon={Users} />
        <StatCard label="Total Doctors" value={s?.doctors} icon={Stethoscope} tone="blue" />
        <StatCard label="Other Staff" value={s?.staff} icon={UserCog} tone="green" />
        <StatCard label="Departments" value={s?.departments} icon={Building2} tone="amber" />
        <StatCard label="Today's Appointments" value={s?.appointmentsToday} icon={CalendarDays} tone="blue" hint="Visits registered today" />
        <StatCard label="Laboratory Requests" value={s?.lab?.total} icon={FlaskConical} hint={s && `${s.lab.pending} not completed`} />
        <StatCard label="Pharmacy Prescriptions" value={s?.pharmacy?.total} icon={Pill} tone="green" hint={s && `${s.pharmacy.pending} pending`} />
        <StatCard label="Revenue (this month)" value={s && money(s.revenue.month.total)} icon={Wallet} tone="amber" hint={s && `Today: ${money(s.revenue.today.total)}`} />
      </div>
      <p className="mt-2 text-xs text-slate-400">Revenue = consultation fees collected at reception + pharmacy bills paid.</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">{sum && <><VisitsChart daily={sum.daily} /><RevenueChart daily={sum.daily} /></>}</div>
    </>
  );
}
