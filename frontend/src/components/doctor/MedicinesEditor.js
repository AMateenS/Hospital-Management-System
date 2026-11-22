'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

const empty = { name: '', strength: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '' };
const FREQ = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At night', 'As needed'];

export default function MedicinesEditor({ items, onChange, disabled }) {
  const [sugg, setSugg] = useState([]);
  const set = (i, k, v) => onChange(items.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  async function lookup(i, v) {
    set(i, 'name', v);
    if (v.length >= 2) { try { setSugg(await api('/medicines/search', { query: { q: v } })); } catch { setSugg([]); } }
  }
  function pick(i, v) { // autofill strength when a suggested medicine is chosen
    const m = sugg.find((s) => s.name === v); set(i, 'name', v); if (m?.strength) set(i, 'strength', m.strength);
  }
  return (
    <div className="space-y-3">
      <datalist id="med-sugg">{sugg.map((s) => <option key={s._id} value={s.name}>{s.genericName} {s.strength}</option>)}</datalist>
      {items.map((m, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-6">
          <input list="med-sugg" disabled={disabled} className="input sm:col-span-2" placeholder="Medicine" value={m.name} onChange={(e) => lookup(i, e.target.value)} onBlur={(e) => pick(i, e.target.value)} />
          <input disabled={disabled} className="input" placeholder="Strength" value={m.strength || ''} onChange={(e) => set(i, 'strength', e.target.value)} />
          <input disabled={disabled} className="input" placeholder="Dosage (1 tab)" value={m.dosage} onChange={(e) => set(i, 'dosage', e.target.value)} />
          <select disabled={disabled} className="input" value={m.frequency} onChange={(e) => set(i, 'frequency', e.target.value)}><option value="">Frequency</option>{FREQ.map((f) => <option key={f}>{f}</option>)}</select>
          <input disabled={disabled} className="input" placeholder="Duration (5 days)" value={m.duration} onChange={(e) => set(i, 'duration', e.target.value)} />
          <input disabled={disabled} type="number" min="1" className="input" placeholder="Qty" value={m.quantity || ''} onChange={(e) => set(i, 'quantity', e.target.value)} />
          <input disabled={disabled} className="input sm:col-span-4" placeholder="Instructions (after meals...)" value={m.instructions || ''} onChange={(e) => set(i, 'instructions', e.target.value)} />
          {!disabled && <button type="button" aria-label="Remove medicine" className="justify-self-end text-red-500 sm:col-span-1" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
      {!disabled && <button type="button" onClick={() => onChange([...items, { ...empty }])} className="inline-flex items-center gap-1 text-sm font-medium text-teal-600"><Plus className="h-4 w-4" />Add medicine</button>}
    </div>
  );
}
