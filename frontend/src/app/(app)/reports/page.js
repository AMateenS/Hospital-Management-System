'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, DataTable, PageHeader, StatCard } from '@/components/ui';
import { DeptChart, PieCard, RevenueChart, VisitsChart } from '@/components/charts';
import { Users, CalendarDays, CheckCircle2, FlaskConical, Pill, Wallet, AlertTriangle } from 'lucide-react';

const iso = (d) => d.toISOString().slice(0, 10);
const money = (n) => (n ?? 0).toLocaleString();

export default function ReportsPage() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5))); const [to, setTo] = useState(iso(new Date()));
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => { setErr(''); api('/reports/summary', { query: { from, to } }).then(setD).catch((e) => setErr(e.message)); }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const q = `from=${from}&to=${to}`; const t = d?.totals;
  const docCols = [{ key: 'name', header: 'Doctor' }, { key: 'specialization', header: 'Specialization' }, { key: 'visits', header: 'Visits' }, { key: 'completed', header: 'Completed' }, { key: 'revenue', header: 'Consultation revenue', render: (r) => money(r.revenue) }];
  return (
    <>
      <PageHeader title="Reports" subtitle="Operational and financial summary" />
      <Card className="mb-6"><div className="flex flex-wrap items-end gap-4">
        <label><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="ml-auto flex flex-wrap gap-2">{[['visits', 'Visits'], ['dispensing', 'Dispensing'], ['lab', 'Lab requests']].map(([k, l]) => (
          <a key={k} href={`/api/reports/export/${k}?${q}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"><Download className="h-4 w-4" />{l} CSV</a>))}</div>
      </div></Card>
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      {d && (<>
        <p className="mb-3 text-xs text-slate-400">{d.range.from} to {d.range.to} ({d.range.timezone}). Maximum range 1 year.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="New Patients" value={t.newPatients} icon={Users} /><StatCard label="Visits" value={t.visits} icon={CalendarDays} tone="blue" /><StatCard label="Completed Consultations" value={t.completed} icon={CheckCircle2} tone="green" />
          <StatCard label="Lab Requests" value={t.labRequests} icon={FlaskConical} tone="blue" /><StatCard label="Prescriptions" value={t.prescriptions} icon={Pill} tone="green" hint={`${t.dispensed} dispensed`} />
          <StatCard label="Revenue" value={money(t.revenue.total)} icon={Wallet} tone="amber" hint={`Consultation ${money(t.revenue.consultation)} · Pharmacy ${money(t.revenue.pharmacy)}`} />
          <StatCard label="Unpaid consultation fees" value={t.unpaidFees?.count ?? 0} icon={AlertTriangle} tone="red" hint={`${money(t.unpaidFees?.amount)} still to collect`} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2"><VisitsChart daily={d.daily} /><RevenueChart daily={d.daily} /><PieCard title="Visits by status" data={d.visitsByStatus} /><DeptChart data={d.byDepartment} /><PieCard title="Lab requests by status" data={d.labByStatus} />
          <Card title="Most common diagnoses">{d.topDiagnoses.length ? <ul className="space-y-2 text-sm">{d.topDiagnoses.map((x) => <li key={x.name} className="flex justify-between"><span className="capitalize">{x.name}</span><b>{x.count}</b></li>)}</ul> : <p className="text-sm text-slate-400">No diagnoses recorded</p>}</Card></div>
        <Card className="mt-6" title="Doctor performance"><DataTable columns={docCols} rows={d.byDoctor} empty="No visits in this period" /></Card>
      </>)}
    </>
  );
}
