const mongoose = require('mongoose');
const availability = new mongoose.Schema({
  day: { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  from: String, to: String,
}, { _id: false });
module.exports = mongoose.model('Doctor', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: String, required: true },
  qualification: String,
  experienceYears: Number,
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  contact: String,
  consultationFee: { type: Number, default: 0 },
  profilePicture: String,
  signatureUrl: String,                         // doctor's own signature image (printed on prescriptions)
  available: { type: Boolean, default: false }, // ticked by the doctor on arrival; shown to reception
  availableSince: Date,
  availability: [availability],
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'PrescriptionTemplate' },
}, { timestamps: true }));
