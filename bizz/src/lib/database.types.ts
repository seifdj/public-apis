/**
 * Generated from the Supabase project "Bizz" (migrations 0001-0008; shops and step 2 functions added by hand, regenerate when possible).
 * Regenerate after each migration: `npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
 */
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
    PostgrestVersion: "17.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_keywords: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          severity: string
          term: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          severity: string
          term: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          severity?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_keywords_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_keywords_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string
          id: number
          is_active: boolean
          label: string
          parent_id: number | null
          slug: string
          sort_order: number
        }
        Insert: {
          icon: string
          id?: number
          is_active?: boolean
          label: string
          parent_id?: number | null
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string
          id?: number
          is_active?: boolean
          label?: string
          parent_id?: number | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          department: string
          id: number
          insee_code: string
          location: unknown
          name: string
          population: number | null
          postal_codes: string[]
          region: string | null
          slug: string
        }
        Insert: {
          department: string
          id: number
          insee_code: string
          location: unknown
          name: string
          population?: number | null
          postal_codes?: string[]
          region?: string | null
          slug: string
        }
        Update: {
          department?: string
          id?: number
          insee_code?: string
          location?: unknown
          name?: string
          population?: number | null
          postal_codes?: string[]
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          expo_token: string
          id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_token: string
          id?: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_mode: Database["public"]["Enums"]["active_mode"]
          avatar_url: string | null
          city_id: number | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          location: unknown
          moderation_scope:
            | Database["public"]["Enums"]["moderation_scope"]
            | null
          moderation_zone: string | null
          phone_verified: boolean
          referral_code: string
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          suspended_until: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          active_mode?: Database["public"]["Enums"]["active_mode"]
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id: string
          is_admin?: boolean
          is_moderator?: boolean
          location?: unknown
          moderation_scope?:
            | Database["public"]["Enums"]["moderation_scope"]
            | null
          moderation_zone?: string | null
          phone_verified?: boolean
          referral_code?: string
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          active_mode?: Database["public"]["Enums"]["active_mode"]
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_admin?: boolean
          is_moderator?: boolean
          location?: unknown
          moderation_scope?:
            | Database["public"]["Enums"]["moderation_scope"]
            | null
          moderation_zone?: string | null
          phone_verified?: boolean
          referral_code?: string
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          suspended_until?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city_id: number
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          followers_count: number
          founder_rank: number | null
          id: string
          instagram: string | null
          is_founder: boolean
          location: unknown
          name: string
          owner_id: string
          posts_count: number
          rating_avg: number | null
          rating_count: number
          slug: string
          snapchat: string | null
          status: Database["public"]["Enums"]["shop_status"]
          tiktok: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city_id: number
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          followers_count?: number
          founder_rank?: number | null
          id?: string
          instagram?: string | null
          is_founder?: boolean
          location: unknown
          name: string
          owner_id: string
          posts_count?: number
          rating_avg?: number | null
          rating_count?: number
          slug: string
          snapchat?: string | null
          status?: Database["public"]["Enums"]["shop_status"]
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city_id?: number
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          followers_count?: number
          founder_rank?: number | null
          id?: string
          instagram?: string | null
          is_founder?: boolean
          location?: unknown
          name?: string
          owner_id?: string
          posts_count?: number
          rating_avg?: number | null
          rating_count?: number
          slug?: string
          snapchat?: string | null
          status?: Database["public"]["Enums"]["shop_status"]
          tiktok?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          city_id: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          city_id?: number | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_hook_add_claims: { Args: { event: Json }; Returns: Json }
      cancel_account_deletion: { Args: never; Returns: undefined }
      complete_profile: {
        Args: {
          p_avatar_url?: string
          p_city_id: number
          p_display_name: string
          p_username: string
        }
        Returns: undefined
      }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      open_shop: {
        Args: {
          p_bio?: string
          p_city_id?: number
          p_instagram?: string
          p_name: string
          p_snapchat?: string
          p_tiktok?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      request_account_deletion: { Args: never; Returns: undefined }
      get_my_profile: {
        Args: never
        Returns: {
          active_mode: Database["public"]["Enums"]["active_mode"]
          avatar_url: string | null
          city_id: number | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_admin: boolean
          is_moderator: boolean
          location: unknown
          moderation_scope:
            | Database["public"]["Enums"]["moderation_scope"]
            | null
          moderation_zone: string | null
          phone_verified: boolean
          referral_code: string
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          suspended_until: string | null
          terms_accepted_at: string | null
          updated_at: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_cities: {
        Args: { max_results?: number; q: string }
        Returns: {
          department: string
          id: number
          insee_code: string
          location: unknown
          name: string
          population: number | null
          postal_codes: string[]
          region: string | null
          slug: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cities"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_active_mode: {
        Args: { p_mode: Database["public"]["Enums"]["active_mode"] }
        Returns: undefined
      }
    }
    Enums: {
      active_mode: "client" | "seller"
      appeal_status: "none" | "appealed" | "upheld" | "overturned"
      boost_kind: "bump" | "featured_24h"
      boost_source: "paid" | "bizzplus_weekly"
      credit_source: "pack" | "referral" | "founder" | "admin" | "compensation"
      media_kind: "image" | "video"
      message_kind: "text" | "image" | "availability_request" | "system"
      moderation_action_kind:
        | "ignore"
        | "hide_post"
        | "unhide_post"
        | "remove_post"
        | "suspend_shop"
        | "unsuspend_shop"
        | "warn"
        | "delete_message"
      moderation_scope: "all" | "department" | "city"
      notification_kind:
        | "message"
        | "follow"
        | "like"
        | "availability_request"
        | "search_alert"
        | "moderation"
        | "referral"
        | "system"
      post_status: "available" | "reserved" | "sold" | "expired"
      post_type: "object" | "service" | "creation" | "rental"
      price_mode: "fixed" | "on_quote"
      purchase_kind: "pack" | "subscription" | "boost"
      report_reason:
        | "forbidden_item"
        | "counterfeit"
        | "scam"
        | "adult"
        | "harassment"
        | "spam"
        | "wrong_category"
        | "other"
      report_status: "open" | "handled"
      report_target: "post" | "shop" | "message" | "review"
      shop_status: "active" | "hidden" | "suspended"
      store: "app_store" | "play_store"
      subscription_status:
        | "active"
        | "grace_period"
        | "billing_issue"
        | "cancelled"
        | "expired"
      user_role: "client" | "seller"
      video_state: "uploading" | "processing" | "ready" | "errored"
      visibility: "visible" | "hidden_by_moderation" | "removed"
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

// Convenience aliases used across the app.
export type UserRole = Enums<"user_role">
export type ActiveMode = Enums<"active_mode">
export type ModerationScope = Enums<"moderation_scope">
export type Profile = Tables<"profiles">
export type PublicProfile = Tables<"public_profiles">
export type Shop = Tables<"shops">
export type City = Tables<"cities">
