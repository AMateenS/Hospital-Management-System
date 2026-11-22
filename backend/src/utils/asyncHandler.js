module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const asyncHandler = (fn) => {
  return (...args) => {
    const next = args[2];

    Promise.resolve(fn(...args)).catch(next);
  };
};

module.exports = asyncHandler;
