'use client';
import PadHeader from '@/components/PadHeader';
// Renders a template as a prescription pad with the doctor's header and signature (placeholders for field values).
function FieldPreview({ f }) {
  const base = 'w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm';
  switch (f.type) {
    case 'textarea': return <div className={`${base} h-14 text-slate-300`}>{f.placeholder || ''}</div>;
    case 'dropdown': return <div className={`${base} flex justify-between text-slate-400`}><span>{f.options[0] || 'Select...'}</span><span>▾</span></div>;
    case 'checkbox': return <div className="flex flex-wrap gap-3 text-sm">{(f.options.length ? f.options : ['Yes']).map((o) => <label key={o} className="flex items-center gap-1"><input type="checkbox" disabled />{o}</label>)}</div>;
    case 'date': return <div className={`${base} text-slate-400`}>dd/mm/yyyy</div>;
    case 'number': return <div className={`${base} text-slate-400`}>0 {f.unit}</div>;
    case 'vitals': return <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">{['Weight', 'BP', 'Temp', 'Pulse', 'SpO2', 'Height'].map((v) => <div key={v} className="rounded border border-slate-200 px-2 py-1">{v}</div>)}</div>;
    case 'medicines': return <table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-50 text-left">{['Medicine', 'Dosage', 'Frequency', 'Duration'].map((h) => <th key={h} className="border border-slate-200 px-2 py-1">{h}</th>)}</tr></thead><tbody><tr>{[0, 1, 2, 3].map((i) => <td key={i} className="border border-slate-200 px-2 py-3" />)}</tr></tbody></table>;
    default: return <div className={`${base} text-slate-300`}>{f.placeholder || ''}</div>;
  }
}
export default function TemplatePreview({ fields, design, doctor, hospital }) {
  const c = design.primaryColor || '#0d9488';
  return (
    <div className="mx-auto w-full max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 shadow-card" style={{ fontFamily: design.fontFamily }}>
      <PadHeader design={design} hospital={hospital} doctor={doctor} />
      <div className="mt-3 grid grid-cols-2 gap-x-4 rounded bg-slate-50 p-3 text-xs"><span>Patient: <b>Sample Patient</b></span><span>ID: <b>PID-000000</b></span><span>Age/Gender: <b>35 / Male</b></span><span>Visit: <b>V-000000</b></span></div>
      <div className="mt-4 space-y-3">{fields.map((f) => (
        <div key={f.key}><p className="mb-1 text-xs font-semibold" style={{ color: c }}>{f.label || 'Untitled'}{f.required && <span className="text-red-500"> *</span>}{f.unit && f.type !== 'number' ? ` (${f.unit})` : ''}</p><FieldPreview f={f} /></div>))}
        {fields.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Add fields to see the preview</p>}</div>
      {design.showSignature !== false && <div className="mt-8 flex justify-end"><div className="w-44 text-center text-xs text-slate-500">
        {doctor?.signatureUrl ? <img src={doctor.signatureUrl} alt="Signature" className="mx-auto mb-1 h-12 object-contain" /> : <div className="h-12" />}<div className="border-t border-slate-400 pt-1">Doctor&apos;s signature</div></div></div>}
      {design.footerText && <footer className="mt-6 border-t pt-2 text-center text-xs text-slate-500" style={{ borderColor: c }}>{design.footerText}</footer>}
    </div>
  );
}
