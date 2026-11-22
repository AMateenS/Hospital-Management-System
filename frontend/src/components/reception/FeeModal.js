'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button, Field, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';

const money = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
// row: { _id (visit id), patient, patientId, doctor, fee: { amount, discount, status } }
export default function FeeModal({ row, onClose, onDone }) {
  const toast = useToast(); const router = useRouter();
  const [mode, setMode] = useState('pay'); const [method, setMethod] = useState('Cash'); const [discount, setDiscount] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [paid, setPaid] = useState(null);
  if (!row) return null;
  const amount = row.fee?.amount || 0; const d = Math.min(Math.max(Number(discount) || 0, 0), amount); const net = Math.max(0, amount - d);
  async function submit() {
    if (busy) return; setBusy(true);
    try {
      const out = await api(`/visits/${row._id}/fee`, { method: 'PATCH', body: mode === 'pay' ? { action: 'pay', method, discount: d, note } : { action: 'waive', note } });
      toast.success(mode === 'pay' ? `Fee received: ${money(net)} (${method}). Receipt ${out.fee.receiptNo || ''}` : 'Fee waived'); setPaid(out); onDone?.(out);
    } catch (e) { toast.error(e.errors?.[0]?.message || e.message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Consultation fee - ${row.patient} (${row.patientId})`}>
      {paid ? (
        <div className="space-y-4"><p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{paid.fee.status === 'Paid' ? `Payment recorded. Receipt no. ${paid.fee.receiptNo}.` : 'Fee waived.'}</p>
          <div className="flex justify-end gap-2">{paid.fee.status === 'Paid' && <Button onClick={() => router.push(`/reception/fee-receipt/${row._id}`)}>Print fee receipt</Button>}<Button variant="outline" onClick={onClose}>Close</Button></div></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><p><span className="text-slate-500">Doctor:</span> <b>{row.doctor}</b></p><p><span className="text-slate-500">Fee:</span> <b>{money(amount)}</b></p></div>
          <div className="flex gap-2 text-sm">{[['pay', 'Receive payment'], ['waive', 'Waive fee']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full border px-4 py-1.5 ${mode === k ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-300 text-slate-600'}`}>{l}</button>)}</div>
          {mode === 'pay' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payment method"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{['Cash', 'Card', 'Online'].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Discount (optional)"><input type="number" min="0" max={amount} className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
              <p className="text-lg font-bold sm:col-span-2">Amount to receive: {money(net)}</p>
              <div className="sm:col-span-2"><Field label="Note (optional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
            </div>) : <Field label="Reason for waiving the fee" required><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. staff family, charity case" /></Field>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button loading={busy} disabled={mode === 'waive' && note.trim().length < 3} onClick={submit}>{mode === 'pay' ? `Receive ${money(net)}` : 'Waive fee'}</Button></div>
        </div>)}
    </Modal>
  );
}
