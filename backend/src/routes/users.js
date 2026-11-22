// Admin: user management (create, role, activate/deactivate, reset password)
const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { passwordRule } = require('../utils/passwords');
router.use(protect, authorize('admin'));

const createSchema = z.object({
  name: z.string().min(2), email: z.string().email(), phone: z.string().optional(),
  role: z.enum(['admin', 'reception', 'doctor', 'laboratory', 'pharmacy']),
  password: passwordRule.optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  const q = {}; if (req.query.role) q.role = req.query.role;
  res.json(await User.find(q).sort('-createdAt'));
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const tempPassword = req.body.password || crypto.randomBytes(9).toString('base64url') + 'A1';
  const u = await User.create({ ...req.body, password: tempPassword, mustChangePassword: true });
  audit(req, 'USER_CREATE', 'User', u._id, { role: u.role });
  res.status(201).json({ user: u.toSafe(), tempPassword });
}));

router.patch('/:id', validate(createSchema.partial().omit({ password: true })), asyncHandler(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!u) return res.status(404).json({ message: 'User not found' });
  audit(req, 'USER_UPDATE', 'User', u._id); res.json(u);
}));

router.patch('/:id/active', validate(z.object({ active: z.boolean() })), asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) return res.status(400).json({ message: 'You cannot deactivate yourself' });
  const u = await User.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true });
  audit(req, req.body.active ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'User', req.params.id); res.json(u);
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  const tempPassword = crypto.randomBytes(9).toString('base64url') + 'A1';
  u.password = tempPassword; u.mustChangePassword = true; await u.save();
  audit(req, 'PASSWORD_RESET', 'User', u._id); res.json({ tempPassword });
}));

module.exports = router;
