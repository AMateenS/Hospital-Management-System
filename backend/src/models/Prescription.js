const mongoose = require('mongoose');
const OPEN = ['Draft', 'Pending', 'Returned'];     // doctor can still change these; only one open prescription per visit
const schema = new mongoose.Schema({
  rxNo: { type: String, unique: true },
  visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  diagnosis: String,                                    // snapshot of what the doctor wrote
  details: [{ _id: false, label: String, value: String }],   // advice, observations, doctor notes... (read-only for pharmacy)
  items: [{
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    name: String, strength: String, dosage: String, frequency: String, duration: String, quantity: Number, instructions: String,
    availability: { type: String, enum: ['Unknown', 'Available', 'Unavailable'], default: 'Unknown' },
    dispensedQty: { type: Number, default: 0 }, batchNo: String, unitPrice: Number,
  }],
  status: { type: String, enum: ['Draft', 'Pending', 'Partially Dispensed', 'Dispensed', 'Returned'], default: 'Pending', index: true },
  isOpen: { type: Boolean, default: false },
  lockedAt: Date,                                         // short lock while a dispensing request is processed (no double dispensing)
  issuedAt: Date,
  returnReason: String, returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, returnedAt: Date,
  totalAmount: { type: Number, default: 0 },           // cumulative across dispensing records
  dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dispensedAt: Date,
}, { timestamps: true });
schema.pre('save', function (next) { this.isOpen = OPEN.includes(this.status); next(); });
// Database-level guard against duplicate open prescriptions for one visit (double clicks, retries)
schema.index({ visit: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
module.exports = mongoose.model('Prescription', schema);
module.exports.OPEN = OPEN;
