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
