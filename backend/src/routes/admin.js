// Admin: doctor profiles + departments. (User accounts are in routes/users.js)
const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { isAvailable } = require('../utils/hospital');
const { passwordRule } = require('../utils/passwords');
router.use(protect, authorize('admin'));

const avail = z.array(z.object({ day: z.enum(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']), from: z.string(), to: z.string() })).default([]);
const profile = z.object({
  specialization: z.string().min(2), qualification: z.string().optional(), experienceYears: z.coerce.number().min(0).max(70).optional(),
  departmentId: z.string().min(1, 'Select a department'), contact: z.string().optional(), consultationFee: z.coerce.number().min(0).default(0),
  profilePicture: z.string().url().optional().or(z.literal('')), availability: avail,
});
const createSchema = profile.extend({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), password: passwordRule.optional() });

const { DEFAULT_FIELDS } = require('../utils/defaultFields');

router.get('/doctors', asyncHandler(async (req, res) => {
  const docs = await Doctor.find().populate('user', 'name email phone active').populate('department', 'name').populate('template', 'name version');
  res.json(docs.map((d) => ({ ...d.toObject(), available: isAvailable(d) })));
}));

router.post('/doctors', validate(createSchema), asyncHandler(async (req, res) => {
  const { name, email, phone, password, departmentId, ...rest } = req.body;
  const tempPassword = password || crypto.randomBytes(9).toString('base64url') + 'A1';
  const user = await User.create({ name, email, phone, role: 'doctor', password: tempPassword, mustChangePassword: true });
  let doctor;
  try { doctor = await Doctor.create({ ...rest, profilePicture: rest.profilePicture || undefined, user: user._id, department: departmentId }); }
  catch (e) { await User.findByIdAndDelete(user._id); throw e; }   // no orphan login if profile fails
  const t = await PrescriptionTemplate.create({ name: `${name} - default`, doctor: doctor._id, fields: DEFAULT_FIELDS, design: { headerText: 'City General Hospital' } });
  doctor.template = t._id; await doctor.save();
  audit(req, 'DOCTOR_CREATE', 'Doctor', doctor._id);
  res.status(201).json({ doctor, tempPassword });
}));

router.patch('/doctors/:id', validate(profile.partial().extend({ name: z.string().min(2).optional(), phone: z.string().optional() })), asyncHandler(async (req, res) => {
  const d = await Doctor.findById(req.params.id);
  if (!d) return res.status(404).json({ message: 'Doctor not found' });
  const { name, phone, departmentId, ...rest } = req.body;
  Object.assign(d, rest); if (departmentId) d.department = departmentId; if (rest.profilePicture === '') d.profilePicture = undefined;
  await d.save();
  if (name || phone) await User.findByIdAndUpdate(d.user, { ...(name && { name }), ...(phone && { phone }) });
  audit(req, 'DOCTOR_UPDATE', 'Doctor', d._id); res.json(d);
}));

// "Remove" = deactivate. Hard deletion would orphan visits, labs and prescriptions.
router.delete('/doctors/:id', asyncHandler(async (req, res) => {
  const d = await Doctor.findById(req.params.id);
  if (!d) return res.status(404).json({ message: 'Doctor not found' });
  await User.findByIdAndUpdate(d.user, { active: false });
  audit(req, 'DOCTOR_REMOVE', 'Doctor', d._id); res.json({ message: 'Doctor deactivated; clinical records are preserved' });
}));

router.get('/departments', asyncHandler(async (req, res) => {
  const [deps, counts] = await Promise.all([Department.find().sort('name'), Doctor.aggregate([{ $group: { _id: '$department', n: { $sum: 1 } } }])]);
  const n = Object.fromEntries(counts.map((c) => [String(c._id), c.n])); res.json(deps.map((d) => ({ ...d.toObject(), doctors: n[String(d._id)] || 0 })));
}));
router.patch('/departments/:id', validate(z.object({ name: z.string().trim().min(2).optional(), description: z.string().optional(), active: z.boolean().optional() })), asyncHandler(async (req, res) => {
  const d = await Department.findById(req.params.id); if (!d) return res.status(404).json({ message: 'Department not found' });
  if (req.body.active === false && await Doctor.exists({ department: d._id })) return res.status(409).json({ message: 'Doctors are still assigned to this department. Move them first.' });
  if (req.body.name && req.body.name !== d.name && await Department.exists({ name: req.body.name, _id: { $ne: d._id } })) return res.status(409).json({ message: 'A department with this name already exists' });
  Object.assign(d, req.body); await d.save(); audit(req, 'DEPARTMENT_UPDATE', 'Department', d._id, { fields: Object.keys(req.body) }); res.json(d);
}));
router.post('/departments', validate(z.object({ name: z.string().min(2), description: z.string().optional() })), asyncHandler(async (req, res) => {
  const d = await Department.create(req.body); audit(req, 'DEPARTMENT_CREATE', 'Department', d._id); res.status(201).json(d);
}));
module.exports = router;
