
import { supabase } from '../src/lib/supabase';
import { InventoryItem, DBIntelligenceOverride, ItemMetrics } from '../types';

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

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
export class InventoryIntelligenceService {

    // ── Core Public Method ────────────────────────────────────────────────────
    static async calculateItemMetrics(
        item: InventoryItem,
        options?: { targetCoverageCycles?: number }
    ): Promise<ItemMetrics> {
        try {
            // 1. Build purchase cycles from order history + audit logs
            const rawCycles = await this.getItemHistory(item.id);

            // 2. Anomaly detection — returns valid cycles + stability index
            //    stabilityIndex is NOT yet computed here (done after rolling window)
            const { validCycles, rawCycles: markedRaw } = this.analyzeCycles(rawCycles);

            // 3. Rolling Window — sort newest first, take top ENGINE_ROLLING_WINDOW
            const sortedValid = [...validCycles].sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
            const predictionCycles = sortedValid.slice(0, ENGINE_ROLLING_WINDOW);

            // ── Fix #6: No silent 30-day fallback if no viable prediction cycles ──
            if (predictionCycles.length < 1) {
                return this.getDormantMetrics(item, markedRaw.length);
            }

            // 4. Usage Rate (total qty / total days in rolling window)
            const totalQty = predictionCycles.reduce((s, c) => s + c.quantityConsumed, 0);
            const totalDays = predictionCycles.reduce((s, c) => s + c.durationDays, 0);
            const dailyUsageRate = totalQty / totalDays;

            if (dailyUsageRate < 0.01) {
                return this.getDormantMetrics(item, markedRaw.length - validCycles.length);
            }

            // 5. Predicted cycle duration = median of rolling window durations
            //    No 30-day fallback — if we have cycles, use their data.
            const predictedCycleDuration = this.getMedian(predictionCycles.map(c => c.durationDays));

            // ── Fix #5: Stability index computed on rolling window only ───────────
            const stabilityIndex = this.computeCV(predictionCycles.map(c => c.usageRate));
            const isVolatile = stabilityIndex > 40;

            // 6. Days remaining
            const daysRemaining = item.stock / dailyUsageRate;

            // 7. Lead time & buffer from governance constants
            const LEAD_TIME_DAYS = item.leadTime || 7;
            const BUFFER_DAYS = ENGINE_BUFFER_DAYS;

            // ── Fix #9: Tightened confidence — HIGH requires full rolling window AND
            //    zero anomalies AND low stability ──────────────────────────────────
            const anomaliesDetected = markedRaw.length - validCycles.length;
            let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
            if (
                predictionCycles.length === ENGINE_ROLLING_WINDOW &&
                stabilityIndex < 20 &&
                anomaliesDetected === 0
            ) {
                confidence = 'HIGH';
            } else if (predictionCycles.length >= 2 && stabilityIndex < 40) {
                confidence = 'MEDIUM';
            }

            // 8. Reorder arithmetic (all as floats, rounded only at return)
            const safetyStock = dailyUsageRate * LEAD_TIME_DAYS * ENGINE_CRITICALITY_FACTOR;
            const reorderPoint = (dailyUsageRate * LEAD_TIME_DAYS) + safetyStock;
            const daysUntilReorder = Math.max(0, (item.stock - reorderPoint) / dailyUsageRate);
            const today = new Date();
            const recommendedReorderDate = new Date(today.getTime() + daysUntilReorder * 86400_000);

            // 9. Capital Protection — float precision throughout
            const targetCoverage = options?.targetCoverageCycles || 1;
            const rawRecQtyFloat = dailyUsageRate * predictedCycleDuration * targetCoverage;
            const capitalCapFloat = ENGINE_CRITICALITY_FACTOR * (dailyUsageRate * predictedCycleDuration);
            const capApplied = rawRecQtyFloat > capitalCapFloat;
            const recommendedQuantity = Math.min(rawRecQtyFloat, capitalCapFloat);

            // 10. Strict Status — evaluated in this exact precedence order:
            //   CRITICAL   : daysRemaining <= LEAD_TIME_DAYS
            //   ORDER_SOON : daysRemaining <= LEAD_TIME_DAYS + BUFFER_DAYS
            //   OVERSTOCK  : daysRemaining >  2 × predictedCycleDuration
            //   HEALTHY    : otherwise
            let status: ItemMetrics['status'];
            if (daysRemaining <= LEAD_TIME_DAYS) {
                status = 'CRITICAL';
            } else if (daysRemaining <= LEAD_TIME_DAYS + BUFFER_DAYS) {
                status = 'ORDER_SOON';
            } else if (daysRemaining > 2 * predictedCycleDuration) {
                status = 'OVERSTOCK';
            } else {
                status = 'HEALTHY';
            }

            return {
                itemId: item.id,
                itemName: item.name,
                currentStock: item.stock,
                dailyUsageRate,
                predictedCycleDuration,
                daysRemaining,
                recommendedReorderDate,
                recommendedQuantity: Math.ceil(recommendedQuantity),
                status,
                confidence,
                stabilityIndex,
                anomaliesDetected,
                isVolatile,
                leadTime: LEAD_TIME_DAYS,
                savingsOpportunity_usageBased: 0,
                // ── Debug / Audit ──────────────────────────────────────────────
                debug_rawCycleCount: markedRaw.length,
                debug_validCycleCount: validCycles.length,
                debug_cycleCount: validCycles.length,       // alias
                debug_totalCycleCount: markedRaw.length,         // alias
                debug_cyclesUsed: predictionCycles.map(c => c.endDate.toISOString()),
                debug_anomalies: markedRaw.filter(c => c.isAnomaly).map(c => ({
                    reason: c.anomalyReason || 'UNKNOWN',
                    date: c.endDate.toISOString(),
                })),
                // Capital protection — floats exposed before any rounding
                debug_rawRecommendationFloat: rawRecQtyFloat,
                debug_capitalCapFloat: capitalCapFloat,
                debug_rawRecommendation: Math.ceil(rawRecQtyFloat),
                debug_capitalCap: Math.ceil(capitalCapFloat),
                debug_capApplied: capApplied,
                debug_bufferDays: BUFFER_DAYS,
                // Reorder audit
                debug_safetyStock: safetyStock,
                debug_reorderPoint: reorderPoint,
                debug_daysUntilReorder: daysUntilReorder,
            };

        } catch (error) {
            console.error(`[InventoryIntelligence] Error for ${item.name}:`, error);
            return this.getDormantMetrics(item, 0);
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
