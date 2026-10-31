# Aajneeti Academy — API reference

Base URL: `/api/v1` (development: through the Vite proxy at `http://localhost:5174/api/v1`, or directly at `http://localhost:5000/api/v1`).

## Conventions

**Authentication.** A server-side session. `POST /auth/login` sets an httpOnly, `SameSite=Lax` cookie (`aa.sid`; `__Host-aa.sid` and `Secure` in production). The browser sends it automatically. Use `credentials: "include"` with fetch. No tokens exist in JavaScript.

**CSRF.** Every `POST`/`PATCH`/`PUT`/`DELETE` must carry an `Origin` (or `Referer`) header that equals the API's own origin or one listed in `APP_ORIGINS`. Bodies must be `application/json` or `multipart/form-data`. Anything else gets `403 BAD_ORIGIN` or `415`.

**Responses.**

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "NOT_ELIGIBLE", "message": "Safe, human-readable text", "details": … } }
```

**Common error codes.**

| Status | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` | Not signed in / session no longer valid / wrong email or password |
| 403 | `FORBIDDEN`, `BAD_ORIGIN`, `ACCOUNT_INACTIVE`, `PASSWORD_CHANGE_REQUIRED`, `NOT_ASSIGNED`, `NOT_ELIGIBLE`, `ASSESSMENT_IN_PROGRESS`, `NOT_PASSED` | Not allowed |
| 404 | `NOT_FOUND` | Missing, or belongs to someone else |
| 409 | `CONFLICT`, `ATTEMPT_CLOSED`, `TIME_UP`, `ATTEMPT_RUNNING`, `ATTEMPT_VOIDED` | State conflict |
| 422 | `VALIDATION_ERROR` | Invalid input; `details` lists `{ where, path, message }` |
| 429 | `RATE_LIMITED` | Too many attempts |

**Rate limits.** Login: 10 failures per 15 min per IP + email. Password reset: 5 per hour per IP. Password change: 10 per 15 min. Whole API: 300 requests per minute per IP.

**Forced password change.** While `mustChangePassword` is true (after an admin **Reset password**), every endpoint except `GET /me`, `POST /me/password` and `POST /auth/logout` returns `403 PASSWORD_CHANGE_REQUIRED`.

**Levels.** The API uses `"head" | "senior" | "junior"`. Designation objects also carry the label (`"Team head" | "Senior" | "Junior"`). Inputs accept either.

---

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password, remember? }` | `{ user: Me }` and sets the cookie. `remember` → persistent cookie for `REMEMBER_ME_DAYS`, otherwise a browser-session cookie |
| POST | `/auth/logout` | — | Destroys the session, clears the cookie |
| POST | `/auth/password-reset` | `{ email }` | Always `{ ok: true }`. For an active account it queues a request that admins see in Users (`resetRequestedAt`). No email is sent |
| POST | `/auth/password-reset/confirm` | `{ token, new_password }` | Single-use token flow, kept ready for when an email transport is added. Tokens are stored as SHA-256 hashes and expire after 30 minutes |

## Profile (`/me`, signed in)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/me` | — | `Me` |
| GET | `/locations` | — | `[{ id, name }]` — the office list for the profile form |
| PATCH | `/me` | `{ phone?, location?, bio?, preferences?: { emailReminders?, resultEmails?, weeklyDigest? } }` | `Me`. Any other key (name, email, designation, role, …) → 422. `phone`: 7–15 digits with optional `+`, spaces, `-`, `.`, `()`, or `""` |
| POST | `/me/password` | `{ current_password, new_password, confirm_password? }` | `{ user: Me }`. Signs out all other sessions. Limits: 10 failed attempts per account per 15 min (colleagues on the same IP aren't affected) and 100 requests per IP per 15 min |

```js
Me = {
  id, role: "employee" | "admin", isSuperAdmin, name, email, phone, code, location, joinedAt, bio,
  adminTitle, preferences, mustChangePassword,
  designation: { id, title, level: "Junior", levelKey: "junior" } | null,
  department: { id, name, description, head, location, active } | null,   // from the designation
  level: "junior" | null
}
```

## Employee training (`/training`, signed in)

| Method | Path | Notes |
|---|---|---|
| GET | `/training/module` | Everything the dashboard needs (below) |
| GET | `/training/materials/:id` | Material + `content` (manual/structured/media) or `fileUrl` (PDF). `403 NOT_ASSIGNED` if not in the user's module |
| GET | `/training/materials/:id/file` | Streams the PDF (`inline`; `?download=1` → attachment). Assigned employees and admins only |
| POST | `/training/materials/:id/progress` | Heartbeat from the open viewer: `{ percent?, seen?: [chapter/section ids], completed? }` (`{}` is a plain heartbeat). Opening is recorded by the server when the material (or its PDF file) is loaded; before that → 409 `NOT_OPENED`. Completion needs server-side evidence: reading time of at least 40% of `estMinutes` (20 s – 10 min, from server-timed heartbeats, each gap capped at 45 s), every chapter/section seen (manuals, guides) and the file streamed (PDFs). Manuals and guides complete themselves once it's met; PDFs/media on `completed: true`. Asking too early → 409 `NOT_READ_YET` with the current progress in `details`. Percent only rises |
| POST | `/training/attempts` | Starts an attempt (201), or returns the running one (200, `resumed: true`). `403 NOT_ELIGIBLE` with `details.condition` = `materials` / `attempts` / `questions` |
| GET | `/training/attempts/active` | Running attempt or `null` (after a reload) |
| PUT | `/training/attempts/:id/answers` | Autosave `{ answers: { [questionId]: optionId \| null }, focus_violations? }` |
| POST | `/training/attempts/:id/submit` | `{ answers, time_taken_seconds?, focus_violations?, auto_submitted? }` → Result. Graded once; repeats return the same result with `alreadySubmitted: true` |
| GET | `/training/attempts/mine` | Result summaries (counted attempts) |
| GET | `/training/attempts/:id` | Result with `review`, `standing`, `history`, `certificate` (owner only; others get 404) |
| GET | `/training/attempts/:id/certificate` | Certificate PDF for a passed attempt |
| GET | `/announcements` | Published announcements for everyone or the user's department |

While an attempt is running, material endpoints and past results return `403 ASSESSMENT_IN_PROGRESS` (`details.attemptId`).

**Module**

```js
{
  department, designation: { id, title, level }, level,
  assessment: { id, level, title, description, active, questionCount, bankSize, durationSeconds, durationMinutes,
                passPercent, maxAttempts, attemptsUsed, attemptsLeft } | null,
  materials: [{ id, title, type: "pdf"|"manual"|"structured"|"media", scope: "department"|"company", required,
                description, estMinutes, version, author, updatedAt, fileName, sizeBytes, pages, mediaKind, mediaUrl,
                progress: { opened, completed, outdated, percent, lastOpenedAt, completedAt, completedVersion,
                            canComplete, requirement: { minSeconds, activeSeconds, sectionsTotal, sectionsSeen, fileOpened } } }],
  requiredCount, completedRequired, completedTotal, readingMinutesLeft,
  conditions: [{ id, label, detail, met }], eligible, passed, best, lastAttempt,
  activeAttempt: { id, expiresAt } | null,
  stage: "unassigned" | "learn" | "assess" | "done", dueAt, announcements, recentResults
}
```

**Running attempt** (no correct answers or explanations):

```js
{ attemptId, id, status: "in_progress", assessmentId, assessmentTitle, departmentId, departmentName, level, designation,
  durationSeconds, passPercent, marksPerQuestion, attemptNumber, maxAttempts,
  startedAt, expiresAt, serverNow, remainingSeconds, focusViolations, answers,
  questions: [{ id, text, options: [{ id, text }] × 4 }] }
```

**Result**

```js
{ id, status: "submitted", userId, assessmentId, assessmentTitle, departmentId, departmentName, level, designation, attemptNumber,
  totalQuestions, correct, incorrect, unanswered, marks, totalMarks, percentage, passPercent, passed,
  timeTakenSeconds, durationSeconds, focusViolations, autoSubmitted, startedAt, submittedAt, voided,
  review: [{ id, questionId, text, options: [4 strings], chosen: index | null, correctIndex, isCorrect, explanation }],
  standing: { rank, of, totalEligible, departmentAverage, best, passedCount },
  history: [Result summary], certificate: { available, url } }
```

### Assessment rules (all enforced on the server)

- **Eligibility:** every required, published material for the user's department + level is complete (at or after the revision the admin last required). The assessment is active, has questions, and attempts remain. Unassigned employees have no test.
- **Questions:** only active questions with exactly 4 options and one correct answer are used. Unseen questions come first, then the least recently seen (ties random). No repeats within an attempt. With `shuffle`, question and option order are random. Each attempt stores an immutable snapshot of its questions, options and answer key.
- **Timer:** `expiresAt = startedAt + duration`, fixed at start. The clock does not pause. A 30-second grace period covers network latency. After it, submissions and autosaves are refused for new answers. The attempt is graded with the answers saved before the deadline and flagged `autoSubmitted`. An abandoned attempt is finalised the same way on the user's next request.
- **Grading:** against the snapshot only. Percentage has one decimal place, pass is `percentage ≥ passPercent`, and time taken is computed by the server. Client-sent scores are ignored. Answers naming unknown questions/options → `400 INVALID_QUESTION` / `INVALID_OPTION`, and the attempt stays open.
- **Concurrency:** starts are serialised per user (advisory lock), so there is never a second attempt or an exceeded limit. Submission claims the attempt atomically, so it is graded exactly once.
- **Ranking:** everyone with a graded attempt in the same department, each with their best score. Standard competition ranking (95, 90, 90, 80 → 1, 2, 2, 4). No names are exposed.

## Admin (`/admin`, admins only — every call is audited)

| Area | Endpoints |
|---|---|
| Overview | `GET /admin/overview` → `{ kpis, departments, weeks, statusBreakdown, recent, topPerformers, attention }` |
| Users | `GET /admin/users?q&departmentId&designationId&level&status&role` · `POST /admin/users` · `GET/PATCH/DELETE /admin/users/:id` · `PATCH /admin/users/:id/status { status }` · `POST /admin/users/:id/reset-password` → `{ email, temporaryPassword }` (20 per admin per hour) · `POST /admin/users/:id/reset-attempts { assessmentId? }` → `{ voided }`. `DELETE /admin/users/:id` is permanent: it removes the account with all its attempts, answers and progress → `{ attemptsDeleted }` (not yourself, not the last super admin) |
| Departments | `GET/POST /admin/departments` · `PATCH/DELETE /admin/departments/:id` (creating one also creates its 3 assessments; deleting needs it to be empty) |
| Designations | `GET/POST /admin/designations` · `GET/PATCH/DELETE /admin/designations/:id` (department + level required) |
| Locations | `GET/POST /admin/locations` · `PATCH/DELETE /admin/locations/:id`. Body `{ name }`; list rows add `users` and `departments` counts. A rename moves everyone at that office to the new name; delete → 409 while anyone uses it. User, department and `/me` `location` must be one of these names (any casing) or `""` → otherwise 400 `UNKNOWN_LOCATION` |
| Materials | `GET /admin/materials?departmentId&type&status&q` · `POST /admin/materials/upload` (multipart `file`) → `{ uploadId, fileName, sizeBytes, pages }` · `POST /admin/materials` · `GET/PATCH/DELETE /admin/materials/:id`. Creating one requires an explicit `departmentId` (an id, or `null` for company-wide), `required` and `levels` (at least one of `head`/`senior`/`junior`); `status: "draft"` keeps it admin-only until published. Structured guides take `content: { intro, sections: [{ id, title, body[], points?, tip? }] }` |
| Assessments | `GET/POST /admin/assessments` · `PATCH/DELETE /admin/assessments/:id` |
| Questions | `GET /admin/assessments/:id/questions?q&difficulty&active&archived` · `POST /admin/assessments/:id/questions` · `PATCH/DELETE /admin/questions/:id` |
| Results | `GET /admin/results?q&departmentId&designation&level&assessmentId&userId&passed&from&to&includeVoided` · `GET /admin/results/export` (CSV, same filters) · `GET /admin/results/:id` · `DELETE /admin/results/:id` (permanent; the attempt no longer counts towards best score, standing or attempts used) · `GET /admin/results/:id/certificate` |
| Announcements | `GET/POST /admin/announcements` · `PATCH/DELETE /admin/announcements/:id` |
| Audit log | `GET /admin/audit-logs?limit` |

**Users.** `POST` body: `{ name, email, password?, role?: "employee"|"admin"|"super_admin", designationId?, adminTitle?, phone?, location?, code?, joinedAt?, status?, mustChangePassword? }`. Without a `password` the server generates one and returns it once as `temporaryPassword`. Admin-set passwords work straight away (pass `mustChangePassword: true` to force a change). `POST /admin/users/:id/reset-password` always forces a change at the next sign-in. Only a super admin may create or modify admin accounts. Admins can't demote or deactivate themselves. There is always at least one active super admin. Employees must have a designation (`designationId` is required for `role: "employee"` and can't be cleared later) — their department and level come from it. A password reset, deactivation or role change ends all of that user's sessions.

**Materials.** `POST` body: `{ type, title, description?, departmentId?: null = company-wide, required?, estMinutes?, levels?: [] = all, status?: "draft"|"published"|"archived", author?, content?, uploadId? }`.

| Type | `content` |
|---|---|
| `structured` | `{ intro, sections: [{ id, title, body[], points?, tip? }] }` |
| `manual` | `{ chapters: [{ id, title, blocks: [p\|h\|ul\|ol\|callout] }] }` |
| `media` | `{ url: https://…, kind: "video"\|"audio" }` |
| `pdf` | `uploadId` from the upload endpoint |

PDF uploads are capped at `MAX_UPLOAD_MB`. They are checked by content (`%PDF-` … `%%EOF`), and files containing JavaScript, launch actions or embedded files are refused. They are stored privately and never served statically. `PATCH` accepts the same fields plus `requireRecompletion`. A change to content, file, title or description creates a new version (`1.0 → 1.1`, with history kept). With `requireRecompletion: true`, earlier completions stop counting. `DELETE` archives a material someone has opened, and deletes it otherwise.

**Questions.** Body: `{ text, options: [4 distinct strings], answer: 0–3, explanation?, difficulty?: "easy"|"medium"|"hard", active? }`. Admin responses include `answer` (the correct index) and `stats: { seen, correct }`. `DELETE` archives a question that appeared in an attempt, and deletes it otherwise.

**Assessment settings.** `{ title?, description?, durationMinutes? | durationSeconds?, passPercent?, marksPerQuestion?, maxAttempts?, questionsPerAttempt?, shuffle?, active? }`. Changes apply to new attempts. Running and past attempts keep their snapshot.

**CSV export.** UTF-8 with BOM. Cells that start with `= + - @` are prefixed with `'` to prevent formula injection.
