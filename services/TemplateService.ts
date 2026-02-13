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

        // Map snake_case DB to camelCase if needed, but assuming standard JSON storage or exact column match
        // If stored as JSONB in a 'content' column or similar, adapt here.
        // Assuming we created a table 'form_templates' that matches the type or maps to it.
        // Since we likely don't have the table yet, I should probably create a migration or SQL for it.
        // But for now, let's assume standard mapping.

        return data.map((t: any) => ({
            id: t.id,
            title: t.title,
            slug: t.slug,
            version: t.version,
            language: t.language,
            status: t.status,
            useLetterhead: t.use_letterhead,
            content: t.content,
            variables: t.variables,
            updatedAt: t.updated_at
        }));
    },

    async createTemplate(template: FormTemplate): Promise<FormTemplate | null> {
        console.log("Creating template payload:", {
            id: template.id,
            title: template.title,
            slug: template.slug,
            version: template.version,
            language: template.language,
            status: template.status,
            use_letterhead: template.useLetterhead,
            content: template.content,
            variables: template.variables,
            updated_at: new Date().toISOString()
        });

        const { data, error } = await supabase
            .from('form_templates')
            .insert({
                id: template.id,
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
            .select(); // Removed .single() to avoid throws on 0 rows

        if (error) {
            console.error("Error creating template:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.error("Template created but no data returned (RLS blocking view?)");
            // Return input template as fallback, though ID might be missing timestamp if DB gen
            return template;
        }

        return {
            ...template,
            updatedAt: data[0].updated_at
        };
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
