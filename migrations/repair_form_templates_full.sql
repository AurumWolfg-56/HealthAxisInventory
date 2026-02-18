-- =============================================
-- REPAIR FORM TEMPLATES RLS & PERMISSIONS
-- =============================================
-- This script fixes the "Saving..." hang by:
-- 1. Redefining helper functions (is_owner_manager, has_permission) to ensure they exist and work
-- 2. Re-applying RLS policies on form_templates with explicit WITH CHECK clauses

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.is_owner_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role_id IN ('OWNER', 'MANAGER')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_permissions text[];
BEGIN
  -- Check if user is OWNER or MANAGER (they have all permissions)
  IF public.is_owner_manager() THEN
    RETURN true;
  END IF;

  -- Get user's role and specific permissions override
  SELECT 
    ur.role_id,
    p.permissions
  INTO 
    v_role,
    v_user_permissions
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.id = auth.uid();

  -- 1. Check specific user permission overrides
  IF v_user_permissions IS NOT NULL AND p_permission = ANY(v_user_permissions) THEN
    RETURN true;
  END IF;

  -- 2. Check role-based permissions
  IF EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = v_role
    AND permission_id = p_permission
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Repair form_templates Policies

-- Enable RLS just in case
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Templates manage" ON public.form_templates;
DROP POLICY IF EXISTS "Templates view" ON public.form_templates;
DROP POLICY IF EXISTS "Templates select" ON public.form_templates;
DROP POLICY IF EXISTS "Templates insert" ON public.form_templates;
DROP POLICY IF EXISTS "Templates update" ON public.form_templates;
DROP POLICY IF EXISTS "Templates delete" ON public.form_templates;

-- Re-create Policies

-- SELECT: All authenticated users can read templates
CREATE POLICY "Templates select" ON public.form_templates
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Managers/Owners/Permission holders only
CREATE POLICY "Templates insert" ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('forms.manage') OR public.is_owner_manager());

-- UPDATE: Managers/Owners/Permission holders only
CREATE POLICY "Templates update" ON public.form_templates
  FOR UPDATE TO authenticated
  USING (public.has_permission('forms.manage') OR public.is_owner_manager())
  WITH CHECK (public.has_permission('forms.manage') OR public.is_owner_manager());

-- DELETE: Managers/Owners/Permission holders only
CREATE POLICY "Templates delete" ON public.form_templates
  FOR DELETE TO authenticated
  USING (public.has_permission('forms.manage') OR public.is_owner_manager());

-- 3. Verify
DO $$
BEGIN
  RAISE NOTICE 'RLS Repair Complete. is_owner_manager and has_permission functions redefined.';
END $$;
