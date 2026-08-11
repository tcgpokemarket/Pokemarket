-- Poké Rips: complete database schema
-- Run this migration against the Supabase project before deploying.

-- ============================================================
-- PACK CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_packs (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    text        NOT NULL,
  description             text,
  cover_image_url         text,
  category                text        NOT NULL DEFAULT 'pokemon',
  tcg_name                text        NOT NULL DEFAULT 'Pokemon',
  language                text        NOT NULL DEFAULT 'en',
  status                  text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','active','paused','archived')),
  price                   numeric(10,2) NOT NULL,
  inventory_count         integer     NOT NULL DEFAULT 0,
  available_quantity      integer     NOT NULL DEFAULT 0,
  min_value               numeric(10,2),
  max_advertised_value    numeric(10,2),
  expected_value          numeric(10,2),
  chase_cards             jsonb       NOT NULL DEFAULT '[]',
  rarity_distribution     jsonb       NOT NULL DEFAULT '{}',
  eligibility_rules       jsonb       NOT NULL DEFAULT '{}',
  jurisdiction_availability jsonb     NOT NULL DEFAULT '{}',
  starts_at               timestamptz,
  ends_at                 timestamptz,
  is_promotional          boolean     NOT NULL DEFAULT false,
  max_per_user            integer,
  active_version_id       uuid,
  sort_order              integer     NOT NULL DEFAULT 0,
  created_by              uuid        REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PACK VERSIONS (immutable snapshots — never alter after activation)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_pack_versions (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id                 uuid        REFERENCES rip_packs(id) ON DELETE RESTRICT NOT NULL,
  version_number          integer     NOT NULL,
  configuration_hash      text        NOT NULL,
  rarity_distribution     jsonb       NOT NULL DEFAULT '{}',
  price                   numeric(10,2) NOT NULL,
  eligibility_rules       jsonb       NOT NULL DEFAULT '{}',
  jurisdiction_availability jsonb     NOT NULL DEFAULT '{}',
  notes                   text,
  created_by              uuid        REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  activated_at            timestamptz,
  deactivated_at          timestamptz,
  UNIQUE (pack_id, version_number)
);

-- Forward-reference: update rip_packs.active_version_id FK after version table exists
ALTER TABLE rip_packs
  ADD CONSTRAINT rip_packs_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES rip_pack_versions(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- PHYSICAL INVENTORY (one row per physical card available for ripping)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_physical_inventory (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id                 uuid        REFERENCES rip_packs(id) ON DELETE RESTRICT NOT NULL,
  pack_version_id         uuid        REFERENCES rip_pack_versions(id) ON DELETE RESTRICT,
  card_id                 text,                       -- external API id (Pokémon TCG API)
  card_name               text        NOT NULL,
  set_name                text,
  set_id                  text,
  card_number             text,
  rarity                  text,
  language                text        NOT NULL DEFAULT 'en',
  condition               text        NOT NULL DEFAULT 'NM',
  grade                   text,
  grade_company           text,
  certification_number    text,
  image_url               text,
  market_value            numeric(10,2),
  acquisition_cost        numeric(10,2),
  warehouse_location      text,
  notes                   text,
  inventory_status        text        NOT NULL DEFAULT 'available'
                            CHECK (inventory_status IN ('available','allocated','shipped','returned','destroyed')),
  ownership_status        text        NOT NULL DEFAULT 'platform'
                            CHECK (ownership_status IN ('platform','user_vault','user_shipping','sold','returned')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rip_physical_inventory_pack_available
  ON rip_physical_inventory (pack_id, pack_version_id, inventory_status)
  WHERE inventory_status = 'available';

-- ============================================================
-- RIP TRANSACTIONS (purchase attempts — idempotency enforced)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_transactions (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key             text        NOT NULL UNIQUE,
  user_id                     uuid        REFERENCES auth.users(id) NOT NULL,
  pack_id                     uuid        REFERENCES rip_packs(id) NOT NULL,
  pack_version_id             uuid        REFERENCES rip_pack_versions(id),
  status                      text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending','payment_processing','paid',
                                  'allocating','allocated','revealed','completed',
                                  'failed','refunded','disputed'
                                )),
  amount                      numeric(10,2) NOT NULL,
  currency                    text        NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id    text,
  stripe_checkout_session_id  text,
  payment_confirmed_at        timestamptz,
  allocated_at                timestamptz,
  revealed_at                 timestamptz,
  completed_at                timestamptz,
  jurisdiction                text,
  device_fingerprint          text,
  session_ref                 text,
  ip_address                  text,
  error_message               text,
  retry_count                 integer     NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rip_transactions_user ON rip_transactions (user_id);
CREATE INDEX IF NOT EXISTS rip_transactions_pack  ON rip_transactions (pack_id);
CREATE INDEX IF NOT EXISTS rip_transactions_stripe
  ON rip_transactions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- ============================================================
-- RIP RESULTS (committed, immutable after insert)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_results (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id          uuid        REFERENCES rip_transactions(id) UNIQUE NOT NULL,
  user_id                 uuid        REFERENCES auth.users(id) NOT NULL,
  pack_id                 uuid        REFERENCES rip_packs(id) NOT NULL,
  pack_version_id         uuid        REFERENCES rip_pack_versions(id),
  physical_inventory_id   uuid        REFERENCES rip_physical_inventory(id) UNIQUE NOT NULL,
  card_id                 text,
  card_name               text        NOT NULL,
  set_name                text,
  card_number             text,
  rarity                  text,
  condition               text,
  grade                   text,
  grade_company           text,
  image_url               text,
  market_value_at_rip     numeric(10,2),
  pack_price_at_rip       numeric(10,2),
  randomization_ref       text,       -- reference for audit reproducibility
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rip_results_user ON rip_results (user_id);

-- ============================================================
-- DIGITAL INVENTORY (what the user owns after ripping)
-- ============================================================
CREATE TABLE IF NOT EXISTS digital_inventory (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     uuid        REFERENCES auth.users(id) NOT NULL,
  physical_inventory_id       uuid        REFERENCES rip_physical_inventory(id) NOT NULL,
  rip_result_id               uuid        REFERENCES rip_results(id),
  source_type                 text        NOT NULL DEFAULT 'rip'
                                CHECK (source_type IN ('rip','trade','purchase','reward','manual')),
  source_transaction_id       uuid,
  status                      text        NOT NULL DEFAULT 'available'
                                CHECK (status IN (
                                  'available','allocated','vaulted','listed',
                                  'sold','shipping','shipped','completed','disputed','locked'
                                )),
  market_value_at_acquisition numeric(10,2),
  acquired_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  listing_id                  uuid        REFERENCES listings(id),
  shipment_group_id           uuid,
  notes                       text
);

CREATE INDEX IF NOT EXISTS digital_inventory_user   ON digital_inventory (user_id);
CREATE INDEX IF NOT EXISTS digital_inventory_status ON digital_inventory (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS digital_inventory_physical_uniq
  ON digital_inventory (physical_inventory_id)
  WHERE status NOT IN ('sold','shipped','completed');

-- ============================================================
-- PRICING SNAPSHOTS (immutable market data at time of rip)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_pricing_snapshots (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  rip_result_id   uuid        REFERENCES rip_results(id) NOT NULL,
  card_name       text        NOT NULL,
  set_name        text,
  market_price    numeric(10,2),
  low_price       numeric(10,2),
  high_price      numeric(10,2),
  source          text,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- JURISDICTION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_jurisdiction_rules (
  id                  uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  jurisdiction_code   text    NOT NULL,   -- e.g. 'US-CA', 'US', 'GB'
  pack_id             uuid    REFERENCES rip_packs(id),  -- NULL = global default
  is_allowed          boolean NOT NULL DEFAULT true,
  min_age             integer NOT NULL DEFAULT 18,
  requires_kyc        boolean NOT NULL DEFAULT false,
  requires_aml        boolean NOT NULL DEFAULT false,
  max_spend_per_day   numeric(10,2),
  max_spend_per_month numeric(10,2),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_code, pack_id)
);

-- Sensible defaults — admins should review these before going live
INSERT INTO rip_jurisdiction_rules (jurisdiction_code, pack_id, is_allowed, min_age, notes)
VALUES
  ('US',    NULL, true,  18, 'United States — default'),
  ('US-WA', NULL, false, 18, 'Washington state — review compliance before enabling'),
  ('US-UT', NULL, false, 18, 'Utah — review compliance before enabling'),
  ('GB',    NULL, true,  18, 'United Kingdom — default'),
  ('CA',    NULL, true,  18, 'Canada — default')
ON CONFLICT (jurisdiction_code, pack_id) DO NOTHING;

-- ============================================================
-- AUDIT LOGS (append-only, never update or delete)
-- ============================================================
CREATE TABLE IF NOT EXISTS rip_audit_logs (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type            text        NOT NULL,
  transaction_id        uuid        REFERENCES rip_transactions(id),
  user_id               uuid        REFERENCES auth.users(id),
  admin_id              uuid        REFERENCES auth.users(id),
  pack_id               uuid        REFERENCES rip_packs(id),
  physical_inventory_id uuid        REFERENCES rip_physical_inventory(id),
  digital_inventory_id  uuid        REFERENCES digital_inventory(id),
  payload               jsonb       NOT NULL DEFAULT '{}',
  ip_address            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rip_audit_logs_transaction ON rip_audit_logs (transaction_id);
CREATE INDEX IF NOT EXISTS rip_audit_logs_user        ON rip_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS rip_audit_logs_event_type  ON rip_audit_logs (event_type);

-- ============================================================
-- SECURE SERVER-SIDE PACK ALLOCATION (runs inside a transaction)
-- Called by the API route after payment confirmation.
-- Uses pgcrypto gen_random_uuid() for unbiased randomisation.
-- Atomically:
--   1. Selects a random available card (FOR UPDATE SKIP LOCKED)
--   2. Marks it allocated
--   3. Updates the transaction status
-- Returns the physical_inventory row id that was allocated.
-- ============================================================
CREATE OR REPLACE FUNCTION allocate_rip_card(
  p_transaction_id  uuid,
  p_pack_id         uuid,
  p_pack_version_id uuid,
  p_user_id         uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_id uuid;
  v_tx_status    text;
BEGIN
  -- Idempotency: if already allocated, return the existing card
  SELECT pi.id
  INTO   v_inventory_id
  FROM   rip_results rr
  JOIN   rip_physical_inventory pi ON pi.id = rr.physical_inventory_id
  WHERE  rr.transaction_id = p_transaction_id;

  IF FOUND THEN
    RETURN v_inventory_id;
  END IF;

  -- Guard: transaction must be 'paid'
  SELECT status INTO v_tx_status
  FROM   rip_transactions
  WHERE  id = p_transaction_id AND user_id = p_user_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found';
  END IF;

  IF v_tx_status NOT IN ('paid', 'allocating') THEN
    RAISE EXCEPTION 'transaction_not_paid: %', v_tx_status;
  END IF;

  -- Mark as allocating to prevent concurrent calls
  UPDATE rip_transactions
  SET    status = 'allocating', updated_at = now()
  WHERE  id = p_transaction_id AND status = 'paid';

  -- Select one random available card (atomic, race-safe)
  SELECT id
  INTO   v_inventory_id
  FROM   rip_physical_inventory
  WHERE  pack_id          = p_pack_id
    AND  pack_version_id  = p_pack_version_id
    AND  inventory_status = 'available'
  ORDER BY gen_random_uuid()   -- cryptographically random ordering
  LIMIT  1
  FOR    UPDATE SKIP LOCKED;

  IF v_inventory_id IS NULL THEN
    -- No inventory — roll back status
    UPDATE rip_transactions
    SET    status = 'paid', updated_at = now()
    WHERE  id = p_transaction_id;
    RAISE EXCEPTION 'no_inventory_available';
  END IF;

  -- Lock the card
  UPDATE rip_physical_inventory
  SET    inventory_status = 'allocated',
         ownership_status = 'user_vault',
         updated_at       = now()
  WHERE  id = v_inventory_id;

  -- Decrement pack available count
  UPDATE rip_packs
  SET    available_quantity = GREATEST(0, available_quantity - 1),
         updated_at         = now()
  WHERE  id = p_pack_id;

  -- Update transaction
  UPDATE rip_transactions
  SET    status       = 'allocated',
         allocated_at = now(),
         updated_at   = now()
  WHERE  id = p_transaction_id;

  RETURN v_inventory_id;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE rip_packs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_pack_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_physical_inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_pricing_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_jurisdiction_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rip_audit_logs          ENABLE ROW LEVEL SECURITY;

-- Packs: public read for active packs; admin write
CREATE POLICY "packs_public_read" ON rip_packs
  FOR SELECT USING (status = 'active');

CREATE POLICY "packs_admin_all" ON rip_packs
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin')
  );

-- Pack versions: read for authenticated users; admin write
CREATE POLICY "pack_versions_auth_read" ON rip_pack_versions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pack_versions_admin_all" ON rip_pack_versions
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin')
  );

-- Physical inventory: admin only
CREATE POLICY "physical_inventory_admin" ON rip_physical_inventory
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin')
  );

-- Transactions: users see only their own
CREATE POLICY "transactions_select_own" ON rip_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "transactions_insert_own" ON rip_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "transactions_update_service" ON rip_transactions
  FOR UPDATE USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

-- Results: users see only their own
CREATE POLICY "results_select_own" ON rip_results
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "results_admin_all" ON rip_results
  FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE OR REPLACE FUNCTION rip_results_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'rip_results is immutable';
END;
$$;

DROP TRIGGER IF EXISTS rip_results_no_update ON rip_results;
CREATE TRIGGER rip_results_no_update
BEFORE UPDATE OR DELETE ON rip_results
FOR EACH ROW EXECUTE FUNCTION rip_results_immutable();

DROP TRIGGER IF EXISTS digital_inventory_no_update ON digital_inventory;
CREATE OR REPLACE FUNCTION digital_inventory_service_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'digital_inventory is service-controlled';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER digital_inventory_no_update
BEFORE UPDATE OR DELETE ON digital_inventory
FOR EACH ROW EXECUTE FUNCTION digital_inventory_service_guard();

CREATE OR REPLACE FUNCTION rip_transactions_service_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'rip_transactions is service-controlled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rip_transactions_no_update ON rip_transactions;
CREATE TRIGGER rip_transactions_no_update
BEFORE UPDATE OR DELETE ON rip_transactions
FOR EACH ROW EXECUTE FUNCTION rip_transactions_service_guard();

DROP TRIGGER IF EXISTS rip_physical_inventory_no_update ON rip_physical_inventory;
CREATE OR REPLACE FUNCTION rip_physical_inventory_service_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'rip_physical_inventory is service-controlled';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rip_physical_inventory_no_update
BEFORE UPDATE OR DELETE ON rip_physical_inventory
FOR EACH ROW EXECUTE FUNCTION rip_physical_inventory_service_guard();

CREATE OR REPLACE FUNCTION rip_audit_logs_service_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'rip_audit_logs is service-controlled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rip_audit_logs_no_update ON rip_audit_logs;
CREATE TRIGGER rip_audit_logs_no_update
BEFORE UPDATE OR DELETE ON rip_audit_logs
FOR EACH ROW EXECUTE FUNCTION rip_audit_logs_service_guard();

-- Digital inventory: users see only their own
CREATE POLICY "digital_inventory_select_own" ON digital_inventory
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "digital_inventory_update_service" ON digital_inventory
  FOR UPDATE USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY "digital_inventory_delete_service" ON digital_inventory
  FOR DELETE USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

-- Pricing snapshots: authenticated read; server write
CREATE POLICY "pricing_snapshots_auth_read" ON rip_pricing_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

-- Jurisdiction rules: authenticated read
CREATE POLICY "jurisdiction_rules_read" ON rip_jurisdiction_rules
  FOR SELECT USING (auth.role() = 'authenticated');

-- Audit logs: admin read; no update/delete ever
CREATE POLICY "audit_logs_admin" ON rip_audit_logs
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin')
  );
