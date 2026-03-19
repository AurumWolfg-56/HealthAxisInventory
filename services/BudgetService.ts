import { Budget } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _cachedToken: string | null = null;

const getHeaders = () => {
    if (!_cachedToken) {
        console.error('[BudgetService] ❌ No cached token!');
        throw new Error('No access token cached for BudgetService');
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };
};

const mapRow = (item: any): Budget => ({
    id: item.id,
    category: item.category,
    amount: Number(item.amount),
    period: item.period,
    startDate: item.start_date,
    endDate: item.end_date,
    createdAt: item.created_at,
    updatedAt: item.updated_at
});

export const BudgetService = {
    setAccessToken(token: string) {
        _cachedToken = token;
        console.log('[BudgetService] 🔑 Access token cached');
    },

    async getBudgets(userId?: string): Promise<Budget[]> {
        if (!userId) return [];

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/budgets?select=*&order=created_at.desc`,
            { headers: getHeaders() }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('[BudgetService] Error fetching budgets:', err);
            throw new Error(`Failed to fetch budgets: ${response.status}`);
        }

        const data = await response.json();
        return (data || []).map(mapRow);
    },

    async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<Budget | null> {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/budgets`,
            {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    user_id: userId,
                    category: budget.category,
                    amount: budget.amount,
                    period: budget.period,
                    start_date: budget.startDate,
                    end_date: budget.endDate
                })
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('[BudgetService] Error creating budget:', err);
            throw new Error(`Failed to create budget: ${response.status}`);
        }

        const data = await response.json();
        return data?.[0] ? mapRow(data[0]) : null;
    },

    async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget | null> {
        const dbUpdates: any = { updated_at: new Date().toISOString() };
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.period !== undefined) dbUpdates.period = updates.period;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/budgets?id=eq.${id}`,
            {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify(dbUpdates)
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('[BudgetService] Error updating budget:', err);
            throw new Error(`Failed to update budget: ${response.status}`);
        }

        const data = await response.json();
        return data?.[0] ? mapRow(data[0]) : null;
    },

    async deleteBudget(id: string): Promise<boolean> {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/budgets?id=eq.${id}`,
            {
                method: 'DELETE',
                headers: { ...getHeaders(), 'Prefer': '' }
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('[BudgetService] Error deleting budget:', err);
            throw new Error(`Failed to delete budget: ${response.status}`);
        }

        return true;
    }
};
