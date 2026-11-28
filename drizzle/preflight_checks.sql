-- Prakash Pump Marketing Command Center - pre-flight checks.
--
-- Run this BEFORE drizzle/apply_all.sql, especially on a database that is not
-- empty. It only reads: nothing here inserts, updates or deletes a row.
--
-- It returns one row per check:
--   BLOCKS  apply_all.sql would fail on that statement; fix the rows first.
--   WARN    apply_all.sql still runs, but the result would be ambiguous.
--   OK      nothing to fix.
--   SKIP    the table or column does not exist yet, so apply_all.sql creates
--           it empty and there is nothing to check.
-- The OVERALL row at the top says whether the rest of the file is safe to run.
--
-- Each failing row names the offending rows in `found` and gives a one-line
-- repair in `fix`. After running a repair, run this file again: every check
-- must be OK or SKIP before you paste apply_all.sql.
--
-- It is safe to run this file repeatedly, on a brand-new database, and on one
-- that already has the full schema.

drop table if exists pg_temp.preflight_results;

create temp table preflight_results (
  ord        int primary key,
  check_name text not null,
  verdict    text not null,
  bad_rows   bigint,
  detail     text,
  fix        text
);

do $preflight$
declare
  v_has     boolean;
  v_has2    boolean;
  v_big     bigint;
  v_big2    bigint;
  v_detail  text;
  v_detail2 text;
begin

  -- 1. Will apply_all.sql load the demo dataset, or skip it?
  if to_regclass('public.countries') is null then
    insert into pg_temp.preflight_results values
      (10, 'demo seed', 'SEED RUNS', 0,
       'public.countries does not exist yet, so apply_all.sql loads the full demo dataset.',
       'Nothing.');
  else
    select count(*) into v_big from public.countries;
    if v_big = 0 then
      insert into pg_temp.preflight_results values
        (10, 'demo seed', 'SEED RUNS', 0,
         'public.countries is empty, so apply_all.sql loads the full demo dataset.',
         'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (10, 'demo seed', 'SEED SKIPPED', v_big,
         format('public.countries already holds %s row(s), so apply_all.sql prints "skipping demo seed" and loads no demo rows.', v_big),
         'Run drizzle/seed_only.sql afterwards if you want the demo dataset.');
    end if;
  end if;

  -- 2. unique index social_account_daily_key (account_id, date).
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'social_account_daily' and column_name = 'account_id'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'social_account_daily' and column_name = 'date'
  ) into v_has;

  if to_regclass('public.social_account_daily') is null or not v_has then
    insert into pg_temp.preflight_results values
      (20, 'social_account_daily: one row per account per day', 'SKIP', null,
       'The table does not exist yet, so apply_all.sql creates it empty.',
       'Nothing.');
  else
    select count(*) into v_big
      from (select 1 from public.social_account_daily group by account_id, date having count(*) > 1) x;
    select string_agg(format('account %s on %s has %s rows', account_id, d, n), '; ')
      into v_detail
      from (
        select account_id, date as d, count(*) as n
          from public.social_account_daily
         group by account_id, date
        having count(*) > 1
         order by count(*) desc, account_id
         limit 3
      ) s;

    if v_big = 0 then
      insert into pg_temp.preflight_results values
        (20, 'social_account_daily: one row per account per day', 'OK', 0,
         'No duplicate (account_id, date) rows.', 'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (20, 'social_account_daily: one row per account per day', 'BLOCKS', v_big,
         format('%s duplicate (account_id, date) group(s): %s. apply_all.sql cannot create unique index social_account_daily_key.', v_big, v_detail),
         'delete from public.social_account_daily d using public.social_account_daily k where d.account_id = k.account_id and d.date = k.date and d.id < k.id;  -- keeps the newest id per group');
    end if;
  end if;

  -- 3. unique index profiles_username_key on lower(username), including the
  --    handles apply_all.sql derives for rows that have none yet.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) into v_has;

  if to_regclass('public.profiles') is null or not v_has then
    insert into pg_temp.preflight_results values
      (30, 'profiles: unique username', 'SKIP', null,
       'profiles.username does not exist yet, so apply_all.sql adds it and generates every handle itself.',
       'Nothing.');
  else
    select count(*) into v_big
      from (select 1 from public.profiles where username is not null group by lower(username) having count(*) > 1) x;

    -- The same backfill apply_all.sql runs, replayed read-only, to catch a
    -- generated handle that collides with an existing one.
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
    ), proposed as (
      select id, case when seq = 1 then base else base || seq::text end as uname from base
    )
    select count(*) into v_big2
      from proposed p
     where exists (select 1 from public.profiles x where x.username is not null and lower(x.username) = lower(p.uname))
        or exists (select 1 from proposed q where q.id <> p.id and lower(q.uname) = lower(p.uname));

    if v_big = 0 and v_big2 = 0 then
      insert into pg_temp.preflight_results values
        (30, 'profiles: unique username', 'OK', 0,
         'No duplicate lower(username) rows, and the generated handles do not collide.',
         'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (30, 'profiles: unique username', 'BLOCKS', v_big + v_big2,
         format('%s existing duplicate handle(s); %s handle(s) that apply_all.sql would generate already exist or would collide.', v_big, v_big2),
         'A username is the sign-in handle, so decide which account keeps each duplicate and rename or remove the other, then re-run this file.');
    end if;
  end if;

  -- 4. unique index team_members_user_id_key (user_id where not null).
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'team_members' and column_name = 'user_id'
  ) into v_has;

  if to_regclass('public.team_members') is null or not v_has then
    insert into pg_temp.preflight_results values
      (40, 'team_members: one roster row per sign-in', 'SKIP', null,
       'team_members.user_id does not exist yet, so apply_all.sql adds it empty.',
       'Nothing.');
  else
    select count(*) into v_big
      from (select 1 from public.team_members where user_id is not null group by user_id having count(*) > 1) x;
    select string_agg(format('%s is on %s rows %s', user_id, n, ids), '; ')
      into v_detail
      from (
        select user_id, count(*) as n, string_agg(id::text, '/') as ids
          from public.team_members
         where user_id is not null
         group by user_id
        having count(*) > 1
         order by count(*) desc
         limit 3
      ) s;

    if v_big = 0 then
      insert into pg_temp.preflight_results values
        (40, 'team_members: one roster row per sign-in', 'OK', 0,
         'No sign-in is linked to more than one roster row.', 'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (40, 'team_members: one roster row per sign-in', 'BLOCKS', v_big,
         format('%s sign-in(s) linked to more than one roster row: %s. apply_all.sql cannot create unique index team_members_user_id_key.', v_big, v_detail),
         'update public.team_members m set user_id = null where m.user_id is not null and m.id > (select min(k.id) from public.team_members k where k.user_id = m.user_id);  -- keeps the lowest id per sign-in');
    end if;
  end if;

  -- 5. apply_all.sql links roster rows to the profile with the same email. Two
  --    unlinked rows with one email would both receive that profile id and break
  --    the index from check 4.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'team_members' and column_name = 'user_id'
  ) into v_has;

  if to_regclass('public.team_members') is null or not v_has then
    insert into pg_temp.preflight_results values
      (50, 'team_members: email used by one roster row', 'SKIP', null,
       'The link by email only happens once team_members.user_id exists; apply_all.sql adds it empty here.',
       'Nothing.');
  else
    select count(*) into v_big
      from (
        select 1 from public.team_members
         where user_id is null and email is not null
         group by lower(email)
        having count(*) > 1
      ) x;
    select string_agg(format('%s on rows %s', email, ids), '; ')
      into v_detail
      from (
        select lower(email) as email, string_agg(id::text, '/') as ids
          from public.team_members
         where user_id is null and email is not null
         group by lower(email)
        having count(*) > 1
         order by count(*) desc
         limit 3
      ) s;

    if v_big = 0 then
      insert into pg_temp.preflight_results values
        (50, 'team_members: email used by one roster row', 'OK', 0,
         'No two unlinked roster rows share an email address.', 'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (50, 'team_members: email used by one roster row', 'BLOCKS', v_big,
         format('%s email address(es) on more than one unlinked roster row: %s. Linking both rows would break team_members_user_id_key.', v_big, v_detail),
         'One of the two rows is a duplicate person: correct that row''s email on the Team screen (or with update public.team_members set email = ''...'' where id = ...;), then re-run this file.');
    end if;
  end if;

  -- 6. Two profiles with one email make the link step pick one arbitrarily.
  if to_regclass('public.profiles') is null then
    insert into pg_temp.preflight_results values
      (60, 'profiles: one account per email', 'SKIP', null,
       'public.profiles does not exist yet.', 'Nothing.');
  else
    select count(*) into v_big
      from (
        select 1 from public.profiles
         where email is not null and btrim(email) <> ''
         group by lower(email)
        having count(*) > 1
      ) x;

    if v_big = 0 then
      insert into pg_temp.preflight_results values
        (60, 'profiles: one account per email', 'OK', 0,
         'Every profile email is unique (case-insensitive).', 'Nothing.');
    else
      insert into pg_temp.preflight_results values
        (60, 'profiles: one account per email', 'WARN', v_big,
         format('%s email address(es) belong to more than one profile; the roster link by email then picks one of them.', v_big),
         'Optional: remove or correct the spare profile so each person has one account.');
    end if;
  end if;

  -- 7. check constraint team_tasks_progress_pct_check (0..100).
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'team_tasks' and column_name = 'progress_pct'
  ) into v_has;

  if to_regclass('public.team_tasks') is null or not v_has then
    insert into pg_temp.preflight_results values
      (70, 'team_tasks: progress_pct between 0 and 100', 'SKIP', null,
       'team_tasks.progress_pct does not exist yet, so apply_all.sql adds it as 0 for every row.',
       'Nothing.');
  else
    select count(*) filter (where progress_pct < 0 or progress_pct > 100),
           count(*) filter (where progress_pct is null)
      into v_big, v_big2
      from public.team_tasks;

    if v_big = 0 and v_big2 = 0 then
      insert into pg_temp.preflight_results values
        (70, 'team_tasks: progress_pct between 0 and 100', 'OK', 0,
         'Every row has a percentage inside 0-100.', 'Nothing.');
    elsif v_big = 0 then
      insert into pg_temp.preflight_results values
        (70, 'team_tasks: progress_pct between 0 and 100', 'WARN', v_big2,
         format('%s row(s) have no progress_pct; the task screen expects a number.', v_big2),
         'update public.team_tasks set progress_pct = 0 where progress_pct is null;');
    else
      insert into pg_temp.preflight_results values
        (70, 'team_tasks: progress_pct between 0 and 100', 'BLOCKS', v_big + v_big2,
         format('%s row(s) outside 0-100 and %s row(s) with no value. apply_all.sql cannot add team_tasks_progress_pct_check.', v_big, v_big2),
         'update public.team_tasks set progress_pct = greatest(0, least(100, coalesce(progress_pct, 0))) where progress_pct is null or progress_pct not between 0 and 100;');
    end if;
  end if;

  -- 8. check constraint team_tasks_approval_status_check.
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'team_tasks' and column_name = 'approval_status'
  ) into v_has;

  if to_regclass('public.team_tasks') is null or not v_has then
    insert into pg_temp.preflight_results values
      (80, 'team_tasks: known approval_status', 'SKIP', null,
       'team_tasks.approval_status does not exist yet, so apply_all.sql adds it as ''none'' for every row.',
       'Nothing.');
  else
    select count(*) filter (where approval_status is not null and approval_status not in ('none', 'pending', 'approved', 'rejected')),
           count(*) filter (where approval_status is null)
      into v_big, v_big2
      from public.team_tasks;

    if v_big = 0 and v_big2 = 0 then
      insert into pg_temp.preflight_results values
        (80, 'team_tasks: known approval_status', 'OK', 0,
         'Every row uses none, pending, approved or rejected.', 'Nothing.');
    elsif v_big = 0 then
      insert into pg_temp.preflight_results values
        (80, 'team_tasks: known approval_status', 'WARN', v_big2,
         format('%s row(s) have no approval_status; the task screen expects one of the four values.', v_big2),
         'update public.team_tasks set approval_status = ''none'' where approval_status is null;');
    else
      insert into pg_temp.preflight_results values
        (80, 'team_tasks: known approval_status', 'BLOCKS', v_big + v_big2,
         format('%s row(s) use an unknown approval_status and %s row(s) have none. apply_all.sql cannot add team_tasks_approval_status_check.', v_big, v_big2),
         'update public.team_tasks set approval_status = ''none'' where approval_status is null or approval_status not in (''none'', ''pending'', ''approved'', ''rejected'');');
    end if;
  end if;

  -- 9. Overall verdict, always first in the result.
  insert into pg_temp.preflight_results
  select
    0,
    'OVERALL',
    case when count(*) filter (where verdict = 'BLOCKS') > 0 then 'BLOCKS' else 'OK' end,
    count(*) filter (where verdict = 'BLOCKS'),
    case
      when count(*) filter (where verdict = 'BLOCKS') > 0 then
        format('%s blocking check(s): %s.', count(*) filter (where verdict = 'BLOCKS'), string_agg(check_name, ', ' order by ord) filter (where verdict = 'BLOCKS'))
      else
        'No blocking rows found. apply_all.sql can run.'
    end,
    case
      when count(*) filter (where verdict = 'BLOCKS') > 0 then
        'Run the `fix` statement on every BLOCKS row, then run this file again.'
      else
        'Paste drizzle/apply_all.sql next; run drizzle/seed_only.sql after it only if the demo seed row above says SEED SKIPPED.'
    end
  from pg_temp.preflight_results;

end $preflight$;

select ord as "#", check_name as "check", verdict, bad_rows as "rows", detail as found, fix
  from pg_temp.preflight_results
 order by ord;
