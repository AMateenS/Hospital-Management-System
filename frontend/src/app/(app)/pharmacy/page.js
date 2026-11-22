'use client';
import { useCallback, useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle2, Pill, AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PageHeader, StatCard } from '@/components/ui';
import PrescriptionsTab from '@/components/pharmacy/PrescriptionsTab';
import InventoryTab from '@/components/pharmacy/InventoryTab';
import PharmacistsTab from '@/components/pharmacy/PharmacistsTab';
import DispensingRecordsTab from '@/components/pharmacy/DispensingRecordsTab';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [s, setS] = useState(null); const [tab, setTab] = useState('rx'); const [filter, setFilter] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => api('/pharmacy/overview').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const goInv = (f) => { setFilter(f); setTab('inv'); };
  return (
    <>
      <PageHeader title="Pharmacy Dashboard" subtitle="Prescriptions, dispensing and medicine inventory" />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Prescriptions" value={s?.totalPrescriptions} icon={FileText} />
        <StatCard label="Pending" value={s?.pending} icon={Clock} tone="amber" />
        <StatCard label="Partially Dispensed" value={s?.partial} icon={Activity} tone="blue" />
        <StatCard label="Dispensed" value={s?.dispensed} icon={CheckCircle2} tone="green" />
        <StatCard label="Total Medicines" value={s?.totalMedicines} icon={Pill} tone="blue" hint={s?.returned ? `${s.returned} returned to doctors` : undefined} />
        <StatCard label="Low Stock" value={s?.lowStock} icon={AlertTriangle} tone="red" />
      </div>
      {s && (s.expired > 0 || s.lowStock > 0 || s.expiringSoon > 0) && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>Stock alerts:</b>
          {s.expired > 0 && <button className="underline" onClick={() => goInv('expired')}>{s.expired} expired</button>}
          {s.lowStock > 0 && <button className="underline" onClick={() => goInv('low')}>{s.lowStock} low stock</button>}
          {s.expiringSoon > 0 && <button className="underline" onClick={() => goInv('expiring')}>{s.expiringSoon} expiring within 60 days</button>}
        </div>)}
      <div className="mb-4 mt-6 flex gap-2 border-b border-slate-200">
        {[['rx', 'Patient prescriptions'], ['rec', 'Dispensing records'], ['inv', 'Medicine inventory'], ...(user.role === 'admin' ? [['staff', 'Pharmacists']] : [])].map(([k, l]) => <button key={k} onClick={() => { setTab(k); if (k === 'inv') setFilter(''); }} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>{l}</button>)}
      </div>
      {tab === 'rx' ? <PrescriptionsTab onChanged={load} /> : tab === 'rec' ? <DispensingRecordsTab /> : tab === 'inv' ? <InventoryTab key={filter} initialFilter={filter} onChanged={load} /> : <PharmacistsTab />}
    </>
  );
}
