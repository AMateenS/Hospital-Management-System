'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, Field, Modal } from '@/components/ui';
import { useToast } from '@/context/ToastContext';

const PERMS = { dispense: 'Dispense medicines', inventory: 'Manage medicine inventory', return_to_doctor: 'Return prescriptions to doctors', receipts: 'View dispensing receipts' };
const blank = { name: '', email: '', phone: '', licenseNo: '', employeeId: '', permissions: Object.keys(PERMS), password: '' };

// Admin only (the API enforces it too): add, view, edit, search, deactivate, reset password, delete pharmacists.
export default function PharmacistsTab() {
  const toast = useToast();
  const [rows, setRows] = useState(null); const [status, setStatus] = useState(''); const [loadErr, setLoadErr] = useState('');
  const [form, setForm] = useState(null); const [fErr, setFErr] = useState({}); const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null); const [temp, setTemp] = useState(null);
  const load = useCallback(() => api('/pharmacists', { query: { status } }).then((r) => { setRows(r); setLoadErr(''); }).catch((e) => setLoadErr(e.message)), [status]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const togglePerm = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));

  function validate(f) {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
    if (f.phone && !/^[0-9+\-\s]{7,16}$/.test(f.phone)) e.phone = 'Invalid phone number';
    if (!f.id && f.password && (f.password.length < 10 || !/[A-Z]/.test(f.password) || !/[a-z]/.test(f.password) || !/[0-9]/.test(f.password))) e.password = 'At least 10 characters with upper case, lower case and a number (or leave blank to generate one)';
    return e;
  }
  async function save(ev) {
    ev.preventDefault(); const e = validate(form); setFErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const { id, password, ...body } = form;
    try {
      if (id) { await api(`/pharmacists/${id}`, { method: 'PUT', body }); toast.success('Pharmacist updated'); }
      else { const r = await api('/pharmacists', { method: 'POST', body: { ...body, ...(password ? { password } : {}) } }); toast.success('Pharmacist account created'); setTemp({ name: r.pharmacist.name, pw: r.tempPassword }); }
      setForm(null); load();
    } catch (x) { if (x.errors) setFErr(Object.fromEntries(x.errors.map((i) => [i.field, i.message]))); toast.error(x.errors?.[0]?.message || x.message); } finally { setBusy(false); }
  }
  const openEdit = (u) => { setFErr({}); setForm({ id: u._id, name: u.name, email: u.email, phone: u.phone || '', licenseNo: u.licenseNo || '', employeeId: u.employeeId || '', permissions: u.permissions || Object.keys(PERMS), password: '' }); };
  const openView = async (u) => { try { setView(await api(`/pharmacists/${u._id}`)); } catch (x) { toast.error(x.message); } };
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load(); } catch (x) { toast.error(x.message); } };
  const toggle = (u) => { if (!u.active && !confirm(`Re-activate ${u.name}?`)) return; if (u.active && !confirm(`Deactivate ${u.name}? They will no longer be able to sign in. Their dispensing history is kept.`)) return;
    act(() => api(`/pharmacists/${u._id}/active`, { method: 'PATCH', body: { active: !u.active } }), u.active ? 'Pharmacist deactivated' : 'Pharmacist re-activated'); };
  const reset = async (u) => { if (!confirm(`Reset password for ${u.name}? Their current sessions will be signed out.`)) return; try { const r = await api(`/pharmacists/${u._id}/reset-password`, { method: 'POST' }); setTemp({ name: u.name, pw: r.tempPassword }); } catch (x) { toast.error(x.message); } };
  const del = (u) => { if (confirm(`Permanently delete ${u.name}? This cannot be undone. (Pharmacists with dispensing history cannot be deleted; deactivate them instead.)`)) act(() => api(`/pharmacists/${u._id}`, { method: 'DELETE' }), 'Pharmacist deleted'); };

  const cols = [
    { key: 'name', header: 'Pharmacist', render: (u) => <div><p className="font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></div> },
    { key: 'phone', header: 'Phone' }, { key: 'licenseNo', header: 'License no.' }, { key: 'employeeId', header: 'Employee ID' },
    { key: 'perm', header: 'Permissions', render: (u) => (!u.permissions ? 'Full' : `${u.permissions.length} of ${Object.keys(PERMS).length}`) },
    { key: 'st', header: 'Status', render: (u) => <Badge>{u.active ? 'Active' : 'Inactive'}</Badge> }, { key: 'rec', header: 'Dispensings', render: (u) => u.stats?.records ?? 0 },
    { key: 'a', header: '', render: (u) => (<div className="flex flex-wrap gap-1"><Button variant="outline" onClick={() => openView(u)}>View</Button><Button variant="outline" onClick={() => openEdit(u)}>Edit</Button>
      <Button variant="ghost" onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</Button><Button variant="ghost" onClick={() => reset(u)}>Reset password</Button><Button variant="ghost" className="text-red-600" onClick={() => del(u)}>Delete</Button></div>) },
  ];
  const err = (k) => fErr[k] && <span className="text-xs text-red-600">{fErr[k]}</span>;
  return (
    <Card title="Pharmacist management" action={<Button onClick={() => { setFErr({}); setForm(blank); }}><Plus className="h-4 w-4" />Add pharmacist</Button>}>
      {loadErr && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</div>}
      {rows === null ? <p className="py-8 text-center text-sm text-slate-400">Loading pharmacists...</p> : (
        <DataTable columns={cols} rows={rows} searchKeys={['name', 'email', 'phone', 'licenseNo', 'employeeId']} empty="No pharmacists yet. Use Add pharmacist."
          filters={<select className="input w-40" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>} />)}

      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.id ? 'Edit pharmacist' : 'Add pharmacist'}>
        {form && (<form onSubmit={save} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required><input className="input" value={form.name} onChange={set('name')} />{err('name')}</Field>
            <Field label="Email (login)" required><input type="email" className="input" value={form.email} onChange={set('email')} />{err('email')}</Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} />{err('phone')}</Field>
            <Field label="License number"><input className="input" value={form.licenseNo} onChange={set('licenseNo')} /></Field>
            <Field label="Employee ID"><input className="input" value={form.employeeId} onChange={set('employeeId')} /></Field>
            {!form.id && <Field label="Initial password (optional)"><input type="text" autoComplete="off" className="input" value={form.password} onChange={set('password')} placeholder="Leave blank to generate" />{err('password')}</Field>}
          </div>
          <div><p className="label">Permissions</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(PERMS).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.includes(k)} onChange={() => togglePerm(k)} />{l}</label>)}</div>
            <p className="mt-1 text-xs text-slate-400">All pharmacists can view prescriptions and the inventory. Uncheck a permission to restrict the account.</p></div>
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" loading={busy}>{form.id ? 'Save changes' : 'Create account'}</Button></div>
        </form>)}
      </Modal>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name || ''}>
        {view && (<div className="space-y-4 text-sm"><div className="grid grid-cols-2 gap-3">{[['Email', view.email], ['Phone', view.phone], ['License no.', view.licenseNo], ['Employee ID', view.employeeId], ['Status', view.active ? 'Active' : 'Inactive'], ['Last sign-in', view.lastLoginAt && new Date(view.lastLoginAt).toLocaleString()], ['Permissions', view.permissions ? view.permissions.map((p) => PERMS[p]).join(', ') || 'View only' : 'Full'], ['Dispensing records', view.stats?.records]].map(([k, v]) => <div key={k}><p className="label">{k}</p>{v ?? '-'}</div>)}</div>
          <div><p className="label">Recent dispensing</p>{view.recent?.length ? <ul className="divide-y divide-slate-100">{view.recent.map((r) => <li key={r._id} className="flex justify-between py-1.5"><span>{r.rxNo} · {r.patient} ({r.patientId})</span><span>{new Date(r.at).toLocaleString()} · {r.total?.toFixed(2)}</span></li>)}</ul> : <p className="text-slate-400">Nothing dispensed yet.</p>}</div></div>)}
      </Modal>
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Temporary password">
        <p className="text-sm">Give this to <b>{temp?.name}</b> securely. It is shown only once and must be changed at first login.</p>
        <code className="mt-3 block rounded-lg bg-slate-100 p-3 text-center text-lg">{temp?.pw}</code>
      </Modal>
    </Card>
  );
}
