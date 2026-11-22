'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ROLE_HOME } from '@/lib/nav';
import { api } from '@/lib/api';
import { Button, Card, Field, PageHeader } from '@/components/ui';

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (f.newPassword !== f.confirm) return setErr('Passwords do not match');
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      await refresh(); router.replace(ROLE_HOME[user.role]);
    } catch (e2) { setErr(e2.errors?.map((x) => x.message).join(', ') || e2.message); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Change password" subtitle={user.mustChangePassword ? 'You must set a new password before continuing.' : 'Update your account password.'} />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Field label="Current password"><input type="password" required className="input" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><input type="password" required className="input" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
          <p className="-mt-2 text-xs text-slate-500">At least 10 characters with uppercase, lowercase and a number.</p>
          <Field label="Confirm new password"><input type="password" required className="input" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          <Button type="submit" loading={busy} className="w-full">Update password</Button>
        </form>
      </Card>
    </div>
  );
}
