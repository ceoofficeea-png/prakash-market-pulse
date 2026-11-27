-- 0011_social_metric_columns.sql
--
-- The social module used to render generated fixtures because the daily table
-- only stored followers, impressions and engagements. Add the platform-native
-- parts the screen shows, make (account_id, date) unique so a re-load can
-- upsert, and widen social_breakdown so one SQL pass feeds the KPIs, the
-- audience split and the trend chart.

alter table public.social_account_daily
  add column if not exists reach       int not null default 0,
  add column if not exists likes       int not null default 0,
  add column if not exists comments    int not null default 0,
  add column if not exists shares      int not null default 0,
  add column if not exists saves       int not null default 0,
  add column if not exists story_views int not null default 0,
  add column if not exists video_views int not null default 0,
  add column if not exists clicks      int not null default 0;

alter table public.social_posts
  add column if not exists saves       int not null default 0,
  add column if not exists story_views int not null default 0;

-- One row per account per day: makes the duplicate checks and the upsert
-- re-load pattern in the data guide possible.
create unique index if not exists social_account_daily_key
  on public.social_account_daily (account_id, date);

-- Rows loaded before this migration carry the totals but none of the parts.
-- Split them proportionally so the screen is readable before the first
-- re-load; the next platform export overwrites every column with real figures.
update public.social_account_daily
set reach    = round(impressions * 0.78),
    likes    = round(engagements * 0.72),
    comments = round(engagements * 0.12),
    shares   = round(engagements * 0.16)
where impressions > 0
  and reach = 0 and likes = 0 and comments = 0 and shares = 0;

-- The return type changes, so the old signature has to go first.
drop function if exists public.social_breakdown(text, date, date, text[], text[]);

create function public.social_breakdown(
  p_dim text, p_from date, p_to date,
  p_platforms text[] default null, p_countries text[] default null
) returns table (key text, impressions bigint, reach bigint, engagements bigint,
                 likes bigint, comments bigint, shares bigint, saves bigint,
                 story_views bigint, video_views bigint, clicks bigint,
                 new_followers bigint, followers bigint)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select d.*, a.platform, a.country_code
    from public.social_account_daily d
    join public.social_accounts a on a.id = d.account_id
    where d.date between p_from and p_to
      and (p_platforms is null or a.platform = any(p_platforms))
      and (p_countries is null or a.country_code = any(p_countries))
  ), last_day as (select max(date) d from base)
  select
    case p_dim
      when 'date' then b.date::text
      when 'week' then date_trunc('week', b.date)::date::text
      when 'platform' then b.platform
      when 'account' then b.account_id::text
      -- One series per platform for the trend chart, in a single pass, as
      -- "platform|YYYY-MM-DD". The weekly variant keeps long ranges well under
      -- the API row cap.
      when 'platform_date' then b.platform || '|' || b.date::text
      when 'platform_week' then b.platform || '|' || date_trunc('week', b.date)::date::text
      else 'all'
    end,
    sum(b.impressions)::bigint, sum(b.reach)::bigint, sum(b.engagements)::bigint,
    sum(b.likes)::bigint, sum(b.comments)::bigint, sum(b.shares)::bigint,
    sum(b.saves)::bigint, sum(b.story_views)::bigint, sum(b.video_views)::bigint,
    sum(b.clicks)::bigint, sum(b.new_followers)::bigint,
    case when p_dim = 'date' then sum(b.followers)::bigint
         else (sum(b.followers) filter (where b.date = (select d from last_day)))::bigint end
  from base b
  group by 1
  order by 1
$$;

grant execute on function public.social_breakdown(text, date, date, text[], text[]) to authenticated;
