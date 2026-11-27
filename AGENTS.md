<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- All app pages live under `src/routes/_authenticated/` (client-only gate, redirects to `/auth`); `/` redirects to `/overview`. Why: every module needs a signed-in user and role.
- Roles live only in `public.user_roles` (enum `app_role`); UI permission checks go through `src/lib/permissions.ts`, and RLS policies mirror that matrix. Why: one source of truth, no privilege escalation via profiles.
- Sign-in is username-first: an account's auth email is `<username>@prakashpump.local` (`src/lib/login-identifier.ts`), so `profiles.username` is the unique handle and `profiles.contact_email` is optional contact data only.
- Task ownership comes from `team_members.user_id`, never from an email comparison or a browser value; employee task writes go through `updateMyTask` and append to the immutable `team_task_updates` history.
- Modules share one schema keyed by campaigns, countries, products and team_members. Large time-series tables are read only through the aggregation RPCs (`metrics_breakdown`, `web_breakdown`, `social_breakdown`) via hooks in `src/lib/api.ts`. Why: Data API row limits and consistent country/campaign/platform/date filtering.
- Global filters (date range, countries, platforms, campaigns) come from `FiltersProvider` in `src/lib/filters.tsx`; pages opt in via `PageHeader filters=[...]`. Why: cross-module analysis uses the same selection.
- Shared UI building blocks (KpiCard, ChartCard/charts, DataTable with CSV export, StatusBadge, FilterBar) live in `src/components/app/`; colours come only from tokens in `src/styles.css`.
- tsconfig uses exactOptionalPropertyTypes + noUncheckedIndexedAccess: declare optional props as `prop?: T | undefined`.
- Period comparisons use inclusive rolling windows and an immediately preceding equal-length window from `src/lib/periods.ts`, so every module compares consistent ranges.
- The social module is organic-only (no messaging channels) and reads `social_accounts`, `social_account_daily` and `social_posts` through the `social_breakdown` RPC (`src/lib/social-data.ts`); `src/lib/social-platforms.ts` keeps only the platform catalogue and metric types.
