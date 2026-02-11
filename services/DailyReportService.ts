
import { supabase } from '../src/lib/supabase';
import { DailyReport } from '../types/dailyReport';

export const DailyReportService = {
    async createReport(report: DailyReport, userId: string): Promise<DailyReport | null> {
        console.log('[DailyReportService] Creating report via direct fetch...', { id: report.id, userId });
        try {
            // Get session for the access token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No active session — cannot create report');
            }

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

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const url = `${supabaseUrl}/rest/v1/daily_reports`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(dbPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] PostgREST INSERT error:', response.status, errorBody);
                throw new Error(`PostgREST error ${response.status}: ${errorBody}`);
            }

            const data = await response.json();
            console.log('[DailyReportService] ✅ Report created successfully via direct fetch:', data?.[0]?.id || report.id);
            return { ...report, id: data?.[0]?.id || report.id };
        } catch (error) {
            console.error('[DailyReportService] ❌ Error creating daily report:', error);
            throw error;
        }
    },

    async getReports(accessToken?: string): Promise<DailyReport[]> {
        console.log('[DailyReportService] Fetching reports...', accessToken ? '(token provided)' : '(will get session)');
        try {
            // Use provided token OR fall back to getSession()
            let token = accessToken;
            if (!token) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    console.warn('[DailyReportService] ⚠️ No active session, cannot fetch reports');
                    return [];
                }
                token = session.access_token;
            }

            // BYPASS Supabase JS client — use direct fetch to PostgREST API
            // The JS client's .from().select() deadlocks when multiple contexts
            // call getSession() and query simultaneously on page refresh.
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const url = `${supabaseUrl}/rest/v1/daily_reports?select=*&order=timestamp.desc`;

            console.log('[DailyReportService] Direct fetch to PostgREST...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] PostgREST error:', response.status, errorBody);
                throw new Error(`PostgREST error ${response.status}: ${errorBody}`);
            }

            const data = await response.json();
            console.log(`[DailyReportService] ✅ Fetched ${data?.length} reports via direct fetch`);

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
                console.error('[DailyReportService] ❌ Query aborted after 15s timeout');
            } else {
                console.error('[DailyReportService] ❌ Error fetching daily reports:', error);
            }
            return [];
        }
    },

    async deleteReport(id: string): Promise<boolean> {
        console.log('[DailyReportService] Deleting report via direct fetch...', id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('[DailyReportService] ❌ No active session — cannot delete report');
                return false;
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const url = `${supabaseUrl}/rest/v1/daily_reports?id=eq.${encodeURIComponent(id)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[DailyReportService] PostgREST DELETE error:', response.status, errorBody);
                return false;
            }

            console.log('[DailyReportService] ✅ Report deleted successfully:', id);
            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('[DailyReportService] ❌ Delete aborted after 15s timeout');
            } else {
                console.error('[DailyReportService] ❌ Error deleting daily report:', error);
            }
            return false;
        }
    },

    async restoreLocalReports(): Promise<number> {
        try {
            const localData = localStorage.getItem('ha_daily_reports');
            if (!localData) return 0;

            const reports: DailyReport[] = JSON.parse(localData);
            if (!Array.isArray(reports) || reports.length === 0) return 0;

            let restoredCount = 0;

            for (const report of reports) {
                // Check if exists
                const { data } = await supabase.from('daily_reports').select('id').eq('id', report.id).single();
                if (!data) {
                    // Insert if missing
                    // Using author name as user_id might fail if RLS requires UUID.
                    // Actually, createReport takes (report, userId).
                    // The local report might not have the original userId attached in a way we can trust for RLS if it's strictly UUID.
                    // However, for recovery, we might need to fetch the current user's ID or leniently insert.
                    // Let's assume the user running this IS the author or we use their ID.
                    // But wait, createReport signature is (report, userId).
                    // We'll updated createReport to handle this or just raw insert here.

                    const { error } = await supabase.from('daily_reports').insert({
                        id: report.id,
                        user_id: (await supabase.auth.getUser()).data.user?.id, // Claim ownership by key restorer
                        timestamp: report.timestamp,
                        revenue: report.totals.revenue,
                        cash: report.financials.methods.cash,
                        card: report.financials.methods.credit,
                        patients: report.totals.patients,
                        notes: report.notes,
                        is_balanced: report.isBalanced,
                        author: report.author,
                        data: report // Store full JSON
                    });

                    if (!error) restoredCount++;
                }
            }
            return restoredCount;
        } catch (e) {
            console.error("Restoration failed", e);
            return 0;
        }
    }
};
