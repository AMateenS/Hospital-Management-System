'use client';
import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABEL } from '@/lib/nav';

export default function SettingsPage() {
  const { user, doctor } = useAuth();
  const rows = [['Name', user.name], ['Email', user.email], ['Role', ROLE_LABEL[user.role]], ['Phone', user.phone], ['Last sign-in', user.lastLoginAt && new Date(user.lastLoginAt).toLocaleString()], ...(doctor ? [['Specialization', doctor.specialization], ['Department', doctor.department?.name]] : [])];
  return (
    <>
      <PageHeader title="Settings" subtitle="Your account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile"><dl className="grid grid-cols-2 gap-4 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{v || '-'}</dd></div>)}</dl></Card>
        <Card title="Security"><p className="mb-3 text-sm text-slate-600">Use a long password you do not use anywhere else. Changing it signs you out of all other devices.</p>
          <Link href="/change-password" className="inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Change password</Link></Card>
      </div>
    </>
  );
}
