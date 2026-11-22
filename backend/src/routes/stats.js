const router = require('express').Router();
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Department = require('../models/Department');
const Visit = require('../models/Visit');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { todayRange } = require('../utils/helpers');
const LabRequest = require('../models/LabRequest');
const Prescription = require('../models/Prescription');
const { revenueBetween } = require('../utils/revenue');
const { isAvailable } = require('../utils/hospital');
router.use(protect);

// Reception: today's counts + one card per doctor with today's patient list.
router.get('/reception', authorize('reception'), asyncHandler(async (req, res) => {
  const today = todayRange();
  const [visits, doctors] = await Promise.all([
    Visit.find({ registeredAt: today }).sort('registeredAt').populate('patient', 'patientId name age gender'),
    Doctor.find().populate('user', 'name active').populate('department', 'name'),
  ]);
  const count = (s) => visits.filter((v) => v.status === s).length;
  const cards = doctors.filter((d) => d.user?.active).map((d) => {
    const mine = visits.filter((v) => String(v.doctor) === String(d._id));
    return {
      doctorId: d._id, available: isAvailable(d), availableSince: d.availableSince, name: d.user.name, specialization: d.specialization, department: d.department?.name,
      total: mine.length, waiting: mine.filter((v) => v.status === 'Waiting').length, completed: mine.filter((v) => v.status === 'Completed').length,
      patients: mine.map((v) => ({ fee: { status: v.fee?.status || 'Unpaid', amount: v.fee?.amount || 0, discount: v.fee?.discount || 0 }, visitId: v._id, visitNo: v.visitNo, patientId: v.patient?.patientId, name: v.patient?.name, age: v.patient?.age, gender: v.patient?.gender, status: v.status, complaint: v.chiefComplaint, registeredAt: v.registeredAt })),
    };
  });
  const paidToday = await Visit.aggregate([{ $match: { 'fee.status': 'Paid', 'fee.paidAt': today } }, { $group: { _id: null, total: { $sum: { $subtract: ['$fee.amount', { $ifNull: ['$fee.discount', 0] }] } }, n: { $sum: 1 } } }]);
  const unpaid = visits.filter((v) => (v.fee?.status || 'Unpaid') === 'Unpaid' && v.status !== 'Cancelled');
  res.json({ stats: { unpaidFees: unpaid.length, unpaidAmount: unpaid.reduce((a, v) => a + (v.fee?.amount || 0), 0), collectedToday: paidToday[0]?.total || 0, registeredToday: visits.length, waiting: count('Waiting'), inConsultation: count('In Consultation'), completed: count('Completed') }, doctors: cards });
}));

router.get('/admin', authorize('admin'), asyncHandler(async (req, res) => {
  const t = todayRange(); const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [patients, doctors, staff, departments, appointmentsToday, labTotal, labPending, rxTotal, rxPending, revToday, revMonth] = await Promise.all([
    Patient.countDocuments(), Doctor.countDocuments(), User.countDocuments({ role: { $ne: 'doctor' }, active: true }),
    Department.countDocuments({ active: true }), Visit.countDocuments({ registeredAt: t }),
    LabRequest.countDocuments(), LabRequest.countDocuments({ status: { $ne: 'Completed' } }),
    Prescription.countDocuments(), Prescription.countDocuments({ status: 'Pending' }),
    revenueBetween(t.$gte, t.$lt), revenueBetween(monthStart, new Date(Date.now() + 864e5)),
  ]);
  res.json({ patients, doctors, staff, departments, appointmentsToday, lab: { total: labTotal, pending: labPending }, pharmacy: { total: rxTotal, pending: rxPending }, revenue: { today: revToday, month: revMonth } });
}));
module.exports = router;
