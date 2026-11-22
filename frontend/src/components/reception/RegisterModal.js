'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field, Modal, Badge } from '@/components/ui';

const SYMPTOMS = ['Fever', 'Headache', 'Cough', 'Pain', 'Weakness', 'Nausea', 'Shortness of breath', 'Dizziness'];
const blank = {
  name: '', guardianName: '', dob: '', age: '', gender: 'Male', phone: '', address: '',
  doctorId: '', patientType: 'New', chiefComplaint: '', symptoms: [], notes: '',
  weightKg: '', heightCm: '', bloodPressure: '', temperatureF: '', pulse: '', spo2: '',
  payNow: false, payMethod: 'Cash', payDiscount: '',
};

// existing = a Patient record -> creates a follow-up visit instead of a new patient.
export default function RegisterModal({ open, onClose, onSaved, existing }) {
  const [doctors, setDoctors] = useState([]);
  const [f, setF] = useState(blank);
  const [err, setErr] = useState(''); const [fieldErrs, setFieldErrs] = useState({});
  const [dups, setDups] = useState(null); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!open) return;
    setErr(''); setFieldErrs({}); setDups(null);
    setF(existing ? { ...blank, patientType: 'Follow-up' } : blank);
    api('/doctors').then(setDoctors).catch((e) => setErr(e.message));
  }, [open, existing]);

  const toggleSymptom = (s) => setF((p) => ({ ...p, symptoms: p.symptoms.includes(s) ? p.symptoms.filter((x) => x !== s) : [...p.symptoms, s] }));

  async function submit(force = false) {
    setErr(''); setFieldErrs({}); setBusy(true);
    const fee = Number(doctors.find((d) => d._id === f.doctorId)?.consultationFee) || 0;
    const visit = {
      doctorId: f.doctorId, patientType: f.patientType, chiefComplaint: f.chiefComplaint, symptoms: f.symptoms, notes: f.notes,
      ...(f.payNow && fee > 0 ? { payment: { method: f.payMethod, discount: Number(f.payDiscount) || 0 } } : {}),
      vitals: { weightKg: f.weightKg, heightCm: f.heightCm, bloodPressure: f.bloodPressure, temperatureF: f.temperatureF, pulse: f.pulse, spo2: f.spo2 },
    };
    try {
      const res = existing
        ? await api(`/patients/${existing._id}/visits`, { method: 'POST', body: visit })
        : await api('/patients/register', { method: 'POST', body: { patient: { name: f.name, guardianName: f.guardianName, dob: f.dob, age: f.age, gender: f.gender, phone: f.phone, address: f.address }, visit, force } });
      onSaved(res); onClose();
    } catch (e) {
      if (e.status === 409 && e.data?.matches) setDups(e.data.matches);
      setErr(e.message);
      if (e.errors) setFieldErrs(Object.fromEntries(e.errors.map((x) => [x.field.split('.').pop(), x.message])));
    } finally { setBusy(false); }
  }

  function onSubmit(e) { e.preventDefault(); submit(false); }

  const sel = doctors.find((d) => d._id === f.doctorId);
  const E = (k) => fieldErrs[k];
  return (
    <Modal open={open} onClose={onClose} wide title={existing ? `New visit - ${existing.name} (${existing.patientId})` : 'Register new patient'}>
      <form onSubmit={onSubmit} className="space-y-6">
        {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        {dups && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800">Possible duplicate record(s):</p>
            {dups.map((d) => <p key={d._id} className="mt-1">{d.patientId} - {d.name}, {d.phone}</p>)}
            <p className="mt-2 text-amber-700">Close this form and use <b>Search existing patient</b> to add a follow-up visit, or register anyway if this is a different person.</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => submit(true)}>Register anyway</Button>
          </div>
        )}

        {!existing && (
          <section><h4 className="mb-3 font-semibold text-slate-700">Patient information</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Patient ID"><input className="input" disabled value="Auto-generated on save" /></Field>
              <Field label="Patient name" required error={E('name')}><input className="input" required value={f.name} onChange={set('name')} /></Field>
              <Field label="Father / Husband name"><input className="input" value={f.guardianName} onChange={set('guardianName')} /></Field>
              <Field label="Gender" required><select className="input" value={f.gender} onChange={set('gender')}><option>Male</option><option>Female</option><option>Other</option></select></Field>
              <Field label="Date of birth"><input type="date" max={new Date().toISOString().slice(0, 10)} className="input" value={f.dob} onChange={set('dob')} /></Field>
              <Field label="Age (if DOB unknown)"><input type="number" min="0" max="130" className="input" disabled={!!f.dob} value={f.age} onChange={set('age')} /></Field>
              <Field label="Phone number" required error={E('phone')}><input className="input" required value={f.phone} onChange={set('phone')} placeholder="03001234567" /></Field>
              <Field label="Address"><input className="input" value={f.address} onChange={set('address')} /></Field>
            </div>
          </section>
        )}

        <section><h4 className="mb-3 font-semibold text-slate-700">Visit details</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registration date and time"><input className="input" disabled value={new Date().toLocaleString()} /></Field>
            <Field label="Patient type"><select className="input" value={f.patientType} disabled={!!existing} onChange={set('patientType')}><option>New</option><option>Follow-up</option></select></Field>
            <Field label="Doctor" required error={E('doctorId')}>
              <select className="input" required value={f.doctorId} onChange={set('doctorId')}><option value="">Select doctor (department)</option>
                {doctors.map((d) => <option key={d._id} value={d._id}>{d.user.name} - {d.specialization} ({d.department?.name}) {d.available ? '· ● Available' : '· Not available'}</option>)}</select></Field>
            {sel && (Number(sel.consultationFee) > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:col-span-2">
                <p>Consultation fee: <b>{Number(sel.consultationFee).toLocaleString()}</b></p>
                <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={f.payNow} onChange={(e) => setF((p) => ({ ...p, payNow: e.target.checked }))} />Collect the fee now</label>
                {f.payNow && <div className="mt-2 grid gap-3 sm:grid-cols-2"><Field label="Method"><select className="input" value={f.payMethod} onChange={set('payMethod')}>{['Cash', 'Card', 'Online'].map((m) => <option key={m}>{m}</option>)}</select></Field>
                  <Field label="Discount (optional)"><input type="number" min="0" max={sel.consultationFee} className="input" value={f.payDiscount} onChange={set('payDiscount')} /></Field></div>}
                {!f.payNow && <p className="mt-1 text-xs text-amber-600">The fee will stay Unpaid until you collect it from the Consultation fees section.</p>}
              </div>) : <p className="text-xs text-slate-500 sm:col-span-2">This doctor has no consultation fee.</p>)}
            {sel && !sel.available && <p className="text-xs text-amber-600 sm:col-span-2">This doctor has not marked themselves available today. The patient will still be added to their list.</p>}
            <Field label="Main complaint / disease" required error={E('chiefComplaint')}><input className="input" required value={f.chiefComplaint} onChange={set('chiefComplaint')} /></Field>
          </div>
          <p className="label mt-4">Symptoms</p>
          <div className="flex flex-wrap gap-2">{SYMPTOMS.map((s) => (
            <button type="button" key={s} onClick={() => toggleSymptom(s)} className={`rounded-full border px-3 py-1 text-sm ${f.symptoms.includes(s) ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-300 text-slate-600'}`}>{s}</button>))}</div>
        </section>

        <section><h4 className="mb-3 font-semibold text-slate-700">Vital signs</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Weight (kg)" error={E('weightKg')}><input type="number" step="0.1" className="input" value={f.weightKg} onChange={set('weightKg')} /></Field>
            <Field label="Height (cm)" error={E('heightCm')}><input type="number" className="input" value={f.heightCm} onChange={set('heightCm')} /></Field>
            <Field label="Blood pressure" error={E('bloodPressure')}><input className="input" placeholder="120/80" value={f.bloodPressure} onChange={set('bloodPressure')} /></Field>
            <Field label="Temperature (°F)" error={E('temperatureF')}><input type="number" step="0.1" className="input" value={f.temperatureF} onChange={set('temperatureF')} placeholder="Enter temperature in Fahrenheit"/></Field>
            <Field label="Pulse (bpm)" error={E('pulse')}><input type="number" className="input" value={f.pulse} onChange={set('pulse')} /></Field>
            <Field label="SpO2 (%)" error={E('spo2')}><input type="number" className="input" value={f.spo2} onChange={set('spo2')} /></Field>
          </div>
          <div className="mt-4"><Field label="Additional notes"><textarea rows="2" className="input" value={f.notes} onChange={set('notes')} /></Field></div>
        </section>

        <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>{existing ? 'Create visit' : 'Register & assign doctor'}</Button></div>
      </form>
    </Modal>
  );
}
