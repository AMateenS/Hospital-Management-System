'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_HOME } from '@/lib/nav';
import { Button, Field } from '@/components/ui';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) router.replace(user.mustChangePassword ? '/change-password' : ROLE_HOME[user.role]); }, [user, loading, router]);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const u = await login(form.email, form.password);
      router.replace(u.mustChangePassword ? '/change-password' : ROLE_HOME[u.role]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand-700 to-teal-600 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-bold"><HeartPulse /> City General Hospital</div>
        <div><h1 className="text-4xl font-bold leading-tight">One connected system<br />for every department.</h1>
          <p className="mt-4 max-w-md text-teal-50">Reception, doctors, laboratory and pharmacy working from a single secure patient record.</p></div>
        <p className="text-sm text-teal-100">Authorized personnel only. All access is logged.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl2 bg-white p-8 shadow-card">
          <div><h2 className="text-2xl font-bold">Sign in</h2><p className="text-sm text-slate-500">Use your hospital staff account</p></div>
          {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Field label="Email"><input type="email" required autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><input type="password" required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
      </div>
    </main>
  );
}
