-- Fix form_templates RLS policies
-- Replace single FOR ALL policy with explicit per-command policies
-- The FOR ALL policy was missing WITH CHECK, causing INSERT/UPDATE to silently fail

-- Drop existing policies
DROP POLICY IF EXISTS "Templates manage" ON public.form_templates;
DROP POLICY IF EXISTS "Templates view" ON public.form_templates;

-- SELECT: any authenticated user can view templates
CREATE POLICY "Templates select" ON public.form_templates
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: only users with forms.manage or owners/managers
CREATE POLICY "Templates insert" ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK (has_permission('forms.manage') OR is_owner_manager());

-- UPDATE: only users with forms.manage or owners/managers
CREATE POLICY "Templates update" ON public.form_templates
  FOR UPDATE TO authenticated
  USING (has_permission('forms.manage') OR is_owner_manager())
  WITH CHECK (has_permission('forms.manage') OR is_owner_manager());

-- DELETE: only users with forms.manage or owners/managers
CREATE POLICY "Templates delete" ON public.form_templates
  FOR DELETE TO authenticated
  USING (has_permission('forms.manage') OR is_owner_manager());
