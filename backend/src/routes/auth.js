const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { passwordRule } = require('../utils/passwords');

const MAX_FAILS = 5, LOCK_MIN = 15;
const cookieOpts = () => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', maxAge: 8 * 3600 * 1000 });
const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

router.post('/login', validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    const bad = () => res.status(401).json({ message: 'Invalid email or password' });
    if (!user || !user.active) return bad();
    if (user.lockUntil && user.lockUntil > new Date()) return res.status(423).json({ message: 'Account locked. Try again later.' });
    if (!(await user.verifyPassword(req.body.password))) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MIN * 60000); user.failedLogins = 0; }
      await user.save();
      return bad();
    }
    user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date();
    await user.save();
    req.user = user; audit(req, 'LOGIN', 'User', user._id);
    res.cookie('hms_token', sign(user), cookieOpts());
    const doctor = user.role === 'doctor' ? await Doctor.findOne({ user: user._id }).populate('department') : null;
    res.json({ user: user.toSafe(), doctor });
  }));

router.post('/logout', protect, asyncHandler(async (req, res) => {
  audit(req, 'LOGOUT', 'User', req.user._id);
  if (req.user.role === 'doctor') await Doctor.updateOne({ user: req.user._id }, { available: false, availableSince: undefined });   // leaving = not available
  res.clearCookie('hms_token').json({ message: 'Logged out' });
}));

router.get('/me', protect, asyncHandler(async (req, res) => {
  const doctor = req.user.role === 'doctor' ? await Doctor.findOne({ user: req.user._id }).populate('department template') : null;
  res.json({ user: req.user.toSafe(), doctor });
}));

router.post('/change-password',
  protect, validate(z.object({ currentPassword: z.string(), newPassword: passwordRule })),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.verifyPassword(req.body.currentPassword))) return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = req.body.newPassword; user.mustChangePassword = false;
    await user.save(); audit(req, 'PASSWORD_CHANGE', 'User', user._id);
    res.cookie('hms_token', sign(user), cookieOpts());   // old tokens are now invalid; keep this session alive
    res.json({ message: 'Password updated' });
  }));

module.exports = router;
