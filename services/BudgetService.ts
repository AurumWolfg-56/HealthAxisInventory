import { supabase } from '../src/lib/supabase';
import { Budget } from '../types';

export const BudgetService = {
    async getBudgets(userId?: string): Promise<Budget[]> {
        if (!userId) return [];

        const { data, error } = await supabase
            .from('budgets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching budgets:', error);
            throw error;
        }

        return (data || []).map(item => ({
            id: item.id,
            category: item.category,
            amount: Number(item.amount),
            period: item.period,
            startDate: item.start_date,
            endDate: item.end_date,
            createdAt: item.created_at,
            updatedAt: item.updated_at
        }));
    },

    async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<Budget | null> {
        const { data, error } = await supabase
            .from('budgets')
            .insert([{
                user_id: userId,
                category: budget.category,
                amount: budget.amount,
                period: budget.period,
                start_date: budget.startDate,
                end_date: budget.endDate
            }])
            .select()
            .single();

        if (error) {
            console.error('Error creating budget:', error);
            throw error;
        }

        if (!data) return null;

        return {
            id: data.id,
            category: data.category,
            amount: Number(data.amount),
            period: data.period,
            startDate: data.start_date,
            endDate: data.end_date,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget | null> {
        const dbUpdates: any = { updated_at: new Date().toISOString() };
        if (updates.category !== undefined) dbUpdates.category = updates.category;
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.period !== undefined) dbUpdates.period = updates.period;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;

        const { data, error } = await supabase
            .from('budgets')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating budget:', error);
            throw error;
        }

        if (!data) return null;

        return {
            id: data.id,
            category: data.category,
            amount: Number(data.amount),
            period: data.period,
            startDate: data.start_date,
            endDate: data.end_date,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    async deleteBudget(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting budget:', error);
            throw error;
        }

        return true;
    }
};
