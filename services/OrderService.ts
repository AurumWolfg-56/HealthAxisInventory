import { supabase } from '../src/lib/supabase';
import { Order, OrderItem, DBOrder, OrderStatus } from '../types';

export class OrderService {
    static async fetchAll(): Promise<Order[]> {
        // 1. Fetch Orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        if (!orders || orders.length === 0) return [];

        // 2. Fetch Order Items
        const orderIds = orders.map(o => o.id);
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);

        if (itemsError) throw itemsError;

        // 3. Map to UI Model
        return orders.map(order => {
            const orderItems = items?.filter(i => i.order_id === order.id) || [];

            const mappedItems: OrderItem[] = orderItems.map(i => ({
                id: i.id,
                inventoryItemId: i.item_id || undefined,
                name: i.item_name,
                quantity: i.quantity,
                unitCost: i.unit_cost,
                unitType: i.unit_type,
                total: i.line_total
            }));

            return {
                id: order.id,
                poNumber: order.po_number,
                vendor: order.vendor,
                orderDate: order.order_date,
                expectedDate: order.expected_arrival_date || '',
                status: order.status as OrderStatus,
                items: mappedItems,
                subtotal: order.subtotal,
                shippingCost: order.shipping_cost,
                totalTax: order.tax_total,
                grandTotal: order.grand_total,
                notes: order.notes || undefined,
                attachmentUrl: order.attachment_url || undefined,
                createdBy: order.created_by // Map from DB
            };
        });
    }

    static async createOrder(order: Omit<Order, 'id'>, userId: string): Promise<Order | null> {
        // 1. Insert Order
        const dbOrder: Omit<DBOrder, 'id' | 'created_at'> = {
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

        const { data: savedOrder, error: orderError } = await supabase
            .from('orders')
            .insert([dbOrder])
            .select()
            .single();

        if (orderError) throw orderError;
        if (!savedOrder) throw new Error('Failed to create order record');

        // 2. Insert Items
        const dbItems = order.items.map(item => ({
            order_id: savedOrder.id,
            item_id: item.inventoryItemId || null,
            item_name: item.name,
            quantity: item.quantity,
            unit_cost: item.unitCost,
            unit_type: item.unitType,
            line_total: item.total
        }));

        const { data: savedItems, error: itemsError } = await supabase
            .from('order_items')
            .insert(dbItems)
            .select();

        if (itemsError) {
            // Rollback order creation if items fail
            await supabase.from('orders').delete().eq('id', savedOrder.id);
            throw itemsError;
        }

        // 3. Return complete object
        return {
            ...order,
            id: savedOrder.id,
            items: savedItems!.map((i: any) => ({
                id: i.id,
                inventoryItemId: i.item_id || undefined,
                name: i.item_name,
                quantity: i.quantity,
                unitCost: i.unit_cost,
                unitType: i.unit_type,
                total: i.line_total
            }))
        };
    }

    static async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);

        if (error) throw error;
    }

    static async deleteOrder(orderId: string): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) throw error;
    }
}
