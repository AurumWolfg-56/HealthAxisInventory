import { InventoryItem } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const NotificationService = {
    /**
     * Checks if stock crossed the minimum threshold downwards,
     * and if so, sends a low stock alert email.
     */
    async checkAndSendLowStockAlert(oldItem: InventoryItem | undefined, newItem: InventoryItem): Promise<void> {
        try {
            // Only send if it just dropped below minStock
            const wasAboveMin = oldItem ? oldItem.stock > oldItem.minStock : true;
            const isNowBelowMin = newItem.stock <= newItem.minStock;

            if (wasAboveMin && isNowBelowMin) {
                console.log(`[NotificationService] Stock for ${newItem.name} dropped below min. Sending alert...`);
                
                const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'inventory_alert',
                        data: {
                            name: newItem.name,
                            stock: newItem.stock,
                            min_stock: newItem.minStock,
                            location_id: newItem.location
                        }
                    })
                });

                if (!response.ok) {
                    console.error('[NotificationService] Failed to send inventory alert:', await response.text());
                } else {
                    console.log('[NotificationService] Inventory alert sent successfully.');
                }
            }
        } catch (e) {
            console.error('[NotificationService] Error sending inventory alert:', e);
        }
    },

    /**
     * Scans the provided inventory items for products expiring within 30 days
     * and sends a batch alert email.
     */
    async sendExpiryAlertBatch(items: InventoryItem[]): Promise<void> {
        try {
            const now = new Date().getTime();
            const thirtyDaysFromNow = now + (30 * 24 * 60 * 60 * 1000);

            // Find items expiring within 30 days
            const expiringItems = items.filter(i => {
                if (!i.expiryDate) return false;
                const expiryTime = new Date(i.expiryDate).getTime();
                return expiryTime > 0 && expiryTime <= thirtyDaysFromNow && i.stock > 0;
            });

            if (expiringItems.length === 0) {
                console.log('[NotificationService] No items expiring within 30 days. Skipping email.');
                return;
            }

            console.log(`[NotificationService] Found ${expiringItems.length} items expiring soon. Sending batch alert...`);

            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'expiry_alert',
                    data: {
                        items: expiringItems.map(i => ({
                            name: i.name,
                            expiry_date: i.expiryDate,
                            stock: i.stock
                        }))
                    }
                })
            });

            if (!response.ok) {
                console.error('[NotificationService] Failed to send expiry alert:', await response.text());
            } else {
                console.log('[NotificationService] Expiry alert sent successfully.');
            }
        } catch (e) {
            console.error('[NotificationService] Error sending expiry alert:', e);
        }
    }
};
