const router = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const LabRequest = require('../models/LabRequest');
const Prescription = require('../models/Prescription');
const Counter = require('../models/Counter');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { todayRange } = require('../utils/helpers');
const { hospital, isAvailable, doctorInfo } = require('../utils/hospital');
const { initialFee } = require('../utils/billing');
const { doctorOf } = require('../utils/doctorScope');
const { upsertPrescription, detailsOf } = require('../utils/rxIssue');
router.use(protect, authorize('doctor'));

// Resolves the logged-in doctor and (if :id given) a visit that belongs to them. Strict ownership.
router.use(asyncHandler(async (req, res, next) => {
  req.doc = await doctorOf(req.user);
  if (!req.doc) return res.status(403).json({ message: 'Doctor profile required' });
  next();
}));
router.param('id', asyncHandler(async (req, res, next, id) => {
  let v = null;
  if (mongoose.isValidObjectId(id)) {
    v = await Visit.findById(id);
    if (!v) v = await Visit.findOne({ patient: id, doctor: req.doc._id }).sort('-registeredAt');   // a patient id was passed: open that patient's latest visit with this doctor
  } else if (/^V-\d+$/i.test(id)) v = await Visit.findOne({ visitNo: id.toUpperCase() });          // visit number such as V-000012
  else return res.status(400).json({ message: 'Invalid visit link' });
  if (!v) { if (process.env.NODE_ENV !== 'test') console.warn(`[visit lookup] nothing found for "${id}" (doctor ${req.doc._id})`); return res.status(404).json({ message: 'Visit not found. The link may be outdated; go back to your patient list and open the patient again.', lookedUp: id }); }
  if (String(v.doctor) !== String(req.doc._id)) return res.status(403).json({ message: 'This patient is not assigned to you' });
  req.visit = v; next();
}));

const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const { validateData, diagnosisOf, medicinesOf } = require('../utils/templateData');
const consultSchema = z.object({
  data: z.record(z.string(), z.any()).default({}),
  followUpDate: z.string().optional().or(z.literal('')),
  history: z.object({ medicalHistory: z.string().optional(), allergies: z.array(z.string()).optional(), currentMedications: z.array(z.string()).optional() }).optional(),
});

// Template used for a visit: the snapshot locked at first save, otherwise the doctor's current template.
async function templateFor(visit, doc) {
  const snap = visit.consultation?.templateSnapshot;
  if (snap) return { fields: snap.fields, design: snap.design, name: snap.name, version: snap.version, _id: snap._id, locked: true };
  const t = doc.template && await PrescriptionTemplate.findById(doc.template);
  if (!t) return null;
  return { fields: t.toObject().fields, design: t.toObject().design, name: t.name, version: t.version, _id: t._id, locked: false };
}
function applyConsultation(visit, tpl, clean, followUpDate) {
  const c = visit.toObject().consultation || {};
  visit.consultation = {
    ...c, templateId: tpl._id, templateVersion: tpl.version,
    templateSnapshot: c.templateSnapshot || { _id: tpl._id, name: tpl.name, version: tpl.version, fields: tpl.fields, design: tpl.design },
    data: clean, diagnosis: diagnosisOf(tpl.fields, clean), followUpDate: followUpDate || undefined,
  };
  visit.markModified('consultation');
}
const saveHistory = (visit, h) => h && Patient.findByIdAndUpdate(visit.patient, { $set: Object.fromEntries(Object.entries(h).map(([k, v]) => [`history.${k}`, v])) });
async function prepare(req, res, requireAll) {
  const tpl = await templateFor(req.visit, req.doc);
  if (!tpl) { res.status(409).json({ message: 'No prescription template is assigned to you. Ask the administrator.' }); return null; }
  const { clean, errors } = validateData(tpl.fields, req.body.data, requireAll);
  if (errors.length) { res.status(400).json({ message: errors.join('; '), errors: errors.map((m) => ({ field: 'data', message: m })) }); return null; }
  return { tpl, clean };
}

const infoOf = async (id) => doctorInfo(await Doctor.findById(id).populate('user', 'name phone').populate('department', 'name'));

// ---------- My profile: header details, availability, signature and my current template ----------
router.get('/me', asyncHandler(async (req, res) => {
  const d = await Doctor.findById(req.doc._id).populate('user', 'name phone').populate('department', 'name');
  const t = d.template && await PrescriptionTemplate.findById(d.template);
  res.json({ doctor: doctorInfo(d), available: isAvailable(d), availableSince: d.availableSince, hospital: hospital(),
    template: t ? { _id: t._id, name: t.name, version: t.version, fields: t.toObject().fields, design: t.toObject().design } : null });
}));
router.patch('/availability', validate(z.object({ available: z.boolean() })), asyncHandler(async (req, res) => {
  req.doc.available = req.body.available; req.doc.availableSince = req.body.available ? new Date() : undefined; await req.doc.save();
  audit(req, req.body.available ? 'DOCTOR_AVAILABLE' : 'DOCTOR_UNAVAILABLE', 'Doctor', req.doc._id);
  res.json({ available: isAvailable(req.doc), availableSince: req.doc.availableSince });
}));

// ---------- Overview ----------
router.get('/overview', asyncHandler(async (req, res) => {
  const mine = { doctor: req.doc._id };
  const today = await Visit.find({ ...mine, registeredAt: todayRange() }).populate('patient', 'patientId name age gender').sort('registeredAt');
  const n = (s) => today.filter((v) => v.status === s).length;
  const recent = await Visit.find({ ...mine, status: 'Completed' }).sort('-consultation.finalizedAt').limit(5).populate('patient', 'patientId name');
  const [labOrders, returned] = await Promise.all([
    LabRequest.find({ doctor: req.doc._id }).sort('-createdAt').limit(15).populate('patient', 'patientId name'),
    Prescription.find({ doctor: req.doc._id, status: 'Returned' }).sort('-returnedAt').populate('patient', 'patientId name'),
  ]);
  const labsReady = labOrders.filter((l) => l.status === 'Completed').slice(0, 5);
  res.json({ labOrders, labsReady, returned, stats: { total: today.length, waiting: n('Waiting'), inConsultation: n('In Consultation'), completed: n('Completed') }, patients: today, recent });
}));

// ---------- Full medical record ----------
// ---------- Patient details ("View Details"): read-only file of the patient. Each section loads on its own,
// so one failing part is reported in `warnings` instead of blanking the whole page. ----------
router.get('/visits/:id/details', asyncHandler(async (req, res) => {
  const v = req.visit; const warnings = [];
  const safe = async (label, fn, fallback) => { try { return await fn(); } catch (e) { console.error(`[details:${label}]`, e.message); warnings.push(label); return fallback; } };
  const withDoctor = { path: 'doctor', populate: { path: 'user', select: 'name' } };
  const [patient, doctor, visits, labs, rx, prevRx, prevLabs] = await Promise.all([
    safe('patient', () => Patient.findById(v.patient), null),
    safe('doctor', () => infoOf(v.doctor), null),
    safe('previous visits', () => Visit.find({ patient: v.patient, _id: { $ne: v._id } }).sort('-registeredAt').limit(20).populate(withDoctor), []),
    safe('lab orders', () => LabRequest.find({ visit: v._id }).sort('-createdAt'), []),
    safe('prescriptions', () => Prescription.find({ visit: v._id }).sort('-createdAt'), []),
    safe('previous prescriptions', () => Prescription.find({ patient: v.patient, visit: { $ne: v._id }, status: { $ne: 'Draft' } }).sort('-createdAt').limit(20).populate(withDoctor), []),
    safe('previous lab reports', () => LabRequest.find({ patient: v.patient, visit: { $ne: v._id }, status: 'Completed' }).sort('-completedAt').limit(20), []),
  ]);
  if (!patient) return res.status(404).json({ message: 'The patient record belonging to this visit is missing', lookedUp: String(v.patient) });
  const items = (r) => r.items.map((i) => ({ name: i.name, strength: i.strength, dosage: i.dosage, frequency: i.frequency, duration: i.duration, quantity: i.quantity, instructions: i.instructions, dispensedQty: i.dispensedQty }));
  audit(req, 'RECORD_VIEW', 'Visit', v._id);
  res.json({
    warnings, hospital: hospital(), doctor, patient, visit: v,
    previousVisits: visits.map((x) => ({ _id: x._id, visitNo: x.visitNo, date: x.registeredAt, complaint: x.chiefComplaint, diagnosis: x.consultation?.diagnosis, doctor: x.doctor?.user?.name, status: x.status })),
    prescriptions: rx.map((r) => ({ _id: r._id, rxNo: r.rxNo, status: r.status, date: r.issuedAt || r.createdAt, diagnosis: r.diagnosis, items: items(r), returnReason: r.returnReason })),
    labs,
    history: {
      prescriptions: prevRx.map((r) => ({ _id: r._id, rxNo: r.rxNo, status: r.status, date: r.issuedAt || r.createdAt, doctor: r.doctor?.user?.name, diagnosis: r.diagnosis, items: items(r) })),
      labs: prevLabs.map((l) => ({ _id: l._id, requestNo: l.requestNo, date: l.completedAt, priority: l.priority, tests: l.tests.map((t) => ({ name: t.name, result: t.result, unit: t.unit, referenceRange: t.referenceRange, flag: t.flag })) })),
    },
  });
}));

router.get('/visits/:id', asyncHandler(async (req, res) => {
  const v = req.visit;
  const [patient, previous, labs, prescription, prevRx, prevLabs] = await Promise.all([
    Patient.findById(v.patient),
    Visit.find({ patient: v.patient, _id: { $ne: v._id } }).sort('-registeredAt').limit(10).populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }),
    LabRequest.find({ visit: v._id }).sort('-createdAt'),
    Prescription.find({ visit: v._id }).sort('-createdAt'),
    Prescription.find({ patient: v.patient, visit: { $ne: v._id }, status: { $ne: 'Draft' } }).sort('-createdAt').limit(10).populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }),
    LabRequest.find({ patient: v.patient, visit: { $ne: v._id }, status: 'Completed' }).sort('-completedAt').limit(10),
  ]);
  audit(req, 'RECORD_VIEW', 'Visit', v._id);
  const template = await templateFor(v, req.doc);
  const history = {
    prescriptions: prevRx.map((r) => ({ _id: r._id, rxNo: r.rxNo, status: r.status, date: r.issuedAt || r.createdAt, doctor: r.doctor?.user?.name, diagnosis: r.diagnosis, items: r.items.map((i) => ({ name: i.name, strength: i.strength, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions })) })),
    labs: prevLabs.map((l) => ({ _id: l._id, requestNo: l.requestNo, date: l.completedAt, priority: l.priority, tests: l.tests.map((t) => ({ name: t.name, result: t.result, unit: t.unit, referenceRange: t.referenceRange, flag: t.flag })) })),
  };
  res.json({ history, hospital: hospital(), doctor: await infoOf(v.doctor), visit: v, template, patient, previous: previous.map((p) => ({ _id: p._id, visitNo: p.visitNo, date: p.registeredAt, complaint: p.chiefComplaint, diagnosis: p.consultation?.diagnosis, doctor: p.doctor?.user?.name, status: p.status })), labs, prescriptions: prescription });
}));

router.post('/visits/:id/start', asyncHandler(async (req, res) => {
  if (req.visit.status === 'Waiting') { req.visit.status = 'In Consultation'; await req.visit.save(); audit(req, 'VISIT_STATUS', 'Visit', req.visit._id, { to: 'In Consultation' }); }
  res.json(req.visit);
}));

// ---------- Save draft ----------
router.put('/visits/:id/consultation', validate(consultSchema), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (v.consultation?.finalized) return res.status(409).json({ message: 'Record is finalized. Use "Amend record" with a reason.' });
  const p = await prepare(req, res, false); if (!p) return;
  applyConsultation(v, p.tpl, p.clean, req.body.followUpDate);
  if (v.status === 'Waiting') v.status = 'In Consultation';
  await v.save(); await saveHistory(v, req.body.history);
  await upsertPrescription(v, { items: medicinesOf(p.tpl.fields, p.clean), details: detailsOf(p.tpl.fields, p.clean), diagnosis: v.consultation.diagnosis, send: false });
  audit(req, 'CONSULTATION_SAVE', 'Visit', v._id); res.json(v);
}));

// ---------- Complete (finalize) ----------
router.post('/visits/:id/complete', validate(consultSchema), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (v.consultation?.finalized) return res.status(409).json({ message: 'Already completed' });
  const p = await prepare(req, res, true); if (!p) return;
  const pendingLabs = await LabRequest.countDocuments({ visit: v._id, status: { $nin: ['Completed', 'Cancelled'] } });
  applyConsultation(v, p.tpl, p.clean, req.body.followUpDate);
  v.consultation.finalized = true; v.consultation.finalizedAt = new Date(); v.status = 'Completed';
  v.markModified('consultation'); await v.save(); await saveHistory(v, req.body.history);
  if (v.consultation.diagnosis) await Patient.findByIdAndUpdate(v.patient, { $addToSet: { 'history.previousDiagnoses': v.consultation.diagnosis } });
  const rx = await upsertPrescription(v, { items: medicinesOf(p.tpl.fields, p.clean), details: detailsOf(p.tpl.fields, p.clean), diagnosis: v.consultation.diagnosis, send: true });   // reaches pharmacy queue as Pending
  audit(req, 'CONSULTATION_COMPLETE', 'Visit', v._id, { rx: rx?.rxNo, templateVersion: p.tpl.version });
  res.json({ visit: v, prescription: rx, pendingLabs });
}));

// ---------- Amend a finalized record (never overwritten silently) ----------
router.post('/visits/:id/amend', validate(consultSchema.extend({ reason: z.string().min(5, 'Reason is required (min 5 characters)') })), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (!v.consultation?.finalized) return res.status(409).json({ message: 'Record is not finalized; just save it' });
  const p = await prepare(req, res, true); if (!p) return;
  const keep = { finalized: true, finalizedAt: v.consultation.finalizedAt };
  v.amendments.push({ at: new Date(), by: req.user._id, reason: req.body.reason, previous: JSON.parse(JSON.stringify(v.consultation)) });
  applyConsultation(v, p.tpl, p.clean, req.body.followUpDate); Object.assign(v.consultation, keep); v.markModified('consultation'); await v.save();
  await saveHistory(v, req.body.history);
  const out = await upsertPrescription(v, { items: medicinesOf(p.tpl.fields, p.clean), details: detailsOf(p.tpl.fields, p.clean), diagnosis: v.consultation.diagnosis, send: true });   // open one is updated; a dispensed one gets a new addendum
  audit(req, 'CONSULTATION_AMEND', 'Visit', v._id, { reason: req.body.reason });
  res.json({ visit: v, prescription: out });
}));

// ---------- Save & send the prescription to the pharmacy (consultation stays open) ----------
router.post('/visits/:id/send-prescription', validate(consultSchema), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (v.consultation?.finalized) return res.status(409).json({ message: 'Record is finalized. Use "Amend record" with a reason.' });
  const p = await prepare(req, res, true); if (!p) return;
  const items = medicinesOf(p.tpl.fields, p.clean);
  if (!items.length) return res.status(400).json({ message: 'Add at least one medicine before sending to the pharmacy' });
  applyConsultation(v, p.tpl, p.clean, req.body.followUpDate);
  if (v.status === 'Waiting') v.status = 'In Consultation';
  await v.save(); await saveHistory(v, req.body.history);
  const rx = await upsertPrescription(v, { items, details: detailsOf(p.tpl.fields, p.clean), diagnosis: v.consultation.diagnosis, send: true });
  audit(req, 'PRESCRIPTION_SEND', 'Prescription', rx._id, { rx: rx.rxNo }); res.json({ visit: v, prescription: rx });
}));

// ---------- Laboratory test orders ----------
const OPEN_LAB = ['Pending', 'Accepted', 'Sample Collected', 'Processing'];
const labSchema = z.object({
  tests: z.array(z.union([z.string().min(1), z.object({ name: z.string().min(1), category: z.string().optional() })])).min(1, 'Select at least one test'),
  indication: z.string().trim().min(3, 'Clinical indication is required'),
  priority: z.enum(['Routine', 'Urgent', 'Emergency']).default('Routine'),
  instructions: z.string().max(1000).optional(),
});
router.post('/visits/:id/lab-requests', validate(labSchema), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (v.status === 'Cancelled') return res.status(409).json({ message: 'Visit is cancelled' });
  const wanted = []; const seen = new Set();
  for (const t of req.body.tests.map((x) => (typeof x === 'string' ? { name: x } : x))) { const k = t.name.trim().toLowerCase(); if (!seen.has(k)) { seen.add(k); wanted.push({ name: t.name.trim(), category: t.category }); } }
  // repeated submissions / double clicks must not create the same order twice
  const open = await LabRequest.find({ visit: v._id, status: { $in: OPEN_LAB } });
  const taken = new Set(open.flatMap((l) => l.tests.map((t) => t.name.toLowerCase())));
  const fresh = wanted.filter((t) => !taken.has(t.name.toLowerCase()));
  if (!fresh.length) return res.status(409).json({ message: `Already ordered for this visit: ${wanted.map((t) => t.name).join(', ')}` });
  const lab = await LabRequest.create({ requestNo: await Counter.nextId('lab', 'LAB-'), visit: v._id, patient: v.patient, doctor: v.doctor, tests: fresh,
    priority: req.body.priority, indication: req.body.indication, instructions: req.body.instructions });
  audit(req, 'LAB_REQUEST', 'LabRequest', lab._id, { tests: fresh.map((t) => t.name), priority: lab.priority });
  res.status(201).json({ ...lab.toObject(), skipped: wanted.length - fresh.length });
}));
router.post('/visits/:id/lab-requests/:labId/cancel', validate(z.object({ reason: z.string().max(300).optional() })), asyncHandler(async (req, res) => {
  const lab = await LabRequest.findOne({ _id: req.params.labId, visit: req.visit._id });
  if (!lab) return res.status(404).json({ message: 'Lab order not found' });
  if (lab.status !== 'Pending') return res.status(409).json({ message: `Only pending orders can be cancelled (this one is ${lab.status}). Ask the laboratory.` });
  lab.status = 'Cancelled'; lab.cancelReason = req.body.reason; lab.cancelledAt = new Date(); lab.cancelledBy = req.user._id; await lab.save();
  audit(req, 'LAB_CANCEL', 'LabRequest', lab._id); res.json(lab);
}));

// ---------- Referral to another department ----------
router.post('/visits/:id/refer', validate(z.object({ doctorId: z.string().min(1, 'Select a doctor'), reason: z.string().min(3, 'Reason required') })), asyncHandler(async (req, res) => {
  const v = req.visit;
  if (v.consultation?.finalized) return res.status(409).json({ message: 'Record is finalized' });
  const target = await Doctor.findById(req.body.doctorId);
  if (!target || String(target._id) === String(req.doc._id)) return res.status(400).json({ message: 'Choose a different doctor' });
  v.status = 'Referred'; await v.save();
  const nv = await Visit.create({ visitNo: await Counter.nextId('visit', 'V-'), patient: v.patient, doctor: target._id, department: target.department, patientType: 'Follow-up', fee: initialFee(target),
    chiefComplaint: `Referred: ${req.body.reason}`, symptoms: v.symptoms, vitals: v.vitals, notes: `Referred from visit ${v.visitNo}`, registeredBy: req.user._id });
  audit(req, 'REFERRAL', 'Visit', v._id, { to: nv.visitNo }); res.status(201).json({ visit: v, newVisit: nv });
}));
module.exports = router;
