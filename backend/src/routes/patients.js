const router = require('express').Router();
const { z } = require('zod');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const Doctor = require('../models/Doctor');
const Counter = require('../models/Counter');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { escapeRegex, ageFromDob } = require('../utils/helpers');
const { doctorOf } = require('../utils/doctorScope');
const { initialFee, netOf } = require('../utils/billing');
router.use(protect);

const num = (min, max) => z.coerce.number().min(min).max(max).optional().or(z.literal('').transform(() => undefined));
const vitals = z.object({
  weightKg: num(0, 500), heightCm: num(0, 300), bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, 'Use format 120/80').optional().or(z.literal('')),
  temperatureC: num(25, 45), pulse: num(20, 250), spo2: num(40, 100),
}).partial();
const visitPart = z.object({
  doctorId: z.string().min(1, 'Select a doctor'),
  patientType: z.enum(['New', 'Follow-up']).default('New'),
  chiefComplaint: z.string().min(2, 'Main complaint is required'),
  symptoms: z.array(z.string()).default([]),
  vitals: vitals.default({}),
  notes: z.string().optional(),
  payment: z.object({ method: z.enum(['Cash', 'Card', 'Online']), discount: z.coerce.number().min(0).optional() }).optional(),   // fee collected at registration
});
const patientPart = z.object({
  name: z.string().trim().min(2), guardianName: z.string().optional(),
  dob: z.string().optional().or(z.literal('')), age: num(0, 130),
  gender: z.enum(['Male', 'Female', 'Other']), phone: z.string().regex(/^[0-9+\-\s]{7,16}$/, 'Invalid phone number'),
  address: z.string().optional(),
});

async function createVisit(patient, v, userId) {
  const doctor = await Doctor.findById(v.doctorId);
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { status: 400 });
  const fee = initialFee(doctor);
  if (v.payment && fee.status === 'Unpaid') Object.assign(fee, { status: 'Paid', discount: netOf(fee.amount, v.payment.discount).discount, method: v.payment.method, paidAt: new Date(), receiptNo: await Counter.nextId('fee', 'FEE-'), receivedBy: userId });
  return Visit.create({
    fee, visitNo: await Counter.nextId('visit', 'V-'), patient: patient._id, doctor: doctor._id, department: doctor.department,
    patientType: v.patientType, chiefComplaint: v.chiefComplaint, symptoms: v.symptoms, vitals: v.vitals, notes: v.notes, registeredBy: userId,
  });
}

// Search by Patient ID, phone or name. Doctors only see patients assigned to them.
router.get('/', authorize('reception', 'doctor'), asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = {};
  if (q) { const r = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: r }, { phone: r }, { patientId: r }]; }
  const doc = await doctorOf(req.user);
  if (doc) filter._id = { $in: await Visit.distinct('patient', { doctor: doc._id }) };
  res.json(await Patient.find(filter).sort('-createdAt').limit(50));
}));

router.post('/register', authorize('reception'),
  validate(z.object({ patient: patientPart, visit: visitPart, force: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const { patient: p, visit: v, force } = req.body;
    if (!force) { // duplicate guard: same phone + similar name
      const dups = await Patient.find({ phone: p.phone, name: new RegExp('^' + escapeRegex(p.name) + '$', 'i') });
      if (dups.length) return res.status(409).json({ message: 'A patient with this name and phone already exists', matches: dups });
    }
    const patient = await Patient.create({ ...p, dob: p.dob || undefined, age: p.dob ? ageFromDob(p.dob) : p.age, patientId: await Counter.nextId('patient', 'PID-') });
    const visit = await createVisit(patient, v, req.user._id);
    audit(req, 'PATIENT_REGISTER', 'Patient', patient._id, { visit: visit.visitNo });
    res.status(201).json({ patient, visit });
  }));

// New visit (follow-up) for an existing patient: no duplicate record.
router.post('/:id/visits', authorize('reception'), validate(visitPart), asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  const visit = await createVisit(patient, { ...req.body, patientType: 'Follow-up' }, req.user._id);
  audit(req, 'VISIT_CREATE', 'Visit', visit._id, { patient: patient.patientId });
  res.status(201).json({ patient, visit });
}));

router.patch('/:id', authorize('reception'), validate(patientPart.partial()), asyncHandler(async (req, res) => {
  const body = { ...req.body }; if (body.dob) body.age = ageFromDob(body.dob); else delete body.dob;
  const p = await Patient.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!p) return res.status(404).json({ message: 'Patient not found' });
  audit(req, 'PATIENT_UPDATE', 'Patient', p._id, { fields: Object.keys(body) }); res.json(p);
}));

// Patient profile + full visit history (doctors: only if the patient was assigned to them).
router.get('/:id', authorize('reception', 'doctor'), asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  const doc = await doctorOf(req.user);
  const vf = { patient: patient._id };
  if (doc && !(await Visit.exists({ patient: patient._id, doctor: doc._id }))) return res.status(403).json({ message: 'This patient is not assigned to you' });
  const visits = await Visit.find(vf).sort('-registeredAt').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } });
  audit(req, 'PATIENT_VIEW', 'Patient', patient._id);
  res.json({ patient, visits });
}));
module.exports = router;
