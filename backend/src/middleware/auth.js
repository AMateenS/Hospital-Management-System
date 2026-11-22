const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Reads JWT from an httpOnly cookie (preferred) or Bearer header.
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.hms_token || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ message: 'Session expired or invalid' }); }
  const user = await User.findById(payload.id);
  if (!user || !user.active) return res.status(401).json({ message: 'Account disabled or not found' });
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) return res.status(401).json({ message: 'Password changed. Please sign in again.' });
  // Temporary/reset passwords must be replaced before anything else is allowed.
  if (user.mustChangePassword && !req.originalUrl.startsWith('/api/auth/')) return res.status(403).json({ message: 'You must change your password first', code: 'PASSWORD_CHANGE_REQUIRED' });
  req.user = user;
  next();
});

// Role-based access control. Admin always passes.
exports.authorize = (...roles) => (req, res, next) => {
  if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
  res.status(403).json({ message: 'You do not have permission for this action' });
};
