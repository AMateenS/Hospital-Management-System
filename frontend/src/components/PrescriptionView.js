'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import PrescriptionSheet from '@/components/PrescriptionSheet';

// Shared by doctor and pharmacy: toolbar + sheet with Print and Download PDF.
export default function PrescriptionView({ visitId, backLabel = 'Back' }) {
  const router = useRouter(); const ref = useRef(null);
  const [s, setS] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api(`/prescriptions/sheet/${visitId}`).then(setS).catch((e) => setErr(e.message)); }, [visitId]);
  async function pdf() {
    setBusy(true);
    try { const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({ margin: 8, filename: `prescription-${s.patient.patientId}-${s.visit.visitNo}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(ref.current).save();
    } catch (e) { setErr('Could not create PDF: ' + e.message); } finally { setBusy(false); }
  }
  if (err) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!s) return <p className="text-slate-500">Preparing prescription...</p>;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />{backLabel}</button>
        <div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Print Prescription</Button><Button loading={busy} onClick={pdf}><Download className="h-4 w-4" />Download PDF</Button></div>
      </div>
      <PrescriptionSheet ref={ref} s={s} />
    </div>
  );
}
