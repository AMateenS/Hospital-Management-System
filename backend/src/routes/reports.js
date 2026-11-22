const router = require('express').Router();
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const LabRequest = require('../models/LabRequest');
const Prescription = require('../models/Prescription');
const DispensingRecord = require('../models/DispensingRecord');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { csv } = require('../utils/csv');
const { TZ } = require('../utils/revenue');
router.use(protect, authorize('admin'));

function range(q) {
  const to = q.to ? new Date(q.to) : new Date(); to.setHours(0, 0, 0, 0); to.setDate(to.getDate() + 1);   // inclusive end day
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 864e5); from.setHours(0, 0, 0, 0);
  return { from, to: to > new Date(from.getTime() + 366 * 864e5) ? new Date(from.getTime() + 366 * 864e5) : to };
}
const day = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });   // YYYY-MM-DD in hospital timezone
const dayFmt = (f) => ({ $dateToString: { format: '%Y-%m-%d', date: f, timezone: TZ } });

router.get('/summary', asyncHandler(async (req, res) => {
  const { from, to } = range(req.query); const rg = { $gte: from, $lt: to };
  const [vrows, doctors, rxDaily, labs, newPatients, rxCreated, diag, feeRows, unpaidRows] = await Promise.all([
    Visit.aggregate([{ $match: { registeredAt: rg } }, { $group: { _id: { day: dayFmt('$registeredAt'), doctor: '$doctor', status: '$status' }, n: { $sum: 1 } } }]),
    Doctor.find().populate('user', 'name').populate('department', 'name'),
    DispensingRecord.aggregate([{ $match: { dispensedAt: rg, paid: { $ne: false } } }, { $group: { _id: dayFmt('$dispensedAt'), total: { $sum: '$total' }, n: { $sum: 1 } } }]),
    LabRequest.aggregate([{ $match: { createdAt: rg } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Patient.countDocuments({ createdAt: rg }), Prescription.countDocuments({ createdAt: rg }),
    Visit.aggregate([{ $match: { registeredAt: rg, 'consultation.diagnosis': { $exists: true, $ne: '' } } }, { $group: { _id: { $toLower: '$consultation.diagnosis' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
    Visit.aggregate([{ $match: { 'fee.status': 'Paid', 'fee.paidAt': rg } }, { $group: { _id: { day: dayFmt('$fee.paidAt'), doctor: '$doctor' }, total: { $sum: { $subtract: ['$fee.amount', { $ifNull: ['$fee.discount', 0] }] } } } }]),
    Visit.aggregate([{ $match: { registeredAt: rg, 'fee.status': 'Unpaid', status: { $ne: 'Cancelled' } } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$fee.amount' } } }]),
  ]);
  const dmap = Object.fromEntries(doctors.map((d) => [String(d._id), d]));
  // daily series (zero-filled)
  const daily = {}; for (let t = new Date(from); t < to; t.setDate(t.getDate() + 1)) daily[day(t)] = { date: day(t), visits: 0, consultationRevenue: 0, pharmacyRevenue: 0 };
  const status = {}, byDoc = {}, byDept = {};
  for (const r of vrows) {
    const d = dmap[String(r._id.doctor)]; const fee = d?.consultationFee || 0;
    if (daily[r._id.day]) { daily[r._id.day].visits += r.n; }
    status[r._id.status] = (status[r._id.status] || 0) + r.n;
    const k = String(r._id.doctor); byDoc[k] = byDoc[k] || { name: d?.user?.name || 'Unknown', specialization: d?.specialization, visits: 0, completed: 0, revenue: 0 };
    byDoc[k].visits += r.n; if (r._id.status === 'Completed') byDoc[k].completed += r.n;
    const dn = d?.department?.name || 'Unknown'; byDept[dn] = (byDept[dn] || 0) + r.n;
  }
  for (const f of feeRows) {   // consultation revenue = fees collected, by the day they were paid
    if (daily[f._id.day]) daily[f._id.day].consultationRevenue += f.total;
    const k = String(f._id.doctor); const d = dmap[k]; byDoc[k] = byDoc[k] || { name: d?.user?.name || 'Unknown', specialization: d?.specialization, visits: 0, completed: 0, revenue: 0 }; byDoc[k].revenue += f.total;
  }
  let pharmacy = 0, dispensed = 0;
  for (const r of rxDaily) { if (daily[r._id]) daily[r._id].pharmacyRevenue += r.total; pharmacy += r.total; dispensed += r.n; }
  const series = Object.values(daily).map((d) => ({ ...d, revenue: d.consultationRevenue + d.pharmacyRevenue }));
  const consultation = series.reduce((s, d) => s + d.consultationRevenue, 0);
  res.json({
    range: { from: day(from), to: day(new Date(to.getTime() - 864e5)), timezone: TZ },
    totals: { newPatients, visits: Object.values(status).reduce((a, b) => a + b, 0), completed: status.Completed || 0, labRequests: labs.reduce((s, l) => s + l.n, 0), prescriptions: rxCreated, dispensed,
      revenue: { consultation, pharmacy, total: consultation + pharmacy }, unpaidFees: { count: unpaidRows[0]?.n || 0, amount: unpaidRows[0]?.amount || 0 } },
    daily: series,
    visitsByStatus: Object.entries(status).map(([name, value]) => ({ name, value })),
    byDepartment: Object.entries(byDept).map(([name, visits]) => ({ name, visits })),
    byDoctor: Object.values(byDoc).sort((a, b) => b.visits - a.visits),
    labByStatus: labs.map((l) => ({ name: l._id, value: l.n })),
    topDiagnoses: diag.map((d) => ({ name: d._id, count: d.n })),
  });
}));

// CSV exports. Cells starting with = + - @ are neutralised to prevent spreadsheet formula injection.
const dt = (d) => (d ? new Date(d).toLocaleString('en-GB', { timeZone: TZ }) : '');
router.get('/export/:type', asyncHandler(async (req, res) => {
  const { from, to } = range(req.query); const rg = { $gte: from, $lt: to }; let out;
  if (req.params.type === 'visits') {
    const v = await Visit.find({ registeredAt: rg }).sort('registeredAt').populate('patient', 'patientId name').populate({ path: 'doctor', populate: [{ path: 'user', select: 'name' }, { path: 'department', select: 'name' }] });
    out = csv(['Visit', 'Date', 'Patient ID', 'Patient', 'Doctor', 'Department', 'Type', 'Status', 'Complaint', 'Diagnosis', 'Fee', 'Discount', 'Fee status', 'Receipt'], v.map((x) => [x.visitNo, dt(x.registeredAt), x.patient?.patientId, x.patient?.name, x.doctor?.user?.name, x.doctor?.department?.name, x.patientType, x.status, x.chiefComplaint, x.consultation?.diagnosis, x.fee?.amount, x.fee?.discount, x.fee?.status, x.fee?.receiptNo]));
  } else if (req.params.type === 'dispensing') {
    const r = await DispensingRecord.find({ dispensedAt: rg }).sort('dispensedAt').populate('patient', 'patientId name').populate('pharmacist', 'name').populate('prescription', 'rxNo');
    out = csv(['Rx', 'Dispensed', 'Patient ID', 'Patient', 'Pharmacist', 'Items', 'Total'], r.map((x) => [x.prescription?.rxNo, dt(x.dispensedAt), x.patient?.patientId, x.patient?.name, x.pharmacist?.name, x.lines.map((i) => `${i.name} x${i.quantity}`).join('; '), x.total]));
  } else if (req.params.type === 'lab') {
    const l = await LabRequest.find({ createdAt: rg }).sort('createdAt').populate('patient', 'patientId name').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } });
    out = csv(['Request', 'Date', 'Patient ID', 'Patient', 'Doctor', 'Tests', 'Status', 'Completed'], l.map((x) => [x.requestNo, dt(x.createdAt), x.patient?.patientId, x.patient?.name, x.doctor?.user?.name, x.tests.map((t) => t.name).join('; '), x.status, dt(x.completedAt)]));
  } else return res.status(404).json({ message: 'Unknown export type' });
  audit(req, 'REPORT_EXPORT', 'Report', req.params.type, { from, to });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="hms-${req.params.type}-${day(from)}_${day(new Date(to.getTime() - 864e5))}.csv"` }).send('\uFEFF' + out);
}));
module.exports = router;
