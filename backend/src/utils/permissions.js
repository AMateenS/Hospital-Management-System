exports.PHARMACY_PERMISSIONS = ['dispense', 'inventory', 'return_to_doctor', 'receipts'];
const LABEL = { dispense: 'dispense medicines', inventory: 'change the medicine inventory', return_to_doctor: 'return prescriptions to doctors', receipts: 'view dispensing receipts' };
// admin: always. pharmacy: undefined permissions = full access (accounts created before this feature); otherwise must be listed.
exports.hasPermission = (user, p) => user.role === 'admin' || (user.role === 'pharmacy' && (!user.permissions || user.permissions.includes(p)));
exports.requirePermission = (p) => (req, res, next) => (exports.hasPermission(req.user, p) ? next() : res.status(403).json({ message: `Your account is not allowed to ${LABEL[p]}` }));
