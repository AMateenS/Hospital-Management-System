// Money helpers shared by reception fees and pharmacy bills.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
exports.round2 = round2;
// discount is clamped to [0, gross]; never produces a negative bill
exports.netOf = (gross, discount = 0) => { const g = round2(gross); const d = Math.min(Math.max(round2(discount), 0), g); return { gross: g, discount: d, net: round2(g - d) }; };
// consultation fee a new visit starts with (doctor's fee); a free doctor means nothing to collect
exports.initialFee = (doctor) => { const amount = round2(doctor?.consultationFee); return amount > 0 ? { amount, discount: 0, status: 'Unpaid' } : { amount: 0, discount: 0, status: 'Waived', note: 'No consultation fee' }; };
exports.feeNet = (fee) => (fee && fee.status === 'Paid' ? exports.netOf(fee.amount, fee.discount).net : 0);
exports.billStatus = (records) => { const due = records.filter((r) => r.paid === false); return due.length === 0 ? 'Paid' : due.length === records.length ? 'Unpaid' : 'Partly paid'; };
