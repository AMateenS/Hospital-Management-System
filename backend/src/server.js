require('dotenv').config();
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) { console.error('Set a strong JWT_SECRET (24+ chars) in .env'); process.exit(1); }
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) { console.error('Set CLIENT_URL in production'); process.exit(1); }
const app = require('./app');
const port = process.env.PORT || 5000;
connectDB().then(() => app.listen(port, () => console.log('HMS API on :' + port))).catch((e) => { console.error(e); process.exit(1); });
