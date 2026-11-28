-- 0016: removing a teammate must never fail on a foreign key.
--
-- Every foreign key that points at public.team_members was created without an
-- ON DELETE action, so deleting a person failed as soon as anything still
-- referenced them: their manager link, a campaign they own, a lead, a report,
-- a social post or a content item. team_tasks and team_monthly_kpis already
-- cascade.
--
-- This rebuilds each team_members foreign key with a deliberate action:
--   team_tasks, team_monthly_kpis  -> ON DELETE CASCADE (the person's own records)
--   everything else                -> ON DELETE SET NULL (keep the row, clear the link)
--
-- Idempotent: a constraint that already behaves correctly is left alone, so
-- this is safe on a fresh database and on one that has run it before.

do $team_fk$
declare
  r        record;
  v_cols   text;
  v_action text;
  v_want   "char";
begin
  for r in
    select c.conname,
           c.conrelid,
           c.conkey,
           c.confdeltype,
           quote_ident(n.nspname) || '.' || quote_ident(cl.relname) as relation
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where c.contype = 'f'
       and c.confrelid = 'public.team_members'::regclass
  loop
    if r.conrelid in ('public.team_tasks'::regclass, 'public.team_monthly_kpis'::regclass) then
      v_action := 'cascade';
      v_want   := 'c';
    else
      v_action := 'set null';
      v_want   := 'n';
    end if;

    continue when r.confdeltype = v_want;

    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into v_cols
      from pg_attribute a
     where a.attrelid = r.conrelid
       and a.attnum = any (r.conkey);

    execute format('alter table %s drop constraint %I', r.relation, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%s) references public.team_members(id) on delete %s',
      r.relation, r.conname, v_cols, v_action);
  end loop;
end $team_fk$;

-- Re-assert what the Team screen needs, so a database built by the older
-- per-file migrations heals in one run.
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.team_tasks to authenticated;
grant all on public.team_members to service_role;
grant all on public.team_tasks to service_role;

drop policy if exists "Team members with a role can read" on public.team_members;
create policy "Team members with a role can read" on public.team_members
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','manager','analyst','viewer']::public.app_role[]));

drop policy if exists "Managers write" on public.team_members;
create policy "Managers write" on public.team_members
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]));

drop policy if exists "Managers update" on public.team_members;
create policy "Managers update" on public.team_members
  for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]));

drop policy if exists "Managers delete" on public.team_members;
create policy "Managers delete" on public.team_members
  for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]));

-- Task assignment: administrators and managers may create and change tasks.
drop policy if exists "Managers write" on public.team_tasks;
create policy "Managers write" on public.team_tasks
  for insert to authenticated
  with check (public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]));

notify pgrst, 'reload schema';
