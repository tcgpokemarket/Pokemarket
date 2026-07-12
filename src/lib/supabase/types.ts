export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          is_seller: boolean
          seller_rating: number
          total_sales: number
          referral_code: string | null
          referral_code_created_at: string | null
          referral_source: string | null
          referral_source_user_id: string | null
          referral_source_code: string | null
          referral_source_confirmed_at: string | null
          referral_locked_at: string | null
          verification_status: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'more_information_required' | 'suspended' | null
          verification_submitted_at: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_rejection_reason: string | null
          verification_more_info: string | null
          verification_suspension_reason: string | null
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_seller?: boolean
          seller_rating?: number
          total_sales?: number
          referral_code?: string | null
          referral_code_created_at?: string | null
          referral_source?: string | null
          referral_source_user_id?: string | null
          referral_source_code?: string | null
          referral_source_confirmed_at?: string | null
          referral_locked_at?: string | null
          verification_status?: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'more_information_required' | 'suspended' | null
          verification_submitted_at?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_rejection_reason?: string | null
          verification_more_info?: string | null
          verification_suspension_reason?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_seller?: boolean
          seller_rating?: number
          total_sales?: number
          referral_code?: string | null
          referral_code_created_at?: string | null
          referral_source?: string | null
          referral_source_user_id?: string | null
          referral_source_code?: string | null
          referral_source_confirmed_at?: string | null
          referral_locked_at?: string | null
          verification_status?: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'more_information_required' | 'suspended' | null
          verification_submitted_at?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_rejection_reason?: string | null
          verification_more_info?: string | null
          verification_suspension_reason?: string | null
          verified_at?: string | null
          created_at?: string
        }
      }
      listings: {
        Row: {
          id: string
          seller_id: string
          card_name: string
          set_name: string
          card_number: string | null
          rarity: string | null
          condition: 'Mint' | 'Near Mint' | 'Lightly Played' | 'Moderately Played' | 'Heavily Played' | 'Damaged'
          grade_company: 'PSA' | 'BGS' | 'CGC' | null
          grade_score: number | null
          price: number
          quantity: number
          images: string[]
          description: string | null
          category: 'single' | 'sealed' | 'graded' | 'accessory'
          status: 'active' | 'sold' | 'draft' | 'removed'
          shipping_profile_id: string | null
          shipping_paid_by: 'buyer' | 'seller' | null
          weight_oz: number | null
          package_type: string | null
          views: number


          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          card_name: string
          set_name: string
          card_number?: string | null
          rarity?: string | null
          condition: 'Mint' | 'Near Mint' | 'Lightly Played' | 'Moderately Played' | 'Heavily Played' | 'Damaged'
          grade_company?: 'PSA' | 'BGS' | 'CGC' | null
          grade_score?: number | null
          price: number
          quantity?: number
          images?: string[]
          description?: string | null
          category: 'single' | 'sealed' | 'graded' | 'accessory'
          shipping_profile_id?: string | null
          shipping_paid_by?: 'buyer' | 'seller' | null
          weight_oz?: number | null
          package_type?: string | null
          status?: 'active' | 'sold' | 'draft' | 'removed'
          views?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['listings']['Insert']>
      }
      orders: {
        Row: {
          id: string
          buyer_id: string
          seller_id: string
          listing_id: string
          quantity: number
          unit_price: number
          total_amount: number
          item_subtotal: number | null
          shipping_amount: number | null
          sales_tax_amount: number | null
          processing_fee_amount: number | null
          marketplace_fee_amount: number | null
          seller_payout_amount: number | null
          platform_revenue_amount: number | null
          marketplace_fee_percent: number | null
          seller_tier_name: string | null
          buyer_referral_source: string | null
          seller_referral_source: string | null
          creator_referral_source: string | null
          referral_commission_amount: number | null
          referral_commission_status: string | null
          referral_source_code: string | null
          referral_source_user_id: string | null
          referral_attribution_id: string | null
          status: 'pending' | 'paid' | 'escrow' | 'released' | 'frozen' | 'disputed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'completed'
          escrow_status: 'held' | 'released' | 'frozen' | 'disputed' | 'refunded' | null
          escrow_held_at: string | null
          escrow_release_at: string | null
          escrow_released_at: string | null
          escrow_frozen_at: string | null
          stripe_payment_intent_id: string | null
          stripe_checkout_session_id: string | null
          tracking_number: string | null
          shipping_carrier: string | null
          buyer_address: Json | null
          payout_status: 'pending' | 'held' | 'released' | 'paid' | 'failed' | 'frozen' | null
          completed_at: string | null
          first_transaction_at: string | null
          total_revenue_generated: number | null
          total_rewards_earned: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          seller_id: string
          listing_id: string
          quantity?: number
          unit_price: number
          total_amount: number
          item_subtotal?: number | null
          shipping_amount?: number | null
          sales_tax_amount?: number | null
          processing_fee_amount?: number | null
          marketplace_fee_amount?: number | null
          seller_payout_amount?: number | null
          platform_revenue_amount?: number | null
          marketplace_fee_percent?: number | null
          seller_tier_name?: string | null
          buyer_referral_source?: string | null
          seller_referral_source?: string | null
          creator_referral_source?: string | null
          referral_commission_amount?: number | null
          referral_commission_status?: string | null
          referral_source_code?: string | null
          referral_source_user_id?: string | null
          referral_attribution_id?: string | null
          status?: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'completed'
          stripe_payment_intent_id?: string | null
          stripe_checkout_session_id?: string | null
          tracking_number?: string | null
          shipping_carrier?: string | null
          buyer_address?: Json | null
          payout_status?: 'pending' | 'held' | 'released' | 'paid' | 'failed' | 'frozen' | null
          escrow_status?: 'held' | 'released' | 'frozen' | 'disputed' | 'refunded' | null
          escrow_held_at?: string | null
          escrow_release_at?: string | null
          escrow_released_at?: string | null
          escrow_frozen_at?: string | null
          completed_at?: string | null
          first_transaction_at?: string | null
          total_revenue_generated?: number | null
          total_rewards_earned?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      sellers: {
        Row: {
          id: string
          display_name: string
          storefront_slug: string
          bio: string | null
          avatar_url: string | null
          banner_url: string | null
          verified: boolean
          rating: number
          follower_count: number
          sales_count: number
          total_revenue: number
          total_listings: number
          total_live_shows: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          storefront_slug: string
          bio?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          verified?: boolean
          rating?: number
          follower_count?: number
          sales_count?: number
          total_revenue?: number
          total_listings?: number
          total_live_shows?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['sellers']['Insert']>
      }
      seller_stores: {
        Row: {
          id: string
          seller_id: string
          name: string
          slug: string
          description: string | null
          banner_url: string | null
          logo_url: string | null
          theme: Json
          verified: boolean
          featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          name: string
          slug: string
          description?: string | null
          banner_url?: string | null
          logo_url?: string | null
          theme?: Json
          verified?: boolean
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_stores']['Insert']>
      }
      seller_followers: {
        Row: {
          id: string
          seller_id: string
          follower_id: string
          created_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          follower_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_followers']['Insert']>
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['follows']['Insert']>
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['friendships']['Insert']>
      }
      blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['blocks']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          related_user: string | null
          related_content: Json | null
          read_status: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          related_user?: string | null
          related_content?: Json | null
          read_status?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      auction_orders: {
        Row: {
          id: string
          auction_id: string
          product_id: string
          buyer_id: string
          seller_id: string
          item_id: string | null
          winning_bid: number
          payment_status: 'payment_pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
          payment_deadline: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auction_id: string
          product_id: string
          buyer_id: string
          seller_id: string
          item_id?: string | null
          winning_bid: number
          payment_status?: 'payment_pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
          payment_deadline: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['auction_orders']['Insert']>
      }
      payment_events: {
        Row: {
          id: string
          order_id: string
          stripe_event_id: string
          status: string
          timestamp: string
        }
        Insert: {
          id?: string
          order_id: string
          stripe_event_id: string
          status: string
          timestamp?: string
        }
        Update: Partial<Database['public']['Tables']['payment_events']['Insert']>
      }
      profile_privacy_settings: {
        Row: {
          user_id: string
          who_can_follow: 'everyone' | 'followers_only' | 'no_one'
          who_can_friend_request: 'everyone' | 'followers_only' | 'no_one'
          profile_visibility: 'public' | 'followers_only' | 'friends_only' | 'private'
          collection_visibility: 'public' | 'followers_only' | 'friends_only' | 'private'
          activity_visibility: 'public' | 'followers_only' | 'friends_only' | 'private'
          message_visibility: 'everyone' | 'followers_only' | 'friends_only' | 'no_one'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          who_can_follow?: 'everyone' | 'followers_only' | 'no_one'
          who_can_friend_request?: 'everyone' | 'followers_only' | 'no_one'
          profile_visibility?: 'public' | 'followers_only' | 'friends_only' | 'private'
          collection_visibility?: 'public' | 'followers_only' | 'friends_only' | 'private'
          activity_visibility?: 'public' | 'followers_only' | 'friends_only' | 'private'
          message_visibility?: 'everyone' | 'followers_only' | 'friends_only' | 'no_one'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profile_privacy_settings']['Insert']>
      }
      seller_reviews: {
        Row: {
          id: string
          seller_id: string
          buyer_id: string
          order_id: string | null
          rating: number
          title: string | null
          body: string | null
          created_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          buyer_id: string
          order_id?: string | null
          rating: number
          title?: string | null
          body?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_reviews']['Insert']>
      }
      seller_wallets: {
        Row: {
          seller_id: string
          available_balance: number | null
          pending_balance: number | null
          frozen_balance: number | null
          lifetime_earnings: number | null
          completed_orders_count: number | null
          instant_payout_enabled: boolean | null
          next_payout_at: string | null
          fraud_flag: boolean | null
          fraud_risk_score: number | null
          fraud_risk_reason: string | null
          manual_review_required: boolean | null
          updated_at: string | null
        }
        Insert: {
          seller_id: string
          available_balance?: number | null
          pending_balance?: number | null
          frozen_balance?: number | null
          lifetime_earnings?: number | null
          completed_orders_count?: number | null
          instant_payout_enabled?: boolean | null
          next_payout_at?: string | null
          fraud_flag?: boolean | null
          fraud_risk_score?: number | null
          fraud_risk_reason?: string | null
          manual_review_required?: boolean | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['seller_wallets']['Insert']>
      }
      rewards_program_settings: {
        Row: {
          id: string
          signup_bonus_points: number
          daily_login_bonus_points: number
          purchase_points_per_dollar: number
          seller_sale_points_per_dollar: number
          live_bid_points_per_bid: number
          referral_points_per_successful_referral: number
          referral_purchase_bonus_points: number
          admin_bonus_points_per_action: number
          points_to_wallet_credit_rate: number
          minimum_redemption_points: number
          point_expiry_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          signup_bonus_points?: number
          daily_login_bonus_points?: number
          purchase_points_per_dollar?: number
          seller_sale_points_per_dollar?: number
          live_bid_points_per_bid?: number
          referral_points_per_successful_referral?: number
          referral_purchase_bonus_points?: number
          admin_bonus_points_per_action?: number
          points_to_wallet_credit_rate?: number
          minimum_redemption_points?: number
          point_expiry_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rewards_program_settings']['Insert']>
      }
      rewards_accounts: {
        Row: {
          user_id: string
          available_points: number
          pending_points: number
          redeemed_points: number
          lifetime_points: number
          last_login_bonus_at: string | null
          points_expire_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          user_id: string
          available_points?: number
          pending_points?: number
          redeemed_points?: number
          lifetime_points?: number
          last_login_bonus_at?: string | null
          points_expire_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rewards_accounts']['Insert']>
      }
      rewards_ledger: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          live_show_id: string | null
          referral_attribution_id: string | null
          redemption_id: string | null
          entry_type: 'signup_bonus' | 'daily_login' | 'purchase' | 'seller_sale' | 'live_bid' | 'referral_reward' | 'referral_purchase_bonus' | 'admin_bonus' | 'redemption' | 'expiration_adjustment' | 'manual_adjustment'
          status: 'pending' | 'posted' | 'held' | 'failed' | 'reversed'
          points: number
          balance_after: number
          expires_at: string | null
          metadata: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id?: string | null
          live_show_id?: string | null
          referral_attribution_id?: string | null
          redemption_id?: string | null
          entry_type: 'signup_bonus' | 'daily_login' | 'purchase' | 'seller_sale' | 'live_bid' | 'referral_reward' | 'referral_purchase_bonus' | 'admin_bonus' | 'redemption' | 'expiration_adjustment' | 'manual_adjustment'
          status?: 'pending' | 'posted' | 'held' | 'failed' | 'reversed'
          points: number
          balance_after: number
          expires_at?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['rewards_ledger']['Insert']>
      }
      rewards_redemption_options: {
        Row: {
          id: string
          option_key: string
          display_name: string
          redemption_type: 'wallet_credit' | 'coupon' | 'discount'
          points_cost: number
          credit_amount: number | null
          active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          option_key: string
          display_name: string
          redemption_type: 'wallet_credit' | 'coupon' | 'discount'
          points_cost: number
          credit_amount?: number | null
          active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rewards_redemption_options']['Insert']>
      }
      rewards_redemptions: {
        Row: {
          id: string
          user_id: string
          option_id: string | null
          points_spent: number
          status: 'requested' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled'
          fulfillment_reference: string | null
          fulfillment_payload: Json
          created_at: string
          updated_at: string
          fulfilled_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          option_id?: string | null
          points_spent: number
          status?: 'requested' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled'
          fulfillment_reference?: string | null
          fulfillment_payload?: Json
          created_at?: string
          updated_at?: string
          fulfilled_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['rewards_redemptions']['Insert']>
      }
      referral_program_settings: {
        Row: {
          id: string
          buyer_reward_credit: number
          buyer_first_purchase_threshold: number
          buyer_credit_expiry_days: number
          buyer_reward_fee_share_percent: number
          buyer_reward_max_payout: number
          seller_reward_fee_share_percent: number
          seller_reward_max_payout: number
          creator_tier1_fee_share_percent: number
          creator_tier1_duration_days: number
          creator_tier1_max_payout: number
          creator_tier2_fee_share_percent: number
          creator_tier2_duration_days: number
          min_profit_margin_percent: number
          referral_hold_days: number
          minimum_withdrawal_amount: number
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          buyer_reward_credit?: number
          buyer_first_purchase_threshold?: number
          buyer_credit_expiry_days?: number
          buyer_reward_fee_share_percent?: number
          buyer_reward_max_payout?: number
          seller_reward_fee_share_percent?: number
          seller_reward_max_payout?: number
          creator_tier1_fee_share_percent?: number
          creator_tier1_duration_days?: number
          creator_tier1_max_payout?: number
          creator_tier2_fee_share_percent?: number
          creator_tier2_duration_days?: number
          min_profit_margin_percent?: number
          referral_hold_days?: number
          minimum_withdrawal_amount?: number
          updated_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['referral_program_settings']['Insert']>
      }
      referral_programs: {
        Row: {
          id: string
          code: string
          owner_user_id: string | null
          program_type: 'buyer' | 'seller' | 'creator' | 'tiered'
          tier_name: string | null
          active: boolean
          approved: boolean
          commission_rate: number
          max_payout: number | null
          starts_at: string | null
          ends_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          owner_user_id?: string | null
          program_type: 'buyer' | 'seller' | 'creator' | 'tiered'
          tier_name?: string | null
          active?: boolean
          approved?: boolean
          commission_rate?: number
          max_payout?: number | null
          starts_at?: string | null
          ends_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['referral_programs']['Insert']>
      }
      referral_attributions: {
        Row: {
          id: string
          referred_user_id: string
          referrer_user_id: string
          order_id: string | null
          referral_program_id: string | null
          program_type: 'buyer' | 'seller' | 'creator' | 'tiered'
          fee_basis: number
          reward_rate: number
          reward_amount: number
          company_kept_amount: number
          hold_until: string | null
          status: 'pending' | 'held' | 'available' | 'paid' | 'rejected' | 'adjusted'
          fraud_flag: boolean
          fraud_reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          referred_user_id: string
          referrer_user_id: string
          order_id?: string | null
          referral_program_id?: string | null
          program_type: 'buyer' | 'seller' | 'creator' | 'tiered'
          fee_basis?: number
          reward_rate?: number
          reward_amount?: number
          company_kept_amount?: number
          hold_until?: string | null
          status?: 'pending' | 'held' | 'available' | 'paid' | 'rejected' | 'adjusted'
          fraud_flag?: boolean
          fraud_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['referral_attributions']['Insert']>
      }
      shipments: {
        Row: {
          id: string
          order_id: string
          shipment_group_id: string | null
          status: string
          tracking_number: string | null
          carrier: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          shipment_group_id?: string | null
          status: string
          tracking_number?: string | null
          carrier?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['shipments']['Insert']>
      }
      shipment_groups: {
        Row: {
          id: string
          buyer_id: string
          seller_id: string
          status: string
          total_weight: number | null
          total_length: number | null
          total_width: number | null
          total_height: number | null
          package_type: string | null
          tracking_number: string | null
          shipping_carrier: string | null
          label_url: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          buyer_id: string
          seller_id: string
          status: string
          total_weight?: number | null
          total_length?: number | null
          total_width?: number | null
          total_height?: number | null
          package_type?: string | null
          tracking_number?: string | null
          shipping_carrier?: string | null
          label_url?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['shipment_groups']['Insert']>
      }
      seller_verifications: {
        Row: {
          id: string
          user_id: string
          legal_name: string
          date_of_birth: string
          residential_address: string
          phone_number: string
          status: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'more_information_required' | 'suspended'
          submitted_at: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          rejection_reason: string | null
          more_information_request: string | null
          suspension_reason: string | null
          admin_notes: string | null
          verified_at: string | null
          updated_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          legal_name: string
          date_of_birth: string
          residential_address: string
          phone_number: string
          status?: 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'more_information_required' | 'suspended'
          submitted_at?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          rejection_reason?: string | null
          more_information_request?: string | null
          suspension_reason?: string | null
          admin_notes?: string | null
          verified_at?: string | null
          updated_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_verifications']['Insert']>
      }
      seller_verification_documents: {
        Row: {
          id: string
          verification_id: string
          user_id: string
          document_type: 'id_front' | 'id_back' | 'selfie_with_id' | 'proof_of_address'
          storage_bucket: string
          storage_path: string
          mime_type: string | null
          file_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          verification_id: string
          user_id: string
          document_type: 'id_front' | 'id_back' | 'selfie_with_id' | 'proof_of_address'
          storage_bucket?: string
          storage_path: string
          mime_type?: string | null
          file_name?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_verification_documents']['Insert']>
      }
      seller_verification_history: {
        Row: {
          id: string
          verification_id: string
          actor_id: string | null
          action: string
          previous_status: string | null
          next_status: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          verification_id: string
          actor_id?: string | null
          action: string
          previous_status?: string | null
          next_status?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['seller_verification_history']['Insert']>
      }
      live_shows: {
        Row: {
          id: string
          seller_id: string
          title: string
          description: string | null
          thumbnail: string | null
          status: string
          auction_state: string | null
          scheduled_start: string | null
          scheduled_end: string | null
          viewer_count: number
          peak_viewers: number
          total_sales_amount: number
          total_bidders: number
          average_bid_value: number
          engagement_score: number
          host_permissions: string[] | null
          auction_settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          title: string
          description?: string | null
          thumbnail?: string | null
          status: string
          auction_state?: string | null
          scheduled_start?: string | null
          scheduled_end?: string | null
          viewer_count?: number
          peak_viewers?: number
          total_sales_amount?: number
          total_bidders?: number
          average_bid_value?: number
          engagement_score?: number
          host_permissions?: string[] | null
          auction_settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['live_shows']['Insert']>
      }
      show_products: {
        Row: {
          id: string
          show_id: string
          listing_id: string | null
          title: string
          subtitle: string | null
          image_url: string | null
          start_price: number
          buy_now_price: number | null
          current_bid: number
          bid_count: number
          auction_seconds: number
          seconds_left: number
          pinned: boolean
          sold: boolean
          passed: boolean
          winner_id: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          listing_id?: string | null
          title: string
          subtitle?: string | null
          image_url?: string | null
          start_price: number
          buy_now_price?: number | null
          current_bid?: number
          bid_count?: number
          auction_seconds?: number
          seconds_left?: number
          pinned?: boolean
          sold?: boolean
          passed?: boolean
          winner_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['show_products']['Insert']>
      }
      live_bids: {
        Row: {
          id: string
          show_id: string
          product_id: string
          bidder_id: string
          amount: number
          is_auto_bid: boolean
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          product_id: string
          bidder_id: string
          amount: number
          is_auto_bid?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['live_bids']['Insert']>
      }
      show_bid_preferences: {
        Row: {
          id: string
          show_id: string
          product_id: string
          user_id: string
          max_bid: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          product_id: string
          user_id: string
          max_bid: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['show_bid_preferences']['Insert']>
      }
      live_chat: {
        Row: {
          id: string
          show_id: string
          user_id: string
          username: string
          message: string
          role: string
          highlighted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          user_id: string
          username: string
          message: string
          role?: string
          highlighted?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['live_chat']['Insert']>
      }
      viewers: {
        Row: {
          id: string
          show_id: string
          user_id: string
          joined_at: string
          last_seen_at: string
          active: boolean
        }
        Insert: {
          id?: string
          show_id: string
          user_id: string
          joined_at?: string
          last_seen_at?: string
          active?: boolean
        }
        Update: Partial<Database['public']['Tables']['viewers']['Insert']>
      }
      giveaways: {
        Row: {
          id: string
          show_id: string
          seller_id: string | null
          title: string
          prize_type: string
          prize_name: string
          prize_image: string | null
          prize_quantity: number
          winner_count: number
          start_at: string
          end_at: string
          eligibility: string[]
          follow_required: boolean
          location_restrictions: string[]
          age_restriction: number | null
          eligible_users: number
          claimed_winners: number
          live_entries: number
          total_entries: number
          estimated_item_value: number
          platform_processing_fee: number
          shipping_cost: number
          seller_budget: number
          seller_pays_all_fees: boolean
          status: string
          winner_ids: string[]
          fraud_flags: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          seller_id?: string | null
          title: string
          prize_type: string
          prize_name: string
          prize_image?: string | null
          prize_quantity: number
          winner_count: number
          start_at: string
          end_at: string
          eligibility: string[]
          follow_required?: boolean
          location_restrictions?: string[]
          age_restriction?: number | null
          eligible_users?: number
          claimed_winners?: number
          live_entries?: number
          total_entries?: number
          estimated_item_value?: number
          platform_processing_fee?: number
          shipping_cost?: number
          seller_budget?: number
          seller_pays_all_fees?: boolean
          status?: string
          winner_ids?: string[]
          fraud_flags?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['giveaways']['Insert']>
      }
      giveaway_entries: {
        Row: {
          id: string
          giveaway_id: string
          show_id: string
          seller_id: string
          user_id: string
          entry_status: string
          eligibility_status: Json
          following_seller: boolean
          winner_status: string
          qualified_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          giveaway_id: string
          show_id: string
          seller_id: string
          user_id: string
          entry_status?: string
          eligibility_status?: Json
          following_seller?: boolean
          winner_status?: string
          qualified_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['giveaway_entries']['Insert']>
      }
      giveaway_winners: {
        Row: {
          id: string
          giveaway_id: string
          entry_id: string
          user_id: string
          seller_id: string
          selected_at: string
          claimed_at: string | null
          claim_status: string
          audit_log: Json
        }
        Insert: {
          id?: string
          giveaway_id: string
          entry_id: string
          user_id: string
          seller_id: string
          selected_at?: string
          claimed_at?: string | null
          claim_status?: string
          audit_log?: Json
        }
        Update: Partial<Database['public']['Tables']['giveaway_winners']['Insert']>
      }
      giveaway_follow_actions: {
        Row: {
          id: string
          giveaway_id: string
          seller_id: string
          user_id: string
          followed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          giveaway_id: string
          seller_id: string
          user_id: string
          followed_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['giveaway_follow_actions']['Insert']>
      }
      giveaway_audit_logs: {
        Row: {
          id: string
          giveaway_id: string
          actor_id: string | null
          action: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          giveaway_id: string
          actor_id?: string | null
          action: string
          details?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['giveaway_audit_logs']['Insert']>
      }
      show_events: {
        Row: {
          id: string
          show_id: string
          event_type: string
          payload: Json | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          event_type: string
          payload?: Json | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['show_events']['Insert']>
      }
      seller_fee_settings: {
        Row: {
          id: string
          free_sales_limit: number
          standard_marketplace_fee_percent: number
          processing_fee_percent: number
          processing_fee_fixed: number
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          free_sales_limit?: number
          standard_marketplace_fee_percent?: number
          processing_fee_percent?: number
          processing_fee_fixed?: number
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['seller_fee_settings']['Insert']>
      }
      seller_fee_tiers: {
        Row: {
          id: string
          name: string
          min_monthly_orders: number
          fee_percent: number
          active: boolean | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          min_monthly_orders: number
          fee_percent: number
          active?: boolean | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['seller_fee_tiers']['Insert']>
      }
      seller_fee_overrides: {
        Row: {
          id: string
          seller_id: string
          fee_percent: number | null
          free_sales_limit: number | null
          reason: string | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          seller_id: string
          fee_percent?: number | null
          free_sales_limit?: number | null
          reason?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['seller_fee_overrides']['Insert']>
      }
      shipping_rules: {
        Row: {
          id: string
          weight_min: number
          weight_max: number | null
          package_type: string
          usps_service: string
          shipping_price: number
          tracking_required: boolean
          active_status: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          weight_min: number
          weight_max?: number | null
          package_type: string
          usps_service: string
          shipping_price?: number
          tracking_required?: boolean
          active_status?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['shipping_rules']['Insert']>
      }
      price_history: {
        Row: {
          id: string
          card_name: string
          set_name: string
          card_number: string | null
          condition: string | null
          price: number
          source: string
          recorded_at: string
        }
        Insert: {
          id?: string
          card_name: string
          set_name: string
          card_number?: string | null
          condition?: string | null
          price: number
          source: string
          recorded_at?: string
        }
        Update: Partial<Database['public']['Tables']['price_history']['Insert']>
      }
      card_library_items: {
        Row: {
          id: string
          user_id: string
          list_key: 'collection' | 'wishlist' | 'deck'
          card_id: string
          card_name: string
          set_name: string
          card_number: string | null
          rarity: string | null
          image_url: string | null
          price: number | null
          source: string
          added_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          list_key: 'collection' | 'wishlist' | 'deck'
          card_id: string
          card_name: string
          set_name: string
          card_number?: string | null
          rarity?: string | null
          image_url?: string | null
          price?: number | null
          source: string
          added_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['card_library_items']['Insert']>
      }
      legal_documents: {
        Row: {
          id: string
          slug: string
          title: string
          version: string
          jurisdiction: string | null
          content: string
          active: boolean
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          version: string
          jurisdiction?: string | null
          content: string
          active?: boolean
          updated_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['legal_documents']['Insert']>
      }
      legal_acceptances: {
        Row: {
          id: string
          user_id: string
          document_slug: string
          document_version: string
          accepted_at: string
          accepted_ip: string | null
          accepted_user_agent: string | null
          source: string
        }
        Insert: {
          id?: string
          user_id: string
          document_slug: string
          document_version: string
          accepted_at?: string
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          source: string
        }
        Update: Partial<Database['public']['Tables']['legal_acceptances']['Insert']>
      }
      ip_reports: {
        Row: {
          id: string
          reporter_id: string | null
          subject_type: string
          subject_id: string | null
          complaint_type: string
          details: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id?: string | null
          subject_type: string
          subject_id?: string | null
          complaint_type: string
          details: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ip_reports']['Insert']>
      }
      email_preferences: {
        Row: {
          id: string
          user_id: string
          notification_type: string
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['email_preferences']['Insert']>
      }
      email_templates: {
        Row: {
          id: string
          template_name: string
          subject: string
          content: string
          variables: Json
          category: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_name: string
          subject: string
          content: string
          variables?: Json
          category: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['email_templates']['Insert']>
      }
      email_logs: {
        Row: {
          id: string
          user_id: string | null
          email_type: string
          template_name: string | null
          recipient_email: string
          status: string
          provider_message_id: string | null
          error_message: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email_type: string
          template_name?: string | null
          recipient_email: string
          status: string
          provider_message_id?: string | null
          error_message?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['email_logs']['Insert']>
      }
      email_queue: {
        Row: {
          id: string
          user_id: string | null
          template_name: string
          recipient_email: string
          payload: Json
          status: 'queued' | 'processing' | 'sent' | 'failed' | 'canceled'
          attempts: number
          next_attempt_at: string
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          template_name: string
          recipient_email: string
          payload?: Json
          status?: 'queued' | 'processing' | 'sent' | 'failed' | 'canceled'
          attempts?: number
          next_attempt_at?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['email_queue']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          last_message_at: string | null
          last_message_preview: string | null
          context_type: string | null
          context_id: string | null
          is_archived: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          context_type?: string | null
          context_id?: string | null
          is_archived?: boolean
        }
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      conversation_members: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          role: string
          muted: boolean
          archived: boolean
          last_read_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          role?: string
          muted?: boolean
          archived?: boolean
          last_read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['conversation_members']['Insert']>
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          message: string
          attachment_url: string | null
          attachment_type: string | null
          context: Json
          read_status: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          message: string
          attachment_url?: string | null
          attachment_type?: string | null
          context?: Json
          read_status?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      message_recipients: {
        Row: {
          id: string
          message_id: string
          user_id: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          read_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['message_recipients']['Insert']>
      }
      message_reports: {
        Row: {
          id: string
          message_id: string
          reporter_id: string
          reason: string
          details: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          message_id: string
          reporter_id: string
          reason: string
          details?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['message_reports']['Insert']>
      }
      message_blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['message_blocks']['Insert']>
      }
      message_access_rules: {
        Row: {
          id: string
          user_id: string
          allow_followers: boolean
          allow_friends: boolean
          allow_sellers: boolean
          allow_buyer_support: boolean
          allow_admin_messages: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          allow_followers?: boolean
          allow_friends?: boolean
          allow_sellers?: boolean
          allow_buyer_support?: boolean
          allow_admin_messages?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['message_access_rules']['Insert']>
      }
      dispute_records: {
        Row: {
          id: string
          order_id: string | null
          user_id: string | null
          dispute_type: string
          status: string
          resolution: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          user_id?: string | null
          dispute_type: string
          status?: string
          resolution?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['dispute_records']['Insert']>
      }
      support_tickets: {
        Row: {
          id: string
          ticket_number: string
          user_id: string
          order_id: string | null
          listing_id: string | null
          seller_id: string | null
          conversation_id: string | null
          category: string
          priority: string
          status: string
          assigned_ai_agent: string | null
          assigned_human_agent: string | null
          issue_summary: string
          conversation_history: Json
          resolution_notes: string | null
          escalated_at: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ticket_number: string
          user_id: string
          order_id?: string | null
          listing_id?: string | null
          seller_id?: string | null
          conversation_id?: string | null
          category: string
          priority?: string
          status?: string
          assigned_ai_agent?: string | null
          assigned_human_agent?: string | null
          issue_summary: string
          conversation_history?: Json
          resolution_notes?: string | null
          escalated_at?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['support_tickets']['Insert']>
      }
      support_knowledge_sources: {
        Row: {
          id: string
          source_type: string
          source_name: string
          source_url: string | null
          content_summary: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_type: string
          source_name: string
          source_url?: string | null
          content_summary: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['support_knowledge_sources']['Insert']>
      }
      support_ai_responses: {
        Row: {
          id: string
          ticket_id: string
          assistant_role: string
          response_text: string
          policy_notes: string | null
          needs_human: boolean
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          assistant_role: string
          response_text: string
          policy_notes?: string | null
          needs_human?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['support_ai_responses']['Insert']>
      }
      support_ticket_events: {
        Row: {
          id: string
          ticket_id: string
          event_type: string
          event_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          event_type: string
          event_data?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['support_ticket_events']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Listing = Database['public']['Tables']['listings']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type SellerWallet = Database['public']['Tables']['seller_wallets']['Row']
export type PriceHistory = Database['public']['Tables']['price_history']['Row']
export type Shipment = Database['public']['Tables']['shipments']['Row']
export type ShipmentGroup = Database['public']['Tables']['shipment_groups']['Row']
export type LiveShow = Database['public']['Tables']['live_shows']['Row']
export type LiveShowItem = {
  id: string
  listing_id?: string | null
  title: string
  subtitle?: string | null
  image_url?: string | null
  start_price: number
  buy_now_price: number
  current_bid: number
  bid_count: number
  auction_seconds: number
  seconds_left: number
  pinned: boolean
  sold: boolean
  winner_id?: string | null
}
export type LiveShowMessage = {
  id: string
  username: string
  message: string
  role: string
  highlighted: boolean
  created_at: string
}
export type LiveShowBid = {
  id: string
  show_id: string
  item_id: string
  username: string
  amount: number
  created_at: string
}
