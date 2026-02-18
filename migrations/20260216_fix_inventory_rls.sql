-- Enable Row Level Security (RLS) on tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable delete access for all authenticated users" ON items;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON audit_log;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON audit_log;

-- Create policies for 'items' table
CREATE POLICY "Enable read access for all authenticated users" ON "items"
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for all authenticated users" ON "items"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for all authenticated users" ON "items"
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for all authenticated users" ON "items"
FOR DELETE USING (auth.role() = 'authenticated');

-- Create policies for 'audit_log' table
CREATE POLICY "Enable read access for all authenticated users" ON "audit_log"
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for all authenticated users" ON "audit_log"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
