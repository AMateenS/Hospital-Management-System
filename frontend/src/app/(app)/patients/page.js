'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Card, DataTable, Button, Modal, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

function PatientsInner() {
  const { user } = useAuth(); const sp = useSearchParams(); const initial = sp.get('q') || '';
  const [rows, setRows] = useState([]); const [q, setQ] = useState(initial); const [err, setErr] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback((term = '') => api('/patients', { query: { q: term } }).then(setRows).catch((e) => setErr(e.message)), []);
  useEffect(() => { setQ(initial); load(initial); }, [load, initial]);
  const open = (p) => api(`/patients/${p._id}`).then(setDetail).catch((e) => setErr(e.message));

  const cols = [
    { key: 'patientId', header: 'Patient ID' }, { key: 'name', header: 'Name' }, { key: 'age', header: 'Age' }, { key: 'gender', header: 'Gender' }, { key: 'phone', header: 'Phone' },
    { key: 'createdAt', header: 'Registered', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: 'a', header: '', render: (r) => <Button variant="outline" onClick={() => open(r)}>View</Button> },
  ];
  return (
    <>
      <PageHeader title="Patients" subtitle={user.role === 'doctor' ? 'Patients assigned to you' : 'Central patient database'} />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <Card>
        <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <input className="input max-w-sm" placeholder="Search by Patient ID, phone or name" value={q} onChange={(e) => setQ(e.target.value)} /><Button type="submit">Search</Button>
        </form>
        <DataTable columns={cols} rows={rows} />
      </Card>
      <Modal open={!!detail} onClose={() => setDetail(null)} wide title={detail ? `${detail.patient.name} - ${detail.patient.patientId}` : ''}>
        {detail && (<div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {[['Father/Husband', detail.patient.guardianName], ['Age', detail.patient.age], ['Gender', detail.patient.gender], ['Phone', detail.patient.phone], ['Address', detail.patient.address]].map(([k, v]) => (
              <div key={k}><p className="label">{k}</p><p>{v || '-'}</p></div>))}
          </div>
          <div><h4 className="mb-2 font-semibold">Visit history</h4>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">{detail.visits.map((v) => (
              <li key={v._id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div><p className="font-medium">{v.visitNo} · {v.chiefComplaint}</p><p className="text-xs text-slate-500">{new Date(v.registeredAt).toLocaleString()} · {v.doctor?.user?.name} · {v.patientType}</p></div>
                <Badge>{v.status}</Badge></li>))}</ul></div>
        </div>)}
      </Modal>
    </>
  );
}

export default function PatientsPage() { return <Suspense><PatientsInner /></Suspense>; }
