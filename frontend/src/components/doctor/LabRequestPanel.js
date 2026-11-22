'use client';
import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Field } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { LAB_CATALOG, PRIORITIES } from '@/lib/labTests';

const ALL_TESTS = Object.values(LAB_CATALOG).flat();
const categoryOf = (name) => Object.entries(LAB_CATALOG).find(([, list]) => list.includes(name))?.[0] || 'Other';

// Doctor's lab order form + the orders already placed for this visit (live status and results).
// Type a test name and press Enter (or quick-pick from the categories), choose priority, submit: it goes to the laboratory.
export default function LabRequestPanel({ visitId, labs, onChanged, patient, visitNo, doctorName }) {
  const toast = useToast();
  const cats = Object.keys(LAB_CATALOG).filter((c) => LAB_CATALOG[c].length);
  const [cat, setCat] = useState(cats[0]);
  const [sel, setSel] = useState([]);                       // [{ name, category }]
  const [text, setText] = useState('');
  const [indication, setIndication] = useState(''); const [priority, setPriority] = useState('Routine'); const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [orderedAt] = useState(() => new Date());
  const has = (n) => sel.some((t) => t.name.toLowerCase() === n.toLowerCase());
  const toggle = (name, category) => setSel((p) => (has(name) ? p.filter((t) => t.name.toLowerCase() !== name.toLowerCase()) : [...p, { name, category: category || categoryOf(name) }]));
  const addText = () => { const n = text.trim(); if (n && !has(n)) setSel((p) => [...p, { name: n, category: categoryOf(n) }]); setText(''); };

  async function submit() {
    if (busy) return; setErr('');
    const tests = text.trim() && !has(text.trim()) ? [...sel, { name: text.trim(), category: categoryOf(text.trim()) }] : sel;
    if (!tests.length) return setErr('Type or select at least one test');
    if (indication.trim().length < 3) return setErr('Enter the clinical indication');
    setBusy(true);
    try {
      const r = await api(`/doctor/visits/${visitId}/lab-requests`, { method: 'POST', body: { tests, indication, priority, instructions } });
      toast.success(`Lab order ${r.requestNo} sent to the laboratory${r.skipped ? ` (${r.skipped} test(s) already ordered were skipped)` : ''}`);
      setSel([]); setText(''); setIndication(''); setInstructions(''); setPriority('Routine'); onChanged();
    } catch (e) { const m = e.errors?.[0]?.message || e.message; setErr(m); toast.error(m); } finally { setBusy(false); }
  }
  async function cancel(l) {
    if (!confirm(`Cancel lab order ${l.requestNo}?`)) return;
    try { await api(`/doctor/visits/${visitId}/lab-requests/${l._id}/cancel`, { method: 'POST', body: {} }); toast.success(`${l.requestNo} cancelled`); onChanged(); } catch (e) { toast.error(e.message); }
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <p><span className="text-slate-500">Patient:</span> <b>{patient?.name}</b> ({patient?.patientId})</p><p><span className="text-slate-500">Visit ID:</span> <b>{visitNo}</b></p>
        <p><span className="text-slate-500">Doctor:</span> <b>{doctorName}</b></p><p><span className="text-slate-500">Order date/time:</span> <b>{orderedAt.toLocaleString()}</b></p>
      </div>

      <Field label="Tests to recommend (type a test name and press Enter)">
        <div className="flex gap-2">
          <input className="input" list="lab-test-names" placeholder="e.g. CBC, HbA1c, Chest X-ray ..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } }} />
          <Button type="button" variant="outline" onClick={addText}>Add</Button>
        </div>
        <datalist id="lab-test-names">{ALL_TESTS.map((t) => <option key={t} value={t} />)}</datalist>
      </Field>
      <div>
        <p className="label">Quick pick by category</p>
        <div className="flex flex-wrap gap-2">{cats.map((c) => <button type="button" key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-sm ${cat === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'}`}>{c}</button>)}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{LAB_CATALOG[cat].map((t) => (
          <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${has(t) ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}><input type="checkbox" checked={has(t)} onChange={() => toggle(t, cat)} />{t}</label>))}</div>
      </div>
      <div><p className="label">Tests recommended ({sel.length})</p>
        {sel.length === 0 ? <p className="text-sm text-slate-400">No test added yet.</p> : <div className="flex flex-wrap gap-2">{sel.map((t) => <span key={t.name} className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1 text-xs text-white">{t.name}<button type="button" aria-label={`Remove ${t.name}`} onClick={() => toggle(t.name)}><X className="h-3 w-3" /></button></span>)}</div>}</div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2"><Field label="Clinical indication" required><textarea rows="2" className="input" placeholder="Why is this test needed? e.g. persistent fever for 5 days" value={indication} onChange={(e) => setIndication(e.target.value)} /></Field></div>
        <Field label="Priority"><select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div className="sm:col-span-3"><Field label="Additional instructions"><input className="input" placeholder="e.g. fasting sample, collect before antibiotics" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field></div>
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <Button type="button" variant="blue" loading={busy} onClick={submit}>Send to laboratory</Button>

      <div className="space-y-3 border-t pt-4"><h4 className="font-semibold">Lab orders for this visit</h4>
        {labs.length === 0 && <p className="text-sm text-slate-400">No lab orders yet.</p>}
        {labs.map((l) => (
          <div key={l._id} className="rounded-lg border border-slate-100 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{l.requestNo} <span className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</span></span>
              <span className="flex items-center gap-2"><Badge>{l.priority || 'Routine'}</Badge><Badge>{l.status}</Badge>
                {l.status === 'Pending' && <button className="text-xs text-red-600 underline" onClick={() => cancel(l)}>Cancel</button>}
                {l.status === 'Completed' && <Link className="text-xs text-teal-600 underline" href={`/doctor/lab/${l._id}`}>Report</Link>}</span></div>
            {l.indication && <p className="mt-1 text-xs text-slate-500">Indication: {l.indication}{l.instructions ? ` · ${l.instructions}` : ''}</p>}
            {l.status === 'Cancelled' && l.cancelReason && <p className="mt-1 text-xs text-red-600">Cancelled: {l.cancelReason}</p>}
            <ul className="mt-2 space-y-1">{l.tests.map((t) => (<li key={t._id || t.name} className="flex justify-between gap-3"><span>{t.name}</span>
              <span className={t.flag && t.flag !== 'Normal' ? 'font-semibold text-red-600' : 'text-slate-600'}>{t.result ? `${t.result} ${t.unit || ''} ${t.referenceRange ? `(ref ${t.referenceRange})` : ''}` : l.status === 'Cancelled' ? '-' : 'awaiting result'}</span></li>))}</ul>
          </div>))}
      </div>
    </div>
  );
}
