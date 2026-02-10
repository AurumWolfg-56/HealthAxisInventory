
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
    }
};
