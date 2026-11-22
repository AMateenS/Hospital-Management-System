const router = require('express').Router();
const { z } = require('zod');
const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const DispensingRecord = require('../models/DispensingRecord');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { escapeRegex } = require('../utils/helpers');
const { hospital } = require('../utils/hospital');
const { remaining, computeStatus } = require('../utils/rxStatus');
const { requirePermission } = require('../utils/permissions');
const { csv } = require('../utils/csv');
const Counter = require('../models/Counter');
const { netOf, billStatus } = require('../utils/billing');
router.use(protect, authorize('pharmacy'));

const soon = () => new Date(Date.now() + 60 * 864e5);
const SHOWN = { status: { $ne: 'Draft' } };   // drafts are the doctor's private work in progress
const populate = (q) => q.populate('patient', 'patientId name age gender phone').populate('visit', 'visitNo registeredAt').populate({ path: 'doctor', populate: { path: 'user', select: 'name phone' } });

// ---------- Overview ----------
router.get('/overview', asyncHandler(async (req, res) => {
  const now = new Date(); const c = (s) => Prescription.countDocuments({ status: s });
  const [total, pending, partial, dispensed, returned, meds, low, expired, expiring] = await Promise.all([
    Prescription.countDocuments(SHOWN), c('Pending'), c('Partially Dispensed'), c('Dispensed'), c('Returned'),
    Medicine.countDocuments(), Medicine.countDocuments({ $expr: { $lte: ['$quantity', '$minStock'] } }),
    Medicine.countDocuments({ expiryDate: { $lt: now } }), Medicine.countDocuments({ expiryDate: { $gte: now, $lte: soon() } }),
  ]);
  res.json({ totalPrescriptions: total, pending, partial, dispensed, returned, totalMedicines: meds, lowStock: low, expired, expiringSoon: expiring });
}));

// ---------- Prescription list ----------
router.get('/prescriptions', asyncHandler(async (req, res) => {
  const f = { ...SHOWN };
  if (['Pending', 'Partially Dispensed', 'Dispensed', 'Returned'].includes(req.query.status)) f.status = req.query.status;
  res.json(await populate(Prescription.find(f).sort('-createdAt').limit(300)));
}));

// ---------- Prescription detail: exactly what the doctor wrote (read-only) + stock candidates + dispensing history ----------
router.get('/prescriptions/:id', asyncHandler(async (req, res) => {
  const rx = await populate(Prescription.findById(req.params.id));
  if (!rx || rx.status === 'Draft') return res.status(404).json({ message: 'Prescription not found' });
  const now = new Date(); const dispensable = ['Pending', 'Partially Dispensed'].includes(rx.status);
  const items = await Promise.all(rx.items.map(async (it) => {
    let candidates = [];
    if (dispensable && remaining(it) > 0) {
      const r = new RegExp(escapeRegex(it.name), 'i');
      const c = await Medicine.find({ $or: [{ name: r }, { genericName: r }] }).sort('expiryDate').limit(8).lean();
      c.sort((a, b) => (b.strength === it.strength) - (a.strength === it.strength));   // first-expiry-first-out, same strength preferred
      candidates = c.map((m) => ({ _id: m._id, name: m.name, genericName: m.genericName, strength: m.strength, quantity: m.quantity, batchNo: m.batchNo, expiryDate: m.expiryDate, sellingPrice: m.sellingPrice, expired: !!(m.expiryDate && m.expiryDate < now) }));
    }
    return { ...it.toObject(), prescribedQty: it.quantity || 1, remaining: remaining(it), candidates };
  }));
  const records = await DispensingRecord.find({ prescription: rx._id }).sort('dispensedAt').populate('pharmacist', 'name');
  audit(req, 'RX_VIEW', 'Prescription', rx._id);
  res.json({ ...rx.toObject(), items, records });
}));

// ---------- Dispense / mark availability (partial dispensing supported) ----------
const dispenseSchema = z.object({
  lines: z.array(z.object({ itemId: z.string(), action: z.enum(['dispense', 'available', 'unavailable']), medicineId: z.string().optional(), quantity: z.coerce.number().int().min(1).optional() })).min(1),
  payment: z.object({ method: z.enum(['Cash', 'Card', 'Online', 'Unpaid']).default('Cash'), discount: z.coerce.number().min(0).optional() }).optional(),   // Unpaid = pay later
});
router.post('/prescriptions/:id/dispense', requirePermission('dispense'), validate(dispenseSchema), asyncHandler(async (req, res) => {
  const now = new Date();
  // short lock: a double click or retry cannot dispense the same medicine twice
  const locked = await Prescription.findOneAndUpdate({ _id: req.params.id, $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(now - 30000) } }] }, { lockedAt: now });
  if (!locked) { const exists = await Prescription.exists({ _id: req.params.id }); return res.status(exists ? 409 : 404).json({ message: exists ? 'This prescription is being processed. Wait a moment and refresh.' : 'Prescription not found' }); }
  const taken = [];
  try {
    const rx = await Prescription.findById(req.params.id);   // fresh state after the lock
    if (!['Pending', 'Partially Dispensed'].includes(rx.status)) return res.status(409).json({ message: rx.status === 'Dispensed' ? 'Already fully dispensed' : `This prescription is ${rx.status} and cannot be dispensed` });
    const ids = req.body.lines.map((l) => l.itemId); if (new Set(ids).size !== ids.length) return res.status(400).json({ message: 'Each medicine can appear only once per request' });
    const plan = [];
    for (const line of req.body.lines) {
      const item = rx.items.id(line.itemId); if (!item) return res.status(400).json({ message: 'Unknown prescription item' });
      if (line.action === 'unavailable') { plan.push({ item, avail: 'Unavailable' }); continue; }
      if (line.action === 'available') { plan.push({ item, avail: 'Available' }); continue; }
      if (!line.medicineId || !line.quantity) return res.status(400).json({ message: `Choose the stock item and quantity for ${item.name}` });
      if (line.quantity > remaining(item)) return res.status(409).json({ message: `Only ${remaining(item)} of ${item.name} still to dispense (prescribed ${item.quantity || 1}, already given ${item.dispensedQty || 0})` });
      const med = await Medicine.findById(line.medicineId); if (!med) return res.status(400).json({ message: `Medicine not found for ${item.name}` });
      if (med.expiryDate && med.expiryDate < now) return res.status(409).json({ message: `${med.name} (batch ${med.batchNo || '-'}) is expired and cannot be dispensed` });
      plan.push({ item, med, qty: line.quantity, avail: 'Available' });
    }
    const give = plan.filter((p) => p.med);
    try {
      for (const p of give) {   // atomic, never negative; undone if anything below fails
        const ok = await Medicine.findOneAndUpdate({ _id: p.med._id, quantity: { $gte: p.qty } }, { $inc: { quantity: -p.qty } });
        if (!ok) { await undo(taken); return res.status(409).json({ message: `Insufficient stock for ${p.med.name} ${p.med.strength || ''}`.trim() }); }
        taken.push(p);
      }
      let record = null, total = 0;
      for (const p of plan) { p.item.availability = p.avail; if (p.med) { p.item.dispensedQty = (p.item.dispensedQty || 0) + p.qty; p.item.medicine = p.med._id; p.item.batchNo = p.med.batchNo; p.item.unitPrice = p.med.sellingPrice || 0; total += p.qty * (p.med.sellingPrice || 0); } }
      const money = netOf(total, req.body.payment?.discount); const method = req.body.payment?.method || 'Cash'; const paid = method !== 'Unpaid';
      if (give.length) record = await DispensingRecord.create({ prescription: rx._id, visit: rx.visit, patient: rx.patient, pharmacist: req.user._id, billNo: await Counter.nextId('bill', 'BILL-'),
        subtotal: money.gross, discount: money.discount, total: money.net, paid, paymentMethod: paid ? method : undefined, paidAt: paid ? now : undefined,
        lines: give.map((p) => ({ itemId: p.item._id, name: p.item.name, strength: p.item.strength, medicine: p.med._id, batchNo: p.med.batchNo, quantity: p.qty, unitPrice: p.med.sellingPrice || 0, lineTotal: p.qty * (p.med.sellingPrice || 0) })) });
      rx.status = computeStatus(rx.items); rx.totalAmount = (rx.totalAmount || 0) + money.net;
      if (give.length) { rx.dispensedBy = req.user._id; rx.dispensedAt = now; }
      await rx.save();
      audit(req, 'RX_DISPENSE', 'Prescription', rx._id, { status: rx.status, total, lines: plan.length });
      return res.json({ prescription: await populate(Prescription.findById(rx._id)), record });
    } catch (e) { await undo(taken); throw e; }
  } finally { await Prescription.updateOne({ _id: req.params.id }, { $unset: { lockedAt: 1 } }); }
}));
async function undo(taken) { for (const p of taken.splice(0)) await Medicine.findByIdAndUpdate(p.med._id, { $inc: { quantity: p.qty } }); }

// ---------- Return to doctor (pharmacy never edits the prescription) ----------
router.post('/prescriptions/:id/return', requirePermission('return_to_doctor'), validate(z.object({ reason: z.string().trim().min(5, 'Explain what the doctor must correct (min 5 characters)').max(500) })), asyncHandler(async (req, res) => {
  const rx = await Prescription.findOneAndUpdate({ _id: req.params.id, status: 'Pending' },
    { status: 'Returned', isOpen: true, returnReason: req.body.reason, returnedBy: req.user._id, returnedAt: new Date() }, { new: true });
  if (!rx) return res.status(409).json({ message: 'Only a prescription with nothing dispensed yet can be returned to the doctor' });
  audit(req, 'RX_RETURN', 'Prescription', rx._id, { reason: req.body.reason }); res.json(await populate(Prescription.findById(rx._id)));
}));

// ---------- Dispensing receipt: every dispensing event of the prescription (or one with ?record=) ----------
router.get('/prescriptions/:id/receipt', requirePermission('receipts'), asyncHandler(async (req, res) => {
  const rx = await populate(Prescription.findById(req.params.id));
  if (!rx || rx.status === 'Draft') return res.status(404).json({ message: 'Prescription not found' });
  const q = { prescription: rx._id }; if (req.query.record) q._id = req.query.record;
  const records = await DispensingRecord.find(q).sort('dispensedAt').populate('pharmacist', 'name');
  if (!records.length) return res.status(409).json({ message: 'Nothing has been dispensed yet' });
  const last = records[records.length - 1];
  audit(req, 'RX_RECEIPT_VIEW', 'Prescription', rx._id);
  const money = (n) => Math.round((n || 0) * 100) / 100;
  res.json({ hospital: hospital(), rxNo: rx.rxNo, status: rx.status, visit: rx.visit?._id, visitNo: rx.visit?.visitNo, dispensedAt: last.dispensedAt, dispensedBy: last.pharmacist?.name, patient: rx.patient, doctor: rx.doctor?.user?.name,
    billNos: records.map((r) => r.billNo).filter(Boolean), paymentStatus: billStatus(records), amountDue: money(records.filter((r) => r.paid === false).reduce((s, r) => s + (r.total || 0), 0)),
    bills: records.map((r) => ({ _id: r._id, billNo: r.billNo, at: r.dispensedAt, by: r.pharmacist?.name, subtotal: r.subtotal ?? r.total, discount: r.discount || 0, total: r.total, paid: r.paid !== false, method: r.paymentMethod, paidAt: r.paidAt })),
    lines: records.flatMap((r) => r.lines.map((l) => ({ name: l.name, strength: l.strength, batchNo: l.batchNo, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, at: r.dispensedAt }))),
    notDispensed: rx.items.filter((i) => i.availability === 'Unavailable' || remaining(i) > 0).map((i) => `${i.name} ${i.strength || ''}`.trim() + (i.availability === 'Unavailable' ? ' (unavailable)' : ` (${remaining(i)} still to dispense)`)),
    subtotal: money(records.reduce((s, r) => s + (r.subtotal ?? r.total ?? 0), 0)), discount: money(records.reduce((s, r) => s + (r.discount || 0), 0)), total: money(records.reduce((s, r) => s + (r.total || 0), 0)) });
}));

// ---------- Dispensing records: which patient received which medicines, how many, when, by whom ----------
async function loadRecords(q) {
  const f = {}; const from = q.from ? new Date(q.from) : null; const to = q.to ? new Date(q.to) : null;
  if (from && !Number.isNaN(from.getTime())) f.dispensedAt = { $gte: from };
  if (to && !Number.isNaN(to.getTime())) { to.setDate(to.getDate() + 1); f.dispensedAt = { ...(f.dispensedAt || {}), $lt: to }; }
  const recs = await DispensingRecord.find(f).sort('-dispensedAt').limit(1000).populate('patient', 'patientId name').populate('pharmacist', 'name').populate('visit', 'visitNo')
    .populate({ path: 'prescription', select: 'rxNo doctor', populate: { path: 'doctor', populate: { path: 'user', select: 'name' } } });
  let rows = recs.map((r) => ({ _id: r._id, at: r.dispensedAt, patient: r.patient?.name, patientId: r.patient?.patientId, rxId: r.prescription?._id, rxNo: r.prescription?.rxNo, visitNo: r.visit?.visitNo,
    doctor: r.prescription?.doctor?.user?.name, pharmacist: r.pharmacist?.name, total: r.total || 0, billNo: r.billNo, paid: r.paid !== false, paymentMethod: r.paymentMethod, discount: r.discount || 0,
    lines: r.lines.map((l) => ({ name: l.name, strength: l.strength, batchNo: l.batchNo, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })) }));
  const term = String(q.q || '').trim().toLowerCase();
  if (term) rows = rows.filter((r) => [r.patient, r.patientId, r.rxNo, r.visitNo, r.doctor, r.pharmacist, ...r.lines.map((l) => `${l.name} ${l.strength || ''}`)].some((x) => String(x || '').toLowerCase().includes(term)));
  return rows;
}
router.get('/dispensing', requirePermission('receipts'), asyncHandler(async (req, res) => {
  const rows = await loadRecords(req.query);
  const meds = {}; for (const r of rows) for (const l of r.lines) { const k = `${l.name} ${l.strength || ''}`.trim(); meds[k] = meds[k] || { name: k, quantity: 0, amount: 0 }; meds[k].quantity += l.quantity || 0; meds[k].amount += l.lineTotal || 0; }
  res.json({ rows, summary: { records: rows.length, patients: new Set(rows.map((r) => r.patientId)).size, total: rows.reduce((s, r) => s + r.total, 0), unpaid: rows.filter((r) => !r.paid).reduce((s, r) => s + r.total, 0), medicines: Object.values(meds).sort((a, b) => b.quantity - a.quantity) } });
}));
router.get('/dispensing/export', requirePermission('receipts'), asyncHandler(async (req, res) => {
  const rows = await loadRecords(req.query); const dt = (d) => new Date(d).toLocaleString('en-GB');
  const out = csv(['Date', 'Rx', 'Visit', 'Patient ID', 'Patient', 'Doctor', 'Medicine', 'Batch', 'Quantity', 'Unit price', 'Amount', 'Bill', 'Payment', 'Pharmacist'],
    rows.flatMap((r) => r.lines.map((l) => [dt(r.at), r.rxNo, r.visitNo, r.patientId, r.patient, r.doctor, `${l.name} ${l.strength || ''}`.trim(), l.batchNo, l.quantity, l.unitPrice, l.lineTotal, r.billNo, r.paid ? (r.paymentMethod || 'Paid') : 'Unpaid', r.pharmacist])));
  audit(req, 'DISPENSING_EXPORT', 'Report', 'dispensing');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="dispensing-records.csv"' }).send('\uFEFF' + out);
}));

// A bill dispensed on credit ("Pay later") is settled here
router.patch('/dispensing/:id/pay', requirePermission('dispense'), validate(z.object({ method: z.enum(['Cash', 'Card', 'Online']) })), asyncHandler(async (req, res) => {
  const r = await DispensingRecord.findOneAndUpdate({ _id: req.params.id, paid: false }, { paid: true, paymentMethod: req.body.method, paidAt: new Date() }, { new: true });
  if (!r) return res.status(409).json({ message: 'This bill is already paid, or does not exist' });
  audit(req, 'BILL_PAID', 'DispensingRecord', r._id, { billNo: r.billNo, method: req.body.method }); res.json({ _id: r._id, billNo: r.billNo, paid: true, paymentMethod: r.paymentMethod });
}));

// ---------- Inventory ----------
const med = z.object({
  name: z.string().min(1), genericName: z.string().optional(), category: z.string().optional(), strength: z.string().optional(), manufacturer: z.string().optional(),
  batchNo: z.string().optional(), expiryDate: z.string().min(1, 'Expiry date required'),
  purchasePrice: z.coerce.number().min(0), sellingPrice: z.coerce.number().min(0), quantity: z.coerce.number().int().min(0), minStock: z.coerce.number().int().min(0).default(10),
});
router.get('/medicines', asyncHandler(async (req, res) => {
  const f = {}; const now = new Date();
  if (req.query.q) { const r = new RegExp(escapeRegex(String(req.query.q)), 'i'); f.$or = [{ name: r }, { genericName: r }, { batchNo: r }, { category: r }]; }
  if (req.query.filter === 'low') f.$expr = { $lte: ['$quantity', '$minStock'] };
  if (req.query.filter === 'expired') f.expiryDate = { $lt: now };
  if (req.query.filter === 'expiring') f.expiryDate = { $gte: now, $lte: soon() };
  res.json(await Medicine.find(f).sort('name').limit(500));
}));
router.post('/medicines', requirePermission('inventory'), validate(med), asyncHandler(async (req, res) => { const m = await Medicine.create(req.body); audit(req, 'MEDICINE_ADD', 'Medicine', m._id); res.status(201).json(m); }));
router.put('/medicines/:id', requirePermission('inventory'), validate(med), asyncHandler(async (req, res) => {
  const m = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!m) return res.status(404).json({ message: 'Medicine not found' }); audit(req, 'MEDICINE_EDIT', 'Medicine', m._id); res.json(m);
}));
router.delete('/medicines/:id', requirePermission('inventory'), asyncHandler(async (req, res) => {
  const m = await Medicine.findByIdAndDelete(req.params.id);
  if (!m) return res.status(404).json({ message: 'Medicine not found' }); audit(req, 'MEDICINE_DELETE', 'Medicine', m._id, { name: m.name }); res.json({ message: 'Deleted' });
}));
module.exports = router;
