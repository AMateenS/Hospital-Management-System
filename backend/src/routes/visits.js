const router = require('express').Router();
const { z } = require('zod');
const Visit = require('../models/Visit');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { todayRange } = require('../utils/helpers');
const { doctorOf } = require('../utils/doctorScope');
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Counter = require('../models/Counter');
const { netOf } = require('../utils/billing');
const { hospital } = require('../utils/hospital');
router.use(protect, authorize('reception', 'doctor'));

const STATUSES = ['Waiting', 'In Consultation', 'Completed', 'Referred', 'Cancelled'];

// ---------- Consultation fees (reception): who has paid, who has not ----------
const feeRow = (v) => ({ _id: v._id, visitNo: v.visitNo, registeredAt: v.registeredAt, visitStatus: v.status, patient: v.patient?.name, patientId: v.patient?.patientId, phone: v.patient?.phone, doctor: v.doctor?.user?.name,
  fee: { status: v.fee?.status || 'Unpaid', amount: v.fee?.amount || 0, discount: v.fee?.discount || 0, net: netOf(v.fee?.amount, v.fee?.discount).net, method: v.fee?.method, paidAt: v.fee?.paidAt, receiptNo: v.fee?.receiptNo, receivedBy: v.fee?.receivedBy?.name, note: v.fee?.note } });
router.get('/fees', authorize('reception'), asyncHandler(async (req, res) => {
  const f = {}; const from = req.query.from ? new Date(req.query.from) : null; const to = req.query.to ? new Date(req.query.to) : null;
  if (from && !Number.isNaN(from.getTime())) { from.setHours(0, 0, 0, 0); const end = to && !Number.isNaN(to.getTime()) ? new Date(to) : new Date(from); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1); f.registeredAt = { $gte: from, $lt: end }; }
  else f.registeredAt = todayRange();
  if (['Unpaid', 'Paid', 'Waived'].includes(req.query.status)) f['fee.status'] = req.query.status;
  const visits = await Visit.find(f).sort('-registeredAt').limit(500).populate('patient', 'patientId name phone').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }).populate('fee.receivedBy', 'name');
  let rows = visits.map(feeRow); const term = String(req.query.q || '').trim().toLowerCase();
  if (term) rows = rows.filter((r) => [r.patient, r.patientId, r.phone, r.doctor, r.visitNo, r.fee.receiptNo].some((x) => String(x || '').toLowerCase().includes(term)));
  const of = (st) => rows.filter((r) => r.fee.status === st && r.visitStatus !== 'Cancelled');
  res.json({ rows, summary: { unpaidCount: of('Unpaid').length, unpaidAmount: of('Unpaid').reduce((a, r) => a + r.fee.amount, 0), paidCount: of('Paid').length, collected: of('Paid').reduce((a, r) => a + r.fee.net, 0), waivedCount: of('Waived').length } });
}));

const feeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pay'), method: z.enum(['Cash', 'Card', 'Online']), discount: z.coerce.number().min(0).optional(), note: z.string().max(200).optional() }),
  z.object({ action: z.literal('waive'), note: z.string().trim().min(3, 'Give a reason for waiving the fee').max(200) }),
  z.object({ action: z.literal('reset'), note: z.string().trim().min(5, 'Give a reason (min 5 characters)').max(200) }),       // admin only: undo a mistake
]);
router.patch('/:id/fee', authorize('reception'), validate(feeSchema), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid visit id' });
  const v = await Visit.findById(req.params.id); if (!v) return res.status(404).json({ message: 'Visit not found' });
  const reload = (id) => Visit.findById(id).populate('patient', 'patientId name phone').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }).populate('fee.receivedBy', 'name');
  const b = req.body; const amount = v.fee?.status ? v.fee.amount : (await Doctor.findById(v.doctor))?.consultationFee || 0;   // older visits without a fee record
  if (b.action === 'reset') {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only an administrator can reverse a fee' });
    const before = v.fee?.toObject?.() || v.fee;
    v.fee = { amount, discount: 0, status: 'Unpaid', note: `Reset: ${b.note}` }; await v.save(); audit(req, 'FEE_RESET', 'Visit', v._id, { before, reason: b.note }); return res.json(feeRow(await reload(v._id)));
  }
  if (v.status === 'Cancelled') return res.status(409).json({ message: 'This visit is cancelled' });
  const open = { _id: v._id, $or: [{ 'fee.status': 'Unpaid' }, { 'fee.status': { $exists: false } }] };    // atomic: a double click cannot take the fee twice
  const set = b.action === 'pay'
    ? { 'fee.amount': amount, 'fee.discount': netOf(amount, b.discount).discount, 'fee.status': 'Paid', 'fee.method': b.method, 'fee.paidAt': new Date(), 'fee.receivedBy': req.user._id, 'fee.note': b.note }
    : { 'fee.amount': amount, 'fee.discount': 0, 'fee.status': 'Waived', 'fee.paidAt': new Date(), 'fee.receivedBy': req.user._id, 'fee.note': b.note };
  const done = await Visit.findOneAndUpdate(open, { $set: set }, { new: true });
  if (!done) return res.status(409).json({ message: `The fee is already ${v.fee?.status || 'settled'}` });
  if (b.action === 'pay' && !done.fee.receiptNo) { done.fee.receiptNo = await Counter.nextId('fee', 'FEE-'); await done.save(); }
  audit(req, b.action === 'pay' ? 'FEE_PAID' : 'FEE_WAIVED', 'Visit', done._id, { amount, discount: done.fee.discount, method: b.method, receipt: done.fee.receiptNo });
  res.json(feeRow(await reload(done._id)));
}));
router.get('/:id/fee-receipt', authorize('reception'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid visit id' });
  const v = await Visit.findById(req.params.id).populate('patient', 'patientId name age gender phone').populate({ path: 'doctor', populate: [{ path: 'user', select: 'name' }, { path: 'department', select: 'name' }] }).populate('fee.receivedBy', 'name');
  if (!v) return res.status(404).json({ message: 'Visit not found' });
  if (v.fee?.status !== 'Paid') return res.status(409).json({ message: 'No payment has been received for this visit yet' });
  if (!v.fee.receiptNo) { v.fee.receiptNo = await Counter.nextId('fee', 'FEE-'); await v.save(); }
  audit(req, 'FEE_RECEIPT_VIEW', 'Visit', v._id);
  res.json({ hospital: hospital(), receiptNo: v.fee.receiptNo, visitNo: v.visitNo, paidAt: v.fee.paidAt, patient: v.patient, doctor: v.doctor?.user?.name, specialization: v.doctor?.specialization, department: v.doctor?.department?.name,
    amount: v.fee.amount, discount: v.fee.discount || 0, net: netOf(v.fee.amount, v.fee.discount).net, method: v.fee.method, receivedBy: v.fee.receivedBy?.name, note: v.fee.note });
}));

router.get('/', asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.today === '1') f.registeredAt = todayRange();
  const doc = await doctorOf(req.user);
  if (doc) f.doctor = doc._id; else if (req.query.doctor) f.doctor = req.query.doctor;
  res.json(await Visit.find(f).sort('registeredAt').populate('patient', 'patientId name age gender phone').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }));
}));

router.patch('/:id/status', validate(z.object({ status: z.enum(STATUSES) })), asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  const doc = await doctorOf(req.user);
  if (doc && String(visit.doctor) !== String(doc._id)) return res.status(403).json({ message: 'Not your patient' });
  if (visit.consultation?.finalized) return res.status(409).json({ message: 'Consultation is finalized; status can no longer change' });
  if (doc && ['Waiting', 'Cancelled'].includes(req.body.status)) return res.status(403).json({ message: 'Doctors cannot set this status' });
  const from = visit.status; visit.status = req.body.status; await visit.save();
  audit(req, 'VISIT_STATUS', 'Visit', visit._id, { from, to: visit.status });
  res.json(visit);
}));

// Reception may correct vitals / complaint before the consultation is finalized.
router.patch('/:id', authorize('reception'), validate(z.object({ chiefComplaint: z.string().min(2).optional(), symptoms: z.array(z.string()).optional(), notes: z.string().optional(), vitals: z.object({}).passthrough().optional() })),
  asyncHandler(async (req, res) => {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.consultation?.finalized) return res.status(409).json({ message: 'Finalized records cannot be edited' });
    Object.assign(visit, req.body); await visit.save();
    audit(req, 'VISIT_UPDATE', 'Visit', visit._id); res.json(visit);
  }));
module.exports = router;
