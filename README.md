# Prakash Market Pulse

Marketing command centre for **Prakash Pump**: 13 modules (executive overview, CEO reports,
AI intelligence, social, paid ads, website/SEO, content, campaigns, CRM, markets, competitors,
team performance, administration) reading one shared Supabase database.

This project is connected to [Lovable](https://lovable.dev). Commits pushed to the connected
branch sync back into the editor, so keep the branch in a working state and never rewrite
published history (no force-push, rebase or amend of pushed commits).

---

## 1. Requirements

- Node.js 20+ (or Bun — `bun.lock` is committed)
- A Supabase project (Postgres + Auth). No other paid service is required.
- The Supabase **service role** key on the server only (used by admin user management and
  task-progress writes).

## 2. Install and configure

```sh
git clone <this-repository-url>
cd <repository-name>
npm i          # or: bun install
cp .env.example .env
npm run dev    # or: bun run dev
```

Fill `.env` from **Supabase → Project Settings → API**:

| Variable                        | Where it is read   | Notes                                                |
| ------------------------------- | ------------------ | ---------------------------------------------------- |
| `VITE_SUPABASE_URL`             | browser client     | Project URL                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client     | Publishable / anon key (public by design)            |
| `SUPABASE_URL`                  | server functions   | Same project URL                                     |
| `SUPABASE_PUBLISHABLE_KEY`      | server functions   | Same publishable key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only        | **Secret.** Bypasses RLS — never prefix with `VITE_` |
| `LOVABLE_DB_MIGRATION_URL`      | `drizzle-kit push` | Optional direct Postgres connection string           |

`.env` is git-ignored. Only `.env.example` (names, no values) is committed.

## 3. Database migrations (manual Supabase step)

Migrations live in `drizzle/migrations/` and must be applied **in order**, once, to the
project's database. Either:

- **SQL editor:** paste and run `0000` … `0017` in filename order, or
- **CLI:** set `LOVABLE_DB_MIGRATION_URL` and run `bun x drizzle-kit push`.

If you would rather paste one file, run **`prakash_market_pulse_complete_migration.sql`**
(repository root, an exact copy of `drizzle/apply_all.sql`) instead: it contains
`0000` … `0017` in order, is safe to re-run (the enum, tables, columns, indexes, triggers and
policies are created only when missing) and only loads the demo seed when `public.countries` is
empty. The per-file migrations below stay the source of truth for review.

If the database already holds rows, run **`drizzle/preflight_checks.sql`** first. It is read-only,
returns one row per check (`BLOCKS`, `WARN`, `OK` or `SKIP`), and lists the duplicate rows and
out-of-range values that would make `apply_all.sql` fail when it creates the unique indexes and
check constraints, with a one-line repair for each finding.

If that run prints `NOTICE: Reference data already present - skipping demo seed.` and you
still want the demo dataset, run **`drizzle/seed_only.sql`**: it empties the seeded tables and
rebuilds them, including the post-seed fixes from `0011`, `0013` and `0014`. Sign-ins, profiles
and roles are untouched. Only use it on a database whose demo rows you are happy to replace.

| File          | What it adds                                                                      |
| ------------- | --------------------------------------------------------------------------------- |
| `0000`–`0007` | Base schema, seed data, profiles/roles, RLS read policies                         |
| `0008`        | First-account admin bootstrap                                                     |
| `0009`–`0010` | Platform id normalisation, role-write and lead-read restrictions                  |
| `0011`        | Social metric columns, `social_account_daily` unique key, `social_breakdown` dims |
| `0012`        | Unique usernames (`profiles.username`), optional `profiles.contact_email`         |
| `0013`        | `team_members.user_id`, task progress columns, `team_task_updates` history + RLS  |
| `0014`        | Task completion approvals (`approval_status`), direct-manager decision policy    |
| `0016`        | Team delete: `team_members` foreign keys get `on delete set null`/`cascade`       |
| `0017`        | Forward-only campaign statuses, `campaign_status_history` audit + guard trigger   |
| `0018`        | Employee ID, department, designation and account status on `profiles`             |

`0012`–`0014` are required for username sign-in, employee task updates and the approval section
in _My Workspace_. Until they run, the app still loads and those areas fail with a clear error.

`0016` is what makes **Remove member** work. Every foreign key pointing at `team_members` was
created without an `ON DELETE` action, so deleting a teammate failed as soon as anything still
referenced them (their manager link, a campaign, a lead, a report). It rebuilds those keys
(`cascade` for their own tasks and KPI rows, `set null` for everything else) and is safe to re-run.

`0017` makes campaign statuses forward-only: **Planned → Active → Pause → Completed**, one step at
a time. A `before insert or update` trigger rejects every other change (including
the legacy `Paused` label, `Completed → anything`, and any skip), so the rule also holds for direct
API calls and SQL, not just the button in the UI. Each accepted change is appended to
`public.campaign_status_history` (previous status, new status, who, when); the table is read-only
for signed-in users. Existing `Paused` rows are converted to `Pause`.

`0018` puts the employee record on `public.profiles`: `employee_id` (unique when set, compared
case-insensitively), `department`, `designation` and `account_status`
(`Active` / `Pending` / `Disabled`). _Administration → Users & roles_ edits them inline, offers
**Deactivate** (bans the sign-in and sets `Disabled`, keeping every task and record) and
**Delete** (removes the sign-in and profile; the roster row is kept but unlinked, so tasks,
  campaigns, leads and reports stay attached to that roster record). Both run through admin-only
  server functions; neither is offered on your own row and the last administrator cannot be
  deleted.

`0011` is safe to re-run and doubles as a repair: if it was never applied, the social
Likes/Comments/Shares chips read zero and the Reach-by-platform chart is empty. Re-run it, then
reload a platform export.

### Supabase dashboard settings you must check yourself

- **Authentication → Providers → Email:** enabled.
- **Authentication → Sign In / Providers → Confirm email:** may stay on. Accounts created from
  _Administration → Add user_ are created pre-confirmed, so staff never need an inbox.
- **Authentication → Emails / SMTP:** optional. Without custom SMTP, Supabase's built-in mailer
  is rate-limited, so emailed password resets are unreliable — reset passwords from
  _Administration → Password_ instead.
- **Storage:** no bucket is provisioned, so task attachments are intentionally not offered.

## 4. First administrator

`0008` makes the **first account created while no admin exists** an administrator; every later
self sign-up becomes a `viewer`.

1. Open `/auth` → **Create account** and register the owner account first.
2. Sign in — _Administration_ is now visible and the account can create everyone else.

If an account already exists without admin rights, promote it once in the SQL editor:

```sql
delete from public.user_roles
 where user_id = (select id from auth.users where email = 'owner@your-domain.com');
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'owner@your-domain.com';
```

## 5. Create the three initial employee accounts

Sign in as the administrator, open **Administration → Users & roles → Add user**, and create
one account per person. Each needs a full name, a **unique username**, a temporary password,
a role and the modules they may open. Email is optional and is never needed to sign in.

Suggested starting point (change names and usernames to the real people):

| Full name             | Username      | Role                | Module access                                                         |
| --------------------- | ------------- | ------------------- | --------------------------------------------------------------------- |
| Marketing Executive 1 | `exec.one`    | Analyst / Executive | Overview, Social Media, Website & SEO, Content, Team Performance      |
| Marketing Executive 2 | `exec.two`    | Analyst / Executive | Overview, Google & Meta Ads, Campaigns, CRM & Leads, Team Performance |
| Marketing Manager     | `manager.one` | Marketing Manager   | Everything except Administration                                      |

Set each password yourself and share it over a secure channel; nobody can read it back later.
After the first sign-in each person can change it from **Administration → Change my password**
(or _Update password_ on their row).

To give an employee a Team Performance profile as well, use **Team Performance → Add teammate**
and tick _Create a sign-in_: the roster row is linked to the new login, which is what makes
"My tasks" work.

## 6. Signing in

The sign-in field accepts **either**:

- a **username** — `exec.one` → the account's internal address `exec.one@prakashpump.local`, or
- a **work email** — any account created with a real address.

Usernames are 3–32 characters: letters, numbers, dot, dash or underscore, unique
case-insensitively (`profiles_username_key`). Roles are stored only in `public.user_roles`;
module access is stored in the auth user's `app_metadata.modules`, which only the server can
write, so nobody can grant themselves access from the browser.

## 7. Roles and module access

| Role                | May do                                                                |
| ------------------- | --------------------------------------------------------------------- |
| Administrator       | Everything, including users, roles, module access and all tasks       |
| Marketing Manager   | Campaigns, tasks, reports, social, leads; sees every employee's tasks |
| Analyst / Executive | Work leads, content, insights; update their **own** tasks             |
| Viewer              | Read-only dashboards (no leads, no task writes)                       |

Module access is layered on top of the role: it decides **which screens appear**, while the
role decides **what may be done there**. It is enforced in the sidebar, the ⌘K palette, a
router-level guard, and again on the server for every write. Administrators always see every
module; _Administration_ is role-gated and cannot be granted as a module.

## 8. Team performance and tasks

- **Administrator / manager:** _Team Performance_ lists every member with assigned, completed,
  pending, in-progress and overdue counts, completion percentage, KPI achievement and last
  activity. Open a member for their full task history. _Assign task_ and _Add teammate_ create
  work and accounts; _Update_ on a task records status, completion %, a remark and the actual
  completion date.
- **Employee:** the same page shows a **My work** panel for their own roster row — today's
  tasks, pending, in progress, overdue, completed, completion percentage, and a feed of recent
  updates. They can update status, completion percentage, remarks and completion date on their
  own tasks only. Employees cannot open another person's profile.
- Every update writes `team_tasks.updated_by` / `updated_at` and appends an immutable row to
  `team_task_updates` (author, status, percentage, remark, timestamp). Ownership is decided by
  `team_members.user_id` on the server — never by a value sent from the browser — and the
  database trigger `guard_task_self_update` blocks an employee from changing anything except
  progress columns.

## 9. Loading real platform data

`artifacts/data-loading-guide.pdf` (source: `artifacts/data-loading-guide.html`) documents the
exact table and column order, per-platform mapping, validation queries and the `/social` read
path (`social_breakdown` RPC). Apply `0011` before loading social metrics.

## 10. Checks

```sh
bun x tsc --noEmit   # types
bun run lint         # eslint
bun run test         # vitest (where tests exist)
bun run build        # client + SSR + Nitro production build
```

## 11. Project layout

```
src/routes/                 file-based routes; /auth is public, everything else is gated
src/routes/_authenticated/  all app modules (client-only auth gate + module guard)
src/components/app/         shared UI: KpiCard, DataTable, charts, dialogs, task progress
src/components/ui/          shadcn/ui primitives
src/lib/permissions.ts      roles, permission matrix, module catalogue
src/lib/api.ts              React Query hooks over Supabase
src/lib/*.functions.ts      server functions (admin users, team, tasks)
src/lib/*.server.ts         server-only helpers (service-role clients)
src/integrations/supabase/  browser + server clients, auth middleware, generated types
drizzle/migrations/         ordered SQL migrations
```

## 12. Publishing

Commit locally, review, then push the branch (GitHub Desktop works). Pushing to the connected
branch updates Lovable. Do not force-push or rewrite history that has already been pushed.
