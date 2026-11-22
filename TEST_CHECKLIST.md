# Manual end-to-end test checklist
The code has been written and syntax-checked, and the pure-logic unit tests pass, but the full system has **not** been exercised against a live database by its author. Work through this list once after installing, and report any failure with the step number and the error text.

Setup: `npm run seed`, start backend + frontend. All demo passwords: `Hospital@12345` (you will be forced to change each one at first login).

## A. Accounts and security
1. Log in as admin → forced to change password → set `Admin-Passw0rd1` → lands on Admin dashboard.
2. Enter a wrong password 5 times on another account → 6th attempt says locked.
3. Open `/admin` while logged in as reception → "Access denied".
4. Log in the same user in two browsers, change password in one → the other is signed out on its next action.

## B. Reception
5. Register patient "Ali Raza", phone 03001234567, assign Dr. Ahmed → Patient ID `PID-000001` appears, patient shows in Dr. Ahmed's card (Waiting).
6. Register the same name + phone again → duplicate warning; "Register anyway" works; cancel does not create a record.
7. Search by ID, by phone and by name → follow-up visit created without a new patient.
8. Change status from the doctor card (Waiting → In Consultation → Cancelled).

## C. Doctor
9. Log in as Dr. Ahmed → patient appears; dashboard counts match.
10. Open the patient → his cardiology template fields are shown; try Complete without a diagnosis → error lists required fields.
11. Save draft, reload page → values kept. Add 2 medicines (type "Pan" → suggestion appears).
12. Request CBC + custom test → appears under Laboratory tests.
13. Complete consultation → message mentions prescription number; fields become read-only.
14. Click Amend, give a reason, change diagnosis → saved; Print/PDF shows new value.
15. Print/PDF page: header, patient, vitals, fields, medicines, signature; Download PDF opens a file.
16. Log in as Dr. Ali → cannot see Dr. Ahmed's patient (Patients page and direct URL).

## D. Laboratory
17. Lab user sees the CBC request (Pending). Open → Accept → Mark sample collected.
18. Expand CBC into components, enter results (one out of range → flagged High/Low automatically).
19. Try "Complete" with a blank result → blocked. Fill all → complete.
20. Upload a PDF report; try uploading a `.exe` renamed to `.pdf` → rejected.
21. Print/PDF lab report. Back as Dr. Ahmed: results visible in the record and on the dashboard list.

## E. Pharmacy
22. Pharmacy user sees the prescription (Pending). Review → matching stock is suggested; the expired item cannot be chosen.
23. Dispense → stock decreases, status Dispensed, total shown. Dispense again → blocked.
24. Inventory: add, edit and delete a medicine; low-stock and expired badges and filters work.
25. Print prescription from the pharmacy.

## F. Admin
26. Add a doctor (copy the temporary password) → they can log in and have a default template.
27. Template designer: add fields of each type, drag to reorder, mark required, upload a logo, preview, save → that doctor's form changes; an old finished visit still prints as before.
28. Add a receptionist; deactivate and reactivate an account.
29. Reports: change the date range, charts and numbers change; download the three CSV files and open them in a spreadsheet.
30. Audit log: logins, consultation completion, dispensing and exports appear.

## G. Responsive / browsers
31. Repeat a few steps at phone width (sidebar becomes a menu, tables scroll sideways) and in Chrome + Firefox.

## H. Round 2 changes (please test these first)
32. Doctor dashboard: your **availability checkbox**, **signature upload** and **My prescription template** card are shown. Tick "I have arrived" → on the Reception dashboard the doctor card shows a green "Available" badge within ~10 seconds, and the registration form lists "● Available". Log out as the doctor → reception shows "Not available".
33. Upload a PNG/JPG signature (≤500 KB). Open a patient: the pad header shows hospital name/address/phone and the doctor's name, qualification, speciality, timing and phone, with today's date.
34. In the consultation page the **Recommend laboratory tests** panel is on the right of the prescription fields. Send tests → they appear in the lab queue.
35. Click **Confirm & send to pharmacy** → prescription appears in Pharmacy; the patient shows **Completed** on Reception automatically.
36. Print/PDF prescription: header, doctor details, "Tests advised", medicines and the signature image.
37. Lab: tick **Done** per test (or "Tick all as done"), then **Confirm complete & send to doctor**. A test with no typed result needs an uploaded report file.
38. Pharmacy: dispense → a summary shows medicines, batch, quantity, price and total; stock drops; **Print receipt** and **Print prescription** both work; a dispensed row has a **Receipt** button.

## I. Round 3: the consultation page is the prescription pad
39. As a doctor, open any patient: the page looks like the prescription paper. Top: hospital + doctor header. Then the patient band (ID, name, age/gender, phone, visit no.) and **vital signs** exactly as the receptionist entered them.
40. The **Prescribe lab test** button is visible for every patient (top right and in the bottom bar). Click it, choose tests, send: they appear under "Laboratory tests advised" on the pad and in the lab queue.
41. Fill the template fields and medicines directly on the pad, Save, reload: everything stays. Confirm & send to pharmacy: the pad becomes read-only.
42. Dashboard: the template layout is now a collapsed "View my prescription template layout" preview only.

## J. Round 4: Workflows A-D (run `npm run migrate` first)
**A. Doctor prescription**
43. Doctor dashboard → View Details on a current patient: the page opens (no "Visit not found"); patient details, vitals, history, previous prescriptions and lab reports are shown. Open the same patient via the Patients page and via a bookmarked URL: still works.
44. Write a prescription (diagnosis, 2 medicines, advice, doctor notes, follow-up). **Save draft**: a Prescription No. appears; reload: all values remain. The pharmacy list does NOT show it yet.
45. **Save & send to pharmacy**: message with the Rx number; press it again: still one prescription. The consultation is not finished yet. Print / PDF works.
**B. Pharmacy**
46. Pharmacist sees the prescription (Pending) with Rx no., patient, ID, doctor, date, visit ID. View Details shows the doctor's text, read-only.
47. Dispense only part of one medicine → status **Partially Dispensed**, stock drops by that quantity; dispense the rest → **Dispensed**. Mark one other medicine unavailable. Print receipt (all events) and print prescription.
48. Another prescription: **Return to doctor** with a reason → the doctor's dashboard shows it in red; correct and re-send → back to Pending.
**C. Pharmacist management (admin)**
49. Pharmacy → Pharmacists: add (invalid email/phone are rejected; duplicate email rejected), copy the temporary password. Edit name/permissions. Search. Deactivate → that user cannot log in; reactivate; reset password; delete a new pharmacist; deleting one who has dispensed is refused. A pharmacist with only "view receipts" cannot dispense or edit inventory.
**D. Laboratory**
50. Doctor: **Prescribe lab test**: pick category and tests, indication, priority, instructions → order appears; submitting the same test again is refused; cancel a Pending order.
51. Lab: orders sorted with Emergency/Urgent first; accept → collect → enter results → tick Done → confirm complete. Cancel another with a reason.
52. Doctor: statuses are visible on the page and in "Laboratory tests (my orders)"; results are visible, also under Previous laboratory reports on the patient's next visit.

## K. Round 5
53. Doctor dashboard: each patient row has **View Details** and **Prescription**. The dashboard shows no template preview.
54. **View Details**: opens the patient file (info, doctor, visit, vitals, history, diagnoses, previous visits, prescriptions, lab reports). If it fails, an error box shows the message, HTTP status and the call, and the backend terminal prints a `[visit lookup]` or `[details:...]` line: send me that.
55. **Prescription**: opens the template with that patient's name, ID, age/gender, phone and vitals at the top.
56. Dashboard > **Laboratory tests**: choose a patient, type a test, press Enter, add indication, Send. The lab list shows patient, referring doctor, tests, visit and complaint/diagnosis.
57. Pharmacy > **Dispensing records**: after dispensing, the patient appears with each medicine and quantity; summary per medicine; CSV downloads.

## L. Round 6 (run `npm run migrate` first)
58. Reception: register a patient for a doctor with a fee; tick **Collect the fee now** (Cash, discount 100): the visit is Paid, a receipt number (FEE-...) is shown. Register another without ticking: Unpaid.
59. Reception dashboard: cards **Unpaid fees (today)** and **Fees collected today**; the doctor card shows **Collect fee** for the unpaid patient and **Fee paid** for the paid one; **Consultation fees** lists both with filters.
60. Collect fee (Card, discount): amount to receive updates, success shows the receipt number, **Print fee receipt** opens a printable receipt. Try collecting the same fee again (second browser tab): refused. Waive needs a reason.
61. Doctor dashboard and patient file show the fee status; the doctor has no button to change it.
62. Pharmacy: dispense with a discount and **Pay later**: bill number appears, subtotal/discount/payable are correct; Dispensing records show Unpaid; **Mark paid** settles it. **Print bill** shows bill number, discount, total and payment status.
63. Pharmacy detail: **Show prescription on doctor's template** displays the prescription laid out like the doctor's template.
64. Admin: Doctors page > **Manage departments**: rename one; deactivating one that still has doctors is refused.
65. Admin Reports: revenue = fees collected + paid pharmacy bills; **Unpaid consultation fees** card; the visits CSV has fee columns.
