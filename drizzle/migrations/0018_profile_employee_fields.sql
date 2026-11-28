-- 0018: employee record fields and account status on profiles.
--
-- Administration -> Users & roles shows one row per account. The employee
-- record fields live on public.profiles (one row per auth user) so they are
-- available for every account, including one that has no roster row yet:
--
--   employee_id     unique, case-insensitive when present
--   department      free text (matches the team names used elsewhere)
--   designation     job title as shown to staff
--   account_status  Active | Pending | Disabled
--
-- Account status is kept in step with the auth record by the admin server
-- functions: Deactivate bans the sign-in and sets Disabled, Reactivate lifts
-- the ban and sets Active. Pending is reserved for an account whose sign-in has
-- not been created yet.

alter table public.profiles
  add column if not exists employee_id text,
  add column if not exists department text,
  add column if not exists designation text,
  add column if not exists account_status text not null default 'Active';

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('Active', 'Pending', 'Disabled'));

-- Employee IDs are optional, but never duplicated when set.
create unique index if not exists profiles_employee_id_key
  on public.profiles (lower(employee_id))
  where employee_id is not null;

notify pgrst, 'reload schema';
