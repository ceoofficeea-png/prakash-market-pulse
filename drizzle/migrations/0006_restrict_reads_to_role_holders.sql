DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_members','campaigns','lead_activities','channel_daily_metrics','seo_keywords','competitors','competitor_monthly','competitor_activities','web_daily_metrics','reports','social_posts','social_accounts','leads','team_tasks','content_items','products','social_account_daily','ai_insights','team_monthly_kpis','api_connections','web_pages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Signed-in users can read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Team members with a role can read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''admin'',''manager'',''analyst'',''viewer'']::public.app_role[]))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile, admins view all" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));