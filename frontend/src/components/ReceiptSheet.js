'use client';
import { forwardRef } from 'react';
const money = (n) => (n ?? 0).toFixed(2);
// Pharmacy bill: patient, doctor, every medicine handed over (batch, quantity, price), discount, total and payment status.
const ReceiptSheet = forwardRef(function ReceiptSheet({ r }, ref) {
  const c = '#0f766e'; const st = r.paymentStatus || 'Paid';
  return (
    <div ref={ref} className="print-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-slate-900 shadow-card">
      <header className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: c }}>
        <div className="grid h-14 w-14 place-items-center rounded-xl text-2xl font-bold text-white" style={{ background: c }}>+</div>
        <div className="flex-1"><h1 className="text-xl font-bold" style={{ color: c }}>{r.hospital.name}</h1><p className="text-xs text-slate-500">{[r.hospital.address, r.hospital.phone && `Tel: ${r.hospital.phone}`].filter(Boolean).join(' · ')}</p></div>
        <div className="text-right"><p className="text-lg font-semibold">Pharmacy Bill</p><p className="text-xs text-slate-500">{(r.billNos?.length ? r.billNos.join(', ') : '-')} · {r.rxNo}</p><p className="text-xs text-slate-500">{new Date(r.dispensedAt).toLocaleString()}</p></div>
      </header>
      <section className="mt-4 grid grid-cols-2 gap-3 rounded bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <p><span className="text-slate-500">Patient</span><br /><b>{r.patient?.name}</b></p><p><span className="text-slate-500">Patient ID</span><br /><b>{r.patient?.patientId}</b></p>
        <p><span className="text-slate-500">Prescribed by</span><br /><b>{r.doctor}</b></p><p><span className="text-slate-500">Dispensed by</span><br /><b>{r.dispensedBy || '-'}</b></p>
      </section>
      <table className="mt-5 w-full border-collapse text-sm">
        <thead><tr className="text-left" style={{ background: `${c}18` }}>{['#', 'Medicine', 'Batch', 'Qty given', 'Unit price', 'Amount'].map((h, i) => <th key={h} className={`border border-slate-200 px-2 py-1.5 font-semibold ${i > 2 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>{r.lines.map((l, i) => (<tr key={i}><td className="border border-slate-200 px-2 py-1.5">{i + 1}</td><td className="border border-slate-200 px-2 py-1.5 font-medium">{l.name} {l.strength}</td><td className="border border-slate-200 px-2 py-1.5">{l.batchNo || '-'}</td>
          <td className="border border-slate-200 px-2 py-1.5 text-right">{l.quantity}</td><td className="border border-slate-200 px-2 py-1.5 text-right">{money(l.unitPrice)}</td><td className="border border-slate-200 px-2 py-1.5 text-right">{money(l.lineTotal)}</td></tr>))}</tbody>
        <tfoot>
          <tr><td colSpan="5" className="border border-slate-200 px-2 py-1.5 text-right">Subtotal</td><td className="border border-slate-200 px-2 py-1.5 text-right">{money(r.subtotal ?? r.total)}</td></tr>
          {r.discount > 0 && <tr><td colSpan="5" className="border border-slate-200 px-2 py-1.5 text-right">Discount</td><td className="border border-slate-200 px-2 py-1.5 text-right">- {money(r.discount)}</td></tr>}
          <tr><td colSpan="5" className="border border-slate-200 px-2 py-2 text-right font-semibold">Total payable</td><td className="border border-slate-200 px-2 py-2 text-right text-base font-bold">{money(r.total)}</td></tr>
        </tfoot>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>Payment status: <b className={st === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}>{st}</b>{r.bills?.filter((b) => b.paid && b.method).length > 0 && ` (${[...new Set(r.bills.filter((b) => b.paid && b.method).map((b) => b.method))].join(', ')})`}</p>
        {r.amountDue > 0 && <p className="font-semibold text-amber-700">Amount due: {money(r.amountDue)}</p>}
      </div>
      {r.notDispensed?.length > 0 && <p className="mt-2 text-xs text-amber-700">Not dispensed: {r.notDispensed.join(', ')}</p>}
      <div className="mt-14 flex justify-between text-xs text-slate-600"><div className="w-52 border-t border-slate-500 pt-1 text-center">Pharmacist signature</div><div className="w-52 border-t border-slate-500 pt-1 text-center">Patient / receiver</div></div>
      <p className="mt-6 text-center text-[10px] text-slate-400">Stock has been deducted. Please keep this bill.</p>
    </div>
  );
});
export default ReceiptSheet;
