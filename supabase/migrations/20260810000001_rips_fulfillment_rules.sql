-- Rips ownership/fulfillment rules.
-- Ripped cards are NOT normal marketplace inventory.
-- Customers may vault, request shipment after paying shipping, or sell back to TCG Poke Market at the locked buyback price.

ALTER TABLE rip_results
  ADD COLUMN IF NOT EXISTS buyback_price_at_rip numeric(10,2);

ALTER TABLE digital_inventory
  ADD COLUMN IF NOT EXISTS rip_buyback_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS fulfillment_choice text,
  ADD COLUMN IF NOT EXISTS shipping_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyback_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyback_paid_at timestamptz;

ALTER TABLE digital_inventory
  DROP CONSTRAINT IF EXISTS digital_inventory_fulfillment_choice_check;

ALTER TABLE digital_inventory
  ADD CONSTRAINT digital_inventory_fulfillment_choice_check
  CHECK (fulfillment_choice IS NULL OR fulfillment_choice IN ('vault','ship','buyback'));

CREATE TABLE IF NOT EXISTS rip_buyback_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  digital_inventory_id uuid REFERENCES digital_inventory(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  rip_result_id uuid REFERENCES rip_results(id) NOT NULL,
  buyback_price numeric(10,2) NOT NULL CHECK (buyback_price >= 0),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','paid','rejected','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rip_buyback_requests_user
  ON rip_buyback_requests(user_id, status);

ALTER TABLE rip_buyback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rip_buyback_own_select" ON rip_buyback_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rip_buyback_own_insert" ON rip_buyback_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Backfill the immutable buyback price from the existing rip result snapshot.
UPDATE digital_inventory di
SET rip_buyback_price = rr.market_value_at_rip
FROM rip_results rr
WHERE di.rip_result_id = rr.id
  AND di.source_type = 'rip'
  AND di.rip_buyback_price IS NULL;

UPDATE rip_results
SET buyback_price_at_rip = COALESCE(buyback_price_at_rip, market_value_at_rip)
WHERE buyback_price_at_rip IS NULL;

-- Prevent normal listing paths from using Rips inventory at the database level.
-- The marketplace listing API must use non-Rips inventory or ordinary seller inventory.
CREATE OR REPLACE FUNCTION prevent_rip_inventory_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text;
BEGIN
  SELECT source_type INTO v_source
  FROM digital_inventory
  WHERE id = NEW.id;

  IF COALESCE(v_source, '') = 'rip' THEN
    RAISE EXCEPTION 'rip_inventory_not_listable_use_vault_ship_or_buyback';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_rip_inventory_listing_trigger ON digital_inventory;
CREATE TRIGGER prevent_rip_inventory_listing_trigger
BEFORE UPDATE OF listing_id, status ON digital_inventory
FOR EACH ROW
WHEN (NEW.listing_id IS NOT NULL OR NEW.status = 'listed')
EXECUTE FUNCTION prevent_rip_inventory_listing();
