-- 0012_referral_profit_guard.sql
-- Hard profitability guard for referral rewards.
-- Referral rewards may only be funded from platform revenue after processing fees,
-- and the platform must retain the configured minimum margin.

CREATE OR REPLACE FUNCTION public.calculate_referral_reward(
  p_platform_revenue numeric,
  p_referrer_id uuid,
  p_referred_id uuid,
  p_processing_fee numeric DEFAULT 0
) RETURNS numeric AS $$
DECLARE
  settings record;
  monthly_paid numeric;
  annual_paid numeric;
  lifetime_paid_referrer numeric;
  lifetime_paid_referred numeric;
  reward numeric;
  max_safe_reward numeric;
  required_company_kept numeric;
BEGIN
  SELECT * INTO settings FROM public.referral_program_settings LIMIT 1;
  IF NOT FOUND OR NOT settings.enabled THEN RETURN 0; END IF;

  p_platform_revenue := GREATEST(COALESCE(p_platform_revenue, 0), 0);
  p_processing_fee := GREATEST(COALESCE(p_processing_fee, 0), 0);

  IF p_platform_revenue <= 0 THEN RETURN 0; END IF;

  -- The reward can never consume processing costs or the configured minimum margin.
  required_company_kept := p_platform_revenue * (COALESCE(settings.min_profit_margin_percent, 60) / 100.0);
  max_safe_reward := GREATEST(0, p_platform_revenue - p_processing_fee - required_company_kept);

  reward := LEAST(
    p_platform_revenue * (settings.reward_as_pct_of_platform_revenue / 100.0),
    settings.max_reward_per_referral,
    max_safe_reward
  );

  IF reward <= 0 THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(reward_amount), 0) INTO monthly_paid
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id
      AND status IN ('approved','paid')
      AND created_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(reward_amount), 0) INTO annual_paid
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id
      AND status IN ('approved','paid')
      AND created_at >= date_trunc('year', now());

  SELECT COALESCE(SUM(reward_amount), 0) INTO lifetime_paid_referrer
    FROM public.referral_rewards
    WHERE referrer_id = p_referrer_id AND status IN ('approved','paid');

  SELECT COALESCE(SUM(reward_amount), 0) INTO lifetime_paid_referred
    FROM public.referral_rewards
    WHERE referred_id = p_referred_id AND status IN ('approved','paid');

  reward := LEAST(reward, GREATEST(0, settings.max_monthly_rewards_per_referrer - monthly_paid));
  reward := LEAST(reward, GREATEST(0, settings.max_annual_rewards_per_referrer - annual_paid));
  reward := LEAST(reward, GREATEST(0, settings.max_lifetime_rewards_per_referrer - lifetime_paid_referrer));
  reward := LEAST(reward, GREATEST(0, settings.max_lifetime_rewards_per_referred - lifetime_paid_referred));

  RETURN ROUND(GREATEST(reward, 0), 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the settlement trigger so it passes processing costs into the guard.
CREATE OR REPLACE FUNCTION public.process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  attribution record;
  settings record;
  platform_fee numeric;
  processing_fee numeric;
  reward numeric;
  trigger_type_val text;
BEGIN
  IF NEW.escrow_status <> 'released' OR OLD.escrow_status = 'released' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO settings FROM public.referral_program_settings LIMIT 1;
  IF NOT FOUND OR NOT settings.enabled THEN RETURN NEW; END IF;

  SELECT * INTO attribution
    FROM public.referral_attributions
    WHERE referred_user_id = NEW.buyer_id
      AND status NOT IN ('revoked','expired')
    ORDER BY created_at ASC
    LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF attribution.referrer_user_id = NEW.buyer_id OR
     attribution.referrer_user_id = NEW.seller_id THEN
    RETURN NEW;
  END IF;

  platform_fee := COALESCE(NEW.marketplace_fee_amount, 0);
  processing_fee := COALESCE(NEW.processing_fee_amount, 0);
  IF platform_fee <= 0 THEN RETURN NEW; END IF;

  trigger_type_val := 'first_purchase';

  reward := public.calculate_referral_reward(
    platform_fee,
    attribution.referrer_user_id,
    NEW.buyer_id,
    processing_fee
  );

  IF reward <= 0 THEN RETURN NEW; END IF;

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

  UPDATE public.referral_attributions
    SET total_revenue_generated = total_revenue_generated + COALESCE(NEW.total_amount, 0),
        total_rewards_earned = total_rewards_earned + reward,
        status = CASE WHEN status = 'held' THEN 'qualified' ELSE status END,
        updated_at = now()
    WHERE id = attribution.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Defense-in-depth: no referral reward row may exceed the platform revenue
-- recorded for that row or consume more than the platform can retain.
ALTER TABLE public.referral_rewards
  DROP CONSTRAINT IF EXISTS referral_reward_profit_guard;

ALTER TABLE public.referral_rewards
  ADD CONSTRAINT referral_reward_profit_guard
  CHECK (reward_amount >= 0 AND reward_amount <= platform_revenue);

COMMENT ON CONSTRAINT referral_reward_profit_guard ON public.referral_rewards IS
  'Referral rewards cannot exceed recorded platform revenue; settlement function additionally reserves processing costs and minimum margin.';
