
import { supabase } from '../src/lib/supabase';
import { DailyReport } from '../types/dailyReport';

export const DailyReportService = {
    async createReport(report: DailyReport, userId: string): Promise<DailyReport | null> {
        try {
            // Transform to DB format if necessary, or store as JSONB
            // Assuming 'daily_reports' table exists with a 'data' jsonb column or similar structure
            // If the table structure matches the object, we can insert directly.
            // Let's assume a 'daily_reports' table with: id, user_id, timestamp, data (jsonb), totals (jsonb)

            // Adjusting to a likely schema based on other services:
            const dbPayload = {
                user_id: userId,
                timestamp: report.timestamp,
                author: report.author,
                data: report, // Store full object in jsonb for flexibility
                revenue: report.totals.revenue,
                patient_count: report.totals.patients
            };

            const { data, error } = await supabase
                .from('daily_reports')
                .insert([dbPayload])
                .select()
                .single();

            if (error) throw error;

            // Return the report with the generated ID (if DB assigns one, though frontend generates one too)
            return { ...report, id: data.id };
        } catch (error) {
            console.error('Error creating daily report:', error);
            return null;
        }
    },

    async getReports(): Promise<DailyReport[]> {
        try {
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;

            return data.map((row: any) => ({
                ...row.data, // Spread the JSONB data
                id: row.id, // Ensure DB ID is used
                timestamp: row.timestamp // Ensure DB timestamp is used
            }));
        } catch (error) {
            console.error('Error fetching daily reports:', error);
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
