// One-off, safe to run repeatedly:  npm run migrate
//  - lab status "In Progress" -> "Processing"
//  - marks open prescriptions (Draft / Pending / Returned) for the one-open-prescription-per-visit rule
//  - adds the standard fields (symptoms & observations, additional advice, doctor notes) to existing templates as a NEW template version
require('dotenv').config();
const connectDB = require('./config/db');
const LabRequest = require('./models/LabRequest');
const Prescription = require('./models/Prescription');
const PrescriptionTemplate = require('./models/PrescriptionTemplate');
const { addMissing } = require('./utils/defaultFields');
const Visit = require('./models/Visit');
const Doctor = require('./models/Doctor');
const { initialFee } = require('./utils/billing');
(async () => {
  await connectDB();
  const l = await LabRequest.collection.updateMany({ status: 'In Progress' }, { $set: { status: 'Processing' } });
  const r = await Prescription.collection.updateMany({ status: { $in: Prescription.OPEN }, isOpen: { $ne: true } }, { $set: { isOpen: true } });
  let t = 0;
  for (const tpl of await PrescriptionTemplate.find({ active: { $ne: false } })) {
    const { fields, added } = addMissing(tpl.toObject().fields);
    if (!added.length) continue;
    tpl.history.push({ version: tpl.version, savedAt: new Date(), name: tpl.name, fields: tpl.toObject().fields, design: tpl.toObject().design });
    tpl.fields = fields; tpl.version += 1; await tpl.save(); t++;
  }
  // Older visits had no fee record. Completed ones were counted as revenue before, so they are marked Paid (cash, assumed); others Unpaid.
  let f = 0; const docs = Object.fromEntries((await Doctor.find().select('consultationFee')).map((d) => [String(d._id), d]));
  for (const v of await Visit.find({ 'fee.status': { $exists: false } }).select('doctor status registeredAt consultation.finalizedAt')) {
    const fee = initialFee(docs[String(v.doctor)]);
    if (fee.status === 'Unpaid' && v.status === 'Completed') Object.assign(fee, { status: 'Paid', method: 'Cash', paidAt: v.consultation?.finalizedAt || v.registeredAt, note: 'Backfilled by migration (assumed paid)' });
    await Visit.collection.updateOne({ _id: v._id }, { $set: { fee } }); f++;
  }
  await Prescription.syncIndexes();
  console.log(`Lab orders renamed: ${l.modifiedCount} | prescriptions marked open: ${r.modifiedCount} | templates upgraded: ${t} | visits given a fee record: ${f}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
