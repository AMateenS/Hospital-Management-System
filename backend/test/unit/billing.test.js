const test = require('node:test');
const assert = require('node:assert/strict');
const { netOf, initialFee, feeNet, billStatus, round2 } = require('../../src/utils/billing');

test('netOf clamps the discount and rounds to cents', () => {
  assert.deepEqual(netOf(100, 10), { gross: 100, discount: 10, net: 90 });
  assert.deepEqual(netOf(100, 500), { gross: 100, discount: 100, net: 0 });     // cannot discount below zero
  assert.deepEqual(netOf(100, -5), { gross: 100, discount: 0, net: 100 });
  assert.deepEqual(netOf(10.005, 0.1), { gross: 10.01, discount: 0.1, net: 9.91 });
  assert.equal(netOf(undefined).net, 0); assert.equal(round2('abc'), 0);
});
test('initialFee: unpaid when the doctor charges, waived when free', () => {
  assert.deepEqual(initialFee({ consultationFee: 1500 }), { amount: 1500, discount: 0, status: 'Unpaid' });
  assert.equal(initialFee({ consultationFee: 0 }).status, 'Waived'); assert.equal(initialFee(null).status, 'Waived');
});
test('feeNet only counts paid fees', () => {
  assert.equal(feeNet({ status: 'Paid', amount: 1000, discount: 100 }), 900);
  assert.equal(feeNet({ status: 'Unpaid', amount: 1000 }), 0); assert.equal(feeNet({ status: 'Waived', amount: 1000 }), 0); assert.equal(feeNet(undefined), 0);
});
test('billStatus: legacy records without "paid" count as paid', () => {
  assert.equal(billStatus([{}, { paid: true }]), 'Paid');
  assert.equal(billStatus([{ paid: false }, { paid: false }]), 'Unpaid');
  assert.equal(billStatus([{ paid: true }, { paid: false }]), 'Partly paid');
});
