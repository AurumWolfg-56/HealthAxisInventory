import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        console.log("Authenticating...");
        // You'll need to log in as a manager for RLS to pass, or bypass RLS if using service role.
        // Let's use service role key if available, otherwise just anon.

        // Actually, let's just test if the connection hangs.
        console.log("Checking protocols table...");
        const { data, error } = await supabase.from('protocols').select('*').limit(1);
        console.log({ data, error });

        // Try inserting without auth (Should return RLS violation, NOT hang)
        console.log("Testing insert...");
        const insertRes = await supabase.from('protocols').insert([{
            title: "Test",
            content: "Test",
            severity: "INFO",
            area: "GENERAL",
            type: "STANDARD",
            requires_acknowledgment: false
        }]).select().single();

        console.log("Insert result:", insertRes);
    } catch (e) {
        console.error("Test caught:", e);
    }
}
test();
