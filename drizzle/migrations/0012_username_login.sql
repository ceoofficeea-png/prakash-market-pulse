-- 0012: usernames as the sign-in identifier.
--
-- Supabase auth is keyed by an email address, so an account created from the
-- admin screen uses the deterministic internal address
-- `<username>@prakashpump.local` (see src/lib/login-identifier.ts). The person
-- types only their username; the browser maps it to that address, so no
-- service-role lookup and no account enumeration is needed at sign-in.
--
-- `profiles.username` is the unique, human-readable handle. `contact_email` is
-- optional: it is used for contact details and emailed password resets only.

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists contact_email text;

-- Backfill existing accounts from the local part of their email address,
-- suffixing duplicates so the unique index below can be created.
with base as (
  select
    id,
    coalesce(
      nullif(regexp_replace(lower(split_part(coalesce(email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), ''),
      'user'
    ) as base,
    row_number() over (
      partition by coalesce(
        nullif(regexp_replace(lower(split_part(coalesce(email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), ''),
        'user'
      )
      order by created_at, id
    ) as seq
  from public.profiles
  where username is null
)
update public.profiles p
   set username = case when b.seq = 1 then b.base else b.base || b.seq::text end
  from base b
 where p.id = b.id;

create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Self sign-ups keep working: they get a username derived from their email,
-- de-duplicated under an advisory lock. First-account admin bootstrap (0008)
-- is preserved unchanged.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_base text;
  v_username text;
  v_seq int := 0;
begin
  v_base := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user'
    ),
    '[^a-z0-9._-]', '', 'g'
  ));
  if v_base is null or v_base = '' then
    v_base := 'user';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.handle_new_user.username'));

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_seq := v_seq + 1;
    v_username := v_base || v_seq::text;
  end loop;

  insert into public.profiles (id, full_name, email, avatar_url, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    v_username
  )
  on conflict (id) do nothing;

  -- Serialise concurrent first signups so exactly one account can win admin.
  perform pg_advisory_xact_lock(hashtext('public.handle_new_user.first_admin'));

  if exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;

  return new;
end;
$function$;
