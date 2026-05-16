-- ============================================================
-- Bulk-import RPC — atomic ingest of elements + ports + splices
-- ============================================================
-- One round-trip from the bulkImport server action
-- (src/lib/actions/import.ts). Inserts every row inside a single
-- Postgres transaction so we never end up with a half-imported
-- bedsheet, and the whole operation costs exactly one rate-limit
-- token regardless of payload size.
--
-- Caller-supplied org id is NOT trusted: we re-derive it from the
-- page that the caller claims to be writing into, and refuse if
-- the caller isn't a member of that org.
--
-- The payload mirrors BulkImportInputSchema in
-- src/lib/import/types.ts. Shape:
--   {
--     "elements": [
--       { "key": "feeder",
--         "type": "cable",
--         "label": "Feeder 24F",
--         "x": 80, "y": 200,
--         "config": { "fiberCount": 24, "colorScheme": "EIA598", ... },
--         "geo": { "lat": null, "lng": null, "path": null, "address": null },
--         "port_colors": ["blue","orange",...]   -- length = port count
--       }, ...
--     ],
--     "splices": [
--       { "fromKey":"feeder","fromPortIndex":24,
--         "toKey":"closure","toPortIndex":0,
--         "comment":"…" }, ...
--     ]
--   }
--
-- Errors raised:
--   page_not_found / not_a_member  — auth failure (mapped → 403/404)
--   invalid_payload                — schema problem the JS Zod missed
--   bad_splice                     — splice references a key/port that
--                                    wasn't created (rolled back)
-- ============================================================

CREATE OR REPLACE FUNCTION public.import_bundle(
  p_page_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_org_id       UUID;
  v_element_ids  JSONB := '{}'::JSONB;
  v_ports        JSONB := '{}'::JSONB;
  v_splice_ids   JSONB := '[]'::JSONB;
  v_element      JSONB;
  v_element_id   UUID;
  v_key          TEXT;
  v_port_colors  TEXT[];
  v_port_count   INT;
  v_splice       JSONB;
  v_from_port_id UUID;
  v_to_port_id   UUID;
  v_splice_id    UUID;
  v_element_count INT := 0;
  v_splice_count  INT := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Resolve org from the page; reject if caller isn't a member.
  SELECT organization_id INTO v_org_id
  FROM pages WHERE id = p_page_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'page_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id AND user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  IF p_payload IS NULL
     OR p_payload->'elements' IS NULL
     OR jsonb_typeof(p_payload->'elements') <> 'array' THEN
    RAISE EXCEPTION 'invalid_payload';
  END IF;

  -- ── PHASE 1: insert elements + ports ───────────────────────
  FOR v_element IN SELECT * FROM jsonb_array_elements(p_payload->'elements')
  LOOP
    v_key := v_element->>'key';
    IF v_key IS NULL OR length(v_key) = 0 THEN
      RAISE EXCEPTION 'invalid_payload';
    END IF;

    INSERT INTO elements (
      organization_id, page_id, type, label,
      position_x, position_y, config_json,
      geo_lat, geo_lng, geo_path_json, geo_address, geo_updated_at
    )
    VALUES (
      v_org_id,
      p_page_id,
      v_element->>'type',
      v_element->>'label',
      (v_element->>'x')::FLOAT,
      (v_element->>'y')::FLOAT,
      v_element->'config',
      NULLIF(v_element->'geo'->>'lat', '')::DOUBLE PRECISION,
      NULLIF(v_element->'geo'->>'lng', '')::DOUBLE PRECISION,
      CASE WHEN v_element->'geo'->'path' IS NULL
           OR jsonb_typeof(v_element->'geo'->'path') = 'null'
           THEN NULL ELSE v_element->'geo'->'path' END,
      NULLIF(v_element->'geo'->>'address', ''),
      CASE WHEN v_element->'geo' IS NULL THEN NULL ELSE now() END
    )
    RETURNING id INTO v_element_id;

    v_element_count := v_element_count + 1;
    v_element_ids := v_element_ids || jsonb_build_object(v_key, v_element_id);

    -- Port colors are pre-computed in JS so we don't duplicate the
    -- color-scheme logic across language boundaries.
    SELECT array_agg(value::TEXT)
      INTO v_port_colors
      FROM jsonb_array_elements_text(v_element->'port_colors');
    v_port_count := COALESCE(array_length(v_port_colors, 1), 0);

    IF v_port_count > 0 THEN
      INSERT INTO ports (organization_id, element_id, port_index, fiber_count, colors, status)
      SELECT
        v_org_id,
        v_element_id,
        idx - 1,
        1,
        ARRAY[v_port_colors[idx]],
        'unoccupied'
      FROM generate_series(1, v_port_count) AS idx;
    END IF;

    -- Aggregate the freshly-inserted ports into the response so the
    -- client can update React Flow state without a re-fetch.
    v_ports := v_ports || jsonb_build_object(
      v_element_id::TEXT,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', p.id,
            'element_id', p.element_id,
            'port_index', p.port_index,
            'colors', p.colors,
            'status', p.status,
            'label', p.label
          ) ORDER BY p.port_index)
         FROM ports p WHERE p.element_id = v_element_id),
        '[]'::JSONB
      )
    );
  END LOOP;

  -- ── PHASE 2: insert splices, flip ports to occupied ────────
  IF p_payload->'splices' IS NOT NULL
     AND jsonb_typeof(p_payload->'splices') = 'array' THEN
    FOR v_splice IN SELECT * FROM jsonb_array_elements(p_payload->'splices')
    LOOP
      SELECT p.id INTO v_from_port_id
      FROM ports p
      WHERE p.element_id = (v_element_ids->>(v_splice->>'fromKey'))::UUID
        AND p.port_index = (v_splice->>'fromPortIndex')::INT;

      SELECT p.id INTO v_to_port_id
      FROM ports p
      WHERE p.element_id = (v_element_ids->>(v_splice->>'toKey'))::UUID
        AND p.port_index = (v_splice->>'toPortIndex')::INT;

      IF v_from_port_id IS NULL OR v_to_port_id IS NULL OR v_from_port_id = v_to_port_id THEN
        RAISE EXCEPTION 'bad_splice';
      END IF;

      INSERT INTO splices (organization_id, port_from, port_to, comment)
      VALUES (
        v_org_id,
        v_from_port_id,
        v_to_port_id,
        NULLIF(v_splice->>'comment', '')
      )
      RETURNING id INTO v_splice_id;

      UPDATE ports
         SET status = 'occupied'
       WHERE id IN (v_from_port_id, v_to_port_id);

      v_splice_ids := v_splice_ids || jsonb_build_object(
        'id', v_splice_id,
        'fromKey', v_splice->>'fromKey',
        'fromPortIndex', (v_splice->>'fromPortIndex')::INT,
        'toKey', v_splice->>'toKey',
        'toPortIndex', (v_splice->>'toPortIndex')::INT
      );
      v_splice_count := v_splice_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'elementIds', v_element_ids,
    'ports', v_ports,
    'spliceIds', v_splice_ids,
    'elementCount', v_element_count,
    'spliceCount', v_splice_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_bundle(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_bundle(UUID, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.import_bundle(UUID, JSONB) TO authenticated;
