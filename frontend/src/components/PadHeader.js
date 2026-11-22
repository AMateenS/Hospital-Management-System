'use client';
// Prescription-pad header: hospital on the left; doctor's name, qualification, speciality, hours, phone on the right.
export const fmtAvail = (av = []) => {
  const by = {}; av.forEach((a) => { (by[`${a.from}–${a.to}`] ||= []).push(a.day); });
  return Object.entries(by).map(([t, d]) => `${d.join(', ')} ${t}`).join(' · ');
};
export default function PadHeader({ design = {}, hospital = {}, doctor = {}, date }) {
  const c = design.primaryColor || '#0d9488';
  const hours = fmtAvail(doctor.availability);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: c }}>
      <div className="flex items-center gap-3">
        {design.logoUrl ? <img src={design.logoUrl} alt="Hospital logo" className="h-14 w-14 object-contain" /> : <div className="grid h-14 w-14 place-items-center rounded-xl text-2xl font-bold text-white" style={{ background: c }}>+</div>}
        <div><h2 className="text-lg font-bold leading-tight" style={{ color: c }}>{design.headerText || hospital.name || 'Hospital'}</h2>
          {hospital.address && <p className="text-xs text-slate-500">{hospital.address}</p>}{hospital.phone && <p className="text-xs text-slate-500">Tel: {hospital.phone}</p>}</div>
      </div>
      <div className="text-right text-xs text-slate-600">
        <p className="text-sm font-bold text-slate-800">{doctor.name || 'Doctor name'}</p>
        {doctor.qualification && <p>{doctor.qualification}</p>}
        <p>{[doctor.specialization, doctor.department].filter(Boolean).join(' · ')}</p>
        {hours && <p>Timing: {hours}</p>}{doctor.phone && <p>Phone: {doctor.phone}</p>}
        <p>Date: {new Date(date || Date.now()).toLocaleDateString()}</p>
      </div>
    </header>
  );
}
