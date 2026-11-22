# Round 5 (Urdu request): Prescription button, View Details, lab text box, dispensing records

Run once after updating: `cd backend && npm run migrate` (only needed if you skipped it after round 4), restart the backend, hard-refresh the browser (Ctrl+Shift+R).

## What changed
1. **Doctor dashboard patient row now has two buttons:** *View Details* (read-only patient file) and *Prescription* (opens the prescription template for that patient only). The template is no longer shown on the dashboard.
   * The template page shows the hospital and doctor header and, for the selected patient: name, ID, age/gender, phone, address, father/husband, visit number, and the vital signs entered at reception. It has a *Patient details* button back to the file.
2. **View Details rebuilt as its own page** (`/doctor/visit/<id>`), served by a new, separate endpoint `GET /api/doctor/visits/:id/details`. Each section (patient, doctor, previous visits, lab orders, prescriptions, previous prescriptions, previous lab reports) is loaded on its own: if one part fails, the rest of the page still opens and a warning names the part. It shows: patient info, contact, assigned doctor, visit/appointment, vitals, medical history, allergies, medications, all diagnoses, previous visits, prescriptions, laboratory reports.
   * **If it ever fails, the page now shows the real reason** (the server message, the HTTP status, the exact call, and a plain hint). The backend terminal also prints `[visit lookup] nothing found for "<id>"`. Please send me that line if you still see an error.
3. **Laboratory tests on the doctor dashboard:** a "Laboratory tests: recommend tests for a patient" card. Choose a patient, **type a test name and press Enter** (suggestions appear; category quick-picks are also there), add clinical indication, priority and instructions, press *Send to laboratory*. The same form is on the patient details page and the prescription page. The lab list and the lab order page show the patient, the referring doctor, the tests, the visit number and the complaint/diagnosis.
4. **Pharmacy "Dispensing records" tab:** a permanent record of every handover: date/time, patient and ID, prescription and visit number, doctor, **each medicine with the quantity given**, price, total and the pharmacist; filter by date, search by patient / medicine / doctor / Rx; totals per medicine for the period; CSV download; link to the receipt.
   (The submitted prescription already reaches the pharmacy via *Save & send to pharmacy* or *Finish consultation*; the pharmacist dispenses it and the record above is created automatically.)

## Files
New: `frontend/src/components/doctor/LabOrderCard.js`, `frontend/src/components/pharmacy/DispensingRecordsTab.js`, `frontend/src/app/(app)/doctor/visit/[id]/prescription/page.js` (the template page, moved here).
Rewritten: `frontend/src/app/(app)/doctor/visit/[id]/page.js` (now the details page), `frontend/src/components/doctor/LabRequestPanel.js`.
Modified: `frontend/src/app/(app)/doctor/page.js`, `components/doctor/DoctorTools.js`, `(app)/pharmacy/page.js`, `(app)/laboratory/page.js`, `(app)/laboratory/request/[id]/page.js`, `backend/src/routes/doctor.js`, `routes/lab.js`, `routes/pharmacy.js`, `backend/test/integration/workflow.test.js`.
No database schema change in this round.

## New / changed endpoints
`GET /api/doctor/visits/:id/details` (doctor, own patients) · `GET /api/pharmacy/dispensing?from&to&q` · `GET /api/pharmacy/dispensing/export` (CSV) · `GET /api/lab/requests[/:id]` now also returns the visit (number, complaint, diagnosis).

## Verification (honest)
* **Run in a real headless Chromium** (page bundled as in production, API replaced by a fake server that returns data shaped like the backend's responses): 59 + 12 checks passed: details page (all sections, partial-failure warning, 404/403/500 error screens), prescription page (patient and vitals at top), dashboard (both buttons navigate to the right visit, no template preview, typed lab tests are POSTed with priority/indication/category), dispensing records, pharmacy detail + dispense request, pharmacist management form validation and creation, lab list and order page. **No console errors on any of them.**
* All 57 frontend files parse as valid JSX; all backend files pass a syntax check; 11 backend unit tests pass.
* **Not run:** the backend routes against a real database (no MongoDB in my environment) and the integration tests (written, including new ones for details, dispensing records and lab visit info). **I could not reproduce your "View Details" failure**: the page and its link work in the browser test when the server returns well-formed data, so the cause is either in server/database data on your machine or an old tab/link. The new error screen and the backend log line will show exactly which.
