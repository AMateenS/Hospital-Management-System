const router = require('express').Router();
const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const Medicine = require('../models/Medicine');
const { escapeRegex } = require('../utils/helpers');
const { hospital, isAvailable } = require('../utils/hospital');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
router.use(protect);

router.get('/departments', asyncHandler(async (req, res) => res.json(await Department.find({ active: true }).sort('name'))));

router.get('/doctors', asyncHandler(async (req, res) => {
  const q = {}; if (req.query.department) q.department = req.query.department;
  const docs = await Doctor.find(q).populate('user', 'name email active').populate('department', 'name');
  res.json(docs.filter((d) => d.user?.active).map((d) => ({ ...d.toObject(), available: isAvailable(d) })));
}));
router.get('/hospital', (req, res) => res.json(hospital()));

// Medicine name suggestions for prescription entry (doctors / pharmacy)
router.get('/medicines/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim(); if (q.length < 2) return res.json([]);
  const r = new RegExp(escapeRegex(q), 'i');
  res.json(await Medicine.find({ $or: [{ name: r }, { genericName: r }] }).select('name genericName strength quantity').limit(10));
}));
module.exports = router;
