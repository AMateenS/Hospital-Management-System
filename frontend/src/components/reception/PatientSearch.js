'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Modal } from '@/components/ui';

// Search by Patient ID, phone or name. onNewVisit(patient) opens a follow-up visit.
export default function PatientSearch({ open, onClose, onNewVisit }) {
  const [q, setQ] = useState(''); const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  async function go(e) { e.preventDefault(); setErr(''); try { setRows(await api('/patients', { query: { q } })); } catch (x) { setErr(x.message); } }
  return (
    <Modal open={open} onClose={onClose} wide title="Search existing patient">
      <form onSubmit={go} className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input autoFocus className="input pl-9" placeholder="Patient ID, phone number or name" value={q} onChange={(e) => setQ(e.target.value)} /></div><Button type="submit">Search</Button></form>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {rows && (rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No matching patient. Register as a new patient instead.</p> : (
        <ul className="mt-4 divide-y divide-slate-100">{rows.map((p) => (
          <li key={p._id} className="flex items-center justify-between gap-3 py-3">
            <div><p className="font-medium">{p.name} <Badge tone="bg-slate-100 text-slate-600">{p.patientId}</Badge></p><p className="text-xs text-slate-500">{p.age ?? '-'} yrs · {p.gender} · {p.phone}</p></div>
            <Button variant="outline" onClick={() => { onClose(); onNewVisit(p); }}>New visit</Button>
          </li>))}</ul>))}
    </Modal>
  );
}
