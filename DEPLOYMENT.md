# Deployment & security checklist

## 1. Run locally (development)
```bash
# MongoDB must be running locally (or use Docker: docker run -d -p 27017:27017 mongo:7)
cd backend  && cp .env.example .env   # set JWT_SECRET, MONGO_URI
npm install && npm run seed && npm run dev
cd ../frontend && cp .env.local.example .env.local && npm install && npm run dev   # http://localhost:3000
```
Run tests: `cd backend && npm test` (unit, no database needed) and
`MONGO_URI_TEST=mongodb://127.0.0.1:27017/hms_test npm run test:integration` (**wipes that database**).

## 2. Run in production (Docker)
1. `cp .env.example .env` and set strong values (`openssl rand -base64 48` for JWT_SECRET and the Mongo password).
2. `docker compose up -d --build`
3. Create the first admin (never run `npm run seed` in production; it refuses to):
   `docker compose exec -e ADMIN_EMAIL=you@hospital.org -e ADMIN_PASSWORD='Str0ng-Passw0rd!' backend npm run create-admin`
4. Put an **HTTPS** reverse proxy in front of port 3000 (Caddy is simplest). Login cookies are `Secure` in production and will not work over plain http.
   `CLIENT_URL` must be exactly the public https origin.
5. Sign in, change the password, create the doctors/staff, assign templates.

## 3. Before real patient data
- [ ] HTTPS only; the database port is not exposed to the internet (the compose file already does this).
- [ ] Strong, unique `JWT_SECRET` and database password; secrets are not committed to git.
- [ ] No demo accounts exist (`admin@hms.local` etc.). Delete them if the seed was ever run.
- [ ] Automated backups, and a tested restore: `mongodump` the database **and** back up the `uploads` volume (lab reports, logos).
- [ ] Database user for the app has only the permissions it needs; nobody edits `auditlogs` directly. Consider a separate, append-only audit store.
- [ ] Disk/volume encryption on the server; OS and Docker images kept updated (`npm audit` regularly).
- [ ] Staff trained: each person has their own account, no shared logins, accounts deactivated when staff leave.
- [ ] Review local health-data privacy law and hospital policy (retention, consent, breach reporting). This software gives you the technical controls; it does not make you compliant by itself.

## 4. What the application already enforces
Role-based access on the server for every route; doctors see only their own patients; bcrypt passwords (12 rounds) with complexity rules; account lockout after 5 failed logins; httpOnly SameSite cookies + Origin check on writes; sessions invalidated on password change/reset; forced change of temporary passwords; request validation (zod) and NoSQL-operator blocking; helmet headers and rate limiting; upload checks by file signature (PDF/PNG/JPG only, no SVG); finalized consultations can only be amended with a reason (previous version kept); audit log of logins, record views, clinical, lab, pharmacy and admin actions; CSV exports neutralise spreadsheet formulas.

## 5. Known limitations
- No email/SMS; temporary passwords are shown once to the admin and must be shared securely.
- No two-factor authentication yet.
- Notifications bell is decorative; dashboards refresh every 30 s instead of live push.
- Profile pictures are URLs (only the template logo supports upload).
- Lab reference ranges in the catalog are general adult defaults; the lab should set its own.
- No appointment booking/scheduling: "appointments" are same-day registrations/visits.
- Billing is limited to consultation fee + pharmacy total (no invoices, discounts or payments).

## 6. Keep dependencies patched
Run `npm audit` in `backend/` and `frontend/` before each release and after any security announcement. The frontend pins Next.js 14.2.35 (the patched 14.x release for the December 2025 React/Next.js advisories); check nextjs.org/blog for newer patches. Do not use `npm audit fix --force` blindly: it can jump major versions and break the app.

## 7. Upgrading an existing database
After deploying a new version run `npm run migrate` in `backend/` (idempotent). It renames old lab statuses, marks open prescriptions, adds standard fields to existing templates (as a new version) and syncs indexes. Take a database backup first.

Note for upgrades from before Round 6: `npm run migrate` gives older visits a fee record (Completed visits are marked Paid by assumption, others Unpaid). Review this against your cash records.
