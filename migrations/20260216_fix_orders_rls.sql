-- Enable RLS for Orders and Order Items
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'orders' table
CREATE POLICY "Enable read access for authenticated users" ON orders
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON orders
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON orders
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON orders
    FOR DELETE
    TO authenticated
    USING (true);

-- 2. Policies for 'order_items' table
CREATE POLICY "Enable read access for authenticated users" ON order_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON order_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON order_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON order_items
    FOR DELETE
    TO authenticated
    USING (true);

-- 3. Verify Foreign Keys (Optional but good for integrity)
-- Ensure 'created_by' in orders references 'auth.users' if not already
-- Ensure 'order_id' in order_items references 'orders'

-- 4. Grant access to authenticated users (just in case)
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE orders_id_seq TO authenticated; -- If auto-incrementing ID
