// Admin-only pharmacist account management (add, view, edit, search, deactivate, reset password, delete, permissions).
const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { z } = require('zod');
const User = require('../models/User');
const DispensingRecord = require('../models/DispensingRecord');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { escapeRegex } = require('../utils/helpers');
const { passwordRule } = require('../utils/passwords');
const { PHARMACY_PERMISSIONS } = require('../utils/permissions');
router.use(protect);
router.use((req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Only administrators can manage pharmacists' })));   // strictly admin
void authorize;

const base = z.object({
  name: z.string().trim().min(2, 'Name is required'), email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,16}$/, 'Invalid phone number').optional().or(z.literal('')),
  licenseNo: z.string().trim().max(40).optional(), employeeId: z.string().trim().max(40).optional(),
  permissions: z.array(z.enum(PHARMACY_PERMISSIONS)).default(PHARMACY_PERMISSIONS),
});
const stats = async (ids) => {
  const rows = await DispensingRecord.aggregate([{ $match: { pharmacist: { $in: ids } } }, { $group: { _id: '$pharmacist', records: { $sum: 1 }, last: { $max: '$dispensedAt' } } }]);
  return Object.fromEntries(rows.map((r) => [String(r._id), { records: r.records, last: r.last }]));
};
async function load(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid pharmacist id' }); return null; }
  const u = await User.findOne({ _id: req.params.id, role: 'pharmacy' });
  if (!u) { res.status(404).json({ message: 'Pharmacist not found' }); return null; }
  return u;
}
const tempPw = () => crypto.randomBytes(9).toString('base64url') + 'aA1';

router.get('/', asyncHandler(async (req, res) => {
  const f = { role: 'pharmacy' };
  if (req.query.status === 'active') f.active = true; if (req.query.status === 'inactive') f.active = false;
  if (req.query.q) { const r = new RegExp(escapeRegex(String(req.query.q)), 'i'); f.$or = [{ name: r }, { email: r }, { licenseNo: r }, { employeeId: r }, { phone: r }]; }
  const users = await User.find(f).sort('name'); const st = await stats(users.map((u) => u._id));
  res.json(users.map((u) => ({ ...u.toSafe(), stats: st[String(u._id)] || { records: 0 } })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const u = await load(req, res); if (!u) return;
  const [recent, st] = await Promise.all([DispensingRecord.find({ pharmacist: u._id }).sort('-dispensedAt').limit(10).populate('prescription', 'rxNo').populate('patient', 'name patientId'), stats([u._id])]);
  res.json({ ...u.toSafe(), stats: st[String(u._id)] || { records: 0 }, recent: recent.map((r) => ({ _id: r._id, at: r.dispensedAt, rxNo: r.prescription?.rxNo, patient: r.patient?.name, patientId: r.patient?.patientId, total: r.total })) });
}));

router.post('/', validate(base.extend({ password: passwordRule.optional() })), asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) return res.status(409).json({ message: 'A user with this email already exists' });
  const tempPassword = req.body.password || tempPw(); const { password, ...rest } = req.body;
  const u = await User.create({ ...rest, role: 'pharmacy', password: tempPassword, mustChangePassword: true });
  audit(req, 'PHARMACIST_CREATE', 'User', u._id, { email: u.email }); res.status(201).json({ pharmacist: u.toSafe(), tempPassword });
}));

router.put('/:id', validate(base.partial()), asyncHandler(async (req, res) => {
  const u = await load(req, res); if (!u) return;
  if (req.body.email && req.body.email !== u.email && await User.exists({ email: req.body.email, _id: { $ne: u._id } })) return res.status(409).json({ message: 'A user with this email already exists' });
  Object.assign(u, req.body); await u.save();
  audit(req, 'PHARMACIST_UPDATE', 'User', u._id, { fields: Object.keys(req.body) }); res.json(u.toSafe());
}));

router.patch('/:id/active', validate(z.object({ active: z.boolean() })), asyncHandler(async (req, res) => {
  const u = await load(req, res); if (!u) return;
  u.active = req.body.active; await u.save(); audit(req, req.body.active ? 'PHARMACIST_ACTIVATE' : 'PHARMACIST_DEACTIVATE', 'User', u._id); res.json(u.toSafe());
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const u = await load(req, res); if (!u) return;
  const tempPassword = tempPw(); u.password = tempPassword; u.mustChangePassword = true; await u.save();   // also signs out their other sessions
  audit(req, 'PASSWORD_RESET', 'User', u._id); res.json({ tempPassword });
}));

// Pharmacists with dispensing history are never deleted (the records must keep their author); deactivate them instead.
router.delete('/:id', asyncHandler(async (req, res) => {
  const u = await load(req, res); if (!u) return;
  if (await DispensingRecord.exists({ pharmacist: u._id })) return res.status(409).json({ message: 'This pharmacist has dispensing records and cannot be deleted. Deactivate the account instead.' });
  await u.deleteOne(); audit(req, 'PHARMACIST_DELETE', 'User', u._id, { email: u.email }); res.json({ message: 'Pharmacist deleted' });
}));
module.exports = router;
