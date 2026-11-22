// Production bootstrap: creates (or resets) the first admin from env vars. Usage:
//   ADMIN_EMAIL=you@hospital.org ADMIN_PASSWORD='Str0ng-Passw0rd!' npm run create-admin
require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');
const { passwordRule } = require('./utils/passwords');
(async () => {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: pw, ADMIN_NAME: name = 'Administrator' } = process.env;
  if (!email || !pw) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD'); process.exit(1); }
  const v = passwordRule.safeParse(pw); if (!v.success) { console.error(v.error.issues.map((i) => i.message).join(', ')); process.exit(1); }
  await connectDB();
  const u = (await User.findOne({ email: email.toLowerCase() })) || new User({ email, name, role: 'admin' });
  u.password = pw; u.role = 'admin'; u.active = true; u.mustChangePassword = true; await u.save();
  console.log('Admin ready:', email, '(password must be changed at first login)'); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
