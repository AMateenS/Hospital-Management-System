const mongoose = require('mongoose');
module.exports = mongoose.model('Medicine', new mongoose.Schema({
  name: { type: String, required: true, index: true },
  genericName: String, category: String, strength: String, manufacturer: String,
  batchNo: String, expiryDate: Date,
  purchasePrice: { type: Number, min: 0 }, sellingPrice: { type: Number, min: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  minStock: { type: Number, default: 10, min: 0 },
}, { timestamps: true }));
