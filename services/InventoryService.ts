import { supabase } from '../src/lib/supabase';
import { InventoryItem } from '../types';

export class InventoryService {
    /**
     * Fetches all inventory items from the flat items table.
     */
    static async fetchAll(): Promise<InventoryItem[]> {
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('*')
            .order('name', { ascending: true });

        if (itemsError) throw itemsError;
        if (!items) return [];

        return items.map((item: any) => ({
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
    }

    /**
     * Creates or updates an inventory item using the items table.
     */
    static async createItem(item: Partial<InventoryItem>): Promise<InventoryItem | null> {
        const dbItem: any = {
            name: item.name,
            category: item.category,
            unit: item.unit || 'unit_each',
            stock: isNaN(Number(item.stock)) ? 0 : Number(item.stock),
            average_cost: isNaN(Number(item.averageCost)) ? 0 : Number(item.averageCost),
            min_stock: isNaN(Number(item.minStock)) ? 10 : Number(item.minStock),
            max_stock: isNaN(Number(item.maxStock)) ? 100 : Number(item.maxStock),
            expiry_date: (item.expiryDate && item.expiryDate.trim() !== '') ? item.expiryDate : null,
            batch_number: item.batchNumber || '',
            location: item.location || 'Unassigned',
            sku: item.sku || null,
            is_active: true
        };

        const { data, error } = await supabase
            .from('items')
            .upsert(dbItem, {
                onConflict: 'name,batch_number',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) throw error;
        if (!data) return null;

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
    }

    /**
     * Bulk imports items using a single upsert call.
     */
    static async importItems(items: Partial<InventoryItem>[]): Promise<number> {
        if (!items.length) return 0;

        const dbItems = items.map(item => ({
            name: (item.name || '').trim(),
            category: (item.category || 'General').trim(),
            unit: item.unit || 'unit_each',
            stock: isNaN(Number(item.stock)) ? 0 : Number(item.stock),
            average_cost: isNaN(Number(item.averageCost)) ? 0 : Number(item.averageCost),
            min_stock: isNaN(Number(item.minStock)) ? 10 : Number(item.minStock),
            max_stock: isNaN(Number(item.maxStock)) ? 100 : Number(item.maxStock),
            expiry_date: (item.expiryDate && item.expiryDate.trim() !== '') ? item.expiryDate : null,
            batch_number: (item.batchNumber || '').trim(),
            location: (item.location || 'Unassigned').trim(),
            sku: item.sku || null,
            is_active: true
        }));

        // Deduplicate locally before sending to Supabase
        const uniqueItems = Array.from(
            dbItems.reduce((map, item) => {
                const key = `${item.name.toLowerCase()}|${item.batch_number.toLowerCase()}`;
                if (!map.has(key)) map.set(key, item);
                return map;
            }, new Map<string, any>()).values()
        );

        const { data, error } = await supabase
            .from('items')
            .upsert(uniqueItems, {
                onConflict: 'name,batch_number',
                ignoreDuplicates: false
            })
            .select('id');

        if (error) throw error;
        return data ? data.length : 0;
    }
}
