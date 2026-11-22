const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/helpers');
router.use(protect, authorize('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const { action, role, q, from, to } = req.query; const f = {};
  if (action) f.action = new RegExp('^' + escapeRegex(String(action)), 'i');
  if (role) f.role = String(role);
  if (q) { const r = new RegExp(escapeRegex(String(q)), 'i'); f.$or = [{ entity: r }, { entityId: r }, { path: r }]; }
  if (from || to) { f.createdAt = {}; if (from) f.createdAt.$gte = new Date(from); if (to) { const t = new Date(to); t.setDate(t.getDate() + 1); f.createdAt.$lt = t; } }
  const page = Math.max(1, parseInt(req.query.page) || 1), limit = 25;
  const [rows, total] = await Promise.all([AuditLog.find(f).sort('-createdAt').skip((page - 1) * limit).limit(limit).populate('user', 'name email'), AuditLog.countDocuments(f)]);
  res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));
module.exports = router;
