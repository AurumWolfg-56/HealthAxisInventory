-- ═══════════════════════════════════════════════════════════════
-- Migration: Platform Role System for Norvexis Core
-- Adds platform_role to profiles + RLS policies for platform resources
-- ═══════════════════════════════════════════════════════════════

-- 1. Add platform_role column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS platform_role TEXT DEFAULT NULL;

-- Add CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_platform_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_platform_role_check
      CHECK (platform_role IS NULL OR platform_role IN ('platform_admin', 'platform_viewer'));
  END IF;
END $$;

-- 2. Assign the first OWNER user as platform_admin
UPDATE profiles
  SET platform_role = 'platform_admin'
  WHERE id IN (
    SELECT user_id FROM user_location_assignments WHERE role_id = 'OWNER' LIMIT 1
  )
  AND platform_role IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS POLICIES — Protect platform-level resources
-- ═══════════════════════════════════════════════════════════════

-- Helper function: check if caller has platform access
CREATE OR REPLACE FUNCTION public.has_platform_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND platform_role IN ('platform_admin', 'platform_viewer')
  );
$$;

-- Helper function: check if caller is platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND platform_role = 'platform_admin'
  );
$$;

-- ══════════════════════════════════════════
-- ORGANIZATIONS table policies
-- ══════════════════════════════════════════

-- Enable RLS if not already
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "org_select_assigned" ON organizations;
DROP POLICY IF EXISTS "org_select_platform" ON organizations;
DROP POLICY IF EXISTS "org_insert_platform_admin" ON organizations;
DROP POLICY IF EXISTS "org_update_platform_admin" ON organizations;
DROP POLICY IF EXISTS "org_delete_platform_admin" ON organizations;

-- Regular users: can see orgs they belong to (via location assignments)
CREATE POLICY "org_select_assigned" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT cl.organization_id
      FROM user_location_assignments ula
      JOIN clinic_locations cl ON cl.id = ula.location_id
      WHERE ula.user_id = auth.uid()
    )
    OR public.has_platform_access()
  );

-- Platform admin: full write access
CREATE POLICY "org_insert_platform_admin" ON organizations
  FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE POLICY "org_update_platform_admin" ON organizations
  FOR UPDATE USING (public.is_platform_admin());

CREATE POLICY "org_delete_platform_admin" ON organizations
  FOR DELETE USING (public.is_platform_admin());

-- ══════════════════════════════════════════
-- CLINIC_LOCATIONS table policies
-- ══════════════════════════════════════════

ALTER TABLE clinic_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loc_select_assigned" ON clinic_locations;
DROP POLICY IF EXISTS "loc_select_platform" ON clinic_locations;
DROP POLICY IF EXISTS "loc_insert_platform_admin" ON clinic_locations;
DROP POLICY IF EXISTS "loc_update_platform_admin" ON clinic_locations;
DROP POLICY IF EXISTS "loc_delete_platform_admin" ON clinic_locations;

-- Regular users: can see locations they are assigned to
CREATE POLICY "loc_select_assigned" ON clinic_locations
  FOR SELECT USING (
    id IN (
      SELECT location_id FROM user_location_assignments WHERE user_id = auth.uid()
    )
    OR public.has_platform_access()
  );

-- Platform admin: full write
CREATE POLICY "loc_insert_platform_admin" ON clinic_locations
  FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE POLICY "loc_update_platform_admin" ON clinic_locations
  FOR UPDATE USING (public.is_platform_admin());

CREATE POLICY "loc_delete_platform_admin" ON clinic_locations
  FOR DELETE USING (public.is_platform_admin());

-- ══════════════════════════════════════════
-- USER_LOCATION_ASSIGNMENTS table policies
-- ══════════════════════════════════════════

ALTER TABLE user_location_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ula_select_own" ON user_location_assignments;
DROP POLICY IF EXISTS "ula_select_platform" ON user_location_assignments;
DROP POLICY IF EXISTS "ula_insert_platform_admin" ON user_location_assignments;
DROP POLICY IF EXISTS "ula_update_platform_admin" ON user_location_assignments;
DROP POLICY IF EXISTS "ula_delete_platform_admin" ON user_location_assignments;

-- Users can see their own assignments
CREATE POLICY "ula_select_own" ON user_location_assignments
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_platform_access()
  );

-- Platform admin: full write
CREATE POLICY "ula_insert_platform_admin" ON user_location_assignments
  FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE POLICY "ula_update_platform_admin" ON user_location_assignments
  FOR UPDATE USING (public.is_platform_admin());

CREATE POLICY "ula_delete_platform_admin" ON user_location_assignments
  FOR DELETE USING (public.is_platform_admin());

-- ══════════════════════════════════════════
-- PROFILES table - add platform_role read policy
-- ══════════════════════════════════════════

-- Users can read their own profile (should already exist, but ensure platform_role is readable)
-- The existing SELECT policy on profiles should already cover this since users can read their own row.
-- Platform admins need to read all profiles for user management.
DROP POLICY IF EXISTS "profiles_select_platform" ON profiles;
CREATE POLICY "profiles_select_platform" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.has_platform_access()
  );

-- Only platform_admin can update platform_role on any profile
DROP POLICY IF EXISTS "profiles_update_platform_role" ON profiles;
CREATE POLICY "profiles_update_platform_role" ON profiles
  FOR UPDATE USING (
    id = auth.uid()
    OR public.is_platform_admin()
  );
