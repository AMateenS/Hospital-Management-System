'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';

export default function AuditPage() {
  const [f, setF] = useState({ action: '', role: '', q: '', from: '', to: '' }); const [page, setPage] = useState(1);
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = useCallback((p = page, filt = f) => api('/audit', { query: { ...filt, page: p } }).then(setD).catch((e) => setErr(e.message)), [page, f]);
  useEffect(() => { load(page); }, [page]); // eslint-disable-line
  const search = (e) => { e.preventDefault(); setPage(1); load(1, f); };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Who did what, and when. Entries cannot be edited or deleted from the application." />
      <Card className="mb-6"><form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label><span className="label">Action</span><input className="input w-44" placeholder="e.g. LOGIN, LAB_" value={f.action} onChange={set('action')} /></label>
        <label><span className="label">Role</span><select className="input w-40" value={f.role} onChange={set('role')}><option value="">All</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span className="label">Record / path</span><input className="input w-48" value={f.q} onChange={set('q')} /></label>
        <label><span className="label">From</span><input type="date" className="input" value={f.from} onChange={set('from')} /></label>
        <label><span className="label">To</span><input type="date" className="input" value={f.to} onChange={set('to')} /></label>
        <Button type="submit">Filter</Button>
      </form></Card>
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <Card>
        <div className="overflow-x-auto rounded-lg border border-slate-100"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Time', 'User', 'Role', 'Action', 'Record', 'Details', 'IP'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{d?.rows.length ? d.rows.map((r) => (
            <tr key={r._id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td><td className="px-4 py-2">{r.user?.name || '-'}</td>
              <td className="px-4 py-2">{r.role && <Badge tone="bg-blue-50 text-blue-700">{ROLE_LABEL[r.role] || r.role}</Badge>}</td><td className="px-4 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-4 py-2 text-xs">{r.entity} <span className="text-slate-400">{r.entityId?.slice(-6)}</span></td><td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500" title={JSON.stringify(r.meta)}>{r.meta ? JSON.stringify(r.meta) : ''}</td><td className="px-4 py-2 text-xs text-slate-400">{r.ip}</td></tr>))
            : <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No audit entries</td></tr>}</tbody></table></div>
        {d && <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{d.total} entries</span>
          <div className="flex items-center gap-2"><button className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></button><span>Page {d.page} / {d.pages}</span>
            <button className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={page >= d.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></button></div></div>}
      </Card>
    </>
  );
}
