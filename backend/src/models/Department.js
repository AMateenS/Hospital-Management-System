const mongoose = require('mongoose');
module.exports = mongoose.model('Department', new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  active: { type: Boolean, default: true },
}, { timestamps: true }));
