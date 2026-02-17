import { FormTemplate } from '../types';

// Shared token cache pattern (copied from DailyReportService for reliability)
let _cachedToken: string | null = null;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders(): Record<string, string> {
    if (!_cachedToken) {
        console.warn('[TemplateService] ⚠️ No cached token! setAccessToken() should be called.');
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation' // Critical for INSERT/UPDATE to return data
    };
}

export const TemplateService = {
    setAccessToken(token: string) {
        _cachedToken = token;
        console.log('[TemplateService] 🔑 Access token cached');
    },

    async getTemplates(): Promise<FormTemplate[]> {
        console.log('[TemplateService] Fetching templates (REST)...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/form_templates?select=*&order=created_at.desc`, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`REST Error ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            return (data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                slug: t.slug,
                version: t.version,
                language: t.language,
                status: t.status,
                useLetterhead: t.use_letterhead,
                content: t.content,
                // JSONB variables are returned as JSON object/array automatically by PostgREST
                variables: Array.isArray(t.variables) ? t.variables : [],
                updatedAt: t.updated_at
            }));
        } catch (error) {
            console.error('[TemplateService] Fetch failed:', error);
            // Return empty array to prevent app crash
            return [];
        }
    },

    async createTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        console.log("[TemplateService] Creating (REST):", template.title);

        const payload = {
            title: template.title,
            slug: template.slug,
            version: template.version,
            language: template.language,
            status: template.status,
            use_letterhead: template.useLetterhead,
            content: template.content,
            variables: template.variables || [],
            updated_at: new Date().toISOString()
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/form_templates`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Create Failed ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            if (!data || data.length === 0) throw new Error('No data returned');

            return {
                id: data[0].id,
                title: data[0].title,
                slug: data[0].slug,
                version: data[0].version,
                language: data[0].language,
                status: data[0].status,
                useLetterhead: data[0].use_letterhead,
                content: data[0].content,
                variables: data[0].variables,
                updatedAt: data[0].updated_at
            };
        } catch (err) {
            console.error('[TemplateService] Create failed:', err);
            throw err;
        }
    },

    async updateTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        const payload = {
            title: template.title,
            slug: template.slug,
            version: template.version,
            language: template.language,
            status: template.status,
            use_letterhead: template.useLetterhead,
            content: template.content,
            variables: template.variables || [],
            updated_at: new Date().toISOString()
        };

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/form_templates?id=eq.${template.id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Update Failed ${response.status}`);
            const data = await response.json();

            if (!data || data.length === 0) return null;

            return { ...template, updatedAt: data[0].updated_at };
        } catch (err) {
            console.error('[TemplateService] Update failed:', err);
            throw err;
        }
    },

    async deleteTemplate(id: string): Promise<boolean> {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/form_templates?id=eq.${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            return response.ok;
        } catch (err) {
            console.error('[TemplateService] Delete failed:', err);
            return false;
        }
    }
};
