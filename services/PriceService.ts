import { supabase } from '../src/lib/supabase';
import { PriceItem, DBPrice } from '../types';

export class PriceService {

    static async fetchAll(): Promise<PriceItem[]> {
        const { data, error } = await supabase
            .from('prices')
            .select('*')
            .order('service_name', { ascending: true });

        if (error) throw error;
        if (!data) return [];

        return data.map(PriceService.mapFromDb);
    }

    static async createPrice(price: Omit<PriceItem, 'id'>): Promise<PriceItem | null> {
        const dbPrice: Omit<DBPrice, 'id' | 'created_at'> = {
            service_name: price.serviceName,
            price: price.price,
            category: price.category,
            code: price.code || null
        };

        const { data, error } = await supabase
            .from('prices')
            .insert([dbPrice])
            .select()
            .single();

        if (error) throw error;
        if (!data) throw new Error('Failed to create price item: No data returned from database');

        return PriceService.mapFromDb(data);
    }

    static async updatePrice(price: PriceItem): Promise<void> {
        const dbPrice: Partial<DBPrice> = {
            service_name: price.serviceName,
            price: price.price,
            category: price.category,
            code: price.code || null
        };

        const { error } = await supabase
            .from('prices')
            .update(dbPrice)
            .eq('id', price.id);

        if (error) throw error;
    }

    static async deletePrice(id: string): Promise<void> {
        const { error } = await supabase
            .from('prices')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    private static mapFromDb(db: DBPrice): PriceItem {
        return {
            id: db.id,
            serviceName: db.service_name,
            price: db.price,
            category: db.category,
            code: db.code || undefined
        };
    }
}
