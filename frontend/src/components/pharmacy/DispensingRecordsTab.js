'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, StatCard } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { Users, ClipboardList, Wallet, AlertTriangle } from 'lucide-react';

const iso = (d) => d.toISOString().slice(0, 10);
const money = (n) => (n ?? 0).toFixed(2);

// Permanent record of what the pharmacy handed out: patient, medicines, quantities, price, doctor, pharmacist, date.
export default function DispensingRecordsTab() {
  const router = useRouter(); const toast = useToast();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5))); const [to, setTo] = useState(iso(new Date())); const [q, setQ] = useState(''); const [applied, setApplied] = useState('');
  const [d, setD] = useState(null); const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); return api('/pharmacy/dispensing', { query: { from, to, q: applied } }).then(setD).catch((e) => toast.error(e.message)).finally(() => setLoading(false)); }, [from, to, applied]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const markPaid = async (id, method) => { try { await api(`/pharmacy/dispensing/${id}/pay`, { method: 'PATCH', body: { method } }); toast.success(`Bill marked paid (${method})`); load(); } catch (e) { toast.error(e.message); } };
  const qs = new URLSearchParams({ from, to, ...(applied ? { q: applied } : {}) }).toString();

  const rows = (d?.rows || []).map((r) => ({ ...r, key: r._id }));
  const cols = [
    { key: 'at', header: 'Date / time', render: (r) => new Date(r.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'patient', header: 'Patient', render: (r) => <div><p className="font-medium">{r.patient}</p><p className="text-xs text-slate-500">{r.patientId}</p></div> },
    { key: 'rxNo', header: 'Rx / Visit', render: (r) => <div><p>{r.rxNo}</p><p className="text-xs text-slate-500">{r.visitNo}</p></div> },
    { key: 'doctor', header: 'Doctor' },
    { key: 'lines', header: 'Medicines given', render: (r) => <ul className="space-y-0.5">{r.lines.map((l, i) => <li key={i}>{l.name} {l.strength} <b>x {l.quantity}</b> <span className="text-xs text-slate-400">({money(l.lineTotal)})</span></li>)}</ul> },
    { key: 'total', header: 'Total', render: (r) => <div><b>{money(r.total)}</b>{r.discount > 0 && <p className="text-xs text-slate-400">discount {money(r.discount)}</p>}</div> },
    { key: 'bill', header: 'Bill / payment', render: (r) => (<div><p className="text-xs">{r.billNo || '-'}</p>{r.paid ? <Badge>{`Paid${r.paymentMethod ? ` (${r.paymentMethod})` : ''}`}</Badge> : <div><Badge>Unpaid</Badge><div className="mt-1 flex gap-1">{['Cash', 'Card', 'Online'].map((m) => <button key={m} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-50" onClick={() => markPaid(r._id, m)}>{m}</button>)}</div></div>}</div>) },
    { key: 'pharmacist', header: 'Pharmacist' },
    { key: 'a', header: '', render: (r) => (r.rxId ? <Button variant="ghost" onClick={() => router.push(`/pharmacy/receipt/${r.rxId}`)}>Receipt</Button> : null) },
  ];
  return (
    <div className="space-y-6">
      <Card><form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
        <label><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="min-w-[220px] flex-1"><span className="label">Search patient, medicine, doctor, Rx</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Ali, Panadol, RX-000012" /></label>
        <Button type="submit">Search</Button>
        <a href={`/api/pharmacy/dispensing/export?${qs}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"><Download className="h-4 w-4" />CSV</a>
      </form></Card>
      {d && (<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Dispensing records" value={d.summary.records} icon={ClipboardList} /><StatCard label="Patients served" value={d.summary.patients} icon={Users} tone="blue" /><StatCard label="Total billed" value={money(d.summary.total)} icon={Wallet} tone="amber" /><StatCard label="Unpaid bills" value={money(d.summary.unpaid)} icon={AlertTriangle} tone="red" /></div>
        <Card title="Medicines given in this period (total quantity)">{d.summary.medicines.length === 0 ? <p className="text-sm text-slate-400">Nothing dispensed in this period.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Medicine</th><th className="pb-2 text-right">Quantity given</th><th className="pb-2 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{d.summary.medicines.map((m) => <tr key={m.name}><td className="py-1.5">{m.name}</td><td className="text-right font-semibold">{m.quantity}</td><td className="text-right">{money(m.amount)}</td></tr>)}</tbody></table></div>)}</Card>
      </>)}
      <Card title="Who received which medicines">{loading && !d ? <p className="py-6 text-center text-sm text-slate-400">Loading records...</p> : <DataTable columns={cols} rows={rows} pageSize={10} empty="No dispensing records for this period" />}</Card>
    </div>
  );
}
