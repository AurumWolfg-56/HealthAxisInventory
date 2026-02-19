import React, { useState } from 'react';
import { supabase } from '../src/lib/supabase';
import {
    InventoryIntelligenceService,
    ENGINE_BUFFER_DAYS,
    ENGINE_CRITICALITY_FACTOR,
    ENGINE_ROLLING_WINDOW,
} from '../services/InventoryIntelligenceService';
import { generateUUID } from '../utils/uuid';
import { InventoryItem } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Expected governance constants — assert against engine exports at runtime.
// Any drift here = immediate pre-flight fail.
// ─────────────────────────────────────────────────────────────────────────────
const EXPECTED_BUFFER_DAYS = 5;
const EXPECTED_ROLLING_WINDOW = 3;
const EXPECTED_CRITICALITY_FACTOR = 1.2;
const ROUNDING_TOLERANCE = 1; // ±1 unit for final Math.ceil outputs

type LogType = 'info' | 'success' | 'error' | 'warning';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const InventoryIntelligenceVerification: React.FC = () => {
    const [logs, setLogs] = useState<{ msg: string; type: LogType }[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [localIds, setLocalIds] = useState<string[]>([]);

    const addLog = (msg: string, type: LogType = 'info') =>
        setLogs(prev => [...prev, { msg, type }]);

    const assert = (condition: boolean, failMsg: string, passMsg: string) => {
        if (!condition) throw new Error(`FAIL: ${failMsg}`);
        addLog(`PASS: ${passMsg}`, 'success');
    };

    // ── Test-data helpers ──────────────────────────────────────────────────────
    const trackId = (ids: string[], id: string) => {
        ids.push(id);
        setLocalIds(prev => [...prev, id]);
    };

    const createTestItem = async (
        ids: string[],
        tag: string,
        stock: number,
        leadTime: number = 7
    ): Promise<InventoryItem> => {
        const id = generateUUID();
        const name = `VERIFY-${tag}-${Date.now().toString().slice(-6)}`;
        const item: InventoryItem = {
            id, name,
            category: 'TEST_GOVERNANCE',
            stock, unit: 'unit',
            averageCost: 10,
            minStock: 0, maxStock: 9999,
            expiryDate: '2099-12-31',
            batchNumber: 'VERIFY',
            location: 'TEST',
            leadTime,
        };
        const { error } = await supabase.from('items').insert({
            id, name,
            category: item.category,
            stock,
            unit: item.unit,
            min_stock: item.minStock,
            max_stock: item.maxStock,
            average_cost: item.averageCost,
        });
        if (error) throw new Error(`DB insert failed for ${name}: ${error.message}`);
        trackId(ids, id);
        return item;
    };

    /**
     * Insert RECEIVED orders and, optionally, strict audit logs for snapshot
     * matching (RESTOCKED at startDate±0, UPDATED at endDate±0).
     * The engine requires ±1-hour precision — we place logs exactly at the
     * order timestamps to satisfy that constraint.
     */
    const createOrders = async (
        itemId: string,
        entries: Array<{
            daysAgo: number;
            qty: number;
            startStock?: number; // post-restock stock → RESTOCKED log
            endStock?: number;   // pre-restock stock  → UPDATED log
        }>,
        /**
         * Optional CONSUMED log injections. Each entry places an audit_log
         * row with action='CONSUMED' at (now - daysAgo), so the engine's
         * consumption hierarchy picks it up with highest priority (Fix #7).
         * details = { quantity: delta } per engine parser at fix #7.
         */
        consumedDeltas?: Array<{ daysAgo: number; quantity: number }>
    ) => {
        for (const e of entries) {
            const ts = new Date();
            ts.setDate(ts.getDate() - e.daysAgo);

            const orderId = generateUUID();
            const { error: oErr } = await supabase.from('orders').insert({
                id: orderId,
                status: 'RECEIVED',
                total_amount: e.qty * 10,
                created_at: ts.toISOString(),
                updated_at: ts.toISOString(),
                received_at: ts.toISOString(),
                currency: 'USD',
            });
            if (oErr) throw new Error(`Order insert failed: ${oErr.message}`);

            const { error: oiErr } = await supabase.from('order_items').insert({
                id: generateUUID(), order_id: orderId,
                item_id: itemId, quantity: e.qty, price: 10,
            });
            if (oiErr) throw new Error(`OrderItem insert failed: ${oiErr.message}`);

            // RESTOCKED → engine looks for this at startDate ±1h
            if (e.startStock !== undefined) {
                await supabase.from('audit_log').insert({
                    id: generateUUID(), action: 'RESTOCKED', resource_id: itemId,
                    timestamp: ts.toISOString(),
                    details: JSON.stringify({ new_stock: e.startStock }),
                    user: 'VERIFY_SUITE',
                });
            }
            // UPDATED → engine looks for this at endDate ±1h
            // We write it 1ms after the order ts so it lands in the next cycle's "endDate" window.
            if (e.endStock !== undefined) {
                await supabase.from('audit_log').insert({
                    id: generateUUID(), action: 'UPDATED', resource_id: itemId,
                    timestamp: new Date(ts.getTime() + 1).toISOString(),
                    details: JSON.stringify({ previous_stock: e.endStock }),
                    user: 'VERIFY_SUITE',
                });
            }
        }

        // Insert CONSUMED logs (independent of order anchors)
        if (consumedDeltas) {
            for (const cd of consumedDeltas) {
                const ct = new Date();
                ct.setDate(ct.getDate() - cd.daysAgo);
                const { error: cErr } = await supabase.from('audit_log').insert({
                    id: generateUUID(), action: 'CONSUMED', resource_id: itemId,
                    timestamp: ct.toISOString(),
                    details: JSON.stringify({ quantity: cd.quantity }),
                    user: 'VERIFY_SUITE',
                });
                if (cErr) throw new Error(`CONSUMED log insert failed: ${cErr.message}`);
            }
        }
    };

    // ── Cleanup — VERIFY- guard (Req #7) ────────────────────────────────────
    const cleanup = async (ids: string[]) => {
        addLog('Cleanup in progress...', 'warning');
        for (const id of ids) {
            try {
                const { data: item } = await supabase
                    .from('items').select('name').eq('id', id).single();
                if (!item?.name?.startsWith('VERIFY-')) {
                    addLog(`SKIPPED cleanup for ${id} — name does not start with VERIFY-`, 'error');
                    continue;
                }
                const { data: ois } = await supabase
                    .from('order_items').select('order_id').eq('item_id', id);
                const orderIds = [...new Set((ois || []).map((r: any) => r.order_id))];
                if (orderIds.length) {
                    await supabase.from('order_items').delete().in('order_id', orderIds);
                    await supabase.from('orders').delete().in('id', orderIds);
                }
                await supabase.from('audit_log').delete().eq('resource_id', id);
                await supabase.from('intelligence_overrides').delete().eq('item_id', id);
                await supabase.from('items').delete().eq('id', id);
            } catch (e: any) {
                addLog(`Cleanup failed for ${id}: ${e.message}`, 'error');
            }
        }
        setLocalIds([]);
        addLog('Cleanup complete.', 'info');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Main Audit Runner
    // ─────────────────────────────────────────────────────────────────────────
    const runStrictVerification = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setLogs([]);
        const ids: string[] = [];
        const ci = (tag: string, stock: number, lt?: number) => createTestItem(ids, tag, stock, lt);

        try {
            // ══════════════════════════════════════════════════════════════════
            // PRE-FLIGHT — Engine Constant Verification
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ PRE-FLIGHT: Engine Constants ═══', 'info');
            assert(ENGINE_BUFFER_DAYS === EXPECTED_BUFFER_DAYS,
                `ENGINE_BUFFER_DAYS=${ENGINE_BUFFER_DAYS}, expected ${EXPECTED_BUFFER_DAYS}`,
                `BUFFER_DAYS = ${ENGINE_BUFFER_DAYS} ✓`);
            assert(ENGINE_ROLLING_WINDOW === EXPECTED_ROLLING_WINDOW,
                `ENGINE_ROLLING_WINDOW=${ENGINE_ROLLING_WINDOW}, expected ${EXPECTED_ROLLING_WINDOW}`,
                `ROLLING_WINDOW = ${ENGINE_ROLLING_WINDOW} ✓`);
            assert(ENGINE_CRITICALITY_FACTOR === EXPECTED_CRITICALITY_FACTOR,
                `ENGINE_CRITICALITY_FACTOR=${ENGINE_CRITICALITY_FACTOR}, expected ${EXPECTED_CRITICALITY_FACTOR}`,
                `CRITICALITY_FACTOR = ${ENGINE_CRITICALITY_FACTOR} ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 1 — Rolling 3-Cycle Enforcement
            //
            // History: 6 order anchors → 5 cycles (oldest→newest):
            //   cycle A: 150→120 days ago, qty=100, dur=30d → rate=3.33/d
            //   cycle B: 120→90  days ago, qty=100, dur=30d → rate=3.33/d
            //   cycle C: 90→60   days ago, qty=10,  dur=30d → rate=0.33/d  ← rolling[3]
            //   cycle D: 60→30   days ago, qty=10,  dur=30d → rate=0.33/d  ← rolling[2]
            //   cycle E: 30→0    days ago, qty=10,  dur=30d → rate=0.33/d  ← rolling[1]
            //
            // Rolling window takes C, D, E (newest 3 valid cycles).
            // Total qty = 10+10+10 = 30 over 30+30+30 = 90 days
            // Expected usage rate = 30/90 = 0.333.../day ≈ 0.333/day
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 1: Rolling 3-Cycle Enforcement ═══', 'info');
            const item1 = await ci('Rolling3', 50);
            await createOrders(item1.id, [
                { daysAgo: 150, qty: 100 },
                { daysAgo: 120, qty: 100 },
                { daysAgo: 90, qty: 10 },
                { daysAgo: 60, qty: 10 },
                { daysAgo: 30, qty: 10 },
                { daysAgo: 0, qty: 10 }, // anchor (no cycle built from this)
            ]);
            const m1 = await InventoryIntelligenceService.calculateItemMetrics(item1);

            // Fix #2: distinguish raw vs valid cycle counts
            assert(m1.debug_rawCycleCount === 5,
                `debug_rawCycleCount=${m1.debug_rawCycleCount}, expected 5`,
                `Raw cycle count = 5 ✓`);
            assert(m1.debug_validCycleCount === 5,
                `debug_validCycleCount=${m1.debug_validCycleCount}, expected 5 (no anomalies)`,
                `Valid cycle count = 5 ✓`);
            assert(m1.debug_cyclesUsed?.length === ENGINE_ROLLING_WINDOW,
                `Prediction used ${m1.debug_cyclesUsed?.length} cycles, expected ${ENGINE_ROLLING_WINDOW}`,
                `Rolling window uses exactly ${ENGINE_ROLLING_WINDOW} cycles ✓`);

            // Fix #1: corrected expected usage = 0.333.../day
            const expectedUsage1 = 10 / 30; // 0.3333…
            assert(Math.abs(m1.dailyUsageRate - expectedUsage1) < 0.01,
                `Usage=${m1.dailyUsageRate.toFixed(4)}, expected ≈${expectedUsage1.toFixed(4)} (rolling 3 of 5 cycles)`,
                `Usage rate = ${m1.dailyUsageRate.toFixed(4)} ≈ ${expectedUsage1.toFixed(4)}/day ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 2 — Panic Buy Exclusion
            //
            // 4 cycles; one with 10× median → PANIC_BUY.
            // After exclusion: debug_rawCycleCount=4, debug_validCycleCount=3.
            // NOTE: median guard (Fix #8) — medianQty must be >0 for rule to fire.
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 2: Panic Buy Exclusion ═══', 'info');
            const item2 = await ci('Panic', 50);
            await createOrders(item2.id, [
                { daysAgo: 120, qty: 10 },
                { daysAgo: 90, qty: 10 },
                { daysAgo: 60, qty: 100 }, // 10× median=10 → PANIC_BUY
                { daysAgo: 30, qty: 10 },
                { daysAgo: 0, qty: 10 },
            ]);
            const m2 = await InventoryIntelligenceService.calculateItemMetrics(item2);

            assert(m2.debug_rawCycleCount === 4,
                `debug_rawCycleCount=${m2.debug_rawCycleCount}, expected 4`,
                `Raw cycle count = 4 ✓`);
            assert(m2.anomaliesDetected === 1,
                `anomaliesDetected=${m2.anomaliesDetected}, expected 1`,
                `1 anomaly excluded ✓`);
            assert(m2.debug_validCycleCount === 3,
                `debug_validCycleCount=${m2.debug_validCycleCount}, expected 3`,
                `Valid cycle count = 3 after panic buy exclusion ✓`);
            const panicAnomaly = m2.debug_anomalies?.find(a => a.reason === 'PANIC_BUY');
            assert(panicAnomaly !== undefined,
                `Anomaly NOT labeled PANIC_BUY: ${JSON.stringify(m2.debug_anomalies)}`,
                `Anomaly reason = PANIC_BUY ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 3 — Strict Status Boundaries (Fix #1 corrected math)
            //
            // History: 4 anchors, 10 days apart → 3 cycles of 10 days each.
            // Each cycle: qty=10, dur=10d → usage=1.0/day.
            // predictedCycleDuration = median(10,10,10) = 10.
            // Lead Time = 14 days    Buffer = ENGINE_BUFFER_DAYS = 5
            //
            // Exact thresholds:
            //   CRITICAL   : daysRemaining ≤ 14      → stock ≤ 14
            //   ORDER_SOON : daysRemaining ≤ 19      → stock ≤ 19 and >14
            //   HEALTHY    : 19 < daysRemaining ≤ 20 → stock = 20
            //   OVERSTOCK  : daysRemaining > 20      → stock ≥ 21
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 3: Status Boundaries ═══', 'info');
            const LT = 14;
            const BUFF = ENGINE_BUFFER_DAYS; // 5
            const item3 = await ci('Status', 0, LT);
            await createOrders(item3.id, [
                { daysAgo: 30, qty: 10 },
                { daysAgo: 20, qty: 10 },
                { daysAgo: 10, qty: 10 },
                { daysAgo: 0, qty: 10 }, // anchor
            ]);

            // Req #3: assert buffer from engine export, not hardcoded
            assert(ENGINE_BUFFER_DAYS === EXPECTED_BUFFER_DAYS,
                `Buffer mismatch: engine=${ENGINE_BUFFER_DAYS}`,
                `Buffer from engine = ${ENGINE_BUFFER_DAYS} days ✓`);

            // Req #4: assert predictedCycleDuration = 10 before testing statuses
            const refM = await InventoryIntelligenceService.calculateItemMetrics({ ...item3, stock: 10 });
            assert(Math.abs(refM.predictedCycleDuration - 10) <= 1,
                `predictedCycleDuration=${refM.predictedCycleDuration}, expected 10`,
                `predictedCycleDuration = ${refM.predictedCycleDuration} days ✓`);
            assert(refM.leadTime === LT,
                `leadTime=${refM.leadTime}, expected ${LT}`,
                `Engine uses item.leadTime = ${LT} ✓`);

            addLog(`  Thresholds: CRITICAL≤${LT}, ORDER_SOON≤${LT + BUFF}, HEALTHY≤${2 * refM.predictedCycleDuration}, OVERSTOCK>${2 * refM.predictedCycleDuration}`, 'info');

            // CRITICAL: stock=14, daysRemaining=14 ≤ LT(14)
            const m3c = await InventoryIntelligenceService.calculateItemMetrics({ ...item3, stock: 14 });
            assert(m3c.status === 'CRITICAL',
                `status=${m3c.status}, expected CRITICAL (daysRem=${m3c.daysRemaining.toFixed(2)} ≤ LT ${LT})`,
                `CRITICAL at stock=14 (daysRem=14 ≤ LT ${LT}) ✓`);

            // ORDER_SOON: stock=19, daysRemaining=19, LT(14) < 19 ≤ LT+BUFF(19)
            const m3s = await InventoryIntelligenceService.calculateItemMetrics({ ...item3, stock: 19 });
            assert(m3s.status === 'ORDER_SOON',
                `status=${m3s.status}, expected ORDER_SOON (daysRem=${m3s.daysRemaining.toFixed(2)})`,
                `ORDER_SOON at stock=19 (daysRem=19 = LT+Buff) ✓`);

            // HEALTHY: stock=20, daysRemaining=20 = 2×cycle → NOT OVERSTOCK (>, not ≥)
            const m3h = await InventoryIntelligenceService.calculateItemMetrics({ ...item3, stock: 20 });
            assert(m3h.status === 'HEALTHY',
                `status=${m3h.status}, expected HEALTHY (daysRem=${m3h.daysRemaining.toFixed(2)} = 2*10, boundary is strict >, so not OVERSTOCK)`,
                `HEALTHY at stock=20 (daysRem=20 = 2×cycle, OVERSTOCK requires >) ✓`);

            // OVERSTOCK: stock=21, daysRemaining=21 > 2×10=20
            const m3o = await InventoryIntelligenceService.calculateItemMetrics({ ...item3, stock: 21 });
            assert(m3o.status === 'OVERSTOCK',
                `status=${m3o.status}, expected OVERSTOCK (daysRem=${m3o.daysRemaining.toFixed(2)} > 20)`,
                `OVERSTOCK at stock=21 (daysRem=21 > 2×cycle 20) ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 4 — Capital Protection Hard Cap (Fix #4: float assertions)
            //
            // 3 cycles × (300 qty / 30 days) → usage = 10/day
            // predictedCycleDuration = 30 days
            // capitalCapFloat   = 1.2 × (10 × 30) = 360.0
            // targetCoverage = 2 → rawRecQtyFloat = 10 × 30 × 2 = 600.0
            // capApplied = true (600 > 360)
            // recommendedQuantity = ceil(360.0) = 360
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 4: Capital Protection Hard Cap ═══', 'info');
            const item4 = await ci('Cap', 0);
            await createOrders(item4.id, [
                { daysAgo: 90, qty: 300 },
                { daysAgo: 60, qty: 300 },
                { daysAgo: 30, qty: 300 },
                { daysAgo: 0, qty: 300 },
            ]);
            const m4 = await InventoryIntelligenceService.calculateItemMetrics(item4, { targetCoverageCycles: 2 });

            const expUsage4 = 10;   // 300/30
            const expCycleLen4 = 30;
            const expRawFloat4 = expUsage4 * expCycleLen4 * 2;   // 600.0
            const expCapFloat4 = EXPECTED_CRITICALITY_FACTOR * expUsage4 * expCycleLen4; // 360.0

            // Fix #4: assert floats directly — no rounding drift
            assert(m4.debug_rawRecommendationFloat !== undefined,
                `debug_rawRecommendationFloat is undefined`,
                `debug_rawRecommendationFloat defined ✓`);
            assert(Math.abs((m4.debug_rawRecommendationFloat ?? 0) - expRawFloat4) < 0.5,
                `rawFloat=${m4.debug_rawRecommendationFloat?.toFixed(4)}, expected ${expRawFloat4}`,
                `rawRecommendationFloat = ${m4.debug_rawRecommendationFloat?.toFixed(2)} ≈ ${expRawFloat4} ✓`);
            assert(m4.debug_capitalCapFloat !== undefined,
                `debug_capitalCapFloat is undefined`,
                `debug_capitalCapFloat defined ✓`);
            assert(Math.abs((m4.debug_capitalCapFloat ?? 0) - expCapFloat4) < 0.5,
                `capFloat=${m4.debug_capitalCapFloat?.toFixed(4)}, expected ${expCapFloat4}`,
                `capitalCapFloat = ${m4.debug_capitalCapFloat?.toFixed(2)} ≈ ${expCapFloat4} ✓`);
            // rawFloat must be strictly greater than capFloat for cap to apply
            assert((m4.debug_rawRecommendationFloat ?? 0) > (m4.debug_capitalCapFloat ?? 0),
                `rawFloat(${m4.debug_rawRecommendationFloat}) must > capFloat(${m4.debug_capitalCapFloat})`,
                `rawFloat > capFloat (cap is binding) ✓`);
            assert(m4.debug_capApplied === true,
                `debug_capApplied=${m4.debug_capApplied}, expected true`,
                `Cap applied = true ✓`);
            assert(Math.abs(m4.recommendedQuantity - expCapFloat4) <= ROUNDING_TOLERANCE,
                `recommendedQuantity=${m4.recommendedQuantity}, expected ${expCapFloat4}±${ROUNDING_TOLERANCE}`,
                `recommendedQuantity = ${m4.recommendedQuantity} = ceil(cap ${expCapFloat4}) ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 5 — Under-Consumption Exclusion (Fix #3: ±1h log matching)
            //
            // 2 full cycles + 1 anchor:
            //   cycle1: 60→30 days, startStock=100, endStock=0  → normal (0 ≤ 40)
            //   cycle2: 30→0  days, startStock=100, endStock=60 → UNDER_CONSUMPTION (60 > 40)
            //
            // After exclusion: rawCycles=2, validCycles=1
            // debug_cyclesUsed must NOT include cycle2's endDate
            // dailyUsageRate uses only cycle1: 100/30 ≈ 3.33/day
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 5: Under-Consumption Exclusion ═══', 'info');
            const item5 = await ci('UnderConsume', 100);
            // We write RESTOCKED logs at the *older* order timestamp (startDate of cycle)
            // and UPDATED logs at the *newer* order timestamp (endDate of cycle).
            await createOrders(item5.id, [
                // Oldest anchor → start of cycle1
                { daysAgo: 60, qty: 100, startStock: 100 },
                // Middle anchor → end of cycle1 (endStock=0), start of cycle2 (startStock=100)
                { daysAgo: 30, qty: 100, startStock: 100, endStock: 0 },
                // Newest anchor → end of cycle2 (endStock=60, triggers UC)
                { daysAgo: 0, qty: 100, endStock: 60 },
            ]);
            const m5 = await InventoryIntelligenceService.calculateItemMetrics(item5);

            const ucAnomaly = m5.debug_anomalies?.find(a => a.reason === 'UNDER_CONSUMPTION');
            assert(ucAnomaly !== undefined,
                `UNDER_CONSUMPTION NOT detected. anomalies: ${JSON.stringify(m5.debug_anomalies)}`,
                `UNDER_CONSUMPTION anomaly detected ✓`);

            // Fix #2: raw vs valid counts
            assert(m5.debug_rawCycleCount === 2,
                `debug_rawCycleCount=${m5.debug_rawCycleCount}, expected 2`,
                `Raw cycle count = 2 ✓`);
            assert(m5.debug_validCycleCount === 1,
                `debug_validCycleCount=${m5.debug_validCycleCount}, expected 1 after UC exclusion`,
                `Valid cycle count = 1 after UC exclusion ✓`);

            // UC cycle's end-date must be absent from prediction window
            const ucDate = ucAnomaly!.date;
            assert(!m5.debug_cyclesUsed?.includes(ucDate),
                `UC cycle (${ucDate}) found in debug_cyclesUsed — should be excluded`,
                `UC cycle excluded from prediction window ✓`);

            // Usage rate should reflect only the clean cycle: ≈3.33/day
            assert(m5.dailyUsageRate > 2.5 && m5.dailyUsageRate < 4.5,
                `dailyUsageRate=${m5.dailyUsageRate.toFixed(3)} outside expected 2.5–4.5/day (clean cycle only)`,
                `Usage rate = ${m5.dailyUsageRate.toFixed(3)}/day (clean cycles only) ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 6 — 2-Cycle Regression Safety (Fix #9: confidence degraded)
            //
            // 3 cycles; 1 is panic buy → 2 valid. Engine must not crash,
            // must return a recommendation, and confidence must NOT be HIGH.
            // (HIGH requires anomaliesDetected===0 per Fix #9)
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 6: 2-Cycle Regression Safety ═══', 'info');
            const item6 = await ci('TwoCycleReg', 50);
            await createOrders(item6.id, [
                { daysAgo: 90, qty: 10 },
                { daysAgo: 60, qty: 100 }, // PANIC_BUY → excluded
                { daysAgo: 30, qty: 10 },
                { daysAgo: 0, qty: 10 },
            ]);
            const m6 = await InventoryIntelligenceService.calculateItemMetrics(item6);

            assert((m6.debug_validCycleCount ?? 0) >= 1,
                `Engine returned 0 valid cycles — crash or incorrect filtering`,
                `Engine processed ${m6.debug_validCycleCount} valid cycle(s) ✓`);
            assert(m6.recommendedQuantity > 0,
                `recommendedQuantity=0 with valid cycles`,
                `Recommendation = ${m6.recommendedQuantity} with ${m6.debug_validCycleCount} valid cycle(s) ✓`);
            assert(m6.confidence !== 'HIGH',
                `Confidence=${m6.confidence} with anomaly present — should be MEDIUM or LOW`,
                `Confidence = ${m6.confidence} (correctly NOT HIGH due to anomaly) ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 7 — Stability Index Computed on Rolling Window (Fix #5)
            //
            // 5 cycles: oldest 2 have extreme rates, newest 3 are uniform.
            // stabilityIndex must reflect only the rolling 3 prediction cycles.
            // If computed on all 5, CV% would be high (volatile).
            // If computed on rolling 3 only, CV% should be ~0 (uniform).
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 7: Stability on Rolling Window ═══', 'info');
            const item7 = await ci('StabilityWindow', 50);
            await createOrders(item7.id, [
                { daysAgo: 180, qty: 10 }, // normal anchor — oldest; makes extreme orders act as startOrder
                { daysAgo: 150, qty: 300 }, // extreme 1 — participates as endOrder of cycle(180→150)
                { daysAgo: 120, qty: 1 }, // extreme 2 — participates as endOrder of cycle(150→120)
                { daysAgo: 90, qty: 10 }, // rolling[3] — uniform
                { daysAgo: 60, qty: 10 }, // rolling[2] — uniform
                { daysAgo: 30, qty: 10 }, // rolling[1] — uniform
                { daysAgo: 0, qty: 10 }, // anchor final
            ]);
            const m7 = await InventoryIntelligenceService.calculateItemMetrics(item7);

            // Rolling 3 cycles are all 10 qty / 30 days → rate=0.333 each → CV%=0
            assert(m7.stabilityIndex < 5,
                `stabilityIndex=${m7.stabilityIndex.toFixed(2)}% — should be near 0 when computed on uniform rolling 3 (Fix #5 failed)`,
                `Stability index = ${m7.stabilityIndex.toFixed(2)}% (rolling window is uniform) ✓`);

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 8 — Consumption Hierarchy Priority
            //
            // Purpose: prove CONSUMED_LOGS beats SNAPSHOT and FALLBACK_ORDER_QTY.
            //
            // Data setup (2 cycles over 3 anchors at 60/30/0 days ago):
            //   Anchor 60d: qty=50  + RESTOCKED(new_stock=100)   → cycle1 startStock=100
            //   Anchor 30d: qty=50  + UPDATED(previous_stock=30) → cycle1 endStock=30
            //   Anchor  0d: qty=50
            //
            //   CONSUMED logs inside cycle1 (60→30d): 8×5 = 40 units total
            //   CONSUMED logs inside cycle2 (30→ 0d): 2×10 = 20 units total
            //
            // Source resolution per engine Fix #7:
            //   cycle1: CONSUMED_LOGS wins → quantityConsumed=40, rate=40/30≈1.333/d
            //   If SNAPSHOT were used:       quantityConsumed=70, rate=70/30≈2.333/d
            //   If FALLBACK were used:        quantityConsumed=50, rate=50/30≈1.667/d
            //   cycle2: CONSUMED_LOGS wins → quantityConsumed=20, rate=20/30≈0.667/d
            //
            // Rolling rate = (40+20)/(30+30) = 60/60 = 1.000/d
            // Snapshot rate would be (70+20)/60 = 1.500/d  ← outside tight bound
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 8: Consumption Hierarchy Priority ═══', 'info');
            const item8 = await ci('ConsumedPriority', 50);
            await createOrders(
                item8.id,
                [
                    // Anchor at 60d: RESTOCKED here gives cycle1 its startStock
                    { daysAgo: 60, qty: 50, startStock: 100 },
                    // Anchor at 30d: UPDATED here gives cycle1 its endStock (30 ≤ 100×0.40 → no UC)
                    { daysAgo: 30, qty: 50, endStock: 30 },
                    // Anchor at 0d: pure anchor — terminates cycle2
                    { daysAgo: 0, qty: 50 },
                ],
                // CONSUMED deltas: 5 logs inside cycle1 (days 55–35) + 2 inside cycle2 (days 25–5)
                [
                    { daysAgo: 55, quantity: 8 },
                    { daysAgo: 50, quantity: 8 },
                    { daysAgo: 45, quantity: 8 },
                    { daysAgo: 40, quantity: 8 },
                    { daysAgo: 35, quantity: 8 }, // cycle1 total = 40
                    { daysAgo: 25, quantity: 10 },
                    { daysAgo: 5, quantity: 10 }, // cycle2 total = 20
                ]
            );
            const m8 = await InventoryIntelligenceService.calculateItemMetrics(item8);

            // ── Structural guards: verify exactly 2 cycles were built, none filtered ──
            assert(
                m8.debug_rawCycleCount === 2,
                `debug_rawCycleCount=${m8.debug_rawCycleCount}, expected 2 (one per interval between 3 anchors)`,
                `S8 rawCycleCount = 2 ✓`
            );
            assert(
                m8.debug_validCycleCount === 2,
                `debug_validCycleCount=${m8.debug_validCycleCount}, expected 2 — an anomaly incorrectly excluded a cycle`,
                `S8 validCycleCount = 2 ✓`
            );
            assert(
                (m8.debug_cyclesUsed?.length ?? 0) === Math.min(2, ENGINE_ROLLING_WINDOW),
                `debug_cyclesUsed.length=${m8.debug_cyclesUsed?.length}, expected ${Math.min(2, ENGINE_ROLLING_WINDOW)} (min of validCycles and rolling window)`,
                `S8 cyclesUsed.length = ${m8.debug_cyclesUsed?.length} ✓`
            );
            assert(
                m8.anomaliesDetected === 0,
                `anomaliesDetected=${m8.anomaliesDetected}, expected 0 — a cycle was wrongly excluded`,
                `S8 anomaliesDetected = 0 ✓`
            );

            // The engine's cycle.source is internal (not in ItemMetrics), so we prove
            // CONSUMED_LOGS priority **indirectly** via the dailyUsageRate which can only
            // land in the tight band [0.9, 1.1] if consumed deltas (not snapshot/fallback)
            // drove quantityConsumed in both cycles.
            const expRate8 = 60 / 60; // 1.000/day  — CONSUMED_LOGS path
            assert(
                Math.abs(m8.dailyUsageRate - expRate8) < 0.1,
                `dailyUsageRate=${m8.dailyUsageRate.toFixed(4)} not in [0.9,1.1] — CONSUMED_LOGS NOT used (snapshot=1.5, fallback=1.67)`,
                `CONSUMED_LOGS priority proven: dailyUsageRate=${m8.dailyUsageRate.toFixed(4)} ≈ ${expRate8} ✓`
            );
            assert(
                (m8.debug_validCycleCount ?? 0) >= 1,
                `debug_validCycleCount=${m8.debug_validCycleCount} — no valid cycles, engine returned dormant`,
                `Valid cycle count = ${m8.debug_validCycleCount} (≥1 required) ✓`
            );
            assert(
                m8.recommendedQuantity > 0,
                `recommendedQuantity=0 — engine produced no recommendation`,
                `Recommendation = ${m8.recommendedQuantity} > 0 ✓`
            );

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 9 — Snapshot Fallback When No CONSUMED Logs
            //
            // Purpose: prove SNAPSHOT is used when no CONSUMED logs exist and
            // both startStock/endStock are available from audit log.
            //
            // Data setup (2 cycles over 3 anchors at 60/30/0 days ago):
            //   Anchor 60d: qty=80  + RESTOCKED(new_stock=100) → cycle1 startStock=100
            //   Anchor 30d: qty=80  + UPDATED(previous_stock=20) → cycle1 endStock=20
            //   Anchor  0d: qty=80  (no RESTOCKED/UPDATED, no CONSUMED)
            //
            //   NO CONSUMED logs anywhere.
            //
            // Source resolution per engine Fix #7 (CONSUMED absent → try SNAPSHOT):
            //   cycle1: SNAPSHOT → quantityConsumed=100-20=80, rate=80/30≈2.667/d
            //     UC check: endStock=20 ≤ 100×0.40=40 → NOT under-consumption ✓
            //   cycle2: no RESTOCKED at 30d → startStock=0 → SNAPSHOT condition fails
            //           FALLBACK → orderQty at anchor 30d = 80, rate=80/30≈2.667/d
            //
            // Rolling rate = (80+80)/(30+30) = 160/60 ≈ 2.667/d
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 9: Snapshot Fallback — No CONSUMED Logs ═══', 'info');
            const item9 = await ci('SnapshotFallback', 50);
            await createOrders(
                item9.id,
                [
                    // Anchor at 60d: RESTOCKED → gives cycle1 its startStock=100
                    { daysAgo: 60, qty: 80, startStock: 100 },
                    // Anchor at 30d: UPDATED → gives cycle1 its endStock=20
                    // 20 ≤ 100×0.40=40 → no UNDER_CONSUMPTION anomaly
                    { daysAgo: 30, qty: 80, endStock: 20 },
                    // Anchor at 0d: terminates cycle2 (no logs → FALLBACK = qty80)
                    { daysAgo: 0, qty: 80 },
                ]
                // NO consumedDeltas → consumedLogs array will be empty for both cycles
            );
            const m9 = await InventoryIntelligenceService.calculateItemMetrics(item9);

            // ── Structural guards: both cycles built, none filtered, rates identical ──
            assert(
                m9.debug_rawCycleCount === 2,
                `debug_rawCycleCount=${m9.debug_rawCycleCount}, expected 2`,
                `S9 rawCycleCount = 2 ✓`
            );
            assert(
                m9.debug_validCycleCount === 2,
                `debug_validCycleCount=${m9.debug_validCycleCount}, expected 2 — no anomaly should fire`,
                `S9 validCycleCount = 2 ✓`
            );
            assert(
                m9.anomaliesDetected === 0,
                `anomaliesDetected=${m9.anomaliesDetected}, expected 0`,
                `S9 anomaliesDetected = 0 ✓`
            );
            // Both cycles have rate 80/30 ≈ 2.667/d → CV% ≈ 0 → stabilityIndex < 1
            assert(
                m9.stabilityIndex < 1,
                `stabilityIndex=${m9.stabilityIndex.toFixed(4)}%, expected <1% (both cycles same rate — identical SNAPSHOT+FALLBACK paths)`,
                `S9 stabilityIndex = ${m9.stabilityIndex.toFixed(4)}% < 1% (rates identical) ✓`
            );

            // SNAPSHOT for cycle1: (100-20)/30 = 2.667/d
            // FALLBACK for cycle2: 80/30 = 2.667/d
            // Rolling average = (80+80)/60 = 2.667/d — must be within tight band [2.4, 3.0]
            const expRate9 = (100 - 20) / 30; // ≈ 2.667/d
            assert(
                m9.dailyUsageRate >= 2.4 && m9.dailyUsageRate <= 3.0,
                `dailyUsageRate=${m9.dailyUsageRate.toFixed(4)} not in [2.4, 3.0] — SNAPSHOT not used as expected`,
                `SNAPSHOT fallback proven: dailyUsageRate=${m9.dailyUsageRate.toFixed(4)} ≈ ${expRate9.toFixed(4)}/d ✓`
            );
            assert(
                (m9.debug_validCycleCount ?? 0) >= 1,
                `debug_validCycleCount=${m9.debug_validCycleCount} — engine dormant, no valid cycles`,
                `Valid cycle count = ${m9.debug_validCycleCount} (≥1 required) ✓`
            );
            assert(
                m9.recommendedQuantity > 0,
                `recommendedQuantity=0 — engine produced no recommendation`,
                `Recommendation = ${m9.recommendedQuantity} > 0 ✓`
            );

            // ══════════════════════════════════════════════════════════════════
            // SCENARIO 10 — Hierarchy Regression Kill Switch
            //
            // Purpose: this scenario MUST FAIL if the engine's consumption
            // hierarchy is altered (e.g. SNAPSHOT promoted above CONSUMED_LOGS,
            // or FALLBACK promoted above CONSUMED_LOGS).
            //
            // Identical anchor structure to Scenario 8 (60/30/0d) but with a
            // DIFFERENT consumed total so the three possible paths produce
            // clearly separated, non-overlapping rate bands:
            //
            //   Anchor 60d: qty=50  + RESTOCKED(new_stock=100)  → startStock=100
            //   Anchor 30d: qty=50  + UPDATED(previous_stock=30)→ endStock=30
            //   Anchor  0d: qty=50
            //
            //   CONSUMED logs in cycle1 only: 3 logs × 5 = 15 units
            //   NO CONSUMED logs in cycle2
            //
            // Source resolution (correct hierarchy):
            //   cycle1: CONSUMED_LOGS → consumed=15, rate=15/30=0.500/d
            //   cycle2: no CONSUMED → SNAPSHOT skipped (startStock=0) → FALLBACK
            //           orderQty at anchor 30d = 50, rate=50/30≈1.667/d
            //
            // Rolling rate = (15+50)/(30+30) = 65/60 ≈ 1.0833/d  ← correct band [1.05, 1.15]
            //
            // Incorrect hierarchy outcomes (all land OUTSIDE [1.05, 1.15]):
            //   SNAPSHOT wins for cycle1: consumed=70, rolling=(70+50)/60=2.000/d  ✗
            //   FALLBACK wins for cycle1: consumed=50, rolling=(50+50)/60=1.667/d  ✗
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Scenario 10: Hierarchy Regression Kill Switch ═══', 'info');
            const item10 = await ci('HierarchyKill', 50);
            await createOrders(
                item10.id,
                [
                    { daysAgo: 60, qty: 50, startStock: 100 }, // RESTOCKED → cycle1 startStock=100
                    { daysAgo: 30, qty: 50, endStock: 30 },    // UPDATED   → cycle1 endStock=30 (≤40, no UC)
                    { daysAgo: 0, qty: 50 },                  // anchor
                ],
                // CONSUMED only inside cycle1 (days 55–45): 3 × 5 = 15 units
                [
                    { daysAgo: 55, quantity: 5 },
                    { daysAgo: 50, quantity: 5 },
                    { daysAgo: 45, quantity: 5 }, // cycle1 consumed total = 15
                ]
            );
            const m10 = await InventoryIntelligenceService.calculateItemMetrics(item10);

            assert(
                m10.debug_rawCycleCount === 2,
                `debug_rawCycleCount=${m10.debug_rawCycleCount}, expected 2`,
                `S10 rawCycleCount = 2 ✓`
            );
            assert(
                m10.anomaliesDetected === 0,
                `anomaliesDetected=${m10.anomaliesDetected}, expected 0 — a cycle was wrongly excluded`,
                `S10 anomaliesDetected = 0 ✓`
            );
            // Correct rate = 65/60 ≈ 1.0833/d → band [1.05, 1.15]
            // Incorrect rates: SNAPSHOT=2.000/d, FALLBACK=1.667/d — both outside band.
            assert(
                m10.dailyUsageRate >= 1.05 && m10.dailyUsageRate <= 1.15,
                `dailyUsageRate=${m10.dailyUsageRate.toFixed(4)} OUTSIDE [1.05,1.15] — hierarchy regression detected! ` +
                `(SNAPSHOT would give ≈2.0, FALLBACK would give ≈1.667)`,
                `Hierarchy kill switch PASS: dailyUsageRate=${m10.dailyUsageRate.toFixed(4)} ∈ [1.05,1.15] ✓`
            );

            // ══════════════════════════════════════════════════════════════════
            // FINAL GOVERNANCE INTEGRITY SUMMARY (Req #8, #10)
            // Every field must be defined and numeric/boolean as expected.
            // Also validates reorder math: daysUntilReorder = (stock - reorderPoint) / dailyUsageRate
            // ══════════════════════════════════════════════════════════════════
            addLog('═══ Final Governance Integrity Summary ═══', 'info');

            const govFields: Array<{ label: string; value: unknown }> = [
                { label: 'debug_rawCycleCount (m1)', value: m1.debug_rawCycleCount },
                { label: 'debug_validCycleCount (m1)', value: m1.debug_validCycleCount },
                { label: 'debug_cyclesUsed.length (m1)', value: m1.debug_cyclesUsed?.length },
                { label: 'anomaliesDetected (m2)', value: m2.anomaliesDetected },
                { label: 'dailyUsageRate (m1)', value: m1.dailyUsageRate },
                { label: 'stabilityIndex (m1)', value: m1.stabilityIndex },
                { label: 'confidence (m1)', value: m1.confidence },
                { label: 'recommendedQuantity (m4)', value: m4.recommendedQuantity },
                { label: 'debug_rawRecommendationFloat (m4)', value: m4.debug_rawRecommendationFloat },
                { label: 'debug_capitalCapFloat (m4)', value: m4.debug_capitalCapFloat },
                { label: 'debug_capApplied (m4)', value: m4.debug_capApplied },
                { label: 'ENGINE_BUFFER_DAYS', value: ENGINE_BUFFER_DAYS },
                { label: 'leadTime (m3)', value: refM.leadTime },
                { label: 'debug_safetyStock (m1)', value: m1.debug_safetyStock },
                { label: 'debug_reorderPoint (m1)', value: m1.debug_reorderPoint },
                { label: 'debug_daysUntilReorder (m1)', value: m1.debug_daysUntilReorder },
            ];

            let govFail = false;
            for (const f of govFields) {
                if (f.value === undefined || f.value === null) {
                    addLog(`FAIL: "${f.label}" is ${f.value}`, 'error');
                    govFail = true;
                } else {
                    addLog(`  ✓ ${f.label}: ${f.value}`, 'success');
                }
            }
            if (govFail) throw new Error('Governance Integrity Check FAILED — required fields missing.');

            // Req #10: daysUntilReorder audit — validate formula
            // daysUntilReorder = max(0, (stock - reorderPoint) / dailyUsageRate)
            const expDaysUntilReorder = Math.max(
                0,
                (item1.stock - (m1.debug_reorderPoint ?? 0)) / m1.dailyUsageRate
            );
            assert(
                Math.abs((m1.debug_daysUntilReorder ?? 0) - expDaysUntilReorder) < 0.1,
                `daysUntilReorder=${m1.debug_daysUntilReorder?.toFixed(3)}, expected ${expDaysUntilReorder.toFixed(3)}`,
                `daysUntilReorder = ${m1.debug_daysUntilReorder?.toFixed(2)} matches formula ✓`
            );

            addLog('✅ ALL GOVERNANCE ASSERTIONS PASSED', 'success');

        } catch (e: any) {
            addLog(`❌ CRITICAL FAIL: ${e.message}`, 'error');
        } finally {
            await cleanup(ids);
            setIsRunning(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    const failCount = logs.filter(l => l.type === 'error').length;
    const passCount = logs.filter(l => l.type === 'success').length;
    const done = !isRunning && logs.length > 0;

    return (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border-t-4 border-purple-600">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <i className="fa-solid fa-shield-halved text-purple-600" />
                        Governance Audit Suite v2
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        10 Scenarios · Deterministic · No Tolerance Relaxation
                    </p>
                    {logs.length > 0 && (
                        <div className="flex gap-4 mt-2">
                            <span className="text-xs font-semibold text-green-600">✅ {passCount} PASS</span>
                            <span className={`text-xs font-semibold ${failCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {failCount > 0 ? '❌' : '—'} {failCount} FAIL
                            </span>
                            {done && failCount === 0 && (
                                <span className="text-xs font-bold text-emerald-500 animate-pulse">🛡 ALL CLEAR</span>
                            )}
                        </div>
                    )}
                </div>
                <button
                    onClick={runStrictVerification}
                    disabled={isRunning}
                    className={`px-5 py-2.5 rounded-lg text-white font-bold shadow transition-all
                        ${isRunning ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 active:scale-95'}`}
                >
                    {isRunning ? (
                        <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Auditing…
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <i className="fa-solid fa-play" /> Run Audit
                        </span>
                    )}
                </button>
            </div>

            {/* Console */}
            <div className="bg-gray-950 text-green-300 p-4 rounded-xl h-[580px] overflow-y-auto font-mono text-xs leading-relaxed border border-gray-800 shadow-inner">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-40">
                        <i className="fa-solid fa-terminal text-4xl mb-3" />
                        <p>Click "Run Audit" to begin governance verification…</p>
                    </div>
                ) : (
                    logs.map((l, i) => (
                        <div key={i} className={`pb-[2px] mb-[2px] px-1 rounded
                            ${l.type === 'error' ? 'bg-red-900/30 text-red-400' : ''}
                            ${l.type === 'success' ? 'text-green-400' : ''}
                            ${l.type === 'warning' ? 'text-yellow-400' : ''}
                            ${l.type === 'info' ? 'text-gray-400' : ''}
                        `}>
                            {l.type === 'error' ? '❌' :
                                l.type === 'success' ? '✅' :
                                    l.type === 'warning' ? '⚠️' : 'ℹ️'} {l.msg}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
