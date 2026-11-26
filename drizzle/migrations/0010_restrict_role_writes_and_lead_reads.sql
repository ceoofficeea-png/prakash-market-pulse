-- 0010: role changes only through a checked RPC, and leads are staff-only.
--
-- 1) public.user_roles
-- 0000 granted insert, update and delete on public.user_roles to authenticated.
-- The row policies limited those statements to admins, so a viewer's write was
-- already refused by RLS, but the table's write path stayed exposed to every
-- signed-in browser client. Role changes now go through
-- public.admin_set_user_role(), a SECURITY DEFINER function that re-checks the
-- caller and refuses to demote the last administrator.
-- SELECT is untouched: users still see their own roles (0000's read policy).
--
-- 2) public.leads and public.lead_activities
-- 0006 gave every role, viewer included, SELECT on the modules it covered.
-- Viewers hold read-only dashboard access and have no CRM duties, while leads
-- carry customer PII (name, phone, email) and lead_activities carry free-text
-- notes about those customers. Both read policies now cover admin, manager and
-- analyst only. Writes were already limited to those three roles in 0001.

revoke insert, update, delete on public.user_roles from authenticated;

drop policy if exists "Admins insert roles" on public.user_roles;
drop policy if exists "Admins update roles" on public.user_roles;
drop policy if exists "Admins delete roles" on public.user_roles;

create or replace function public.admin_set_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;

  if _user_id is null then
    raise exception 'A user id is required' using errcode = '22004';
  end if;

  if not exists (select 1 from auth.users where id = _user_id) then
    raise exception 'Unknown user %', _user_id using errcode = '23503';
  end if;

  -- Never leave the workspace without an administrator. Admins may change
  -- their own role, but not when they are the only one left.
  if _role <> 'admin'
     and exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
     and not exists (select 1 from public.user_roles where role = 'admin' and user_id <> _user_id) then
    raise exception 'The last administrator cannot be demoted' using errcode = '42501';
  end if;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role)
  on conflict (user_id, role) do nothing;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;

-- Re-runnable: clear the staff policies this migration creates, so a second
-- run does not fail on `create policy ... already exists`.
drop policy if exists "Staff roles can read leads" on public.leads;
drop policy if exists "Staff roles can read lead activities" on public.lead_activities;

drop policy if exists "Team members with a role can read" on public.leads;
create policy "Staff roles can read leads" on public.leads
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin', 'manager', 'analyst']::public.app_role[]));

drop policy if exists "Team members with a role can read" on public.lead_activities;
create policy "Staff roles can read lead activities" on public.lead_activities
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin', 'manager', 'analyst']::public.app_role[]));
