-- Seed the standard Rips pack tiers.
-- Packs start as draft so admins can assign cards and configure odds before activation.

DO $$
DECLARE
  v_pack_id uuid;
  v_name text;
  v_price numeric;
  v_version_id uuid;
  v_names text[] := ARRAY['$1 Pack','$5 Pack','$10 Pack','$25 Pack','$50 Pack','$100 Pack','$250 Pack'];
  v_prices numeric[] := ARRAY[1,5,10,25,50,100,250];
  i integer;
BEGIN
  FOR i IN 1..array_length(v_names, 1) LOOP
    v_name := v_names[i];
    v_price := v_prices[i];

    SELECT id INTO v_pack_id
    FROM rip_packs
    WHERE name = v_name
    LIMIT 1;

    IF v_pack_id IS NULL THEN
      INSERT INTO rip_packs (
        name, description, category, tcg_name, language, status, price,
        inventory_count, available_quantity, chase_cards, rarity_distribution,
        eligibility_rules, jurisdiction_availability, is_promotional, sort_order
      ) VALUES (
        v_name,
        'Pokémon Rips pack tier.',
        'pokemon',
        'Pokemon',
        'en',
        'draft',
        v_price,
        0,
        0,
        '[]'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb,
        false,
        i
      ) RETURNING id INTO v_pack_id;
    END IF;

    SELECT id INTO v_version_id
    FROM rip_pack_versions
    WHERE pack_id = v_pack_id AND version_number = 1
    LIMIT 1;

    IF v_version_id IS NULL THEN
      INSERT INTO rip_pack_versions (
        pack_id, version_number, configuration_hash, rarity_distribution,
        price, eligibility_rules, jurisdiction_availability, notes
      ) VALUES (
        v_pack_id,
        1,
        md5(v_name || ':v1'),
        '{}'::jsonb,
        v_price,
        '{}'::jsonb,
        '{}'::jsonb,
        'Initial draft version; configure card pool and odds before activation.'
      ) RETURNING id INTO v_version_id;
    END IF;
  END LOOP;
END $$;
