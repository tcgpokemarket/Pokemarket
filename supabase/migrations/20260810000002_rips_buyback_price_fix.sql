-- Rips buyback is based on the locked rip price, never live market value.
-- Existing results use pack_price_at_rip as the default buyback amount.
UPDATE rip_results
SET buyback_price_at_rip = COALESCE(buyback_price_at_rip, pack_price_at_rip)
WHERE buyback_price_at_rip IS NULL;

UPDATE digital_inventory di
SET rip_buyback_price = rr.buyback_price_at_rip
FROM rip_results rr
WHERE di.rip_result_id = rr.id
  AND di.source_type = 'rip'
  AND rr.buyback_price_at_rip IS NOT NULL;
