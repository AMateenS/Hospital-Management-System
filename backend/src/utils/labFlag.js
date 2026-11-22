// "70-110" -> Normal / High / Low for numeric results; '' when it cannot be decided.
exports.autoFlag = (result, range) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/.exec(range || '');
  const n = Number(result);
  if (!m || result === '' || result == null || Number.isNaN(n)) return '';
  return n < +m[1] ? 'Low' : n > +m[2] ? 'High' : 'Normal';
};
