const AuditLog = require('../models/AuditLog');
// Fire-and-forget audit entry; never blocks or breaks a request.
module.exports = function audit(req, action, entity, entityId, meta) {
  AuditLog.create({
    user: req.user?._id, role: req.user?.role, action, entity,
    entityId: entityId ? String(entityId) : undefined,
    method: req.method, path: req.originalUrl, ip: req.ip, meta,
  }).catch((e) => console.error('audit failed', e.message));
};
