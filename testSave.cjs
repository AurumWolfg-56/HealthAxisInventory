const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
    console.log("Logging in...");
    // Just try inserting
    try {
        console.log("Attempting insert WITHOUT auth...");
        const start = Date.now();
        const { data, error } = await supabase
            .from('protocols')
            .insert([{
                title: "Test JS",
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
    } catch (e) {
        console.error("Caught error:", e);
    }
}

runTest();
