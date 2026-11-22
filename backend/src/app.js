const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { notFound, errorHandler } = require('./middleware/error');
const { noSqlGuard, originCheck } = require('./middleware/security');

const test = process.env.NODE_ENV === 'test';
const origins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: origins.length ? origins : false, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (!test) app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
if (!test) {
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { message: 'Too many login attempts. Try again later.' } }));
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1500 }));
}
app.use(noSqlGuard);
app.use(originCheck(origins));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/pharmacists', require('./routes/pharmacists'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api', require('./routes/directory'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/lab', require('./routes/lab'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/doctor', require('./routes/doctor'));
app.use('/api/stats', require('./routes/stats'));
app.use(notFound);
app.use(errorHandler);
module.exports = app;
