const { z } = require('zod');
exports.passwordRule = z.string().min(10, 'Minimum 10 characters').regex(/[A-Z]/, 'Needs an uppercase letter').regex(/[a-z]/, 'Needs a lowercase letter').regex(/[0-9]/, 'Needs a number');
