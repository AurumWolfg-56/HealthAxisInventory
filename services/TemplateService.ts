import { supabase } from '../src/lib/supabase';
import { FormTemplate } from '../types';

export const TemplateService = {
    async getTemplates(): Promise<FormTemplate[]> {
        // Standard fetch with reasonable timeout to prevent hangs
        const TIMEOUT_MS = 20000;

        const fetchPromise = supabase
            .from('form_templates')
            .select('*')
            .order('created_at', { ascending: false });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Template fetch timed out (20s)')), TIMEOUT_MS)
        );

        try {
            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) throw error;

            return (data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                slug: t.slug,
                version: t.version,
                language: t.language,
                status: t.status,
                useLetterhead: t.use_letterhead,
                content: t.content,
                // Handle JSONB variables safely
                variables: Array.isArray(t.variables) ? t.variables : [],
                updatedAt: t.updated_at
            }));
        } catch (error) {
            console.error('[TemplateService] Error:', error);
            // Return empty array instead of throwing to prevent app crash, but log error
            return [];
        }
    },

    async createTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        console.log("[TemplateService] Creating:", template.title);

        const payload = {
            title: template.title,
            slug: template.slug,
            version: template.version,
            language: template.language,
            status: template.status,
            use_letterhead: template.useLetterhead,
            content: template.content,
            // Now safe to send actual variables thanks to JSONB
            variables: template.variables || [],
            updated_at: new Date().toISOString()
        };

        try {
            const { data, error } = await supabase
                .from('form_templates')
                .insert(payload)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No data returned from INSERT');

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
            console.error("[TemplateService] Create Error:", err);
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

        const { data, error } = await supabase
            .from('form_templates')
            .update(payload)
            .eq('id', template.id)
            .select();

        if (error) {
            console.error("[TemplateService] Update Error:", error);
            throw error;
        }

        if (!data || data.length === 0) return null;

        return {
            ...template,
            updatedAt: data[0].updated_at
        };
    },

    async deleteTemplate(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('form_templates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("[TemplateService] Delete Error:", error);
            return false;
        }
        return true;
    }
};

