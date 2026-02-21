import { Order, OrderItem, DBOrder, OrderStatus } from '../types';

export class OrderService {
    private static accessToken: string | null = null;
    private static apiUrl = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
    private static apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    static setAccessToken(token: string) {
        this.accessToken = token;
    }

    private static getHeaders() {
        if (!this.accessToken) {
            console.warn('[OrderService] ⚠️ No access token! Operations may fail.');
        }
        const headers: HeadersInit = {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.accessToken || this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        return headers;
    }

    static async fetchAll(): Promise<Order[]> {
        try {
            if (!this.accessToken) return [];

            // Fetch orders with their items using PostgREST resource embedding
            const response = await fetch(`${this.apiUrl}/orders?select=*,order_items(*)&order=created_at.desc`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            if (!data) return [];

            return data.map((order: any) => ({
                id: order.id,
                poNumber: order.po_number,
                vendor: order.vendor,
                orderDate: order.order_date,
                expectedDate: order.expected_arrival_date || '',
                status: order.status as OrderStatus,
                items: (order.order_items || []).map((i: any) => ({
                    id: i.id,
                    inventoryItemId: i.item_id || undefined,
                    name: i.item_name,
                    quantity: i.quantity,
                    unitCost: i.unit_cost,
                    unitType: i.unit_type,
                    total: i.line_total
                })),
                subtotal: order.subtotal,
                shippingCost: order.shipping_cost,
                totalTax: order.tax_total,
                grandTotal: order.grand_total,
                notes: order.notes || undefined,
                attachmentUrl: order.attachment_url || undefined,
                createdBy: order.created_by
            }));
        } catch (error) {
            console.error('[OrderService] Fetch failed:', error);
            return [];
        }
    }

    static async createOrder(order: Omit<Order, 'id'>, userId: string): Promise<Order | null> {
        try {
            console.log('[OrderService] Creating order...');
            // 1. Insert Order
            const dbOrder: Omit<DBOrder, 'id' | 'created_at' | 'received_at'> = {
                po_number: order.poNumber,
                vendor: order.vendor,
                order_date: order.orderDate,
                expected_arrival_date: order.expectedDate || null,
                status: order.status,
                subtotal: order.subtotal,
                tax_total: order.totalTax,
                shipping_cost: order.shippingCost,
                grand_total: order.grandTotal,
                notes: order.notes || null,
                attachment_url: order.attachmentUrl || null,
                created_by: userId
            };

            const orderResponse = await fetch(`${this.apiUrl}/orders`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(dbOrder)
            });

            if (!orderResponse.ok) {
                const text = await orderResponse.text();
                throw new Error(`Failed to create order (${orderResponse.status}): ${text}`);
            }
            const savedOrder = await orderResponse.json();
            const orderId = savedOrder[0].id;

            // 2. Insert Items
            const dbItems = order.items.map(item => ({
                order_id: orderId,
                item_id: item.inventoryItemId || null,
                item_name: item.name,
                quantity: item.quantity,
                unit_cost: item.unitCost,
                unit_type: item.unitType,
                line_total: item.total
            }));

            const itemsResponse = await fetch(`${this.apiUrl}/order_items`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(dbItems)
            });

            if (!itemsResponse.ok) {
                // Rollback: Delete the created order
                console.error('[OrderService] Item creation failed, rolling back order...');
                await fetch(`${this.apiUrl}/orders?id=eq.${orderId}`, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });
                const text = await itemsResponse.text();
                throw new Error(`Failed to create order items (${itemsResponse.status}): ${text}`);
            }

            const savedItems = await itemsResponse.json();

            // 3. Return complete object
            return {
                ...order,
                id: orderId,
                items: savedItems.map((i: any) => ({
                    id: i.id,
                    inventoryItemId: i.item_id || undefined,
                    name: i.item_name,
                    quantity: i.quantity,
                    unitCost: i.unit_cost,
                    unitType: i.unit_type,
                    total: i.line_total
                }))
            };
        } catch (error) {
            console.error('[OrderService] Create failed:', error);
            throw error;
        }
    }

    static async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
        try {
            console.log(`[OrderService] Updating status for ${orderId}...`);
            const response = await fetch(`${this.apiUrl}/orders?id=eq.${orderId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update status (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[OrderService] Update status failed:', error);
            throw error;
        }
    }

    /**
     * Marks an order as RECEIVED and records the exact received_at timestamp.
     * This is CRITICAL for the Intelligence Engine to build purchase cycles.
     */
    static async receiveOrder(orderId: string): Promise<void> {
        try {
            console.log(`[OrderService] Receiving order ${orderId}...`);
            const response = await fetch(`${this.apiUrl}/orders?id=eq.${orderId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    status: 'RECEIVED',
                    received_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to receive order (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[OrderService] Receive order failed:', error);
            throw error;
        }
    }

    /**
     * Back-fills the item_id on an order_items row after a new inventory item is created.
     * This ensures future order fetches can link the line back to the inventory item.
     */
    static async updateOrderItemLink(orderItemId: string, inventoryItemId: string): Promise<void> {
        try {
            const response = await fetch(`${this.apiUrl}/order_items?id=eq.${orderItemId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ item_id: inventoryItemId })
            });
            if (!response.ok) {
                const text = await response.text();
                console.warn(`[OrderService] Failed to back-fill item_id (${response.status}): ${text}`);
            }
        } catch (error) {
            console.warn('[OrderService] updateOrderItemLink failed (non-critical):', error);
        }
    }

    static async deleteOrder(orderId: string): Promise<void> {
        try {
            console.log(`[OrderService] Deleting order ${orderId}...`);
            const response = await fetch(`${this.apiUrl}/orders?id=eq.${orderId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to delete order (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[OrderService] Delete order failed:', error);
            throw error;
        }
    }
}
