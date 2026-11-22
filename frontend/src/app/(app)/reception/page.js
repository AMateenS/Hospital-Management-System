'use client';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users, Clock, CheckCircle2, Search, Wallet, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, PageHeader, StatCard } from '@/components/ui';
import RegisterModal from '@/components/reception/RegisterModal';
import DoctorCard from '@/components/reception/DoctorCard';
import PatientSearch from '@/components/reception/PatientSearch';
import FeesPanel from '@/components/reception/FeesPanel';
import FeeModal from '@/components/reception/FeeModal';

export default function ReceptionPage() {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const [reg, setReg] = useState(false); const [search, setSearch] = useState(false); const [existing, setExisting] = useState(null);
  const [toast, setToast] = useState(''); const [collect, setCollect] = useState(null); const [tick, setTick] = useState(0);

  const load = useCallback(() => api('/stats/reception').then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]); // keep doctor windows fresh

  const s = data?.stats;
  return (
    <>
      <PageHeader title="Reception Dashboard" subtitle="Register patients and assign them to doctors"
        action={<div className="flex gap-2"><Button variant="outline" onClick={() => setSearch(true)}><Search className="h-4 w-4" />Search existing patient</Button>
          <Button onClick={() => { setExisting(null); setReg(true); }}><UserPlus className="h-4 w-4" />Register patient</Button></div>} />
      {toast && <div role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{toast}</div>}
      {err && <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Registered Today" value={s?.registeredToday} icon={UserPlus} />
        <StatCard label="Waiting" value={s?.waiting} icon={Clock} tone="amber" />
        <StatCard label="In Consultation" value={s?.inConsultation} icon={Users} tone="blue" />
        <StatCard label="Completed" value={s?.completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Unpaid fees (today)" value={s?.unpaidFees} icon={AlertTriangle} tone="red" hint={s ? `${Number(s.unpaidAmount).toLocaleString()} to collect` : undefined} />
        <StatCard label="Fees collected today" value={s && Number(s.collectedToday).toLocaleString()} icon={Wallet} tone="green" />
      </div>
      <div className="mt-6"><FeesPanel refreshKey={tick} onChanged={() => { load(); setTick((n) => n + 1); }} /></div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Doctor windows</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {[...(data?.doctors || [])].sort((a, b) => Number(b.available) - Number(a.available)).map((d) => <DoctorCard key={d.doctorId} doc={d} onChanged={load} onCollect={setCollect} />)}
      </div>
      {collect && <FeeModal row={collect} onClose={() => setCollect(null)} onDone={() => { load(); setTick((n) => n + 1); }} />}
      <RegisterModal open={reg} existing={existing} onClose={() => setReg(false)}
        onSaved={({ patient, visit }) => { setToast(`${patient.name} (${patient.patientId}) assigned - visit ${visit.visitNo}. Fee: ${visit.fee?.status || '-'}`); setTick((n) => n + 1); setTimeout(() => setToast(''), 6000); load(); }} />
      <PatientSearch open={search} onClose={() => setSearch(false)} onNewVisit={(p) => { setExisting(p); setReg(true); }} />
    </>
  );
}
