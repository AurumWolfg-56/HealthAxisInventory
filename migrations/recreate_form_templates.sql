-- Drop existing table and policies to ensure clean slate
DROP TABLE IF EXISTS public.form_templates CASCADE;

-- Create form_templates table with CORRECT schema
CREATE TABLE public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    language TEXT DEFAULT 'English',
    status TEXT DEFAULT 'Draft',
    use_letterhead BOOLEAN DEFAULT true,
    content TEXT,
    variables TEXT[], -- Ensure Array of Text, not JSONB
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- 1. View Policy: Allow authenticated users to view templates
CREATE POLICY "Templates view" ON public.form_templates
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 2. Manage Policy: Allow users with 'forms.manage' permission to create/update/delete
CREATE POLICY "Templates manage" ON public.form_templates
    FOR ALL
    USING (
        public.has_permission('forms.manage') 
        OR 
        public.is_owner_manager()
    );
