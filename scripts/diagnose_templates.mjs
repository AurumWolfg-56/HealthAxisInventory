// Diagnostic script to check RLS policies and user_roles for form_templates
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

async function diagnose() {
    console.log('=== DIAGNOSTIC: form_templates INSERT issue ===\n');

    // Step 1: Sign in as the user
    console.log('1. Signing in as rejyero@gmail.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'rejyero@gmail.com',
        password: process.env.REJY_PASSWORD || 'NEED_PASSWORD'
    });

    if (authError) {
        console.log('   ❌ Auth failed:', authError.message);
        console.log('\n   Trying anonymous/service approach instead...\n');

        // Step 1b: Try checking RLS policies without auth
        console.log('2. Checking user_roles table (anon)...');
        const { data: roles, error: rolesErr } = await supabase
            .from('user_roles')
            .select('*');
        console.log('   user_roles result:', rolesErr ? `Error: ${rolesErr.message}` : JSON.stringify(roles));

        // Step 2: Try a simple INSERT without auth
        console.log('\n3. Testing INSERT without auth...');
        const testPayload = {
            title: 'DIAG_TEST',
            slug: 'diag-test',
            version: '1.0',
            language: 'English',
            status: 'Draft',
            use_letterhead: true,
            content: 'test',
            variables: ['{{patientName}}'],
            updated_at: new Date().toISOString()
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const { data, error } = await supabase
                .from('form_templates')
                .insert(testPayload)
                .select()
                .abortSignal(controller.signal);
            clearTimeout(timeout);

            if (error) {
                console.log('   ❌ INSERT error:', error.message, error.code, error.details, error.hint);
            } else {
                console.log('   ✅ INSERT success:', JSON.stringify(data));
                // Clean up
                if (data?.[0]?.id) {
                    await supabase.from('form_templates').delete().eq('id', data[0].id);
                    console.log('   🧹 Cleaned up test row');
                }
            }
        } catch (e) {
            clearTimeout(timeout);
            console.log('   ⏱️ INSERT timed out or aborted:', e.message);
        }

        return;
    }

    console.log('   ✅ Signed in. User ID:', authData.user.id);

    // Step 2: Check user_roles
    console.log('\n2. Checking user_roles for current user...');
    const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authData.user.id);
    console.log('   user_roles:', rolesErr ? `Error: ${rolesErr.message}` : JSON.stringify(roles));

    // Step 3: Check is_owner_manager() via RPC
    console.log('\n3. Checking is_owner_manager() RPC...');
    const { data: isOwner, error: ownerErr } = await supabase.rpc('is_owner_manager');
    console.log('   is_owner_manager():', ownerErr ? `Error: ${ownerErr.message}` : isOwner);

    // Step 4: Check has_permission('forms.manage') via RPC
    console.log('\n4. Checking has_permission("forms.manage") RPC...');
    const { data: hasPerm, error: permErr } = await supabase.rpc('has_permission', { p_permission: 'forms.manage' });
    console.log('   has_permission:', permErr ? `Error: ${permErr.message}` : hasPerm);

    // Step 5: Try INSERT with AbortSignal timeout
    console.log('\n5. Testing INSERT with 10s timeout...');
    const testPayload = {
        title: 'DIAG_TEST_' + Date.now(),
        slug: 'diag-test',
        version: '1.0',
        language: 'English',
        status: 'Draft',
        use_letterhead: true,
        content: 'test content',
        variables: ['{{patientName}}'],
        updated_at: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const { data, error } = await supabase
            .from('form_templates')
            .insert(testPayload)
            .select()
            .abortSignal(controller.signal);
        clearTimeout(timeout);

        if (error) {
            console.log('   ❌ INSERT error:', error.message, error.code, error.details, error.hint);
        } else {
            console.log('   ✅ INSERT success! ID:', data?.[0]?.id);
            // Clean up test data
            if (data?.[0]?.id) {
                await supabase.from('form_templates').delete().eq('id', data[0].id);
                console.log('   🧹 Cleaned up test row');
            }
        }
    } catch (e) {
        clearTimeout(timeout);
        console.log('   ⏱️ INSERT timed out/aborted:', e.message);
    }

    // Step 6: Check existing policies
    console.log('\n6. Checking existing templates (SELECT test)...');
    const { data: templates, error: selectErr } = await supabase
        .from('form_templates')
        .select('id, title')
        .limit(5);
    console.log('   SELECT:', selectErr ? `Error: ${selectErr.message}` : JSON.stringify(templates));

    await supabase.auth.signOut();
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

diagnose().catch(e => console.error('Fatal:', e));
