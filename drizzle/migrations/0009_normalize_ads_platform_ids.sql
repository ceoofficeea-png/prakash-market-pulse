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
