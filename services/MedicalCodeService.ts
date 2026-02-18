import { supabase } from '../src/lib/supabase';
import { MedicalCode, CodeGroup, DBMedicalCode, DBCodeGroup } from '../types';

let _accessToken: string | null = null;
const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders() {
    if (!_accessToken) {
        console.warn('[MedicalCodeService] ⚠️ No access token! Operations may fail.');
    }
    return {
        'apikey': API_KEY,
        'Authorization': `Bearer ${_accessToken || API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

export const MedicalCodeService = {
    setAccessToken(token: string) {
        _accessToken = token;
    },

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
        try {
            if (!_accessToken) return [];

            const response = await fetch(`${API_URL}/medical_codes?select=*&order=name.asc`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (!data) return [];
            return (data || []).map(this.fromDBCode);
        } catch (error) {
            console.error('[MedicalCodeService] Fetch codes failed:', error);
            return [];
        }
    },

    async createCode(code: Partial<MedicalCode>): Promise<MedicalCode | null> {
        try {
            const dbCode = this.toDBCode(code);
            const response = await fetch(`${API_URL}/medical_codes`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(dbCode)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create code (${response.status}): ${text}`);
            }

            const data = await response.json();
            return data && data[0] ? this.fromDBCode(data[0]) : null;
        } catch (error) {
            console.error('[MedicalCodeService] Create code failed:', error);
            throw error;
        }
    },

    async updateCode(code: MedicalCode): Promise<MedicalCode | null> {
        try {
            const dbCode = this.toDBCode(code);
            const response = await fetch(`${API_URL}/medical_codes?id=eq.${code.id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(dbCode)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update code (${response.status}): ${text}`);
            }

            const data = await response.json();
            return data && data[0] ? this.fromDBCode(data[0]) : null;
        } catch (error) {
            console.error('[MedicalCodeService] Update code failed:', error);
            throw error;
        }
    },

    async deleteCode(id: string): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/medical_codes?id=eq.${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to delete code (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[MedicalCodeService] Delete code failed:', error);
            throw error;
        }
    },

    // --- GROUPS CRUD ---
    async fetchGroups(): Promise<CodeGroup[]> {
        try {
            if (!_accessToken) return [];

            const response = await fetch(`${API_URL}/code_groups?select=*&order=name.asc`, {
                headers: getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (!data) return [];
            return (data || []).map(this.fromDBGroup);
        } catch (error) {
            console.error('[MedicalCodeService] Fetch groups failed:', error);
            return [];
        }
    },

    async createGroup(group: Partial<CodeGroup>): Promise<CodeGroup | null> {
        try {
            const dbGroup = this.toDBGroup(group);
            const response = await fetch(`${API_URL}/code_groups`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(dbGroup)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create group (${response.status}): ${text}`);
            }

            const data = await response.json();
            return data && data[0] ? this.fromDBGroup(data[0]) : null;
        } catch (error) {
            console.error('[MedicalCodeService] Create group failed:', error);
            throw error;
        }
    },

    async updateGroup(group: CodeGroup): Promise<CodeGroup | null> {
        try {
            const dbGroup = this.toDBGroup(group);
            const response = await fetch(`${API_URL}/code_groups?id=eq.${group.id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(dbGroup)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update group (${response.status}): ${text}`);
            }

            const data = await response.json();
            return data && data[0] ? this.fromDBGroup(data[0]) : null;
        } catch (error) {
            console.error('[MedicalCodeService] Update group failed:', error);
            throw error;
        }
    },

    async deleteGroup(id: string): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/code_groups?id=eq.${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to delete group (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[MedicalCodeService] Delete group failed:', error);
            throw error;
        }
    }
};
