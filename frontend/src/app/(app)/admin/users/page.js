'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, Field, Modal, PageHeader } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/nav';
import { useAuth } from '@/context/AuthContext';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]); const [role, setRole] = useState(''); const [err, setErr] = useState('');
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', email: '', phone: '', role: 'reception' });
  const [temp, setTemp] = useState(null); const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/users', { query: { role } }).then(setRows).catch((e) => setErr(e.message)), [role]);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await api('/users', { method: 'POST', body: f }); setOpen(false); setTemp({ name: r.user.name, pw: r.tempPassword }); setF({ name: '', email: '', phone: '', role: 'reception' }); load(); }
    catch (x) { setErr(x.errors?.map((i) => `${i.field}: ${i.message}`).join('; ') || x.message); } finally { setBusy(false); }
  }
  const toggle = (u) => api(`/users/${u._id}/active`, { method: 'PATCH', body: { active: !u.active } }).then(load).catch((e) => setErr(e.message));
  const reset = async (u) => { if (confirm(`Reset password for ${u.name}?`)) { try { const r = await api(`/users/${u._id}/reset-password`, { method: 'POST' }); setTemp({ name: u.name, pw: r.tempPassword }); } catch (e) { setErr(e.message); } } };
  const changeRole = (u, r) => api(`/users/${u._id}`, { method: 'PATCH', body: { role: r } }).then(load).catch((e) => setErr(e.message));

  const cols = [
    { key: 'name', header: 'Name' }, { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => u.role === 'doctor' || u._id === me._id ? <Badge tone="bg-blue-50 text-blue-700">{ROLE_LABEL[u.role]}</Badge>
      : <select className="rounded-md border border-slate-200 px-1.5 py-1 text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>{['admin', 'reception', 'laboratory', 'pharmacy'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select> },
    { key: 'active', header: 'Status', render: (u) => <Badge>{u.active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'last', header: 'Last login', render: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never') },
    { key: 'a', header: '', render: (u) => (<div className="flex gap-2">
      <Button variant="outline" disabled={u._id === me._id} onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</Button>
      <Button variant="ghost" onClick={() => reset(u)}>Reset password</Button></div>) },
  ];
  return (
    <>
      <PageHeader title="User Management" subtitle="Accounts, roles and access (doctors are added under Doctors)" action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add user</Button>} />
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <Card><DataTable columns={cols} rows={rows} searchKeys={['name', 'email']}
        filters={<select className="input w-44" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>} /></Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add user">
        <form onSubmit={create} className="space-y-4">
          <Field label="Full name" required><input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email" required><input type="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Role" required><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{['reception', 'laboratory', 'pharmacy', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>Create account</Button></div>
        </form>
      </Modal>
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Temporary password">
        <p className="text-sm">Share this with <b>{temp?.name}</b> securely. It is shown only once and must be changed at first login.</p>
        <code className="mt-3 block rounded-lg bg-slate-100 p-3 text-center text-lg">{temp?.pw}</code>
      </Modal>
    </>
  );
}
