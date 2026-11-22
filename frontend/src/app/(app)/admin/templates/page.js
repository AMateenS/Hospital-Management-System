'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, PageHeader } from '@/components/ui';

function List() {
  const router = useRouter(); const doctor = useSearchParams().get('doctor') || '';
  const [rows, setRows] = useState([]); const [err, setErr] = useState('');
  const load = () => api('/templates', { query: { doctor } }).then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [doctor]); // eslint-disable-line
  const archive = async (t) => { if (confirm(`Archive "${t.name}"?`)) { try { await api(`/templates/${t._id}`, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); } } };
  const cols = [
    { key: 'name', header: 'Template' }, { key: 'd', header: 'Doctor', render: (t) => `${t.doctor?.user?.name || '-'} (${t.doctor?.specialization || ''})` },
    { key: 'fields', header: 'Fields', render: (t) => t.fields.length }, { key: 'version', header: 'Version', render: (t) => `v${t.version}` },
    { key: 's', header: 'Status', render: (t) => (String(t.doctor?.template) === String(t._id) ? <Badge tone="bg-emerald-50 text-emerald-700">Assigned</Badge> : <Badge>Inactive</Badge>) },
    { key: 'a', header: '', render: (t) => <div className="flex gap-2"><Button variant="outline" onClick={() => router.push(`/admin/templates/${t._id}`)}>Edit</Button><Button variant="ghost" onClick={() => archive(t)}>Archive</Button></div> },
  ];
  return (<>
    <PageHeader title="Prescription Templates" subtitle="Design doctor-specific prescription and patient description layouts" action={<Button onClick={() => router.push(`/admin/templates/new${doctor ? `?doctor=${doctor}` : ''}`)}><Plus className="h-4 w-4" />New template</Button>} />
    {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
    <Card><DataTable columns={cols} rows={rows} searchKeys={['name']} empty="No templates yet" /></Card></>);
}
export default function TemplatesPage() { return <Suspense><List /></Suspense>; }
