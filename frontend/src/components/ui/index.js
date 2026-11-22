'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { X, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function Button({ variant = 'primary', loading, className, children, ...p }) {
  const styles = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700',
    blue: 'bg-brand-500 text-white hover:bg-brand-600',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button disabled={loading || p.disabled} {...p}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60', styles[variant], className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}

export function Card({ title, action, className, children }) {
  return (
    <section className={clsx('rounded-xl2 border border-slate-100 bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-800">{title}</h3>{action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'teal', hint }) {
  const tones = { teal: 'bg-teal-50 text-teal-600', blue: 'bg-brand-50 text-brand-500', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600' };
  return (
    <div className="flex items-center gap-4 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
      {Icon && <div className={clsx('rounded-xl p-3', tones[tone])}><Icon className="h-6 w-6" /></div>}
      <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-800">{value ?? '-'}</p>{hint && <p className="text-xs text-slate-400">{hint}</p>}</div>
    </div>
  );
}

const BADGE = {
  Waiting: 'bg-amber-50 text-amber-700', 'In Consultation': 'bg-blue-50 text-blue-700', Completed: 'bg-emerald-50 text-emerald-700',
  Referred: 'bg-purple-50 text-purple-700', Cancelled: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-50 text-amber-700', Accepted: 'bg-blue-50 text-blue-700', 'Sample Collected': 'bg-indigo-50 text-indigo-700', 'In Progress': 'bg-sky-50 text-sky-700', Dispensed: 'bg-emerald-50 text-emerald-700',
  Processing: 'bg-sky-50 text-sky-700', 'Partially Dispensed': 'bg-orange-50 text-orange-700', Returned: 'bg-red-50 text-red-700', Draft: 'bg-slate-100 text-slate-600',
  Routine: 'bg-slate-100 text-slate-600', Urgent: 'bg-amber-100 text-amber-800', Emergency: 'bg-red-100 text-red-700',
  Paid: 'bg-emerald-50 text-emerald-700', Unpaid: 'bg-amber-100 text-amber-800', Waived: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-50 text-emerald-700', Inactive: 'bg-slate-100 text-slate-600',
};
export const Badge = ({ children, tone }) => <span className={clsx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', tone || BADGE[children] || 'bg-slate-100 text-slate-600')}>{children}</span>;

export function Field({ label, error, required, children }) {
  return (
    <label className="block"><span className="label">{label}{required && <span className="text-red-500"> *</span>}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose?.(); if (open) window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} className={clsx('max-h-[90vh] w-full overflow-auto rounded-xl2 bg-white shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <header className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-semibold">{title}</h3><button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-slate-400" /></button></header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Searchable, paginated table. columns: [{ key, header, render?(row) }]
export function DataTable({ columns, rows = [], pageSize = 8, searchKeys = [], empty = 'No records found', filters }) {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const filtered = q ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q.toLowerCase()))) : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * pageSize, cur * pageSize);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {searchKeys.length > 0 && (
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        )}
        {filters}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-semibold">{c.header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {slice.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">{empty}</td></tr>
              : slice.map((r, i) => <tr key={r._id || i} className="hover:bg-slate-50">{columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length} record{filtered.length !== 1 && 's'}</span>
        <div className="flex items-center gap-2">
          <button className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={cur === 1} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></button>
          <span>Page {cur} / {pages}</span>
          <button className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={cur === pages} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-800">{title}</h1>{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}</div>{action}</div>
);
