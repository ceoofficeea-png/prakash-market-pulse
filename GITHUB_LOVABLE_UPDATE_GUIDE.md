# GitHub → Lovable Update Guide

This project is already connected to Lovable through its GitHub branch. Lovable reads the
connected branch, so **the only supported way to update the live project is to commit to that
branch and push it**. Uploading a ZIP into Lovable does not update an existing project.

> Never force-push, rebase, amend or squash commits that already exist on the remote: that
> rewrites the history Lovable is tracking. Add new commits on top instead.

---

## Step 1 — Download the package

Download `Prakash_Market_Pulse_Updated_Complete.zip` (produced from this repository at the
current commit). It contains the complete source tree inside a single wrapper folder,
`prakash-market-pulse/`.

## Step 2 — Extract it

Extract anywhere outside your existing clone, for example `Downloads\prakash-market-pulse\`.
Open the extracted folder and confirm you can see `package.json`, `src/`, `drizzle/`, `README.md`
and the four delivery documents. Do **not** work inside the ZIP itself.

## Step 3 — Locate your existing repository

In GitHub Desktop: **File → Clone repository →** your Prakash Market Pulse repository. If it is
already listed on the left, click it. Note the **Current branch** shown in the toolbar — that is
the branch Lovable is connected to (usually `main`).

## Step 4 — Back up the existing repository

Before copying anything:

1. In GitHub Desktop, **Fetch origin**, then make sure there are no uncommitted changes
   (**Changes** tab is empty). Commit or stash anything you have in progress.
2. Copy the whole repository folder somewhere safe (for example `prakash-backup-2026-11-28`).
3. Optional but recommended: **Branch → New branch** named `backup-before-update` and push it,
   so the pre-update state exists on GitHub as well.

## Step 5 — Replace the project files

Copy the **contents** of `prakash-market-pulse\` into the repository folder — not the wrapper
folder itself. The repository root must end up with `package.json`, `src\`, `drizzle\`, `README.md`
and the delivery documents directly in it.

When Windows asks whether to merge folders or replace files, choose **Replace the files in the
destination**. Files that exist only in the new package (for example
`drizzle\migrations\0017_campaign_status_workflow.sql`,
`prakash_market_pulse_complete_migration.sql`, `QUICK_START.md`) are added; files removed from the
package no longer exist in it and should be deleted from the repository only if GitHub Desktop
shows them as deleted after the copy.

Do **not** copy:

- `node_modules\` (never part of the ZIP)
- `.git\` (must stay the repository's own)
- any `.env` (your local secrets)
- `artifacts\` (build/report outputs; they are not in the ZIP)

## Step 6 — Preserve configuration and environment

These must stay exactly as they are in your repository / Lovable project:

- `.env` locally (git-ignored) and the environment variables in **Lovable → Settings**.
- `.lovable\` and the existing Vite/TanStack/Nitro configuration.
- `bun.lock` / `package.json` dependency versions — do not hand-edit them. Run the install command
  in Step 7 instead.
- The Supabase project URL and keys. No key is part of this package.

`.env.example` lists the variable **names** only; it contains no values.

## Step 7 — Install and verify locally

In the repository folder:

```sh
bun install          # or: npm install
bun x tsc --noEmit   # types
bun run test         # 15 unit tests
bun run build        # production build
```

All four must succeed before you commit. `bun run lint` currently reports Prettier
line-wrapping/line-ending errors across the repository, including files this update never
touched; that is a pre-existing formatting backlog, not a build failure.

Start it locally with `bun run dev` and sign in to confirm the app loads
(see `QUICK_START.md`).

## Step 8 — Commit

In GitHub Desktop the **Changes** tab now lists the modified and added files. Review the list:
it should contain source files under `src\`, SQL under `drizzle\`, the delivery documents and
`README.md` — no `node_modules`, no `.env`.

Write a summary such as:

```
Admin/team task workflow, forward-only campaign statuses
```

and press **Commit to <branch>**.

## Step 9 — Push

Press **Push origin**. This is a normal fast-forward push of new commits on top of the existing
history. Do not use *Force push*.

## Step 10 — Verify the Lovable synchronisation

1. Open the project in Lovable.
2. The editor should pick up the branch update (Lovable shows the latest commit; a refresh may be
   needed).
3. Confirm the files changed — for example `src/routes/_authenticated/campaigns.$id.tsx`.
4. Let Lovable finish its build. If it reports an error, read the first error line; the same code
   already builds locally with `bun run build`, so a Lovable failure is usually an environment
   setting (missing variable), not the source.

The GitHub → Lovable sync is configured in your project; it has **not** been exercised from this
workspace, so treat this step as yours to confirm.

## Step 11 — Run the database migration

In **Supabase → SQL Editor**, open `prakash_market_pulse_complete_migration.sql` from the
repository, paste the whole file and run it once as the project owner.

- It is one file, `0000` … `0017` in order, and safe to re-run.
- On a database that already has rows it preserves them; it only creates what is missing.
- If it stops, read the error line and see `DATABASE_MIGRATION_GUIDE.md` §7 (recovery). For a
  database with existing data, run `drizzle/preflight_checks.sql` first: it is read-only and lists
  the duplicate/out-of-range rows that would block the new constraints.

Do not run individual migration files one at a time unless you are debugging; the consolidated file
is the supported path.

## Step 12 — Deploy Edge Functions, if you use them

This project does **not** ship Supabase Edge Functions. Account creation, role changes, module
access, password resets, task updates and approvals run as TanStack server functions on the app's
own server (Lovable/Nitro), using the service-role key from the server environment only. Nothing
to deploy separately; just make sure `SUPABASE_SERVICE_ROLE_KEY` is set in
**Lovable → Settings → Environment variables**.

## Step 13 — Configure authentication

In **Supabase → Authentication**:

- **Providers → Email:** enabled.
- **Confirm email:** may stay on. Accounts created from *Administration → Add user* are
  pre-confirmed, so staff never need an inbox.
- **SMTP:** optional. Without custom SMTP Supabase's built-in mailer is rate-limited, so set
  passwords from *Administration → Password* instead of relying on emailed resets.

Then create the accounts (see Step 14) and confirm each person can sign in.

## Step 14 — Test Admin, Manager and User accounts

1. **Administrator:** sign in → *Administration → Users & roles* → **Add user** for one manager
   and one analyst. Give each a username and temporary password.
2. **Manager:** sign in in a private window → *Team Performance* → **Assign task** to the analyst.
   Confirm the task appears against that person.
3. **User:** sign in as the analyst → *Team Performance → My work* → update status/progress on the
   task, add a remark, submit.
4. Back as manager/administrator: confirm the update and its history appear immediately.
5. As the analyst, confirm *Administration* is not in the sidebar and another person's profile
   cannot be opened.

## Step 15 — Test task assignment and campaign progression

- Create a task from *Team Performance* as manager and as administrator; both must save.
- Open a campaign whose status is **Planned** → the only action is *Move to Active*. Continue:
  *Move to Pause*, then *Move to Completed*. Confirm *Status history* lists each step.
- Confirm a completed campaign offers no further action, and that an attempt to set an earlier
  status through the API is rejected by the database (error mentions the lifecycle).

## Step 16 — Publish

Use Lovable's normal **Publish/Update** action for the project. After it publishes, open the live
site, sign in and repeat the three quick checks above (users list loads, task update saves,
campaign moves one step forward). If the live site behaves differently from your local build,
compare the environment variables first.

---

### Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Lovable build fails on a missing variable | `VITE_SUPABASE_*` / `SUPABASE_*` not set in Lovable |
| Everything empty after sign-in | migration not run (Step 11) |
| "Only administrators can …" | the account is not an admin — see `QUICK_START.md` §2 |
| Campaign status change refused in the editor | expected: `0017` enforces one forward step |
| GitHub Desktop shows hundreds of changed files | line endings changed on copy; re-copy with Git's `core.autocrlf` setting untouched, or review only real source changes |
