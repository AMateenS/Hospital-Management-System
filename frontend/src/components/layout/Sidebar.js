'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, X, HeartPulse } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { navFor } from '@/lib/nav';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const path = usePathname();
  const items = navFor(user.role);
  // highlight only the most specific matching item
  const current = items.filter((i) => path === i.href || path.startsWith(i.href + '/')).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden no-print" onClick={onClose} />}
      <aside className={clsx('no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-100 bg-white transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-2 font-bold text-slate-800"><span className="rounded-lg bg-teal-600 p-1.5 text-white"><HeartPulse className="h-5 w-5" /></span>City General</div>
          <button className="lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ label, href, icon: Icon }) => {
            const active = href === current;
            return (
              <Link key={href} href={href} onClick={onClose}
                className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50')}>
                <Icon className="h-5 w-5" />{label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"><LogOut className="h-5 w-5" />Logout</button>
      </aside>
    </>
  );
}
