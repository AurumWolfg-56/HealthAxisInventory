import { Protocol, ProtocolAcknowledgment, ProtocolSeverity, ProtocolArea, ProtocolType } from '../types';

let _cachedToken: string | null = null;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders(): Record<string, string> {
    if (!_cachedToken) {
        console.warn('[ProtocolService] ⚠️ No cached token! setAccessToken() should be called.');
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation'
    };
}

export const ProtocolService = {
    setAccessToken(token: string) {
        _cachedToken = token;
        console.log('[ProtocolService] 🔑 Access token cached');
    },

    getProtocols: async (): Promise<Protocol[]> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${SUPABASE_URL}/rest/v1/protocols?select=*&order=created_at.desc`, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`REST Error ${response.status}`);
            const data = await response.json();

            return (data || []).map((item: any) => ({
                id: item.id,
                title: item.title,
                content: item.content,
                severity: item.severity as ProtocolSeverity,
                area: item.area as ProtocolArea,
                type: item.type as ProtocolType,
                requiresAcknowledgment: item.requires_acknowledgment,
                createdBy: item.created_by,
                createdAt: item.created_at,
                updatedAt: item.updated_at
            }));
        } catch (error) {
            console.error('Error fetching protocols:', error);
            return [];
        }
    },

    createProtocol: async (protocol: Omit<Protocol, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<Protocol | null> => {
        try {
            const payload = {
                title: protocol.title,
                content: protocol.content,
                severity: protocol.severity,
                area: protocol.area,
                type: protocol.type,
                requires_acknowledgment: protocol.requiresAcknowledgment
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${SUPABASE_URL}/rest/v1/protocols`, {
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
            const item = data[0];

            return {
                id: item.id,
                title: item.title,
                content: item.content,
                severity: item.severity as ProtocolSeverity,
                area: item.area as ProtocolArea,
                type: item.type as ProtocolType,
                requiresAcknowledgment: item.requires_acknowledgment,
                createdBy: item.created_by,
                createdAt: item.created_at,
                updatedAt: item.updated_at
            };
        } catch (error) {
            console.error('Error creating protocol:', error);
            throw error;
        }
    },

    updateProtocol: async (id: string, updates: Partial<Protocol>): Promise<Protocol | null> => {
        try {
            const dbUpdates: any = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.content !== undefined) dbUpdates.content = updates.content;
            if (updates.severity !== undefined) dbUpdates.severity = updates.severity;
            if (updates.area !== undefined) dbUpdates.area = updates.area;
            if (updates.type !== undefined) dbUpdates.type = updates.type;
            if (updates.requiresAcknowledgment !== undefined) dbUpdates.requires_acknowledgment = updates.requiresAcknowledgment;
            dbUpdates.updated_at = new Date().toISOString();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${SUPABASE_URL}/rest/v1/protocols?id=eq.${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(dbUpdates),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Update Failed ${response.status}: ${await response.text()}`);
            const data = await response.json();

            if (!data || data.length === 0) return null;
            const item = data[0];

            return {
                id: item.id,
                title: item.title,
                content: item.content,
                severity: item.severity as ProtocolSeverity,
                area: item.area as ProtocolArea,
                type: item.type as ProtocolType,
                requiresAcknowledgment: item.requires_acknowledgment,
                createdBy: item.created_by,
                createdAt: item.created_at,
                updatedAt: item.updated_at
            };
        } catch (error) {
            console.error('Error updating protocol:', error);
            throw error;
        }
    },

    deleteProtocol: async (id: string): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${SUPABASE_URL}/rest/v1/protocols?id=eq.${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            return response.ok;
        } catch (error) {
            console.error('Error deleting protocol:', error);
            return false;
        }
    },

    getAcknowledgments: async (protocolId?: string): Promise<ProtocolAcknowledgment[]> => {
        try {
            let url = `${SUPABASE_URL}/rest/v1/protocol_acknowledgments?select=*`;
            if (protocolId) {
                url += `&protocol_id=eq.${protocolId}`;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Fetch Acks Failed ${response.status}`);
            const data = await response.json();

            return (data || []).map((item: any) => ({
                protocolId: item.protocol_id,
                userId: item.user_id,
                acknowledgedAt: item.acknowledged_at
            }));
        } catch (error) {
            console.error('Error fetching acknowledgments:', error);
            return [];
        }
    },

    acknowledgeProtocol: async (protocolId: string): Promise<boolean> => {
        try {
            const payload = {
                protocol_id: protocolId
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${SUPABASE_URL}/rest/v1/protocol_acknowledgments`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                // Return true if it's just a duplicate (they already acknowledged it)
                if (response.status === 409) return true;
                const text = await response.text();
                // 409 Conflict can sometimes show up dynamically depending on DB violation text
                if (text.includes('23505') || text.includes('unique violation')) {
                    return true;
                }
                throw new Error(`Acknowledge Failed ${response.status}: ${text}`);
            }

            return true;
        } catch (error) {
            console.error('Error acknowledging protocol:', error);
            return false;
        }
    }
};
