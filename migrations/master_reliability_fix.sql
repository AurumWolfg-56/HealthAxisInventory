-- ==============================================================================
-- MASTER RELIABILITY FIX: INVENTORY, ORDERS, DAILY CLOSE
-- ==============================================================================
-- Goal: Ensure 100% data persistence by resetting security policies to a known,
-- permissive state for all authenticated users. This eliminates "silent blockers".

-- 1. Enable RLS on all core tables (Idempotent)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- 2. RESET: Drop ALL existing policies to avoid conflicts
-- Items
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Enable delete access for all authenticated users" ON items;
DROP POLICY IF EXISTS "Items view" ON items;
DROP POLICY IF EXISTS "Items edit" ON items;

-- Orders
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON orders;

-- Order Items
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON order_items;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON order_items;

-- Daily Reports
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON daily_reports;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON daily_reports;
DROP POLICY IF EXISTS "Enable update access for all authenticated users" ON daily_reports;
DROP POLICY IF EXISTS "Enable delete access for all authenticated users" ON daily_reports;

-- Audit Log
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON audit_log;
DROP POLICY IF EXISTS "Enable insert access for all authenticated users" ON audit_log;
DROP POLICY IF EXISTS "Audit view" ON audit_log;
DROP POLICY IF EXISTS "Audit insert" ON audit_log;

-- Form Templates
DROP POLICY IF EXISTS "Enable read access for all users" ON form_templates;
DROP POLICY IF EXISTS "Enable insert for all users" ON form_templates;
DROP POLICY IF EXISTS "Enable update for all users" ON form_templates;
DROP POLICY IF EXISTS "Enable delete for all users" ON form_templates;

-- 3. APPLY: Standard "Authenticated Access" Policies
-- We use a simple `auth.role() = 'authenticated'` check. 
-- This guarantees that ANY logged-in user can save data.

-- ITEMS
CREATE POLICY "reliability_items_select" ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_items_insert" ON items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reliability_items_update" ON items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reliability_items_delete" ON items FOR DELETE TO authenticated USING (true);

-- ORDERS
CREATE POLICY "reliability_orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reliability_orders_update" ON orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reliability_orders_delete" ON orders FOR DELETE TO authenticated USING (true);

-- ORDER ITEMS
CREATE POLICY "reliability_order_items_select" ON order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_order_items_insert" ON order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reliability_order_items_update" ON order_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reliability_order_items_delete" ON order_items FOR DELETE TO authenticated USING (true);

-- DAILY REPORTS
CREATE POLICY "reliability_daily_reports_select" ON daily_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_daily_reports_insert" ON daily_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reliability_daily_reports_update" ON daily_reports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reliability_daily_reports_delete" ON daily_reports FOR DELETE TO authenticated USING (true);

-- AUDIT LOG
CREATE POLICY "reliability_audit_select" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_audit_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- FORM TEMPLATES
CREATE POLICY "reliability_templates_select" ON form_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "reliability_templates_insert" ON form_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reliability_templates_update" ON form_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "reliability_templates_delete" ON form_templates FOR DELETE TO authenticated USING (true);

-- 4. GRANT PERMISSIONS (Safety Net)
GRANT ALL ON items TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON order_items TO authenticated;
GRANT ALL ON daily_reports TO authenticated;
GRANT ALL ON audit_log TO authenticated;
GRANT ALL ON form_templates TO authenticated;

-- Grant sequence usage for auto-increment IDs (if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
