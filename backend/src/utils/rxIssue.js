const Prescription = require('../models/Prescription');
const Counter = require('../models/Counter');

const { detailsOf } = require('./rxDetails');
exports.detailsOf = detailsOf;

// same medicines (ignoring order/case) => no need for a second prescription
const sig = (a) => JSON.stringify(a.map((i) => [i.name, i.strength, i.dosage, i.frequency, i.duration, i.quantity || '', i.instructions || ''].map((x) => String(x ?? '').trim().toLowerCase())).sort());
const fresh = (items) => items.map((i) => ({ ...i, availability: 'Unknown', dispensedQty: 0 }));

// Create or update the ONE open prescription of a visit.
//  send=false: keep a Draft (or refresh a Pending/Returned one). send=true: release it to the pharmacy as Pending.
//  If the previous prescription was already (partly) dispensed, a send creates a new addendum prescription; a plain save never does.
exports.upsertPrescription = async (visit, { items, details, diagnosis, send }) => {
  const latest = await Prescription.findOne({ visit: visit._id }).sort('-createdAt');
  const open = latest && Prescription.OPEN.includes(latest.status) ? latest : null;
  const apply = async (rx) => {
    rx.items = fresh(items); rx.details = details; rx.diagnosis = diagnosis;
    if (send && rx.status !== 'Pending') { rx.status = 'Pending'; rx.issuedAt = new Date(); }
    if (send) { rx.returnReason = undefined; rx.returnedAt = undefined; }
    await rx.save(); return rx;
  };
  if (open) return apply(open);
  if (latest && send && sig(items) === sig(latest.items)) return latest;     // already issued exactly this
  if (!items.length || (latest && !send)) return latest || null;
  try {
    return await Prescription.create({ rxNo: await Counter.nextId('rx', 'RX-'), visit: visit._id, patient: visit.patient, doctor: visit.doctor,
      items: fresh(items), details, diagnosis, status: send ? 'Pending' : 'Draft', issuedAt: send ? new Date() : undefined });
  } catch (e) {
    if (e.code === 11000) { const again = await Prescription.findOne({ visit: visit._id, isOpen: true }); if (again) return apply(again); }   // lost a race with a double click
    throw e;
  }
};
