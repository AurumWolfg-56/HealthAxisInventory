
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
            console.log('[DailyReportService] ✅ Report created:', data?.[0]?.id || report.id);
            return { ...report, id: data?.[0]?.id || report.id };
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

            let restoredCount = 0;

            for (const report of reports) {
                // Check if exists via direct fetch
                const checkUrl = `${SUPABASE_URL}/rest/v1/daily_reports?id=eq.${encodeURIComponent(report.id)}&select=id`;
                const checkResp = await fetch(checkUrl, { method: 'GET', headers: getHeaders() });
                const existing = await checkResp.json();

                if (!existing || existing.length === 0) {
                    const insertUrl = `${SUPABASE_URL}/rest/v1/daily_reports`;
                    const resp = await fetch(insertUrl, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            id: report.id,
                            user_id: userIdOverride || null,
                            timestamp: report.timestamp,
                            revenue: report.totals?.revenue || 0,
                            cash: report.financials?.methods?.cash || 0,
                            card: report.financials?.methods?.credit || 0,
                            patients: report.totals?.patients || 0,
                            notes: report.notes || '',
                            is_balanced: report.isBalanced || false,
                            author: report.author || '',
                            data: report
                        })
                    });
                    if (resp.ok) restoredCount++;
                }
            }
            return restoredCount;
        } catch (e) {
            console.error("Restoration failed", e);
            return 0;
        }
    }
};
