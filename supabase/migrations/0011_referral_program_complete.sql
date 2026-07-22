-- ============================================================
-- 0011_referral_program_complete.sql
-- Complete referral program: rewards, fraud flags, functions,
-- triggers, views, RLS, indexes, and seed data.
-- Fully idempotent — safe to re-run on any db state.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- referral_program_settings: add missing production columns
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.referral_program_settings
  ADD COLUMN IF NOT EXISTS reward_per_referral numeric(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS min_order_amount numeric(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS max_reward_per_referral numeric(10,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS max_lifetime_rewards_per_referrer numeric(10,2) NOT NULL DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS max_monthly_rewards_per_referrer numeric(10,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS max_annual_rewards_per_referrer numeric(10,2) NOT NULL DEFAULT 1000.00,
  ADD COLUMN IF NOT EXISTS max_lifetime_rewards_per_referred numeric(10,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS payout_delay_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS reward_as_pct_of_platform_revenue numeric(5,2) NOT NULL DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ──────────────────────────────────────────────────────────────
-- referral_attributions: add status values needed for new flow
-- ──────────────────────────────────────────────────────────────
-- The existing check constraint uses ('pending','held','available','paid','rejected','adjusted')
-- We extend with 'qualified', 'revoked', 'expired' using ALTER ... DROP CONSTRAINT + re-add.
DO $$
BEGIN
  -- Drop old constraint if it exists (any name)
  EXECUTE (
    SELECT 'ALTER TABLE public.referral_attributions DROP CONSTRAINT ' || quote_ident(constraint_name)
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'referral_attributions'
      AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%status%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.referral_attributions
    ADD CONSTRAINT referral_attributions_status_check
    CHECK (status IN ('pending','held','available','paid','rejected','adjusted','qualified','revoked','expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────
-- referral_rewards: individual reward payout rows
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_attribution_id uuid REFERENCES public.referral_attributions(id) ON DELETE CASCADE NOT NULL,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('first_purchase','sale','purchase')),
  gross_transaction_amount numeric(10,2) NOT NULL DEFAULT 0,
  platform_revenue numeric(10,2) NOT NULL DEFAULT 0,
  reward_amount numeric(10,2) NOT NULL DEFAULT 0,
  reward_type text NOT NULL DEFAULT 'cash' CHECK (reward_type IN ('cash','credit','points')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','denied','revoked','expired')),
  fraud_score integer NOT NULL DEFAULT 0,
  fraud_flags jsonb,
  approved_at timestamptz,
  paid_at timestamptz,
  denied_at timestamptz,
  denial_reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (order_id, referrer_id)
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- referral_rewards RLS
DO $$ BEGIN
  CREATE POLICY "referral_rewards_select_own" ON public.referral_rewards
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_rewards_insert_service" ON public.referral_rewards
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_rewards_update_service" ON public.referral_rewards
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- referral_fraud_flags: suspicious activity log
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referral_fraud_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flagged_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribution_id uuid REFERENCES public.referral_attributions(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  details jsonb,
  reviewed boolean DEFAULT false,
  reviewer_id uuid REFERENCES public.profiles(id),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referral_fraud_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "referral_fraud_flags_insert" ON public.referral_fraud_flags
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_fraud_flags_select_service" ON public.referral_fraud_flags
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "referral_fraud_flags_update_service" ON public.referral_fraud_flags
    FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- calculate_referral_reward function
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_referral_reward(
  p_platform_revenue numeric,
  p_referrer_id uuid,
  p_referred_id uuid
) RETURNS numeric AS $$
DECLARE
  settings record;
  monthly_paid numeric;
  annual_paid numeric;
  lifetime_paid_referrer numeric;
  lifetime_paid_referred numeric;
  reward numeric;
BEGIN
  SELECT * INTO settings FROM public.referral_program_settings LIMIT 1;
  IF NOT FOUND OR NOT settings.enabled THEN RETURN 0; END IF;

  -- Reward = pct of platform revenue, capped at max_reward_per_referral
  reward := LEAST(
    p_platform_revenue * (settings.reward_as_pct_of_platform_revenue / 100.0),
    settings.max_reward_per_referral
  );
  IF reward <= 0 THEN RETURN 0; END IF;

  -- Monthly cap check
  SELECT COALESCE(SUM(reward_amount), 0) INTO monthly_paid
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id
      AND status IN ('approved','paid')
      AND created_at >= date_trunc('month', now());

  -- Annual cap check
  SELECT COALESCE(SUM(reward_amount), 0) INTO annual_paid
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id
      AND status IN ('approved','paid')
      AND created_at >= date_trunc('year', now());

  -- Lifetime referrer cap
  SELECT COALESCE(SUM(reward_amount), 0) INTO lifetime_paid_referrer
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id AND status IN ('approved','paid');

  -- Lifetime referred cap
  SELECT COALESCE(SUM(reward_amount), 0) INTO lifetime_paid_referred
    FROM public.referral_rewards
    WHERE referred_id = p_referred_id AND status IN ('approved','paid');

  IF monthly_paid + reward > settings.max_monthly_rewards_per_referrer THEN
    reward := GREATEST(0, settings.max_monthly_rewards_per_referrer - monthly_paid);
  END IF;
  IF annual_paid + reward > settings.max_annual_rewards_per_referrer THEN
    reward := GREATEST(0, settings.max_annual_rewards_per_referrer - annual_paid);
  END IF;
  IF lifetime_paid_referrer + reward > settings.max_lifetime_rewards_per_referrer THEN
    reward := GREATEST(0, settings.max_lifetime_rewards_per_referrer - lifetime_paid_referrer);
  END IF;
  IF lifetime_paid_referred + reward > settings.max_lifetime_rewards_per_referred THEN
    reward := GREATEST(0, settings.max_lifetime_rewards_per_referred - lifetime_paid_referred);
  END IF;

  RETURN ROUND(reward, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- process_referral_reward trigger function
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  attribution record;
  settings record;
  platform_fee numeric;
  reward numeric;
  trigger_type_val text;
BEGIN
  -- Only fire when escrow transitions TO released
  IF NEW.escrow_status <> 'released' OR OLD.escrow_status = 'released' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO settings FROM public.referral_program_settings LIMIT 1;
  IF NOT FOUND OR NOT settings.enabled THEN RETURN NEW; END IF;

  -- Find referral attribution for this buyer
  SELECT * INTO attribution
    FROM public.referral_attributions
    WHERE referred_user_id = NEW.buyer_id
      AND status NOT IN ('revoked','expired')
    LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Self-referral guard
  IF attribution.referrer_user_id = NEW.buyer_id OR
     attribution.referrer_user_id = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  platform_fee := COALESCE(NEW.marketplace_fee_amount, 0);
  IF platform_fee <= 0 THEN RETURN NEW; END IF;

  trigger_type_val := 'first_purchase';

  reward := public.calculate_referral_reward(
    platform_fee,
    attribution.referrer_user_id,
    NEW.buyer_id
  );

  IF reward <= 0 THEN RETURN NEW; END IF;

  -- Idempotent insert — ON CONFLICT skips duplicate
  INSERT INTO public.referral_rewards (
    referral_attribution_id, referrer_id, referred_id, order_id,
    trigger_type, gross_transaction_amount, platform_revenue, reward_amount,
    reward_type, status, expires_at
  ) VALUES (
    attribution.id,
    attribution.referrer_user_id,
    NEW.buyer_id,
    NEW.id,
    trigger_type_val,
    COALESCE(NEW.total_amount, 0),
    platform_fee,
    reward,
    'cash',
    'pending',
    now() + (settings.payout_delay_days || ' days')::interval
  )
  ON CONFLICT (order_id, referrer_id) DO NOTHING;

  -- Update attribution stats
  UPDATE public.referral_attributions
    SET total_revenue_generated = total_revenue_generated + COALESCE(NEW.total_amount, 0),
        total_rewards_earned = total_rewards_earned + reward,
        status = CASE WHEN status = 'held' THEN 'qualified' ELSE status END,
        updated_at = now()
    WHERE id = attribution.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- revoke_referral_reward trigger function
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_referral_reward()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status IN ('refunded','disputed','cancelled') AND
      OLD.status NOT IN ('refunded','disputed','cancelled')) THEN
    UPDATE public.referral_rewards
      SET status = 'revoked', updated_at = now()
      WHERE order_id = NEW.id AND status IN ('pending','approved');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────────
-- Triggers on orders
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS process_referral_reward_on_order ON public.orders;
CREATE TRIGGER process_referral_reward_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.process_referral_reward();

DROP TRIGGER IF EXISTS revoke_referral_reward_on_order ON public.orders;
CREATE TRIGGER revoke_referral_reward_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.revoke_referral_reward();

-- ──────────────────────────────────────────────────────────────
-- updated_at trigger for referral_rewards
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS referral_rewards_updated_at ON public.referral_rewards;
CREATE TRIGGER referral_rewards_updated_at
  BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────
-- referral_dashboard_stats view
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.referral_dashboard_stats AS
SELECT
  r.referrer_user_id AS referrer_id,
  COUNT(DISTINCT r.id) AS total_referrals,
  COUNT(DISTINCT CASE WHEN r.status = 'qualified' THEN r.id END) AS qualified_referrals,
  COALESCE(SUM(rw.reward_amount) FILTER (WHERE rw.status = 'pending'), 0) AS pending_rewards,
  COALESCE(SUM(rw.reward_amount) FILTER (WHERE rw.status = 'paid'), 0) AS paid_rewards,
  COALESCE(SUM(rw.reward_amount) FILTER (WHERE rw.status IN ('approved','paid')), 0) AS approved_rewards,
  COALESCE(SUM(rw.reward_amount) FILTER (WHERE rw.status IN ('approved','paid','pending')), 0) AS lifetime_earnings
FROM public.referral_attributions r
LEFT JOIN public.referral_rewards rw ON rw.referral_attribution_id = r.id
GROUP BY r.referrer_user_id;

-- ──────────────────────────────────────────────────────────────
-- Seed default referral_program_settings (idempotent)
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.referral_program_settings (
  id, reward_per_referral, reward_type, min_order_amount,
  max_reward_per_referral, max_lifetime_rewards_per_referrer,
  max_monthly_rewards_per_referrer, max_annual_rewards_per_referrer,
  max_lifetime_rewards_per_referred, payout_delay_days,
  reward_as_pct_of_platform_revenue, enabled
) VALUES (
  gen_random_uuid(), 5.00, 'cash', 10.00,
  25.00, 500.00, 100.00, 1000.00, 50.00, 14, 30.00, true
)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- Performance indexes
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS referral_rewards_referrer_id_idx ON public.referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS referral_rewards_referred_id_idx ON public.referral_rewards(referred_id);
CREATE INDEX IF NOT EXISTS referral_rewards_status_idx ON public.referral_rewards(status);
CREATE INDEX IF NOT EXISTS referral_rewards_order_id_idx ON public.referral_rewards(order_id);
CREATE INDEX IF NOT EXISTS referral_rewards_created_at_idx ON public.referral_rewards(created_at DESC);
CREATE INDEX IF NOT EXISTS referral_rewards_attribution_id_idx ON public.referral_rewards(referral_attribution_id);
CREATE INDEX IF NOT EXISTS referral_fraud_flags_flagged_user_idx ON public.referral_fraud_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS referral_fraud_flags_reviewed_idx ON public.referral_fraud_flags(reviewed);
CREATE INDEX IF NOT EXISTS referral_fraud_flags_referrer_id_idx ON public.referral_fraud_flags(referrer_id);
