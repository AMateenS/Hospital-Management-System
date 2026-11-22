'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card } from '@/components/ui';

// Doctor dashboard widgets: availability check-in, signature upload, and the doctor's own prescription template.
export default function DoctorTools() {
  const [me, setMe] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/doctor/me').then(setMe).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function toggle(v) { setErr(''); setBusy(true); try { await api('/doctor/availability', { method: 'PATCH', body: { available: v } }); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }
  async function upload(e) {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return; setErr(''); setBusy(true);
    const fd = new FormData(); fd.append('file', file);
    try { const res = await fetch('/api/assets/signature', { method: 'POST', body: fd, credentials: 'include' }); const j = await res.json(); if (!res.ok) throw new Error(j.message); await load(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const removeSig = async () => { if (confirm('Remove your signature from future prescriptions?')) { try { await api('/assets/signature', { method: 'DELETE' }); await load(); } catch (e) { setErr(e.message); } } };
  if (!me) return err ? <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div> : null;

  return (
    <div className="mt-6 space-y-6">
      {err && <div role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Availability">
          <label className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 ${me.available ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}>
            <input type="checkbox" className="h-6 w-6 accent-emerald-600" checked={me.available} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
            <span><b className="block">{me.available ? 'You are marked available' : 'I have arrived - mark me available'}</b>
              <span className="text-sm text-slate-500">{me.available ? `Reception sees you as available${me.availableSince ? ` (since ${new Date(me.availableSince).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}. Untick when you leave.` : 'Tick this when you start your shift so reception knows you are in.'}</span></span>
          </label>
          <p className="mt-2 text-xs text-slate-400">Resets automatically at midnight and when you log out.</p>
        </Card>
        <Card title="My signature">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-20 w-44 place-items-center rounded-lg border border-dashed border-slate-300 bg-white">{me.doctor.signatureUrl ? <img src={me.doctor.signatureUrl} alt="Your signature" className="max-h-16 max-w-40 object-contain" /> : <span className="text-xs text-slate-400">No signature yet</span>}</div>
            <div className="space-y-2 text-sm"><label className="inline-flex cursor-pointer rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50">{busy ? 'Working...' : 'Upload signature'}<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={upload} /></label>
              {me.doctor.signatureUrl && <button className="ml-2 text-xs text-red-600 underline" onClick={removeSig}>Remove</button>}
              <p className="text-xs text-slate-400">PNG or JPG, max 500 KB. Sign on white paper, photograph, and crop.</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
