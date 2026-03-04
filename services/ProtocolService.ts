import { supabase } from '../src/lib/supabase';
import { Protocol, ProtocolAcknowledgment, ProtocolSeverity, ProtocolArea, ProtocolType } from '../types';

export const ProtocolService = {
    getProtocols: async (): Promise<Protocol[]> => {
        try {
            const { data, error } = await supabase
                .from('protocols')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(item => ({
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session');

            const { data, error } = await supabase
                .from('protocols')
                .insert([{
                    title: protocol.title,
                    content: protocol.content,
                    severity: protocol.severity,
                    area: protocol.area,
                    type: protocol.type,
                    requires_acknowledgment: protocol.requiresAcknowledgment,
                    created_by: session.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                title: data.title,
                content: data.content,
                severity: data.severity as ProtocolSeverity,
                area: data.area as ProtocolArea,
                type: data.type as ProtocolType,
                requiresAcknowledgment: data.requires_acknowledgment,
                createdBy: data.created_by,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
        } catch (error) {
            console.error('Error creating protocol:', error);
            return null;
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

            const { data, error } = await supabase
                .from('protocols')
                .update(dbUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return {
                id: data.id,
                title: data.title,
                content: data.content,
                severity: data.severity as ProtocolSeverity,
                area: data.area as ProtocolArea,
                type: data.type as ProtocolType,
                requiresAcknowledgment: data.requires_acknowledgment,
                createdBy: data.created_by,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
        } catch (error) {
            console.error('Error updating protocol:', error);
            return null;
        }
    },

    deleteProtocol: async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('protocols')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting protocol:', error);
            return false;
        }
    },

    getAcknowledgments: async (protocolId?: string): Promise<ProtocolAcknowledgment[]> => {
        try {
            let query = supabase.from('protocol_acknowledgments').select('*');
            if (protocolId) {
                query = query.eq('protocol_id', protocolId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data || []).map(item => ({
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session');

            const { error } = await supabase
                .from('protocol_acknowledgments')
                .insert([{
                    protocol_id: protocolId,
                    user_id: session.user.id
                }]);

            if (error) throw error;
            return true;
        } catch (error) {
            // if error code 23505 it's a unique violation (already acknowledged)
            if ((error as any).code === '23505') {
                return true;
            }
            console.error('Error acknowledging protocol:', error);
            return false;
        }
    }
};
