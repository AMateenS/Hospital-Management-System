'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, Stethoscope, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, PageHeader, StatCard } from '@/components/ui';
import DoctorTools from '@/components/doctor/DoctorTools';
import LabOrderCard from '@/components/doctor/LabOrderCard';

export default function DoctorDashboard() {
  const router = useRouter();
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api('/doctor/overview').then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const rows = (d?.patients || []).map((v) => ({ _id: v._id, pid: v.patient?.patientId, name: v.patient?.name, age: v.patient?.age, gender: v.patient?.gender, time: v.registeredAt, complaint: v.chiefComplaint, status: v.status, fee: v.fee }));
  const cols = [
    { key: 'pid', header: 'Patient ID' }, { key: 'name', header: 'Name' }, { key: 'age', header: 'Age' }, { key: 'gender', header: 'Gender' },
    { key: 'time', header: 'Registered', render: (r) => new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { key: 'complaint', header: 'Main complaint' }, { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'fee', header: 'Fee', render: (r) => <Badge>{r.fee?.status || 'Unpaid'}</Badge> },
    { key: 'a', header: '', render: (r) => <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => router.push(`/doctor/visit/${r._id}`)}>View Details</Button><Button onClick={() => router.push(`/doctor/visit/${r._id}/prescription`)}>Prescription</Button></div> },
  ];
  const s = d?.stats;
  return (
    <>
      <PageHeader title="Doctor Dashboard" subtitle="Your patients and consultations today" />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Patients Today" value={s?.total} icon={Users} />
        <StatCard label="Waiting" value={s?.waiting} icon={Clock} tone="amber" />
        <StatCard label="In Consultation" value={s?.inConsultation} icon={Stethoscope} tone="blue" />
        <StatCard label="Completed" value={s?.completed} icon={CheckCircle2} tone="green" />
      </div>
      <DoctorTools />
      <Card className="mt-6" title="Today's patients"><DataTable columns={cols} rows={rows} searchKeys={['pid', 'name', 'complaint']} empty="No patients assigned yet today" /></Card>
      {d?.returned?.length > 0 && (
        <div role="alert" className="mt-6 rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="mb-2 font-semibold">Prescriptions returned by the pharmacy for correction</p>
          <ul className="space-y-1">{d.returned.map((r) => <li key={r._id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.rxNo} · {r.patient?.name} ({r.patient?.patientId}): {r.returnReason}</span><button className="font-medium underline" onClick={() => router.push(`/doctor/visit/${r.visit}/prescription`)}>Open and correct</button></li>)}</ul></div>)}
      <LabOrderCard patients={d?.patients || []} onOrdered={load} />
      <Card className="mt-6" title="Laboratory tests (my orders)">
        {d?.labOrders?.length ? <ul className="divide-y divide-slate-100 text-sm">{d.labOrders.map((l) => (
          <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{l.patient?.name} <span className="text-slate-400">({l.patient?.patientId})</span> · {l.tests.map((t) => t.name).join(', ')}</span>
            <span className="flex items-center gap-2"><Badge>{l.priority || 'Routine'}</Badge><Badge>{l.status}</Badge><button className="text-teal-600 hover:underline" onClick={() => router.push(`/doctor/visit/${l.visit}`)}>Open record</button>{l.status === 'Completed' && <button className="text-slate-500 hover:underline" onClick={() => router.push(`/doctor/lab/${l._id}`)}>Report</button>}</span></li>))}</ul>
          : <p className="text-sm text-slate-400">You have not ordered any lab tests yet.</p>}
      </Card>
      <Card className="mt-6" title="Recent patient records">
        {d?.recent?.length ? <ul className="divide-y divide-slate-100 text-sm">{d.recent.map((v) => (
          <li key={v._id} className="flex items-center justify-between py-2"><span>{v.patient?.name} <span className="text-slate-400">({v.patient?.patientId})</span> - {v.consultation?.diagnosis}</span>
            <button className="text-teal-600 hover:underline" onClick={() => router.push(`/doctor/visit/${v._id}`)}>Open</button></li>))}</ul>
          : <p className="text-sm text-slate-400">No completed consultations yet.</p>}
      </Card>
    </>
  );
}
