const mongoose = require('mongoose');
const patientSchema = new mongoose.Schema({
  patientId: { type: String, unique: true, index: true },        // PID-000001
  name: { type: String, required: true, trim: true, index: true },
  guardianName: String,                                          // father/husband
  dob: Date,
  age: Number,
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  phone: { type: String, required: true, index: true },
  address: String,
  history: {
    medicalHistory: String,
    allergies: [String],
    currentMedications: [String],
    previousDiagnoses: [String],
  },
}, { timestamps: true });
patientSchema.index({ name: 'text', patientId: 'text', phone: 'text' });
module.exports = mongoose.model('Patient', patientSchema);
