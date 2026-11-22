'use client';
import { forwardRef } from 'react';
import PadHeader from './PadHeader';

// Printable prescription / patient description. Data comes from GET /api/prescriptions/sheet/:visitId.
// Reused by the pharmacy dashboard (Phase 8).
const PrescriptionSheet = forwardRef(function PrescriptionSheet({ s }, ref) {
  const d = s.design || {}; const c = d.primaryColor || '#0d9488'; const v = s.visit.vitals || {};
  const show = (f) => {
    if (f.type === 'vitals') return null;
    if (f.value === undefined || f.value === null || f.value === '' || (Array.isArray(f.value) && !f.value.length)) return '-';
    return Array.isArray(f.value) ? f.value.join(', ') : `${f.value}${f.unit && f.type === 'number' ? ' ' + f.unit : ''}`;
  };
  return (
    <div ref={ref} className="print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-slate-900 shadow-card" style={{ fontFamily: d.fontFamily }}>
      <PadHeader design={d} hospital={s.hospital} doctor={s.doctor} date={s.visit.date} />
      <p className="mt-1 text-right text-xs text-slate-500">Visit {s.visit.visitNo}{s.rxNo ? ` · Rx ${s.rxNo}` : ''}</p>
      {s.draft && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-center text-xs font-semibold text-amber-700">DRAFT - consultation not yet completed</p>}
      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <p><span className="text-slate-500">Patient</span><br /><b>{s.patient.name}</b></p><p><span className="text-slate-500">Patient ID</span><br /><b>{s.patient.patientId}</b></p>
        <p><span className="text-slate-500">Age / Gender</span><br /><b>{s.patient.age ?? '-'} / {s.patient.gender}</b></p><p><span className="text-slate-500">Phone</span><br /><b>{s.patient.phone}</b></p>
      </section>
      <p className="mt-3 text-xs text-slate-600">
        Vitals: BP {v.bloodPressure || '-'} · Pulse {v.pulse ?? '-'} · Temp {v.temperatureC ?? '-'} °C · Weight {v.weightKg ?? '-'} kg · SpO2 {v.spo2 ?? '-'} %</p>
      <section className="mt-4 space-y-3 text-sm">
        {s.fields.filter((f) => f.type !== 'vitals').map((f) => (
          <div key={f.key}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: c }}>{f.label}</p><p className="whitespace-pre-wrap">{show(f)}</p></div>))}
      </section>
      {s.medicines.length > 0 && (
        <section className="mt-5"><p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: c }}>Medicines</p>
          <table className="w-full border-collapse text-sm"><thead><tr className="text-left" style={{ background: `${c}18` }}>{['#', 'Medicine', 'Dosage', 'Frequency', 'Duration', 'Qty', 'Instructions'].map((h) => <th key={h} className="border border-slate-200 px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{s.medicines.map((m, i) => (<tr key={i}><td className="border border-slate-200 px-2 py-1.5">{i + 1}</td><td className="border border-slate-200 px-2 py-1.5 font-medium">{m.name}{m.strength ? ` ${m.strength}` : ''}</td>
              <td className="border border-slate-200 px-2 py-1.5">{m.dosage}</td><td className="border border-slate-200 px-2 py-1.5">{m.frequency}</td><td className="border border-slate-200 px-2 py-1.5">{m.duration}</td><td className="border border-slate-200 px-2 py-1.5">{m.quantity || '-'}</td><td className="border border-slate-200 px-2 py-1.5">{m.instructions || ''}</td></tr>))}</tbody></table></section>)}
      {s.visit.followUpDate && <p className="mt-4 text-sm"><b>Follow-up:</b> {new Date(s.visit.followUpDate).toLocaleDateString()}</p>}
      {s.labTests?.length > 0 && <p className="mt-4 text-sm"><b>Tests advised:</b> {s.labTests.map((t) => t.name).join(', ')}</p>}
      {d.showSignature !== false && <div className="mt-10 flex justify-end"><div className="w-56 text-center text-xs text-slate-600">
        {s.doctor.signatureUrl ? <img src={s.doctor.signatureUrl} alt="Doctor signature" className="mx-auto mb-1 h-14 object-contain" crossOrigin="anonymous" /> : <div className="h-14" />}
        <div className="border-t border-slate-500 pt-1">{s.doctor.name}<br />Doctor&apos;s signature</div></div></div>}
      {d.footerText && <footer className="mt-8 border-t pt-2 text-center text-xs text-slate-500" style={{ borderColor: c }}>{d.footerText}</footer>}
    </div>
  );
});
export default PrescriptionSheet;
