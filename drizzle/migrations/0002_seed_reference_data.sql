create or replace function public.social_breakdown(
  p_dim text, p_from date, p_to date,
  p_platforms text[] default null, p_countries text[] default null
) returns table (key text, impressions bigint, engagements bigint, new_followers bigint, followers bigint)
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
      else 'all'
    end,
    sum(b.impressions)::bigint, sum(b.engagements)::bigint, sum(b.new_followers)::bigint,
    case when p_dim = 'date' then sum(b.followers)::bigint
         else (sum(b.followers) filter (where b.date = (select d from last_day)))::bigint end
  from base b
  group by 1
  order by 1
$$;

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
select setval(pg_get_serial_sequence('public.team_members','id'), 16);

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
(16,'CMP-26-016','Saudi Vision 2030 Infra Partners','Account-Based Marketing','Paused','IND',4,current_date-20,current_date+70,33000,'{SA}','{linkedin_ads}',80,'Paused pending new distributor agreement in Riyadh.');
select setval(pg_get_serial_sequence('public.campaigns','id'), 16);

-- Daily paid media metrics --------------------------------------------------
select setseed(0.42);
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
    least(c.end_date, case when c.status = 'Paused' then current_date - 6 else current_date end),
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
