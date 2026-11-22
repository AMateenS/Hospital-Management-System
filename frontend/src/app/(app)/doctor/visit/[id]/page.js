'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, FlaskConical, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Modal } from '@/components/ui';
import LabRequestPanel from '@/components/doctor/LabRequestPanel';
import { fmtAvail } from '@/components/PadHeader';

const Info = ({ label, value }) => <div><p className="label">{label}</p><p className="text-sm">{value || value === 0 ? value : '-'}</p></div>;
const dt = (d) => (d ? new Date(d).toLocaleString() : '-');
const hint = (status) => (status === 404 ? 'The link is outdated or this visit no longer exists. Go back to the patient list and open the patient again.'
  : status === 403 ? 'This patient is not assigned to you.' : status === 401 ? 'Your session has ended. Please sign in again.'
  : status ? 'The server reported a problem. Look at the backend (terminal) window for the red error line and send it to the developer.' : 'The server could not be reached. Check that the backend is running and that you restarted it after updating.');

// "View Details": the patient's complete read-only file. The prescription template lives behind the separate Prescription button.
export default function PatientDetails() {
  const { id } = useParams(); const router = useRouter();
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [loading, setLoading] = useState(true); const [lab, setLab] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api(`/doctor/visits/${id}/details`); setD(r); setErr(null); if (r.visit._id !== id) router.replace(`/doctor/visit/${r.visit._id}`); }
    catch (e) { setErr({ message: e.message, status: e.status, call: `GET /api/doctor/visits/${id}/details` }); }
    finally { setLoading(false); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  if (loading && !d) return <p className="text-slate-500">Loading patient details...</p>;
  if (err && !d) return (
    <div className="mx-auto mt-10 max-w-xl rounded-xl2 border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-800">Could not open this patient</h2>
      <p className="mt-2 text-sm text-red-800">{err.message}</p>
      <p className="mt-2 text-sm text-slate-700">{hint(err.status)}</p>
      <p className="mt-3 break-all rounded bg-white/70 p-2 font-mono text-xs text-slate-600">{err.call} - {err.status ? `HTTP ${err.status}` : 'no response'}</p>
      <div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => router.push('/doctor')}><ArrowLeft className="h-4 w-4" />Back to patients</Button><Button onClick={load}><RefreshCw className="h-4 w-4" />Try again</Button></div>
    </div>);

  const { patient, visit, doctor, previousVisits, prescriptions, labs, history, warnings = [] } = d; const h = patient.history || {}; const v = visit.vitals || {};
  const allDx = [...new Set([visit.consultation?.diagnosis, ...(h.previousDiagnoses || []), ...previousVisits.map((x) => x.diagnosis)].filter(Boolean))];
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <button onClick={() => router.push('/doctor')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back to patients</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{patient.name} <span className="text-base font-normal text-slate-400">{patient.patientId}</span></h1><div className="mt-1 flex items-center gap-2"><Badge>{visit.status}</Badge><span className="text-sm text-slate-500">Visit {visit.visitNo} · {dt(visit.registeredAt)}</span></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="blue" onClick={() => setLab(true)}><FlaskConical className="h-4 w-4" />Prescribe lab test</Button>
          <Button onClick={() => router.push(`/doctor/visit/${visit._id}/prescription`)}><FileText className="h-4 w-4" />Write prescription</Button></div>
      </div>
      {warnings.length > 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">Some sections could not be loaded ({warnings.join(', ')}). The rest of the file is shown. <button className="underline" onClick={load}>Reload</button></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Patient information"><div className="grid grid-cols-2 gap-4">
          <Info label="Name" value={patient.name} /><Info label="Patient ID" value={patient.patientId} /><Info label="Age" value={patient.age} /><Info label="Gender" value={patient.gender} />
          <Info label="Phone" value={patient.phone} /><Info label="Father / Husband" value={patient.guardianName} /><div className="col-span-2"><Info label="Address" value={patient.address} /></div></div></Card>
        <Card title="Assigned doctor and visit"><div className="grid grid-cols-2 gap-4">
          <Info label="Doctor" value={doctor?.name} /><Info label="Speciality" value={[doctor?.specialization, doctor?.department].filter(Boolean).join(' · ')} />
          <Info label="Doctor timing" value={fmtAvail(doctor?.availability)} /><Info label="Doctor phone" value={doctor?.phone} />
          <Info label="Visit no." value={visit.visitNo} /><Info label="Visit type" value={visit.patientType} />
          <Info label="Registered" value={dt(visit.registeredAt)} /><Info label="Status" value={visit.status} />
          <Info label="Consultation fee" value={visit.fee ? `${visit.fee.status}${visit.fee.status === 'Paid' ? ` (${(visit.fee.amount || 0) - (visit.fee.discount || 0)})` : ''}` : '-'} />
          <Info label="Main complaint" value={visit.chiefComplaint} /><Info label="Symptoms" value={visit.symptoms?.join(', ')} />
          {visit.notes && <div className="col-span-2"><Info label="Reception notes" value={visit.notes} /></div>}</div></Card>
      </div>

      <Card title="Vital signs (recorded at reception)"><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Info label="Blood pressure" value={v.bloodPressure} /><Info label="Pulse" value={v.pulse && `${v.pulse} bpm`} /><Info label="Temperature" value={v.temperatureC && `${v.temperatureC} °C`} />
        <Info label="Weight" value={v.weightKg && `${v.weightKg} kg`} /><Info label="Height" value={v.heightCm && `${v.heightCm} cm`} /><Info label="SpO2" value={v.spo2 && `${v.spo2} %`} /></div></Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Medical history"><div className="space-y-3"><Info label="History" value={h.medicalHistory} /><Info label="Allergies" value={h.allergies?.join(', ')} /><Info label="Current medications" value={h.currentMedications?.join(', ')} /></div></Card>
        <Card title="Diagnoses"><div className="space-y-3"><Info label="This visit" value={visit.consultation?.diagnosis || 'Not recorded yet'} />
          <div><p className="label">All recorded diagnoses</p>{allDx.length ? <div className="flex flex-wrap gap-2">{allDx.map((x) => <Badge key={x} tone="bg-slate-100 text-slate-700">{x}</Badge>)}</div> : <p className="text-sm text-slate-400">None</p>}</div></div></Card>
      </div>

      <Card title={`Previous visits (${previousVisits.length})`}>{previousVisits.length === 0 ? <p className="text-sm text-slate-400">First visit.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-2">Date</th><th className="pb-2">Visit</th><th className="pb-2">Doctor</th><th className="pb-2">Complaint</th><th className="pb-2">Diagnosis</th><th className="pb-2">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{previousVisits.map((x) => <tr key={x._id}><td className="py-2">{new Date(x.date).toLocaleDateString()}</td><td>{x.visitNo}</td><td>{x.doctor}</td><td>{x.complaint}</td><td>{x.diagnosis || '-'}</td><td><Badge>{x.status}</Badge></td></tr>)}</tbody></table></div>)}</Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Prescriptions">
          <p className="label">This visit</p>{prescriptions.length === 0 ? <p className="mb-3 text-sm text-slate-400">None yet. Use <b>Write prescription</b>.</p> : <ul className="mb-4 space-y-2">{prescriptions.map((r) => <RxItem key={r._id} r={r} />)}</ul>}
          <p className="label">Previous visits</p>{history.prescriptions.length === 0 ? <p className="text-sm text-slate-400">None</p> : <ul className="space-y-2">{history.prescriptions.map((r) => <RxItem key={r._id} r={r} />)}</ul>}</Card>
        <Card title="Laboratory reports">
          <p className="label">This visit</p>{labs.length === 0 ? <p className="mb-3 text-sm text-slate-400">No lab orders yet. Use <b>Prescribe lab test</b>.</p> : <ul className="mb-4 space-y-2">{labs.map((l) => (
            <li key={l._id} className="rounded-lg border border-slate-100 p-2 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{l.requestNo}</span><span className="flex items-center gap-2"><Badge>{l.priority || 'Routine'}</Badge><Badge>{l.status}</Badge>{l.status === 'Completed' && <Link className="text-xs text-teal-600 underline" href={`/doctor/lab/${l._id}`}>Report</Link>}</span></div>
              <ul className="mt-1 text-xs">{l.tests.map((t, i) => <li key={i} className={t.flag && t.flag !== 'Normal' ? 'text-red-600' : ''}>{t.name}{t.result ? `: ${t.result} ${t.unit || ''}${t.flag ? ` (${t.flag})` : ''}` : ''}</li>)}</ul></li>))}</ul>}
          <p className="label">Previous reports</p>{history.labs.length === 0 ? <p className="text-sm text-slate-400">None</p> : <ul className="space-y-2">{history.labs.map((l) => (
            <li key={l._id} className="rounded-lg border border-slate-100 p-2 text-sm"><span className="font-medium">{l.requestNo}</span> <span className="text-xs text-slate-400">{l.date ? new Date(l.date).toLocaleDateString() : ''}</span> <Link className="text-xs text-teal-600 underline" href={`/doctor/lab/${l._id}`}>Report</Link>
              <ul className="mt-1 text-xs">{l.tests.map((t, i) => <li key={i} className={t.flag && t.flag !== 'Normal' ? 'text-red-600' : ''}>{t.name}: {t.result} {t.unit} {t.flag && `(${t.flag})`}</li>)}</ul></li>))}</ul>}</Card>
      </div>

      <Modal open={lab} onClose={() => setLab(false)} wide title={`Recommend lab tests - ${patient.name} (${patient.patientId})`}>
        <LabRequestPanel visitId={visit._id} labs={labs} patient={patient} visitNo={visit.visitNo} doctorName={doctor?.name} onChanged={load} />
      </Modal>
    </div>
  );
}
function RxItem({ r }) {
  return (<li className="rounded-lg border border-slate-100 p-2 text-sm"><p className="font-medium">{r.rxNo} · {new Date(r.date).toLocaleDateString()}{r.doctor ? ` · ${r.doctor}` : ''} <Badge>{r.status}</Badge></p>
    {r.diagnosis && <p className="text-xs text-slate-500">Diagnosis: {r.diagnosis}</p>}{r.returnReason && <p className="text-xs text-red-600">Returned: {r.returnReason}</p>}
    <ul className="mt-1 list-disc pl-5 text-xs">{r.items.map((i, k) => <li key={k}>{i.name} {i.strength} - {i.dosage}, {i.frequency}, {i.duration}{i.instructions ? ` (${i.instructions})` : ''}</li>)}</ul></li>);
}
