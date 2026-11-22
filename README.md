# Hospital Management System (HMS)

Stack: Next.js + Tailwind (frontend) · Node/Express (API) · MongoDB/Mongoose · Recharts · PDF.

## Build phases
| # | Phase | Status |
|---|-------|--------|
| 1 | Database architecture, auth, RBAC, audit log, user management API, seed data | DONE |
| 2 | Frontend foundation: Next.js app, layout (sidebar/topbar), login, role routing, shared UI kit | DONE |
| 3 | Patients + Reception: registration, search/duplicate check, visits, doctor cards, status management | DONE |
| 4 | Doctor dashboard: own patient list, medical record view, consultation save/complete | DONE |
| 5 | Admin: doctor/user management UI + Prescription Template Designer (drag & drop) | DONE |
| 6 | Doctor uses template, prescription generation, versioned/amended records | DONE |
| 7 | Laboratory module + report PDF, results back to doctor | DONE |
| 8 | Pharmacy: inventory, dispensing, prescription print/PDF, low-stock/expiry alerts | DONE |
| 9 | Admin overview, charts, reports, audit log viewer | DONE |
| 10 | Hardening, tests, logo upload, deployment guide | DONE |

## Run Phase 1
```bash
cd backend
cp .env.example .env     # set JWT_SECRET
npm install
npm run seed             # creates users, departments, doctors+templates, medicines
npm run dev              # http://localhost:5000/api/health
```
Seed logins (password `Hospital@12345`, change on first login):
admin@hms.local · reception@hms.local · ahmed@hms.local · ali@hms.local · lab@hms.local · pharmacy@hms.local

## Phase 1 endpoints
- POST /api/auth/login, /logout, /change-password · GET /api/auth/me
- Admin only: GET/POST /api/users · PATCH /api/users/:id · PATCH /api/users/:id/active · POST /api/users/:id/reset-password

## Design notes
- httpOnly JWT cookie, bcrypt (12 rounds), lockout after 5 failed logins, rate-limited login, helmet, zod validation.
- `Visit` is the hub linking Patient → Doctor → LabRequest → Prescription.
- Finalized consultations are never overwritten: changes append to `Visit.amendments`.
- Templates live in `PrescriptionTemplate` (versioned), one per doctor.

## Phase 3 endpoints
- GET /api/departments, /api/doctors
- GET /api/patients?q= · POST /api/patients/register (duplicate guard) · POST /api/patients/:id/visits · PATCH /api/patients/:id · GET /api/patients/:id
- GET /api/visits · PATCH /api/visits/:id/status · PATCH /api/visits/:id
- GET /api/stats/reception · GET /api/stats/admin

## Phase 4 endpoints (doctor only, own patients only)
- GET /api/doctor/overview · GET /api/doctor/visits/:id · POST .../start
- PUT .../consultation (save draft) · POST .../complete (finalize + issue prescription) · POST .../amend (reason required, previous version kept)
- POST .../lab-requests · POST .../refer · GET /api/medicines/search?q=

## Phase 5 endpoints (admin)
- GET/POST /api/admin/doctors · PATCH/DELETE /api/admin/doctors/:id (remove = deactivate) · POST /api/admin/departments
- GET/POST /api/templates · GET/PUT/DELETE /api/templates/:id (PUT bumps version, keeps snapshot) · GET /api/templates/mine (doctor)

## Phase 6
- Consultation form is rendered from the doctor's assigned template; values stored in `Visit.consultation.data`, validated server-side against the template (types, options, required on Complete).
- The template version used is snapshotted into the visit on first save, so old records always print as written.
- GET /api/prescriptions/sheet/:visitId (doctor own / pharmacy) → printable sheet; frontend `PrescriptionSheet` + Print / Download PDF (html2pdf.js).

## Phase 7 endpoints (laboratory; doctor read-only on own requests)
- GET /api/lab/overview · GET /api/lab/requests?status= · GET /api/lab/requests/:id
- PATCH .../status (Accepted → Sample Collected) · PUT .../results (→ In Progress) · POST .../complete (all results required; locks report)
- POST/GET .../report (PDF/PNG/JPG ≤5MB, auth-checked download) · GET .../sheet (printable report data)
- Needs `multer` (npm install) and HOSPITAL_NAME/ADDRESS/PHONE in .env

## Phase 8 endpoints (pharmacy)
- GET /api/pharmacy/overview · GET /api/pharmacy/prescriptions[/:id] (with inventory candidates, first-expiry-first-out)
- POST /api/pharmacy/prescriptions/:id/dispense (atomic stock deduction, rolls back on failure, blocks expired stock, records batch + total)
- GET/POST /api/pharmacy/medicines · PUT/DELETE /api/pharmacy/medicines/:id (?filter=low|expired|expiring)
- Pharmacy prints via GET /api/prescriptions/sheet/:visitId (completed consultations only)

## Phase 9 endpoints (admin)
- GET /api/stats/admin (counts, lab, pharmacy, revenue today/month)
- GET /api/reports/summary?from&to (charts + tables, max 1 year) · GET /api/reports/export/{visits|dispensing|lab}?from&to (CSV, formula-injection safe)
- GET /api/audit?action&role&q&from&to&page (read-only)
- Revenue = consultation fees of completed visits + dispensed pharmacy bills. Set HOSPITAL_TZ in .env for correct day buckets.

## Phase 10 - hardening, tests, deployment
- Security: query/body operator blocking, Origin check, sessions invalidated on password change, forced temporary-password change, upload checks by file signature, global rate limit, `create-admin` for production, seed refuses to run in production.
- Tests: `npm test` (unit, runs without a DB) · `npm run test:integration` (needs `MONGO_URI_TEST` ending in `_test`).
- Logo upload for templates (PNG/JPG ≤1 MB); topbar patient search; settings page; error/404 pages; automatic redirect on expired session.
- Docker: `docker-compose.yml`, Dockerfiles. See **DEPLOYMENT.md** (go-live checklist, limitations) and **TEST_CHECKLIST.md** (31-step manual test).

## Round 2 (after first test)
- Prescription pad header (hospital + doctor details + date), doctor signature upload, doctor availability check-in visible at reception, lab-test panel beside the template, lab per-test "Done" confirmation, pharmacy dispensing summary + printable receipt. Next.js pinned to 14.2.35.

## Round 4
See **CHANGES_ROUND4.md** (bugs found, fixes, new features, files, schema/API changes, verification status). **After updating run `cd backend && npm run migrate` once.**

## Round 5
See **CHANGES_ROUND5.md** (Prescription button, rebuilt View Details with error diagnostics, doctor-dashboard lab text box, pharmacy dispensing records).

## Round 6
See **CHANGES_ROUND6.md** (requirements check, consultation fee payment at reception, pharmacy bill, departments, revenue = money collected). Run `npm run migrate` after updating.
