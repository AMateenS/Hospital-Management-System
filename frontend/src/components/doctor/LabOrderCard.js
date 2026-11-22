'use client';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { Card, Field } from '@/components/ui';
import LabRequestPanel from './LabRequestPanel';

// Doctor dashboard > Laboratory tests: pick a patient, type the tests, send. The lab then sees patient, doctor and tests.
export default function LabOrderCard({ patients, onOrdered }) {
  const [visitId, setVisitId] = useState(''); const [d, setD] = useState(null); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(async (id) => {
    if (!id) { setD(null); return; }
    setLoading(true); setErr('');
    try { setD(await api(`/doctor/visits/${id}/details`)); } catch (e) { setErr(e.message); setD(null); } finally { setLoading(false); }
  }, []);
  const pick = (e) => { setVisitId(e.target.value); load(e.target.value); };
  return (
    <Card className="mt-6" title="Laboratory tests: recommend tests for a patient">
      <div className="max-w-xl"><Field label="Patient">
        <select className="input" value={visitId} onChange={pick}><option value="">Select a patient from today&apos;s list</option>
          {patients.map((v) => <option key={v._id} value={v._id}>{v.patient?.name} ({v.patient?.patientId}) - {v.chiefComplaint}</option>)}</select></Field>
        {patients.length === 0 && <p className="mt-1 text-xs text-slate-400">No patients assigned today. You can also order tests from any patient&apos;s details page.</p>}</div>
      {loading && <p className="mt-4 text-sm text-slate-500">Loading patient...</p>}
      {err && <p role="alert" className="mt-4 text-sm text-red-600">{err}</p>}
      {d && <div className="mt-5 border-t pt-5"><LabRequestPanel visitId={d.visit._id} labs={d.labs} patient={d.patient} visitNo={d.visit.visitNo} doctorName={d.doctor?.name}
        onChanged={() => { load(visitId); onOrdered?.(); }} /></div>}
    </Card>
  );
}
