exports.notFound = (req, res) => res.status(404).json({ message: 'Route not found' });
exports.errorHandler = (err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyValue || {}) });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  console.error(err);
  res.status(err.status || 500).json({ message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message });
};
