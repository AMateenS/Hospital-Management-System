// Fields every prescription template should offer: symptoms/observations, medicines, additional advice, doctor notes.
const fld = (key, label, type, required = false) => ({ key, label, type, required, options: [] });
exports.EXTRA = [fld('observations', 'Symptoms & observations', 'textarea'), fld('advice', 'Additional medical advice', 'textarea'), fld('notes', 'Doctor notes', 'textarea')];
exports.DEFAULT_FIELDS = [fld('diagnosis', 'Diagnosis', 'textarea', true), fld('observations', 'Symptoms & observations', 'textarea'), fld('treatment', 'Treatment', 'textarea'),
  fld('medicines', 'Prescription', 'medicines', true), fld('advice', 'Additional medical advice', 'textarea'), fld('notes', 'Doctor notes', 'textarea')].map((f, i) => ({ ...f, order: i }));
// returns { fields, added } without touching the fields a template already has
exports.addMissing = (fields) => {
  const out = fields.map((f) => ({ ...f })); const has = (k) => out.some((f) => f.key === k); const added = [];
  if (!has('observations')) { const i = out.findIndex((f) => f.key === 'diagnosis'); out.splice(i >= 0 ? i + 1 : 0, 0, { ...exports.EXTRA[0] }); added.push('observations'); }
  for (const f of exports.EXTRA.slice(1)) if (!has(f.key)) { out.push({ ...f }); added.push(f.key); }
  return { fields: out.map((f, i) => ({ ...f, order: i })), added };
};
