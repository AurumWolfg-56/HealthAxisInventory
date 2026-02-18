import { InventoryItem, ActivityLog } from '../types';

let _cachedToken: string | null = null;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders(): Record<string, string> {
    if (!_cachedToken) {
        throw new Error("No access token available. Please sign in again.");
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
}

export const InventoryService = {
    setAccessToken(token: string) {
        _cachedToken = token;
    },

    /**
     * Fetches all inventory items from the items table.
     */
    async fetchAll(): Promise<InventoryItem[]> {
        try {
            if (!_cachedToken) return []; // Allow initial load to fail silently if not auth'd yet, or better, return empty

            const response = await fetch(`${SUPABASE_URL}/rest/v1/items?select=*&order=name.asc`, {
                method: 'GET',
                headers: getHeaders()
            });

            if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`);

            const data = await response.json();

            return data.map((item: any) => ({
                id: item.id,
                name: item.name,
                category: item.category || 'General',
                stock: Number(item.stock || 0),
                unit: item.unit,
                averageCost: Number(item.average_cost || 0),
                minStock: Number(item.min_stock || 0),
                maxStock: Number(item.max_stock || 0),
                expiryDate: item.expiry_date || '',
                batchNumber: item.batch_number || '',
                location: item.location || 'Unassigned',
                lastChecked: item.last_checked,
                lastCheckedBy: item.last_checked_by,
                sku: item.sku || ''
            }));
        } catch (e) {
            console.error('[InventoryService] Fetch failed:', e);
            return [];
        }
    },

    /**
     * Creates a single inventory item.
     */
    async createItem(item: Partial<InventoryItem>): Promise<InventoryItem | null> {
        const dbItem = {
            name: item.name,
            category: item.category,
            unit: item.unit || 'unit_each',
            stock: Number(item.stock || 0),
            average_cost: Number(item.averageCost || 0),
            min_stock: Number(item.minStock || 10),
            max_stock: Number(item.maxStock || 100),
            expiry_date: (item.expiryDate && item.expiryDate.trim() !== '') ? item.expiryDate : null,
            batch_number: item.batchNumber || '',
            location: item.location || 'Unassigned',
            sku: item.sku || null,
            is_active: true
        };

        try {
            console.log('[InventoryService] Creating item...');
            const response = await fetch(`${SUPABASE_URL}/rest/v1/items`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(dbItem)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Create failed (${response.status}): ${text}`);
            }

            const result = await response.json();
            const data = result[0];

            return {
                id: data.id,
                name: data.name,
                category: data.category || 'General',
                stock: Number(data.stock || 0),
                unit: data.unit,
                averageCost: Number(data.average_cost || 0),
                minStock: Number(data.min_stock || 0),
                maxStock: Number(data.max_stock || 0),
                expiryDate: data.expiry_date || '',
                batchNumber: data.batch_number || '',
                location: data.location || 'Unassigned',
                lastChecked: data.last_checked,
                lastCheckedBy: data.last_checked_by,
                sku: data.sku || ''
            };
        } catch (e) {
            console.error('[InventoryService] Create failed:', e);
            throw e;
        }
    },

    /**
     * Updates an existing inventory item.
     */
    async updateItem(id: string, updates: Partial<InventoryItem>): Promise<boolean> {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
        if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
        if (updates.averageCost !== undefined) dbUpdates.average_cost = updates.averageCost;
        if (updates.minStock !== undefined) dbUpdates.min_stock = updates.minStock;
        if (updates.maxStock !== undefined) dbUpdates.max_stock = updates.maxStock;
        if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate || null;
        if (updates.batchNumber !== undefined) dbUpdates.batch_number = updates.batchNumber;
        if (updates.location !== undefined) dbUpdates.location = updates.location;
        if (updates.sku !== undefined) dbUpdates.sku = updates.sku;

        // Audit fields
        if (updates.lastChecked !== undefined) dbUpdates.last_checked = updates.lastChecked;
        if (updates.lastCheckedBy !== undefined) dbUpdates.last_checked_by = updates.lastCheckedBy;

        try {
            console.log(`[InventoryService] Updating item ${id}...`);
            const response = await fetch(`${SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(dbUpdates)
            });

            console.log(`[InventoryService] Update response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Update failed (${response.status}): ${text}`);
            }
            return true;
        } catch (e) {
            console.error('[InventoryService] Update failed:', e);
            throw e;
        }
    },

    /**
     * Bulk imports items.
     */
    async importItems(items: Partial<InventoryItem>[]): Promise<number> {
        if (!items.length) return 0;

        const dbItems = items.map(item => ({
            name: (item.name || '').trim(),
            category: (item.category || 'General').trim(),
            unit: item.unit || 'unit_each',
            stock: Number(item.stock || 0),
            average_cost: Number(item.averageCost || 0),
            min_stock: Number(item.minStock || 10),
            max_stock: Number(item.maxStock || 100),
            expiry_date: (item.expiryDate && item.expiryDate.trim() !== '') ? item.expiryDate : null,
            batch_number: (item.batchNumber || '').trim(),
            location: (item.location || 'Unassigned').trim(),
            sku: item.sku || null,
            is_active: true
        }));

        // Deduplicate logic
        const uniqueItems = Array.from(
            dbItems.reduce((map, item) => {
                const key = `${item.name.toLowerCase()}|${item.batch_number.toLowerCase()}`;
                if (!map.has(key)) map.set(key, item);
                return map;
            }, new Map<string, any>()).values()
        );

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/items?on_conflict=name,batch_number`, {
                method: 'POST',
                headers: {
                    ...getHeaders(),
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                },
                body: JSON.stringify(uniqueItems)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Import failed (${response.status}): ${text}`);
            }
            const result = await response.json();
            return result ? result.length : 0;
        } catch (e) {
            console.error('[InventoryService] Import failed:', e);
            throw e;
        }
    },

    /**
     * Log an action to audit_log
     */
    async logAction(userId: string, action: string, resourceId: string, details: any, newValue?: any, resource: string = 'inventory') {
        try {
            const logEntry = {
                user_id: userId,
                action: action,
                resource: resource,
                resource_id: resourceId,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                new_value: newValue || null,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(logEntry)
            });
            if (!response.ok) {
                const text = await response.text();
                console.warn(`[InventoryService] Failed to log audit (${response.status}): ${text}`);
            }
        } catch (e) {
            console.error('[InventoryService] Log failed', e);
        }
    }
};
