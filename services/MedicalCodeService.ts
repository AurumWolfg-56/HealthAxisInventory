import { supabase } from '../src/lib/supabase';
import { MedicalCode, CodeGroup, DBMedicalCode, DBCodeGroup } from '../types';

export const MedicalCodeService = {
    // --- MAPPERS ---
    fromDBCode(db: DBMedicalCode): MedicalCode {
        return {
            id: db.id,
            name: db.name,
            cptCode: db.cpt_code,
            labCode: db.lab_code,
            adminCode: db.admin_code
        };
    },

    toDBCode(code: Partial<MedicalCode>): Partial<DBMedicalCode> {
        return {
            name: code.name,
            cpt_code: code.cptCode,
            lab_code: code.labCode,
            admin_code: code.adminCode
        };
    },

    fromDBGroup(db: DBCodeGroup): CodeGroup {
        return {
            id: db.id,
            name: db.name,
            description: db.description,
            codeIds: db.code_ids || []
        };
    },

    toDBGroup(group: Partial<CodeGroup>): Partial<DBCodeGroup> {
        return {
            name: group.name,
            description: group.description,
            code_ids: group.codeIds
        };
    },

    // --- CODES CRUD ---
    async fetchCodes(): Promise<MedicalCode[]> {
        const { data, error } = await supabase
            .from('medical_codes')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(this.fromDBCode);
    },

    async createCode(code: Partial<MedicalCode>): Promise<MedicalCode | null> {
        const dbCode = this.toDBCode(code);
        const { data, error } = await supabase
            .from('medical_codes')
            .insert([dbCode])
            .select()
            .single();

        if (error) throw error;
        return data ? this.fromDBCode(data) : null;
    },

    async updateCode(code: MedicalCode): Promise<MedicalCode | null> {
        const dbCode = this.toDBCode(code);
        const { data, error } = await supabase
            .from('medical_codes')
            .update(dbCode)
            .eq('id', code.id)
            .select()
            .single();

        if (error) throw error;
        return data ? this.fromDBCode(data) : null;
    },

    async deleteCode(id: string): Promise<void> {
        const { error } = await supabase
            .from('medical_codes')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // --- GROUPS CRUD ---
    async fetchGroups(): Promise<CodeGroup[]> {
        const { data, error } = await supabase
            .from('code_groups')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return (data || []).map(this.fromDBGroup);
    },

    async createGroup(group: Partial<CodeGroup>): Promise<CodeGroup | null> {
        const dbGroup = this.toDBGroup(group);
        const { data, error } = await supabase
            .from('code_groups')
            .insert([dbGroup])
            .select()
            .single();

        if (error) throw error;
        return data ? this.fromDBGroup(data) : null;
    },

    async updateGroup(group: CodeGroup): Promise<CodeGroup | null> {
        const dbGroup = this.toDBGroup(group);
        const { data, error } = await supabase
            .from('code_groups')
            .update(dbGroup)
            .eq('id', group.id)
            .select()
            .single();

        if (error) throw error;
        return data ? this.fromDBGroup(data) : null;
    },

    async deleteGroup(id: string): Promise<void> {
        const { error } = await supabase
            .from('code_groups')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
