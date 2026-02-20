-- Add received_at column to orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'received_at') THEN
        ALTER TABLE orders ADD COLUMN received_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create intelligence_overrides table for governance
CREATE TABLE IF NOT EXISTS intelligence_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- Nullable if we want to allow system overrides, but usually tied to a user
  recommended_qty NUMERIC NOT NULL,
  ordered_qty NUMERIC NOT NULL,
  justification TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for intelligence_overrides
ALTER TABLE intelligence_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON intelligence_overrides
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON intelligence_overrides
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Backfill received_at for existing RECEIVED orders
-- We assume that for existing orders, the updated_at timestamp is a close enough proxy for when it was received
UPDATE orders
SET received_at = updated_at
WHERE status = 'RECEIVED' AND received_at IS NULL;
