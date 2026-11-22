const Doctor = require('../models/Doctor');
// Returns the Doctor doc for a doctor-role user (or null for other roles).
exports.doctorOf = (user) => (user.role === 'doctor' ? Doctor.findOne({ user: user._id }) : null);
