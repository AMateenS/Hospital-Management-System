// End-to-end API tests. Needs a throw-away MongoDB database whose name ends in "_test":
//   MONGO_URI_TEST=mongodb://127.0.0.1:27017/hms_test npm run test:integration
// WARNING: the database is wiped at the start.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
const uri = process.env.MONGO_URI_TEST;
if (!uri || !/_test(\?|$)/.test(uri)) { console.error('Set MONGO_URI_TEST to a database whose name ends with _test'); process.exit(1); }

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Doctor = require('../../src/models/Doctor');
const Department = require('../../src/models/Department');
const Medicine = require('../../src/models/Medicine');
const Prescription = require('../../src/models/Prescription');
const Visit = require('../../src/models/Visit');
const DispensingRecord = require('../../src/models/DispensingRecord');
const LabRequest = require('../../src/models/LabRequest');
const PrescriptionTemplate = require('../../src/models/PrescriptionTemplate');

const PW = 'Passw0rd-Test1';
const future = new Date(Date.now() + 365 * 864e5), past = new Date(Date.now() - 30 * 864e5);
const S = {};   // shared state across the ordered tests
const login = async (email, password = PW) => { const a = request.agent(app); await a.post('/api/auth/login').send({ email, password }); return a; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  await mongoose.connect(uri); await mongoose.connection.dropDatabase();
  const dept = await Department.create({ name: 'General' });
  const mk = (name, email, role, extra = {}) => User.create({ name, email, role, password: PW, mustChangePassword: false, ...extra });
  await mk('Admin', 'admin@t.io', 'admin'); await mk('Reception', 'rec@t.io', 'reception'); await mk('Lab', 'lab@t.io', 'laboratory'); await mk('Pharm', 'ph@t.io', 'pharmacy');
  for (const [k, name] of [['A', 'Doctor A'], ['B', 'Doctor B']]) {
    const u = await mk(name, `doc${k}@t.io`, 'doctor');
    const d = await Doctor.create({ user: u._id, specialization: 'GP', department: dept._id, consultationFee: 1000 });
    const t = await PrescriptionTemplate.create({ name: `${name} tpl`, doctor: d._id, design: {}, fields: [
      { key: 'diagnosis', label: 'Diagnosis', type: 'textarea', required: true, order: 0 }, { key: 'medicines', label: 'Prescription', type: 'medicines', required: true, order: 1 }] });
    d.template = t._id; await d.save(); S['d' + k] = d;
  }
  S.panadol = await Medicine.create({ name: 'Panadol', genericName: 'Paracetamol', strength: '500mg', quantity: 10, minStock: 2, expiryDate: future, sellingPrice: 5, purchasePrice: 3, batchNo: 'B1' });
  S.expired = await Medicine.create({ name: 'OldMed', quantity: 10, minStock: 2, expiryDate: past, sellingPrice: 5, purchasePrice: 3, batchNo: 'X1' });
  S.rec = await login('rec@t.io'); S.docA = await login('docA@t.io'); S.docB = await login('docB@t.io'); S.lab = await login('lab@t.io'); S.ph = await login('ph@t.io'); S.admin = await login('admin@t.io');
});
after(async () => { await mongoose.disconnect(); });

describe('authentication & access control', () => {
  it('rejects unauthenticated requests', async () => { await request(app).get('/api/patients').expect(401); });
  it('enforces roles (reception cannot manage users; doctor cannot open lab queue)', async () => {
    await S.rec.get('/api/users').expect(403); await S.docA.get('/api/lab/overview').expect(403); await S.rec.get('/api/pharmacy/overview').expect(403);
  });
  it('locks the account after 5 failed logins', async () => {
    await User.create({ name: 'Lock', email: 'lock@t.io', role: 'reception', password: PW, mustChangePassword: false });
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ email: 'lock@t.io', password: 'wrong' }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'lock@t.io', password: PW }).expect(423);
  });
  it('blocks NoSQL operator injection in query and body', async () => {
    await S.rec.get('/api/visits?status[$ne]=x').expect(400);
    await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } }).expect(400);
  });
  it('forces a password change before anything else', async () => {
    await User.create({ name: 'New', email: 'new@t.io', role: 'reception', password: PW, mustChangePassword: true });
    const a = await login('new@t.io');
    await a.get('/api/auth/me').expect(200);
    const r = await a.get('/api/patients').expect(403); assert.equal(r.body.code, 'PASSWORD_CHANGE_REQUIRED');
  });
  it('invalidates other sessions when the password changes, keeps the current one', async () => {
    await User.create({ name: 'Pw', email: 'pw@t.io', role: 'reception', password: PW, mustChangePassword: false });
    const a1 = await login('pw@t.io'), a2 = await login('pw@t.io'); await wait(1100);
    await a1.post('/api/auth/change-password').send({ currentPassword: PW, newPassword: 'Another-Passw0rd' }).expect(200);
    await a2.get('/api/auth/me').expect(401); await a1.get('/api/auth/me').expect(200);
  });
});

describe('reception -> doctor -> pharmacy workflow', () => {
  it('registers a patient with an auto ID and assigns the doctor', async () => {
    const body = { patient: { name: 'Test Patient', gender: 'Male', phone: '03001234567', age: 30 }, visit: { doctorId: String(S.dA._id), chiefComplaint: 'Fever', symptoms: ['Fever'], vitals: { bloodPressure: '120/80' } } };
    const r = await S.rec.post('/api/patients/register').send(body).expect(201);
    assert.match(r.body.patient.patientId, /^PID-\d{6}$/); S.patient = r.body.patient; S.visit = r.body.visit; S.body = body;
    const list = await S.docA.get('/api/doctor/overview').expect(200); assert.equal(list.body.stats.waiting, 1);
  });
  it('warns about duplicates unless forced', async () => {
    const r = await S.rec.post('/api/patients/register').send(S.body).expect(409); assert.equal(r.body.matches.length, 1);
    await S.rec.post('/api/patients/register').send({ ...S.body, force: true }).expect(201);
  });
  it('keeps each doctor to their own patients', async () => {
    await S.docB.get(`/api/doctor/visits/${S.visit._id}`).expect(403);
    await S.docB.get(`/api/patients/${S.patient._id}`).expect(403);
    await S.docA.get(`/api/doctor/visits/${S.visit._id}`).expect(200);
  });
  it('requires template-required fields to complete, then issues a pending prescription', async () => {
    await S.docA.post(`/api/doctor/visits/${S.visit._id}/complete`).send({ data: {} }).expect(400);
    const data = { diagnosis: 'Viral fever', medicines: [{ name: 'Panadol', strength: '500mg', dosage: '1 tab', frequency: 'Twice daily', duration: '3 days', quantity: 6 }] };
    const r = await S.docA.post(`/api/doctor/visits/${S.visit._id}/complete`).send({ data }).expect(200);
    assert.ok(r.body.prescription.rxNo); S.rx = r.body.prescription;
    assert.equal((await Prescription.findById(S.rx._id)).status, 'Pending');
  });
  it('never silently overwrites a finalized record', async () => {
    await S.docA.put(`/api/doctor/visits/${S.visit._id}/consultation`).send({ data: { diagnosis: 'changed' } }).expect(409);
    await S.docA.post(`/api/doctor/visits/${S.visit._id}/amend`).send({ data: { diagnosis: 'x', medicines: [] } }).expect(400);   // reason required
    await S.rec.patch(`/api/visits/${S.visit._id}/status`).send({ status: 'Waiting' }).expect(409);
  });
});

describe('laboratory flow', () => {
  it('enforces the step order and requires every result', async () => {
    const lr = await S.docA.post(`/api/doctor/visits/${S.visit._id}/lab-requests`).send({ tests: ['Blood sugar'], indication: 'Polyuria, check glucose', priority: 'Urgent' }).expect(201); const id = lr.body._id;
    assert.equal(lr.body.priority, 'Urgent');
    await S.docA.post(`/api/doctor/visits/${S.visit._id}/lab-requests`).send({ tests: ['Blood sugar'], indication: 'again' }).expect(409);   // same open order is not duplicated
    await S.docA.post(`/api/doctor/visits/${S.visit._id}/lab-requests`).send({ tests: ['CBC'] }).expect(400);                                          // indication is required
    await S.lab.put(`/api/lab/requests/${id}/results`).send({ tests: [{ name: 'Blood sugar', result: '90' }] }).expect(409);        // not accepted yet
    await S.lab.patch(`/api/lab/requests/${id}/status`).send({ status: 'Accepted' }).expect(200);
    await S.lab.patch(`/api/lab/requests/${id}/status`).send({ status: 'Processing' }).expect(409);                              // cannot skip
    await S.lab.patch(`/api/lab/requests/${id}/status`).send({ status: 'Sample Collected' }).expect(200);
    await S.lab.put(`/api/lab/requests/${id}/results`).send({ tests: [{ name: 'Blood sugar', result: '' }] }).expect(200);
    await S.lab.post(`/api/lab/requests/${id}/complete`).expect(400);                                                               // empty result
    const saved = await S.lab.put(`/api/lab/requests/${id}/results`).send({ tests: [{ name: 'Blood sugar', result: '150', unit: 'mg/dL', referenceRange: '70-140' }] }).expect(200);
    assert.equal(saved.body.tests[0].flag, 'High');
    await S.lab.post(`/api/lab/requests/${id}/complete`).expect(200);
    await S.lab.put(`/api/lab/requests/${id}/results`).send({ tests: [{ name: 'Blood sugar', result: '1' }] }).expect(409);        // locked
    const rec = await S.docA.get(`/api/doctor/visits/${S.visit._id}`).expect(200);
    assert.equal(rec.body.labs[0].status, 'Completed'); assert.equal(rec.body.labs[0].tests[0].result, '150');
    await S.docB.get(`/api/lab/requests/${id}/sheet`).expect(403);                                                                  // other doctor cannot read it
  });
});

describe('pharmacy dispensing', () => {
  const lines = (a) => ({ lines: [a] });
  it('shows the doctor\'s real prescription and blocks expired stock and over-dispensing', async () => {
    const rx = (await S.ph.get(`/api/pharmacy/prescriptions/${S.rx._id}`).expect(200)).body; const item = rx.items[0]; S.itemId = item._id;
    assert.equal(rx.diagnosis, 'Viral fever'); assert.equal(item.name, 'Panadol'); assert.equal(item.remaining, 6);
    const d = (body) => S.ph.post(`/api/pharmacy/prescriptions/${S.rx._id}/dispense`).send(lines(body));
    await d({ itemId: S.itemId, action: 'dispense', medicineId: String(S.expired._id), quantity: 1 }).expect(409);       // expired
    await d({ itemId: S.itemId, action: 'dispense', medicineId: String(S.panadol._id), quantity: 99 }).expect(409);      // more than prescribed
    await d({ itemId: S.itemId, action: 'dispense', medicineId: String(S.panadol._id) }).expect(400);                    // quantity missing
    assert.equal((await Medicine.findById(S.panadol._id)).quantity, 10);
  });
  it('dispenses in parts: Partially Dispensed, then Dispensed; stock and records follow', async () => {
    const d = (qty) => S.ph.post(`/api/pharmacy/prescriptions/${S.rx._id}/dispense`).send(lines({ itemId: S.itemId, action: 'dispense', medicineId: String(S.panadol._id), quantity: qty }));
    let r = await d(2).expect(200);
    assert.equal(r.body.prescription.status, 'Partially Dispensed'); assert.equal(r.body.record.total, 10);
    assert.equal((await Medicine.findById(S.panadol._id)).quantity, 8);
    r = await d(4).expect(200); assert.equal(r.body.prescription.status, 'Dispensed'); assert.equal((await Medicine.findById(S.panadol._id)).quantity, 4);
    assert.equal(await DispensingRecord.countDocuments({ prescription: S.rx._id }), 2);
    assert.equal((await Prescription.findById(S.rx._id)).totalAmount, 30);
    await d(1).expect(409);                                                                                              // nothing left
    const rc = await S.ph.get(`/api/pharmacy/prescriptions/${S.rx._id}/receipt`).expect(200); assert.equal(rc.body.total, 30); assert.equal(rc.body.lines.length, 2);
  });
  it('a pharmacist cannot change the doctor\'s prescription (no such endpoint)', async () => {
    await S.ph.put(`/api/pharmacy/prescriptions/${S.rx._id}`).send({ diagnosis: 'x' }).expect(404);
    await S.docA.get('/api/pharmacy/overview').expect(403);
  });
});

describe('save & send, return to doctor, tolerant visit link', () => {
  const sendBody = (dx) => ({ data: { diagnosis: dx, medicines: [{ name: 'Panadol', strength: '500mg', dosage: '1 tab', frequency: 'Once daily', duration: '2 days', quantity: 2 }] } });
  it('opens a visit even when the link carries the patient id or visit number', async () => {
    const reg = await S.rec.post('/api/patients/register').send({ patient: { name: 'Second Patient', gender: 'Female', phone: '03111111111', age: 40 }, visit: { doctorId: String(S.dA._id), chiefComplaint: 'Cough' } }).expect(201);
    S.p2 = reg.body.patient; S.v2 = reg.body.visit;
    const byPatient = await S.docA.get(`/api/doctor/visits/${S.p2._id}`).expect(200); assert.equal(byPatient.body.visit._id, S.v2._id);
    await S.docA.get(`/api/doctor/visits/${S.v2.visitNo}`).expect(200);
    const bad = await S.docA.get('/api/doctor/visits/not-an-id').expect(400); assert.match(bad.body.message, /Invalid/);
    await S.docA.get('/api/doctor/visits/64b64b64b64b64b64b64b64b').expect(404);
    await S.docB.get(`/api/doctor/visits/${S.v2._id}`).expect(403);
  });
  it('keeps a saved draft private, then sends it to the pharmacy without finishing the consultation', async () => {
    await S.docA.put(`/api/doctor/visits/${S.v2._id}/consultation`).send(sendBody('Bronchitis')).expect(200);
    const draft = await Prescription.findOne({ visit: S.v2._id }); assert.equal(draft.status, 'Draft'); assert.ok(draft.rxNo);
    const list1 = await S.ph.get('/api/pharmacy/prescriptions').expect(200); assert.ok(!list1.body.some((r) => r.rxNo === draft.rxNo));   // pharmacy cannot see drafts
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/send-prescription`).send({ data: { diagnosis: 'Bronchitis', medicines: [] } }).expect(400);   // needs a medicine
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/send-prescription`).send(sendBody('Bronchitis')).expect(200);
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/send-prescription`).send(sendBody('Bronchitis')).expect(200);   // double click: still one prescription
    assert.equal(await Prescription.countDocuments({ visit: S.v2._id }), 1);
    const v = await S.docA.get(`/api/doctor/visits/${S.v2._id}`).expect(200); assert.notEqual(v.body.visit.status, 'Completed');
    const list2 = await S.ph.get('/api/pharmacy/prescriptions').expect(200); assert.ok(list2.body.some((r) => r.rxNo === draft.rxNo && r.status === 'Pending'));
    S.rx2 = draft;
  });
  it('lets the pharmacist return it with a reason; the doctor sees it, corrects and re-sends', async () => {
    await S.ph.post(`/api/pharmacy/prescriptions/${S.rx2._id}/return`).send({ reason: 'x' }).expect(400);
    await S.ph.post(`/api/pharmacy/prescriptions/${S.rx2._id}/return`).send({ reason: 'Dosage unclear for this age' }).expect(200);
    const ov = await S.docA.get('/api/doctor/overview').expect(200); assert.equal(ov.body.returned.length, 1); assert.match(ov.body.returned[0].returnReason, /Dosage/);
    await S.ph.post(`/api/pharmacy/prescriptions/${S.rx2._id}/dispense`).send({ lines: [{ itemId: S.itemId, action: 'unavailable' }] }).expect(409);   // returned prescriptions cannot be dispensed
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/send-prescription`).send(sendBody('Bronchitis (corrected)')).expect(200);
    const rx = await Prescription.findById(S.rx2._id); assert.equal(rx.status, 'Pending'); assert.equal(rx.diagnosis, 'Bronchitis (corrected)');
  });
  it('supports marking medicines unavailable and respects pharmacist permissions', async () => {
    const item = (await S.ph.get(`/api/pharmacy/prescriptions/${S.rx2._id}`).expect(200)).body.items[0];
    const lim = await User.create({ name: 'Viewer', email: 'viewer@t.io', role: 'pharmacy', password: PW, mustChangePassword: false, permissions: ['receipts'] });
    const lv = await login('viewer@t.io');
    await lv.post(`/api/pharmacy/prescriptions/${S.rx2._id}/dispense`).send({ lines: [{ itemId: item._id, action: 'unavailable' }] }).expect(403);
    await lv.post('/api/pharmacy/medicines').send({ name: 'X', expiryDate: '2030-01-01', purchasePrice: 1, sellingPrice: 2, quantity: 1 }).expect(403);
    await lv.get('/api/pharmacy/prescriptions').expect(200);
    const r = await S.ph.post(`/api/pharmacy/prescriptions/${S.rx2._id}/dispense`).send({ lines: [{ itemId: item._id, action: 'unavailable' }] }).expect(200);
    assert.equal(r.body.prescription.status, 'Pending');                                                                // nothing was given, so it is not "Dispensed"
    void lim;
  });
});

describe('pharmacist management (admin only)', () => {
  const body = { name: 'New Pharmacist', email: 'newph@t.io', phone: '03001112222', licenseNo: 'PH-100', permissions: ['dispense', 'receipts'] };
  it('is restricted to administrators', async () => {
    await S.rec.get('/api/pharmacists').expect(403); await S.ph.get('/api/pharmacists').expect(403); await S.ph.post('/api/pharmacists').send(body).expect(403);
    await request(app).get('/api/pharmacists').expect(401);
  });
  it('validates, creates, edits, searches, deactivates and deletes', async () => {
    await S.admin.post('/api/pharmacists').send({ ...body, email: 'bad' }).expect(400);
    await S.admin.post('/api/pharmacists').send({ ...body, phone: 'abc' }).expect(400);
    await S.admin.post('/api/pharmacists').send({ ...body, permissions: ['everything'] }).expect(400);
    const c = await S.admin.post('/api/pharmacists').send(body).expect(201); assert.ok(c.body.tempPassword); S.newPh = c.body.pharmacist;
    assert.equal((await User.findById(S.newPh._id)).role, 'pharmacy');
    await S.admin.post('/api/pharmacists').send(body).expect(409);                                                       // duplicate email
    const u = await S.admin.put(`/api/pharmacists/${S.newPh._id}`).send({ name: 'Renamed Pharmacist', permissions: ['dispense'] }).expect(200); assert.equal(u.body.name, 'Renamed Pharmacist');
    const found = await S.admin.get('/api/pharmacists?q=PH-100').expect(200); assert.equal(found.body.length, 1);
    await S.admin.patch(`/api/pharmacists/${S.newPh._id}/active`).send({ active: false }).expect(200);
    await request(app).post('/api/auth/login').send({ email: 'newph@t.io', password: c.body.tempPassword }).expect(401);    // deactivated: cannot sign in
    await S.admin.patch(`/api/pharmacists/${S.newPh._id}/active`).send({ active: true }).expect(200);
    await S.admin.post(`/api/pharmacists/${S.newPh._id}/reset-password`).expect(200);
    await S.admin.delete(`/api/pharmacists/${S.newPh._id}`).expect(200); assert.equal(await User.findById(S.newPh._id), null);
  });
  it('never deletes a pharmacist who has dispensing history', async () => {
    const ph = await User.findOne({ email: 'ph@t.io' });
    await S.admin.delete(`/api/pharmacists/${ph._id}`).expect(409);
    assert.ok(await User.findById(ph._id));
    await S.admin.get('/api/pharmacists/not-an-id').expect(400);
    await S.admin.get(`/api/users`).expect(200);
  });
});

describe('lab orders: priority, cancel, statuses', () => {
  it('lets the doctor cancel a pending order only, and the lab cancel with a reason', async () => {
    const mk = () => S.docA.post(`/api/doctor/visits/${S.v2._id}/lab-requests`);
    const a = await mk().send({ tests: [{ name: 'HbA1c', category: 'Biochemistry' }], indication: 'Diabetes follow-up', priority: 'Emergency' }).expect(201);
    const list = await S.lab.get('/api/lab/requests').expect(200); assert.equal(list.body[0].priority, 'Emergency');       // emergencies are listed first
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/lab-requests/${a.body._id}/cancel`).send({ reason: 'ordered by mistake' }).expect(200);
    assert.equal((await LabRequest.findById(a.body._id)).status, 'Cancelled');
    const b = await mk().send({ tests: ['ESR'], indication: 'Fever work-up' }).expect(201);
    await S.lab.patch(`/api/lab/requests/${b.body._id}/status`).send({ status: 'Accepted' }).expect(200);
    await S.docA.post(`/api/doctor/visits/${S.v2._id}/lab-requests/${b.body._id}/cancel`).send({}).expect(409);          // already accepted
    await S.lab.post(`/api/lab/requests/${b.body._id}/cancel`).send({ reason: 'x' }).expect(400);
    await S.lab.post(`/api/lab/requests/${b.body._id}/cancel`).send({ reason: 'Sample not collectable' }).expect(200);
    await S.lab.put(`/api/lab/requests/${b.body._id}/results`).send({ tests: [{ name: 'ESR', result: '5' }] }).expect(409);
  });
});

describe('patient details page, dispensing records, lab visit info', () => {
  it('serves the read-only patient file, with the same ownership rules and tolerant ids', async () => {
    const r = await S.docA.get(`/api/doctor/visits/${S.visit._id}/details`).expect(200);
    assert.equal(r.body.patient.name, 'Test Patient'); assert.equal(r.body.visit.visitNo, S.visit.visitNo); assert.ok(Array.isArray(r.body.warnings)); assert.ok(r.body.prescriptions.length >= 1); assert.ok(r.body.doctor.name);
    await S.docA.get(`/api/doctor/visits/${S.patient._id}/details`).expect(200);          // patient id also resolves
    await S.docB.get(`/api/doctor/visits/${S.visit._id}/details`).expect(403);            // another doctor's patient
    await S.docA.get('/api/doctor/visits/not-an-id/details').expect(400);
    await S.rec.get(`/api/doctor/visits/${S.visit._id}/details`).expect(403);
  });
  it('keeps a record of which patient received which medicines and how many', async () => {
    const r = await S.ph.get('/api/pharmacy/dispensing').expect(200);
    const row = r.body.rows.find((x) => x.patient === 'Test Patient'); assert.ok(row); assert.equal(row.lines[0].name, 'Panadol'); assert.ok(r.body.summary.medicines.some((m) => m.name.startsWith('Panadol') && m.quantity === 6));
    assert.ok(r.body.summary.records >= 2 && r.body.summary.patients >= 1);
    const q = await S.ph.get('/api/pharmacy/dispensing?q=panadol').expect(200); assert.ok(q.body.rows.length >= 1);
    const none = await S.ph.get('/api/pharmacy/dispensing?q=zzzz-nothing').expect(200); assert.equal(none.body.rows.length, 0);
    const csv = await S.ph.get('/api/pharmacy/dispensing/export').expect(200); assert.match(csv.text, /Test Patient/); assert.match(csv.text, /Panadol/);
    await S.rec.get('/api/pharmacy/dispensing').expect(403); await S.docA.get('/api/pharmacy/dispensing').expect(403);
  });
  it('shows the lab the visit, complaint and referring doctor', async () => {
    const r = await S.lab.get('/api/lab/requests').expect(200); assert.ok(r.body.length >= 1); assert.ok(r.body[0].visit.visitNo); assert.ok(r.body[0].doctor.user.name);
  });
});

describe('consultation fees (reception) and pharmacy bills', () => {
  it('starts every visit with the doctor\'s fee as Unpaid, visible to reception only', async () => {
    const v = await Visit.findById(S.visit._id); assert.equal(v.fee.status, 'Unpaid'); assert.equal(v.fee.amount, 1000);
    const list = await S.rec.get('/api/visits/fees').expect(200); assert.ok(list.body.rows.some((r) => r.visitNo === S.visit.visitNo && r.fee.status === 'Unpaid')); assert.ok(list.body.summary.unpaidCount >= 1);
    await S.docA.get('/api/visits/fees').expect(403); await S.ph.get('/api/visits/fees').expect(403);
    await S.docA.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'pay', method: 'Cash' }).expect(403);        // a doctor cannot take or change fees
  });
  it('records a payment once, with discount and receipt; a second attempt is refused', async () => {
    await S.rec.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'pay' }).expect(400);                          // method is required
    await S.rec.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'pay', method: 'Bitcoin' }).expect(400);
    const r = await S.rec.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'pay', method: 'Card', discount: 100 }).expect(200);
    assert.equal(r.body.fee.status, 'Paid'); assert.equal(r.body.fee.net, 900); assert.match(r.body.fee.receiptNo, /^FEE-\d{6}$/);
    await S.rec.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'pay', method: 'Cash' }).expect(409);        // already paid
    await S.rec.patch(`/api/visits/${S.visit._id}/fee`).send({ action: 'waive', note: 'because' }).expect(409);
    const rc = await S.rec.get(`/api/visits/${S.visit._id}/fee-receipt`).expect(200); assert.equal(rc.body.net, 900); assert.equal(rc.body.method, 'Card'); assert.equal(rc.body.patient.name, 'Test Patient');
    const huge = await S.rec.patch(`/api/visits/${S.v2._id}/fee`).send({ action: 'pay', method: 'Cash', discount: 99999 }).expect(200); assert.equal(huge.body.fee.net, 0);   // discount cannot exceed the fee
  });
  it('can collect at registration, waive with a reason, and only an admin can reverse', async () => {
    const reg = await S.rec.post('/api/patients/register').send({ patient: { name: 'Paid Patient', gender: 'Male', phone: '03222222222', age: 22 }, visit: { doctorId: String(S.dA._id), chiefComplaint: 'Fever', payment: { method: 'Cash', discount: 0 } } }).expect(201);
    assert.equal(reg.body.visit.fee.status, 'Paid'); assert.ok(reg.body.visit.fee.receiptNo);
    const w = await S.rec.post('/api/patients/register').send({ patient: { name: 'Waived Patient', gender: 'Female', phone: '03333333333', age: 50 }, visit: { doctorId: String(S.dB._id), chiefComplaint: 'Check' } }).expect(201);
    await S.rec.patch(`/api/visits/${w.body.visit._id}/fee`).send({ action: 'waive', note: 'x' }).expect(400);
    await S.rec.patch(`/api/visits/${w.body.visit._id}/fee`).send({ action: 'waive', note: 'Staff family' }).expect(200);
    await S.rec.patch(`/api/visits/${reg.body.visit._id}/fee`).send({ action: 'reset', note: 'entered by mistake' }).expect(403);
    const back = await S.admin.patch(`/api/visits/${reg.body.visit._id}/fee`).send({ action: 'reset', note: 'entered by mistake' }).expect(200); assert.equal(back.body.fee.status, 'Unpaid');
    await S.rec.get(`/api/visits/${reg.body.visit._id}/fee-receipt`).expect(409);                                       // no receipt for an unpaid visit
    const stats = await S.rec.get('/api/stats/reception').expect(200); assert.ok(stats.body.stats.collectedToday >= 900); assert.ok('unpaidFees' in stats.body.stats);
  });
  it('bills the pharmacy handover with discount, bill number and pay-later settlement', async () => {
    const reg = await S.rec.post('/api/patients/register').send({ patient: { name: 'Bill Patient', gender: 'Male', phone: '03444444444', age: 40 }, visit: { doctorId: String(S.dA._id), chiefComplaint: 'Pain' } }).expect(201);
    const vid = reg.body.visit._id; const body = { data: { diagnosis: 'Pain', medicines: [{ name: 'Panadol', strength: '500mg', dosage: '1 tab', frequency: 'Twice daily', duration: '2 days', quantity: 4 }] } };
    await S.docA.post(`/api/doctor/visits/${vid}/send-prescription`).send(body).expect(200);
    const rx = (await S.ph.get('/api/pharmacy/prescriptions').expect(200)).body.find((x) => x.patient.name === 'Bill Patient'); const item = (await S.ph.get(`/api/pharmacy/prescriptions/${rx._id}`).expect(200)).body.items[0];
    const d = await S.ph.post(`/api/pharmacy/prescriptions/${rx._id}/dispense`).send({ lines: [{ itemId: item._id, action: 'dispense', medicineId: String(S.panadol._id), quantity: 4 }], payment: { method: 'Unpaid', discount: 2 } }).expect(200);
    assert.match(d.body.record.billNo, /^BILL-\d{6}$/); assert.equal(d.body.record.subtotal, 20); assert.equal(d.body.record.discount, 2); assert.equal(d.body.record.total, 18); assert.equal(d.body.record.paid, false);
    const rc = (await S.ph.get(`/api/pharmacy/prescriptions/${rx._id}/receipt`).expect(200)).body; assert.equal(rc.paymentStatus, 'Unpaid'); assert.equal(rc.amountDue, 18); assert.equal(rc.total, 18);
    await S.ph.patch(`/api/pharmacy/dispensing/${d.body.record._id}/pay`).send({ method: 'Cash' }).expect(200);
    await S.ph.patch(`/api/pharmacy/dispensing/${d.body.record._id}/pay`).send({ method: 'Cash' }).expect(409);        // cannot be settled twice
    const rc2 = (await S.ph.get(`/api/pharmacy/prescriptions/${rx._id}/receipt`).expect(200)).body; assert.equal(rc2.paymentStatus, 'Paid'); assert.equal(rc2.amountDue, 0);
    await S.rec.patch(`/api/pharmacy/dispensing/${d.body.record._id}/pay`).send({ method: 'Cash' }).expect(403);
    const viewer = await login('viewer@t.io'); await viewer.patch(`/api/pharmacy/dispensing/${d.body.record._id}/pay`).send({ method: 'Cash' }).expect(403);   // permission-restricted pharmacist
  });
  it('lets the admin rename and deactivate departments (not while doctors are assigned)', async () => {
    const deps = (await S.admin.get('/api/admin/departments').expect(200)).body; const g = deps.find((x) => x.name === 'General'); assert.ok(g.doctors >= 2);
    await S.admin.patch(`/api/admin/departments/${g._id}`).send({ active: false }).expect(409);
    await S.admin.patch(`/api/admin/departments/${g._id}`).send({ name: 'General Medicine' }).expect(200);
    await S.rec.patch(`/api/admin/departments/${g._id}`).send({ name: 'X' }).expect(403);
    const extra = await S.admin.post('/api/admin/departments').send({ name: 'Temp Dept' }).expect(201);
    await S.admin.patch(`/api/admin/departments/${extra.body._id}`).send({ active: false }).expect(200);
  });
});

describe('admin reporting & audit', () => {
  it('records clinical actions in the audit log and reports revenue', async () => {
    await wait(300);
    const a = await S.admin.get('/api/audit?action=CONSULTATION_COMPLETE').expect(200); assert.ok(a.body.total >= 1);
    const s = await S.admin.get('/api/reports/summary').expect(200); assert.ok(s.body.totals.revenue.consultation >= 900); assert.ok(s.body.totals.revenue.pharmacy >= 30); assert.ok(s.body.totals.unpaidFees.count >= 1);
    const csv = await S.admin.get('/api/reports/export/visits').expect(200); assert.match(csv.text, /Test Patient/);
    await S.rec.get('/api/audit').expect(403);
  });
});
