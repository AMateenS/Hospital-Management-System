const mongoose = require('mongoose');
module.exports = mongoose.model('AuditLog', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  role: String, action: { type: String, index: true },
  entity: String, entityId: String, method: String, path: String,
  status: Number, ip: String, meta: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } }));
