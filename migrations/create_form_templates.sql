-- Create form_templates table
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    language TEXT DEFAULT 'English',
    status TEXT DEFAULT 'Draft',
    use_letterhead BOOLEAN DEFAULT true,
    content TEXT,
    variables TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- 1. View Policy: Allow authenticated users to view templates
-- (Adjust this if you want to restrict viewing to specific roles)
CREATE POLICY "Templates view" ON public.form_templates
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 2. Manage Policy: Allow users with 'forms.manage' permission to create/update/delete
-- We use the existing has_permission function from your schema
CREATE POLICY "Templates manage" ON public.form_templates
    FOR ALL
    USING (
        public.has_permission('forms.manage') 
        OR 
        public.is_owner_manager()
    );

-- Add 'forms.manage' and 'forms.generate' permissions if they don't exist
INSERT INTO public.permissions (id, description)
VALUES 
    ('forms.manage', 'Create and edit form templates'),
    ('forms.generate', 'Fill out and generate forms')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to roles
-- DOCTOR: Generate only
-- OWNER/MANAGER: Manage and Generate
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES 
    ('DOCTOR', 'forms.generate'),
    ('OWNER', 'forms.manage'),
    ('OWNER', 'forms.generate'),
    ('MANAGER', 'forms.manage'),
    ('MANAGER', 'forms.generate')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Log the migration

