'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Button, Card, DataTable, Field, Modal, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import DepartmentsModal from '@/components/admin/DepartmentsModal';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const blank = { name: '', email: '', phone: '', specialization: '', qualification: '', experienceYears: '', departmentId: '', contact: '', consultationFee: '', profilePicture: '', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], from: '09:00', to: '14:00' };

export default function DoctorsPage() {
  const { user } = useAuth(); const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState([]); const [depts, setDepts] = useState([]); const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); const [f, setF] = useState(blank); const [temp, setTemp] = useState(null); const [busy, setBusy] = useState(false);
  const [mgOpen, setMgOpen] = useState(false); const [dOpen, setDOpen] = useState(false); const [dn, setDn] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    try { const [d, dp] = await Promise.all([isAdmin ? api('/admin/doctors') : api('/doctors'), api('/departments')]); setRows(d); setDepts(dp); } catch (e) { setErr(e.message); }
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setF(blank); setEdit('new'); setErr(''); };
  const openEdit = (d) => { setF({ name: d.user.name, email: d.user.email, phone: d.user.phone || '', specialization: d.specialization, qualification: d.qualification || '', experienceYears: d.experienceYears ?? '', departmentId: d.department?._id || '', contact: d.contact || '', consultationFee: d.consultationFee ?? '', profilePicture: d.profilePicture || '',
    days: d.availability.map((a) => a.day), from: d.availability[0]?.from || '09:00', to: d.availability[0]?.to || '14:00' }); setEdit(d); setErr(''); };

  async function save(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    const body = { specialization: f.specialization, qualification: f.qualification, experienceYears: f.experienceYears, departmentId: f.departmentId, contact: f.contact, consultationFee: f.consultationFee || 0, profilePicture: f.profilePicture,
      availability: f.days.map((day) => ({ day, from: f.from, to: f.to })), name: f.name, phone: f.phone };
    try {
      if (edit === 'new') { const r = await api('/admin/doctors', { method: 'POST', body: { ...body, email: f.email } }); setTemp({ name: f.name, pw: r.tempPassword }); }
      else await api(`/admin/doctors/${edit._id}`, { method: 'PATCH', body });
      setEdit(null); load();
    } catch (x) { setErr(x.errors?.map((i) => `${i.field}: ${i.message}`).join('; ') || x.message); } finally { setBusy(false); }
  }
  const remove = async (d) => { if (confirm(`Deactivate ${d.user.name}? Their clinical records are preserved.`)) { try { await api(`/admin/doctors/${d._id}`, { method: 'DELETE' }); load(); } catch (e) { setErr(e.message); } } };
  async function addDept(e) { e.preventDefault(); try { await api('/admin/departments', { method: 'POST', body: { name: dn } }); setDn(''); setDOpen(false); load(); } catch (x) { setErr(x.message); } }

  const cols = [
    { key: 'n', header: 'Doctor', render: (d) => <div className="flex items-center gap-3">{d.profilePicture ? <img src={d.profilePicture} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 text-xs font-semibold text-white">{d.user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>}<div><p className="font-medium">{d.user.name}</p><p className="text-xs text-slate-500">{d.qualification}</p></div></div> },
    { key: 'specialization', header: 'Specialization' }, { key: 'today', header: 'Today', render: (d) => (d.available ? <Badge tone="bg-emerald-50 text-emerald-700">Available</Badge> : <Badge>Not available</Badge>) }, { key: 'dep', header: 'Department', render: (d) => d.department?.name },
    { key: 'exp', header: 'Experience', render: (d) => (d.experienceYears != null ? `${d.experienceYears} yrs` : '-') }, { key: 'fee', header: 'Fee', render: (d) => d.consultationFee },
    { key: 'av', header: 'Availability', render: (d) => (d.availability?.length ? `${d.availability.map((a) => a.day).join(', ')} ${d.availability[0].from}-${d.availability[0].to}` : '-') },
    ...(isAdmin ? [{ key: 'st', header: 'Status', render: (d) => <Badge>{d.user.active ? 'Active' : 'Inactive'}</Badge> },
      { key: 'a', header: '', render: (d) => <div className="flex gap-2"><Button variant="outline" onClick={() => openEdit(d)}>Edit</Button>
        <Link href={`/admin/templates?doctor=${d._id}`} className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-teal-600 hover:bg-teal-50">Template</Link>
        {d.user.active && <Button variant="ghost" onClick={() => remove(d)}>Remove</Button>}</div> }] : []),
  ];
  return (
    <>
      <PageHeader title="Doctors" subtitle={isAdmin ? 'Doctor profiles, departments and availability' : 'Hospital doctors'}
        action={isAdmin && <div className="flex gap-2"><Button variant="outline" onClick={() => setMgOpen(true)}>Manage departments</Button><Button variant="outline" onClick={() => setDOpen(true)}>Add department</Button><Button onClick={openNew}><Plus className="h-4 w-4" />Add doctor</Button></div>} />
      {err && !edit && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <Card><DataTable columns={cols} rows={rows} searchKeys={['specialization']} /></Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit === 'new' ? 'Add doctor' : 'Edit doctor'}>
        <form onSubmit={save} className="space-y-4">
          {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Doctor name" required><input required className="input" value={f.name} onChange={set('name')} /></Field>
            <Field label="Login email" required><input type="email" required disabled={edit !== 'new'} className="input" value={f.email} onChange={set('email')} /></Field>
            <Field label="Specialization" required><input required className="input" value={f.specialization} onChange={set('specialization')} /></Field>
            <Field label="Department" required><select required className="input" value={f.departmentId} onChange={set('departmentId')}><option value="">Select</option>{depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></Field>
            <Field label="Qualification"><input className="input" value={f.qualification} onChange={set('qualification')} placeholder="MBBS, FCPS" /></Field>
            <Field label="Experience (years)"><input type="number" min="0" className="input" value={f.experienceYears} onChange={set('experienceYears')} /></Field>
            <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Contact details"><input className="input" value={f.contact} onChange={set('contact')} /></Field>
            <Field label="Consultation fee"><input type="number" min="0" className="input" value={f.consultationFee} onChange={set('consultationFee')} /></Field>
            <Field label="Profile picture URL"><input type="url" className="input" value={f.profilePicture} onChange={set('profilePicture')} placeholder="https://..." /></Field>
          </div>
          <div><p className="label">Availability</p>
            <div className="flex flex-wrap items-center gap-2">{DAYS.map((d) => <button type="button" key={d} onClick={() => setF((p) => ({ ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] }))} className={`rounded-full border px-3 py-1 text-sm ${f.days.includes(d) ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-300 text-slate-500'}`}>{d}</button>)}
              <input type="time" className="input w-28" value={f.from} onChange={set('from')} /><span>to</span><input type="time" className="input w-28" value={f.to} onChange={set('to')} /></div></div>
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" loading={busy}>Save doctor</Button></div>
        </form>
      </Modal>
      {mgOpen && <DepartmentsModal onClose={() => { setMgOpen(false); load(); }} />}
      <Modal open={dOpen} onClose={() => setDOpen(false)} title="Add department"><form onSubmit={addDept} className="space-y-4"><Field label="Department name" required><input required className="input" value={dn} onChange={(e) => setDn(e.target.value)} /></Field><div className="flex justify-end"><Button type="submit">Add</Button></div></form></Modal>
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Doctor account created"><p className="text-sm">Temporary password for <b>{temp?.name}</b> (shown once, must be changed at first login):</p><code className="mt-3 block rounded-lg bg-slate-100 p-3 text-center text-lg">{temp?.pw}</code></Modal>
    </>
  );
}
