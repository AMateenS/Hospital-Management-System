const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { z } = require('zod');
const LabRequest = require('../models/LabRequest');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { autoFlag } = require('../utils/labFlag');
const { sniff } = require('../utils/fileSniff');
router.use(protect);

const FLOW = ['Pending', 'Accepted', 'Sample Collected', 'Processing', 'Completed'];
const populate = (q) => q.populate('patient', 'patientId name age gender phone').populate({ path: 'doctor', populate: { path: 'user', select: 'name' } }).populate('technician', 'name').populate('visit', 'visitNo chiefComplaint consultation.diagnosis');

// Only the requesting doctor, lab staff and admin may touch a request.
async function loadRequest(req, res, allowDoctor = false) {
  const r = await populate(LabRequest.findById(req.params.id));
  if (!r) { res.status(404).json({ message: 'Lab request not found' }); return null; }
  if (req.user.role === 'doctor') {
    const doc = await Doctor.findOne({ user: req.user._id });
    if (!allowDoctor || !doc || String(r.doctor._id) !== String(doc._id)) { res.status(403).json({ message: 'Not allowed' }); return null; }
  }
  return r;
}
// ---------- Staff: overview + queue ----------
router.get('/overview', authorize('laboratory'), asyncHandler(async (req, res) => {
  const all = await LabRequest.find().select('status');
  const n = (s) => all.filter((r) => r.status === s).length;
  res.json({ total: all.length, pending: n('Pending'), sampleCollected: n('Sample Collected'), inProgress: n('Processing') + n('Accepted'), completed: n('Completed'), cancelled: n('Cancelled') });
}));
router.get('/requests', authorize('laboratory'), asyncHandler(async (req, res) => {
  const f = req.query.status ? { status: req.query.status } : {};
  const rows = await populate(LabRequest.find(f).sort('-createdAt').limit(300));
  const rank = { Emergency: 0, Urgent: 1, Routine: 2 }; const closed = (r) => ['Completed', 'Cancelled'].includes(r.status);
  rows.sort((a, b) => closed(a) - closed(b) || (closed(a) ? 0 : (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2)));   // open orders first, emergencies on top
  res.json(rows);
}));
router.get('/requests/:id', authorize('laboratory'), asyncHandler(async (req, res) => { const r = await loadRequest(req, res); if (r) res.json(r); }));

// ---------- Workflow: Accept -> Sample Collected -> (Processing via results) ----------
router.patch('/requests/:id/status', authorize('laboratory'), validate(z.object({ status: z.enum(['Accepted', 'Sample Collected', 'Processing']) })), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res); if (!r) return;
  if (FLOW.indexOf(req.body.status) !== FLOW.indexOf(r.status) + 1) return res.status(409).json({ message: `Cannot move from "${r.status}" to "${req.body.status}"` });
  r.status = req.body.status; r.technician = req.user._id; await r.save();
  audit(req, 'LAB_STATUS', 'LabRequest', r._id, { to: r.status }); res.json(await populate(LabRequest.findById(r._id)));
}));

router.post('/requests/:id/cancel', authorize('laboratory'), validate(z.object({ reason: z.string().trim().min(3, 'Give a reason').max(300) })), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res); if (!r) return;
  if (['Completed', 'Cancelled'].includes(r.status)) return res.status(409).json({ message: `Request is already ${r.status}` });
  r.status = 'Cancelled'; r.cancelReason = req.body.reason; r.cancelledAt = new Date(); r.cancelledBy = req.user._id; await r.save();
  audit(req, 'LAB_CANCEL', 'LabRequest', r._id, { reason: req.body.reason }); res.json(await populate(LabRequest.findById(r._id)));
}));

// ---------- Results (can be saved repeatedly until completed) ----------
const resultSchema = z.object({ tests: z.array(z.object({
  _id: z.string().optional(), name: z.string().min(1), result: z.string().max(200).optional().default(''), unit: z.string().max(30).optional().default(''),
  referenceRange: z.string().max(60).optional().default(''), flag: z.enum(['Normal', 'High', 'Low', 'Critical', '']).optional().default(''), done: z.boolean().optional().default(false),
})).min(1) });
router.put('/requests/:id/results', authorize('laboratory'), validate(resultSchema), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res); if (!r) return;
  if (!['Sample Collected', 'Processing'].includes(r.status)) return res.status(409).json({ message: r.status === 'Completed' ? 'Report is completed and locked' : 'Collect the sample before entering results' });
  r.tests = req.body.tests.map((t) => ({ ...t, flag: t.flag || autoFlag(t.result, t.referenceRange), _id: t._id || undefined }));
  r.status = 'Processing'; r.technician = req.user._id; await r.save();
  audit(req, 'LAB_RESULTS_SAVE', 'LabRequest', r._id); res.json(await populate(LabRequest.findById(r._id)));
}));
router.post('/requests/:id/complete', authorize('laboratory'), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res); if (!r) return;
  if (!['Sample Collected', 'Processing'].includes(r.status)) return res.status(409).json({ message: 'Request is not in progress' });
  const notReady = r.tests.filter((t) => !String(t.result || '').trim() && !t.done);
  if (notReady.length) return res.status(400).json({ message: `Enter a result or tick "Done" for: ${notReady.map((t) => t.name).join(', ')}` });
  const noValue = r.tests.filter((t) => !String(t.result || '').trim());
  if (noValue.length && !r.reportFile) return res.status(400).json({ message: `Upload the report file to confirm tests without typed results: ${noValue.map((t) => t.name).join(', ')}` });
  r.status = 'Completed'; r.completedAt = new Date(); r.technician = req.user._id; await r.save();   // visible in doctor's record immediately
  audit(req, 'LAB_COMPLETE', 'LabRequest', r._id); res.json(await populate(LabRequest.findById(r._id)));
}));

// ---------- Report file upload / download ----------
const DIR = path.join(__dirname, '../../uploads/lab');
const EXT = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };
const upload = multer({
  storage: multer.diskStorage({ destination: (q, f, cb) => { fs.mkdirSync(DIR, { recursive: true }); cb(null, DIR); }, filename: (q, f, cb) => cb(null, crypto.randomUUID() + (EXT[f.mimetype] || '')) }),
  limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (q, f, cb) => (EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only PDF, PNG or JPG files are allowed'))),
});
router.post('/requests/:id/report', authorize('laboratory'), (req, res, next) => upload.single('file')(req, res, (e) => (e ? res.status(400).json({ message: e.message }) : next())),
  asyncHandler(async (req, res) => {
    const r = await loadRequest(req, res); if (!r) return;
    if (!req.file) return res.status(400).json({ message: 'No file received' });
    if (sniff(req.file.path) !== EXT[req.file.mimetype].slice(1)) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ message: 'File content does not match its type' }); }
    if (r.status === 'Completed') { fs.unlink(req.file.path, () => {}); return res.status(409).json({ message: 'Report is completed and locked' }); }
    if (r.reportFile) fs.unlink(path.join(DIR, path.basename(r.reportFile)), () => {});
    r.reportFile = req.file.filename; await r.save(); audit(req, 'LAB_REPORT_UPLOAD', 'LabRequest', r._id); res.json({ reportFile: r.reportFile });
  }));
router.get('/requests/:id/report', authorize('laboratory', 'doctor'), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res, true); if (!r) return;
  if (!r.reportFile) return res.status(404).json({ message: 'No file uploaded' });
  if (req.user.role === 'doctor' && r.status !== 'Completed') return res.status(409).json({ message: 'Report not completed' });
  audit(req, 'LAB_REPORT_DOWNLOAD', 'LabRequest', r._id);
  res.sendFile(path.join(DIR, path.basename(r.reportFile)));
}));

// ---------- Printable report data (lab staff and the requesting doctor) ----------
router.get('/requests/:id/sheet', authorize('laboratory', 'doctor'), asyncHandler(async (req, res) => {
  const r = await loadRequest(req, res, true); if (!r) return;
  if (req.user.role === 'doctor' && r.status !== 'Completed') return res.status(409).json({ message: 'Results are not ready yet' });
  res.json({
    hospital: { name: process.env.HOSPITAL_NAME || 'Hospital', address: process.env.HOSPITAL_ADDRESS, phone: process.env.HOSPITAL_PHONE },
    requestNo: r.requestNo, status: r.status, priority: r.priority, indication: r.indication, requestedAt: r.createdAt, reportDate: r.completedAt, draft: r.status !== 'Completed',
    patient: r.patient, doctor: r.doctor?.user?.name, technician: r.technician?.name, hasFile: !!r.reportFile,
    tests: r.tests.map((t) => ({ name: t.name, result: t.result, unit: t.unit, referenceRange: t.referenceRange, flag: t.flag })),
  });
}));
module.exports = router;
