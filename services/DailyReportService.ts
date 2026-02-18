
import { DailyReport } from '../types/dailyReport';

// ──────────────────────────────────────────────────────────────────────
// TOKEN CACHE — set once by AppDataContext, reused by ALL functions.
// This completely eliminates getSession() calls which deadlock the
// Supabase JS client when multiple contexts compete for it.
// ──────────────────────────────────────────────────────────────────────
let _cachedToken: string | null = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders(): Record<string, string> {
    if (!_cachedToken) {
        console.error('[DailyReportService] ❌ No cached token! setAccessToken() was never called.');
        throw new Error('No access token available — call setAccessToken() first');
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

export const DailyReportService = {
    /**
     * MUST be called once with the session's access_token.
     * AppDataContext calls this when it gets the session.
     */
    setAccessToken(token: string) {
        _cachedToken = token;
        console.log('[DailyReportService] 🔑 Access token cached');
    },

    clearAccessToken() {
        _cachedToken = null;
    },

    async createReport(report: DailyReport, userId: string): Promise<DailyReport | null> {
        console.log('[DailyReportService] Creating report...', { id: report.id, userId });
        try {
            const dbPayload = {
                id: report.id,
                user_id: userId,
                timestamp: report.timestamp,
                author: report.author,
                data: report,
                revenue: report.totals.revenue,
                patient_count: report.totals.patients,
                cash: report.financials.methods.cash,
                card: report.financials.methods.credit,
                is_balanced: report.isBalanced,
                notes: report.notes,
                patients: report.totals.patients
            };

            const url = `${SUPABASE_URL}/rest/v1/daily_reports`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'POST',
                headers: { ...getHeaders(), 'Prefer': 'return=representation' },
                body: JSON.stringify(dbPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] ❌ POST error:', response.status, errorBody);
                throw new Error(`PostgREST error ${response.status}: ${errorBody}`);
            }

            const data = await response.json();
            const newReport = { ...report, id: data?.[0]?.id || report.id };

            console.log('[DailyReportService] ✅ Report created:', newReport.id);

            // Backup to local storage for safety/history
            this.saveLocalReport(newReport);

            return newReport;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[DailyReportService] ❌ Create aborted after 15s timeout');
            } else {
                console.error('[DailyReportService] ❌ Error creating report:', error);
            }
            throw error;
        }
    },

    async getReports(): Promise<DailyReport[]> {
        console.log('[DailyReportService] Fetching reports...');
        try {
            const url = `${SUPABASE_URL}/rest/v1/daily_reports?select=*&order=timestamp.desc`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] ❌ GET error:', response.status, errorBody);
                throw new Error(`PostgREST error ${response.status}: ${errorBody}`);
            }

            const data = await response.json();
            console.log(`[DailyReportService] ✅ Fetched ${data?.length} reports`);

            return (data || []).map((row: any) => {
                if (!row.data) console.warn('[DailyReportService] Report row missing data column:', row.id);
                return {
                    ...row.data,
                    id: row.id,
                    timestamp: row.timestamp
                };
            });
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[DailyReportService] ❌ Fetch aborted after 15s timeout');
            } else {
                console.error('[DailyReportService] ❌ Error fetching reports:', error);
            }
            return [];
        }
    },

    async deleteReport(id: string): Promise<boolean> {
        console.log('[DailyReportService] Deleting report...', id);
        try {
            const url = `${SUPABASE_URL}/rest/v1/daily_reports?id=eq.${encodeURIComponent(id)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'DELETE',
                headers: getHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] ❌ DELETE error:', response.status, errorBody);
                return false;
            }

            console.log('[DailyReportService] ✅ Report deleted:', id);
            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[DailyReportService] ❌ Delete aborted after 15s timeout');
            } else {
                console.error('[DailyReportService] ❌ Error deleting report:', error);
            }
            return false;
        }
    },

    async restoreLocalReports(userIdOverride?: string): Promise<number> {
        try {
            const localData = localStorage.getItem('ha_daily_reports');
            if (!localData) return 0;

            const reports: DailyReport[] = JSON.parse(localData);
            if (!Array.isArray(reports) || reports.length === 0) return 0;

            let restoredCount = 0; console.log(`[DailyReportService] Attempting to restore ${reports.length} local reports...`);

            for (const report of reports) {
                // Check if exists via direct fetch
                const checkUrl = `${SUPABASE_URL}/rest/v1/daily_reports?id=eq.${encodeURIComponent(report.id)}&select=id`;
                const checkResp = await fetch(checkUrl, { method: 'GET', headers: getHeaders() });
                const existing = await checkResp.json();

                if (!existing || existing.length === 0) {
                    const insertUrl = `${SUPABASE_URL}/rest/v1/daily_reports`;

                    const dbPayload = {
                        id: report.id,
                        user_id: userIdOverride || null,
                        timestamp: report.timestamp,
                        author: report.author,
                        data: report, // JSONB structure
                        revenue: report.totals.revenue,
                        patient_count: report.totals.patients,
                        cash: report.financials.methods.cash,
                        card: report.financials.methods.credit,
                        is_balanced: report.isBalanced,
                        notes: report.notes
                    };

                    const resp = await fetch(insertUrl, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(dbPayload)
                    });
                    if (resp.ok) restoredCount++;
                    else console.warn(`[DailyReportService] Failed to restore ${report.id}:`, await resp.text());
                }
            }
            return restoredCount;
        } catch (e) {
            console.error("[DailyReportService] Restoration failed", e);
            return 0;
        }
    },

    saveLocalReport(report: DailyReport) {
        try {
            const raw = localStorage.getItem('ha_daily_reports');
            let current: DailyReport[] = raw ? JSON.parse(raw) : [];

            // Ensure array
            if (!Array.isArray(current)) current = [];

            // Remove if exists (update)
            current = current.filter(r => r.id !== report.id);

            // Add to top
            current.unshift(report);

            // Limit to 50 items
            if (current.length > 50) current = current.slice(0, 50);

            localStorage.setItem('ha_daily_reports', JSON.stringify(current));
            console.log('[DailyReportService] 💾 Saved report to local backup');
        } catch (e) {
            console.error('[DailyReportService] Failed to save local backup', e);
        }
    }
};
