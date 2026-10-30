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
select setval(pg_get_serial_sequence('public.social_accounts','id'), 10);

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
select setval(pg_get_serial_sequence('public.competitors','id'), 9);

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
