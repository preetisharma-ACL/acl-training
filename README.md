# Aajneeti Academy — Training & Assessment portal

Frontend for Aajneeti's internal training portal. Employees sign in, land on a
personalised dashboard, read the training material for their role, take a
timed assessment and get a scoreboard. Two or three admins manage users,
departments, designations, materials, assessments and results.

**Status:** frontend only. Authentication, data and grading are mocked in
`src/services/` until the backend endpoints below exist.

Stack: SolidJS + Vite + Tailwind CSS + lucide-solid, Inter font. No other
dependencies (routing, charts and PDF generation are small local modules).

## Run it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # production build in dist/
```

Production hosting must serve `index.html` for unknown paths (SPA fallback),
because the app uses real URLs such as `/training/handbook`.

### Demo accounts (mock mode)

The login page has two one-click demo logins (one employee, one admin). Every
employee's password is `Welcome@123`; every admin's is `Admin@123`.

| Email | Who |
|---|---|
| `preeti.sharma@aajneeti.com` | SEO Executive, fresh start: walk the whole journey |
| `rohit.verma@aajneeti.com` | Sales Manager |
| `kabir.anand@aajneeti.com` | Intern: designation not mapped, so "no module assigned" |
| `alok@aajneeti.com` | Super Admin (also `meera.iyer@…`, `devansh.kapoor@…`) |

All 24 employees are in `src/data/org.js`. There are no sample attempts:
results, scoreboards and admin charts fill in as people take assessments.
Each department starts with one module, its essentials guide; admins upload
PDF modules on top. Mock data lives in localStorage;
admins can restore it from the account menu with **Reset demo data**.

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
   attempt remains. The behaviour of the original portal is unchanged: a timed
   quiz with four options per question. Leaving the tab or window pauses the
   test with a warning and counts it. Answers and time left survive a reload.
   The test auto-submits at 00:00, and A–D / 1–4 / ← → work as keyboard
   shortcuts. **While a test is running, every other URL, the training module
   included, redirects back to it.**
5. **Scoreboard:** score, pass or fail, department standing, stats, answer
   review with filters, attempt history, retake if attempts remain, and a
   certificate PDF on a pass.

Admin screens live under `/admin`: overview dashboard, users, departments,
designations (the designation → department mapping), materials (PDF upload
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

## Code map

| Path | What |
|---|---|
| `src/App.jsx` | Routes and guards (signed-out, role, assessment lock) |
| `src/lib/router.jsx` | Small history router |
| `src/lib/pdf.js` | Mock-only PDF writer (previews and downloads) |
| `src/store/` | Signed-in user, theme, toasts, in-progress assessment session |
| `src/services/` | **The only layer that changes for the backend** (see below) |
| `src/services/mockDb.js` | Mock database, seeded from `src/data/` |
| `src/components/` | UI kit, charts, icons |
| `src/layouts/` | Employee shell (top nav + phone tab bar), admin shell (sidebar) |
| `src/pages/` | Login, `employee/*`, `admin/*`, Profile |

Design tokens: plum `#542C5F` (primary), lime `#C7E848` (accent) and ivory
`#F5F1E8` (canvas). Surface colours are CSS variables in `src/index.css`, so
every component works in light and dark mode. Crimson is reserved for errors.

## Backend contract (to build)

Each service function's header comment lists its endpoint. Swap the function
bodies for `fetch` calls, delete `mockDb.js` and `src/data/`, and the UI needs
no other change.

**Auth / profile** (`services/auth.js`)

| Method & path | Returns / does |
|---|---|
| `POST /auth/login/` | `{ email, password }` → `{ token, user }` |
| `POST /auth/logout/` | Ends the session |
| `POST /auth/password-reset/` | `{ email }`. Always succeeds; never reveals whether an account exists |
| `GET /me/` | `{ id, role, name, email, phone, code, location, joinedAt, bio, adminTitle?, preferences, designation: { id, title, level } \| null, department: { id, name, description, head, location } \| null }`. **Department is resolved server-side from the designation.** |
| `PATCH /me/` | `{ phone, location, bio, preferences }`. Name, email, designation and department are admin-only |
| `POST /me/password/` | `{ current_password, new_password }` |

**Training** (`services/training.js`)

| Method & path | Returns / does |
|---|---|
| `GET /training/module/` | Materials with per-user progress, unlock conditions, attempts used/left, best and last attempt, due date (see `getMyModule`) |
| `GET /training/materials/{id}/` | Material incl. `content` (manual/structured) or `fileUrl` (PDF). 403 if it isn't in the user's module |
| `POST /training/materials/{id}/progress/` | `{ percent?, completed? }` |
| `POST /training/attempts/` | Starts an attempt. Questions carry **no correct answers**. **403** unless every required material is complete and attempts remain |
| `POST /training/attempts/{id}/submit/` | `{ answers: { [questionId]: optionId }, time_taken_seconds, focus_violations, auto_submitted }` → result, **graded on the server** |
| `GET /training/attempts/mine/` | The user's result summaries |
| `GET /training/attempts/{id}/` | One result with review and `standing: { rank, of, departmentAverage }` |
| `GET /announcements/` | Dashboard announcements |

**Admin** (`services/admin.js`; every endpoint must be admin-only)

Overview stats; users CRUD plus status, password-reset email and attempt reset;
departments CRUD; designations CRUD (the designation → department mapping);
materials CRUD with PDF upload; assessment settings per department; question
bank CRUD; results list and detail; posting announcements. Function names and
payloads in `services/admin.js` describe each call.

> ⚠️ **Grading and the answer key must move to the server.** In mock mode the
> question bank, answers included, ships in the JS bundle, so anyone could
> read it. The same goes for the unlock rules: the server must enforce them,
> not only the UI.

### Open decision: session handling

Mock mode stores a fake token (localStorage with "Keep me signed in",
otherwise sessionStorage). For production, prefer an httpOnly session cookie;
`store/auth.js` is the only place that would change.

## Content

All guides, question banks and people are **sample data**
(`src/data/`), to be replaced by real content served from the backend.
