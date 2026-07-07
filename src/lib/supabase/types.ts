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
          shipping_paid_by: 'buyer' | 'seller' | null
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
          status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'completed'
          stripe_payment_intent_id: string | null
          stripe_checkout_session_id: string | null
          tracking_number: string | null
          shipping_carrier: string | null
          buyer_address: Json | null
          payout_status: 'pending' | 'paid' | 'failed' | null
          completed_at: string | null
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
          status?: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'completed'
          stripe_payment_intent_id?: string | null
          stripe_checkout_session_id?: string | null
          tracking_number?: string | null
          shipping_carrier?: string | null
          buyer_address?: Json | null
          payout_status?: 'pending' | 'paid' | 'failed' | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      seller_wallets: {
        Row: {
          seller_id: string
          available_balance: number | null
          pending_balance: number | null
          lifetime_earnings: number | null
          completed_orders_count: number | null
          instant_payout_enabled: boolean | null
          next_payout_at: string | null
          fraud_flag: boolean | null
          updated_at: string | null
        }
        Insert: {
          seller_id: string
          available_balance?: number | null
          pending_balance?: number | null
          lifetime_earnings?: number | null
          completed_orders_count?: number | null
          instant_payout_enabled?: boolean | null
          next_payout_at?: string | null
          fraud_flag?: boolean | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['seller_wallets']['Insert']>
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
      live_shows: {
        Row: {
          id: string
          seller_id: string
          title: string
          status: string
          auction_state: string | null
          viewer_count: number
          peak_viewers: number
          total_sales_amount: number
          total_bidders: number
          average_bid_value: number
          engagement_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          title: string
          status: string
          auction_state?: string | null
          viewer_count?: number
          peak_viewers?: number
          total_sales_amount?: number
          total_bidders?: number
          average_bid_value?: number
          engagement_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['live_shows']['Insert']>
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
