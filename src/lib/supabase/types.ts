export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          username: string | null
          avatar_url: string | null
          bio: string | null
          seller_rating: number | null
          seller_reviews_count: number | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          seller_rating?: number | null
          seller_reviews_count?: number | null
        }
        Update: {
          id?: string
          updated_at?: string
          email?: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          seller_rating?: number | null
          seller_reviews_count?: number | null
        }
      }
      listings: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          seller_id: string
          title: string
          description: string | null
          price: number
          image_url: string | null
          card_name: string | null
          set_name: string | null
          condition: 'mint' | 'near-mint' | 'lightly-played' | 'moderately-played' | 'heavily-played' | null
          quantity: number
          sold_count: number
          status: 'active' | 'sold' | 'archived'
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          seller_id: string
          title: string
          description?: string | null
          price: number
          image_url?: string | null
          card_name?: string | null
          set_name?: string | null
          condition?: 'mint' | 'near-mint' | 'lightly-played' | 'moderately-played' | 'heavily-played' | null
          quantity?: number
          sold_count?: number
          status?: 'active' | 'sold' | 'archived'
        }
        Update: {
          id?: string
          updated_at?: string
          title?: string
          description?: string | null
          price?: number
          image_url?: string | null
          card_name?: string | null
          set_name?: string | null
          condition?: 'mint' | 'near-mint' | 'lightly-played' | 'moderately-played' | 'heavily-played' | null
          quantity?: number
          sold_count?: number
          status?: 'active' | 'sold' | 'archived'
        }
      }
      leads: {
        Row: {
          id: string
          created_at: string
          email: string
          status: 'new' | 'contacted' | 'converted'
        }
        Insert: {
          id?: string
          created_at?: string
          email: string
          status?: 'new' | 'contacted' | 'converted'
        }
        Update: {
          id?: string
          email?: string
          status?: 'new' | 'contacted' | 'converted'
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
