# Quick Start — Prakash Market Pulse

Marketing command centre for Prakash Pump. 13 modules read one Supabase database:
overview, CEO reports, AI intelligence, social, paid ads, website/SEO, content, campaigns,
CRM, markets, competitors, team performance and administration.

This guide is the short path: run it locally, sign in as the administrator, create people and
tasks, and move a campaign forward. The deeper reference is `README.md`; the database detail is
`DATABASE_MIGRATION_GUIDE.md`.

---

## 1. Run it locally

Requirements: Node.js 20+ (or Bun, `bun.lock` is committed) and a Supabase project.

```sh
bun install          # or: npm install
cp .env.example .env
bun run dev          # or: npm run dev   → http://localhost:5173
```

Fill `.env` from **Supabase → Project Settings → API**:

| Variable | Used by | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Publishable / anon key (public by design) |
| `SUPABASE_URL` | server functions | Same project URL |
| `SUPABASE_PUBLISHABLE_KEY` | server functions | Same publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **Secret.** Never prefix with `VITE_`, never commit it |

Run the database migration **once** before the first sign-in — paste
`prakash_market_pulse_complete_migration.sql` (identical to `drizzle/apply_all.sql`) into the
Supabase SQL editor and run it as the project owner. It creates the schema, the demo seed and
every policy/trigger, and it is safe to re-run.

Checks:

```sh
bun x tsc --noEmit
bun run test
bun run build
```

## 2. First administrator

`0008` makes the **first account created while no administrator exists** an admin; later
self sign-ups become viewers.

1. Open `/auth` → **Create account** and register the owner account.
2. Sign in. **Administration** is now in the sidebar and every module is visible.

If an account already exists without admin rights, promote it once in the SQL editor:

```sql
delete from public.user_roles
 where user_id = (select id from auth.users where email = 'owner@your-domain.com');
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'owner@your-domain.com';
```

## 3. The Admin Module

**Administration → Users & roles** is the one place for accounts:

- **Add user** — full name, unique username, temporary password, role, module access. The account
  is created pre-confirmed and can sign in immediately; the password is never stored in the app
  database and is never shown again.
- **Role** — change a person's role inline (Administrator / Marketing Manager / Analyst / Viewer).
  You cannot change your own role, and the last administrator cannot be demoted.
- **Module access** — tick which screens that person sees. Administrators always see everything.
- **Password** — set a new password for anyone (the secure way to hand out or recover credentials;
  emailed resets depend on Supabase SMTP).
- **Employee ID / Department / Designation / Account status** — the pencil action opens the
  employee record. Employee IDs are optional but unique (case-insensitive); status is
  `Active`, `Pending` (no sign-in created yet) or `Disabled`.
- **Deactivate / Reactivate** (shield action) — deactivation blocks the sign-in immediately and
  keeps every task, history and record; reactivation lifts the block. Use this for someone who
  leaves temporarily.
- **Delete** (trash action) — asks for confirmation, then removes the sign-in and profile for
  good. The roster row is kept but unlinked from the sign-in; tasks, campaigns, leads and reports
  stay attached to that roster record (remove the teammate separately to clear them). The last
  administrator cannot be deleted, and you cannot deactivate or delete your own account.
- **Last login / Joined** — read from Supabase Auth.
- The permission matrix underneath the table shows what each role may do.

Sign-in accepts either a **username** (`exec.one` → `exec.one@prakashpump.local`) or a real email.

## 4. Team members and tasks

**Team Performance** is the task workspace; it is not a second user manager.

- **Add teammate** (Administration-level roles): creates the roster row, and optionally the
  sign-in, in one step. Tick *Create a sign-in* to link the roster row to the new account —
  that link is what makes "My tasks" work. The roster row is written first; if account creation
  fails the row is kept and the error is shown.
- **Assign task**: pick the member, title, priority, due date and (optionally) a campaign.
- **Update** on a task records status, completion %, a remark and the completion date.
- **My work** (employee): the same page shows only their own tasks; they can change status,
  progress, remark and completion date, and submit for approval.
- Every update writes `team_tasks.updated_by` / `updated_at` and appends an immutable row to
  `team_task_updates`. The trigger `guard_task_self_update` stops an employee editing anything
  except progress on their own task.
- **Remove member** deletes the roster row (tasks and KPI rows cascade; campaign/lead/report
  ownership is cleared) and optionally deletes the sign-in.

## 5. Roles at a glance

| Role | May do |
| --- | --- |
| Administrator | Everything: users, roles, modules, all tasks, campaigns, connections |
| Marketing Manager | Campaigns, tasks, reports, social, leads; sees every employee's tasks |
| Analyst / Executive | Leads, content, insights; updates their **own** tasks |
| Viewer | Read-only dashboards |

Module access decides **which screens appear**; the role decides **what may be done there**. Both
are enforced in the UI and again by RLS/triggers on the server.

## 6. Campaign progression

Campaigns are forward-only:

```
Planned → Active → Pause → Completed
```

Open **Campaigns → a campaign**. The header shows exactly one action — *Move to Active*, then
*Move to Pause*, then *Move to Completed*. When it is completed the header says **Campaign
completed** and offers no action. There is no dropdown, so no earlier status can be selected.

The rule also lives in the database (migration `0017`): a trigger rejects every other transition,
including `Completed → anything`, skips and the old `Paused` label. Each accepted change is
appended to **Status history** on the campaign page with the previous status, the new status, who
changed it and when.

## 7. If something fails

| Symptom | Fix |
| --- | --- |
| `Missing Supabase environment variable(s)` | `.env` is incomplete; restart `bun run dev` after editing it |
| Sign-in works but every screen is empty | the migration never ran — paste the SQL file in Supabase |
| `permission denied for table …` | run the SQL file again; it re-asserts grants and policies |
| Social chips read zero | `0011` was never applied — re-run the SQL file, then reload a platform export |
| Remove member fails | `0016` was never applied — re-run the SQL file |
| Campaign status will not change | that is the lifecycle rule; only the next step is allowed |
| "Only administrators can …" | the account is not an admin — promote it with the SQL in §2 |
