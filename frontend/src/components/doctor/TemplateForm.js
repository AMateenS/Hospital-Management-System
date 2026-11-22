'use client';
import { Field } from '@/components/ui';
import MedicinesEditor from './MedicinesEditor';

// Renders the doctor's admin-designed template. values = { [field.key]: value }.
export default function TemplateForm({ fields, values, onChange, disabled, vitals = {}, pad = false }) {
  const cls = pad ? 'pad-input' : 'input';
  const set = (k, v) => onChange({ ...values, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !(pad && f.type === 'vitals')).map((f) => {
        const v = values[f.key];
        const wide = ['textarea', 'medicines', 'vitals', 'checkbox'].includes(f.type);
        const label = f.label + (f.unit && f.type === 'number' ? ` (${f.unit})` : '');
        let input;
        switch (f.type) {
          case 'textarea': input = <textarea rows="3" disabled={disabled} placeholder={f.placeholder} className={cls} value={v || ''} onChange={(e) => set(f.key, e.target.value)} />; break;
          case 'number': input = <input type="number" step="any" disabled={disabled} className={cls} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} />; break;
          case 'date': input = <input type="date" disabled={disabled} className={cls} value={v || ''} onChange={(e) => set(f.key, e.target.value)} />; break;
          case 'dropdown': input = <select disabled={disabled} className={cls} value={v || ''} onChange={(e) => set(f.key, e.target.value)}><option value="">Select</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>; break;
          case 'checkbox': input = (
            <div className="flex flex-wrap gap-4">{(f.options.length ? f.options : ['Yes']).map((o) => {
              const arr = Array.isArray(v) ? v : [];
              return <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={arr.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />{o}</label>;
            })}</div>); break;
          case 'vitals': input = (
            <div className="grid grid-cols-3 gap-2 text-sm">{[['Weight', vitals.weightKg && `${vitals.weightKg} kg`], ['Height', vitals.heightCm && `${vitals.heightCm} cm`], ['BP', vitals.bloodPressure], ['Temp', vitals.temperatureC && `${vitals.temperatureC} °C`], ['Pulse', vitals.pulse && `${vitals.pulse} bpm`], ['SpO2', vitals.spo2 && `${vitals.spo2} %`]]
              .map(([k, x]) => <div key={k} className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-xs text-slate-500">{k}</span><br />{x || '-'}</div>)}</div>); break;
          case 'medicines': input = <MedicinesEditor items={v || []} disabled={disabled} onChange={(m) => set(f.key, m)} />; break;
          default: input = <input disabled={disabled} placeholder={f.placeholder} className={cls} value={v || ''} onChange={(e) => set(f.key, e.target.value)} />;
        }
        return <div key={f.key} className={wide ? 'sm:col-span-2' : ''}><Field label={label} required={f.required}>{input}</Field></div>;
      })}
    </div>
  );
}
