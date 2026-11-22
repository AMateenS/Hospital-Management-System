'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Paperclip } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import LabReportSheet from './LabReportSheet';

// Shared by the lab dashboard and the doctor dashboard.
export default function LabReportView({ id }) {
  const router = useRouter(); const ref = useRef(null);
  const [s, setS] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/lab/requests/${id}/sheet`).then(setS).catch((e) => setErr(e.message)); }, [id]);
  async function pdf() {
    setBusy(true);
    try { const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({ margin: 8, filename: `lab-${s.patient.patientId}-${s.requestNo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4' } }).from(ref.current).save();
    } catch (e) { setErr('Could not create PDF: ' + e.message); } finally { setBusy(false); }
  }
  if (err) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!s) return <p className="text-slate-500">Preparing report...</p>;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back</button>
        <div className="flex flex-wrap gap-2">
          {s.hasFile && <a href={`/api/lab/requests/${id}/report`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"><Paperclip className="h-4 w-4" />Attached report file</a>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          <Button loading={busy} onClick={pdf}><Download className="h-4 w-4" />Download PDF</Button>
        </div>
      </div>
      <LabReportSheet ref={ref} s={s} />
    </div>
  );
}
