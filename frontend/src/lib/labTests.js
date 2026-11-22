// Test catalogue for the doctor's lab order form. "Other" lets the doctor type any test.
export const LAB_CATALOG = {
  Hematology: ['Complete Blood Count (CBC)', 'ESR', 'Blood Group & Rh', 'Coagulation Profile (PT/INR)'],
  Biochemistry: ['Blood Sugar (Random)', 'Blood Sugar (Fasting)', 'HbA1c', 'Liver Function Test (LFT)', 'Renal Function Test (RFT)', 'Lipid Profile', 'Serum Electrolytes', 'Serum Uric Acid'],
  'Urine & Stool': ['Urine Complete Examination', 'Urine Culture & Sensitivity', 'Stool Complete Examination'],
  Endocrine: ['Thyroid Function Test (TSH, T3, T4)'],
  'Microbiology & Serology': ['Culture & Sensitivity', 'Widal Test', 'Dengue NS1 / IgM', 'Hepatitis B (HBsAg)', 'Hepatitis C (Anti-HCV)'],
  Other: [],
};
export const PRIORITIES = ['Routine', 'Urgent', 'Emergency'];
