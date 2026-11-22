const { z } = require('zod');
const medItem = z.object({
  name: z.string().min(1, 'Medicine name required'), strength: z.string().optional(), dosage: z.string().min(1, 'Dosage required'),
  frequency: z.string().min(1, 'Frequency required'), duration: z.string().min(1, 'Duration required'),
  quantity: z.coerce.number().int().min(1).optional(), instructions: z.string().optional(),
});
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Validates submitted values against the doctor's template. Unknown keys are dropped.
// requireAll=false for drafts (types still checked, required fields not enforced).
exports.validateData = (fields, data = {}, requireAll) => {
  const clean = {}, errors = [];
  for (const f of fields) {
    const v = data[f.key];
    if (f.type === 'vitals') continue;
    if (isEmpty(v)) { if (requireAll && f.required) errors.push(`${f.label} is required`); continue; }
    switch (f.type) {
      case 'text': case 'textarea': clean[f.key] = String(v).slice(0, 5000); break;
      case 'number': { const n = Number(v); if (Number.isNaN(n)) errors.push(`${f.label} must be a number`); else clean[f.key] = n; break; }
      case 'date': { const d = new Date(v); if (Number.isNaN(d.getTime())) errors.push(`${f.label} must be a valid date`); else clean[f.key] = d.toISOString().slice(0, 10); break; }
      case 'dropdown': if (!f.options.includes(v)) errors.push(`${f.label}: invalid choice`); else clean[f.key] = v; break;
      case 'checkbox': {
        const arr = Array.isArray(v) ? v.map(String) : [];
        if (f.options?.length && arr.some((x) => !f.options.includes(x))) errors.push(`${f.label}: invalid choice`); else clean[f.key] = arr; break; }
      case 'medicines': {
        if (!Array.isArray(v)) { errors.push(`${f.label} must be a list`); break; }
        const items = [];
        for (const m of v) {
          const r = medItem.safeParse(m);
          if (r.success) items.push(r.data);
          else if (requireAll) errors.push(`${f.label}: ${r.error.issues[0].message}`);
          else if (m?.name) items.push({ ...m });
        }
        if (items.length) clean[f.key] = items; else if (requireAll && f.required) errors.push(`${f.label} is required`);
        break; }
    }
  }
  return { clean, errors: [...new Set(errors)] };
};
exports.diagnosisOf = (fields, data) => {
  const f = fields.find((x) => /diagnos/i.test(x.key + ' ' + x.label) && typeof data[x.key] === 'string' && data[x.key].trim());
  return f ? data[f.key].trim() : undefined;
};
exports.medicinesOf = (fields, data) => {
  const f = fields.find((x) => x.type === 'medicines');
  return f && data[f.key] ? data[f.key] : [];
};
