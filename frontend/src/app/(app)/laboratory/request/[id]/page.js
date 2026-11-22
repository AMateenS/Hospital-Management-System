'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Field, Modal } from '@/components/ui';
import { expand, defaults, PANELS } from '@/lib/labCatalog';

const STEPS = ['Pending', 'Accepted', 'Sample Collected', 'Processing', 'Completed'];
const NEXT = { Pending: ['Accepted', 'Accept request'], Accepted: ['Sample Collected', 'Mark sample collected'] };

export default function LabRequest() {
  const { id } = useParams(); const router = useRouter();
  const [r, setR] = useState(null); const [tests, setTests] = useState([]); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(''); const [cancelOpen, setCancelOpen] = useState(false); const [cancelReason, setCancelReason] = useState('');
  const hydrate = (x) => setTests(x.tests.map((t) => ({ _id: t._id, name: t.name, result: t.result || '', unit: t.unit || '', referenceRange: t.referenceRange || '', flag: t.flag || '', done: !!t.done, ...(!t.unit && !t.referenceRange ? defaults(t.name) : {}) })));
  const load = useCallback(() => api(`/lab/requests/${id}`).then((x) => { setR(x); hydrate(x); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  if (err && !r) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!r) return <p className="text-slate-500">Loading...</p>;

  const done = r.status === 'Completed'; const cancelled = r.status === 'Cancelled'; const canEnter = ['Sample Collected', 'Processing'].includes(r.status);
  const upd = (i, k, v) => setTests(tests.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  async function run(kind, fn, ok) { setErr(''); setMsg(''); setBusy(kind); try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setErr(e.errors?.[0]?.message || e.message); } finally { setBusy(''); } }
  const step = (to) => run('step', () => api(`/lab/requests/${id}/status`, { method: 'PATCH', body: { status: to } }));
  const save = () => run('save', () => api(`/lab/requests/${id}/results`, { method: 'PUT', body: { tests } }), 'Results saved');
  const complete = () => run('complete', async () => { await api(`/lab/requests/${id}/results`, { method: 'PUT', body: { tests } }); await api(`/lab/requests/${id}/complete`, { method: 'POST' }); }, 'Completed. Results are now in the doctor\'s dashboard.');
  const doCancel = () => run('cancel', async () => { await api(`/lab/requests/${id}/cancel`, { method: 'POST', body: { reason: cancelReason } }); setCancelOpen(false); setCancelReason(''); }, 'Order cancelled');
  const upload = (e) => { const file = e.target.files[0]; if (!file) return; const fd = new FormData(); fd.append('file', file);
    run('upload', async () => { const res = await fetch(`/api/lab/requests/${id}/report`, { method: 'POST', body: fd, credentials: 'include' }); if (!res.ok) throw new Error((await res.json()).message); }, 'Report file uploaded'); e.target.value = ''; };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><button onClick={() => router.push('/laboratory')} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back</button>
          <h1 className="text-2xl font-bold">{r.requestNo} <span className="text-base font-normal text-slate-400">{r.patient?.name} · {r.patient?.patientId}</span></h1>
          <p className="text-sm text-slate-500">Referred by {r.doctor?.user?.name} · {r.patient?.age ?? '-'} yrs · {r.patient?.gender}</p></div>
        <div className="flex items-center gap-2"><Badge>{r.priority || 'Routine'}</Badge><Badge>{r.status}</Badge></div>
      </div>
      <Card title="Order details"><div className="grid gap-3 text-sm sm:grid-cols-3"><p><span className="label">Referring doctor</span>{r.doctor?.user?.name}</p><p><span className="label">Visit</span>{r.visit?.visitNo || '-'}</p><p><span className="label">Complaint / diagnosis</span>{r.visit?.consultation?.diagnosis || r.visit?.chiefComplaint || '-'}</p><p><span className="label">Ordered</span>{new Date(r.createdAt).toLocaleString()}</p><p><span className="label">Clinical indication</span>{r.indication || '-'}</p><p><span className="label">Instructions</span>{r.instructions || '-'}</p></div>
        {cancelled && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Cancelled{r.cancelReason ? `: ${r.cancelReason}` : ''}</p>}</Card>
      {!cancelled && <ol className="flex flex-wrap gap-2 text-xs">{STEPS.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${i <= STEPS.indexOf(r.status) ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}. {s}</li>)}</ol>}
      {msg && <div role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}
      {err && <div role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {NEXT[r.status] && <Card><div className="flex items-center justify-between"><p className="text-sm text-slate-600">{r.status === 'Pending' ? 'Review the requested tests and accept the request.' : 'Collect the sample from the patient, then mark it as collected.'}</p>
        <Button loading={busy === 'step'} onClick={() => step(NEXT[r.status][0])}>{NEXT[r.status][1]}</Button></div></Card>}

      {canEnter && <p className="rounded-lg bg-teal-50 px-4 py-2 text-sm text-teal-800">Tick <b>Done</b> for each test you have finished. A test needs a typed result, or a tick plus an uploaded report file. Then press <b>Confirm complete</b> to send everything to the doctor.</p>}
      <Card title="Test results">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-2">Test</th><th className="pb-2">Result</th><th className="pb-2">Unit</th><th className="pb-2">Reference range</th><th className="pb-2">Flag</th><th className="pb-2 text-center">Done</th><th /></tr></thead>
          <tbody>{tests.map((t, i) => (<tr key={t._id || i} className="align-top">
            <td className="py-1 pr-2"><input disabled={!canEnter} className="input" value={t.name} onChange={(e) => upd(i, 'name', e.target.value)} /></td>
            <td className="py-1 pr-2"><input disabled={!canEnter} className="input" value={t.result} onChange={(e) => upd(i, 'result', e.target.value)} /></td>
            <td className="py-1 pr-2"><input disabled={!canEnter} className="input w-24" value={t.unit} onChange={(e) => upd(i, 'unit', e.target.value)} /></td>
            <td className="py-1 pr-2"><input disabled={!canEnter} className="input w-28" placeholder="e.g. 70-110" value={t.referenceRange} onChange={(e) => upd(i, 'referenceRange', e.target.value)} /></td>
            <td className="py-1 pr-2"><select disabled={!canEnter} className="input w-28" value={t.flag} onChange={(e) => upd(i, 'flag', e.target.value)}><option value="">Auto</option>{['Normal', 'High', 'Low', 'Critical'].map((f) => <option key={f}>{f}</option>)}</select></td>
            <td className="py-1 pr-2 text-center"><input type="checkbox" className="h-5 w-5 accent-teal-600" aria-label={`${t.name} completed`} disabled={!canEnter} checked={!!t.done} onChange={(e) => upd(i, 'done', e.target.checked)} /></td>
            <td className="py-1">{canEnter && <button aria-label="Remove row" onClick={() => setTests(tests.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500" /></button>}</td></tr>))}</tbody></table></div>
        {canEnter && (<div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <button className="inline-flex items-center gap-1 font-medium text-teal-600" onClick={() => setTests([...tests, { name: '', result: '', unit: '', referenceRange: '', flag: '', done: false }])}><Plus className="h-4 w-4" />Add row</button>
          <button className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setTests(tests.map((t) => ({ ...t, done: true })))}>Tick all as done</button>
          {tests.some((t) => PANELS[t.name]) && <span className="text-slate-400">|</span>}
          {tests.map((t, i) => PANELS[t.name] && !t.result ? <button key={i} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setTests([...tests.slice(0, i), ...expand(t.name), ...tests.slice(i + 1)])}>Expand {t.name} into components</button> : null)}
        </div>)}
      </Card>

      <Card title="Report file (optional)">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {r.reportFile ? <a className="text-teal-600 underline" href={`/api/lab/requests/${id}/report`} target="_blank" rel="noreferrer">View uploaded file</a> : <span className="text-slate-400">No file uploaded</span>}
          {!done && <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"><Upload className="h-4 w-4" />{busy === 'upload' ? 'Uploading...' : 'Upload PDF / image'}<input type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={upload} /></label>}
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-3 border-t bg-white/95 p-4 backdrop-blur sm:-mx-6">
        {!done && !cancelled && <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel order</Button>}
        {(done || canEnter) && <Button variant="outline" onClick={() => router.push(`/laboratory/report/${id}`)}>Print / PDF report</Button>}
        {canEnter && <Button variant="outline" loading={busy === 'save'} onClick={save}>Save results</Button>}
        {canEnter && <Button loading={busy === 'complete'} onClick={complete}>Confirm complete &amp; send to doctor</Button>}
      </div>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${r.requestNo}`}>
        <div className="space-y-4"><p className="text-sm text-slate-600">The doctor will see this order as Cancelled with your reason.</p>
          <Field label="Reason" required><input className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. sample could not be collected" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCancelOpen(false)}>Keep order</Button><Button variant="danger" loading={busy === 'cancel'} disabled={cancelReason.trim().length < 3} onClick={doCancel}>Cancel order</Button></div></div>
      </Modal>
    </div>
  );
}
