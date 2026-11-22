exports.hospital = () => ({ name: process.env.HOSPITAL_NAME || 'Hospital', address: process.env.HOSPITAL_ADDRESS || '', phone: process.env.HOSPITAL_PHONE || '' });
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
// "Available" only counts if the doctor ticked it today (it expires at midnight and on logout).
exports.isAvailable = (d) => !!(d.available && d.availableSince && new Date(d.availableSince) >= startOfToday());
// doc must have user (name, phone) and department populated
exports.doctorInfo = (doc) => ({
  name: doc.user?.name, qualification: doc.qualification, specialization: doc.specialization, department: doc.department?.name,
  phone: doc.contact || doc.user?.phone, experienceYears: doc.experienceYears, availability: doc.availability || [], signatureUrl: doc.signatureUrl,
});
