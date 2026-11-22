'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';

const money = (n) => Number(n || 0).toFixed(2);
function Sheet({ r, innerRef }) {
  const c = '#0f766e';
  return (
    <div ref={innerRef} className="print-sheet mx-auto w-full max-w-[600px] bg-white p-8 text-slate-900 shadow-card">
      <header className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: c }}>
        <div className="grid h-14 w-14 place-items-center rounded-xl text-2xl font-bold text-white" style={{ background: c }}>+</div>
        <div className="flex-1"><h1 className="text-xl font-bold" style={{ color: c }}>{r.hospital.name}</h1><p className="text-xs text-slate-500">{[r.hospital.address, r.hospital.phone && `Tel: ${r.hospital.phone}`].filter(Boolean).join(' · ')}</p></div>
        <div className="text-right"><p className="text-lg font-semibold">Fee Receipt</p><p className="text-xs text-slate-500">{r.receiptNo}</p></div>
      </header>
      <section className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <p><span className="text-slate-500">Patient</span><br /><b>{r.patient?.name}</b></p><p><span className="text-slate-500">Patient ID</span><br /><b>{r.patient?.patientId}</b></p>
        <p><span className="text-slate-500">Doctor</span><br /><b>{r.doctor}</b>{r.specialization ? ` · ${r.specialization}` : ''}</p><p><span className="text-slate-500">Visit</span><br /><b>{r.visitNo}</b></p>
        <p><span className="text-slate-500">Date / time</span><br /><b>{new Date(r.paidAt).toLocaleString()}</b></p><p><span className="text-slate-500">Received by</span><br /><b>{r.receivedBy || '-'}</b></p>
      </section>
      <table className="mt-5 w-full text-sm"><tbody>
        <tr><td className="border-b py-2">Consultation fee</td><td className="border-b py-2 text-right">{money(r.amount)}</td></tr>
        {r.discount > 0 && <tr><td className="border-b py-2">Discount</td><td className="border-b py-2 text-right">- {money(r.discount)}</td></tr>}
        <tr><td className="py-3 text-base font-bold">Amount paid ({r.method})</td><td className="py-3 text-right text-base font-bold">{money(r.net)}</td></tr></tbody></table>
      {r.note && <p className="text-xs text-slate-500">Note: {r.note}</p>}
      <div className="mt-12 flex justify-end"><div className="w-48 border-t border-slate-500 pt-1 text-center text-xs text-slate-600">Cashier signature</div></div>
      <p className="mt-6 text-center text-[10px] text-slate-400">Thank you. Please keep this receipt.</p>
    </div>
  );
}
export default function FeeReceiptView({ id }) {
  const router = useRouter(); const ref = useRef(null);
  const [r, setR] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/visits/${id}/fee-receipt`).then(setR).catch((e) => setErr(e.message)); }, [id]);
  async function pdf() { setBusy(true); try { const h = (await import('html2pdf.js')).default; await h().set({ margin: 8, filename: `fee-receipt-${r.receiptNo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a5' } }).from(ref.current).save(); } catch (e) { setErr('Could not create PDF: ' + e.message); } finally { setBusy(false); } }
  if (err) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!r) return <p className="text-slate-500">Preparing receipt...</p>;
  return (<div><div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3"><button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back</button>
    <div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button><Button loading={busy} onClick={pdf}><Download className="h-4 w-4" />Download PDF</Button></div></div><Sheet r={r} innerRef={ref} /></div>);
}
