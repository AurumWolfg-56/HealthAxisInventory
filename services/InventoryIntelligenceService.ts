
import { supabase } from '../src/lib/supabase';
import { InventoryItem, DBIntelligenceOverride, ItemMetrics } from '../types';
import { jsonChat } from './LocalAIService';

// ─────────────────────────────────────────────────────────────────────────────
// Exported Governance Constants
// The Verification Suite imports these directly — never hardcode in tests.
// ─────────────────────────────────────────────────────────────────────────────
export const ENGINE_BUFFER_DAYS = 5;
export const ENGINE_CRITICALITY_FACTOR = 1.2; // Capital cap multiplier
export const ENGINE_ROLLING_WINDOW = 3;        // Max cycles used for prediction

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────
interface PurchaseCycle {
    startDate: Date;
    endDate: Date;
    durationDays: number;
    quantityConsumed: number;
    usageRate: number;
    isAnomaly: boolean;
    anomalyReason?: 'PANIC_BUY' | 'HOARDING' | 'PREMATURE' | 'UNDER_CONSUMPTION' | 'OVERRIDE';
    isOverride?: boolean;
    startStock: number;
    endStock: number;
    source: 'CONSUMED_LOGS' | 'SNAPSHOT' | 'FALLBACK_ORDER_QTY';
}

export interface AIOrderDraftResponse {
    strategyNotes: string;
    prioritizedCart: {
        categoryName: 'Clinical Vital (Order Today)' | 'Secondary Consumable (Order This Week)' | 'Review Only (Expiring)';
        items: {
            itemId: string;
            itemName: string;
            proposedQuantity: number;
            aiJustification: string;
        }[];
    }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
export class InventoryIntelligenceService {

    // ── Core Public Method (Updated for Fast Actionability based on Rules) ──
    static async calculateItemMetrics(
        item: InventoryItem,
        options?: { targetCoverageCycles?: number }
    ): Promise<ItemMetrics> {
        try {
            const minStock = item.minStock || 5;
            const maxStock = item.maxStock || minStock * 3;
            const leadTime = item.leadTime || 7;

            let status: ItemMetrics['status'] = 'HEALTHY';
            let recommendedQuantity = 0;
            let anomaliesDetected = 0;
            let isVolatile = false;

            // 1. Check Expiration
            const now = new Date();
            let daysUntilExpiry = Infinity;
            if (item.expiryDate) {
                const expiryDate = new Date(item.expiryDate);
                daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / 86400000;
                
                if (daysUntilExpiry < 0) {
                    anomaliesDetected += 1; // It has expired
                } else if (daysUntilExpiry <= 30) {
                    isVolatile = true; // Flag as volatile if expiring within 30 days
                }
            }

            // 2. Evaluate Status based on thresholds
            // CRITICAL: Stock is below or equal to minStock
            // ORDER_SOON: Stock is below minStock * 1.5
            // OVERSTOCK: Stock is way above maxStock
            if (item.stock <= minStock) {
                status = 'CRITICAL';
                recommendedQuantity = Math.max(0, maxStock - item.stock);
            } else if (item.stock <= minStock * 1.5) {
                status = 'ORDER_SOON';
                recommendedQuantity = Math.max(0, maxStock - item.stock);
            } else if (item.stock >= maxStock) {
                status = 'OVERSTOCK';
            }

            // If it's about to expire, it overrides and becomes CRITICAL
            if (daysUntilExpiry <= 30 && status !== 'CRITICAL') {
                status = 'CRITICAL';
                // We assume we need to replace all stock that is about to expire
                recommendedQuantity = maxStock;
            }

            return {
                itemId: item.id,
                itemName: item.name,
                currentStock: item.stock,
                dailyUsageRate: 0,
                predictedCycleDuration: 30, // Placeholder
                daysRemaining: status === 'CRITICAL' ? 0 : (daysUntilExpiry !== Infinity ? daysUntilExpiry : 999), 
                recommendedReorderDate: status === 'CRITICAL' ? new Date() : null,
                recommendedQuantity,
                status,
                confidence: 'HIGH', // We have high confidence in explicit rules
                stabilityIndex: 0,
                anomaliesDetected,
                isVolatile,
                leadTime,
                savingsOpportunity_usageBased: 0,
                debug_rawCycleCount: 0,
                debug_validCycleCount: 0,
            };

        } catch (error) {
            console.error(`[InventoryIntelligence] Error for ${item.name}:`, error);
            return this.getDormantMetrics(item, 0);
        }
    }

    // ── AI Smart Cart Integration ─────────────────────────────────────────────
    static async generateAIOrderDraft(itemsToReview: ItemMetrics[], rawInventory: InventoryItem[]): Promise<AIOrderDraftResponse> {
        // Prepare simplified data payload for LLM to avoid context limits
        // 14k tokens is too big for local models, so we heavily compress the data.
        const idMap = new Map<number, string>();
        
        const payload = itemsToReview.map((m, idx) => {
            idMap.set(idx, m.itemId);
            const fullItem = rawInventory.find(i => i.id === m.itemId);
            
            // Truncate names to 45 chars to save tokens
            const name = fullItem?.name || m.itemName;
            const shortName = name.length > 45 ? name.substring(0, 42) + '...' : name;

            return {
                id: idx, // Use cheap int IDs instead of massive UUIDs
                n: shortName,
                c: fullItem?.category || 'Gen',
                s: m.currentStock,
                min: fullItem?.minStock || 0,
                x: fullItem?.expiryDate || 'N/A'
            };
        });

        // To prevent catastrophic token overflows, if we have > 80 items, we might still hit limits
        // We will process max 80 at a time to ensure it fits in ~4k context 
        const chunk = payload.slice(0, 80);

        const prompt = `
Act as Chief Medical Supply Officer. Build a Prioritized Cart for these vulnerable items.

CRITERIA:
1. "Clinical Vital": Life-saving/critical medical supplies hitting min stock.
2. "Secondary Consumable": Clerical, non-emergency, office, or general supplies.
3. "Review Only": High stock but expiring soon.

RAW DATA:
${JSON.stringify(chunk)}
        `;

        const system = `You are an AI logistic assistant. Output STRICTLY raw JSON matching this interface:
{
  "strategyNotes": "string (brief summary)",
  "prioritizedCart": [
    {
      "categoryName": "Clinical Vital (Order Today)" | "Secondary Consumable (Order This Week)" | "Review Only (Expiring)",
      "items": [
        { "id": number (match the raw input id), "itemName": "string", "proposedQuantity": number, "aiJustification": "string (brief reason)" }
      ]
    }
  ]
}`;

        // Ask the local AI
        const rawResponse = await jsonChat<any>(system, prompt);

        // Map integer IDs back to UUIDs
        try {
            if (rawResponse && Array.isArray(rawResponse.prioritizedCart)) {
                rawResponse.prioritizedCart.forEach((cat: any) => {
                    if (Array.isArray(cat.items)) {
                        cat.items.forEach((item: any) => {
                            // Recover the real string ID
                            item.itemId = idMap.get(item.id) || item.id;
                            delete item.id;
                        });
                    }
                });
            }
            // If we sliced the array due to being too large, warn in the strategy notes
            if (payload.length > 80 && rawResponse?.strategyNotes) {
                rawResponse.strategyNotes = "(Note: To prevent memory limits, only the first 80 items were analyzed) " + rawResponse.strategyNotes;
            }
            return rawResponse as AIOrderDraftResponse;
        } catch (e) {
            console.error("Failed to map IDs back", e);
            throw e;
        }
    }

    // ── Dormant Fallback ──────────────────────────────────────────────────────
    private static getDormantMetrics(item: InventoryItem, anomalies: number): ItemMetrics {
        return {
            itemId: item.id, itemName: item.name, currentStock: item.stock,
            dailyUsageRate: 0, predictedCycleDuration: 0, daysRemaining: Infinity,
            recommendedReorderDate: null, recommendedQuantity: 0,
            status: 'DORMANT', confidence: 'LOW', stabilityIndex: 0,
            anomaliesDetected: anomalies, isVolatile: false, leadTime: item.leadTime || 7,
            // Dormant items have no cycles — rawCycleCount must be 0, not anomalies
            debug_rawCycleCount: 0,
            debug_validCycleCount: 0,
        };
    }

    // ── History Builder ───────────────────────────────────────────────────────
    private static async getItemHistory(itemId: string): Promise<PurchaseCycle[]> {
        // Fetch up to 15 RECEIVED orders for this item, newest first
        const { data: orders } = await supabase
            .from('orders')
            .select(`id, received_at, order_items!inner(item_id, quantity)`)
            .eq('status', 'RECEIVED')
            .eq('order_items.item_id', itemId)
            .not('received_at', 'is', null)
            .order('received_at', { ascending: false })
            .limit(15);

        if (!orders || orders.length < 2) return [];

        // Fetch overrides
        const { data: overrides } = await supabase
            .from('intelligence_overrides')
            .select('*')
            .eq('item_id', itemId);

        // Fetch audit logs: CONSUMED, RESTOCKED, UPDATED
        const oldestTs = orders[orders.length - 1].received_at;
        const { data: allLogs } = await supabase
            .from('audit_log')
            .select('action, details, timestamp')
            .eq('resource_id', itemId)
            .gte('timestamp', oldestTs)
            .in('action', ['UPDATED', 'RESTOCKED', 'CONSUMED'])
            .order('timestamp', { ascending: true });

        const logs = allLogs || [];

        const cycles: PurchaseCycle[] = [];

        for (let i = 0; i < orders.length - 1; i++) {
            const endOrder = orders[i];     // Newer → ends the cycle
            const startOrder = orders[i + 1]; // Older → starts the cycle

            const endDate = new Date(endOrder.received_at);
            const startDate = new Date(startOrder.received_at);
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationDays = durationMs / 86400_000;

            if (durationDays < 1) continue;

            const orderQty = (startOrder.order_items[0] as any).quantity;

            // ── Fix #3: Strict log matching — ±1 hour window + action-typed ────
            const ONE_HOUR_MS = 3_600_000;

            // RESTOCKED log at startDate → gives us startStock (stock after receive)
            const startRestockLogs = logs
                .filter(l => l.action === 'RESTOCKED' &&
                    Math.abs(new Date(l.timestamp).getTime() - startDate.getTime()) <= ONE_HOUR_MS)
                .sort((a, b) => Math.abs(new Date(a.timestamp).getTime() - startDate.getTime())
                    - Math.abs(new Date(b.timestamp).getTime() - startDate.getTime()));

            // UPDATED log at endDate → gives us endStock (stock before next restock)
            const endUpdatedLogs = logs
                .filter(l => l.action === 'UPDATED' &&
                    Math.abs(new Date(l.timestamp).getTime() - endDate.getTime()) <= ONE_HOUR_MS)
                .sort((a, b) => Math.abs(new Date(a.timestamp).getTime() - endDate.getTime())
                    - Math.abs(new Date(b.timestamp).getTime() - endDate.getTime()));

            let startStock = 0;
            let endStock = 0;

            try {
                if (startRestockLogs[0]) {
                    const d = JSON.parse(startRestockLogs[0].details);
                    startStock = typeof d.new_stock === 'number' ? d.new_stock : 0;
                }
                if (endUpdatedLogs[0]) {
                    const d = JSON.parse(endUpdatedLogs[0].details);
                    endStock = typeof d.previous_stock === 'number' ? d.previous_stock : 0;
                }
            } catch { /* malformed log — fallback below */ }

            // ── Fix #7: Consumption hierarchy ───────────────────────────────
            // Priority 1: Sum CONSUMED log deltas within the cycle window
            // Priority 2: Snapshot (startStock - endStock) if both available
            // Priority 3: Fallback to order quantity (replenishment heuristic)
            let consumption = 0;
            let source: PurchaseCycle['source'] = 'FALLBACK_ORDER_QTY';

            const consumedLogs = logs.filter(l => {
                if (l.action !== 'CONSUMED') return false;
                const t = new Date(l.timestamp).getTime();
                return t > startDate.getTime() && t <= endDate.getTime();
            });

            if (consumedLogs.length > 0) {
                // Sum explicit consumption delta values
                let consumed = 0;
                for (const cl of consumedLogs) {
                    try {
                        const d = JSON.parse(cl.details);
                        const delta = d.quantity ?? d.delta ?? d.consumed ?? 0;
                        consumed += typeof delta === 'number' ? delta : 0;
                    } catch { /* skip unparseable */ }
                }
                if (consumed > 0) {
                    consumption = consumed;
                    source = 'CONSUMED_LOGS';
                }
            }

            if (source === 'FALLBACK_ORDER_QTY' && startStock > 0 && endStock >= 0 && startStock >= endStock) {
                consumption = startStock - endStock;
                source = 'SNAPSHOT';
            }

            if (source === 'FALLBACK_ORDER_QTY') {
                consumption = orderQty;
            }

            const hasOverride = overrides?.some(o => {
                const t = new Date(o.created_at).getTime();
                return t >= startDate.getTime() && t < endDate.getTime();
            }) ?? false;

            cycles.push({
                startDate, endDate, durationDays,
                quantityConsumed: consumption,
                usageRate: consumption / durationDays,
                isAnomaly: false,
                isOverride: hasOverride,
                startStock, endStock, source,
            });
        }

        return cycles;
    }

    // ── Anomaly Analysis ──────────────────────────────────────────────────────
    private static analyzeCycles(cycles: PurchaseCycle[]) {
        if (cycles.length === 0) {
            return { validCycles: [], rawCycles: cycles };
        }

        // Baseline medians from non-override cycles
        const baselines = cycles.filter(c => !c.isOverride);
        const base = baselines.length > 0 ? baselines : cycles;
        const medianQty = this.getMedian(base.map(c => c.quantityConsumed));
        const medianDuration = this.getMedian(base.map(c => c.durationDays));

        const validCycles = cycles.filter(c => {
            if (c.isOverride) {
                c.isAnomaly = true; c.anomalyReason = 'OVERRIDE'; return false;
            }

            // ── Fix #8: Guard against zero/near-zero median triggering false PANIC_BUY
            if (medianQty > 0 && c.quantityConsumed > 2.0 * medianQty) {
                c.isAnomaly = true; c.anomalyReason = 'PANIC_BUY'; return false;
            }

            if (c.durationDays > 2.0 * medianDuration) {
                c.isAnomaly = true; c.anomalyReason = 'HOARDING'; return false;
            }

            if (medianDuration > 0 && c.durationDays < 0.5 * medianDuration) {
                c.isAnomaly = true; c.anomalyReason = 'PREMATURE'; return false;
            }

            if (c.startStock > 0 && c.endStock > (c.startStock * 0.40)) {
                c.isAnomaly = true; c.anomalyReason = 'UNDER_CONSUMPTION'; return false;
            }

            return true;
        });

        return { validCycles, rawCycles: cycles };
    }

    // ── Math Utilities ────────────────────────────────────────────────────────
    private static getMedian(values: number[]): number {
        if (values.length === 0) return 0;
        const s = [...values].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    // Coefficient of Variation (%) — used for stabilityIndex on rolling window
    private static computeCV(values: number[]): number {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (mean === 0) return 0;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return (Math.sqrt(variance) / mean) * 100;
    }

    // ── Governance Override Logging ───────────────────────────────────────────
    static async logOverride(override: Omit<DBIntelligenceOverride, 'id' | 'created_at'>) {
        try {
            const { error } = await supabase.from('intelligence_overrides').insert(override);
            if (error) throw error;
        } catch (error) {
            console.error('[InventoryIntelligence] Failed to log override:', error);
        }
    }
}
