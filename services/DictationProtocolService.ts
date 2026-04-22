import { DictationProtocol } from '../types';

export class DictationProtocolService {
    private static accessToken: string | null = null;
    private static apiUrl = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
    private static apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    static setAccessToken(token: string) {
        this.accessToken = token;
    }

    private static getHeaders() {
        return {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.accessToken || this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    static async fetchAll(): Promise<DictationProtocol[]> {
        try {
            if (!this.accessToken) return [];

            const response = await fetch(`${this.apiUrl}/dictation_protocols?order=name.asc`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            if (!data) return [];
            
            return data.map((p: any) => ({
                id: p.id,
                name: p.name,
                keywords: p.keywords || [],
                items: p.items || []
            }));
        } catch (error) {
            console.error('[DictationProtocolService] Fetch failed:', error);
            return [];
        }
    }

    static async createProtocol(protocol: Omit<DictationProtocol, 'id'>, userId: string): Promise<DictationProtocol | null> {
        try {
            const dbProtocol = {
                name: protocol.name,
                keywords: protocol.keywords,
                items: protocol.items,
                created_by: userId
            };

            const response = await fetch(`${this.apiUrl}/dictation_protocols`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(dbProtocol)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create protocol: ${text}`);
            }

            const saved = await response.json();
            return {
                id: saved[0].id,
                name: saved[0].name,
                keywords: saved[0].keywords || [],
                items: saved[0].items || []
            };
        } catch (error) {
            console.error('[DictationProtocolService] Create failed:', error);
            throw error;
        }
    }

    static async updateProtocol(id: string, protocol: Partial<DictationProtocol>): Promise<void> {
        try {
            const dbProtocol: any = {};
            if (protocol.name !== undefined) dbProtocol.name = protocol.name;
            if (protocol.keywords !== undefined) dbProtocol.keywords = protocol.keywords;
            if (protocol.items !== undefined) dbProtocol.items = protocol.items;

            const response = await fetch(`${this.apiUrl}/dictation_protocols?id=eq.${id}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify(dbProtocol)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update protocol: ${text}`);
            }
        } catch (error) {
            console.error('[DictationProtocolService] Update failed:', error);
            throw error;
        }
    }

    static async deleteProtocol(id: string): Promise<void> {
        try {
            const response = await fetch(`${this.apiUrl}/dictation_protocols?id=eq.${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to delete protocol: ${text}`);
            }
        } catch (error) {
            console.error('[DictationProtocolService] Delete failed:', error);
            throw error;
        }
    }
}
