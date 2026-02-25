import { supabase } from '../src/lib/supabase';
import { PriceItem, DBPrice } from '../types';

export class PriceService {
    private static accessToken: string | null = null;
    private static apiUrl = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
    private static apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    static setAccessToken(token: string) {
        this.accessToken = token;
    }

    private static getHeaders() {
        if (!this.accessToken) {
            console.warn('[PriceService] ⚠️ No access token! Operations may fail.');
        }
        return {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.accessToken || this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    static async fetchAll(): Promise<PriceItem[]> {
        try {
            if (!this.accessToken) return [];

            const response = await fetch(`${this.apiUrl}/prices?select=*&order=service_name.asc`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (!data) return [];
            return data.map(PriceService.mapFromDb);
        } catch (error) {
            console.error('[PriceService] Fetch failed:', error);
            return [];
        }
    }

    static async createPrice(price: Omit<PriceItem, 'id'>): Promise<PriceItem | null> {
        try {
            const dbPrice: Omit<DBPrice, 'id' | 'created_at'> = {
                service_name: price.serviceName,
                price: price.price,
                category: price.category,
                code: price.code || null,
                type: price.type || 'individual',
                is_featured: price.isFeatured || false
            };

            const response = await fetch(`${this.apiUrl}/prices`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(dbPrice)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create price (${response.status}): ${text}`);
            }

            const data = await response.json();
            return PriceService.mapFromDb(data[0]);

        } catch (error) {
            console.error('[PriceService] Create failed:', error);
            throw error;
        }
    }

    static async updatePrice(price: PriceItem): Promise<void> {
        try {
            const dbPrice: Partial<DBPrice> = {
                service_name: price.serviceName,
                price: price.price,
                category: price.category,
                code: price.code || null,
                type: price.type || 'individual',
                is_featured: price.isFeatured ?? false
            };

            const response = await fetch(`${this.apiUrl}/prices?id=eq.${price.id}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify(dbPrice)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update price (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[PriceService] Update failed:', error);
            throw error;
        }
    }

    static async deletePrice(id: string): Promise<void> {
        try {
            const response = await fetch(`${this.apiUrl}/prices?id=eq.${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to delete price (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[PriceService] Delete failed:', error);
            throw error;
        }
    }

    static async toggleFeatured(id: string, isFeatured: boolean): Promise<void> {
        try {
            const response = await fetch(`${this.apiUrl}/prices?id=eq.${id}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({ is_featured: isFeatured })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to toggle featured (${response.status}): ${text}`);
            }
        } catch (error) {
            console.error('[PriceService] Toggle featured failed:', error);
            throw error;
        }
    }

    /**
     * Bulk import prices in a single request (or batched chunks).
     * Much faster than inserting one-by-one for large imports.
     */
    static async importPrices(prices: Omit<PriceItem, 'id'>[]): Promise<PriceItem[]> {
        if (!prices.length) return [];

        const BATCH_SIZE = 200; // Supabase handles this well
        const allResults: PriceItem[] = [];

        for (let i = 0; i < prices.length; i += BATCH_SIZE) {
            const batch = prices.slice(i, i + BATCH_SIZE);
            const dbPrices = batch.map(p => ({
                service_name: (p.serviceName || '').trim(),
                price: Number(p.price || 0),
                category: (p.category || 'General').trim(),
                code: p.code?.trim() || null,
                type: p.type || 'individual'
            }));

            try {
                const response = await fetch(`${this.apiUrl}/prices`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(dbPrices)
                });

                if (!response.ok) {
                    const text = await response.text();
                    console.error(`[PriceService] Batch ${i / BATCH_SIZE + 1} failed:`, text);
                    continue;
                }

                const data = await response.json();
                if (data) {
                    allResults.push(...data.map(PriceService.mapFromDb));
                }
            } catch (err) {
                console.error(`[PriceService] Batch ${i / BATCH_SIZE + 1} error:`, err);
            }
        }

        console.log(`[PriceService] Bulk import complete: ${allResults.length}/${prices.length} items`);
        return allResults;
    }

    private static mapFromDb(db: DBPrice): PriceItem {
        return {
            id: db.id,
            serviceName: db.service_name,
            price: db.price,
            category: db.category,
            code: db.code || undefined,
            type: (db.type as 'individual' | 'combo') || 'individual',
            isFeatured: db.is_featured || false
        };
    }
}
