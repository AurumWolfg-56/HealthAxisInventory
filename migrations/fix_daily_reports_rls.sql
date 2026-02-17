
-- Fix RLS policies for daily_reports to ensure shared history and reliable saving
-- This ensures that reports created by ANY user are visible to ALL authorized users,
-- preventing "disappearing" data in the history view.

-- 1. Enable RLS (just in case)
ALTER TABLE IF EXISTS "public"."daily_reports" ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential existing restrictive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."daily_reports";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."daily_reports";
DROP POLICY IF EXISTS "Enable update for users based on email" ON "public"."daily_reports";
DROP POLICY IF EXISTS "Enable delete for users based on email" ON "public"."daily_reports";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."daily_reports";
DROP POLICY IF EXISTS "Users can view own reports" ON "public"."daily_reports";

-- 3. Create Permissive Policies

-- READ: Allow ALL authenticated users to see ALL reports (Shared History)
CREATE POLICY "Enable read access for all users" ON "public"."daily_reports"
FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: Allow ALL authenticated users to create reports
CREATE POLICY "Enable insert for authenticated users" ON "public"."daily_reports"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: Allow users to edit their OWN reports OR if they are an Admin/Owner
CREATE POLICY "Enable update for owners and admins" ON "public"."daily_reports"
FOR UPDATE USING (
    (auth.uid() = user_id) OR 
    (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'administrator', 'manager')
    ))
);

-- DELETE: Allow users to delete their OWN reports OR if they are an Admin/Owner
CREATE POLICY "Enable delete for owners and admins" ON "public"."daily_reports"
FOR DELETE USING (
    (auth.uid() = user_id) OR 
    (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'administrator', 'manager')
    ))
);
