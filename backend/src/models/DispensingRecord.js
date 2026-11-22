const mongoose = require('mongoose');
const line = new mongoose.Schema({ itemId: mongoose.Schema.Types.ObjectId, name: String, strength: String, medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }, batchNo: String, quantity: Number, unitPrice: Number, lineTotal: Number }, { _id: false });
// One record per dispensing event (a prescription can be dispensed in several parts)
module.exports = mongoose.model('DispensingRecord', new mongoose.Schema({
  prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true, index: true },
  visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
  pharmacist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  billNo: { type: String, index: true },
  lines: [line], subtotal: { type: Number, default: 0 }, discount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },                    // net amount payable (after discount)
  paymentMethod: String, paid: { type: Boolean, default: true }, paidAt: Date,   // paid:false = pay later; records without the field are treated as paid
  dispensedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true }));
