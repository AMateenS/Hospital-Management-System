'use client';
import { useEffect, useState } from 'react';
import { GripVertical, Trash2, ChevronUp, ChevronDown, Type, AlignLeft, Hash, Calendar, List, CheckSquare, Activity, Pill } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Field } from '@/components/ui';
import TemplatePreview from './TemplatePreview';

const PALETTE = [
  { type: 'text', label: 'Text', icon: Type }, { type: 'textarea', label: 'Text area', icon: AlignLeft }, { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar }, { type: 'dropdown', label: 'Dropdown', icon: List }, { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'vitals', label: 'Vitals block', icon: Activity }, { type: 'medicines', label: 'Medicines table', icon: Pill },
];
const PRESETS = { 'Yes / No': ['Yes', 'No'], 'Severity': ['Mild', 'Moderate', 'Severe'], 'Blood group': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], 'Heart rhythm': ['Regular', 'Irregular'], 'Condition': ['Stable', 'Improving', 'Critical'] };
const FONTS = ['Inter', 'Georgia', 'Times New Roman', 'Arial', 'Courier New'];

export default function TemplateDesigner({ initial, doctors, onSaved }) {
  const [name, setName] = useState(initial.name || '');
  const [doctorId, setDoctorId] = useState(initial.doctorId || '');
  const [fields, setFields] = useState(initial.fields || []);
  const [design, setDesign] = useState({ logoUrl: '', headerText: '', footerText: '', primaryColor: '#0d9488', fontFamily: 'Inter', showSignature: true, ...(initial.design || {}) });
  const [sel, setSel] = useState(null); const [drag, setDrag] = useState(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [logoErr, setLogoErr] = useState('');
  async function uploadLogo(e) {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return; setLogoErr('');
    const fd = new FormData(); fd.append('file', file);
    try { const res = await fetch('/api/assets/logos', { method: 'POST', body: fd, credentials: 'include' }); const j = await res.json(); if (!res.ok) throw new Error(j.message); setDesign((d) => ({ ...d, logoUrl: j.url })); }
    catch (x) { setLogoErr(x.message); }
  }

  const nextKey = (type) => { let n = 1; const keys = new Set(fields.map((f) => f.key)); while (keys.has(`${type}_${n}`)) n++; return `${type}_${n}`; };
  const add = (p) => { const f = { key: nextKey(p.type), label: p.label, type: p.type, required: false, options: p.type === 'dropdown' ? ['Option 1', 'Option 2'] : [], unit: '', placeholder: '' }; setFields([...fields, f]); setSel(f.key); };
  const upd = (key, patch) => setFields(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const move = (from, to) => { if (to < 0 || to >= fields.length || from === to) return; const a = [...fields]; const [x] = a.splice(from, 1); a.splice(to, 0, x); setFields(a); };
  const remove = (key) => { setFields(fields.filter((f) => f.key !== key)); if (sel === key) setSel(null); };
  const [hospital, setHospital] = useState({});
  useEffect(() => { api('/hospital').then(setHospital).catch(() => {}); }, []);
  const cur = fields.find((f) => f.key === sel);
  const doc = doctors.find((d) => d._id === doctorId);
  const docInfo = doc && { name: doc.user.name, qualification: doc.qualification, specialization: doc.specialization, department: doc.department?.name, phone: doc.contact || doc.user.phone, availability: doc.availability, signatureUrl: doc.signatureUrl };

  async function save() {
    setErr(''); setBusy(true);
    const body = { name, doctorId, assign: true, fields, design };
    try { const t = initial._id ? await api(`/templates/${initial._id}`, { method: 'PUT', body }) : await api('/templates', { method: 'POST', body }); onSaved(t); }
    catch (e) { setErr(e.errors?.map((x) => x.message).join('; ') || e.message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <Card title="Template">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" required><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Doctor" required><select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><option value="">Select doctor</option>{doctors.map((d) => <option key={d._id} value={d._id}>{d.user.name} - {d.specialization}</option>)}</select></Field>
          </div>
        </Card>
        <Card title="Add field"><div className="flex flex-wrap gap-2">{PALETTE.map((p) => <button key={p.type} type="button" onClick={() => add(p)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-teal-500 hover:bg-teal-50"><p.icon className="h-4 w-4 text-teal-600" />{p.label}</button>)}</div></Card>
        <Card title={`Fields (${fields.length}) - drag to reorder`}>
          {fields.length === 0 && <p className="text-sm text-slate-400">No fields yet. Add one above.</p>}
          <ul className="space-y-2">{fields.map((f, i) => (
            <li key={f.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { move(drag, i); setDrag(null); }}
              onClick={() => setSel(f.key)} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${sel === f.key ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'}`}>
              <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{f.label || 'Untitled'}{f.required && <span className="text-red-500"> *</span>}</p><p className="text-xs text-slate-400">{f.type}</p></div>
              <button type="button" aria-label="Move up" onClick={(e) => { e.stopPropagation(); move(i, i - 1); }}><ChevronUp className="h-4 w-4" /></button>
              <button type="button" aria-label="Move down" onClick={(e) => { e.stopPropagation(); move(i, i + 1); }}><ChevronDown className="h-4 w-4" /></button>
              <button type="button" aria-label="Remove field" onClick={(e) => { e.stopPropagation(); remove(f.key); }}><Trash2 className="h-4 w-4 text-red-500" /></button>
            </li>))}</ul>
        </Card>
        {cur && (
          <Card title="Field settings"><div className="space-y-4">
            <Field label="Label (rename)"><input className="input" value={cur.label} onChange={(e) => upd(cur.key, { label: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cur.required} onChange={(e) => upd(cur.key, { required: e.target.checked })} />Required field</label>
            {['text', 'textarea'].includes(cur.type) && <Field label="Placeholder"><input className="input" value={cur.placeholder || ''} onChange={(e) => upd(cur.key, { placeholder: e.target.value })} /></Field>}
            {cur.type === 'number' && <Field label="Unit (kg, mmHg, bpm...)"><input className="input" value={cur.unit || ''} onChange={(e) => upd(cur.key, { unit: e.target.value })} /></Field>}
            {['dropdown', 'checkbox'].includes(cur.type) && (<>
              <Field label="Options (one per line)"><textarea rows="5" className="input" value={cur.options.join('\n')} onChange={(e) => upd(cur.key, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></Field>
              <div><p className="label">Predefined medical options</p><div className="flex flex-wrap gap-2">{Object.entries(PRESETS).map(([k, v]) => <button type="button" key={k} onClick={() => upd(cur.key, { options: v })} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">{k}</button>)}</div></div></>)}
          </div></Card>)}
        <Card title="Page design"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hospital / header text"><input className="input" value={design.headerText} onChange={(e) => setDesign({ ...design, headerText: e.target.value })} /></Field>
          <Field label="Hospital logo (PNG/JPG, max 1 MB)"><div className="space-y-2">
            <input type="file" accept="image/png,image/jpeg" className="text-sm" onChange={uploadLogo} />
            {design.logoUrl && <div className="flex items-center gap-3"><img src={design.logoUrl} alt="Logo" className="h-10 w-10 object-contain" /><button type="button" className="text-xs text-red-600 underline" onClick={() => setDesign({ ...design, logoUrl: '' })}>Remove</button></div>}
            {logoErr && <p role="alert" className="text-xs text-red-600">{logoErr}</p>}</div></Field>
          <Field label="Primary color"><input type="color" className="h-10 w-full rounded-lg border border-slate-300" value={design.primaryColor} onChange={(e) => setDesign({ ...design, primaryColor: e.target.value })} /></Field>
          <Field label="Font"><select className="input" value={design.fontFamily} onChange={(e) => setDesign({ ...design, fontFamily: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Footer information"><input className="input" value={design.footerText} onChange={(e) => setDesign({ ...design, footerText: e.target.value })} placeholder="Address, phone, timings" /></Field></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.showSignature} onChange={(e) => setDesign({ ...design, showSignature: e.target.checked })} />Show signature area</label>
        </div></Card>
        {err && <div role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
        <div className="flex justify-end"><Button loading={busy} onClick={save}>{initial._id ? 'Save changes (new version)' : 'Create template'}</Button></div>
      </div>
      <div className="xl:sticky xl:top-20 xl:self-start"><p className="mb-2 text-sm font-semibold text-slate-600">Live preview</p>
        <TemplatePreview fields={fields} design={design} doctor={docInfo} hospital={hospital} /></div>
    </div>
  );
}
