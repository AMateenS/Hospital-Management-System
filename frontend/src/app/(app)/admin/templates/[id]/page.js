'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import TemplateDesigner from '@/components/admin/TemplateDesigner';

function Designer() {
  const { id } = useParams(); const router = useRouter(); const pre = useSearchParams().get('doctor') || '';
  const [doctors, setDoctors] = useState(null); const [initial, setInitial] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        setDoctors((await api('/admin/doctors')).filter((d) => d.user.active));
        if (id === 'new') setInitial({ doctorId: pre });
        else { const t = await api(`/templates/${id}`); setInitial({ ...t, doctorId: t.doctor }); }
      } catch (e) { setErr(e.message); }
    })();
  }, [id, pre]);
  if (err) return <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{err}</div>;
  if (!doctors || !initial) return <p className="text-slate-500">Loading designer...</p>;
  return (<>
    <button onClick={() => router.push('/admin/templates')} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Templates</button>
    <h1 className="mb-6 text-2xl font-bold">{id === 'new' ? 'New template' : 'Edit template'}</h1>
    <TemplateDesigner key={id} initial={initial} doctors={doctors} onSaved={() => router.push('/admin/templates')} />
  </>);
}
export default function Page() { return <Suspense><Designer /></Suspense>; }
