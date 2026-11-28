-- Prakash Pump Marketing Command Center - complete schema, one file.
--
-- Generated from drizzle/migrations/0000 ... 0014 (0011 includes the social
-- metric repair). Paste this whole file into the Supabase SQL editor and run it
-- once. It is safe to re-run:
--
--   * the app_role enum, tables, columns, indexes, triggers and policies are
--     created only when missing (existing policies are dropped and recreated);
--   * role checks, RLS policies and RPCs are CREATE OR REPLACE;
--   * the demo seed data only runs when public.countries is empty, so a second
--     run will not duplicate rows.
--
-- The seed is a single block: if it fails, none of its rows are committed.
-- To reseed on purpose, empty the tables first (or run only the seed block).
--
-- After this file runs, sign up once: the first account becomes administrator
-- and every later sign-up starts as viewer.

-- ===== 0000_auth_profiles_roles.sql =====
do $enum$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'app_role' and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('admin', 'manager', 'analyst', 'viewer');
  end if;
end $enum$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  job_title text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles)) $$;

drop policy if exists "Signed-in users can view profiles" on public.profiles;
create policy "Signed-in users can view profiles" on public.profiles
  for select to authenticated using (true);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users view own roles, admins view all" on public.user_roles;
create policy "Users view own roles, admins view all" on public.user_roles
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins insert roles" on public.user_roles;
create policy "Admins insert roles" on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins update roles" on public.user_roles;
create policy "Admins update roles" on public.user_roles
  for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Admins delete roles" on public.user_roles;
create policy "Admins delete roles" on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- First account becomes admin; everyone after starts as viewer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 0001_marketing_core_schema.sql =====
-- Reference dimensions -------------------------------------------------------
create table if not exists public.countries (
  code text primary key,
  name text not null,
  region text not null,
  currency text not null,
  flag text not null default '',
  market_size_musd numeric not null default 0,
  growth_rate numeric not null default 0,
  market_share numeric not null default 0,
  priority text not null default 'Emerging',
  distributors int not null default 0,
  cpc_index numeric not null default 1,
  demand_index numeric not null default 1,
  notes text
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  avg_deal_value numeric not null default 0
);

create table if not exists public.team_members (
  id bigint generated by default as identity primary key,
  name text not null,
  title text not null,
  team text not null,
  country_code text references public.countries(code),
  email text not null,
  joined_on date not null default current_date,
  manager_id bigint references public.team_members(id),
  capacity_hours int not null default 160,
  status text not null default 'Active'
);

-- Campaigns & paid media -----------------------------------------------------
create table if not exists public.campaigns (
  id bigint generated by default as identity primary key,
  code text not null unique,
  name text not null,
  objective text not null,
  status text not null default 'Planned',
  product_id text references public.products(id),
  owner_id bigint references public.team_members(id),
  start_date date not null,
  end_date date not null,
  budget numeric not null default 0,
  countries text[] not null default '{}',
  platforms text[] not null default '{}',
  target_leads int not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_daily_metrics (
  id bigint generated by default as identity primary key,
  date date not null,
  campaign_id bigint not null references public.campaigns(id) on delete cascade,
  country_code text not null references public.countries(code),
  platform text not null,
  impressions int not null default 0,
  clicks int not null default 0,
  spend numeric(12,2) not null default 0,
  conversions int not null default 0,
  leads int not null default 0,
  revenue numeric(14,2) not null default 0
);
create index if not exists channel_daily_metrics_idx_1 on public.channel_daily_metrics (date);
create index if not exists channel_daily_metrics_idx_2 on public.channel_daily_metrics (campaign_id);
create index if not exists channel_daily_metrics_idx_3 on public.channel_daily_metrics (country_code, platform);

-- Social ---------------------------------------------------------------------
create table if not exists public.social_accounts (
  id bigint generated by default as identity primary key,
  platform text not null,
  name text not null,
  handle text not null,
  country_code text references public.countries(code),
  followers int not null default 0,
  manager_id bigint references public.team_members(id)
);

create table if not exists public.social_account_daily (
  id bigint generated by default as identity primary key,
  account_id bigint not null references public.social_accounts(id) on delete cascade,
  date date not null,
  followers int not null default 0,
  new_followers int not null default 0,
  impressions int not null default 0,
  engagements int not null default 0
);
create index if not exists social_account_daily_idx_1 on public.social_account_daily (date);

create table if not exists public.social_posts (
  id bigint generated by default as identity primary key,
  account_id bigint not null references public.social_accounts(id) on delete cascade,
  platform text not null,
  country_code text references public.countries(code),
  campaign_id bigint references public.campaigns(id) on delete set null,
  author_id bigint references public.team_members(id),
  published_at timestamptz not null,
  content text not null,
  format text not null,
  status text not null default 'Published',
  impressions int not null default 0,
  reach int not null default 0,
  engagements int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  clicks int not null default 0,
  video_views int not null default 0,
  sentiment text not null default 'Neutral'
);
create index if not exists social_posts_idx_1 on public.social_posts (published_at);

-- Website & SEO --------------------------------------------------------------
create table if not exists public.web_daily_metrics (
  id bigint generated by default as identity primary key,
  date date not null,
  country_code text not null references public.countries(code),
  source text not null,
  sessions int not null default 0,
  users int not null default 0,
  new_users int not null default 0,
  pageviews int not null default 0,
  bounce_rate numeric(5,4) not null default 0,
  avg_session_sec int not null default 0,
  conversions int not null default 0
);
create index if not exists web_daily_metrics_idx_1 on public.web_daily_metrics (date);
create index if not exists web_daily_metrics_idx_2 on public.web_daily_metrics (country_code, source);

create table if not exists public.web_pages (
  id bigint generated by default as identity primary key,
  path text not null,
  title text not null,
  page_type text not null,
  pageviews int not null default 0,
  unique_views int not null default 0,
  avg_time_sec int not null default 0,
  bounce_rate numeric(5,4) not null default 0,
  conversions int not null default 0,
  load_time_ms int not null default 0
);

create table if not exists public.seo_keywords (
  id bigint generated by default as identity primary key,
  keyword text not null,
  country_code text references public.countries(code),
  product_id text references public.products(id),
  position numeric(5,1) not null,
  prev_position numeric(5,1) not null,
  search_volume int not null default 0,
  difficulty int not null default 0,
  clicks int not null default 0,
  impressions int not null default 0,
  url text not null
);

-- Content --------------------------------------------------------------------
create table if not exists public.content_items (
  id bigint generated by default as identity primary key,
  title text not null,
  content_type text not null,
  status text not null default 'Idea',
  channel text not null,
  language text not null default 'English',
  author_id bigint references public.team_members(id),
  campaign_id bigint references public.campaigns(id) on delete set null,
  product_id text references public.products(id),
  country_code text references public.countries(code),
  due_date date,
  published_at date,
  views int not null default 0,
  downloads int not null default 0,
  engagement_rate numeric(6,4) not null default 0,
  leads_generated int not null default 0,
  summary text,
  created_at timestamptz not null default now()
);

-- CRM ------------------------------------------------------------------------
create table if not exists public.leads (
  id bigint generated by default as identity primary key,
  full_name text not null,
  company text not null,
  job_title text not null,
  email text not null,
  phone text,
  country_code text not null references public.countries(code),
  industry text not null,
  source text not null,
  campaign_id bigint references public.campaigns(id) on delete set null,
  product_id text references public.products(id),
  stage text not null default 'New',
  score int not null default 0,
  deal_value numeric(14,2) not null default 0,
  owner_id bigint references public.team_members(id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz
);
create index if not exists leads_idx_1 on public.leads (created_at);
create index if not exists leads_idx_2 on public.leads (stage);

create table if not exists public.lead_activities (
  id bigint generated by default as identity primary key,
  lead_id bigint not null references public.leads(id) on delete cascade,
  activity_type text not null,
  note text not null,
  owner_id bigint references public.team_members(id),
  occurred_at timestamptz not null default now()
);
create index if not exists lead_activities_idx_1 on public.lead_activities (lead_id);

-- Competitors ----------------------------------------------------------------
create table if not exists public.competitors (
  id bigint generated by default as identity primary key,
  name text not null,
  is_self boolean not null default false,
  hq_country text not null,
  website text not null,
  market_share numeric not null default 0,
  threat_level text not null default 'Medium',
  focus_segments text[] not null default '{}',
  strengths text,
  weaknesses text
);

create table if not exists public.competitor_monthly (
  id bigint generated by default as identity primary key,
  competitor_id bigint not null references public.competitors(id) on delete cascade,
  month date not null,
  share_of_voice numeric not null default 0,
  est_ad_spend numeric not null default 0,
  social_followers int not null default 0,
  web_visits int not null default 0,
  price_index numeric not null default 100,
  new_products int not null default 0
);

create table if not exists public.competitor_activities (
  id bigint generated by default as identity primary key,
  competitor_id bigint not null references public.competitors(id) on delete cascade,
  date date not null,
  activity_type text not null,
  title text not null,
  country_code text references public.countries(code),
  impact text not null default 'Medium',
  source_url text
);

-- Team -----------------------------------------------------------------------
create table if not exists public.team_tasks (
  id bigint generated by default as identity primary key,
  member_id bigint not null references public.team_members(id) on delete cascade,
  campaign_id bigint references public.campaigns(id) on delete set null,
  title text not null,
  status text not null default 'To Do',
  priority text not null default 'Medium',
  due_date date not null,
  completed_at date,
  hours_logged numeric not null default 0
);

create table if not exists public.team_monthly_kpis (
  id bigint generated by default as identity primary key,
  member_id bigint not null references public.team_members(id) on delete cascade,
  month date not null,
  tasks_completed int not null default 0,
  on_time_rate numeric not null default 0,
  leads_attributed int not null default 0,
  content_published int not null default 0,
  kpi_target numeric not null default 100,
  kpi_achieved numeric not null default 0,
  score numeric not null default 0
);

-- AI insights, reports, integrations ----------------------------------------
create table if not exists public.ai_insights (
  id bigint generated by default as identity primary key,
  module text not null,
  insight_type text not null,
  severity text not null default 'Info',
  title text not null,
  summary text not null,
  recommendation text not null,
  impact_estimate text,
  confidence numeric not null default 0.8,
  country_code text references public.countries(code),
  campaign_id bigint references public.campaigns(id) on delete set null,
  status text not null default 'New',
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated by default as identity primary key,
  name text not null,
  report_type text not null,
  frequency text not null,
  owner_id bigint references public.team_members(id),
  recipients text[] not null default '{}',
  format text not null default 'PDF',
  last_generated_at timestamptz,
  next_run_at timestamptz,
  status text not null default 'Active',
  description text
);

create table if not exists public.api_connections (
  id bigint generated by default as identity primary key,
  provider text not null,
  category text not null,
  status text not null default 'Not connected',
  description text not null,
  accounts_linked int not null default 0,
  last_sync_at timestamptz,
  sync_frequency text not null default 'Hourly',
  modules text[] not null default '{}'
);

-- Grants ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'countries','products','team_members','campaigns','channel_daily_metrics','social_accounts',
    'social_account_daily','social_posts','web_daily_metrics','web_pages','seo_keywords','content_items',
    'leads','lead_activities','competitors','competitor_monthly','competitor_activities','team_tasks',
    'team_monthly_kpis','ai_insights','reports','api_connections'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Signed-in users can read" on public.%I', t);
    execute format('create policy "Signed-in users can read" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Write policies by role -----------------------------------------------------
-- managers & admins: planning data
do $$
declare t text;
begin
  foreach t in array array['campaigns','team_tasks','reports','social_posts','team_members','competitor_activities'] loop
    execute format('drop policy if exists "Managers write" on public.%I', t);
    execute format('create policy "Managers write" on public.%I for insert to authenticated with check (public.has_any_role(auth.uid(), array[''admin'',''manager'']::public.app_role[]))', t);
    execute format('drop policy if exists "Managers update" on public.%I', t);
    execute format('create policy "Managers update" on public.%I for update to authenticated using (public.has_any_role(auth.uid(), array[''admin'',''manager'']::public.app_role[])) with check (public.has_any_role(auth.uid(), array[''admin'',''manager'']::public.app_role[]))', t);
    execute format('drop policy if exists "Managers delete" on public.%I', t);
    execute format('create policy "Managers delete" on public.%I for delete to authenticated using (public.has_any_role(auth.uid(), array[''admin'',''manager'']::public.app_role[]))', t);
  end loop;
  -- analysts too: day-to-day records
  foreach t in array array['leads','lead_activities','content_items','ai_insights'] loop
    execute format('drop policy if exists "Editors write" on public.%I', t);
    execute format('create policy "Editors write" on public.%I for insert to authenticated with check (public.has_any_role(auth.uid(), array[''admin'',''manager'',''analyst'']::public.app_role[]))', t);
    execute format('drop policy if exists "Editors update" on public.%I', t);
    execute format('create policy "Editors update" on public.%I for update to authenticated using (public.has_any_role(auth.uid(), array[''admin'',''manager'',''analyst'']::public.app_role[])) with check (public.has_any_role(auth.uid(), array[''admin'',''manager'',''analyst'']::public.app_role[]))', t);
    execute format('drop policy if exists "Managers delete" on public.%I', t);
    execute format('create policy "Managers delete" on public.%I for delete to authenticated using (public.has_any_role(auth.uid(), array[''admin'',''manager'']::public.app_role[]))', t);
  end loop;
  -- admins only: integrations
  execute 'drop policy if exists "Admins write" on public.api_connections';
  execute 'create policy "Admins write" on public.api_connections for insert to authenticated with check (public.has_role(auth.uid(), ''admin''))';
  execute 'drop policy if exists "Admins update" on public.api_connections';
  execute 'create policy "Admins update" on public.api_connections for update to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  execute 'drop policy if exists "Admins delete" on public.api_connections';
  execute 'create policy "Admins delete" on public.api_connections for delete to authenticated using (public.has_role(auth.uid(), ''admin''))';
end $$;

-- Aggregation functions (respect RLS: security invoker) ----------------------
create or replace function public.metrics_breakdown(
  p_dim text, p_from date, p_to date,
  p_countries text[] default null, p_platforms text[] default null, p_campaigns bigint[] default null
) returns table (key text, impressions bigint, clicks bigint, spend numeric, conversions bigint, leads bigint, revenue numeric)
language sql stable security invoker set search_path = public
as $$
  select
    case p_dim
      when 'date' then m.date::text
      when 'week' then date_trunc('week', m.date)::date::text
      when 'month' then date_trunc('month', m.date)::date::text
      when 'country' then m.country_code
      when 'platform' then m.platform
      when 'campaign' then m.campaign_id::text
      when 'region' then c.region
      else 'all'
    end as key,
    sum(m.impressions)::bigint, sum(m.clicks)::bigint, round(sum(m.spend), 2),
    sum(m.conversions)::bigint, sum(m.leads)::bigint, round(sum(m.revenue), 2)
  from public.channel_daily_metrics m
  join public.countries c on c.code = m.country_code
  where m.date between p_from and p_to
    and (p_countries is null or m.country_code = any(p_countries))
    and (p_platforms is null or m.platform = any(p_platforms))
    and (p_campaigns is null or m.campaign_id = any(p_campaigns))
  group by 1
  order by 1
$$;

create or replace function public.web_breakdown(
  p_dim text, p_from date, p_to date,
  p_countries text[] default null, p_sources text[] default null
) returns table (key text, sessions bigint, users bigint, new_users bigint, pageviews bigint, bounce_rate numeric, avg_session_sec numeric, conversions bigint)
language sql stable security invoker set search_path = public
as $$
  select
    case p_dim
      when 'date' then w.date::text
      when 'week' then date_trunc('week', w.date)::date::text
      when 'month' then date_trunc('month', w.date)::date::text
      when 'country' then w.country_code
      when 'source' then w.source
      else 'all'
    end as key,
    sum(w.sessions)::bigint, sum(w.users)::bigint, sum(w.new_users)::bigint, sum(w.pageviews)::bigint,
    round(sum(w.bounce_rate * w.sessions) / nullif(sum(w.sessions), 0), 4),
    round(sum(w.avg_session_sec::numeric * w.sessions) / nullif(sum(w.sessions), 0), 0),
    sum(w.conversions)::bigint
  from public.web_daily_metrics w
  where w.date between p_from and p_to
    and (p_countries is null or w.country_code = any(p_countries))
    and (p_sources is null or w.source = any(p_sources))
  group by 1
  order by 1
$$;

grant execute on function public.metrics_breakdown(text, date, date, text[], text[], bigint[]) to authenticated;
grant execute on function public.web_breakdown(text, date, date, text[], text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed data (only when the database is empty)
-- ---------------------------------------------------------------------------
do $seed$
begin
  if exists (select 1 from public.countries limit 1) then
    raise notice 'Reference data already present - skipping demo seed.';
    return;
  end if;

  insert into public.countries (code,name,region,currency,flag,market_size_musd,growth_rate,market_share,priority,distributors,cpc_index,demand_index,notes) values
  ('IN','India','South Asia','INR','🇮🇳',4200,8.5,18.5,'Core',142,1.0,1.8,'Home market. PM-KUSUM solar subsidy driving agri demand.'),
  ('BD','Bangladesh','South Asia','BDT','🇧🇩',380,9.1,14.6,'Core',27,0.7,0.6,'Strong dealer network; irrigation-led demand.'),
  ('AE','United Arab Emirates','Middle East','AED','🇦🇪',620,6.2,7.1,'Core',18,2.6,0.7,'Regional hub for GCC distribution and re-export.'),
  ('SA','Saudi Arabia','Middle East','SAR','🇸🇦',1150,7.4,4.2,'Growth',14,2.4,0.8,'Vision 2030 infrastructure and desalination projects.'),
  ('EG','Egypt','Africa','EGP','🇪🇬',450,6.8,4.9,'Growth',11,0.9,0.6,'Large agri irrigation base; FX volatility.'),
  ('KE','Kenya','Africa','KES','🇰🇪',310,9.8,11.4,'Growth',22,1.1,0.7,'Solar irrigation adoption among smallholders.'),
  ('NG','Nigeria','Africa','NGN','🇳🇬',540,10.2,6.3,'Growth',19,0.9,0.8,'Municipal water and borewell demand rising.'),
  ('ZA','South Africa','Africa','ZAR','🇿🇦',480,4.1,3.2,'Emerging',9,1.6,0.5,'Mining dewatering and municipal tenders.'),
  ('DE','Germany','Europe','EUR','🇩🇪',2900,2.8,0.6,'Emerging',4,4.5,0.5,'High-spec industrial buyers; certification-led.'),
  ('GB','United Kingdom','Europe','GBP','🇬🇧',1800,2.5,0.9,'Emerging',5,4.2,0.4,'Building services and fire-safety channel.'),
  ('US','United States','Americas','USD','🇺🇸',7800,3.6,0.4,'Emerging',6,5.0,0.6,'Market entry via OEM and distributor partners.'),
  ('BR','Brazil','Americas','BRL','🇧🇷',1400,5.9,1.1,'Growth',8,1.8,0.6,'Agribusiness irrigation; local assembly opportunity.'),
  ('ID','Indonesia','Southeast Asia','IDR','🇮🇩',890,7.9,3.8,'Growth',12,0.9,0.7,'Palm and rice irrigation; dealer expansion.'),
  ('VN','Vietnam','Southeast Asia','VND','🇻🇳',520,8.8,5.2,'Growth',10,0.8,0.6,'Aquaculture and agri pumps growing fast.');

  insert into public.products (id,name,category,avg_deal_value) values
  ('SUB','Submersible Borewell Pumps','Agriculture',900),
  ('SOL','Solar Pumping Systems','Renewable',2400),
  ('CEN','Centrifugal Monoblock Pumps','Agriculture',600),
  ('IND','Industrial Process Pumps','Industrial',9000),
  ('FIRE','Fire-Fighting Pump Sets','Infrastructure',6000),
  ('SEW','Sewage & Dewatering Pumps','Municipal',7000),
  ('OPW','Openwell Submersibles','Domestic',400),
  ('MOT','Electric Motors','Industrial',3500);

  insert into public.team_members (id,name,title,team,country_code,email,joined_on,manager_id,capacity_hours) overriding system value values
  (1,'Vikram Mehta','Head of Marketing','Leadership','IN','vikram.mehta@prakashpump.com','2016-04-11',null,160),
  (2,'Priya Nair','Performance Marketing Lead','Performance','IN','priya.nair@prakashpump.com','2019-07-01',1,160),
  (3,'Rahul Verma','Paid Media Specialist','Performance','IN','rahul.verma@prakashpump.com','2022-02-14',2,160),
  (4,'Sara Al-Mansoori','Regional Marketing Manager, Middle East','Regional','AE','sara.almansoori@prakashpump.com','2020-09-20',1,160),
  (5,'Daniel Okafor','Regional Marketing Manager, Africa','Regional','NG','daniel.okafor@prakashpump.com','2021-01-18',1,160),
  (6,'Grace Wanjiru','Field Marketing Executive','Regional','KE','grace.wanjiru@prakashpump.com','2023-03-06',5,160),
  (7,'Meera Iyer','Content Marketing Lead','Content','IN','meera.iyer@prakashpump.com','2018-11-05',1,160),
  (8,'Arjun Kapoor','Technical Content Writer','Content','IN','arjun.kapoor@prakashpump.com','2023-06-12',7,160),
  (9,'Lena Fischer','Marketing Manager, Europe','Regional','DE','lena.fischer@prakashpump.com','2022-05-02',1,160),
  (10,'Tomás Ribeiro','Marketing Manager, Americas','Regional','BR','tomas.ribeiro@prakashpump.com','2024-01-08',1,160),
  (11,'Nguyen Thi Lan','Marketing Executive, Southeast Asia','Regional','VN','lan.nguyen@prakashpump.com','2023-09-25',1,160),
  (12,'Kavya Reddy','Social Media Manager','Social','IN','kavya.reddy@prakashpump.com','2021-08-16',1,160),
  (13,'Imran Sheikh','Graphic & Video Designer','Creative','IN','imran.sheikh@prakashpump.com','2020-03-09',7,160),
  (14,'Neha Joshi','SEO & Web Analytics Specialist','Digital','IN','neha.joshi@prakashpump.com','2022-10-03',2,160),
  (15,'Siddharth Rao','Marketing Operations & CRM','Operations','IN','siddharth.rao@prakashpump.com','2019-12-02',1,160),
  (16,'Fatima Rahman','Marketing Executive, Bangladesh','Regional','BD','fatima.rahman@prakashpump.com','2024-04-15',1,160);
  perform setval(pg_get_serial_sequence('public.team_members','id'), 16);

  insert into public.campaigns (id,code,name,objective,status,product_id,owner_id,start_date,end_date,budget,countries,platforms,target_leads,description) overriding system value values
  (1,'CMP-26-001','Solar Pump Subsidy Drive — PM-KUSUM','Lead Generation','Active','SOL',2,current_date-170,current_date+20,85000,'{IN}','{google_ads,meta_ads,youtube_ads}',6000,'Capture farmer and dealer enquiries for subsidised solar pumping systems across Maharashtra, Rajasthan and UP.'),
  (2,'CMP-26-002','Kharif Season Borewell Push','Lead Generation','Completed','SUB',3,current_date-165,current_date-70,42000,'{IN,BD}','{google_ads,meta_ads}',3500,'Seasonal push for submersible borewell pumps ahead of Kharif sowing.'),
  (3,'CMP-26-003','GCC Water Infrastructure Tenders','Account-Based Marketing','Active','IND',4,current_date-150,current_date+30,68000,'{AE,SA}','{linkedin_ads,google_ads}',220,'Target EPC contractors and utilities bidding on GCC water infrastructure tenders.'),
  (4,'CMP-26-004','East Africa Solar Irrigation','Lead Generation','Active','SOL',6,current_date-140,current_date+10,38000,'{KE,NG}','{meta_ads,google_ads}',1800,'Smallholder and cooperative solar irrigation awareness with dealer referral.'),
  (5,'CMP-26-005','FireSafe Pump Sets — Building Codes','Awareness','Completed','FIRE',4,current_date-120,current_date-20,31000,'{AE,SA,IN}','{linkedin_ads,google_ads}',300,'Educate MEP consultants on NFPA-20 compliant fire-fighting pump sets.'),
  (6,'CMP-26-006','EuroAqua Distributor Recruitment','Distributor Recruitment','Active','IND',9,current_date-110,current_date+40,54000,'{DE,GB}','{linkedin_ads,google_ads}',120,'Recruit certified industrial pump distributors in DACH and UK.'),
  (7,'CMP-26-007','Prakash Brand Film 2026','Awareness','Completed','CEN',1,current_date-100,current_date-30,72000,'{IN,AE,KE,NG,ID}','{youtube_ads,meta_ads}',900,'“Water moves India” brand film rolled out across core and growth markets.'),
  (8,'CMP-26-008','Municipal Sewage Solutions — Africa','Lead Generation','Active','SEW',5,current_date-90,current_date+30,29000,'{NG,ZA,EG,KE}','{linkedin_ads,google_ads}',260,'Municipal engineers and contractors for sewage and dewatering pumps.'),
  (9,'CMP-26-009','Americas Market Entry','Product Launch','Active','IND',10,current_date-80,current_date+60,61000,'{US,BR}','{google_ads,linkedin_ads}',400,'Launch of the industrial process pump range with OEM partners.'),
  (10,'CMP-26-010','Indonesia & Vietnam Agri Dealers','Distributor Recruitment','Active','CEN',11,current_date-75,current_date+15,26000,'{ID,VN}','{meta_ads,google_ads}',350,'Onboard agri equipment dealers for centrifugal monoblock pumps.'),
  (11,'CMP-26-011','Retargeting — Website Visitors Global','Retargeting','Active','SUB',2,current_date-60,current_date+30,22000,'{IN,AE,SA,KE,NG,DE,US}','{google_ads,meta_ads}',900,'Re-engage product page visitors who did not submit an enquiry.'),
  (12,'CMP-26-012','Openwell Monsoon Offer','Promotion','Completed','OPW',3,current_date-50,current_date-5,18000,'{IN,BD}','{meta_ads,google_ads}',1500,'Monsoon season promotion for domestic openwell submersibles.'),
  (13,'CMP-26-013','IFAT & Water Expo Pre-Event','Event','Completed','IND',9,current_date-40,current_date-10,15000,'{DE,AE}','{linkedin_ads}',150,'Drive booth meetings ahead of IFAT Munich and Water Expo Dubai.'),
  (14,'CMP-26-014','Industrial Motors B2B Webinar Series','Lead Generation','Active','MOT',7,current_date-30,current_date+45,24000,'{IN,AE,DE,US}','{linkedin_ads,youtube_ads}',500,'Monthly technical webinars on IE3/IE4 efficient motors.'),
  (15,'CMP-26-015','Rabi Season Solar Campaign','Lead Generation','Planned','SOL',2,current_date+5,current_date+90,64000,'{IN}','{google_ads,meta_ads,youtube_ads}',5000,'Rabi season follow-on to the PM-KUSUM drive.'),
  (16,'CMP-26-016','Saudi Vision 2030 Infra Partners','Account-Based Marketing','Pause','IND',4,current_date-20,current_date+70,33000,'{SA}','{linkedin_ads}',80,'Paused pending new distributor agreement in Riyadh.');
  perform setval(pg_get_serial_sequence('public.campaigns','id'), 16);

  -- Daily paid media metrics --------------------------------------------------
  perform setseed(0.42);
  with plat(platform, base_imp, ctr, cpc, cvr) as (values
    ('google_ads', 3500, 0.045, 0.45, 0.060),
    ('meta_ads', 9000, 0.014, 0.22, 0.035),
    ('linkedin_ads', 1800, 0.008, 2.80, 0.050),
    ('youtube_ads', 12000, 0.006, 0.12, 0.015)
  ), rows as (
    select d::date as date, c.id as campaign_id, co.code as country_code, p.platform,
      p.base_imp * co.demand_index
        * (case when extract(isodow from d) in (6,7) then (case when p.platform = 'linkedin_ads' then 0.55 else 1.1 end) else 1 end)
        * (0.7 + random() * 0.6) * (1 + 0.003 * (d::date - (current_date - 179))) as imp,
      p.ctr * (0.8 + random() * 0.4) as ctr,
      p.cpc * co.cpc_index * (0.85 + random() * 0.3) as cpc,
      p.cvr * (0.7 + random() * 0.6) as cvr,
      pr.avg_deal_value as deal
    from public.campaigns c
    join public.products pr on pr.id = c.product_id
    cross join lateral unnest(c.countries) as cc(code)
    join public.countries co on co.code = cc.code
    cross join lateral unnest(c.platforms) as cp(platform)
    join plat p on p.platform = cp.platform
    cross join lateral generate_series(
      greatest(c.start_date, current_date - 179),
      least(c.end_date, case when c.status = 'Pause' then current_date - 6 else current_date end),
      interval '1 day') d
  )
  insert into public.channel_daily_metrics (date,campaign_id,country_code,platform,impressions,clicks,spend,conversions,leads,revenue)
  select date, campaign_id, country_code, platform,
    round(imp), round(imp*ctr), round((imp*ctr*cpc)::numeric, 2), round(imp*ctr*cvr), round(imp*ctr*cvr*0.7),
    round((imp*ctr*cvr*0.7 * deal * 0.12 * (0.5 + random()))::numeric, 2)
  from rows;

  -- Scale each campaign so spend paces realistically against budget.
  with tot as (select campaign_id, sum(spend) s from public.channel_daily_metrics group by 1),
  target as (
    select c.id, c.budget
      * least(1, greatest(0.05, (least(c.end_date, current_date) - c.start_date + 1)::numeric / (c.end_date - c.start_date + 1)))
      * (0.86 + (c.id % 5) * 0.04) as t
    from public.campaigns c
  ), f as (select tot.campaign_id, target.t / nullif(tot.s,0) as k from tot join target on target.id = tot.campaign_id)
  update public.channel_daily_metrics m set
    impressions = round(m.impressions * f.k),
    clicks = round(m.clicks * f.k),
    spend = round(m.spend * f.k, 2),
    conversions = round(m.conversions * f.k),
    leads = round(m.leads * f.k),
    revenue = round(m.revenue * f.k, 2)
  from f where f.campaign_id = m.campaign_id;

  -- Website daily traffic ------------------------------------------------------
  with src(source, share, bounce, dur, cvr) as (values
    ('Organic Search', 0.42, 0.44, 185, 0.021),
    ('Paid Search', 0.18, 0.39, 160, 0.034),
    ('Paid Social', 0.14, 0.58, 95, 0.012),
    ('Direct', 0.14, 0.36, 210, 0.026),
    ('Referral', 0.07, 0.41, 175, 0.024),
    ('Email', 0.05, 0.33, 230, 0.038)
  ), base(code, b) as (values
    ('IN',2600),('BD',300),('AE',420),('SA',300),('EG',220),('KE',380),('NG',340),('ZA',160),
    ('DE',240),('GB',180),('US',310),('BR',200),('ID',260),('VN',220)
  ), rows as (
    select d::date as date, base.code, src.*,
      base.b * src.share * (case when extract(isodow from d) in (6,7) then 0.72 else 1 end)
        * (0.8 + random()*0.4) * (1 + 0.0025 * (d::date - (current_date - 179))) as s
    from generate_series(current_date - 179, current_date, interval '1 day') d
    cross join base cross join src
  )
  insert into public.web_daily_metrics (date,country_code,source,sessions,users,new_users,pageviews,bounce_rate,avg_session_sec,conversions)
  select date, code, source, round(s), round(s*0.78), round(s*0.78*0.62), round(s*(2.4+random())),
    round((bounce * (0.9 + random()*0.2))::numeric, 4), round(dur * (0.85 + random()*0.3)), round(s*cvr*(0.7+random()*0.6))
  from rows;

  insert into public.web_pages (path,title,page_type,pageviews,unique_views,avg_time_sec,bounce_rate,conversions,load_time_ms) values
  ('/','Home','Home',184200,142300,74,0.38,1240,1850),
  ('/products/solar-pumping-systems','Solar Pumping Systems','Product',96400,71200,162,0.31,2210,2100),
  ('/products/submersible-borewell-pumps','Submersible Borewell Pumps','Product',88100,66500,148,0.34,1630,1980),
  ('/products/centrifugal-monoblock','Centrifugal Monoblock Pumps','Product',52300,40100,131,0.37,820,1920),
  ('/products/industrial-process-pumps','Industrial Process Pumps','Product',41800,30900,204,0.29,610,2350),
  ('/products/fire-fighting-pump-sets','Fire-Fighting Pump Sets','Product',23600,18200,188,0.33,390,2240),
  ('/products/sewage-dewatering','Sewage & Dewatering Pumps','Product',19800,15100,171,0.35,280,2190),
  ('/products/openwell-submersibles','Openwell Submersibles','Product',31200,24800,119,0.41,540,1890),
  ('/products/electric-motors','Electric Motors','Product',17400,13300,157,0.36,230,2010),
  ('/pm-kusum-solar-subsidy','PM-KUSUM Subsidy Guide','Landing Page',72500,60100,236,0.27,3120,1640),
  ('/dealer-locator','Dealer Locator','Tool',64300,48900,98,0.22,0,2480),
  ('/become-a-distributor','Become a Distributor','Landing Page',21900,17600,142,0.30,740,1720),
  ('/resources/pump-selection-guide','Pump Selection Guide','Resource',38700,31200,312,0.24,960,1580),
  ('/resources/case-studies/rajasthan-solar','Case Study: Rajasthan Solar Cluster','Case Study',12400,10300,268,0.28,190,1690),
  ('/resources/case-studies/dubai-metro-fire','Case Study: Dubai Metro Fire Systems','Case Study',8100,6900,251,0.30,120,1710),
  ('/blog/how-to-choose-a-borewell-pump','How to choose a borewell pump','Blog',45600,39800,287,0.46,410,1530),
  ('/blog/solar-vs-diesel-pumps-cost','Solar vs diesel pumps: true cost','Blog',39100,33900,301,0.43,520,1490),
  ('/blog/ie4-motors-energy-savings','IE4 motors: energy savings explained','Blog',14800,12600,264,0.48,140,1560),
  ('/contact','Contact Us','Conversion',27300,22100,88,0.19,2940,1420),
  ('/request-a-quote','Request a Quote','Conversion',33900,27400,121,0.17,4180,1460),
  ('/ar/products/industrial-process-pumps','مضخات العمليات الصناعية','Product',6200,4900,176,0.34,95,2410),
  ('/de/haendler-werden','Händler werden','Landing Page',3400,2800,155,0.32,48,1800);

  with kw(keyword, product_id, vol, diff) as (values
    ('solar water pump','SOL',74000,58),('solar pump price','SOL',49500,41),('pm kusum yojana','SOL',201000,36),
    ('borewell submersible pump','SUB',40500,47),('1 hp submersible pump price','SUB',33100,33),('submersible pump manufacturer','SUB',9900,52),
    ('monoblock pump','CEN',27100,44),('centrifugal pump for agriculture','CEN',8100,38),
    ('industrial process pump','IND',6600,63),('chemical process pump supplier','IND',2900,59),
    ('fire fighting pump set','FIRE',5400,49),('nfpa 20 fire pump','FIRE',3600,61),
    ('sewage pump','SEW',22200,51),('dewatering pump','SEW',14800,48),
    ('openwell submersible pump','OPW',18100,35),('ie4 motor','MOT',6600,46),('pump dealer near me','SUB',60500,29),
    ('water pump distributor','IND',4400,42)
  ), ctry(code) as (values ('IN'),('AE'),('KE'),('NG'),('DE'),('US'),('ID'))
  insert into public.seo_keywords (keyword,country_code,product_id,position,prev_position,search_volume,difficulty,clicks,impressions,url)
  select kw.keyword, ctry.code, kw.product_id,
    p.pos, greatest(1, round((p.pos + (random()*8 - 4))::numeric, 1)),
    round(kw.vol * (case ctry.code when 'IN' then 1 else 0.05 + random()*0.15 end)),
    kw.diff, 0, 0,
    '/products/' || lower(kw.product_id)
  from kw cross join ctry
  cross join lateral (select round((case when ctry.code = 'IN' then 1 + random()*14 else 3 + random()*45 end)::numeric, 1) as pos) p
  where ctry.code = 'IN' or random() < 0.35;

  update public.seo_keywords set
    impressions = round(search_volume * (case when position <= 3 then 0.9 when position <= 10 then 0.6 when position <= 20 then 0.2 else 0.05 end)),
    clicks = round(search_volume * (case when position <= 1.5 then 0.28 when position <= 3 then 0.15 when position <= 10 then 0.04 when position <= 20 then 0.008 else 0.001 end));

  update public.channel_daily_metrics set revenue = round(revenue * 0.5, 2);

  -- Extra SEO keywords for international markets
  with kw(keyword, product_id, vol, diff) as (values
    ('solar water pump','SOL',74000,58),('solar pump price','SOL',49500,41),
    ('borewell submersible pump','SUB',40500,47),('submersible pump manufacturer','SUB',9900,52),
    ('monoblock pump','CEN',27100,44),('industrial process pump','IND',6600,63),('chemical process pump supplier','IND',2900,59),
    ('fire fighting pump set','FIRE',5400,49),('nfpa 20 fire pump','FIRE',3600,61),
    ('sewage pump','SEW',22200,51),('dewatering pump','SEW',14800,48),('ie4 motor','MOT',6600,46),('water pump distributor','IND',4400,42)
  ), ctry(code, f) as (values ('AE',0.06),('SA',0.05),('KE',0.08),('NG',0.09),('DE',0.12),('GB',0.08),('US',0.2),('ID',0.1),('VN',0.07))
  insert into public.seo_keywords (keyword,country_code,product_id,position,prev_position,search_volume,difficulty,clicks,impressions,url)
  select kw.keyword, ctry.code, kw.product_id,
    round((3 + abs(hashtext(kw.keyword||ctry.code)) % 45 + (abs(hashtext(ctry.code||kw.keyword)) % 10) / 10.0)::numeric, 1),
    round((3 + abs(hashtext(kw.keyword||ctry.code||'p')) % 45)::numeric, 1),
    round(kw.vol * ctry.f), kw.diff, 0, 0, '/products/' || lower(kw.product_id)
  from kw cross join ctry
  where abs(hashtext(kw.keyword || ctry.code)) % 3 = 0;

  update public.seo_keywords set
    impressions = round(search_volume * (case when position <= 3 then 0.9 when position <= 10 then 0.6 when position <= 20 then 0.2 else 0.05 end)),
    clicks = round(search_volume * (case when position <= 1.5 then 0.28 when position <= 3 then 0.15 when position <= 10 then 0.04 when position <= 20 then 0.008 else 0.001 end));

  -- Social accounts -----------------------------------------------------------
  insert into public.social_accounts (id,platform,name,handle,country_code,followers,manager_id) overriding system value values
  (1,'linkedin','Prakash Pump Global','prakash-pump',null,48200,12),
  (2,'facebook','Prakash Pump India','PrakashPumpIndia','IN',312000,12),
  (3,'instagram','Prakash Pump India','@prakashpump.india','IN',86400,12),
  (4,'youtube','Prakash Pump TV','@PrakashPumpTV',null,127000,13),
  (5,'linkedin','Prakash Pump Middle East','prakash-pump-me','AE',9100,4),
  (6,'facebook','Prakash Pump Africa','PrakashPumpAfrica','KE',41800,5),
  (7,'x','Prakash Pump','@PrakashPump',null,15600,12),
  (8,'instagram','Prakash Pump Global','@prakashpump',null,22300,12),
  (9,'facebook','Prakash Pump Indonesia','PrakashPumpID','ID',18700,11),
  (10,'linkedin','Prakash Pump Europe','prakash-pump-europe','DE',3800,9);
  perform setval(pg_get_serial_sequence('public.social_accounts','id'), 10);

  with daily as (
    select a.id as account_id, d::date as date, a.followers as base,
      greatest(0, round(a.followers * 0.0009 * (0.4 + random()*1.2) * (1 + 0.004*(d::date-(current_date-179))))) as nf,
      round(a.followers * (case a.platform when 'facebook' then 0.09 when 'instagram' then 0.14 when 'linkedin' then 0.22 when 'youtube' then 0.05 else 0.12 end) * (0.6+random()*0.8)) as imp
    from public.social_accounts a cross join generate_series(current_date-179, current_date, interval '1 day') d
  )
  insert into public.social_account_daily (account_id,date,followers,new_followers,impressions,engagements)
  select account_id, date,
    (base - sum(nf) over (partition by account_id) + sum(nf) over (partition by account_id order by date))::int,
    nf, imp, round(imp * (0.025 + random()*0.04))
  from daily;

  with topics(t) as (values
    ('Farmers in Rajasthan cut diesel costs by 80% with our 5HP solar pumping system. Watch the story. #SolarPumps #PMKUSUM'),
    ('New: Industrial process pumps with IE4 motors — up to 18% lower lifetime energy cost. Download the datasheet.'),
    ('Meet us at Water Expo Dubai, Hall 4, Stand B21. Book a meeting with our GCC team.'),
    ('How to size a borewell submersible pump in 4 steps — save this guide for your next installation.'),
    ('Behind the scenes at our Coimbatore plant: every pump is hydro-tested before dispatch.'),
    ('Dealer spotlight: Kisan Agro, Nashik — 12 years with Prakash Pump.'),
    ('Monsoon-ready? Our openwell submersibles are built for high-silt water. Offer valid till month end.'),
    ('Webinar: Selecting fire-fighting pump sets for NFPA-20 compliance. Register now.'),
    ('Case study: 40 village water schemes in Kenya powered by Prakash solar pumps.'),
    ('We are hiring distributors in Germany and the UK. Join the Prakash Pump partner network.'),
    ('Customer question of the week: What is the difference between monoblock and submersible pumps?'),
    ('Sustainability report 2026: 1.2 million tonnes of CO₂ avoided by our solar installations.'),
    ('Municipal engineers: see how our sewage pumps handle 50mm solids without clogging.'),
    ('Proud to receive the BEE 5-star rating across our agricultural pump range.'),
    ('Quick tip: Check your pump''s amperage monthly to catch wear before it becomes a breakdown.')
  ), fmt(f) as (values ('Image'),('Video'),('Carousel'),('Reel'),('Article'),('Text'))
  insert into public.social_posts (account_id,platform,country_code,campaign_id,author_id,published_at,content,format,status,impressions,reach,engagements,likes,comments,shares,clicks,video_views,sentiment)
  select a.id, a.platform, a.country_code,
    case when random() < 0.55 then (1 + floor(random()*14))::bigint else null end,
    (array[12,12,13,7,8,4,5,9,11])[1 + floor(random()*9)::int],
    case when s.n <= 390 then now() - (random() * interval '178 days') else now() + (random() * interval '20 days') end,
    (select t from topics offset floor(random()*15)::int limit 1),
    (select f from fmt offset floor(random()*6)::int limit 1),
    case when s.n <= 390 then 'Published' when s.n <= 410 then 'Scheduled' else 'Draft' end,
    0,0,0,0,0,0,0,0,
    case when random() < 0.68 then 'Positive' when random() < 0.85 then 'Neutral' else 'Negative' end
  from generate_series(1, 420) s(n)
  cross join lateral (select * from public.social_accounts where s.n > 0 order by random() limit 1) a;

  update public.social_posts p set
    impressions = x.imp, reach = round(x.imp*0.72),
    likes = round(x.imp*x.er*0.7), comments = round(x.imp*x.er*0.12), shares = round(x.imp*x.er*0.18),
    engagements = round(x.imp*x.er), clicks = round(x.imp*(0.004+random()*0.012)),
    video_views = case when p.format in ('Video','Reel') then round(x.imp*(0.3+random()*0.35)) else 0 end
  from (
    select sp.id,
      round(a.followers * (case sp.format when 'Video' then 0.6 when 'Reel' then 0.9 when 'Carousel' then 0.45 else 0.3 end) * (0.3 + random()*1.4)) as imp,
      (case sp.platform when 'linkedin' then 0.045 when 'instagram' then 0.055 when 'facebook' then 0.03 when 'youtube' then 0.04 else 0.02 end) * (0.6+random()*0.8) as er
    from public.social_posts sp join public.social_accounts a on a.id = sp.account_id
  ) x
  where x.id = p.id and p.status = 'Published';

  -- Content -------------------------------------------------------------------
  with t(type, channel, title) as (values
    ('Blog Article','Website','How to choose the right {p} for your farm'),
    ('Case Study','Website','{c}: {p} deployment case study'),
    ('Product Brochure','Sales Enablement','{p} — 2026 product brochure'),
    ('Technical Datasheet','Sales Enablement','{p} technical datasheet & curves'),
    ('Video','YouTube','{p} installation walkthrough'),
    ('Webinar','LinkedIn','Live webinar: {p} best practices for {c}'),
    ('Whitepaper','Website','Total cost of ownership: {p} in {c}'),
    ('Social Creative','Social','{p} campaign creative set — {c}'),
    ('Email Newsletter','Email','Prakash Pump dealer newsletter — {p} focus'),
    ('Landing Page','Website','{p} enquiry landing page — {c}'),
    ('Press Release','PR','Prakash Pump expands {p} presence in {c}')
  )
  insert into public.content_items (title,content_type,status,channel,language,author_id,campaign_id,product_id,country_code,due_date,published_at,views,downloads,engagement_rate,leads_generated,summary,created_at)
  select
    replace(replace(tt.title, '{p}', pr.name), '{c}', co.name),
    tt.type, st.status, tt.channel,
    case co.code when 'AE' then 'Arabic' when 'SA' then 'Arabic' when 'EG' then 'Arabic' when 'DE' then 'German' when 'BR' then 'Portuguese' when 'ID' then 'Bahasa Indonesia' when 'VN' then 'Vietnamese' when 'KE' then (case when random()<0.3 then 'Swahili' else 'English' end) when 'IN' then (case when random()<0.35 then 'Hindi' else 'English' end) else 'English' end,
    (array[7,8,8,13,12,14,7,8,13])[1 + floor(random()*9)::int],
    case when random() < 0.7 then (1 + floor(random()*16))::bigint else null end,
    pr.id, co.code,
    st.due, case when st.status in ('Published','Archived') then st.due else null end,
    case when st.status in ('Published','Archived') then round(300 + random()*24000) else 0 end,
    case when st.status in ('Published','Archived') and tt.type in ('Product Brochure','Technical Datasheet','Whitepaper','Case Study') then round(40 + random()*1800) else 0 end,
    case when st.status in ('Published','Archived') then round((0.01 + random()*0.09)::numeric, 4) else 0 end,
    case when st.status in ('Published','Archived') then round(random()*120) else 0 end,
    'Owned asset supporting ' || pr.name || ' in ' || co.name || '.',
    now() - (random() * interval '170 days')
  from generate_series(1, 96) s(n)
  cross join lateral (select * from t where s.n > 0 order by random() limit 1) tt
  cross join lateral (select * from public.products where s.n > 0 order by random() limit 1) pr
  cross join lateral (select * from public.countries where s.n > 0 order by random() limit 1) co
  cross join lateral (
    select case
      when r < 0.42 then 'Published' when r < 0.50 then 'Archived' when r < 0.60 then 'Approved'
      when r < 0.72 then 'In Review' when r < 0.86 then 'In Production' when r < 0.94 then 'Brief' else 'Idea' end as status,
      case when r < 0.50 then current_date - (5 + floor(random()*160))::int else current_date + (1 + floor(random()*40))::int end as due
    from (select random() + s.n*0 as r) q
  ) st;

  -- Leads ---------------------------------------------------------------------
  with names(region, firsts, lasts) as (values
    ('South Asia', array['Rajesh','Sunita','Amit','Pooja','Suresh','Kiran','Manoj','Deepa','Ravi','Anil','Farhana','Tanvir'], array['Patel','Sharma','Kulkarni','Singh','Reddy','Gupta','Desai','Chowdhury','Hossain','Yadav','Jain','Pillai']),
    ('Middle East', array['Ahmed','Fatima','Omar','Layla','Khalid','Noura','Hassan','Mariam'], array['Al-Rashid','Al-Harbi','Haddad','Al-Qasimi','Nasser','Al-Otaibi','Saleh','Mansour']),
    ('Africa', array['Chinedu','Amina','Kwame','Wanjiku','Tunde','Zanele','Mohamed','Achieng'], array['Okonkwo','Mwangi','Adeyemi','Nkosi','Odhiambo','Bello','Hassan','Kamau']),
    ('Europe', array['Thomas','Anna','Markus','Sophie','James','Claire','Lukas','Emma'], array['Müller','Schneider','Wagner','Smith','Taylor','Becker','Wright','Hoffmann']),
    ('Americas', array['Michael','Jessica','Carlos','Ana','Robert','Juliana','David','Fernanda'], array['Johnson','Williams','Silva','Santos','Miller','Oliveira','Brown','Costa']),
    ('Southeast Asia', array['Budi','Siti','Minh','Linh','Agus','Thao','Rizky','Huong'], array['Santoso','Wijaya','Nguyen','Tran','Pratama','Le','Hidayat','Pham'])
  ), co_parts(a, b) as (values
    (array['Kisan','Green','Aqua','Delta','Sunrise','National','Royal','Metro','Unity','Crest','Blue River','Prime','Horizon','Summit','Global'],
     array['Agro Traders','Irrigation Co.','Water Solutions','EPC Ltd','Infra Projects','Engineering','Utilities','Builders','Pumps & Motors','Contracting','Farms','Industries'])
  )
  insert into public.leads (full_name,company,job_title,email,phone,country_code,industry,source,campaign_id,product_id,stage,score,deal_value,owner_id,created_at,last_activity_at)
  select
    fn || ' ' || ln,
    cp.a[1+floor(random()*15)::int] || ' ' || cp.b[1+floor(random()*12)::int],
    (array['Procurement Manager','Owner','Project Engineer','Purchase Head','Farm Manager','MEP Consultant','Operations Director','Technical Manager','Dealer Principal','Plant Manager'])[1+floor(random()*10)::int],
    lower(replace(fn,' ','')) || '.' || lower(replace(replace(ln,'-',''),' ','')) || s.n || '@example.com',
    '+' || (10 + floor(random()*89))::int || ' ' || (100000000 + floor(random()*899999999))::bigint,
    co.code,
    (array['Agriculture','Water Utilities','Construction','Oil & Gas','Mining','Real Estate','Municipal','Manufacturing','Dealer / Distributor','EPC Contractor'])[1+floor(random()*10)::int],
    src.source, src.campaign_id, coalesce(src.product_id, (array['SUB','SOL','CEN','IND','FIRE','SEW','OPW','MOT'])[1+floor(random()*8)::int]),
    stg.stage, stg.score,
    0,
    case co.region when 'Middle East' then 4 when 'Africa' then (case when random()<0.5 then 5 else 6 end) when 'Europe' then 9 when 'Americas' then 10 when 'Southeast Asia' then 11
      else (case when co.code = 'BD' then 16 else (array[2,3,15,14])[1+floor(random()*4)::int] end) end,
    ca, ca + (random() * (now() - ca))
  from generate_series(1, 480) s(n)
  cross join lateral (select * from public.countries where s.n > 0 order by (case code when 'IN' then random()*0.25 when 'BD' then random()*0.8 when 'AE' then random()*0.7 else random() end) limit 1) co
  cross join names nm
  cross join co_parts cp
  cross join lateral (select nm.firsts[1+floor(random()*array_length(nm.firsts,1))::int] as fn, nm.lasts[1+floor(random()*array_length(nm.lasts,1))::int] as ln) n
  cross join lateral (select now() - (random()^1.3 * interval '178 days') + s.n*interval '0' as ca) d
  cross join lateral (
    select c.id as campaign_id, c.product_id,
      case when c.id is null then (array['Organic Search','Website Form','Trade Show','Referral','Distributor','Email','Webinar'])[1+floor(random()*7)::int]
        else (array['Google Ads','Meta Ads','LinkedIn Ads','YouTube Ads'])[1+floor(random()*4)::int] end as source
    from (select 1) one
    left join lateral (select * from public.campaigns cc where co.code = any(cc.countries) and cc.status <> 'Planned' and random() < 0.75 order by random() limit 1) c on true
  ) src
  cross join lateral (
    select case when r < 0.22 then 'New' when r < 0.42 then 'Contacted' when r < 0.60 then 'Qualified' when r < 0.72 then 'Proposal'
      when r < 0.80 then 'Negotiation' when r < 0.90 then 'Won' else 'Lost' end as stage,
      (20 + floor(r*70 + random()*15))::int as score
    from (select random() + s.n*0 as r) q
  ) stg
  where nm.region = (case when co.region = 'South Asia' then 'South Asia' else co.region end);

  update public.leads l set deal_value = round((p.avg_deal_value * (case when l.industry in ('Dealer / Distributor','EPC Contractor','Water Utilities','Municipal','Oil & Gas','Mining') then 6 + random()*20 else 1 + random()*4 end))::numeric, -1)
  from public.products p where p.id = l.product_id;

  -- Fix source to match campaign platform when campaign set
  update public.leads l set source = case
    when 'linkedin_ads' = any(c.platforms) and l.source = 'LinkedIn Ads' then 'LinkedIn Ads'
    else (case c.platforms[1] when 'google_ads' then 'Google Ads' when 'meta_ads' then 'Meta Ads' when 'linkedin_ads' then 'LinkedIn Ads' else 'YouTube Ads' end) end
  from public.campaigns c where c.id = l.campaign_id;

  insert into public.lead_activities (lead_id, activity_type, note, owner_id, occurred_at)
  select l.id, act.t, act.note, l.owner_id, l.created_at + (k * (l.last_activity_at - l.created_at) / greatest(1, cnt))
  from public.leads l
  cross join lateral (select 1 + floor(random()*5)::int + (case when l.stage in ('Won','Negotiation','Proposal') then 2 else 0 end) as cnt) c
  cross join lateral generate_series(1, c.cnt) k
  cross join lateral (
    select (array['Email','Call','Meeting','Demo','Quote Sent','Note','Site Visit'])[1+floor(random()*7)::int + k*0] as t
  ) a
  cross join lateral (
    select a.t as t, case a.t
      when 'Email' then 'Sent product brochure and price list.'
      when 'Call' then 'Discussed head, flow and power availability requirements.'
      when 'Meeting' then 'Met with procurement team to review project timeline.'
      when 'Demo' then 'Live demo of pump performance and remote monitoring.'
      when 'Quote Sent' then 'Shared formal quotation with delivery schedule.'
      when 'Site Visit' then 'Site survey completed; borewell depth and yield recorded.'
      else 'Internal note: follow up after budget approval.' end as note
  ) act;

  -- Competitors ---------------------------------------------------------------
  insert into public.competitors (id,name,is_self,hq_country,website,market_share,threat_level,focus_segments,strengths,weaknesses) overriding system value values
  (1,'Prakash Pump',true,'India','prakashpump.com',6.8,'—','{Agriculture,Solar,Industrial,Infrastructure}','Wide agri range, strong dealer network in South Asia and East Africa, competitive pricing.','Low brand awareness in Europe and Americas; limited digital share of voice.'),
  (2,'Grundfos',false,'Denmark','grundfos.com',14.2,'High','{Building Services,Industrial,Water Utilities}','Premium global brand, digital pump monitoring, strong specifier relationships.','Premium price point in price-sensitive agri segments.'),
  (3,'KSB',false,'Germany','ksb.com',8.9,'High','{Industrial,Energy,Water Utilities}','Engineering reputation, large-project references.','Slower in small agri and solar segments.'),
  (4,'Kirloskar Brothers',false,'India','kirloskarpumps.com',9.6,'High','{Agriculture,Infrastructure,Industrial}','Heritage brand in India, broad portfolio, government tenders.','Fragmented digital presence across markets.'),
  (5,'CRI Pumps',false,'India','crigroups.com',7.4,'Medium','{Agriculture,Domestic,Solar}','Aggressive solar push, strong in South India.','Limited presence in GCC industrial segment.'),
  (6,'Xylem',false,'United States','xylem.com',11.3,'Medium','{Water Utilities,Wastewater,Industrial}','Smart water technology, wastewater leadership.','Less focus on smallholder agriculture.'),
  (7,'Wilo',false,'Germany','wilo.com',6.1,'Medium','{Building Services,Water Utilities}','Energy-efficient building pumps, strong EU channel.','Limited agri footprint in Africa.'),
  (8,'Shakti Pumps',false,'India','shaktipumps.com',4.2,'High','{Solar,Agriculture}','Solar pump specialist, export growth in Africa.','Narrower industrial range.'),
  (9,'Lubi Pumps',false,'India','lubipumps.com',3.1,'Low','{Agriculture,Domestic,Industrial}','Value pricing, growing dealer network.','Lower brand recall outside India.');
  perform setval(pg_get_serial_sequence('public.competitors','id'), 9);

  insert into public.competitor_monthly (competitor_id, month, share_of_voice, est_ad_spend, social_followers, web_visits, price_index, new_products)
  select c.id, date_trunc('month', current_date - (m || ' months')::interval)::date,
    round((c.market_share * (case when c.is_self then 0.85 + (5-m)*0.04 else 1.05 + random()*0.2 end))::numeric, 1),
    round((c.market_share * 9000 * (0.8 + random()*0.5))::numeric, -2),
    round(c.market_share * 42000 * (1 + (5-m)*0.012)),
    round(c.market_share * 61000 * (0.85 + random()*0.3)),
    round((case c.name when 'Grundfos' then 128 when 'KSB' then 121 when 'Xylem' then 125 when 'Wilo' then 118 when 'Kirloskar Brothers' then 104 when 'CRI Pumps' then 97 when 'Shakti Pumps' then 99 when 'Lubi Pumps' then 92 else 100 end + random()*4 - 2)::numeric, 1),
    floor(random()*3)::int
  from public.competitors c cross join generate_series(0,5) m;

  insert into public.competitor_activities (competitor_id, date, activity_type, title, country_code, impact, source_url)
  select c.id, current_date - floor(random()*170)::int, a.t,
    replace(a.title, '{n}', c.name), co.code,
    (array['High','Medium','Medium','Low'])[1+floor(random()*4)::int], 'https://' || c.website
  from generate_series(1, 64) s(n)
  cross join lateral (select * from public.competitors where not is_self and s.n > 0 order by random() limit 1) c
  cross join lateral (select * from public.countries where s.n > 0 order by random() limit 1) co
  cross join lateral (select * from (values
    ('Product Launch','{n} launched a new solar pump controller'),
    ('Price Change','{n} cut dealer prices on submersible range by ~5%'),
    ('Campaign','{n} started a YouTube brand campaign'),
    ('Trade Show','{n} exhibited at regional water expo'),
    ('Partnership','{n} signed a distribution partnership'),
    ('Tender Win','{n} won a municipal water supply tender'),
    ('Hiring','{n} posted 12 regional sales roles'),
    ('Press Coverage','{n} featured in trade press on smart pumps')
  ) v(t, title) where s.n > 0 order by random() limit 1) a;

  -- Team tasks & KPIs ---------------------------------------------------------
  insert into public.team_tasks (member_id, campaign_id, title, status, priority, due_date, completed_at, hours_logged)
  select m.id,
    case when random() < 0.7 then (1 + floor(random()*16))::bigint else null end,
    (array['Prepare campaign brief','Build landing page','Review ad creatives','Weekly performance report','Publish blog article','Update dealer list in CRM','Schedule social posts','Keyword research refresh','Webinar coordination','Translate brochure','Competitor price check','Lead follow-up sprint','Budget reallocation proposal','Event booth design','Email newsletter build'])[1+floor(random()*15)::int],
    st.s, (array['High','Medium','Medium','Low'])[1+floor(random()*4)::int],
    st.due, case when st.s = 'Done' then st.due - (floor(random()*5)::int - 1) else null end,
    round((1 + random()*14)::numeric, 1)
  from generate_series(1, 260) n
  cross join lateral (select * from public.team_members where n > 0 order by random() limit 1) m
  cross join lateral (
    select case when r < 0.58 then 'Done' when r < 0.75 then 'In Progress' when r < 0.83 then 'Blocked' else 'To Do' end as s,
      case when r < 0.58 then current_date - floor(random()*150)::int else current_date + floor(random()*30)::int - 5 end as due
    from (select random() + n*0 as r) q
  ) st;

  insert into public.team_monthly_kpis (member_id, month, tasks_completed, on_time_rate, leads_attributed, content_published, kpi_target, kpi_achieved, score)
  select m.id, date_trunc('month', current_date - (k || ' months')::interval)::date,
    6 + floor(random()*14)::int,
    round((0.72 + random()*0.26)::numeric, 3),
    case when m.team in ('Performance','Regional') then 20 + floor(random()*180)::int else floor(random()*25)::int end,
    case when m.team in ('Content','Creative','Social') then 4 + floor(random()*16)::int else floor(random()*3)::int end,
    100, x.ach, round((x.ach * 0.7 + 30 * random())::numeric, 1)
  from public.team_members m cross join generate_series(0,5) k
  cross join lateral (select round((70 + random()*45)::numeric, 1) + k*0 as ach) x;

  -- AI insights ---------------------------------------------------------------
  insert into public.ai_insights (module, insight_type, severity, title, summary, recommendation, impact_estimate, confidence, country_code, campaign_id, status, created_at) values
  ('Paid Media','Budget','Critical','PM-KUSUM campaign CPL rising 23% week-over-week','Cost per lead on Meta Ads in India rose from $1.82 to $2.24 over 7 days while Google Ads CPL stayed flat.','Shift 15% of Meta budget to Google Search exact-match subsidy keywords and refresh Meta creatives.','+410 leads / month','0.86','IN',1,'New',now()-interval '2 hours'),
  ('Paid Media','Opportunity','High','LinkedIn outperforms in GCC tenders campaign','LinkedIn delivers qualified leads at 38% lower cost than Google Ads for EPC contractor targeting in UAE and Saudi Arabia.','Increase LinkedIn share of budget to 65% and add Matched Audiences from tender lists.','-$4.2K CPL spend','0.81','AE',3,'New',now()-interval '6 hours'),
  ('Website & SEO','Anomaly','High','Organic sessions from Kenya up 41%','Organic search traffic from Kenya grew 41% in the last 14 days, led by "solar water pump price" queries.','Publish a Swahili landing page and add Kenya dealer locator to the solar product page.','+120 enquiries / month','0.77','KE',null,'In Review',now()-interval '1 day'),
  ('CRM','Risk','Critical','38 high-value leads idle for over 14 days','38 qualified leads worth $1.9M combined have had no activity in 14+ days, mostly in Middle East and Africa.','Trigger an automated follow-up sequence and reassign to regional managers.','$1.9M pipeline at risk','0.92',null,null,'New',now()-interval '3 hours'),
  ('Social','Content','Medium','Video posts drive 2.4× engagement on LinkedIn','Video and Reel formats achieve 2.4× the engagement rate of static images across LinkedIn accounts.','Convert the top 5 case studies into 60-second videos for LinkedIn Global and Middle East.','+18% engagement','0.74',null,null,'Actioned',now()-interval '3 days'),
  ('Competitors','Threat','High','Shakti Pumps expanding in East Africa','Shakti Pumps signed two new distributors in Kenya and Nigeria and increased search ad presence on solar keywords.','Defend branded and solar keywords in KE/NG and launch a dealer loyalty offer.','Protect 11% KE share','0.71','KE',4,'New',now()-interval '1 day'),
  ('Geography','Opportunity','Medium','Vietnam showing highest lead-to-quote rate','Vietnam leads convert to proposal at 34% vs. 21% global average, with low media cost.','Increase Vietnam budget allocation by $3K/month within the SEA dealer campaign.','+45 proposals / quarter','0.69','VN',10,'New',now()-interval '2 days'),
  ('Content','Performance','Low','Pump selection guide is the top converting asset','The pump selection guide drives 960 conversions with a 312-second average read time.','Gate an extended PDF version and promote via email to dormant leads.','+6% MQL rate','0.66',null,null,'Dismissed',now()-interval '6 days'),
  ('Paid Media','Budget','Medium','Americas launch under-pacing budget','Americas Market Entry has spent 31% of budget at 45% of flight time; impression share is limited by low bids in the US.','Raise US Google Ads max CPC by 20% for industrial process pump terms.','+22% impression share','0.73','US',9,'In Review',now()-interval '4 days'),
  ('Team','Workload','Medium','Content team at 112% capacity this month','Content and Creative teams have logged 112% of available hours with 9 tasks overdue.','Reprioritise low-impact social creatives and use the agency retainer for translations.','-9 overdue tasks','0.80',null,null,'New',now()-interval '12 hours'),
  ('Website & SEO','Technical','Medium','Arabic product pages load 30% slower','Arabic industrial pump pages average 2.4s load time versus 1.9s for English pages.','Compress hero images and enable regional CDN caching for /ar/ paths.','+0.4pp conversion','0.75','AE',null,'New',now()-interval '5 days'),
  ('Executive','Forecast','Info','Q4 lead forecast on track at 104% of target','Based on current pacing and the Rabi Season campaign launch, Q4 marketing-sourced leads are forecast at 104% of target.','Maintain current mix; pre-approve Rabi creative to avoid launch slippage.','Q4 target met','0.84',null,15,'New',now()-interval '8 hours');

  -- Reports -------------------------------------------------------------------
  insert into public.reports (name, report_type, frequency, owner_id, recipients, format, last_generated_at, next_run_at, status, description) values
  ('CEO Monthly Marketing Review','Executive','Monthly',1,'{ceo@prakashpump.com,cfo@prakashpump.com}','PDF',now()-interval '29 days',now()+interval '1 day','Active','Pipeline, revenue attribution, market share and key risks for the leadership team.'),
  ('Weekly Paid Media Performance','Paid Media','Weekly',2,'{marketing-leads@prakashpump.com}','PDF',now()-interval '3 days',now()+interval '4 days','Active','Spend, CPL, ROAS by platform, country and campaign.'),
  ('Regional Pipeline — Middle East','CRM','Weekly',4,'{gcc-sales@prakashpump.com}','Excel',now()-interval '2 days',now()+interval '5 days','Active','Lead stages, deal values and follow-up gaps for UAE and Saudi Arabia.'),
  ('Africa Market Pulse','Market Intelligence','Monthly',5,'{africa-team@prakashpump.com}','PDF',now()-interval '12 days',now()+interval '18 days','Active','Country demand, competitor moves and dealer activity across Africa.'),
  ('Social Media Scorecard','Social','Weekly',12,'{marketing@prakashpump.com}','PDF',now()-interval '1 day',now()+interval '6 days','Active','Followers, engagement and top posts across all accounts.'),
  ('SEO Ranking Tracker','Website & SEO','Weekly',14,'{digital@prakashpump.com}','Excel',now()-interval '4 days',now()+interval '3 days','Active','Keyword positions and organic traffic by market.'),
  ('Content Production Status','Content','Bi-weekly',7,'{content@prakashpump.com}','PDF',now()-interval '6 days',now()+interval '8 days','Active','Pipeline of content items by stage, owner and due date.'),
  ('Competitor Watch','Competitors','Monthly',15,'{leadership@prakashpump.com}','PDF',now()-interval '20 days',now()+interval '10 days','Active','Share of voice, pricing and product launches of tracked competitors.'),
  ('Board Quarterly Marketing Pack','Executive','Quarterly',1,'{board@prakashpump.com}','PowerPoint',now()-interval '35 days',now()+interval '55 days','Active','Quarterly marketing performance pack for the board.'),
  ('Team Productivity Report','Team','Monthly',1,'{hr@prakashpump.com}','Excel',now()-interval '28 days',now()+interval '2 days','Paused','KPI achievement, task completion and capacity by team member.');

  -- API connections (stage 1: demo only) --------------------------------------
  insert into public.api_connections (provider, category, status, description, accounts_linked, last_sync_at, sync_frequency, modules) values
  ('Google Ads','Advertising','Demo data','Campaign, ad group and keyword performance.',3,null,'Hourly','{Google & Meta Ads,Campaigns,Executive Overview}'),
  ('Meta Business Suite','Advertising','Demo data','Facebook & Instagram ads and page insights.',4,null,'Hourly','{Google & Meta Ads,Social Media}'),
  ('LinkedIn Campaign Manager','Advertising','Demo data','Sponsored content and lead-gen form results.',3,null,'Hourly','{Google & Meta Ads,Social Media}'),
  ('YouTube','Social','Demo data','Channel analytics and video performance.',1,null,'Daily','{Social Media}'),
  ('X (Twitter)','Social','Not connected','Post analytics and mentions.',0,null,'Daily','{Social Media}'),
  ('Google Analytics 4','Web Analytics','Demo data','Website sessions, sources and conversions.',1,null,'Hourly','{Website & SEO,Executive Overview}'),
  ('Google Search Console','SEO','Demo data','Search queries, impressions and rankings.',1,null,'Daily','{Website & SEO}'),
  ('HubSpot / CRM','CRM','Not connected','Two-way lead and deal sync.',0,null,'Real-time','{CRM & Leads}'),
  ('Salesforce','CRM','Not connected','Opportunity and account sync for enterprise sales.',0,null,'Real-time','{CRM & Leads,Reports}'),
  ('SEMrush','Competitive','Not connected','Competitor keywords and share of voice.',0,null,'Weekly','{Competitors,Website & SEO}'),
  ('Mailchimp','Email','Not connected','Newsletter and nurture campaign metrics.',0,null,'Daily','{Campaigns,Content}'),
  ('Lovable AI','AI','Planned','AI-generated insights and recommendations.',0,null,'On demand','{AI Intelligence}');

  update public.social_posts set
    content = (array[
      'Farmers in Rajasthan cut diesel costs by 80% with our 5HP solar pumping system. Watch the story. #SolarPumps #PMKUSUM',
      'New: Industrial process pumps with IE4 motors — up to 18% lower lifetime energy cost. Download the datasheet.',
      'Meet us at Water Expo Dubai, Hall 4, Stand B21. Book a meeting with our GCC team.',
      'How to size a borewell submersible pump in 4 steps — save this guide for your next installation.',
      'Behind the scenes at our Coimbatore plant: every pump is hydro-tested before dispatch.',
      'Dealer spotlight: Kisan Agro, Nashik — 12 years with Prakash Pump.',
      'Monsoon-ready? Our openwell submersibles are built for high-silt water. Offer valid till month end.',
      'Webinar: Selecting fire-fighting pump sets for NFPA-20 compliance. Register now.',
      'Case study: 40 village water schemes in Kenya powered by Prakash solar pumps.',
      'We are hiring distributors in Germany and the UK. Join the Prakash Pump partner network.',
      'Customer question of the week: What is the difference between monoblock and submersible pumps?',
      'Sustainability report 2026: 1.2 million tonnes of CO₂ avoided by our solar installations.',
      'Municipal engineers: see how our sewage pumps handle 50mm solids without clogging.',
      'Proud to receive the BEE 5-star rating across our agricultural pump range.',
      'Quick tip: Check your pump''s amperage monthly to catch wear before it becomes a breakdown.'
    ])[1 + floor(random()*15)::int],
    format = case platform
      when 'youtube' then (array['Video','Video','Short'])[1 + floor(random()*3)::int]
      when 'instagram' then (array['Reel','Carousel','Image','Story'])[1 + floor(random()*4)::int]
      when 'linkedin' then (array['Image','Video','Carousel','Article','Text'])[1 + floor(random()*5)::int]
      else (array['Image','Video','Carousel','Text'])[1 + floor(random()*4)::int] end,
    author_id = (array[12,12,13,7,8,4,5,9,11])[1 + floor(random()*9)::int];

  with names(region, firsts, lasts) as (values
    ('South Asia', array['Rajesh','Sunita','Amit','Pooja','Suresh','Kiran','Manoj','Deepa','Ravi','Anil','Farhana','Tanvir','Vivek','Lakshmi','Harish','Nisha'], array['Patel','Sharma','Kulkarni','Singh','Reddy','Gupta','Desai','Chowdhury','Hossain','Yadav','Jain','Pillai','Menon','Bose']),
    ('Middle East', array['Ahmed','Fatima','Omar','Layla','Khalid','Noura','Hassan','Mariam','Yousef','Huda'], array['Al-Rashid','Al-Harbi','Haddad','Al-Qasimi','Nasser','Al-Otaibi','Saleh','Mansour','Al-Zahrani']),
    ('Africa', array['Chinedu','Amina','Kwame','Wanjiku','Tunde','Zanele','Mohamed','Achieng','Emeka','Thandiwe','Karim','Njeri'], array['Okonkwo','Mwangi','Adeyemi','Nkosi','Odhiambo','Bello','Hassan','Kamau','Eze','Dlamini','Farouk']),
    ('Europe', array['Thomas','Anna','Markus','Sophie','James','Claire','Lukas','Emma','Felix','Hannah'], array['Müller','Schneider','Wagner','Smith','Taylor','Becker','Wright','Hoffmann','Evans']),
    ('Americas', array['Michael','Jessica','Carlos','Ana','Robert','Juliana','David','Fernanda','Kevin','Mariana'], array['Johnson','Williams','Silva','Santos','Miller','Oliveira','Brown','Costa','Pereira']),
    ('Southeast Asia', array['Budi','Siti','Minh','Linh','Agus','Thao','Rizky','Huong','Dewi','Quang'], array['Santoso','Wijaya','Nguyen','Tran','Pratama','Le','Hidayat','Pham','Hoang'])
  ), picked as (
    select l.id,
      n.firsts[1 + floor(random()*array_length(n.firsts,1))::int] as fn,
      n.lasts[1 + floor(random()*array_length(n.lasts,1))::int] as ln
    from public.leads l
    join public.countries c on c.code = l.country_code
    join names n on n.region = c.region
  )
  update public.leads l set
    full_name = p.fn || ' ' || p.ln,
    email = lower(regexp_replace(p.fn, '[^A-Za-z]', '', 'g')) || '.' || lower(regexp_replace(p.ln, '[^A-Za-z]', '', 'g')) || l.id || '@example.com',
    company = (array['Kisan','Green','Aqua','Delta','Sunrise','National','Royal','Metro','Unity','Crest','Blue River','Prime','Horizon','Summit','Global'])[1 + floor(random()*15)::int]
      || ' ' || (array['Agro Traders','Irrigation Co.','Water Solutions','EPC Ltd','Infra Projects','Engineering','Utilities','Builders','Pumps & Motors','Contracting','Farms','Industries'])[1 + floor(random()*12)::int],
    job_title = (array['Procurement Manager','Owner','Project Engineer','Purchase Head','Farm Manager','MEP Consultant','Operations Director','Technical Manager','Dealer Principal','Plant Manager'])[1 + floor(random()*10)::int],
    industry = (array['Agriculture','Water Utilities','Construction','Oil & Gas','Mining','Real Estate','Municipal','Manufacturing','Dealer / Distributor','EPC Contractor'])[1 + floor(random()*10)::int]
  from picked p where p.id = l.id;

  update public.lead_activities set activity_type = (array['Email','Call','Meeting','Demo','Quote Sent','Note','Site Visit'])[1 + floor(random()*7)::int];
  update public.lead_activities set note = case activity_type
    when 'Email' then (array['Sent product brochure and price list.','Shared case study and warranty terms.','Followed up on technical query.'])[1 + floor(random()*3)::int]
    when 'Call' then (array['Discussed head, flow and power availability requirements.','Clarified subsidy eligibility and documents.','Call with purchase head on delivery timelines.'])[1 + floor(random()*3)::int]
    when 'Meeting' then 'Met with procurement team to review project timeline.'
    when 'Demo' then 'Live demo of pump performance and remote monitoring.'
    when 'Quote Sent' then 'Shared formal quotation with delivery schedule.'
    when 'Site Visit' then 'Site survey completed; borewell depth and yield recorded.'
    else 'Internal note: follow up after budget approval.' end;

  update public.team_tasks set title = (array['Prepare campaign brief','Build landing page','Review ad creatives','Weekly performance report','Publish blog article','Update dealer list in CRM','Schedule social posts','Keyword research refresh','Webinar coordination','Translate brochure','Competitor price check','Lead follow-up sprint','Budget reallocation proposal','Event booth design','Email newsletter build','A/B test ad copy','Prepare trade show kit','Audit tracking tags'])[1 + floor(random()*18)::int];
end $seed$;

-- ===== 0005_add_lead_avatar_context.sql =====
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_context jsonb;
COMMENT ON COLUMN public.leads.avatar_context IS 'Prakash AI Avatar consultation capture: recommended_model, motor_hp, borewell_depth_m, head_m, feedback_score, whatsapp_handover_at, summary.';

-- ===== 0006_restrict_reads_to_role_holders.sql =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_members','campaigns','lead_activities','channel_daily_metrics','seo_keywords','competitors','competitor_monthly','competitor_activities','web_daily_metrics','reports','social_posts','social_accounts','leads','team_tasks','content_items','products','social_account_daily','ai_insights','team_monthly_kpis','api_connections','web_pages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Signed-in users can read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Team members with a role can read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Team members with a role can read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''admin'',''manager'',''analyst'',''viewer'']::public.app_role[]))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
drop policy if exists "Users view own profile, admins view all" on public.profiles;
create policy "Users view own profile, admins view all" on public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- ===== 0007_signup_viewer_only_and_countries_roles.sql =====
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
  insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  return new;
end;
$function$;

DROP POLICY IF EXISTS "Signed-in users can read" ON public.countries;
drop policy if exists "Team members with a role can read" on public.countries;
create policy "Team members with a role can read" on public.countries FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','manager','analyst','viewer']::public.app_role[]));

-- ===== 0008_first_account_admin_bootstrap.sql =====
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

-- ===== 0009_normalize_ads_platform_ids.sql =====
-- Paid media rows can be written with social-style platform names
-- (facebook, instagram, linkedin, youtube, google) while the UI and the
-- campaign seed use the canonical *_ads identifiers. That mismatch made the
-- per-platform ad charts return no series (they filter on meta_ads,
-- linkedin_ads, youtube_ads), so the charts rendered as zero.
--
-- 1) Normalise any existing rows.
-- 2) Normalise on read inside metrics_breakdown, so rows written later by an
--    import or another client still land on the same platform buckets.

update public.channel_daily_metrics
set platform = case lower(btrim(platform))
  when 'facebook' then 'meta_ads'
  when 'instagram' then 'meta_ads'
  when 'meta' then 'meta_ads'
  when 'meta ads' then 'meta_ads'
  when 'linkedin' then 'linkedin_ads'
  when 'linkedin ads' then 'linkedin_ads'
  when 'youtube' then 'youtube_ads'
  when 'youtube ads' then 'youtube_ads'
  when 'google' then 'google_ads'
  when 'google ads' then 'google_ads'
  else platform
end
where lower(btrim(platform)) in (
  'facebook', 'instagram', 'meta', 'meta ads',
  'linkedin', 'linkedin ads',
  'youtube', 'youtube ads',
  'google', 'google ads'
);

create or replace function public.metrics_breakdown(
  p_dim text, p_from date, p_to date,
  p_countries text[] default null, p_platforms text[] default null, p_campaigns bigint[] default null
) returns table (key text, impressions bigint, clicks bigint, spend numeric, conversions bigint, leads bigint, revenue numeric)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select
      m.date, m.campaign_id, m.country_code, m.impressions, m.clicks, m.spend,
      m.conversions, m.leads, m.revenue,
      case lower(btrim(m.platform))
        when 'facebook' then 'meta_ads'
        when 'instagram' then 'meta_ads'
        when 'meta' then 'meta_ads'
        when 'meta ads' then 'meta_ads'
        when 'linkedin' then 'linkedin_ads'
        when 'linkedin ads' then 'linkedin_ads'
        when 'youtube' then 'youtube_ads'
        when 'youtube ads' then 'youtube_ads'
        when 'google' then 'google_ads'
        when 'google ads' then 'google_ads'
        else lower(btrim(m.platform))
      end as platform
    from public.channel_daily_metrics m
  )
  select
    case p_dim
      when 'date' then b.date::text
      when 'week' then date_trunc('week', b.date)::date::text
      when 'month' then date_trunc('month', b.date)::date::text
      when 'country' then b.country_code
      when 'platform' then b.platform
      when 'campaign' then b.campaign_id::text
      when 'region' then c.region
      else 'all'
    end as key,
    sum(b.impressions)::bigint, sum(b.clicks)::bigint, round(sum(b.spend), 2),
    sum(b.conversions)::bigint, sum(b.leads)::bigint, round(sum(b.revenue), 2)
  from base b
  join public.countries c on c.code = b.country_code
  where b.date between p_from and p_to
    and (p_countries is null or b.country_code = any(p_countries))
    and (p_platforms is null or b.platform = any(p_platforms))
    and (p_campaigns is null or b.campaign_id = any(p_campaigns))
  group by 1
  order by 1
$$;

-- ===== 0010_restrict_role_writes_and_lead_reads.sql =====
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
drop policy if exists "Staff roles can read leads" on public.leads;
create policy "Staff roles can read leads" on public.leads
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin', 'manager', 'analyst']::public.app_role[]));

drop policy if exists "Team members with a role can read" on public.lead_activities;
drop policy if exists "Staff roles can read lead activities" on public.lead_activities;
create policy "Staff roles can read lead activities" on public.lead_activities
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin', 'manager', 'analyst']::public.app_role[]));

-- ===== 0011_social_metric_columns.sql =====
-- 0011: social metric columns (safe to re-run).
--
-- The social module used to render generated fixtures because the daily table
-- only stored followers, impressions and engagements. Add the platform-native
-- parts the screen shows, make (account_id, date) unique so a re-load can
-- upsert, and widen social_breakdown so one SQL pass feeds the KPIs, the
-- audience split and the trend chart.
--
-- Every statement is idempotent, so this file also repairs an existing database
-- where the migration was never applied: without it the aggregation collapses
-- every row into a single "all" key, so Likes/Comments/Shares read zero and the
-- Reach-by-platform chart is empty.

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

-- ===== 0012_username_login.sql =====
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

-- ===== 0013_task_progress_tracking.sql =====
-- 0013: employee task progress and the task activity history.
--
-- team_members.user_id links a roster row to the sign-in that owns it, so
-- "my tasks" is decided by the database instead of an email comparison.
-- team_tasks gains a completion percentage and a progress remark; every change
-- is appended to team_task_updates, which is append-only (no update/delete
-- policy), so the history cannot be rewritten from the browser.

alter table public.team_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists team_members_user_id_key
  on public.team_members (user_id) where user_id is not null;

-- Link existing roster rows to accounts that share their email address.
update public.team_members tm
   set user_id = p.id
  from public.profiles p
 where tm.user_id is null
   and p.email is not null
   and lower(p.email) = lower(tm.email);

alter table public.team_tasks
  add column if not exists progress_pct int not null default 0,
  add column if not exists progress_note text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.team_tasks drop constraint if exists team_tasks_progress_pct_check;
alter table public.team_tasks
  add constraint team_tasks_progress_pct_check check (progress_pct between 0 and 100);

update public.team_tasks set progress_pct = 100 where status = 'Done' and progress_pct < 100;

create index if not exists team_tasks_member_status_idx on public.team_tasks (member_id, status);

create table if not exists public.team_task_updates (
  id bigint generated by default as identity primary key,
  task_id bigint not null references public.team_tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  status text,
  progress_pct int,
  note text,
  created_at timestamptz not null default now(),
  constraint team_task_updates_progress_pct_check
    check (progress_pct is null or progress_pct between 0 and 100)
);

create index if not exists team_task_updates_task_idx
  on public.team_task_updates (task_id, created_at desc);

grant select, insert on public.team_task_updates to authenticated;
grant all on public.team_task_updates to service_role;
alter table public.team_task_updates enable row level security;

-- Read: admins and managers see every update; an employee sees the history of
-- the tasks assigned to their own roster row.
drop policy if exists "Staff and owners read task updates" on public.team_task_updates;
create policy "Staff and owners read task updates" on public.team_task_updates
  for select to authenticated
  using (
    public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[])
    or exists (
      select 1
        from public.team_tasks t
        join public.team_members m on m.id = t.member_id
       where t.id = team_task_updates.task_id
         and m.user_id = auth.uid()
    )
  );

-- Insert: a person may only append an entry under their own user id, and only
-- for a task they own (staff may annotate any task). No update or delete
-- policy exists, so the audit trail is append-only.
drop policy if exists "Authors append their own task updates" on public.team_task_updates;
create policy "Authors append their own task updates" on public.team_task_updates
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
        from public.team_tasks t
        join public.team_members m on m.id = t.member_id
       where t.id = team_task_updates.task_id
         and (
           m.user_id = auth.uid()
           or public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[])
         )
    )
  );

-- Employees may update their own task rows, but only the progress columns.
create or replace function public.guard_task_self_update()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  -- Service-role writes (server functions) carry no end-user JWT.
  if auth.uid() is null then
    return new;
  end if;

  if public.has_any_role(auth.uid(), array['admin','manager']::public.app_role[]) then
    return new;
  end if;

  if new.member_id <> old.member_id
     or new.title is distinct from old.title
     or new.priority is distinct from old.priority
     or new.due_date is distinct from old.due_date
     or new.campaign_id is distinct from old.campaign_id
     or new.hours_logged is distinct from old.hours_logged then
    raise exception 'You can only change the progress of your own tasks'
      using errcode = '42501';
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists guard_task_self_update on public.team_tasks;
create trigger guard_task_self_update
  before update on public.team_tasks
  for each row execute function public.guard_task_self_update();

-- Owners may update their own task rows; the trigger above limits which
-- columns they can touch. Staff keep their existing admin/manager policies.
drop policy if exists "Members update their own tasks" on public.team_tasks;
create policy "Members update their own tasks" on public.team_tasks
  for update to authenticated
  using (
    exists (
      select 1 from public.team_members m
       where m.id = team_tasks.member_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.team_members m
       where m.id = team_tasks.member_id and m.user_id = auth.uid()
    )
  );

-- ===== 0014_task_approvals.sql =====
-- 0014: task completion approvals.
--
-- An employee who marks a task Done does not close it silently: the task keeps
-- its status but carries approval_status = 'pending' until their manager (or an
-- administrator) approves or rejects it. Rejecting puts the task back to In
-- Progress with the reviewer's note. The decision function runs server-side,
-- and this policy lets a direct manager's own session write the decision even
-- when they do not hold the manager role.

alter table public.team_tasks
  add column if not exists approval_status text not null default 'none',
  add column if not exists approval_note text,
  add column if not exists approval_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_at timestamptz;

alter table public.team_tasks drop constraint if exists team_tasks_approval_status_check;
alter table public.team_tasks
  add constraint team_tasks_approval_status_check
  check (approval_status in ('none', 'pending', 'approved', 'rejected'));

create index if not exists team_tasks_pending_approval_idx
  on public.team_tasks (approval_status)
  where approval_status = 'pending';

-- A teammate's own manager may decide the tasks of the people who report to
-- them. Staff keep their existing admin/manager policies.
drop policy if exists "Direct managers decide task approvals" on public.team_tasks;
create policy "Direct managers decide task approvals" on public.team_tasks
  for update to authenticated
  using (
    exists (
      select 1
        from public.team_members m
        join public.team_members me on me.id = m.manager_id
       where m.id = team_tasks.member_id
         and me.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.team_members m
        join public.team_members me on me.id = m.manager_id
       where m.id = team_tasks.member_id
         and me.user_id = auth.uid()
    )
  );

-- Tasks completed before approvals existed count as already accepted.
update public.team_tasks
   set approval_status = 'approved'
 where status = 'Done'
   and approval_status = 'none';

-- ===== 0016_team_member_delete.sql =====
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

-- 0017: forward-only campaign status lifecycle.
--
-- Planned -> Active -> Pause -> Completed, one step at a time.
--   Planned   -> Active
--   Active    -> Pause
--   Pause     -> Completed
--   Completed -> nothing (the campaign is finished)
--
-- The rule is enforced by a BEFORE UPDATE trigger, so it holds for the app, for
-- a direct PostgREST update and for anyone typing SQL in the editor. Every
-- accepted transition is appended to campaign_status_history with the previous
-- status, the new status, who changed it and when. The history table is
-- append-only: only the trigger (security definer) writes to it.
--
-- The old demo data used "Paused"; it is normalised to "Pause" here so the
-- existing rows match the lifecycle.

-- 1) Normalise the previous label before the new constraint and trigger exist.
update public.campaigns
   set status = 'Pause'
 where status = 'Paused';

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('Planned', 'Active', 'Pause', 'Completed'));

-- 2) Audit trail -------------------------------------------------------------
create table if not exists public.campaign_status_history (
  id bigint generated by default as identity primary key,
  campaign_id bigint not null references public.campaigns(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  constraint campaign_status_history_status_check
    check (new_status in ('Planned', 'Active', 'Pause', 'Completed')),
  constraint campaign_status_history_previous_check
    check (previous_status is null or previous_status in ('Planned', 'Active', 'Pause', 'Completed'))
);

create index if not exists campaign_status_history_campaign_idx
  on public.campaign_status_history (campaign_id, changed_at desc);

grant select on public.campaign_status_history to authenticated;
grant all on public.campaign_status_history to service_role;
alter table public.campaign_status_history enable row level security;

-- Read: every signed-in role that can see campaigns can see their history.
-- There is deliberately no insert/update/delete policy: rows are written by the
-- trigger below, running as the table owner.
drop policy if exists "Campaign readers can read status history" on public.campaign_status_history;
create policy "Campaign readers can read status history" on public.campaign_status_history
  for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','manager','analyst','viewer']::public.app_role[]));

-- 3) Enforcement -------------------------------------------------------------
create or replace function public.guard_campaign_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_next  text;
  v_actor text;
begin
  if new.status is null
     or new.status not in ('Planned', 'Active', 'Pause', 'Completed') then
    raise exception 'Unknown campaign status "%". Allowed: Planned, Active, Pause, Completed', new.status
      using errcode = '23514';
  end if;

  -- New campaigns may be created in any valid stage (the demo seed does).
  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'Completed' then
    raise exception 'Campaign % is completed; its status cannot change again', old.code
      using errcode = '23514';
  end if;

  v_next := case old.status
              when 'Planned' then 'Active'
              when 'Active'  then 'Pause'
              when 'Pause'   then 'Completed'
            end;

  if v_next is null or new.status <> v_next then
    raise exception 'Campaign status cannot move from "%" to "%". The lifecycle is Planned -> Active -> Pause -> Completed.',
      old.status, new.status
      using errcode = '23514';
  end if;

  select p.full_name into v_actor from public.profiles p where p.id = auth.uid();

  insert into public.campaign_status_history
    (campaign_id, previous_status, new_status, changed_by, changed_by_name)
  values
    (old.id, old.status, new.status, auth.uid(), v_actor);

  return new;
end;
$function$;

drop trigger if exists guard_campaign_status on public.campaigns;
create trigger guard_campaign_status
  before insert or update on public.campaigns
  for each row execute function public.guard_campaign_status();

-- 4) Baseline history for campaigns that already exist -----------------------
insert into public.campaign_status_history
  (campaign_id, previous_status, new_status, changed_by, changed_by_name, changed_at)
select c.id, null, c.status, null, null, c.created_at
  from public.campaigns c
 where not exists (
   select 1 from public.campaign_status_history h where h.campaign_id = c.id
 );

notify pgrst, 'reload schema';

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
