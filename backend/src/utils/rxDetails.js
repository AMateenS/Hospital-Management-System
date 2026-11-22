// What the pharmacist should read besides the medicines: advice, observations, doctor notes ... (never editable there)
exports.detailsOf = (fields, data) => fields
  .filter((f) => !['medicines', 'vitals'].includes(f.type) && data[f.key] != null && data[f.key] !== '' && !(Array.isArray(data[f.key]) && !data[f.key].length))
  .map((f) => ({ label: f.label, value: Array.isArray(data[f.key]) ? data[f.key].join(', ') : String(data[f.key]) }));

