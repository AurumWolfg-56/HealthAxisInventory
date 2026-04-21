import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...vals] = line.split('=');
    acc[key.trim()] = vals.join('=').trim();
    return acc;
}, {});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY']; 

// Create a dummy PDF (A tiny 1x1 valid PDF base64)
const dummyPdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQpHhMB/wwgAAAIqAFgKZW5kc3RyZWFtCmVuZG9iagoKCjMgMCBvYmoKNQplbmRvYmoKCjQgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAxIDFdL1Jlc291cmNlczw8L1BvY0NvbnRleHRbL1BERl0+Pi9Db250ZW50cyAyIDAgUi9QYXJlbnQgNSAwIFI+PgplbmRvYmoKCjUgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzQgMCBSXS9Db3VudCAxPj4KZW5kb2JqCgo2IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyA1IDAgUj4+CmVuZG9iagoKNyAwIG9iago8PC9Qcm9kdWNlcihEWGZNUCkvQ3JlYXRpb25EYXRlKEQ6MjAxOTAxMDEwMDAwMDBaKT4+CmVuZG9iagoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE2IDAwMDAwIG4gCjAwMDAwMDAwNzMgMDAwMDAgbiAKMDAwMDAwMDE0OCAwMDAwMCBuIAowMDAwMDAwMTY3IDAwMDAwIG4gCjAwMDAwMDAyNzcgMDAwMDAgbiAKMDAwMDAwMDMzNiAwMDAwMCBuIAowMDAwMDAwMzg1IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA4L1Jvb3QgNiAwIFIvSW5mbyA3IDAgUj4+CnN0YXJ0eHJlZgo0NzMKJSVFT0YK";

async function main() {
    console.log("1. Starting Test Delivery System");

    // Connect to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Upload to Storage
    console.log("2. Uploading dummy PDF to Storage Bucket 'daily_reports'...");
    const pdfBuffer = Buffer.from(dummyPdfBase64, 'base64');
    const filePath = `test_reports/test_pdf_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('daily_reports')
        .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
        });

    if (uploadError) {
        console.error("Storage Error:", uploadError.message);
        return;
    }
    
    console.log("3. Upload successful. Generating Public URL...");
    const { data: { publicUrl } } = supabase.storage
        .from('daily_reports')
        .getPublicUrl(filePath);
    
    console.log("   -> URL:", publicUrl);

    // 2. Dispatch Email
    console.log("4. Dispatching Email to Edge Function...");
    const emailUrl = supabaseUrl + '/functions/v1/send-email';
    
    try {
        const res = await fetch(emailUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Although anon key isn't strictly needed for `--no-verify-jwt`, let's inject it just in case
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                type: 'daily_close',
                to: 'iarejyero@gmail.com', // Override explicitely just in case
                data: {
                    date: new Date().toLocaleDateString(),
                    totalMethods: "Test 100.00",
                    totalInsurance: 5,
                    closedBy: "Antigravity Agent",
                    pdfUrl: publicUrl,
                    // pdfBase64: dummyPdfBase64 // WE ARE SENDING URL ONLY NOW
                }
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Failed to trigger edge function:", res.status, errorText);
        } else {
            const resultData = await res.json();
            console.log("5. Email Dispatched! Server Response:", resultData);
        }

    } catch (e) {
        console.error("Fetch Exception:", e);
    }
}

main();
