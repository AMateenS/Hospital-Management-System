// 1) Query strings may only contain plain strings; bodies may not contain Mongo operator keys.
//    Stops NoSQL injection such as ?status[$ne]=x or {"email":{"$gt":""}}.
const bad = (o, depth = 0) => {
  if (depth > 8 || o === null || typeof o !== 'object') return false;
  return Object.keys(o).some((k) => k.startsWith('$') || k.includes('.') || bad(o[k], depth + 1));
};
exports.noSqlGuard = (req, res, next) => {
  for (const v of Object.values(req.query || {})) if (typeof v !== 'string') return res.status(400).json({ message: 'Invalid query parameter' });
  if (bad(req.body)) return res.status(400).json({ message: 'Invalid request body' });
  next();
};
// 2) CSRF defence-in-depth (cookie is SameSite=Lax): browser-sent Origin on writes must be our frontend.
exports.originCheck = (allowed) => (req, res, next) => {
  if (!allowed.length || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const o = req.headers.origin;
  if (o && !allowed.includes(o)) return res.status(403).json({ message: 'Request origin not allowed' });
  next();
};
exports._bad = bad;
