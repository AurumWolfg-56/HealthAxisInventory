-- 🚨 DANGER: THIS SCRIPT DELETES ALL EXISTING FORM TEMPLATES 🚨
-- Run this in the Supabase SQL Editor to reset the module completely.

-- 1. Drop existing table and policies
DROP TABLE IF EXISTS public.form_templates CASCADE;

-- 2. Create the table from scratch
CREATE TABLE public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    language TEXT DEFAULT 'English',
    status TEXT DEFAULT 'Draft',
    use_letterhead BOOLEAN DEFAULT true,
    content TEXT,
    variables JSONB DEFAULT '[]'::jsonb, -- Using JSONB for flexibility
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

-- 4. Create Simplified & Permissive RLS Policies
-- Allow ALL authenticated users to READ templates
CREATE POLICY "Allow read for all authenticated users"
ON public.form_templates
FOR SELECT
TO authenticated
USING (true);

-- Allow ALL authenticated users to INSERT templates
CREATE POLICY "Allow insert for all authenticated users"
ON public.form_templates
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow ALL authenticated users to UPDATE templates
CREATE POLICY "Allow update for all authenticated users"
ON public.form_templates
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow ALL authenticated users to DELETE templates
CREATE POLICY "Allow delete for all authenticated users"
ON public.form_templates
FOR DELETE
TO authenticated
USING (true);

-- 5. Grant permissions to authenticated role (critical for access)
GRANT ALL ON public.form_templates TO authenticated;
GRANT ALL ON public.form_templates TO service_role;

-- 6. Insert a Default Template to verify functionality immediately
INSERT INTO public.form_templates (title, slug, content, variables)
VALUES (
    'Test Template (Reset)', 
    'test-reset', 
    '<h1>Hello World</h1><p>This is a test template generated after reset.</p>',
    '["{{patientName}}", "{{date}}"]'::jsonb
);

-- Confirmation
SELECT 'Form Templates Module has been reset successfully.' as status;
