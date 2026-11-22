// Prescription template designer API. Admin writes; a doctor reads only their own active template.
const router = require('express').Router();
const { z } = require('zod');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Doctor = require('../models/Doctor');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
router.use(protect);

const field = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Invalid field key'), label: z.string().min(1, 'Every field needs a label'),
  type: z.enum(['text', 'textarea', 'number', 'date', 'dropdown', 'checkbox', 'vitals', 'medicines']),
  required: z.boolean().default(false), options: z.array(z.string().min(1)).default([]), unit: z.string().optional(), placeholder: z.string().optional(),
});
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const body = z.object({
  name: z.string().min(2), doctorId: z.string().min(1, 'Select a doctor'), assign: z.boolean().default(true),
  fields: z.array(field).min(1, 'Add at least one field'),
  design: z.object({ logoUrl: z.string().refine((v) => v === '' || /^\/api\/assets\/logos\/[a-f0-9-]{36}\.(png|jpg)$/.test(v) || /^https?:\/\/\S+$/.test(v), 'Invalid logo').optional(), headerText: z.string().optional(), footerText: z.string().optional(),
    primaryColor: color.default('#0d9488'), fontFamily: z.enum(['Inter', 'Georgia', 'Times New Roman', 'Arial', 'Courier New']).default('Inter'), showSignature: z.boolean().default(true) }).default({}),
}).superRefine((b, ctx) => {
  const keys = b.fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Field keys must be unique' });
  b.fields.forEach((f, i) => { if (f.type === 'dropdown' && f.options.length < 2) ctx.addIssue({ code: 'custom', path: ['fields', i, 'options'], message: `"${f.label}" dropdown needs at least 2 options` }); });
});
const clean = (b) => ({ name: b.name, doctor: b.doctorId, fields: b.fields.map((f, i) => ({ ...f, order: i })), design: { ...b.design, logoUrl: b.design.logoUrl || undefined } });

// Doctor: the template to render in the consultation form.
router.get('/mine', authorize('doctor'), asyncHandler(async (req, res) => {
  const doc = await Doctor.findOne({ user: req.user._id });
  const t = doc?.template && await PrescriptionTemplate.findById(doc.template);
  if (!t) return res.status(404).json({ message: 'No template assigned. Ask the administrator.' });
  res.json(t);
}));

router.use(authorize('admin'));
router.get('/', asyncHandler(async (req, res) => {
  const f = { active: { $ne: false } }; if (req.query.doctor) f.doctor = req.query.doctor;
  const list = await PrescriptionTemplate.find(f).select('-history').populate({ path: 'doctor', select: 'specialization template', populate: { path: 'user', select: 'name' } }).sort('-updatedAt');
  res.json(list);
}));
router.get('/:id', asyncHandler(async (req, res) => { const t = await PrescriptionTemplate.findById(req.params.id).select('-history'); t ? res.json(t) : res.status(404).json({ message: 'Template not found' }); }));

router.post('/', validate(body), asyncHandler(async (req, res) => {
  const doc = await Doctor.findById(req.body.doctorId);
  if (!doc) return res.status(400).json({ message: 'Doctor not found' });
  const t = await PrescriptionTemplate.create(clean(req.body));
  if (req.body.assign) { doc.template = t._id; await doc.save(); }
  audit(req, 'TEMPLATE_CREATE', 'PrescriptionTemplate', t._id); res.status(201).json(t);
}));

// Editing bumps the version and snapshots the old one; past visits keep the version they used.
router.put('/:id', validate(body), asyncHandler(async (req, res) => {
  const t = await PrescriptionTemplate.findById(req.params.id);
  if (!t) return res.status(404).json({ message: 'Template not found' });
  t.history.push({ version: t.version, savedAt: new Date(), name: t.name, fields: t.toObject().fields, design: t.toObject().design });
  Object.assign(t, clean(req.body)); t.version += 1; await t.save();
  if (req.body.assign) await Doctor.findByIdAndUpdate(req.body.doctorId, { template: t._id });
  audit(req, 'TEMPLATE_UPDATE', 'PrescriptionTemplate', t._id, { version: t.version }); res.json(t);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (await Doctor.exists({ template: req.params.id })) return res.status(409).json({ message: 'This template is assigned to a doctor. Assign another template first.' });
  await PrescriptionTemplate.findByIdAndUpdate(req.params.id, { active: false });
  audit(req, 'TEMPLATE_DELETE', 'PrescriptionTemplate', req.params.id); res.json({ message: 'Template archived' });
}));
module.exports = router;
