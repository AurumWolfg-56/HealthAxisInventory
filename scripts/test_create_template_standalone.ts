
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing to avoid dotenv dependency
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
    envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
    console.error("Could not read .env file at", envPath);
    process.exit(1);
}

const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Remove quotes
        env[key] = value;
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    console.log("Keys found:", Object.keys(env));
    process.exit(1);
}

console.log("Initializing Supabase with URL:", supabaseUrl); // Log URL to verify
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateTemplate() {
    const id = crypto.randomUUID();
    console.log(`Attempting to create template with ID: ${id}`);

    const template = {
        id: id,
        title: "Test Template (Standalone Script)",
        slug: "test-standalone-" + id,
        version: "1.0",
        language: "English",
        status: "Draft",
        use_letterhead: true,
        content: "Test Content from Standalone Script",
        variables: ["{{patientName}}"],
        updated_at: new Date().toISOString()
    };

    console.log("Payload:", JSON.stringify(template, null, 2));

    try {
        const { data, error } = await supabase
            .from('form_templates')
            .insert(template)
            .select();

        if (error) {
            console.error("Error creating template:", error);
        } else {
            console.log("Template created successfully:", data);
        }
    } catch (e) {
        console.error("Exception during insert:", e);
    }
}

testCreateTemplate();
