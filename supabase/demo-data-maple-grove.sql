-- ============================================================
-- PORCHIVO: App Review Demo Data — Maple Grove HOA
-- Run this in Supabase SQL Editor AFTER all migrations are applied.
-- Creates 5 demo accounts + test community + sample data for Apple review.
-- ============================================================
--
-- DEMO ACCOUNTS (all use password: PorchivoReview2026!)
--   reviewer.resident@porchivo.com     — Resident, Unit 204
--   reviewer.board@porchivo.com        — HOA Board Member
--   reviewer.manager@porchivo.com      — Property Manager
--   reviewer.porchpartner@porchivo.com — Porch Partner (pre-connected to resident)
--   reviewer.admin@porchivo.com        — Community Admin (super_admin)
--
-- TEST COMMUNITY: "Maple Grove HOA"
--   - 2 sample announcements
--   - 1 document
--   - 1 pending maintenance request
--   - 1 pending $0.00 test payment
--   - Resident ↔ Porch Partner pre-connected
-- ============================================================

-- ── 1. Create auth.users (via Supabase auth.admin API) ───────────────────
-- These must be created through auth.admin.createUser to get proper password hashes.
-- Run this as a SQL function that uses the service role.

DO $$
DECLARE
  v_resident_id  UUID;
  v_board_id     UUID;
  v_manager_id   UUID;
  v_partner_id   UUID;
  v_admin_id     UUID;
  v_org_id       UUID;
  v_property_id  UUID;
  v_unit_204_id  UUID;
  v_unit_102_id  UUID;
BEGIN
  -- ── Create auth users ──────────────────────────────────────────────────
  -- Resident
  v_resident_id := auth.uid(); -- placeholder, will be set below
  
  SELECT id INTO v_resident_id FROM auth.users WHERE email = 'reviewer.resident@porchivo.com' LIMIT 1;
  IF v_resident_id IS NULL THEN
    v_resident_id := extensions.uuid_generate_v4();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_resident_id,
      '00000000-0000-0000-0000-000000000000',
      'reviewer.resident@porchivo.com',
      crypt('PorchivoReview2026!', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Review Resident"}'
    );
  END IF;

  -- Board Member
  SELECT id INTO v_board_id FROM auth.users WHERE email = 'reviewer.board@porchivo.com' LIMIT 1;
  IF v_board_id IS NULL THEN
    v_board_id := extensions.uuid_generate_v4();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_board_id,
      '00000000-0000-0000-0000-000000000000',
      'reviewer.board@porchivo.com',
      crypt('PorchivoReview2026!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Review Board"}'
    );
  END IF;

  -- Property Manager
  SELECT id INTO v_manager_id FROM auth.users WHERE email = 'reviewer.manager@porchivo.com' LIMIT 1;
  IF v_manager_id IS NULL THEN
    v_manager_id := extensions.uuid_generate_v4();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_manager_id,
      '00000000-0000-0000-0000-000000000000',
      'reviewer.manager@porchivo.com',
      crypt('PorchivoReview2026!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Review Manager"}'
    );
  END IF;

  -- Porch Partner
  SELECT id INTO v_partner_id FROM auth.users WHERE email = 'reviewer.porchpartner@porchivo.com' LIMIT 1;
  IF v_partner_id IS NULL THEN
    v_partner_id := extensions.uuid_generate_v4();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_partner_id,
      '00000000-0000-0000-0000-000000000000',
      'reviewer.porchpartner@porchivo.com',
      crypt('PorchivoReview2026!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Review Partner"}'
    );
  END IF;

  -- Community Admin
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'reviewer.admin@porchivo.com' LIMIT 1;
  IF v_admin_id IS NULL THEN
    v_admin_id := extensions.uuid_generate_v4();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'reviewer.admin@porchivo.com',
      crypt('PorchivoReview2026!', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"name":"Review Admin"}'
    );
  END IF;

  -- ── Create profiles ────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, name, email, phone, role, address, is_onboarded, is_premium, has_location_consent)
  VALUES
    (v_resident_id, 'Review Resident', 'reviewer.resident@porchivo.com', '555-0101', 'homeowner', 'Maple Grove HOA, 204 Maple St, Unit 204', true, true, true),
    (v_board_id, 'Review Board Member', 'reviewer.board@porchivo.com', '555-0102', 'homeowner', 'Maple Grove HOA, 101 Maple St, Unit 101', true, true, true),
    (v_manager_id, 'Review Property Manager', 'reviewer.manager@porchivo.com', '555-0103', 'homeowner', 'Maple Grove HOA, Office', true, true, true),
    (v_partner_id, 'Review Porch Partner', 'reviewer.porchpartner@porchivo.com', '555-0104', 'partner', 'Maple Grove HOA, 102 Maple St, Unit 102', true, true, true),
    (v_admin_id, 'Review Community Admin', 'reviewer.admin@porchivo.com', '555-0105', 'homeowner', 'Maple Grove HOA, Admin Office', true, true, true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_onboarded = true,
    is_premium = true;

  -- ── Create Organization: Maple Grove HOA ──────────────────────────────
  INSERT INTO public.organizations (id, name, type, address, city, state, zip, total_units, admin_user_id, is_verified, is_active, invite_code, contact_email)
  VALUES (
    COALESCE(NULLIF((SELECT id FROM public.organizations WHERE name = 'Maple Grove HOA' LIMIT 1), ''), extensions.uuid_generate_v4()),
    'Maple Grove HOA',
    'hoa',
    '100 Maple Grove Drive',
    'Springfield',
    'IL',
    '62704',
    48,
    v_admin_id,
    true,
    true,
    'MAPLE42',
    'reviewer.admin@porchivo.com'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_verified = true,
    is_active = true;

  SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Maple Grove HOA' LIMIT 1;

  -- ── Create Property ────────────────────────────────────────────────────
  INSERT INTO public.properties (id, org_id, name, address, city, state, zip, total_units, is_active)
  VALUES (
    COALESCE(NULLIF((SELECT id FROM public.properties WHERE org_id = v_org_id AND name = 'Maple Grove Main' LIMIT 1), ''), extensions.uuid_generate_v4()),
    v_org_id,
    'Maple Grove Main',
    '100 Maple Grove Drive',
    'Springfield',
    'IL',
    '62704',
    48,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_property_id FROM public.properties WHERE org_id = v_org_id LIMIT 1;

  -- ── Create Units ───────────────────────────────────────────────────────
  INSERT INTO public.units (id, property_id, org_id, unit_number)
  VALUES
    (COALESCE(NULLIF((SELECT id FROM public.units WHERE property_id = v_property_id AND unit_number = '204' LIMIT 1), ''), extensions.uuid_generate_v4()), v_property_id, v_org_id, '204'),
    (COALESCE(NULLIF((SELECT id FROM public.units WHERE property_id = v_property_id AND unit_number = '102' LIMIT 1), ''), extensions.uuid_generate_v4()), v_property_id, v_org_id, '102')
  ON CONFLICT (property_id, unit_number) DO NOTHING;

  SELECT id INTO v_unit_204_id FROM public.units WHERE property_id = v_property_id AND unit_number = '204' LIMIT 1;
  SELECT id INTO v_unit_102_id FROM public.units WHERE property_id = v_property_id AND unit_number = '102' LIMIT 1;

  -- ── Create Org Memberships ─────────────────────────────────────────────
  INSERT INTO public.org_memberships (user_id, org_id, unit_id, role, status, joined_at, invited_by)
  VALUES
    (v_resident_id, v_org_id, v_unit_204_id, 'resident', 'active', NOW(), v_admin_id),
    (v_board_id, v_org_id, NULL, 'board_member', 'active', NOW(), v_admin_id),
    (v_manager_id, v_org_id, NULL, 'property_manager', 'active', NOW(), v_admin_id),
    (v_partner_id, v_org_id, v_unit_102_id, 'resident', 'active', NOW(), v_admin_id),
    (v_admin_id, v_org_id, NULL, 'super_admin', 'active', NOW(), v_admin_id)
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    joined_at = COALESCE(org_memberships.joined_at, NOW());

  -- ── Create Announcements ───────────────────────────────────────────────
  INSERT INTO public.org_announcements (org_id, author_id, title, body, priority, is_pinned, category, created_at)
  VALUES
    (v_org_id, v_board_id, 'Welcome to Maple Grove HOA on Porchivo!',
     'Welcome neighbors! Our community is now on Porchivo. Use the app to track packages, receive community announcements, submit maintenance requests, and connect with your Porch Partners. If you have questions, contact the property manager.',
     'normal', true, 'general', NOW() - INTERVAL '3 days'),

    (v_org_id, v_manager_id, 'Package Security Reminder',
     'With the holiday shipping season approaching, please remember to pick up packages promptly. If you cannot be home for a delivery, consider assigning a Porch Partner to hold your package. Report any suspicious activity immediately.',
     'high', false, 'safety', NOW() - INTERVAL '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ── Create a Maintenance Request ───────────────────────────────────────
  INSERT INTO maintenance_requests (org_id, property_id, unit_id, requester_id, title, description, status, priority, created_at)
  VALUES (
    v_org_id,
    v_property_id,
    v_unit_204_id,
    v_resident_id,
    'Kitchen faucet leaking',
    'The kitchen faucet in Unit 204 has been dripping continuously for the past two days. It appears to be coming from the base of the handle. Would appreciate a plumber visit at your earliest convenience.',
    'pending',
    'medium',
    NOW() - INTERVAL '2 days'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Create a pending $0.00 test payment (invoice_periods) ─────────────
  -- This creates a $0.00 test assessment the reviewer can "pay" using
  -- the Stripe test card 4242 4242 4242 4242.
  INSERT INTO public.invoice_periods (org_id, user_id, label, amount_cents, status, due_date, created_at)
  VALUES (
    v_org_id,
    v_resident_id,
    'August Assessment — Test Only',
    0,
    'pending',
    NOW() + INTERVAL '30 days',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Pre-connect Resident ↔ Porch Partner ───────────────────────────────
  INSERT INTO public.partner_connections (homeowner_id, partner_id, status, created_at)
  VALUES (v_resident_id, v_partner_id, 'active', NOW() - INTERVAL '5 days')
  ON CONFLICT (homeowner_id, partner_id) DO UPDATE SET
    status = 'active';

  -- ── Create a sample shipment for the resident ──────────────────────────
  INSERT INTO public.shipments (homeowner_id, homeowner_name, partner_id, status, carrier, tracking_number, expected_delivery, created_at)
  VALUES (
    v_resident_id,
    'Review Resident',
    v_partner_id,
    'open',
    'ups',
    '1Z999AA10123456784',
    NOW() + INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Create a sample notification ───────────────────────────────────────
  INSERT INTO public.notifications (user_id, shipment_id, type, title, message, read, created_at)
  VALUES (
    v_resident_id,
    (SELECT id FROM public.shipments WHERE homeowner_id = v_resident_id ORDER BY created_at DESC LIMIT 1),
    'tracking_added',
    'Package tracked',
    'Your UPS package (1Z999AA10123456784) is now being tracked. Expected delivery in 2 days.',
    false,
    NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Demo data created successfully!';
  RAISE NOTICE 'Organization: Maple Grove HOA (invite code: MAPLE42)';
  RAISE NOTICE 'Resident: reviewer.resident@porchivo.com (Unit 204)';
  RAISE NOTICE 'Board: reviewer.board@porchivo.com';
  RAISE NOTICE 'Manager: reviewer.manager@porchivo.com';
  RAISE NOTICE 'Partner: reviewer.porchpartner@porchivo.com (Unit 102, pre-connected to Resident)';
  RAISE NOTICE 'Admin: reviewer.admin@porchivo.com';
  RAISE NOTICE 'All passwords: PorchivoReview2026!';
END;
$$;
