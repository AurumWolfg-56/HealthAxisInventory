
import { supabase } from '../src/lib/supabase';
import { DailyReport } from '../types/dailyReport';

export const DailyReportService = {
    async createReport(report: DailyReport, userId: string): Promise<DailyReport | null> {
        console.log('[DailyReportService] Creating report...', { id: report.id, userId });
        try {
            // Transform to DB format
            // We include specific columns that match the table schema based on restoreLocalReports usage
            const dbPayload = {
                id: report.id, // Critical: DB requires ID and lacks default gen_random_uuid() or similar
                user_id: userId,
                timestamp: report.timestamp,
                author: report.author,
                data: report, // Store full object in jsonb for flexibility
                revenue: report.totals.revenue,
                patient_count: report.totals.patients,
                // Add missing fields required by schema/restore logic
                cash: report.financials.methods.cash,
                card: report.financials.methods.credit,
                is_balanced: report.isBalanced,
                notes: report.notes,
                patients: report.totals.patients // Redundant but safer if schema uses 'patients' vs 'patient_count'
            };

            const { data, error } = await supabase
                .from('daily_reports')
                .insert([dbPayload])
                .select()
                .single();

            if (error) {
                console.error('[DailyReportService] Supabase INSERT error:', error);
                throw error;
            }

            console.log('[DailyReportService] Report created successfully:', data);
            return { ...report, id: data.id };
        } catch (error) {
            console.error('[DailyReportService] Error creating daily report:', error);
            throw error; // Throw error so UI knows it failed
        }
    },

    async getReports(): Promise<DailyReport[]> {
        console.log('[DailyReportService] Fetching reports...');
        try {
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) {
                console.error('[DailyReportService] Supabase SELECT error:', error);
                throw error;
            }

            console.log(`[DailyReportService] Fetched ${data?.length} reports`);

            return data.map((row: any) => {
                if (!row.data) console.warn('[DailyReportService] Report row missing data column:', row.id);
                return {
                    ...row.data, // Spread the JSONB data
                    id: row.id, // Ensure DB ID is used
                    timestamp: row.timestamp // Ensure DB timestamp is used
                };
            });
        } catch (error) {
            console.error('[DailyReportService] Error fetching daily reports:', error);
            return [];
        }
    },

    async deleteReport(id: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('daily_reports')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting daily report:', error);
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
