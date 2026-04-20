-- Create the daily_reports bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('daily_reports', 'daily_reports', true)
ON CONFLICT (id) DO NOTHING;

-- Grant access to everyone (since app handles auth internally or via anon key)
CREATE POLICY "Allow public uploads to daily_reports" ON storage.objects
FOR INSERT TO public WITH CHECK (bucket_id = 'daily_reports');

CREATE POLICY "Allow public read daily_reports" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'daily_reports');
