require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const Department = require('./models/Department');
const Doctor = require('./models/Doctor');
const PrescriptionTemplate = require('./models/PrescriptionTemplate');
const Medicine = require('./models/Medicine');
const { addMissing } = require('./utils/defaultFields');

(async () => {
  if (process.env.NODE_ENV === 'production') { console.error('Refusing to seed demo accounts in production. Use: npm run create-admin'); process.exit(1); }
  await connectDB();
  const PW = 'Hospital@12345'; // DEV ONLY - users must change on first login
  const mk = async (name, email, role) =>
    (await User.findOne({ email })) || User.create({ name, email, role, password: PW, mustChangePassword: true });

  await mk('System Admin', 'admin@hms.local', 'admin');
  await mk('Front Desk', 'reception@hms.local', 'reception');
  await mk('Lab Technician', 'lab@hms.local', 'laboratory');
  await mk('Pharmacist', 'pharmacy@hms.local', 'pharmacy');

  const dept = async (name) => (await Department.findOne({ name })) || Department.create({ name });
  const cardio = await dept('Cardiology'), gen = await dept('General Medicine');

  const doc = async (name, email, spec, department, fee, fields) => {
    const user = await mk(name, email, 'doctor');
    let d = await Doctor.findOne({ user: user._id });
    if (!d) {
      d = await Doctor.create({ user: user._id, specialization: spec, department: department._id, consultationFee: fee, qualification: 'MBBS', experienceYears: 8,
        availability: ['Mon','Tue','Wed','Thu','Fri'].map(day => ({ day, from: '09:00', to: '14:00' })) });
      const t = await PrescriptionTemplate.create({ name: `${name} - ${spec}`, doctor: d._id, fields: addMissing(fields).fields,
        design: { headerText: 'City General Hospital', footerText: 'Get well soon' } });
      d.template = t._id; await d.save();
    }
  };
  await doc('Dr. Ahmed', 'ahmed@hms.local', 'Cardiologist', cardio, 2500, [
    { key: 'bp', label: 'Blood Pressure', type: 'text', required: true },
    { key: 'pulse', label: 'Pulse', type: 'number', unit: 'bpm' },
    { key: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: true },
    { key: 'cardiac_exam', label: 'Cardiac Examination', type: 'textarea' },
    { key: 'medicines', label: 'Medication', type: 'medicines', required: true },
    { key: 'followup', label: 'Follow-up Instructions', type: 'textarea' },
  ]);
  await doc('Dr. Ali', 'ali@hms.local', 'General Physician', gen, 1500, [
    { key: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    { key: 'weight', label: 'Weight', type: 'number', unit: 'kg' },
    { key: 'symptoms', label: 'Symptoms', type: 'textarea' },
    { key: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: true },
    { key: 'treatment', label: 'Treatment', type: 'textarea' },
    { key: 'medicines', label: 'Prescription', type: 'medicines', required: true },
  ]);

  if (!(await Medicine.countDocuments())) {
    const exp = (m) => new Date(Date.now() + m * 30 * 864e5);
    await Medicine.insertMany([
      { name: 'Panadol', genericName: 'Paracetamol', category: 'Analgesic', strength: '500mg', manufacturer: 'GSK', batchNo: 'B101', expiryDate: exp(18), purchasePrice: 8, sellingPrice: 12, quantity: 500, minStock: 100 },
      { name: 'Augmentin', genericName: 'Amoxicillin/Clavulanate', category: 'Antibiotic', strength: '625mg', manufacturer: 'GSK', batchNo: 'B102', expiryDate: exp(12), purchasePrice: 90, sellingPrice: 120, quantity: 8, minStock: 20 },
      { name: 'Concor', genericName: 'Bisoprolol', category: 'Beta blocker', strength: '5mg', manufacturer: 'Merck', batchNo: 'B103', expiryDate: exp(24), purchasePrice: 25, sellingPrice: 35, quantity: 200, minStock: 40 },
      { name: 'Brufen', genericName: 'Ibuprofen', category: 'NSAID', strength: '400mg', manufacturer: 'Abbott', batchNo: 'B104', expiryDate: exp(-1), purchasePrice: 6, sellingPrice: 10, quantity: 60, minStock: 30 },
    ]);
  }
  console.log('Seeded. Dev password for all users:', PW);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
