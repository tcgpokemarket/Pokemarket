-- Admin -> Dashboard -> Supabase connection hardening
-- Keeps privileged rip allocation server-side, prevents anonymous RPC execution,
-- and adds indexes needed by the admin/rip workflows as data grows.

CREATE OR REPLACE FUNCTION public.allocate_rip_card(
  p_transaction_id uuid,
  p_pack_id uuid,
  p_pack_version_id uuid,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inventory_id uuid;
  v_tx_status text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT pi.id
    INTO v_inventory_id
    FROM public.rip_results rr
    JOIN public.rip_physical_inventory pi ON pi.id = rr.physical_inventory_id
   WHERE rr.transaction_id = p_transaction_id;

  IF FOUND THEN
    RETURN v_inventory_id;
  END IF;

  SELECT status
    INTO v_tx_status
    FROM public.rip_transactions
   WHERE id = p_transaction_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found';
  END IF;

  IF v_tx_status NOT IN ('paid', 'allocating') THEN
    RAISE EXCEPTION 'transaction_not_paid: %', v_tx_status;
  END IF;

  UPDATE public.rip_transactions
     SET status = 'allocating', updated_at = now()
   WHERE id = p_transaction_id
     AND status = 'paid';

  SELECT id
    INTO v_inventory_id
    FROM public.rip_physical_inventory
   WHERE pack_id = p_pack_id
     AND pack_version_id = p_pack_version_id
     AND inventory_status = 'available'
   ORDER BY gen_random_uuid()
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_inventory_id IS NULL THEN
    UPDATE public.rip_transactions
       SET status = 'paid', updated_at = now()
     WHERE id = p_transaction_id;
    RAISE EXCEPTION 'no_inventory_available';
  END IF;

  UPDATE public.rip_physical_inventory
     SET inventory_status = 'allocated',
         ownership_status = 'user_vault',
         updated_at = now()
   WHERE id = v_inventory_id;

  UPDATE public.rip_packs
     SET available_quantity = GREATEST(0, available_quantity - 1),
         updated_at = now()
   WHERE id = p_pack_id;

  UPDATE public.rip_transactions
     SET status = 'allocated',
         allocated_at = now(),
         updated_at = now()
   WHERE id = p_transaction_id;

  RETURN v_inventory_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_rip_card(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.allocate_rip_card(uuid, uuid, uuid, uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS digital_inventory_listing_id_idx
  ON public.digital_inventory(listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS digital_inventory_rip_result_id_idx
  ON public.digital_inventory(rip_result_id)
  WHERE rip_result_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_audit_logs_admin_id_idx
  ON public.rip_audit_logs(admin_id)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_audit_logs_digital_inventory_id_idx
  ON public.rip_audit_logs(digital_inventory_id)
  WHERE digital_inventory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_audit_logs_pack_id_idx
  ON public.rip_audit_logs(pack_id)
  WHERE pack_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_audit_logs_physical_inventory_id_idx
  ON public.rip_audit_logs(physical_inventory_id)
  WHERE physical_inventory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_results_pack_id_idx
  ON public.rip_results(pack_id);

CREATE INDEX IF NOT EXISTS rip_results_pack_version_id_idx
  ON public.rip_results(pack_version_id)
  WHERE pack_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_transactions_pack_version_id_idx
  ON public.rip_transactions(pack_version_id)
  WHERE pack_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rip_physical_inventory_pack_version_id_idx
  ON public.rip_physical_inventory(pack_version_id)
  WHERE pack_version_id IS NOT NULL;
