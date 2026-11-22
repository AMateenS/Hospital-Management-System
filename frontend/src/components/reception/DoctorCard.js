'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui';
import { Stethoscope } from 'lucide-react';

const STATUSES = ['Waiting', 'In Consultation', 'Completed', 'Referred', 'Cancelled'];

export default function DoctorCard({ doc, onChanged, onCollect }) {
  const [err, setErr] = useState('');
  async function setStatus(visitId, status) {
    setErr('');
    try { await api(`/visits/${visitId}/status`, { method: 'PATCH', body: { status } }); onChanged(); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><Stethoscope className="h-6 w-6" /></div>
        <div className="flex-1"><h3 className="font-semibold">{doc.name}</h3><p className="text-sm text-slate-500">{doc.specialization}</p></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${doc.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${doc.available ? 'bg-emerald-500' : 'bg-slate-400'}`} />{doc.available ? 'Available' : 'Not available'}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-bold">{doc.total}</p><p className="text-xs text-slate-500">Total</p></div>
        <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-bold text-amber-700">{doc.waiting}</p><p className="text-xs text-slate-500">Waiting</p></div>
        <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-bold text-emerald-700">{doc.completed}</p><p className="text-xs text-slate-500">Completed</p></div>
      </div>
      {err && <p role="alert" className="mt-3 text-xs text-red-600">{err}</p>}
      <ul className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto">
        {doc.patients.length === 0 && <li className="py-4 text-center text-sm text-slate-400">No patients today</li>}
        {doc.patients.map((p) => (
          <li key={p.visitId} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate text-xs text-slate-500">{p.patientId} · {p.complaint}</p></div>
            {p.fee && (p.fee.status === 'Unpaid' && onCollect
              ? <button type="button" onClick={() => onCollect({ _id: p.visitId, patient: p.name, patientId: p.patientId, doctor: doc.name, fee: p.fee })} className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200">Collect fee</button>
              : <span className={`rounded-md px-2 py-1 text-xs font-medium ${p.fee.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{p.fee.status === 'Paid' ? 'Fee paid' : p.fee.status === 'Waived' ? 'Fee waived' : 'Unpaid'}</span>)}
            <select aria-label={`Status for ${p.name}`} value={p.status} onChange={(e) => setStatus(p.visitId, e.target.value)} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
