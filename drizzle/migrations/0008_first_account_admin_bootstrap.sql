-- Restore the first-account admin bootstrap.
-- 0007 collapsed handle_new_user() to always insert 'viewer', while every write
-- policy on public.user_roles requires an existing admin. A fresh deployment
-- therefore had no way to obtain an admin without the service role.
-- Now the first account created while no admin exists becomes admin; every
-- later signup is a viewer.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Serialise concurrent first signups so exactly one account can win admin:
  -- the second waiter re-reads user_roles after the first one commits.
  perform pg_advisory_xact_lock(hashtext('public.handle_new_user.first_admin'));

  if exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;

  return new;
end;
$function$;
