'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FlaskConical, Printer, Save, Send, Shuffle } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Field, Modal } from '@/components/ui';
import TemplateForm from '@/components/doctor/TemplateForm';
import LabRequestPanel from '@/components/doctor/LabRequestPanel';
import PadHeader from '@/components/PadHeader';
import { useToast } from '@/context/ToastContext';

const csv = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const Cell = ({ label, value }) => <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="text-sm font-medium">{value || value === 0 ? value : '-'}</p></div>;
const Heading = ({ children, color }) => <h3 className="mb-2 mt-6 border-b pb-1 text-xs font-bold uppercase tracking-wider" style={{ color, borderColor: `${color}55` }}>{children}</h3>;

// The consultation page IS the doctor's prescription template: header, patient details and vitals
// (entered by reception) are filled in; the doctor writes the rest and can prescribe lab tests.
export default function VisitRecord() {
  const { id } = useParams(); const router = useRouter(); const toast = useToast();
  const [rec, setRec] = useState(null); const [f, setF] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(''); const [amend, setAmend] = useState(false); const [reason, setReason] = useState('');
  const [lab, setLab] = useState(false);
  const [refer, setRefer] = useState(false); const [doctors, setDoctors] = useState([]); const [rf, setRf] = useState({ doctorId: '', reason: '' });

  const hydrate = (r) => {
    const c = r.visit.consultation || {}, h = r.patient.history || {};
    setF({ values: c.data || {}, followUpDate: c.followUpDate ? c.followUpDate.slice(0, 10) : '', medicalHistory: h.medicalHistory || '', allergies: (h.allergies || []).join(', '), currentMedications: (h.currentMedications || []).join(', ') });
  };
  const load = useCallback(async () => {
    try { await api(`/doctor/visits/${id}/start`, { method: 'POST' }); const r = await api(`/doctor/visits/${id}`); setRec(r); if (r.visit._id !== id) router.replace(`/doctor/visit/${r.visit._id}/prescription`); return r; }
    catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load().then((r) => r && hydrate(r)); }, [load]);
  const reloadRelated = async () => { const r = await api(`/doctor/visits/${id}`); setRec(r); };   // keeps unsaved typing

  if (err && !rec) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!rec || !f) return <p className="text-slate-500">Loading patient...</p>;
  const { visit, patient, previous, labs, prescriptions, template, doctor, hospital, history } = rec;
  const currentRx = prescriptions[0];
  const finalized = !!visit.consultation?.finalized; const locked = finalized && !amend;
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const v = visit.vitals || {}; const c = template?.design?.primaryColor || '#0d9488';

  const payload = () => ({ data: f.values, followUpDate: f.followUpDate, history: { medicalHistory: f.medicalHistory, allergies: csv(f.allergies), currentMedications: csv(f.currentMedications) } });
  async function run(kind, fn) {
    setErr(''); setMsg(''); setBusy(kind);
    try { const out = await fn(); await reloadRelated(); return out; }
    catch (e) { setErr(e.errors?.map((x) => x.message).join('; ') || e.message); }
    finally { setBusy(''); }
  }
  const save = () => run('save', async () => { await api(`/doctor/visits/${id}/consultation`, { method: 'PUT', body: payload() }); setMsg('Saved'); });
  const complete = () => run('complete', async () => {
    const out = await api(`/doctor/visits/${id}/complete`, { method: 'POST', body: payload() });
    setMsg(out.prescription ? `Prescription ${out.prescription.rxNo} confirmed and sent to the pharmacy. Patient marked Completed at Reception.${out.pendingLabs ? ` ${out.pendingLabs} lab request(s) still pending.` : ''}` : 'Consultation completed. Patient marked Completed at Reception.');
  });
  const doAmend = () => run('amend', async () => { await api(`/doctor/visits/${id}/amend`, { method: 'POST', body: { ...payload(), reason } }); setAmend(false); setReason(''); setMsg('Record amended. The previous version is kept in the audit trail.'); });
  const sendRx = () => run('send', async () => {
    const out = await api(`/doctor/visits/${id}/send-prescription`, { method: 'POST', body: payload() });
    setMsg(`Prescription ${out.prescription.rxNo} saved and sent to the pharmacy. You can still add lab tests; finish the consultation when you are done.`); toast.success(`Prescription ${out.prescription.rxNo} sent to the pharmacy`);
  });
  async function openRefer() { setRefer(true); if (!doctors.length) setDoctors((await api('/doctors')).filter((d) => d.user.name)); }
  const doRefer = async () => { try { await api(`/doctor/visits/${id}/refer`, { method: 'POST', body: rf }); router.push('/doctor'); } catch (e) { setErr(e.errors?.[0]?.message || e.message); } };
  const allTests = labs.flatMap((l) => l.tests.map((t) => ({ ...t, status: l.status, labId: l._id, requestNo: l.requestNo })));

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push('/doctor')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back to patients</button>
        <div className="flex items-center gap-2"><Badge>{visit.status}</Badge>
          <Button variant="outline" onClick={() => router.push(`/doctor/visit/${visit._id}`)}>Patient details</Button>
          <Button variant="blue" onClick={() => setLab(true)}><FlaskConical className="h-4 w-4" />Prescribe lab test</Button></div>
      </div>
      {msg && <div role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}
      {err && <div role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      {amend && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="mb-2 font-medium text-amber-800">Amending a finalized record. The previous version is preserved.</p><input className="input" placeholder="Reason for amendment (required)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>}

      {currentRx?.status === 'Returned' && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>Returned by the pharmacy:</b> {currentRx.returnReason}<br />Please correct the prescription below and press <b>Save &amp; send to pharmacy</b> again.</div>}

      {/* ---------- the prescription pad ---------- */}
      <article className="rounded-xl2 border border-slate-200 bg-white p-6 shadow-card sm:p-8" style={{ fontFamily: template?.design?.fontFamily }}>
        <PadHeader design={template?.design} hospital={hospital} doctor={doctor} date={visit.registeredAt} />
        <p className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-slate-500"><span>Prescription No: <b className="text-slate-800">{currentRx?.rxNo || 'assigned on first save'}</b></span>{currentRx && <Badge>{currentRx.status}</Badge>}<span>{new Date().toLocaleString()}</span></p>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-4">
          <Cell label="Patient ID" value={patient.patientId} /><Cell label="Patient name" value={patient.name} />
          <Cell label="Age / Gender" value={`${patient.age ?? '-'} / ${patient.gender}`} /><Cell label="Phone" value={patient.phone} />
          <Cell label="Father / Husband" value={patient.guardianName} /><Cell label="Address" value={patient.address} />
          <Cell label="Visit no." value={visit.visitNo} /><Cell label="Visit type" value={visit.patientType} />
        </section>

        <Heading color={c}>Vital signs (recorded at reception)</Heading>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Cell label="Blood pressure" value={v.bloodPressure} /><Cell label="Pulse" value={v.pulse && `${v.pulse} bpm`} /><Cell label="Temperature" value={v.temperatureC && `${v.temperatureC} °C`} />
          <Cell label="Weight" value={v.weightKg && `${v.weightKg} kg`} /><Cell label="Height" value={v.heightCm && `${v.heightCm} cm`} /><Cell label="SpO2" value={v.spo2 && `${v.spo2} %`} />
        </div>

        <Heading color={c}>Complaint</Heading>
        <div className="grid gap-3 sm:grid-cols-2"><Cell label="Main complaint" value={visit.chiefComplaint} /><Cell label="Symptoms" value={visit.symptoms?.join(', ')} />{visit.notes && <Cell label="Reception notes" value={visit.notes} />}</div>

        <Heading color={c}>Medical history</Heading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="History"><textarea disabled={locked} rows="2" className="pad-input" value={f.medicalHistory} onChange={set('medicalHistory')} /></Field>
          <Field label="Allergies (comma separated)"><input disabled={locked} className="pad-input" value={f.allergies} onChange={set('allergies')} /></Field>
          <Field label="Current medications (comma separated)"><input disabled={locked} className="pad-input" value={f.currentMedications} onChange={set('currentMedications')} /></Field>
        </div>
        {(patient.history?.previousDiagnoses?.length > 0 || previous.length > 0) && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-500">Previous diagnoses and visits ({previous.length})</summary>
            {patient.history?.previousDiagnoses?.length > 0 && <p className="mt-2"><b>Previous diagnoses:</b> {patient.history.previousDiagnoses.join(', ')}</p>}
            <ul className="mt-2 divide-y divide-slate-100">{previous.map((p) => <li key={p._id} className="py-1.5"><span className="font-medium">{new Date(p.date).toLocaleDateString()}</span> · {p.doctor} - {p.diagnosis || p.complaint}</li>)}</ul></details>)}

        {history && (history.prescriptions.length > 0 || history.labs.length > 0) && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-slate-500">Previous prescriptions ({history.prescriptions.length}) and laboratory reports ({history.labs.length})</summary>
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              <div><p className="mb-1 font-semibold">Previous prescriptions</p>{history.prescriptions.length === 0 ? <p className="text-slate-400">None</p> : <ul className="space-y-2">{history.prescriptions.map((r) => (
                <li key={r._id} className="rounded-lg border border-slate-100 p-2"><p className="font-medium">{r.rxNo} · {new Date(r.date).toLocaleDateString()} · {r.doctor} <Badge>{r.status}</Badge></p>{r.diagnosis && <p className="text-xs text-slate-500">Diagnosis: {r.diagnosis}</p>}
                  <ul className="mt-1 list-disc pl-5 text-xs">{r.items.map((i, k) => <li key={k}>{i.name} {i.strength} - {i.dosage}, {i.frequency}, {i.duration}</li>)}</ul></li>))}</ul>}</div>
              <div><p className="mb-1 font-semibold">Laboratory reports</p>{history.labs.length === 0 ? <p className="text-slate-400">None</p> : <ul className="space-y-2">{history.labs.map((l) => (
                <li key={l._id} className="rounded-lg border border-slate-100 p-2"><p className="font-medium">{l.requestNo} · {l.date ? new Date(l.date).toLocaleDateString() : ''} <Link className="text-xs text-teal-600 underline" href={`/doctor/lab/${l._id}`}>Report</Link></p>
                  <ul className="mt-1 text-xs">{l.tests.map((t, k) => <li key={k} className={t.flag && t.flag !== 'Normal' ? 'text-red-600' : ''}>{t.name}: {t.result} {t.unit} {t.flag && `(${t.flag})`}</li>)}</ul></li>))}</ul>}</div>
            </div></details>)}

        <Heading color={c}>Examination, diagnosis and prescription</Heading>
        {template ? (<>
          <TemplateForm pad fields={template.fields} values={f.values} vitals={visit.vitals} disabled={locked} onChange={(values) => setF((p) => ({ ...p, values }))} />
          <div className="mt-4 max-w-xs"><Field label="Follow-up date"><input type="date" disabled={locked} className="pad-input" value={f.followUpDate} onChange={set('followUpDate')} /></Field></div>
          <p className="mt-3 text-[11px] text-slate-400">Template: {template.name} (v{template.version}){template.locked ? ' · locked for this visit' : ''}</p>
        </>) : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">No prescription template is assigned to you. Please ask the administrator.</p>}

        <Heading color={c}>Laboratory tests advised</Heading>
        {allTests.length === 0 ? <p className="text-sm text-slate-400">None yet. Use the <b>Prescribe lab test</b> button.</p> : (
          <ul className="space-y-1 text-sm">{allTests.map((t) => (
            <li key={t._id} className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{t.name}</span>
              <span className="flex items-center gap-3">{t.result ? <span className={t.flag && t.flag !== 'Normal' ? 'font-semibold text-red-600' : 'text-slate-600'}>{t.result} {t.unit} {t.flag && `(${t.flag})`}</span> : null}
                {t.status === 'Completed' && <Link className="text-xs text-teal-600 underline" href={`/doctor/lab/${t.labId}`}>Report</Link>}<Badge>{t.status}</Badge></span></li>))}</ul>)}
        {prescriptions.length > 0 && <p className="mt-4 text-xs text-slate-500">Prescription sent: {prescriptions.map((p) => `${p.rxNo} (${p.status})`).join(', ')}</p>}

        {template?.design?.showSignature !== false && (
          <div className="mt-8 flex justify-end"><div className="w-56 text-center text-xs text-slate-600">
            {doctor?.signatureUrl ? <img src={doctor.signatureUrl} alt="Your signature" className="mx-auto mb-1 h-14 object-contain" /> : <div className="h-14" />}
            <div className="border-t border-slate-500 pt-1">{doctor?.name}<br />Doctor&apos;s signature</div></div></div>)}
        {template?.design?.footerText && <footer className="mt-6 border-t pt-2 text-center text-xs text-slate-500" style={{ borderColor: c }}>{template.design.footerText}</footer>}
      </article>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 border-t bg-white/95 px-4 py-3 backdrop-blur lg:left-64 no-print">
        {finalized && !amend && <Button variant="outline" onClick={() => setAmend(true)}>Amend record</Button>}
        {visit.consultation?.templateSnapshot && <Button variant="outline" onClick={() => router.push(`/doctor/visit/${id}/print`)}><Printer className="h-4 w-4" />Print / PDF</Button>}
        {!finalized && <Button variant="outline" onClick={openRefer}><Shuffle className="h-4 w-4" />Refer</Button>}
        {!finalized && <Button variant="outline" loading={busy === 'save'} onClick={save}><Save className="h-4 w-4" />Save draft</Button>}
        {!finalized && <Button variant="blue" loading={busy === 'send'} onClick={sendRx}><Send className="h-4 w-4" />Save &amp; send to pharmacy</Button>}
        {!finalized && <Button loading={busy === 'complete'} onClick={() => { if (confirm('Confirm the prescription and send it to the pharmacy?\n\nThe consultation will be finalized and the patient will be marked Completed at Reception.')) complete(); }}><Send className="h-4 w-4" />Finish consultation</Button>}
        {amend && <><Button variant="ghost" onClick={() => setAmend(false)}>Cancel</Button><Button loading={busy === 'amend'} onClick={doAmend}>Save amendment</Button></>}
      </div>

      <Modal open={lab} onClose={() => setLab(false)} wide title={`Prescribe lab tests - ${patient.name} (${patient.patientId})`}>
                <LabRequestPanel visitId={visit._id} labs={labs} onChanged={reloadRelated} patient={patient} visitNo={visit.visitNo} doctorName={doctor?.name} />
      </Modal>
      <Modal open={refer} onClose={() => setRefer(false)} title="Refer patient">
        <div className="space-y-4">
          <Field label="Refer to doctor" required><select className="input" value={rf.doctorId} onChange={(e) => setRf({ ...rf, doctorId: e.target.value })}><option value="">Select</option>
            {doctors.map((d) => <option key={d._id} value={d._id}>{d.user.name} - {d.specialization} ({d.department?.name})</option>)}</select></Field>
          <Field label="Reason" required><textarea rows="2" className="input" value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRefer(false)}>Cancel</Button><Button onClick={doRefer}>Refer patient</Button></div>
        </div>
      </Modal>
    </div>
  );
}
