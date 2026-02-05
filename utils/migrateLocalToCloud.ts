import { supabase } from '../src/lib/supabase';
import { InventoryItem } from '../types';

const STORAGE_KEYS = {
    INVENTORY: 'ha_inventory',
};

export const migrateLocalToCloud = async (userId: string) => {
    try {
        const rawInv = localStorage.getItem(STORAGE_KEYS.INVENTORY);
        if (!rawInv) return { success: true, message: 'No local data to migrate.' };

        const items: InventoryItem[] = JSON.parse(rawInv);
        console.log(`[Migration] Found ${items.length} items in localStorage.`);

        let successCount = 0;
        let failCount = 0;

        for (const item of items) {
            // 1. Check if item exists (by SKU/Name) to avoid duplicates
            // Ideally we use SKU, but valid fallback is Name
            const { data: existing } = await supabase
                .from('items')
                .select('id')
                .eq('name', item.name)
                .single();

            if (existing) {
                console.log(`[Migration] Item ${item.name} already exists. Skipping.`);
                continue;
            }

            // 2. Insert Category (if needed) - simplified to default UUID for now or lookup
            // For MVP migration, we skip strict category relations or map them roughly

            // 3. Insert Item
            const { data: newItem, error: itemError } = await supabase
                .from('items')
                .insert({
                    name: item.name,
                    category: item.category,
                    unit: item.unit || 'unit_each',
                    stock: item.stock || 0,
                    average_cost: item.averageCost || 0,
                    min_stock: item.minStock || 0,
                    max_stock: item.maxStock || 0,
                    expiry_date: item.expiryDate || null,
                    batch_number: item.batchNumber || '',
                    location: item.location || '',
                    category_id: null
                })
                .select()
                .single();

            if (itemError || !newItem) {
                console.error(`[Migration] Failed to insert item ${item.name}`, itemError);
                failCount++;
                continue;
            }

            // 4. Insert Default Stock Level & Location
            // Create a default location if not exists
            const locationName = item.location || 'Main Storage';

            // Get or Create Location
            let locationId: string | undefined;
            const { data: locData } = await supabase.from('locations').select('id').eq('name', locationName).single();
            if (locData) {
                locationId = locData.id;
            } else {
                const { data: newLoc } = await supabase.from('locations').insert({ name: locationName }).select().single();
                locationId = newLoc?.id;
            }

            if (locationId) {
                await supabase.from('stock_levels').insert({
                    item_id: newItem.id,
                    location_id: locationId,
                    quantity: item.stock
                });
            }

            // 5. Insert Batch/Expiry (Lots)
            if (item.batchNumber) {
                await supabase.from('lots').insert({
                    item_id: newItem.id,
                    lot_number: item.batchNumber,
                    expiration_date: item.expiryDate || null
                });
            }

            successCount++;
        }

        return {
            success: true,
            message: `Migration Complete. Migrated: ${successCount}, Failed: ${failCount}, Skipped: ${items.length - successCount - failCount}`
        };

    } catch (e: any) {
        console.error('[Migration] Critical Failure:', e);
        return { success: false, message: e.message };
    }
};
