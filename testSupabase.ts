import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function runTest() {
    console.log("Logging in...");
    // Must login to simulate the browser
    // I need an email and password from the profiles or I can just use anon key and see if RLS rejects or HANGS.

    console.log("Attempting insert WITHOUT auth...");
    const start = Date.now();
    const { data, error } = await supabase
        .from('protocols')
        .insert([{
            title: "Test",
            content: "Content",
            severity: "CRITICAL",
            area: "LAB",
            type: "STANDARD",
            requires_acknowledgment: true
        }])
        .select()
        .single();

    console.log(`Finished in ${Date.now() - start}ms`);
    console.log("Data:", data);
    console.log("Error:", error);
}

runTest();
