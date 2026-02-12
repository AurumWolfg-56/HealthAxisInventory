
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
            if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val;
        }
    });
} catch (e) {
    console.error("Error reading .env.local", e);
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateTemplate() {
    const id = Date.now().toString();
    console.log(`Attempting to create template with ID: ${id}`);

    const template = {
        id: id,
        title: "Test Template " + id,
        slug: "test-template-" + id,
        version: "1.0",
        language: "English",
        status: "Draft",
        use_letterhead: true,
        content: "Test Content",
        variables: ["{{patientName}}"],
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('form_templates')
        .insert([template])
        .select()
        .single();

    if (error) {
        console.error("Error creating template:", error);
    } else {
        console.log("Template created successfully:", data);

        // Cleanup
        await supabase.from('form_templates').delete().eq('id', id);
    }
}

testCreateTemplate();
