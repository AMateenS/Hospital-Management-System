// Default units / adult reference ranges to speed up result entry. Technician can edit every value.
// Panels expand into several result rows. Ranges are general adult guidance; labs should adjust to their own methods.
export const PANELS = {
  CBC: [['Hemoglobin', 'g/dL', '12-17'], ['WBC', '10^3/µL', '4-11'], ['Platelets', '10^3/µL', '150-450'], ['RBC', '10^6/µL', '4.2-5.9'], ['Hematocrit', '%', '36-52']],
  LFT: [['ALT (SGPT)', 'U/L', '7-56'], ['AST (SGOT)', 'U/L', '10-40'], ['ALP', 'U/L', '44-147'], ['Total bilirubin', 'mg/dL', '0.1-1.2'], ['Albumin', 'g/dL', '3.5-5.0']],
  RFT: [['Urea', 'mg/dL', '15-45'], ['Creatinine', 'mg/dL', '0.6-1.3'], ['Uric acid', 'mg/dL', '3.5-7.2'], ['Sodium', 'mmol/L', '135-145'], ['Potassium', 'mmol/L', '3.5-5.0']],
  'Lipid profile': [['Total cholesterol', 'mg/dL', '0-200'], ['Triglycerides', 'mg/dL', '0-150'], ['HDL', 'mg/dL', '40-100'], ['LDL', 'mg/dL', '0-130']],
};
export const SINGLE = { 'Blood sugar': ['mg/dL', '70-140'] };
export const expand = (name) => PANELS[name]?.map(([n, unit, ref]) => ({ name: n, result: '', unit, referenceRange: ref, flag: '' }));
export const defaults = (name) => (SINGLE[name] ? { unit: SINGLE[name][0], referenceRange: SINGLE[name][1] } : {});

// Names used by the doctor's order form map onto the same result templates
PANELS['Complete Blood Count (CBC)'] = PANELS.CBC;
PANELS['Liver Function Test (LFT)'] = PANELS.LFT;
PANELS['Renal Function Test (RFT)'] = PANELS.RFT;
PANELS['Lipid Profile'] = PANELS['Lipid profile'];
PANELS['Thyroid Function Test (TSH, T3, T4)'] = [['TSH', 'mIU/L', '0.4-4.0'], ['Free T3', 'pg/mL', '2.3-4.2'], ['Free T4', 'ng/dL', '0.8-1.8']];
SINGLE['Blood Sugar (Random)'] = SINGLE['Blood sugar'];
SINGLE['Blood Sugar (Fasting)'] = ['mg/dL', '70-100'];
SINGLE['HbA1c'] = ['%', '4-5.6'];
SINGLE['Serum Uric Acid'] = ['mg/dL', '3.5-7.2'];
