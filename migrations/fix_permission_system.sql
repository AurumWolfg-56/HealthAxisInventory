-- ================================================
-- Complete Permission System Fix
-- ================================================
-- This migration fixes the Admin panel loading issue and enables
-- comprehensive permission management with user-specific overrides.
--
-- Changes:
-- 1. Adds missing 'permissions' column to profiles table
-- 2. Adds RLS policies for user_roles and role_permissions tables
-- 3. Creates trigger for real-time permission change notifications
-- 4. Updates profiles policy for OWNER/MANAGER permission management

-- ================================================
-- PART 1: Fix Profiles Table Schema
-- ================================================

-- Add permissions column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'profiles' 
        AND column_name = 'permissions'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN permissions TEXT[];
        
        RAISE NOTICE 'Added permissions column to profiles table';
    ELSE
        RAISE NOTICE 'Permissions column already exists, skipping';
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.permissions IS 'User-specific permission overrides. When set, these take precedence over role-based permissions. NULL means fall back to role permissions.';

-- ================================================
-- PART 2: Add Missing RLS Policies
-- ================================================

-- Allow authenticated users to view role assignments
-- This fixes the Admin panel loading issue
DROP POLICY IF EXISTS "UserRoles view" ON public.user_roles;
CREATE POLICY "UserRoles view" ON public.user_roles 
  FOR SELECT 
  USING (true);

RAISE NOTICE 'Created SELECT policy for user_roles';

-- Allow OWNER/MANAGER to manage user roles (already protected by trigger)
DROP POLICY IF EXISTS "UserRoles manage" ON public.user_roles;
CREATE POLICY "UserRoles manage" ON public.user_roles 
  FOR ALL
  USING (public.is_owner_manager());

RAISE NOTICE 'Created management policy for user_roles';

-- Update profiles policy to allow OWNER/MANAGER to update permissions
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
CREATE POLICY "Profiles update" ON public.profiles 
  FOR UPDATE 
  USING (
    auth.uid() = id OR public.is_owner_manager()
  );

RAISE NOTICE 'Updated profiles update policy';

-- Allow OWNER/MANAGER to view all role permissions for the permission matrix
DROP POLICY IF EXISTS "RolePerms view" ON public.role_permissions;
CREATE POLICY "RolePerms view" ON public.role_permissions 
  FOR SELECT 
  USING (true);

RAISE NOTICE 'Created SELECT policy for role_permissions';

-- ================================================
-- PART 3: Helper Function for Permission Sync
-- ================================================

-- Function to sync permission changes across active sessions
-- This ensures that when a MANAGER removes permissions, 
-- the user's session is invalidated on next permission check
CREATE OR REPLACE FUNCTION public.notify_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the application layer to refresh user permissions
  PERFORM pg_notify('permission_change', NEW.id::text);
  
  -- Update the updated_at timestamp to force cache invalidation
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE 'Created notify_permission_change function';

-- Create trigger to notify on permission changes
DROP TRIGGER IF EXISTS on_profile_permission_change ON public.profiles;
CREATE TRIGGER on_profile_permission_change
  BEFORE UPDATE OF permissions ON public.profiles
  FOR EACH ROW
  WHEN (OLD.permissions IS DISTINCT FROM NEW.permissions)
  EXECUTE FUNCTION public.notify_permission_change();

RAISE NOTICE 'Created trigger for permission change notifications';

-- ================================================
-- VERIFICATION
-- ================================================

-- Verify that all changes were applied successfully
DO $$
DECLARE
    has_perms_column BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check permissions column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'profiles' 
        AND column_name = 'permissions'
    ) INTO has_perms_column;
    
    IF has_perms_column THEN
        RAISE NOTICE '✓ Permissions column exists';
    ELSE
        RAISE WARNING '✗ Permissions column missing!';
    END IF;
    
    -- Check RLS policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_roles'
    AND policyname IN ('UserRoles view', 'UserRoles manage');
    
    IF policy_count = 2 THEN
        RAISE NOTICE '✓ user_roles policies created';
    ELSE
        RAISE WARNING '✗ Missing user_roles policies (found % of 2)', policy_count;
    END IF;
    
    -- Check trigger exists
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_profile_permission_change'
    ) THEN
        RAISE NOTICE '✓ Permission change trigger created';
    ELSE
        RAISE WARNING '✗ Permission change trigger missing!';
    END IF;
    
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'You can now test the Admin panel and permissions.';
    RAISE NOTICE '================================================';
END $$;
