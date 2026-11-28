# Database Migration Guide

Applies to: `prakash_market_pulse_complete_migration.sql` (identical to `drizzle/apply_all.sql`,
generated from `drizzle/migrations/0000…0017`).

The file is one consolidated, re-runnable script for the Supabase SQL Editor. It creates the whole
schema for a fresh project and repairs an existing one without dropping tables or columns.

---

## 1. How to run it

1. Open **Supabase → SQL Editor → New query**.
2. Paste the entire `prakash_market_pulse_complete_migration.sql`.
3. Run it as the project owner (the default `postgres` role). A transaction is not required; the
   file is written to be idempotent.
4. Expected last notices: reference data created (fresh database) or
   `NOTICE: Reference data already present - skipping demo seed.` (existing database), then
   `NOTIFY` and `Success. No rows returned`.

Optional helpers:

- `drizzle/preflight_checks.sql` — **read-only**. Run first on a database that already holds data.
  It returns one grid row per check (`BLOCKS` / `WARN` / `OK` / `SKIP`), an `OVERALL` line and the
  duplicates or out-of-range values that would stop the new unique indexes/constraints, each with
  a one-line repair.
- `drizzle/seed_only.sql` — empties and rebuilds the demo dataset only. Use it when the seed was
  skipped and you want the demo rows. Sign-ins, profiles and roles are untouched.

## 2. What the migration creates

Reference and core tables (`0001`): `countries`, `products`, `team_members`, `campaigns`,
`channel_daily_metrics`, `social_accounts`, `social_account_daily`, `social_posts`,
`web_daily_metrics`, `web_pages`, `seo_keywords`, `content_items`, `leads`, `lead_activities`,
`competitors`, `competitor_monthly`, `competitor_activities`, `team_tasks`, `team_monthly_kpis`,
`ai_insights`, `reports`, `api_connections`, plus auth-side `profiles` and `user_roles`
(`0000`).

Aggregation RPCs (security invoker, so RLS still applies): `metrics_breakdown`,
`web_breakdown`, `social_breakdown`, and the first-admin bootstrap function (`0008`).

## 3. Existing tables that are extended

| Table | Added by | Change |
| --- | --- | --- |
| `profiles` | `0012`, `0018` | `username` (unique, case-insensitive), `contact_email`, `job_title`; `employee_id` (unique when set), `department`, `designation`, `account_status` (`Active`/`Pending`/`Disabled`) |
| `team_members` | `0013`, `0016` | `user_id` → `auth.users` (unique when set); every FK pointing at `team_members` rebuilt with `on delete cascade` (own tasks, KPI rows) or `set null` (manager link, campaigns, leads, reports, social posts/accounts, content, lead activities) |
| `team_tasks` | `0013`, `0014` | `progress_pct` (0–100), `progress_note`, `updated_by`, `updated_at`, `approval_status` |
| `social_account_daily` | `0011` | unique key for upserts; metric columns for likes/comments/shares |
| `social_breakdown` | `0011` | dimension parameters for platform/country breakdowns |
| `campaigns` | `0017` | status constrained to `Planned / Active / Pause / Completed`; legacy `Paused` rows converted to `Pause` |

New tables:

| Table | Added by | Purpose |
| --- | --- | --- |
| `team_task_updates` | `0013` | append-only task activity history (author, status, %, remark, timestamp) |
| `campaign_status_history` | `0017` | append-only campaign status audit (previous status, new status, actor, timestamp) |

## 4. Functions, triggers and policies

Functions:

- `handle_new_user()` — creates a profile row on sign-up.
- `has_role(uuid, app_role)`, `has_any_role(uuid, app_role[])` — used by every RLS policy.
- `admin_set_user_role(uuid, app_role)` — the only SQL path to change a role; refuses to demote the
  last administrator.
- `first_account_admin()` — makes the first ever account an administrator, later sign-ups viewers.
- `metrics_breakdown`, `web_breakdown`, `social_breakdown` — aggregation RPCs.
- `guard_task_self_update()` — an employee may change only progress columns on their own task.
- `guard_campaign_status()` (`0017`) — enforces the campaign lifecycle and writes the audit row.

Triggers:

- `on_auth_user_created` — profile bootstrap.
- `guard_task_self_update` — before update on `team_tasks`.
- `guard_campaign_status` — before insert or update on `campaigns`.

Row-level security is enabled on every application table. Read policies cover the four roles
(`admin`, `manager`, `analyst`, `viewer`); write policies follow the permission matrix
(`Managers write/update/delete` on campaigns, tasks, reports, social, team; `Editors` on leads,
content, insights; admins only on API connections and user administration). `team_task_updates`
and `campaign_status_history` have **select** policies only — their rows are written by triggers
running as the table owner, so nobody can rewrite the audit trail from the browser.

## 5. How existing records are preserved

- No `drop table`, no `drop column`, no data deletion.
- `create table if not exists`, `add column if not exists`, `drop constraint if exists … add
  constraint`, `create index if not exists`, `drop policy if exists … create policy`,
  `create or replace function`.
- Enum values are added with `add value if not exists`.
- The demo seed runs only when `public.countries` is empty; otherwise it prints a notice and stops.
- `team_members.user_id` is back-filled by matching existing profile emails, never overwritten.
- Task progress is back-filled (`status = 'Done'` → 100 %) only where it is below 100.
- Campaign statuses are normalised once (`Paused` → `Pause`), and each existing campaign gets a
  baseline `campaign_status_history` row at its `created_at`; nothing else about the row changes.

## 6. How to verify

```sql
-- 1. Migration registered
select count(*) as migrations from information_schema.tables
 where table_schema = 'public'
   and table_name in ('team_task_updates','campaign_status_history');   -- expect 2

-- 2. Campaign lifecycle is enforced
select conname, pg_get_constraintdef(oid)
  from pg_constraint where conname = 'campaigns_status_check';
select tgname from pg_trigger where tgname = 'guard_campaign_status';   -- 1 row

-- 2b. Employee record fields
select column_name, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('employee_id','department','designation','account_status')
 order by 1;                                    -- expect 4 rows
select indexname from pg_indexes where indexname = 'profiles_employee_id_key';

-- 3. No legacy label left
select status, count(*) from public.campaigns group by 1 order by 1;
-- Planned / Active / Pause / Completed only

-- 4. Audit tables exist and are readable
select count(*) from public.campaign_status_history;
select count(*) from public.team_task_updates;

-- 5. Foreign keys around team_members all have a delete action
select c.conname, c.confdeltype
  from pg_constraint c
 where c.contype = 'f' and c.confrelid = 'public.team_members'::regclass;
-- confdeltype must be 'c' (cascade) or 'n' (set null); 'a' (no action) is the 0016 bug

-- 6. Policies
select tablename, policyname, cmd from pg_policies
 where schemaname = 'public' order by 1, 2;

-- 7. Row counts after a fresh seed (approximate, dates are relative)
select
  (select count(*) from countries)  as countries,          -- 14
  (select count(*) from team_members) as team,             -- 16
  (select count(*) from campaigns)  as campaigns,          -- 16
  (select count(*) from channel_daily_metrics) as metrics, -- ~6544
  (select count(*) from leads)      as leads;              -- 480
```

Behavioural check (safe on a scratch campaign):

```sql
-- should succeed
update public.campaigns set status = 'Active' where status = 'Planned' and id = <id>;
-- should fail with "Campaign status cannot move …"
update public.campaigns set status = 'Completed' where id = <id>;
```

## 7. Recovery

The script runs statement by statement, so a failure stops at the first bad statement and leaves
everything before it applied. Nothing is lost; fix the cause and run the file again — it skips what
already exists.

| Error | Cause | Fix |
| --- | --- | --- |
| `duplicate key value violates unique constraint "…_key"` | existing duplicate rows | run `drizzle/preflight_checks.sql`, fix the rows it lists, re-run |
| `check constraint "…" is violated by some row` | existing out-of-range values | same: preflight lists row ids and the repair |
| `permission denied for table …` | running as a non-owner role | run as `postgres` in the SQL editor |
| `relation "auth.users" does not exist` | not a Supabase database | this migration targets Supabase only |
| `type "app_role" already exists` | very old partial run | ignore the notice; re-run the file |
| App shows empty data after a fresh run | seed skipped because rows existed | run `drizzle/seed_only.sql` (destructive to demo rows only) |

To roll back a single feature: `0017` can be undone with `drop trigger guard_campaign_status on
public.campaigns; drop function public.guard_campaign_status(); drop table
public.campaign_status_history; alter table public.campaigns drop constraint campaigns_status_check;`
— but the lifecycle protection disappears with it. Do not undo `0016` while roster rows are
referenced by campaigns/leads/reports.
