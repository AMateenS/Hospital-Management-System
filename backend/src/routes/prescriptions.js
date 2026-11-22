// Printable prescription / patient-description sheet data. Used by doctor now, pharmacy in Phase 8.
const router = require('express').Router();
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Prescription = require('../models/Prescription');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { medicinesOf } = require('../utils/templateData');
const LabRequest = require('../models/LabRequest');
const { hospital, doctorInfo } = require('../utils/hospital');
router.use(protect, authorize('doctor', 'pharmacy'));

router.get('/sheet/:visitId', asyncHandler(async (req, res) => {
  const v = await Visit.findById(req.params.visitId);
  if (!v) return res.status(404).json({ message: 'Visit not found' });
  const doctor = await Doctor.findById(v.doctor).populate('user', 'name phone').populate('department', 'name');
  if (req.user.role === 'doctor' && String(doctor.user._id) !== String(req.user._id)) return res.status(403).json({ message: 'Not your patient' });
  const c = v.consultation || {};
  const snap = c.templateSnapshot;
  if (!snap) return res.status(409).json({ message: 'Nothing to print yet. Save the consultation first.' });
  const [patient, rx, labs] = await Promise.all([Patient.findById(v.patient), Prescription.findOne({ visit: v._id }).sort('-createdAt'), LabRequest.find({ visit: v._id })]);
  const sent = !!rx && rx.status !== 'Draft';
  if (req.user.role !== 'doctor' && !sent) return res.status(409).json({ message: 'This prescription has not been sent to the pharmacy yet' });
  const data = c.data || {};
  const medKey = snap.fields.find((f) => f.type === 'medicines')?.key;
  audit(req, 'PRESCRIPTION_PRINT_VIEW', 'Visit', v._id);
  res.json({
    design: snap.design, templateName: snap.name, templateVersion: snap.version, draft: !c.finalized && !sent,
    patient: { name: patient.name, patientId: patient.patientId, age: patient.age, gender: patient.gender, phone: patient.phone },
    hospital: hospital(), doctor: doctorInfo(doctor), labTests: labs.flatMap((l) => l.tests.map((t) => ({ name: t.name, status: l.status }))),
    visit: { visitNo: v.visitNo, date: c.finalizedAt || v.registeredAt, vitals: v.vitals, complaint: v.chiefComplaint, followUpDate: c.followUpDate, diagnosis: c.diagnosis },
    fields: snap.fields.filter((f) => f.type !== 'medicines').map((f) => ({ key: f.key, label: f.label, type: f.type, unit: f.unit, value: f.type === 'vitals' ? null : data[f.key] })),
    medicines: req.user.role === 'pharmacy' && rx ? rx.items.map((i) => ({ name: i.name, strength: i.strength, dosage: i.dosage, frequency: i.frequency, duration: i.duration, quantity: i.quantity, instructions: i.instructions })) : (medKey ? (data[medKey] || []) : []), rxNo: rx?.rxNo, rxStatus: rx?.status,
  });
}));
module.exports = router;
