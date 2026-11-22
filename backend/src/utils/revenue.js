const Visit = require('../models/Visit');
const DispensingRecord = require('../models/DispensingRecord');
const TZ = process.env.HOSPITAL_TZ || 'UTC';
exports.TZ = TZ;

// Revenue definition (shown in the UI):
//   consultation = consultation fees actually COLLECTED at reception in the period (net of discount; waived fees count 0)
//   pharmacy     = pharmacy bills PAID (dispensed on credit and not yet paid are not counted)
exports.revenueBetween = async (from, to) => {
  const [fees, rx] = await Promise.all([
    Visit.aggregate([{ $match: { 'fee.status': 'Paid', 'fee.paidAt': { $gte: from, $lt: to } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$fee.amount', { $ifNull: ['$fee.discount', 0] }] } } } }]),
    DispensingRecord.aggregate([{ $match: { dispensedAt: { $gte: from, $lt: to }, paid: { $ne: false } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
  ]);
  const consultation = fees[0]?.total || 0; const pharmacy = rx[0]?.total || 0;
  return { consultation, pharmacy, total: consultation + pharmacy };
};
