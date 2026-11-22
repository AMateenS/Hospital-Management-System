const mongoose = require('mongoose');
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);
// Atomic sequential IDs, e.g. nextId('patient','PID-',6) -> PID-000001
Counter.nextId = async (key, prefix = '', pad = 6) => {
  const c = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return prefix + String(c.seq).padStart(pad, '0');
};
module.exports = Counter;
