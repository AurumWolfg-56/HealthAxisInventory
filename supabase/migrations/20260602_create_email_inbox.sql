CREATE TABLE IF NOT EXISTS public.email_inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id TEXT UNIQUE NOT NULL,
    thread_id TEXT NOT NULL,
    sender TEXT,
    subject TEXT,
    snippet TEXT,
    body TEXT,
    internal_date TIMESTAMPTZ,
    category TEXT,
    ai_summary TEXT,
    ai_draft TEXT,
    status TEXT DEFAULT 'pending_ai',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and update
CREATE POLICY "Allow authenticated users to select emails" ON public.email_inbox FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update emails" ON public.email_inbox FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow service role to insert emails" ON public.email_inbox FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON public.email_inbox FOR ALL TO service_role USING (true);
