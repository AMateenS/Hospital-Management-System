const mongoose = require('mongoose');
// One visit = one registration -> consultation episode. Links every module together.
const visitSchema = new mongoose.Schema({
  visitNo: { type: String, unique: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  patientType: { type: String, enum: ['New', 'Follow-up'], default: 'New' },
  registeredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['Waiting','In Consultation','Completed','Referred','Cancelled'], default: 'Waiting', index: true },
  chiefComplaint: String,
  symptoms: [String],
  vitals: { weightKg: Number, heightCm: Number, bloodPressure: String, temperatureC: Number, pulse: Number, spo2: Number },
  notes: String,
  fee: {                                            // consultation fee, collected at reception
    amount: { type: Number, default: 0 }, discount: { type: Number, default: 0 },
    status: { type: String, enum: ['Unpaid', 'Paid', 'Waived'], default: 'Unpaid' },
    method: String, paidAt: Date, receiptNo: String, receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: String,
  },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  consultation: {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrescriptionTemplate' },
    templateVersion: Number,
    templateSnapshot: mongoose.Schema.Types.Mixed,                 // exact template used, so old records always print as written
    data: mongoose.Schema.Types.Mixed,
    diagnosis: String,
    observations: String,
    treatmentPlan: String,
    followUpDate: Date,
    finalized: { type: Boolean, default: false },
    finalizedAt: Date,
  },
  // Append-only amendments: finalized records are never silently overwritten
  amendments: [{ at: Date, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: String, previous: mongoose.Schema.Types.Mixed }],
}, { timestamps: true });
visitSchema.index({ 'fee.paidAt': 1 });
visitSchema.index({ 'fee.status': 1, registeredAt: -1 });
module.exports = mongoose.model('Visit', visitSchema);
