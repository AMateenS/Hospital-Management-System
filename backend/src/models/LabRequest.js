const mongoose = require('mongoose');
const testSchema = new mongoose.Schema({
  name: { type: String, required: true }, category: String,
  result: String, unit: String, referenceRange: String, done: { type: Boolean, default: false },
  flag: { type: String, enum: ['Normal','High','Low','Critical',''], default: '' },
});
module.exports = mongoose.model('LabRequest', new mongoose.Schema({
  requestNo: { type: String, unique: true },
  visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  tests: [testSchema],
  priority: { type: String, enum: ['Routine', 'Urgent', 'Emergency'], default: 'Routine', index: true },
  indication: String, instructions: String,
  cancelReason: String, cancelledAt: Date, cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Pending','Accepted','Sample Collected','Processing','Completed','Cancelled'], default: 'Pending', index: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportFile: String,
  completedAt: Date,
}, { timestamps: true }));
