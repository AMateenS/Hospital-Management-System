const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStatus, remaining } = require('../../src/utils/rxStatus');
const { hasPermission, requirePermission } = require('../../src/utils/permissions');
const { detailsOf } = require('../../src/utils/rxDetails');

test('computeStatus: Pending / Partially Dispensed / Dispensed', () => {
  const it = (q, d, a) => ({ quantity: q, dispensedQty: d, availability: a || 'Unknown' });
  assert.equal(computeStatus([it(10, 0), it(5, 0)]), 'Pending');
  assert.equal(computeStatus([it(10, 4), it(5, 0)]), 'Partially Dispensed');
  assert.equal(computeStatus([it(10, 10), it(5, 2)]), 'Partially Dispensed');
  assert.equal(computeStatus([it(10, 10), it(5, 5)]), 'Dispensed');
  assert.equal(computeStatus([it(10, 10), it(5, 0, 'Unavailable')]), 'Dispensed');          // unavailable item is closed
  assert.equal(computeStatus([it(10, 0, 'Unavailable')]), 'Pending');                         // nothing given: goes back to doctor, not "Dispensed"
  assert.equal(computeStatus([{ dispensedQty: 1 }]), 'Dispensed');                            // missing quantity means 1
});
test('remaining never goes negative and ignores unavailable', () => {
  assert.equal(remaining({ quantity: 3, dispensedQty: 5 }), 0);
  assert.equal(remaining({ quantity: 3, dispensedQty: 1 }), 2);
  assert.equal(remaining({ quantity: 3, dispensedQty: 0, availability: 'Unavailable' }), 0);
});
test('pharmacy permissions', () => {
  assert.equal(hasPermission({ role: 'admin' }, 'dispense'), true);
  assert.equal(hasPermission({ role: 'pharmacy' }, 'dispense'), true);                        // legacy account, no list = full
  assert.equal(hasPermission({ role: 'pharmacy', permissions: ['dispense'] }, 'dispense'), true);
  assert.equal(hasPermission({ role: 'pharmacy', permissions: ['dispense'] }, 'inventory'), false);
  assert.equal(hasPermission({ role: 'pharmacy', permissions: [] }, 'dispense'), false);      // view only
  assert.equal(hasPermission({ role: 'doctor', permissions: ['dispense'] }, 'dispense'), false);
  let st; const res = { status(c) { st = c; return this; }, json() { return this; } };
  requirePermission('inventory')({ user: { role: 'pharmacy', permissions: ['dispense'] } }, res, () => { st = 'next'; }); assert.equal(st, 403);
  requirePermission('dispense')({ user: { role: 'pharmacy', permissions: ['dispense'] } }, res, () => { st = 'next'; }); assert.equal(st, 'next');
});
test('detailsOf keeps advice/notes for the pharmacist, drops medicines, vitals and blanks', () => {
  const f = [{ key: 'diagnosis', label: 'Diagnosis', type: 'textarea' }, { key: 'm', label: 'Rx', type: 'medicines' }, { key: 'v', label: 'Vitals', type: 'vitals' },
    { key: 'advice', label: 'Additional advice', type: 'textarea' }, { key: 'x', label: 'Empty', type: 'text' }, { key: 'c', label: 'Checks', type: 'checkbox' }];
  const out = detailsOf(f, { diagnosis: 'Flu', m: [{ name: 'A' }], advice: 'Rest', x: '', c: ['a', 'b'] });
  assert.deepEqual(out, [{ label: 'Diagnosis', value: 'Flu' }, { label: 'Additional advice', value: 'Rest' }, { label: 'Checks', value: 'a, b' }]);
});
