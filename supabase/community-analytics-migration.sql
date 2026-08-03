-- ─────────────────────────────────────────────────────────────────────────────
-- Community Analytics — Phase 11
-- Porchivo HOA Community Platform
-- ─────────────────────────────────────────────────────────────────────────────
-- Provides aggregated, read-only analytics data for admins and board members.
-- All RPCs are security-definer and enforce community scoping.
-- No PII is exposed — all results are counts, rates, and averages.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Package analytics ────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_package_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  -- Role guard
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','property_staff','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    -- Total counts
    'total',           COUNT(*),
    'received',        COUNT(*) FILTER (WHERE status = 'received'),
    'ready',           COUNT(*) FILTER (WHERE status = 'ready_for_pickup'),
    'picked_up',       COUNT(*) FILTER (WHERE status = 'picked_up'),
    'exception',       COUNT(*) FILTER (WHERE status = 'exception'),
    'returned',        COUNT(*) FILTER (WHERE status = 'returned_to_sender'),

    -- Volume today / this week
    'today',           COUNT(*) FILTER (WHERE received_at::date = current_date),
    'this_week',       COUNT(*) FILTER (WHERE received_at >= date_trunc('week', now())),

    -- Avg pickup time (hours) for picked-up packages
    'avg_pickup_hours', ROUND(
      EXTRACT(EPOCH FROM AVG(
        CASE WHEN picked_up_at IS NOT NULL THEN picked_up_at - received_at END
      )) / 3600.0
    , 1),

    -- Pending > 3 days
    'overdue_count',   COUNT(*) FILTER (
      WHERE status IN ('received','ready_for_pickup')
        AND received_at < now() - interval '3 days'
    ),

    -- Carrier breakdown (top 5)
    'by_carrier', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          COALESCE(carrier, 'Unknown') AS carrier,
          COUNT(*)::int                AS count
        FROM package_log_items
        WHERE org_id = p_org_id
          AND received_at >= now() - (p_days || ' days')::interval
        GROUP BY carrier
        ORDER BY count DESC
        LIMIT 5
      ) t
    ),

    -- Daily volumes for sparkline (last 14 days)
    'daily_volumes', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.day)
      FROM (
        SELECT
          TO_CHAR(generate_series::date, 'MM/DD') AS day,
          COALESCE((
            SELECT COUNT(*) FROM package_log_items
            WHERE org_id = p_org_id
              AND received_at::date = generate_series::date
          ), 0)::int AS count
        FROM generate_series(
          (now() - interval '13 days')::date,
          now()::date,
          '1 day'::interval
        )
      ) t
    )
  )
  INTO v_result
  FROM package_log_items
  WHERE org_id = p_org_id
    AND received_at >= now() - (p_days || ' days')::interval;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Incident analytics ───────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_incident_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','property_staff','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'open',        COUNT(*) FILTER (WHERE status NOT IN ('closed','resolved_found','resolved_misdelivery_corrected','resolved_resident_recovered','resolved_carrier_contacted','resolved_replacement_handled','closed_insufficient_evidence','closed_duplicate','monitoring')),
    'resolved',    COUNT(*) FILTER (WHERE status LIKE 'resolved%'),
    'closed',      COUNT(*) FILTER (WHERE status LIKE 'closed%'),
    'escalated',   COUNT(*) FILTER (WHERE status LIKE 'escalated%'),
    'overdue',     COUNT(*) FILTER (WHERE sla_due_at < now() AND status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%'),
    'this_week',   COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())),

    -- Avg resolution hours
    'avg_resolution_hours', ROUND(
      EXTRACT(EPOCH FROM AVG(
        CASE WHEN closed_at IS NOT NULL THEN closed_at - created_at END
      )) / 3600.0
    , 1),

    -- SLA compliance %
    'sla_compliance_pct', CASE
      WHEN COUNT(*) FILTER (WHERE closed_at IS NOT NULL) = 0 THEN 100
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE closed_at IS NOT NULL
            AND (sla_due_at IS NULL OR closed_at <= sla_due_at)
        )::numeric /
        NULLIF(COUNT(*) FILTER (WHERE closed_at IS NOT NULL), 0)
      , 0)
    END,

    -- By incident type
    'by_type', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          incident_type AS type,
          COUNT(*)::int AS count
        FROM incident_reports
        WHERE org_id = p_org_id
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY incident_type
        ORDER BY count DESC
        LIMIT 6
      ) t
    ),

    -- By severity
    'by_severity', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          severity,
          COUNT(*)::int AS count
        FROM incident_reports
        WHERE org_id = p_org_id
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY severity
        ORDER BY count DESC
      ) t
    ),

    -- Trend tags frequency
    'top_trend_tags', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          tag,
          COUNT(*)::int AS count
        FROM incident_reports,
             unnest(trend_tags) AS tag
        WHERE org_id = p_org_id
          AND trend_tags IS NOT NULL
          AND created_at >= now() - (p_days || ' days')::interval
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 5
      ) t
    )
  )
  INTO v_result
  FROM incident_reports
  WHERE org_id = p_org_id
    AND created_at >= now() - (p_days || ' days')::interval;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Member & community analytics ─────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_community_analytics(
  p_org_id   uuid,
  p_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_result      jsonb;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT jsonb_build_object(
    -- Members
    'total_members',      COUNT(*) FILTER (WHERE status = 'active'),
    'pending_members',    COUNT(*) FILTER (WHERE status = 'pending'),
    'suspended_members',  COUNT(*) FILTER (WHERE status = 'suspended'),
    'new_this_month',     COUNT(*) FILTER (WHERE status = 'active' AND joined_at >= date_trunc('month', now())),
    'new_this_week',      COUNT(*) FILTER (WHERE status = 'active' AND joined_at >= date_trunc('week', now())),

    -- Role distribution
    'by_role', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT role, COUNT(*)::int AS count
        FROM org_memberships
        WHERE org_id = p_org_id AND status = 'active'
        GROUP BY role
        ORDER BY count DESC
      ) t
    ),

    -- Announcements
    'total_announcements', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND (scheduled_at IS NULL OR scheduled_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
    ),
    'announcements_this_month', (
      SELECT COUNT(*) FROM org_announcements
      WHERE org_id = p_org_id
        AND created_at >= date_trunc('month', now())
    ),
    'total_announcement_views', (
      SELECT COALESCE(SUM(view_count), 0) FROM org_announcements
      WHERE org_id = p_org_id
    ),

    -- Properties & units
    'total_properties', (
      SELECT COUNT(*) FROM properties
      WHERE org_id = p_org_id AND is_active = true
    ),
    'total_units', (
      SELECT COUNT(*) FROM units
      WHERE org_id = p_org_id
    ),
    'occupied_units', (
      SELECT COUNT(DISTINCT unit_id) FROM org_memberships
      WHERE org_id = p_org_id AND status = 'active' AND unit_id IS NOT NULL
    ),

    -- Audit activity
    'admin_actions_this_month', (
      SELECT COUNT(*) FROM org_audit_log
      WHERE org_id = p_org_id
        AND created_at >= date_trunc('month', now())
    )
  )
  INTO v_result
  FROM org_memberships
  WHERE org_id = p_org_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Health score RPC — composite 0–100 community health index
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_community_health_score(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role        text;
  v_pkg_overdue        int := 0;
  v_pkg_total_30       int := 0;
  v_inc_open           int := 0;
  v_inc_overdue        int := 0;
  v_sla_pct            numeric := 100;
  v_pending_members    int := 0;
  v_score              int;
  v_pkg_score          int;
  v_inc_score          int;
  v_member_score       int;
BEGIN
  SELECT om.role INTO v_caller_role
  FROM org_memberships om
  WHERE om.org_id = p_org_id AND om.user_id = auth.uid() AND om.status = 'active'
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
    'hoa_admin','super_admin','property_manager','board_member'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Package component (40 pts)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('received','ready_for_pickup') AND received_at < now() - interval '3 days'),
    COUNT(*)
  INTO v_pkg_overdue, v_pkg_total_30
  FROM package_log_items
  WHERE org_id = p_org_id AND received_at >= now() - interval '30 days';

  v_pkg_score := GREATEST(0, 40 - LEAST(40, v_pkg_overdue * 5));

  -- Incident component (40 pts)
  SELECT
    COUNT(*) FILTER (WHERE status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%' AND status NOT IN ('monitoring')),
    COUNT(*) FILTER (WHERE sla_due_at < now() AND status NOT LIKE 'closed%' AND status NOT LIKE 'resolved%')
  INTO v_inc_open, v_inc_overdue
  FROM incident_reports
  WHERE org_id = p_org_id AND created_at >= now() - interval '30 days';

  v_inc_score := GREATEST(0, 40 - LEAST(20, v_inc_open * 2) - LEAST(20, v_inc_overdue * 4));

  -- Member component (20 pts) — pending queue penalty
  SELECT COUNT(*) INTO v_pending_members
  FROM org_memberships WHERE org_id = p_org_id AND status = 'pending';

  v_member_score := GREATEST(0, 20 - LEAST(20, v_pending_members * 2));

  v_score := v_pkg_score + v_inc_score + v_member_score;

  RETURN jsonb_build_object(
    'score',          v_score,
    'pkg_score',      v_pkg_score,
    'inc_score',      v_inc_score,
    'member_score',   v_member_score,
    'grade', CASE
      WHEN v_score >= 90 THEN 'A'
      WHEN v_score >= 80 THEN 'B'
      WHEN v_score >= 70 THEN 'C'
      WHEN v_score >= 60 THEN 'D'
      ELSE 'F'
    END,
    'status', CASE
      WHEN v_score >= 85 THEN 'Healthy'
      WHEN v_score >= 65 THEN 'Fair'
      WHEN v_score >= 45 THEN 'Needs Attention'
      ELSE 'Critical'
    END
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_package_analytics(uuid, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION get_incident_analytics(uuid, int)     TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_analytics(uuid, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_health_score(uuid)      TO authenticated;
