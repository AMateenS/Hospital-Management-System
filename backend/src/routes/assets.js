const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../utils/audit');
const Doctor = require('../models/Doctor');
const { sniff } = require('../utils/fileSniff');
router.use(protect);

const DIR = path.join(__dirname, '../../uploads/logos');
const upload = multer({
  storage: multer.diskStorage({ destination: (q, f, cb) => { fs.mkdirSync(DIR, { recursive: true }); cb(null, DIR); }, filename: (q, f, cb) => cb(null, crypto.randomUUID() + (f.mimetype === 'image/png' ? '.png' : '.jpg')) }),
  limits: { fileSize: 1024 * 1024 }, fileFilter: (q, f, cb) => (['image/png', 'image/jpeg'].includes(f.mimetype) ? cb(null, true) : cb(new Error('Logo must be a PNG or JPG image'))),
});
// SVG is deliberately not allowed (script injection risk).
router.post('/logos', authorize('admin'), (req, res, next) => upload.single('file')(req, res, (e) => (e ? res.status(400).json({ message: e.code === 'LIMIT_FILE_SIZE' ? 'Logo must be 1 MB or smaller' : e.message }) : next())), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file received' });
  if (!['png', 'jpg'].includes(sniff(req.file.path))) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ message: 'File is not a valid PNG or JPG image' }); }
  audit(req, 'LOGO_UPLOAD', 'Asset', req.file.filename);
  res.status(201).json({ url: `/api/assets/logos/${req.file.filename}` });
});
router.get('/logos/:file', (req, res) => {
  if (!/^[a-f0-9-]{36}\.(png|jpg)$/.test(req.params.file)) return res.status(404).json({ message: 'Not found' });
  res.sendFile(path.join(DIR, req.params.file), (e) => e && !res.headersSent && res.status(404).json({ message: 'Not found' }));
});

// ---- Doctor's own signature (PNG/JPG, 500 KB) ----
const SIG = path.join(__dirname, '../../uploads/signatures');
const sigUpload = multer({
  storage: multer.diskStorage({ destination: (q, f, cb) => { fs.mkdirSync(SIG, { recursive: true }); cb(null, SIG); }, filename: (q, f, cb) => cb(null, crypto.randomUUID() + (f.mimetype === 'image/png' ? '.png' : '.jpg')) }),
  limits: { fileSize: 512 * 1024 }, fileFilter: (q, f, cb) => (['image/png', 'image/jpeg'].includes(f.mimetype) ? cb(null, true) : cb(new Error('Signature must be a PNG or JPG image'))),
});
const dropOld = (url) => { const f = url && path.basename(url); if (f && /^[a-f0-9-]{36}\.(png|jpg)$/.test(f)) fs.unlink(path.join(SIG, f), () => {}); };
router.post('/signature', authorize('doctor'), (req, res, next) => sigUpload.single('file')(req, res, (e) => (e ? res.status(400).json({ message: e.code === 'LIMIT_FILE_SIZE' ? 'Signature must be 500 KB or smaller' : e.message }) : next())), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file received' });
    if (!['png', 'jpg'].includes(sniff(req.file.path))) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ message: 'File is not a valid PNG or JPG image' }); }
    const doc = await Doctor.findOne({ user: req.user._id });
    if (!doc) { fs.unlink(req.file.path, () => {}); return res.status(403).json({ message: 'Doctor profile required' }); }
    dropOld(doc.signatureUrl); doc.signatureUrl = `/api/assets/signatures/${req.file.filename}`; await doc.save();
    audit(req, 'SIGNATURE_UPLOAD', 'Doctor', doc._id); res.status(201).json({ url: doc.signatureUrl });
  } catch (e) { next(e); }
});
router.delete('/signature', authorize('doctor'), async (req, res, next) => {
  try { const doc = await Doctor.findOne({ user: req.user._id }); if (!doc) return res.status(403).json({ message: 'Doctor profile required' });
    dropOld(doc.signatureUrl); doc.signatureUrl = undefined; await doc.save(); audit(req, 'SIGNATURE_REMOVE', 'Doctor', doc._id); res.json({ message: 'Removed' }); } catch (e) { next(e); }
});
router.get('/signatures/:file', (req, res) => {
  if (!/^[a-f0-9-]{36}\.(png|jpg)$/.test(req.params.file)) return res.status(404).json({ message: 'Not found' });
  res.sendFile(path.join(SIG, req.params.file), (e) => e && !res.headersSent && res.status(404).json({ message: 'Not found' }));
});
module.exports = router;
