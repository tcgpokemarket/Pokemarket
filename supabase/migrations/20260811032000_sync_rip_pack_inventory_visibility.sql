-- Keep Rips pack visibility and inventory counters synchronized with physical inventory.
-- A pack becomes active when it has at least one available assigned card and has a version.

CREATE OR REPLACE FUNCTION public.sync_rip_pack_inventory_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack_id uuid;
  v_total integer;
  v_available integer;
  v_version_id uuid;
BEGIN
  v_pack_id := COALESCE(NEW.pack_id, OLD.pack_id);

  SELECT count(*)::integer,
         count(*) FILTER (WHERE inventory_status = 'available')::integer
    INTO v_total, v_available
  FROM public.rip_physical_inventory
  WHERE pack_id = v_pack_id;

  SELECT id INTO v_version_id
  FROM public.rip_pack_versions
  WHERE pack_id = v_pack_id
  ORDER BY version_number DESC
  LIMIT 1;

  UPDATE public.rip_packs
  SET inventory_count = v_total,
      available_quantity = v_available,
      active_version_id = CASE
        WHEN v_available > 0 THEN COALESCE(active_version_id, v_version_id)
        ELSE active_version_id
      END,
      status = CASE
        WHEN v_available > 0 AND v_version_id IS NOT NULL THEN 'active'
        WHEN status = 'active' AND v_available = 0 THEN 'sold_out'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_pack_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rip_pack_inventory_visibility ON public.rip_physical_inventory;

CREATE TRIGGER trg_sync_rip_pack_inventory_visibility
AFTER INSERT OR UPDATE OF pack_id, pack_version_id, inventory_status OR DELETE
ON public.rip_physical_inventory
FOR EACH ROW
EXECUTE FUNCTION public.sync_rip_pack_inventory_visibility();

-- Repair existing pack counters and visibility from the inventory source of truth.
UPDATE public.rip_packs p
SET inventory_count = s.total_count,
    available_quantity = s.available_count,
    active_version_id = CASE
      WHEN s.available_count > 0 THEN COALESCE(p.active_version_id, s.version_id)
      ELSE p.active_version_id
    END,
    status = CASE
      WHEN s.available_count > 0 AND s.version_id IS NOT NULL THEN 'active'
      WHEN p.status = 'active' AND s.available_count = 0 THEN 'sold_out'
      ELSE p.status
    END,
    updated_at = now()
FROM (
  SELECT p2.id,
         count(i.id)::integer AS total_count,
         count(i.id) FILTER (WHERE i.inventory_status = 'available')::integer AS available_count,
         (SELECT v.id
            FROM public.rip_pack_versions v
           WHERE v.pack_id = p2.id
           ORDER BY v.version_number DESC
           LIMIT 1) AS version_id
    FROM public.rip_packs p2
    LEFT JOIN public.rip_physical_inventory i ON i.pack_id = p2.id
   GROUP BY p2.id
) s
WHERE p.id = s.id;
