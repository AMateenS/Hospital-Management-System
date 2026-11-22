const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ROLES = ['admin', 'reception', 'doctor', 'laboratory', 'pharmacy'];
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true, index: true },
  phone: String,
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  lastLoginAt: Date,
  passwordChangedAt: Date,
  licenseNo: String, employeeId: String,                    // pharmacist details
  permissions: { type: [String], default: undefined },     // pharmacy only; undefined = full access (legacy accounts)
}, { timestamps: true });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date(Date.now() - 1000);   // invalidates tokens issued before this
  next();
});
userSchema.methods.verifyPassword = function (plain) { return bcrypt.compare(plain, this.password); };
userSchema.methods.toSafe = function () {
  const o = this.toObject(); delete o.password; delete o.failedLogins; delete o.lockUntil; return o;
};
module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
