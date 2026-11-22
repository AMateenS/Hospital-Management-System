'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Search, HeartPulse } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABEL } from '@/lib/nav';

export default function Topbar({ onMenu }) {
  const { user } = useAuth();
  const router = useRouter(); const [term, setTerm] = useState('');
  const canSearch = ['admin', 'reception', 'doctor'].includes(user.role);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-100 bg-white/90 px-4 backdrop-blur">
      <button className="lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
      <div className="hidden items-center gap-2 font-semibold text-teal-700 sm:flex"><HeartPulse className="h-5 w-5" />HMS</div>
      <div className="relative ml-2 hidden max-w-md flex-1 md:block">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input className="input pl-9" aria-label="Search patients" placeholder={canSearch ? 'Search patient by ID, name or phone, then press Enter' : 'Search'} disabled={!canSearch} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && term.trim()) router.push(`/patients?q=${encodeURIComponent(term.trim())}`); }} />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="hidden text-sm text-slate-500 lg:block">{today}</span>
        <button className="relative rounded-full p-2 hover:bg-slate-100" aria-label="Notifications"><Bell className="h-5 w-5 text-slate-600" /></button>
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-600 text-sm font-semibold text-white">{initials}</div>
          <div className="hidden leading-tight sm:block"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p></div>
        </div>
      </div>
    </header>
  );
}
