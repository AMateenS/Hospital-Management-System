const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { autoFlag } = require('../../src/utils/labFlag');
const { cell, csv } = require('../../src/utils/csv');
const { sniff } = require('../../src/utils/fileSniff');
const { escapeRegex, ageFromDob } = require('../../src/utils/helpers');
const { noSqlGuard, originCheck } = require('../../src/middleware/security');

test('autoFlag: Normal / High / Low and undecidable cases', () => {
  assert.equal(autoFlag('90', '70-110'), 'Normal');
  assert.equal(autoFlag('150', '70-110'), 'High');
  assert.equal(autoFlag('50', '70 - 110'), 'Low');
  assert.equal(autoFlag('70', '70-110'), 'Normal');      // boundaries are normal
  assert.equal(autoFlag('abc', '70-110'), '');
  assert.equal(autoFlag('90', ''), '');
  assert.equal(autoFlag('', '70-110'), '');
  assert.equal(autoFlag('5', '<10'), '');                // unsupported format: no guess
});

test('csv: formula injection is neutralised, quotes and commas escaped', () => {
  assert.equal(cell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(cell('+1'), "'+1"); assert.equal(cell('-2'), "'-2"); assert.equal(cell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(cell('a,b'), '"a,b"'); assert.equal(cell(null), ''); assert.equal(cell(12), '12');
  assert.equal(csv(['A', 'B'], [['x', '=1']]), "A,B\r\nx,'=1");
});

test('escapeRegex makes user search text literal', () => {
  const r = new RegExp(escapeRegex('a.b*(c)'), 'i');
  assert.ok(r.test('xa.b*(c)y')); assert.ok(!r.test('aXbbbc'));
});

test('ageFromDob', () => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 30); d.setDate(d.getDate() - 1);
  assert.equal(ageFromDob(d), 30);
  const f = new Date(); f.setFullYear(f.getFullYear() - 30); f.setDate(f.getDate() + 2);
  assert.equal(ageFromDob(f), 29);
});

test('sniff reads real file signatures, not extensions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hms-')); const w = (n, b) => { const p = path.join(dir, n); fs.writeFileSync(p, b); return p; };
  assert.equal(sniff(w('a.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))), 'png');
  assert.equal(sniff(w('b.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))), 'jpg');
  assert.equal(sniff(w('c.pdf', Buffer.from('%PDF-1.7\n'))), 'pdf');
  assert.equal(sniff(w('evil.png', Buffer.from('<script>alert(1)</script>'))), null);
  assert.equal(sniff(w('empty.pdf', Buffer.alloc(0))), null);
});

const run = (mw, req) => { let out = { next: false }; const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } }; mw(req, res, () => { out.next = true; }); return out; };
test('noSqlGuard blocks operator injection in query and body', () => {
  assert.equal(run(noSqlGuard, { query: { status: 'Pending' }, body: { a: { b: 1 } } }).next, true);
  assert.equal(run(noSqlGuard, { query: { status: { $ne: 'x' } }, body: {} }).status, 400);
  assert.equal(run(noSqlGuard, { query: { s: ['a', 'b'] }, body: {} }).status, 400);
  assert.equal(run(noSqlGuard, { query: {}, body: { email: { $gt: '' } } }).status, 400);
  assert.equal(run(noSqlGuard, { query: {}, body: { x: { y: { 'a.b': 1 } } } }).status, 400);
});
test('originCheck allows our origin, blocks others on writes only', () => {
  const mw = originCheck(['http://localhost:3000']);
  assert.equal(run(mw, { method: 'POST', headers: { origin: 'http://localhost:3000' } }).next, true);
  assert.equal(run(mw, { method: 'POST', headers: { origin: 'https://evil.example' } }).status, 403);
  assert.equal(run(mw, { method: 'GET', headers: { origin: 'https://evil.example' } }).next, true);
  assert.equal(run(mw, { method: 'POST', headers: {} }).next, true);                     // non-browser client
  assert.equal(run(originCheck([]), { method: 'POST', headers: { origin: 'x' } }).next, true);
});
