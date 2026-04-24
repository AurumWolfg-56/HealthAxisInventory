import { Shift, TimeOffRequest } from '../types';

export class ScheduleService {
    private static accessToken: string | null = null;
    private static locationId: string | null = null;
    private static apiUrl = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
    private static apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    static setAccessToken(token: string) {
        this.accessToken = token;
    }

    static setLocationId(id: string) {
        this.locationId = id;
    }

    private static getHeaders() {
        if (!this.accessToken) {
            console.warn('[ScheduleService] ⚠️ No access token! Operations may fail.');
        }
        return {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.accessToken || this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    /**
     * Fetch shifts for a specific date range (inclusive).
     */
    static async fetchShifts(startDate: string, endDate: string): Promise<Shift[]> {
        try {
            if (!this.accessToken) return [];

            const locFilter = this.locationId ? `&location_id=eq.${this.locationId}` : '';
            const query = `?date=gte.${startDate}&date=lte.${endDate}${locFilter}&order=date.asc`;
            
            const response = await fetch(`${this.apiUrl}/shifts${query}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (!data) return [];

            return data;
        } catch (error) {
            console.error('[ScheduleService] Fetch failed:', error);
            return [];
        }
    }

    /**
     * Creates a single shift
     */
    static async createShift(shiftData: Omit<Shift, 'id' | 'created_at' | 'updated_at'>): Promise<Shift | null> {
        try {
            const response = await fetch(`${this.apiUrl}/shifts`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    ...shiftData,
                    location_id: shiftData.location_id || this.locationId
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create shift (${response.status}): ${text}`);
            }

            const saved = await response.json();
            return saved[0] as Shift;
        } catch (error) {
            console.error('[ScheduleService] Create failed:', error);
            throw error;
        }
    }

    /**
     * Update an existing shift
     */
    static async updateShift(shiftId: string, updates: Partial<Shift>): Promise<Shift | null> {
        try {
            delete updates.id;
            delete updates.created_at;

            const response = await fetch(`${this.apiUrl}/shifts?id=eq.${shiftId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update shift (${response.status}): ${text}`);
            }

            const saved = await response.json();
            return saved[0] as Shift;
        } catch (error) {
            console.error('[ScheduleService] Update failed:', error);
            throw error;
        }
    }

    /**
     * Delete a single shift
     */
    static async deleteShift(shiftId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiUrl}/shifts?id=eq.${shiftId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to delete shift (${response.status})`);
            }
            return true;
        } catch (error) {
            console.error('[ScheduleService] Delete failed:', error);
            return false;
        }
    }

    /**
     * Bulk Upsert: Deletes existing shifts for a given array of IDs (if provided) 
     * and inserts the new ones. Useful for "Time Machine" week duplications.
     */
    static async bulkCreateShifts(shifts: Omit<Shift, 'id' | 'created_at' | 'updated_at'>[]): Promise<Shift[]> {
        try {
            if (shifts.length === 0) return [];
            
            const payload = shifts.map(s => ({
                ...s,
                location_id: s.location_id || this.locationId
            }));

            const response = await fetch(`${this.apiUrl}/shifts`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Bulk create failed (${response.status}): ${text}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[ScheduleService] Bulk create failed:', error);
            throw error;
        }
    }

    /**
     * TIME-OFF REQUESTS
     */

    static async fetchTimeOffRequests(startDate: string, endDate: string): Promise<TimeOffRequest[]> {
        try {
            if (!this.accessToken) return [];

            const locFilter = this.locationId ? `&location_id=eq.${this.locationId}` : '';
            // We want to fetch all requests that overlap with the visible dashboard date
            const query = `?or=(and(start_date.lte.${endDate},end_date.gte.${startDate}))${locFilter}&order=created_at.desc`;
            
            const response = await fetch(`${this.apiUrl}/time_off_requests${query}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            return data || [];
        } catch (error) {
            console.error('[ScheduleService] Fetch TimeOff failed:', error);
            return [];
        }
    }

    static async createTimeOffRequest(requestData: Omit<TimeOffRequest, 'id' | 'created_at' | 'updated_at'>): Promise<TimeOffRequest | null> {
        try {
            const response = await fetch(`${this.apiUrl}/time_off_requests`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    ...requestData,
                    location_id: requestData.location_id || this.locationId
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create time-off request (${response.status}): ${text}`);
            }

            const saved = await response.json();
            return saved[0] as TimeOffRequest;
        } catch (error) {
            console.error('[ScheduleService] Create TimeOff failed:', error);
            throw error;
        }
    }

    static async updateTimeOffRequestStatus(requestId: string, status: 'approved' | 'rejected', reviewerId: string): Promise<TimeOffRequest | null> {
        try {
            const response = await fetch(`${this.apiUrl}/time_off_requests?id=eq.${requestId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    status,
                    reviewed_by: reviewerId,
                    updated_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to update time-off request (${response.status}): ${text}`);
            }

            const saved = await response.json();
            return saved[0] as TimeOffRequest;
        } catch (error) {
            console.error('[ScheduleService] Update TimeOff failed:', error);
            throw error;
        }
    }

    /**
     * NOTIFICATIONS
     */
    static async notifyScheduleChange(email?: string, shiftDetails?: any): Promise<boolean> {
        try {
            const url = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/send-email';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'schedule_change',
                    to: email,
                    data: shiftDetails
                })
            });
            return response.ok;
        } catch (error) {
            console.error('[ScheduleService] Notify failed', error);
            return false;
        }
    }
}
