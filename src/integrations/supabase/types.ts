export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          campaign_id: number | null
          confidence: number
          country_code: string | null
          created_at: string
          id: number
          impact_estimate: string | null
          insight_type: string
          module: string
          recommendation: string
          severity: string
          status: string
          summary: string
          title: string
        }
        Insert: {
          campaign_id?: number | null
          confidence?: number
          country_code?: string | null
          created_at?: string
          id?: number
          impact_estimate?: string | null
          insight_type: string
          module: string
          recommendation: string
          severity?: string
          status?: string
          summary: string
          title: string
        }
        Update: {
          campaign_id?: number | null
          confidence?: number
          country_code?: string | null
          created_at?: string
          id?: number
          impact_estimate?: string | null
          insight_type?: string
          module?: string
          recommendation?: string
          severity?: string
          status?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      api_connections: {
        Row: {
          accounts_linked: number
          category: string
          description: string
          id: number
          last_sync_at: string | null
          modules: string[]
          provider: string
          status: string
          sync_frequency: string
        }
        Insert: {
          accounts_linked?: number
          category: string
          description: string
          id?: number
          last_sync_at?: string | null
          modules?: string[]
          provider: string
          status?: string
          sync_frequency?: string
        }
        Update: {
          accounts_linked?: number
          category?: string
          description?: string
          id?: number
          last_sync_at?: string | null
          modules?: string[]
          provider?: string
          status?: string
          sync_frequency?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget: number
          code: string
          countries: string[]
          created_at: string
          description: string | null
          end_date: string
          id: number
          name: string
          objective: string
          owner_id: number | null
          platforms: string[]
          product_id: string | null
          start_date: string
          status: string
          target_leads: number
        }
        Insert: {
          budget?: number
          code: string
          countries?: string[]
          created_at?: string
          description?: string | null
          end_date: string
          id?: number
          name: string
          objective: string
          owner_id?: number | null
          platforms?: string[]
          product_id?: string | null
          start_date: string
          status?: string
          target_leads?: number
        }
        Update: {
          budget?: number
          code?: string
          countries?: string[]
          created_at?: string
          description?: string | null
          end_date?: string
          id?: number
          name?: string
          objective?: string
          owner_id?: number | null
          platforms?: string[]
          product_id?: string | null
          start_date?: string
          status?: string
          target_leads?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_daily_metrics: {
        Row: {
          campaign_id: number
          clicks: number
          conversions: number
          country_code: string
          date: string
          id: number
          impressions: number
          leads: number
          platform: string
          revenue: number
          spend: number
        }
        Insert: {
          campaign_id: number
          clicks?: number
          conversions?: number
          country_code: string
          date: string
          id?: number
          impressions?: number
          leads?: number
          platform: string
          revenue?: number
          spend?: number
        }
        Update: {
          campaign_id?: number
          clicks?: number
          conversions?: number
          country_code?: string
          date?: string
          id?: number
          impressions?: number
          leads?: number
          platform?: string
          revenue?: number
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_daily_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_daily_metrics_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      competitor_activities: {
        Row: {
          activity_type: string
          competitor_id: number
          country_code: string | null
          date: string
          id: number
          impact: string
          source_url: string | null
          title: string
        }
        Insert: {
          activity_type: string
          competitor_id: number
          country_code?: string | null
          date: string
          id?: number
          impact?: string
          source_url?: string | null
          title: string
        }
        Update: {
          activity_type?: string
          competitor_id?: number
          country_code?: string | null
          date?: string
          id?: number
          impact?: string
          source_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_activities_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_activities_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      competitor_monthly: {
        Row: {
          competitor_id: number
          est_ad_spend: number
          id: number
          month: string
          new_products: number
          price_index: number
          share_of_voice: number
          social_followers: number
          web_visits: number
        }
        Insert: {
          competitor_id: number
          est_ad_spend?: number
          id?: number
          month: string
          new_products?: number
          price_index?: number
          share_of_voice?: number
          social_followers?: number
          web_visits?: number
        }
        Update: {
          competitor_id?: number
          est_ad_spend?: number
          id?: number
          month?: string
          new_products?: number
          price_index?: number
          share_of_voice?: number
          social_followers?: number
          web_visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitor_monthly_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          focus_segments: string[]
          hq_country: string
          id: number
          is_self: boolean
          market_share: number
          name: string
          strengths: string | null
          threat_level: string
          weaknesses: string | null
          website: string
        }
        Insert: {
          focus_segments?: string[]
          hq_country: string
          id?: number
          is_self?: boolean
          market_share?: number
          name: string
          strengths?: string | null
          threat_level?: string
          weaknesses?: string | null
          website: string
        }
        Update: {
          focus_segments?: string[]
          hq_country?: string
          id?: number
          is_self?: boolean
          market_share?: number
          name?: string
          strengths?: string | null
          threat_level?: string
          weaknesses?: string | null
          website?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          author_id: number | null
          campaign_id: number | null
          channel: string
          content_type: string
          country_code: string | null
          created_at: string
          downloads: number
          due_date: string | null
          engagement_rate: number
          id: number
          language: string
          leads_generated: number
          product_id: string | null
          published_at: string | null
          status: string
          summary: string | null
          title: string
          views: number
        }
        Insert: {
          author_id?: number | null
          campaign_id?: number | null
          channel: string
          content_type: string
          country_code?: string | null
          created_at?: string
          downloads?: number
          due_date?: string | null
          engagement_rate?: number
          id?: number
          language?: string
          leads_generated?: number
          product_id?: string | null
          published_at?: string | null
          status?: string
          summary?: string | null
          title: string
          views?: number
        }
        Update: {
          author_id?: number | null
          campaign_id?: number | null
          channel?: string
          content_type?: string
          country_code?: string | null
          created_at?: string
          downloads?: number
          due_date?: string | null
          engagement_rate?: number
          id?: number
          language?: string
          leads_generated?: number
          product_id?: string | null
          published_at?: string | null
          status?: string
          summary?: string | null
          title?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "content_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          cpc_index: number
          currency: string
          demand_index: number
          distributors: number
          flag: string
          growth_rate: number
          market_share: number
          market_size_musd: number
          name: string
          notes: string | null
          priority: string
          region: string
        }
        Insert: {
          code: string
          cpc_index?: number
          currency: string
          demand_index?: number
          distributors?: number
          flag?: string
          growth_rate?: number
          market_share?: number
          market_size_musd?: number
          name: string
          notes?: string | null
          priority?: string
          region: string
        }
        Update: {
          code?: string
          cpc_index?: number
          currency?: string
          demand_index?: number
          distributors?: number
          flag?: string
          growth_rate?: number
          market_share?: number
          market_size_musd?: number
          name?: string
          notes?: string | null
          priority?: string
          region?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          id: number
          lead_id: number
          note: string
          occurred_at: string
          owner_id: number | null
        }
        Insert: {
          activity_type: string
          id?: number
          lead_id: number
          note: string
          occurred_at?: string
          owner_id?: number | null
        }
        Update: {
          activity_type?: string
          id?: number
          lead_id?: number
          note?: string
          occurred_at?: string
          owner_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          campaign_id: number | null
          company: string
          country_code: string
          created_at: string
          deal_value: number
          email: string
          full_name: string
          id: number
          industry: string
          job_title: string
          last_activity_at: string | null
          owner_id: number | null
          phone: string | null
          product_id: string | null
          score: number
          source: string
          stage: string
        }
        Insert: {
          campaign_id?: number | null
          company: string
          country_code: string
          created_at?: string
          deal_value?: number
          email: string
          full_name: string
          id?: number
          industry: string
          job_title: string
          last_activity_at?: string | null
          owner_id?: number | null
          phone?: string | null
          product_id?: string | null
          score?: number
          source: string
          stage?: string
        }
        Update: {
          campaign_id?: number | null
          company?: string
          country_code?: string
          created_at?: string
          deal_value?: number
          email?: string
          full_name?: string
          id?: number
          industry?: string
          job_title?: string
          last_activity_at?: string | null
          owner_id?: number | null
          phone?: string | null
          product_id?: string | null
          score?: number
          source?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_deal_value: number
          category: string
          id: string
          name: string
        }
        Insert: {
          avg_deal_value?: number
          category: string
          id: string
          name: string
        }
        Update: {
          avg_deal_value?: number
          category?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          description: string | null
          format: string
          frequency: string
          id: number
          last_generated_at: string | null
          name: string
          next_run_at: string | null
          owner_id: number | null
          recipients: string[]
          report_type: string
          status: string
        }
        Insert: {
          description?: string | null
          format?: string
          frequency: string
          id?: number
          last_generated_at?: string | null
          name: string
          next_run_at?: string | null
          owner_id?: number | null
          recipients?: string[]
          report_type: string
          status?: string
        }
        Update: {
          description?: string | null
          format?: string
          frequency?: string
          id?: number
          last_generated_at?: string | null
          name?: string
          next_run_at?: string | null
          owner_id?: number | null
          recipients?: string[]
          report_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          clicks: number
          country_code: string | null
          difficulty: number
          id: number
          impressions: number
          keyword: string
          position: number
          prev_position: number
          product_id: string | null
          search_volume: number
          url: string
        }
        Insert: {
          clicks?: number
          country_code?: string | null
          difficulty?: number
          id?: number
          impressions?: number
          keyword: string
          position: number
          prev_position: number
          product_id?: string | null
          search_volume?: number
          url: string
        }
        Update: {
          clicks?: number
          country_code?: string | null
          difficulty?: number
          id?: number
          impressions?: number
          keyword?: string
          position?: number
          prev_position?: number
          product_id?: string | null
          search_volume?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "seo_keywords_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      social_account_daily: {
        Row: {
          account_id: number
          date: string
          engagements: number
          followers: number
          id: number
          impressions: number
          new_followers: number
        }
        Insert: {
          account_id: number
          date: string
          engagements?: number
          followers?: number
          id?: number
          impressions?: number
          new_followers?: number
        }
        Update: {
          account_id?: number
          date?: string
          engagements?: number
          followers?: number
          id?: number
          impressions?: number
          new_followers?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_account_daily_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          country_code: string | null
          followers: number
          handle: string
          id: number
          manager_id: number | null
          name: string
          platform: string
        }
        Insert: {
          country_code?: string | null
          followers?: number
          handle: string
          id?: number
          manager_id?: number | null
          name: string
          platform: string
        }
        Update: {
          country_code?: string | null
          followers?: number
          handle?: string
          id?: number
          manager_id?: number | null
          name?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "social_accounts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          account_id: number
          author_id: number | null
          campaign_id: number | null
          clicks: number
          comments: number
          content: string
          country_code: string | null
          engagements: number
          format: string
          id: number
          impressions: number
          likes: number
          platform: string
          published_at: string
          reach: number
          sentiment: string
          shares: number
          status: string
          video_views: number
        }
        Insert: {
          account_id: number
          author_id?: number | null
          campaign_id?: number | null
          clicks?: number
          comments?: number
          content: string
          country_code?: string | null
          engagements?: number
          format: string
          id?: number
          impressions?: number
          likes?: number
          platform: string
          published_at: string
          reach?: number
          sentiment?: string
          shares?: number
          status?: string
          video_views?: number
        }
        Update: {
          account_id?: number
          author_id?: number | null
          campaign_id?: number | null
          clicks?: number
          comments?: number
          content?: string
          country_code?: string | null
          engagements?: number
          format?: string
          id?: number
          impressions?: number
          likes?: number
          platform?: string
          published_at?: string
          reach?: number
          sentiment?: string
          shares?: number
          status?: string
          video_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      team_members: {
        Row: {
          capacity_hours: number
          country_code: string | null
          email: string
          id: number
          joined_on: string
          manager_id: number | null
          name: string
          status: string
          team: string
          title: string
        }
        Insert: {
          capacity_hours?: number
          country_code?: string | null
          email: string
          id?: number
          joined_on?: string
          manager_id?: number | null
          name: string
          status?: string
          team: string
          title: string
        }
        Update: {
          capacity_hours?: number
          country_code?: string | null
          email?: string
          id?: number
          joined_on?: string
          manager_id?: number | null
          name?: string
          status?: string
          team?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "team_members_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_monthly_kpis: {
        Row: {
          content_published: number
          id: number
          kpi_achieved: number
          kpi_target: number
          leads_attributed: number
          member_id: number
          month: string
          on_time_rate: number
          score: number
          tasks_completed: number
        }
        Insert: {
          content_published?: number
          id?: number
          kpi_achieved?: number
          kpi_target?: number
          leads_attributed?: number
          member_id: number
          month: string
          on_time_rate?: number
          score?: number
          tasks_completed?: number
        }
        Update: {
          content_published?: number
          id?: number
          kpi_achieved?: number
          kpi_target?: number
          leads_attributed?: number
          member_id?: number
          month?: string
          on_time_rate?: number
          score?: number
          tasks_completed?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_monthly_kpis_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tasks: {
        Row: {
          campaign_id: number | null
          completed_at: string | null
          due_date: string
          hours_logged: number
          id: number
          member_id: number
          priority: string
          status: string
          title: string
        }
        Insert: {
          campaign_id?: number | null
          completed_at?: string | null
          due_date: string
          hours_logged?: number
          id?: number
          member_id: number
          priority?: string
          status?: string
          title: string
        }
        Update: {
          campaign_id?: number | null
          completed_at?: string | null
          due_date?: string
          hours_logged?: number
          id?: number
          member_id?: number
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tasks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_daily_metrics: {
        Row: {
          avg_session_sec: number
          bounce_rate: number
          conversions: number
          country_code: string
          date: string
          id: number
          new_users: number
          pageviews: number
          sessions: number
          source: string
          users: number
        }
        Insert: {
          avg_session_sec?: number
          bounce_rate?: number
          conversions?: number
          country_code: string
          date: string
          id?: number
          new_users?: number
          pageviews?: number
          sessions?: number
          source: string
          users?: number
        }
        Update: {
          avg_session_sec?: number
          bounce_rate?: number
          conversions?: number
          country_code?: string
          date?: string
          id?: number
          new_users?: number
          pageviews?: number
          sessions?: number
          source?: string
          users?: number
        }
        Relationships: [
          {
            foreignKeyName: "web_daily_metrics_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      web_pages: {
        Row: {
          avg_time_sec: number
          bounce_rate: number
          conversions: number
          id: number
          load_time_ms: number
          page_type: string
          pageviews: number
          path: string
          title: string
          unique_views: number
        }
        Insert: {
          avg_time_sec?: number
          bounce_rate?: number
          conversions?: number
          id?: number
          load_time_ms?: number
          page_type: string
          pageviews?: number
          path: string
          title: string
          unique_views?: number
        }
        Update: {
          avg_time_sec?: number
          bounce_rate?: number
          conversions?: number
          id?: number
          load_time_ms?: number
          page_type?: string
          pageviews?: number
          path?: string
          title?: string
          unique_views?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      metrics_breakdown: {
        Args: {
          p_campaigns?: number[]
          p_countries?: string[]
          p_dim: string
          p_from: string
          p_platforms?: string[]
          p_to: string
        }
        Returns: {
          clicks: number
          conversions: number
          impressions: number
          key: string
          leads: number
          revenue: number
          spend: number
        }[]
      }
      social_breakdown: {
        Args: {
          p_countries?: string[]
          p_dim: string
          p_from: string
          p_platforms?: string[]
          p_to: string
        }
        Returns: {
          engagements: number
          followers: number
          impressions: number
          key: string
          new_followers: number
        }[]
      }
      web_breakdown: {
        Args: {
          p_countries?: string[]
          p_dim: string
          p_from: string
          p_sources?: string[]
          p_to: string
        }
        Returns: {
          avg_session_sec: number
          bounce_rate: number
          conversions: number
          key: string
          new_users: number
          pageviews: number
          sessions: number
          users: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "analyst" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "analyst", "viewer"],
    },
  },
} as const
