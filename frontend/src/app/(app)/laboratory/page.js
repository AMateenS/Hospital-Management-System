'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Clock, Droplet, Activity, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, PageHeader, StatCard } from '@/components/ui';

export default function LabDashboard() {
  const router = useRouter();
  const [s, setS] = useState(null); const [rows, setRows] = useState([]); const [status, setStatus] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => Promise.all([api('/lab/overview'), api('/lab/requests', { query: { status } })]).then(([o, r]) => { setS(o); setRows(r); }).catch((e) => setErr(e.message)), [status]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const data = rows.map((r) => ({ ...r, pid: r.patient?.patientId, pname: r.patient?.name, dname: r.doctor?.user?.name, tests_s: r.tests.map((t) => t.name).join(', ') }));
  const cols = [
    { key: 'pid', header: 'Patient ID' }, { key: 'pname', header: 'Patient' }, { key: 'dname', header: 'Referring doctor' }, { key: 'tests_s', header: 'Requested tests' }, { key: 'visitNo', header: 'Visit', render: (r) => r.visit?.visitNo || '-' }, { key: 'dx', header: 'Complaint / diagnosis', render: (r) => r.visit?.consultation?.diagnosis || r.visit?.chiefComplaint || '-' },
    { key: 'createdAt', header: 'Requested', render: (r) => new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) },
    { key: 'priority', header: 'Priority', render: (r) => <Badge>{r.priority || 'Routine'}</Badge> },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'a', header: '', render: (r) => <Button variant={r.status === 'Completed' ? 'outline' : 'primary'} onClick={() => router.push(`/laboratory/request/${r._id}`)}>{r.status === 'Pending' ? 'Open' : r.status === 'Completed' ? 'View' : 'Continue'}</Button> },
  ];
  return (
    <>
      <PageHeader title="Laboratory Dashboard" subtitle="Test requests, samples and results" />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Requests" value={s?.total} icon={FlaskConical} />
        <StatCard label="Pending" value={s?.pending} icon={Clock} tone="amber" />
        <StatCard label="Samples Collected" value={s?.sampleCollected} icon={Droplet} tone="blue" />
        <StatCard label="In Progress" value={s?.inProgress} icon={Activity} tone="blue" />
        <StatCard label="Completed" value={s?.completed} icon={CheckCircle2} tone="green" />
      </div>
      <Card className="mt-6" title="Laboratory patient list">
        <DataTable columns={cols} rows={data} searchKeys={['pid', 'pname', 'dname', 'tests_s']} empty="No lab requests"
          filters={<select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Accepted', 'Sample Collected', 'Processing', 'Completed', 'Cancelled'].map((x) => <option key={x}>{x}</option>)}</select>} />
      </Card>
    </>
  );
}
