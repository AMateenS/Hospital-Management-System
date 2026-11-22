// Prescription progress from its items. quantity = prescribed (default 1), dispensedQty = given so far.
const remaining = (i) => (i.availability === 'Unavailable' ? 0 : Math.max(0, (i.quantity || 1) - (i.dispensedQty || 0)));
exports.remaining = remaining;
exports.computeStatus = (items) => {
  const given = items.some((i) => (i.dispensedQty || 0) > 0);
  const open = items.some((i) => remaining(i) > 0);
  if (!given) return 'Pending';                 // nothing handed over yet (all-unavailable goes back to the doctor)
  return open ? 'Partially Dispensed' : 'Dispensed';
};
