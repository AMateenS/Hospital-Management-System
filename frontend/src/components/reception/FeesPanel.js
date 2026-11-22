'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import FeeModal from './FeeModal';

const iso = (d) => d.toISOString().slice(0, 10);
const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

// Reception: is the consultation fee of each patient paid? Collect, waive, print the receipt.
export default function FeesPanel({ refreshKey, onChanged }) {
  const router = useRouter(); const { user } = useAuth(); const toast = useToast();
  const [from, setFrom] = useState(iso(new Date())); const [to, setTo] = useState(iso(new Date())); const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [applied, setApplied] = useState('');
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [row, setRow] = useState(null);
  const load = useCallback(() => api('/visits/fees', { query: { from, to, status, q: applied } }).then((r) => { setD(r); setErr(''); }).catch((e) => setErr(e.message)), [from, to, status, applied]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const reset = async (r) => { const reason = prompt(`Reverse the ${r.fee.status} fee of ${r.patient}? Enter the reason:`); if (!reason) return;
    try { await api(`/visits/${r._id}/fee`, { method: 'PATCH', body: { action: 'reset', note: reason } }); toast.success('Fee reversed to Unpaid'); load(); onChanged?.(); } catch (e) { toast.error(e.errors?.[0]?.message || e.message); } };

  const cols = [
    { key: 'patient', header: 'Patient', render: (r) => <div><p className="font-medium">{r.patient}</p><p className="text-xs text-slate-500">{r.patientId} · {r.phone}</p></div> },
    { key: 'doctor', header: 'Doctor' }, { key: 'visitNo', header: 'Visit' },
    { key: 'amt', header: 'Fee', render: (r) => <div><b>{money(r.fee.net)}</b>{r.fee.discount > 0 && <p className="text-xs text-slate-400">of {money(r.fee.amount)}, discount {money(r.fee.discount)}</p>}</div> },
    { key: 'st', header: 'Fee status', render: (r) => <Badge>{r.fee.status}</Badge> },
    { key: 'det', header: 'Payment', render: (r) => (r.fee.status === 'Paid' ? <div className="text-xs"><p>{r.fee.method} · {r.fee.receiptNo}</p><p className="text-slate-400">{new Date(r.fee.paidAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} · {r.fee.receivedBy}</p></div> : r.fee.status === 'Waived' ? <span className="text-xs text-slate-500">{r.fee.note}</span> : <span className="text-xs text-amber-600">Not paid</span>) },
    { key: 'a', header: '', render: (r) => (
      <div className="flex flex-wrap gap-1">{r.fee.status === 'Unpaid' && r.visitStatus !== 'Cancelled' && <Button onClick={() => setRow({ ...r, fee: r.fee })}>Collect fee</Button>}
        {r.fee.status === 'Paid' && <Button variant="outline" onClick={() => router.push(`/reception/fee-receipt/${r._id}`)}>Receipt</Button>}
        {user?.role === 'admin' && r.fee.status !== 'Unpaid' && <Button variant="ghost" onClick={() => reset(r)}>Reverse</Button>}</div>) },
  ];
  const s = d?.summary;
  return (
    <Card title="Consultation fees">
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
        <label><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label><span className="label">Fee status</span><select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>Unpaid</option><option>Paid</option><option>Waived</option></select></label>
        <label className="min-w-[200px] flex-1"><span className="label">Search patient, ID, phone, receipt</span><input className="input" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {err && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {s && <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm"><span>Unpaid: <b className="text-amber-700">{s.unpaidCount}</b> ({money(s.unpaidAmount)})</span><span>Paid: <b className="text-emerald-700">{s.paidCount}</b> (collected {money(s.collected)})</span><span>Waived: <b>{s.waivedCount}</b></span></div>}
      <DataTable columns={cols} rows={d?.rows || []} pageSize={8} empty="No visits for this period" />
      {row && <FeeModal row={row} onClose={() => setRow(null)} onDone={() => { load(); onChanged?.(); }} />}
    </Card>
  );
}
