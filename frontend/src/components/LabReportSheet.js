'use client';
import { forwardRef } from 'react';

const flagStyle = { High: 'text-red-600 font-bold', Low: 'text-blue-600 font-bold', Critical: 'text-red-700 font-bold underline', Normal: '' };

const LabReportSheet = forwardRef(function LabReportSheet({ s }, ref) {
  const c = '#0f766e';
  return (
    <div ref={ref} className="print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-slate-900 shadow-card">
      <header className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: c }}>
        <div className="grid h-16 w-16 place-items-center rounded-xl text-3xl font-bold text-white" style={{ background: c }}>+</div>
        <div className="flex-1"><h1 className="text-2xl font-bold" style={{ color: c }}>{s.hospital.name}</h1><p className="text-xs text-slate-500">{[s.hospital.address, s.hospital.phone].filter(Boolean).join(' · ')}</p></div>
        <div className="text-right"><p className="text-lg font-semibold">Laboratory Report</p><p className="text-xs text-slate-500">{s.requestNo}</p></div>
      </header>
      {s.draft && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-center text-xs font-semibold text-amber-700">PRELIMINARY - results not yet finalized</p>}
      <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <p><span className="text-slate-500">Patient</span><br /><b>{s.patient.name}</b></p><p><span className="text-slate-500">Patient ID</span><br /><b>{s.patient.patientId}</b></p>
        <p><span className="text-slate-500">Age / Gender</span><br /><b>{s.patient.age ?? '-'} / {s.patient.gender}</b></p>
        <p><span className="text-slate-500">Referred by</span><br /><b>{s.doctor}</b></p><p><span className="text-slate-500">Requested</span><br /><b>{new Date(s.requestedAt).toLocaleDateString()}</b></p>
        <p><span className="text-slate-500">Report date</span><br /><b>{s.reportDate ? new Date(s.reportDate).toLocaleDateString() : '-'}</b></p>
      </section>
      <table className="mt-5 w-full border-collapse text-sm">
        <thead><tr className="text-left" style={{ background: `${c}18` }}>{['Test', 'Result', 'Unit', 'Reference range', 'Flag'].map((h) => <th key={h} className="border border-slate-200 px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{s.tests.map((t, i) => (<tr key={i}><td className="border border-slate-200 px-2 py-1.5">{t.name}</td><td className={`border border-slate-200 px-2 py-1.5 ${flagStyle[t.flag] || ''}`}>{t.result || '-'}</td>
          <td className="border border-slate-200 px-2 py-1.5">{t.unit}</td><td className="border border-slate-200 px-2 py-1.5">{t.referenceRange}</td><td className={`border border-slate-200 px-2 py-1.5 ${flagStyle[t.flag] || ''}`}>{t.flag}</td></tr>))}</tbody>
      </table>
      <div className="mt-14 flex justify-between text-xs text-slate-600">
        <div className="w-52 border-t border-slate-500 pt-1 text-center">{s.technician || ' '}<br />Laboratory technician</div>
        <div className="w-52 border-t border-slate-500 pt-1 text-center">&nbsp;<br />Authorized signature</div>
      </div>
      <p className="mt-6 text-center text-[10px] text-slate-400">Results should be interpreted by a qualified physician in clinical context.</p>
    </div>
  );
});
export default LabReportSheet;
