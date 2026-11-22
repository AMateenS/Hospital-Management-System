const mongoose = require('mongoose');
// Admin-designed, doctor-specific layout stored in DB: no code change needed to edit it.
const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text','textarea','number','date','dropdown','checkbox','vitals','medicines'], required: true },
  required: { type: Boolean, default: false },
  options: [String],
  unit: String, placeholder: String,
  order: { type: Number, default: 0 },
}, { _id: false });
module.exports = mongoose.model('PrescriptionTemplate', new mongoose.Schema({
  name: { type: String, required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', index: true },
  fields: [fieldSchema],
  design: {
    logoUrl: String, headerText: String, footerText: String,
    primaryColor: { type: String, default: '#0d9488' }, fontFamily: { type: String, default: 'Inter' },
    showSignature: { type: Boolean, default: true },
  },
  version: { type: Number, default: 1 },
  history: [mongoose.Schema.Types.Mixed],   // snapshots of previous versions
  active: { type: Boolean, default: true },
}, { timestamps: true }));
