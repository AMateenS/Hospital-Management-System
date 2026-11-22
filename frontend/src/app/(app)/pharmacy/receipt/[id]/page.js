'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Printer, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import ReceiptSheet from '@/components/ReceiptSheet';

export default function ReceiptPage() {
  const { id } = useParams(); const router = useRouter(); const ref = useRef(null);
  const [r, setR] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/pharmacy/prescriptions/${id}/receipt`).then(setR).catch((e) => setErr(e.message)); }, [id]);
  async function pdf() {
    setBusy(true);
    try { const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({ margin: 8, filename: `receipt-${r.rxNo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4' } }).from(ref.current).save();
    } catch (e) { setErr('Could not create PDF: ' + e.message); } finally { setBusy(false); }
  }
  if (err) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!r) return <p className="text-slate-500">Preparing bill...</p>;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push('/pharmacy')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back to pharmacy</button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/pharmacy/print/${r.visit}`)}><FileText className="h-4 w-4" />Print prescription</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print bill</Button><Button loading={busy} onClick={pdf}><Download className="h-4 w-4" />Download PDF</Button></div>
      </div>
      <ReceiptSheet ref={ref} r={r} />
    </div>
  );
}
