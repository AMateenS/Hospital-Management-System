'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, Field, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import PrescriptionSheet from '@/components/PrescriptionSheet';

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '-');
const fmtT = (d) => (d ? new Date(d).toLocaleString() : '-');
const ACTIONS = [['dispense', 'Dispense now'], ['available', 'Mark available (dispense later)'], ['unavailable', 'Mark unavailable'], ['skip', 'Decide later']];

export default function PrescriptionsTab({ onChanged }) {
  const router = useRouter(); const toast = useToast(); const { user } = useAuth();
  const can = (p) => user?.role === 'admin' || !user?.permissions || user.permissions.includes(p);
  const [rows, setRows] = useState(null); const [status, setStatus] = useState(''); const [err, setErr] = useState('');
  const [rx, setRx] = useState(null); const [plan, setPlan] = useState({}); const [busy, setBusy] = useState(false); const [opening, setOpening] = useState('');
  const [retOpen, setRetOpen] = useState(false); const [reason, setReason] = useState('');
  const [payMethod, setPayMethod] = useState('Cash'); const [payDiscount, setPayDiscount] = useState(''); const [sheet, setSheet] = useState(null); const [sheetBusy, setSheetBusy] = useState(false);

  const load = useCallback(() => api('/pharmacy/prescriptions', { query: { status } }).then((r) => { setRows(r); setErr(''); }).catch((e) => setErr(e.message)), [status]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const initPlan = (d) => setPlan(Object.fromEntries(d.items.filter((it) => it.remaining > 0).map((it) => {
    const c = it.candidates.find((m) => !m.expired && m.quantity > 0);
    return [it._id, { action: c ? 'dispense' : 'skip', medicineId: c?._id || '', quantity: c ? Math.min(it.remaining, c.quantity) : it.remaining }];
  })));
  async function open(r) { setOpening(r._id); try { const d = await api(`/pharmacy/prescriptions/${r._id}`); setRx(d); initPlan(d); } catch (e) { toast.error(e.message); } finally { setOpening(''); } }
  const refresh = async () => { const d = await api(`/pharmacy/prescriptions/${rx._id}`); setRx(d); initPlan(d); load(); onChanged(); };
  const setP = (id, patch) => setPlan((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  async function submit() {
    if (busy) return;
    const lines = [];
    for (const it of rx.items.filter((i) => i.remaining > 0)) {
      const p = plan[it._id]; if (!p || p.action === 'skip') continue;
      if (p.action === 'dispense') {
        const q = Number(p.quantity);
        if (!p.medicineId) return toast.error(`Choose the stock item for ${it.name}`);
        if (!Number.isInteger(q) || q < 1 || q > it.remaining) return toast.error(`${it.name}: quantity must be between 1 and ${it.remaining}`);
        lines.push({ itemId: it._id, action: 'dispense', medicineId: p.medicineId, quantity: q });
      } else lines.push({ itemId: it._id, action: p.action });
    }
    if (!lines.length) return toast.error('Choose what to do with at least one medicine');
    setBusy(true);
    try {
      const out = await api(`/pharmacy/prescriptions/${rx._id}/dispense`, { method: 'POST', body: { lines, payment: { method: payMethod, discount: Number(payDiscount) || 0 } } });
      toast.success(out.record ? `Saved. Bill ${out.record.billNo}: ${out.record.total.toFixed(2)} (${out.record.paid ? 'paid' : 'pay later'}). Status: ${out.prescription.status}` : `Saved. Status: ${out.prescription.status}`);
      await refresh();
    } catch (e) { toast.error(e.errors?.[0]?.message || e.message); } finally { setBusy(false); }
  }
  async function doReturn() {
    setBusy(true);
    try { await api(`/pharmacy/prescriptions/${rx._id}/return`, { method: 'POST', body: { reason } }); toast.success('Returned to the doctor for correction'); setRetOpen(false); setReason(''); setRx(null); load(); onChanged(); }
    catch (e) { toast.error(e.errors?.[0]?.message || e.message); } finally { setBusy(false); }
  }

  const data = (rows || []).map((r) => ({ ...r, pid: r.patient?.patientId, pname: r.patient?.name, dname: r.doctor?.user?.name, vno: r.visit?.visitNo, when: r.issuedAt || r.createdAt }));
  const cols = [
    { key: 'rxNo', header: 'Prescription no.' }, { key: 'pname', header: 'Patient' }, { key: 'pid', header: 'Patient ID' }, { key: 'dname', header: 'Doctor' },
    { key: 'when', header: 'Date', render: (r) => fmt(r.when) }, { key: 'vno', header: 'Visit ID' }, { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'a', header: '', render: (r) => <Button variant={['Pending', 'Partially Dispensed'].includes(r.status) ? 'primary' : 'outline'} loading={opening === r._id} onClick={() => open(r)}>View Details</Button> },
  ];
  const dispensable = rx && ['Pending', 'Partially Dispensed'].includes(rx.status);
  const preview = rx && dispensable ? rx.items.reduce((sum, it) => { const p = plan[it._id]; if (!p || p.action !== 'dispense') return sum; const m = it.candidates.find((c) => c._id === p.medicineId); return sum + (m ? (Number(p.quantity) || 0) * (m.sellingPrice || 0) : 0); }, 0) : 0;
  const disc = Math.min(Math.max(Number(payDiscount) || 0, 0), preview);
  async function showSheet() { if (sheet) return setSheet(null); setSheetBusy(true); try { setSheet(await api(`/prescriptions/sheet/${rx.visit._id}`)); } catch (e) { toast.error(e.message); } finally { setSheetBusy(false); } }
  async function payBill(id, method) { try { await api(`/pharmacy/dispensing/${id}/pay`, { method: 'PATCH', body: { method } }); toast.success(`Bill marked paid (${method})`); await refresh(); } catch (e) { toast.error(e.message); } }
  return (
    <Card>
      {err && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {rows === null ? <p className="py-8 text-center text-sm text-slate-400">Loading prescriptions...</p> : (
        <DataTable columns={cols} rows={data} searchKeys={['rxNo', 'pid', 'pname', 'dname', 'vno']} empty="No prescriptions have been sent to the pharmacy yet"
          filters={<select className="input w-52" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Partially Dispensed', 'Dispensed', 'Returned'].map((s) => <option key={s}>{s}</option>)}</select>} />)}

      <Modal open={!!rx} onClose={() => setRx(null)} wide title={rx ? `${rx.rxNo} - ${rx.patient?.name}` : ''}>
        {rx && (<div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><Badge>{rx.status}</Badge><p className="text-xs text-slate-500">Sent {fmtT(rx.issuedAt || rx.createdAt)}</p></div>
          {rx.status === 'Returned' && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Returned to the doctor: {rx.returnReason}</p>}
          <div className="grid gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="label">Patient</p><b>{rx.patient?.name}</b><br />{rx.patient?.patientId}</div>
            <div><p className="label">Age / Gender</p>{rx.patient?.age ?? '-'} / {rx.patient?.gender}<br />{rx.patient?.phone}</div>
            <div><p className="label">Doctor</p><b>{rx.doctor?.user?.name}</b><br />{rx.doctor?.specialization}</div>
            <div><p className="label">Visit</p>{rx.visit?.visitNo}<br />{fmt(rx.visit?.registeredAt)}</div>
          </div>
          <div><p className="label">Diagnosis (written by the doctor)</p><p className="text-sm">{rx.diagnosis || '-'}</p></div>
          {rx.details?.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{rx.details.filter((d) => d.label !== 'Diagnosis').map((d, i) => <div key={i}><p className="label">{d.label}</p><p className="whitespace-pre-wrap text-sm">{d.value}</p></div>)}</div>}
          <p className="text-xs text-slate-400">The diagnosis and medicines above are exactly what the doctor wrote and cannot be changed here. If something is wrong, return the prescription to the doctor.</p>

          <div><h4 className="mb-2 font-semibold">Medicines</h4><div className="space-y-3">{rx.items.map((it) => {
            const p = plan[it._id];
            return (
              <div key={it._id} className="rounded-lg border border-slate-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{it.name} {it.strength}</p>
                  <p className="text-xs text-slate-500">Prescribed {it.prescribedQty} · given {it.dispensedQty || 0} · remaining {it.remaining}{it.availability === 'Unavailable' ? ' · UNAVAILABLE' : ''}</p></div>
                <p className="text-xs text-slate-500">{it.dosage} · {it.frequency} · {it.duration}{it.instructions ? ` · ${it.instructions}` : ''}</p>
                {dispensable && it.remaining > 0 && p && can('dispense') && (
                  <div className="mt-2 grid gap-2 lg:grid-cols-[190px_1fr_90px]">
                    <select aria-label={`Action for ${it.name}`} className="input" value={p.action} onChange={(e) => setP(it._id, { action: e.target.value })}>{ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    {p.action === 'dispense' ? (<>
                      <select aria-label={`Stock for ${it.name}`} className="input" value={p.medicineId} onChange={(e) => setP(it._id, { medicineId: e.target.value })}>
                        <option value="">Select stock item</option>
                        {it.candidates.map((m) => <option key={m._id} value={m._id} disabled={m.expired || m.quantity < 1}>{m.name} {m.strength} - stock {m.quantity}, batch {m.batchNo || '-'}, exp {fmt(m.expiryDate)}, {m.sellingPrice}{m.expired ? ' (EXPIRED)' : ''}</option>)}</select>
                      <input type="number" min="1" max={it.remaining} aria-label={`Quantity for ${it.name}`} className="input" value={p.quantity} onChange={(e) => setP(it._id, { quantity: e.target.value })} /></>) : <p className="self-center text-xs text-slate-400 lg:col-span-2">{p.action === 'unavailable' ? 'This medicine will be closed as unavailable.' : p.action === 'available' ? 'Marked as in stock; nothing deducted yet.' : 'No change for now.'}</p>}
                    {p.action === 'dispense' && it.candidates.length === 0 && <p className="text-xs text-amber-600 lg:col-span-3">No matching medicine in inventory. Mark it unavailable.</p>}
                  </div>)}
              </div>);
          })}</div></div>

          {rx.records?.length > 0 && <div><h4 className="mb-2 font-semibold">Dispensing history</h4><ul className="space-y-2 text-sm">{rx.records.map((r) => (
            <li key={r._id} className="rounded-lg border border-slate-100 p-3"><p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">{fmtT(r.dispensedAt)} · {r.pharmacist?.name} · {r.billNo || 'no bill no.'}{r.discount > 0 && ` · discount ${r.discount.toFixed(2)}`} <Badge>{r.paid === false ? 'Unpaid' : 'Paid'}</Badge>{r.paid === false && can('dispense') && <span className="flex items-center gap-1">Mark paid: {['Cash', 'Card', 'Online'].map((m) => <button key={m} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50" onClick={() => payBill(r._id, m)}>{m}</button>)}</span>}</p>
              <ul className="mt-1">{r.lines.map((l, i) => <li key={i} className="flex justify-between"><span>{l.name} {l.strength} x{l.quantity} <span className="text-xs text-slate-400">batch {l.batchNo || '-'}</span></span><span>{l.lineTotal?.toFixed(2)}</span></li>)}</ul>
              <p className="mt-1 text-right font-semibold">{r.total?.toFixed(2)}</p></li>))}</ul>
            <p className="mt-2 text-right font-bold">Total billed: {(rx.totalAmount || 0).toFixed(2)}</p></div>}

          {dispensable && can('dispense') && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"><h4 className="mb-2 font-semibold">Bill for this handover</h4>
              <div className="grid gap-3 sm:grid-cols-3"><Field label="Payment"><select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option>Cash</option><option>Card</option><option>Online</option><option value="Unpaid">Pay later (credit)</option></select></Field>
                <Field label="Discount (optional)"><input type="number" min="0" className="input" value={payDiscount} onChange={(e) => setPayDiscount(e.target.value)} /></Field>
                <div className="self-end text-right"><p className="text-xs text-slate-500">Subtotal {preview.toFixed(2)}{disc > 0 && ` - discount ${disc.toFixed(2)}`}</p><p className="text-lg font-bold">Payable: {(preview - disc).toFixed(2)}</p></div></div></div>)}
          {sheet && <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-3"><PrescriptionSheet s={sheet} /></div>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" loading={sheetBusy} onClick={showSheet}>{sheet ? 'Hide doctor\'s template view' : 'Show prescription on doctor\'s template'}</Button>
            <Button variant="outline" onClick={() => router.push(`/pharmacy/print/${rx.visit?._id}`)}>Print prescription</Button>
            {rx.records?.length > 0 && can('receipts') && <Button variant="outline" onClick={() => router.push(`/pharmacy/receipt/${rx._id}`)}>Print bill</Button>}
            {rx.status === 'Pending' && can('return_to_doctor') && <Button variant="danger" onClick={() => setRetOpen(true)}>Return to doctor</Button>}
            {dispensable && can('dispense') && <Button loading={busy} onClick={submit}>Save dispensing</Button>}
          </div>
        </div>)}
      </Modal>
      <Modal open={retOpen} onClose={() => setRetOpen(false)} title="Return to doctor">
        <div className="space-y-4"><p className="text-sm text-slate-600">The doctor will see this prescription as Returned, with your note, and must correct and send it again.</p>
          <Field label="What needs to be corrected?" required><textarea rows="3" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dosage of Augmentin unclear / drug interaction with current medication" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRetOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={doReturn}>Return prescription</Button></div></div>
      </Modal>
    </Card>
  );
}
