
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

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
        .insert(template)
        .select()
        .single();

    if (error) {
        console.error("Error creating template:", error);
    } else {
        console.log("Template created successfully:", data);
    }
}

testCreateTemplate();
