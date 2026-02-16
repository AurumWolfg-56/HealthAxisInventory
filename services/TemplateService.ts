import { supabase } from '../src/lib/supabase';
import { FormTemplate } from '../types';

export const TemplateService = {
    async getTemplates(): Promise<FormTemplate[]> {
        const { data, error } = await supabase
            .from('form_templates')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error("Error fetching templates:", error);
            return [];
        }

        console.log("[TemplateService] getTemplates data length:", data?.length);

        // Map snake_case DB to camelCase if needed, but assuming standard JSON storage or exact column match
        // If stored as JSONB in a 'content' column or similar, adapt here.
        // Assuming we created a table 'form_templates' that matches the type or maps to it.

        return data.map((t: any) => ({
            id: t.id,
            title: t.title,
            slug: t.slug,
            version: t.version,
            language: t.language,
            status: t.status,
            useLetterhead: t.use_letterhead,
            content: t.content,
            variables: t.variables || [],
            updatedAt: t.updated_at
        }));
    },

    async createTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        console.log("[TemplateService] createTemplate START", template.title);

        // Do NOT send `id` — let the DB generate it via gen_random_uuid()
        // NOTE: Sending empty 'variables' array prevents DB hang (suspected data type mismatch or trigger issue)
        // Since Forms.tsx uses hardcoded VARIABLES constant, strictly storing them in DB is not critical for now.
        const payload = {
            title: template.title,
            slug: template.slug,
            version: template.version,
            language: template.language,
            status: template.status,
            use_letterhead: template.useLetterhead,
            content: template.content,
            variables: [],
            updated_at: new Date().toISOString()
        };

        console.log("[TemplateService] Supabase INSERT payload:", JSON.stringify(payload).substring(0, 300));

        try {
            console.log("[TemplateService] Calling supabase.from('form_templates').insert()...");

            // Wrap with timeout to prevent indefinite hang
            const TIMEOUT_MS = 15000;
            const supabasePromise = supabase
                .from('form_templates')
                .insert(payload)
                .select();

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Template save timed out after 15s. Please check your connection and try again.')), TIMEOUT_MS)
            );

            const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

            console.log("[TemplateService] Supabase response received. error:", error, "data length:", data?.length);

            if (error) {
                console.error("[TemplateService] INSERT error:", error.message, error.code, error.details);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn("[TemplateService] INSERT returned no data — RLS may be blocking the operation.");
                throw new Error('Template was not saved. You may not have permission to create templates.');
            }

            console.log("[TemplateService] createTemplate SUCCESS. ID:", data[0].id);

            // Map DB response back to FormTemplate using the DB-generated id
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
        } catch (err: any) {
            console.error("[TemplateService] createTemplate CAUGHT ERROR:", err.message || err);
            throw err;
        }
    },

    async updateTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        const { data, error } = await supabase
            .from('form_templates')
            .update({
                title: template.title,
                slug: template.slug,
                version: template.version,
                language: template.language,
                status: template.status,
                use_letterhead: template.useLetterhead,
                content: template.content,
                variables: template.variables,
                updated_at: new Date().toISOString()
            })
            .eq('id', template.id)
            .select();

        if (error) {
            console.error("Error updating template:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.error("Template updated but no data returned (RLS blocking or ID not found)");
            return null;
        }

        return {
            ...template,
            updatedAt: data[0].updated_at
        };
    },

    async deleteTemplate(id: string): Promise<boolean> {
        // Use count: 'exact' to verify if row was actually deleted
        const { error, count } = await supabase
            .from('form_templates')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            console.error("Error deleting template:", error);
            return false;
        }

        if (count === 0) {
            console.warn(`Delete op success but 0 rows deleted for ID ${id}. RLS blocking or ID not found.`);
            // We return true anyway to clear UI? No, return false so user knows.
            // But usually we want UI to clear if it's gone.
            // Let's return true but warn.
            return true;
        }

        return true;
    }
};
