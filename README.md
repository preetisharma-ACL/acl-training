# Aajneeti Academy — Training & Assessment portal

Internal training portal for Aajneeti Connect Limited. Employees sign in, land on a
personalised dashboard, read the training material for their role, take a
timed assessment and get a scoreboard. Two or three admins manage users,
departments, designations, materials, assessments and results.

**Stack**

- Frontend: SolidJS, Vite, Tailwind CSS, lucide-solid, Inter.
- Backend: Node.js (ES modules, plain JavaScript), Express 5, PostgreSQL, Prisma 6, Zod, Argon2id, express-session + connect-pg-simple, Multer, Helmet, express-rate-limit.
- Tests: Vitest + Supertest.

One `package.json` and one `.env` serve both halves.

## Run it locally

Prerequisites: Node.js 20.12+ (22 LTS recommended) and PostgreSQL 15+.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, TEST_DATABASE_URL, SESSION_SECRET, seed passwords
npm run db:migrate            # create the schema
npm run db:seed               # sample departments, people, guides, question banks (dev only)

npm run server                # API  → http://localhost:5000/api/v1 (restarts on change)
npm run dev                   # app  → http://localhost:5174 (proxies /api to the server)
```

Run both commands, in two terminals. Vite proxies `/api` to Express, so the
app and the API share one origin, exactly as in production.

### Accounts (after `npm run db:seed`)

The seed creates the two admins. Their passwords come from `.env`
(`SEED_SUPER_ADMIN_PASSWORD`, `SEED_ADMIN_PASSWORD`).

| Email | Who |
|---|---|
| `alok@aajneeti.social` | Super admin |
| `preeti@aajneeti.social` | Admin |

Add employees from **Admin → Users**. For test data, set `SEED_SAMPLE_EMPLOYEES=true`
and re-run the seed. That adds 24 sample employees (password: `SEED_EMPLOYEE_PASSWORD`)
across every department and level. The seed refuses to run when `NODE_ENV=production`.

### Mock mode (no backend)

Set `VITE_USE_MOCK=true` and run `npm run dev` alone. The UI then runs against
the in-browser mock database in `src/services/mock/`, with demo-account chips
on the login page. With `VITE_USE_MOCK=false` (the default), the mock code, the
sample data and their answer keys are not part of the bundle at all.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` / `build` / `preview` | Frontend (Vite) |
| `npm run server` | API with auto-restart (development) |
| `npm run server:start` | API (production) |
| `npm run db:migrate` | Create and apply a migration from `server/prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Development sample data (idempotent) |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database |
| `npm run db:studio` | Browse the database |
| `npm run admin:create -- --email … --name "…" [--super]` | Create an admin (or reset one) with a one-time temporary password |
| `npm test` | Backend tests against `TEST_DATABASE_URL` |

## Environment variables

Every variable is documented in [`.env.example`](.env.example). Only
`VITE_*` variables reach the browser. The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `TEST_DATABASE_URL` | PostgreSQL. Tests wipe the test database, so the two must differ |
| `SESSION_SECRET` | Cookie signing secret, at least 32 random characters |
| `SESSION_HOURS`, `REMEMBER_ME_DAYS` | Session lifetime without / with "Keep me signed in" |
| `APP_ORIGINS` | Origins allowed to make state-changing requests (CSRF) and CORS calls |
| `TRUST_PROXY` | `1` behind a proxy or load balancer that terminates HTTPS |
| `STORAGE_DIR`, `MAX_UPLOAD_MB` | Private PDF storage folder and upload limit |
| `SEED_SUPER_ADMIN_PASSWORD`, `SEED_ADMIN_PASSWORD`, `SEED_EMPLOYEE_PASSWORD` | Development seed only |
| `VITE_API_URL`, `VITE_USE_MOCK` | Frontend: API base (`/api/v1`) and mock mode |

## The flow

**Login → Personalised dashboard → Training module → Assessment → Scoreboard**

1. **Login:** email and password only. The backend returns the user with
   their designation and the department derived from it. Nobody picks their
   own department.
2. **Dashboard:** greeting, department and designation, module progress,
   journey tracker, next-step call to action, due date, results and
   announcements.
3. **Training module:** the department's materials plus company-wide ones.
   Three content types open in an in-portal viewer, and each can be downloaded
   as a PDF:
   - **PDF**: shown in the browser's PDF viewer.
   - **Written manual**: paper-style reader with chapters, a contents rail,
     text size and print.
   - **Structured guide**: section cards with key points and tips.

   Manuals and guides mark themselves complete when read to the end. A PDF is
   marked complete by the reader.
4. **Assessment:** unlocks when every required material is complete and an
   attempt remains. A timed quiz with four options per question; the server
   sets the deadline and the clock keeps running. Leaving the tab or window
   shows a warning and counts it. Answers and time left survive a reload.
   The test auto-submits at 00:00, and A–D / 1–4 / ← → work as keyboard
   shortcuts. **While a test is running, every other URL, the training module
   included, redirects back to it.**
5. **Scoreboard:** score, pass or fail, department standing, stats, answer
   review with filters, attempt history, retake if attempts remain, and a
   certificate PDF on a pass.

Admin screens live under `/admin`: overview dashboard, users, departments,
designations (the designation → department mapping), office locations
(Lucknow, Noida, Kolkata to start — add, rename, delete), materials (PDF upload
and a manual editor with live preview), assessments with a question bank, and
results with CSV export. Admin changes show up in the employee experience
straight away.

## Levels: team heads, seniors, juniors

Every designation has a level: **Team head**, **Senior** or **Junior**. Inside
a department:

- **Materials** go to the department (or company-wide) **and** to chosen
  levels. In "Add material" an admin switches Team heads / Seniors / Juniors on
  or off; all three are on by default.
- **Assessments**: each department has **three**, one per level, each with its
  own question bank and settings (time, pass mark, attempts, questions per
  attempt). An employee automatically gets the one for their level.
- Each attempt draws a fresh set of questions from the bank (unseen first).

The backend should resolve the level from the designation, exactly as it
resolves the department.

## Accounts and passwords

- Admins create accounts with an email and password and share them with the employee directly. No email is sent. The employee signs in with those credentials and can keep using them.
- **Reset password** (Admin → Users) generates a random temporary password. That one must be replaced at the next sign-in, and until then the API refuses everything else.
- Admin → Users → **Reset password** shows the new temporary password once. It ends all of that user's sessions and is written to the audit log.
- "Forgot password?" on the login page doesn't reveal whether an account exists. It flags the request for admins (`resetRequestedAt` in the users list).
- Everyone changes their own password, mobile number, location, bio and notification preferences on the **Profile settings** page (account menu → Profile settings; `/profile`, or `/admin/profile` for admins). Name, email, employee code, designation, department, level, role and status are admin-only.
- Changing a password signs out every other session.

## Security

- Argon2id password hashes. Sessions live in PostgreSQL behind an httpOnly, SameSite=Lax cookie (`Secure` + `__Host-` prefix in production). The session ID is regenerated at login.
- Sessions are invalidated on password change, admin reset, deactivation and role change (`authVersion`).
- Role checks happen on the server for every admin route. Ownership checks cover every employee resource (other people's attempts return 404).
- Zod validates every input. Unknown fields are rejected where they matter (profile, updates).
- Helmet (CSP, frame and referrer policies), `Cache-Control: no-store` on the API, CORS limited to `APP_ORIGINS`, and an Origin/Referer check plus a JSON-only rule against CSRF.
- Rate limits on login, password reset, password change, and the API overall.
- PDFs are checked by content, active content is refused, files are stored outside any public folder, and they are served only to assigned employees and admins.
- Assessment eligibility, question selection, the timer and grading run only on the server. Answer keys are never sent to employees before they submit.
- An audit log records admin changes, password events, and every view or export of results.
- Errors are generic, with details only in server logs.

## Code map

| Path | What |
|---|---|
| `src/` | Frontend. `services/` is the only layer that talks to the API (`api.js` is the fetch client); `services/mock/` is mock mode |
| `src/store/` | Signed-in user, theme, toasts, the running assessment (server deadline + answer autosave) |
| `src/pages/Profile.jsx`, `src/components/account.jsx` | Profile settings page (details + change password) |
| `src/pages/NewPassword.jsx` | "Create a new password" screen after an admin reset (login-page layout, shared `AuthLayout`) |
| `server/prisma/` | `schema.prisma`, migrations, development seed |
| `server/src/routes → controllers → services` | HTTP wiring → thin handlers → business logic |
| `server/src/services/` | `assignment` (who gets what), `training`, `assessment` (engine), `questionPicker`, `scoring`, `ranking`, `certificate`, admin services |
| `server/src/middleware/` | `requireAuth`, `requireAdmin`, `assessmentLock`, `validate`, `upload`, `originCheck`, `rateLimit`, `errorHandler` |
| `server/tests/` | Vitest suites: auth, admin, training, assessment, scoring |
| `docs/API.md` | Full API reference |

## Deploying

No Docker or Nginx is required. The Express server also serves the built
frontend (with SPA fallback) when `NODE_ENV=production`, so one Node process
is the whole application:

```bash
npm ci
npm run build                 # dist/
npm run db:deploy             # apply migrations
npm run admin:create -- --email you@aajneeti.social --name "Your Name" --super
NODE_ENV=production npm run server:start
```

Checklist:

- Use HTTPS (managed hosts terminate it for you). Set `TRUST_PROXY=1` when a proxy sits in front, so Secure cookies and client IPs work.
- Set `APP_ORIGINS` to the public URL, e.g. `https://academy.aajneeti.social`.
- Use a fresh, long `SESSION_SECRET` and a managed PostgreSQL (e.g. Neon). Only `DATABASE_URL` changes.
- Uploaded PDFs live in `STORAGE_DIR`. That's fine on a VPS. On hosts with an ephemeral disk, swap `server/src/services/storage.service.js` for an S3/R2 driver with the same functions.
- Never run `db:seed` in production. Create admins with `admin:create` instead.

## Content

The guides, question banks and people in the seed are **sample data**. Replace
them through the admin console.
