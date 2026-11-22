# Round 6: requirements check against your 5-role list, and what was added

Run once after updating: `cd backend && npm run migrate`, restart the backend, hard-refresh the browser (Ctrl+Shift+R).

## A. Was it already there?
| # | Requirement | Status |
|---|-------------|--------|
| 1.1 | Admin manages everything | **Mostly present** (users, pharmacists, doctors, templates, reports, audit, opens every dashboard). **Gap fixed:** departments could only be added; now they can be renamed and deactivated. |
| 1.2 | Admin builds the doctor's template and chooses which input boxes appear in the prescription | **Present** (Template Designer: text, text area, number, date, dropdown, checkbox, vitals, medicines; required/optional; reorder; header, footer, colours, logo; per-doctor; versioned). |
| 2.1 | Doctor marks availability | **Present** (checkbox on the dashboard; reception sees it). |
| 2.2 | Doctor sees patient details, writes prescription and lab test for the selected patient | **Present** (View Details, Prescription button, lab tests). |
| 3.1 | Reception adds patient details | **Present.** |
| 3.2 | **Reception checks that the patient's fee is paid** | **Was MISSING. Added** (see B). |
| 4.1 | Laboratory sees the tests and which doctor prescribed them | **Present** (patient, referring doctor, tests, visit, diagnosis, priority). |
| 5.1 | Pharmacy shows the prescription according to the doctor's template | **Partly present** (fields listed). **Added** a "Show prescription on doctor's template" view in the pharmacy, laid out exactly like the doctor's template. |
| 5.2 | Pharmacy management | **Present** (inventory, stock alerts, pharmacist accounts and permissions, dispensing records). |
| 5.3 | Print the patient's prescription | **Present.** |
| 5.4 | **Bill of the patient** | **Was only a plain receipt. Upgraded to a real bill** (see C). |

## B. Consultation fee (reception)
* Every visit starts with the doctor's consultation fee as **Unpaid** (a free doctor = Waived). Referred visits get the new doctor's fee.
* **Registration form:** shows the fee and a "Collect the fee now" option (method Cash/Card/Online, optional discount).
* **Reception dashboard:** new cards *Unpaid fees (today)* and *Fees collected today*; each patient on a doctor card shows **Collect fee / Fee paid**; a new **Consultation fees** section lists visits by date range with status Paid / Unpaid / Waived, search, receipt number, method, who received it.
* **Collect fee** dialog: method, discount (cannot exceed the fee), note; **Waive** needs a reason; **Print fee receipt** (print / PDF). A fee can only be taken once (atomic), and only an **administrator can reverse** a payment (reason required, audited).
* The doctor dashboard and patient file show the fee status (the doctor cannot change it).

## C. Pharmacy bill
* Every dispensing creates a **bill number** (BILL-000001...). The handover has a **payment method** (Cash / Card / Online / **Pay later**) and optional **discount**, with a live subtotal / payable preview.
* A "pay later" bill is settled later (Mark paid) from the prescription or from **Dispensing records**; the bill shows *Paid / Partly paid / Unpaid* and the amount due.
* The printable **Pharmacy Bill** shows bill numbers, patient, doctor, each medicine with batch, quantity and price, subtotal, discount, total payable, payment status and signatures.

## D. Reports and revenue (changed meaning)
Revenue is now **money actually collected**: consultation fees paid at reception (net of discount; waived = 0) + pharmacy bills that are paid. Reports and the admin dashboard also show **unpaid consultation fees**; CSV exports include fee and bill columns. **Migration assumption:** older visits had no fee record; `npm run migrate` marks *Completed* visits as Paid (cash) so past revenue does not disappear, and others Unpaid. Change this if it does not match your records.

## E. Not included (tell me if you want them)
* Laboratory tests have **no price list**, so the patient bill covers the consultation fee and the pharmacy only.
* No refund workflow (an admin can reverse a fee).
* Doctors are not blocked from seeing unpaid patients (they only see the status).

## F. Files
New backend: `utils/billing.js`, `test/unit/billing.test.js`. Modified backend: `models/Visit.js`, `models/DispensingRecord.js`, `routes/patients.js`, `routes/visits.js`, `routes/doctor.js`, `routes/stats.js`, `routes/pharmacy.js`, `routes/admin.js`, `routes/reports.js`, `utils/revenue.js`, `migrate.js`, `test/integration/workflow.test.js`.
New frontend: `components/reception/FeeModal.js`, `components/reception/FeesPanel.js`, `components/FeeReceiptView.js`, `app/(app)/reception/fee-receipt/[id]/page.js`, `components/admin/DepartmentsModal.js`. Modified frontend: reception page, `DoctorCard`, `RegisterModal`, doctor dashboard and patient file, `PrescriptionsTab`, `DispensingRecordsTab`, `ReceiptSheet` (now the bill), pharmacy receipt page, doctors page, reports page, admin dashboard, UI badges.

## G. Schema changes (additive)
`Visit.fee {amount, discount, status, method, paidAt, receiptNo, receivedBy, note}` with two indexes · `DispensingRecord.billNo, subtotal, discount, paymentMethod, paid, paidAt` (records without `paid` count as paid).

## H. Endpoints
New: `GET /api/visits/fees` · `PATCH /api/visits/:id/fee` (pay / waive / reset-by-admin) · `GET /api/visits/:id/fee-receipt` · `PATCH /api/pharmacy/dispensing/:id/pay` · `GET /api/admin/departments`, `PATCH /api/admin/departments/:id`. Changed: `POST /api/patients/register` and `/:id/visits` accept `visit.payment`; `POST …/dispense` accepts `payment {method, discount}`; receipt endpoint returns bill data; reception stats include fees.

## I. Verification (honest)
* **Run in headless Chromium** against a fake API shaped like the backend (fresh results): 28 checks on the new screens (reception cards, fees panel, collect dialog with discount and receipt, registration with payment, fee receipt, doctor fee column, pharmacy payment block and bill preview, pay-later settlement, doctor's-template view, bill sheet, dispensing records, departments, reports) **all passed, no console errors**; the earlier 59 + 12 browser checks still pass (no regressions).
* 15 backend unit tests pass (incl. money maths: discount clamping, fee status, bill status); all backend files pass a syntax check; all 65 frontend files parse as JSX; every icon name checked against a Lucide reference set.
* **Not run:** the backend against a real database and the integration tests (written, now including fees, bills, departments). While writing them I found and fixed a bug in my own earlier test file (the doctor id was `undefined` in the registration test), so please run `npm run test:integration` with a `_test` database before trusting that suite.
