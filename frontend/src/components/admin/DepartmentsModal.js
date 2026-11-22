'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Button, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';

// Admin: rename departments and switch them off (only when no doctor is assigned).
export default function DepartmentsModal({ onClose }) {
  const toast = useToast(); const [rows, setRows] = useState(null); const [names, setNames] = useState({});
  const load = () => api('/admin/departments').then((r) => { setRows(r); setNames(Object.fromEntries(r.map((d) => [d._id, d.name]))); }).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = async (d, body, ok) => { try { await api(`/admin/departments/${d._id}`, { method: 'PATCH', body }); toast.success(ok); load(); } catch (e) { toast.error(e.errors?.[0]?.message || e.message); } };
  return (
    <Modal open onClose={onClose} title="Manage departments">
      {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : rows.length === 0 ? <p className="text-sm text-slate-400">No departments yet.</p> : (
        <ul className="space-y-3">{rows.map((d) => (
          <li key={d._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-3">
            <input aria-label={`Name of ${d.name}`} className="input min-w-[160px] flex-1" value={names[d._id] ?? ''} onChange={(e) => setNames({ ...names, [d._id]: e.target.value })} />
            <span className="text-xs text-slate-500">{d.doctors} doctor(s)</span><Badge>{d.active === false ? 'Inactive' : 'Active'}</Badge>
            <Button variant="outline" disabled={!names[d._id] || names[d._id].trim() === d.name} onClick={() => patch(d, { name: names[d._id].trim() }, 'Department renamed')}>Save name</Button>
            <Button variant="ghost" onClick={() => { if (d.active === false || confirm(`Deactivate ${d.name}? It will no longer be offered for new doctors.`)) patch(d, { active: d.active === false }, d.active === false ? 'Department activated' : 'Department deactivated'); }}>{d.active === false ? 'Activate' : 'Deactivate'}</Button>
          </li>))}</ul>)}
      <div className="mt-4 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}
