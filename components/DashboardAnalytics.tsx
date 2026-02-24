
import React, { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, ComposedChart, Line
} from 'recharts';
import { DailyReport, DailyReportState } from '../types/dailyReport';
import { InventoryItem, Order, User } from '../types';
import DateRangeFilter, { DateRange } from './dashboard/DateRangeFilter';
import StatCard from './dashboard/StatCard';

interface DashboardAnalyticsProps {
    dailyReports: DailyReport[];
    inventory: InventoryItem[];
    orders: Order[];
    users: User[]; // Needed for provider names
    t: (key: string) => string;
    onNavigate: (route: any, subTab?: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#14b8a6'];

const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
    dailyReports, inventory, orders, users, t, onNavigate
}) => {
    const [dateRange, setDateRange] = useState<DateRange>('month');

    // --- 1. Filter Data based on Range ---
    const filteredReports = useMemo(() => {
        const now = new Date();
        let startDate = new Date();

        if (dateRange === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateRange === 'semester') {
            startDate.setMonth(now.getMonth() - 6);
        } else if (dateRange === 'year') {
            startDate.setFullYear(now.getFullYear() - 1);
        }

        // Sort chronological
        return dailyReports
            .filter(r => new Date(r.timestamp) >= startDate)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [dailyReports, dateRange]);

    const filteredOrders = useMemo(() => {
        const now = new Date();
        let startDate = new Date();

        if (dateRange === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateRange === 'semester') {
            startDate.setMonth(now.getMonth() - 6);
        } else if (dateRange === 'year') {
            startDate.setFullYear(now.getFullYear() - 1);
        }

        return orders.filter(o => new Date(o.orderDate) >= startDate);
    }, [orders, dateRange]);


    // --- 2. Calculate Aggregates ---

    // KPI Totals
    const totalRevenue = filteredReports.reduce((acc, r) => acc + (r.totals?.revenue || 0), 0);
    const totalPatients = filteredReports.reduce((acc, r) => acc + (r.totals?.patients || 0), 0);
    const validOrders = filteredOrders.filter(o => o.status !== 'CANCELLED');
    const totalSpend = validOrders.reduce((acc, o) => acc + (o.grandTotal || 0), 0);
    const netIncome = totalRevenue - totalSpend;

    // Clinical Stats
    const totalNewPts = filteredReports.reduce((acc, r) => acc + (r.stats?.newPts || 0), 0);
    const totalEstPts = filteredReports.reduce((acc, r) => acc + (r.stats?.estPts || 0), 0);
    const totalXRays = filteredReports.reduce((acc, r) => acc + (r.stats?.xrays || 0), 0);
    const totalNurseVisits = filteredReports.reduce((acc, r) => acc + (r.operational?.nurseVisits || 0), 0);

    // Financial Breakdown
    const collectionsByMethod = filteredReports.reduce((acc, r) => {
        acc.cash += r.financials?.methods?.cash || 0;
        acc.credit += r.financials?.methods?.credit || 0;
        acc.check += r.financials?.methods?.check || 0;
        acc.moneyOrder += (r.financials?.methods as any)?.moneyOrder || 0; // Handle legacy type compatibility
        return acc;
    }, { cash: 0, credit: 0, check: 0, moneyOrder: 0 });

    // Insurance Breakdown
    const patientsByInsurance = filteredReports.reduce((acc, r) => {
        if (!r.insurances) return acc;
        Object.keys(r.insurances).forEach(key => {
            acc[key] = (acc[key] || 0) + (r.insurances as any)[key];
        });
        return acc;
    }, {} as Record<string, number>);

    // Provider Stats (Patients)
    const patientsByProvider = filteredReports.reduce((acc, r) => {
        if (!r.operational?.providerVisits) return acc;
        Object.entries(r.operational.providerVisits).forEach(([providerId, count]) => {
            // Try to find provider name
            // Depending on how providerVisits is stored (ID vs Name), adjust here. 
            // Assuming ID based on types, but DailyCloseWizard implies we might be storing IDs.
            // Let's rely on the key for now.
            acc[providerId] = (acc[providerId] || 0) + count;
        });
        return acc;
    }, {} as Record<string, number>);

    // Provider Stats (Spend - Orders)
    const spendByProvider = validOrders.reduce((acc, o) => {
        const creator = users.find(u => u.id === o.createdBy)?.username || 'Unknown';
        acc[creator] = (acc[creator] || 0) + o.grandTotal;
        return acc;
    }, {} as Record<string, number>);

    // Inventory Stats
    const lowStockCount = inventory.filter(i => i.stock <= i.minStock).length;
    const expiringCount = inventory.filter(i => {
        if (!i.expiryDate) return false;
        const today = new Date();
        const exp = new Date(i.expiryDate);
        const thirtyDays = new Date();
        thirtyDays.setDate(today.getDate() + 30);
        return exp >= today && exp <= thirtyDays;
    }).length;

    const expiredCount = inventory.filter(i => {
        if (!i.expiryDate) return false;
        return new Date(i.expiryDate) < new Date();
    }).length;

    const topExpensiveItems = [...inventory]
        .sort((a, b) => b.averageCost - a.averageCost)
        .slice(0, 5);


    // --- 3. Format Data for Charts ---

    const revenueTrendData = filteredReports.map(r => ({
        date: new Date(r.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: r.totals?.revenue || 0,
        patients: r.totals?.patients || 0
    }));
    // If data is dense (year view), maybe aggregate by month?
    // automated aggregation for cleanliness if > 31 points
    const optimizedRevenueData = useMemo(() => {
        if (revenueTrendData.length <= 31) return revenueTrendData;

        // Aggregate by Month-Year
        const map = new Map();
        revenueTrendData.forEach(d => {
            const dateObj = new Date(d.date);
            const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
            if (!map.has(key)) map.set(key, d);
        });
        return Array.from(map.values());
    }, [revenueTrendData]);

    const incomeExpenseByMonth = useMemo(() => {
        const monthlyData: Record<string, { income: number, expense: number, monthSort: string }> = {};

        // Process Reports (Income)
        filteredReports.forEach(r => {
            const date = new Date(r.timestamp);
            const monthKey = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expense: 0, monthSort: sortKey };
            monthlyData[monthKey].income += (r.totals?.revenue || 0);
        });

        // Process Orders (Expense)
        validOrders.forEach(o => {
            const date = new Date(o.orderDate);
            const monthKey = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, expense: 0, monthSort: sortKey };
            monthlyData[monthKey].expense += (o.grandTotal || 0);
        });

        return Object.entries(monthlyData)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.monthSort.localeCompare(b.monthSort));

    }, [filteredReports, validOrders]);

    const methodData = [
        { name: 'Cash', value: collectionsByMethod.cash },
        { name: 'Credit', value: collectionsByMethod.credit },
        { name: 'Check', value: collectionsByMethod.check },
        { name: 'Money Order', value: collectionsByMethod.moneyOrder },
    ];

    const insuranceData = Object.entries(patientsByInsurance).map(([key, value]) => ({
        name: key.replace(/([A-Z])/g, ' $1').trim(), // Camel to Title
        value: value as number
    })).filter((d: { value: number }) => d.value > 0);

    const providerPatientData = Object.entries(patientsByProvider).map(([key, value]) => {
        // If key is UUID, try to resolve name
        const user = users.find(u => u.id === key);
        return {
            name: user ? user.username : key,
            value: value as number
        };
    }).filter((d: { value: number }) => d.value > 0);

    const providerSpendData = Object.entries(spendByProvider).map(([key, value]) => ({
        name: key,
        value: value as number
    })).sort((a: { value: number }, b: { value: number }) => b.value - a.value);


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 dark:bg-[#151b23]/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800">
                    <p className="font-bold text-slate-800 dark:text-white mb-3 text-sm">{label}</p>
                    <div className="space-y-2">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></div>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">{entry.name}</span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    {entry.name === 'Revenue' || entry.name === 'Total Spend' || entry.name.includes('Spend') || entry.name === 'Value'
                                        ? `$${Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        : entry.value.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-in-up">

            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics Overview</h2>
                    <p className="text-slate-500 text-sm">Real-time performance metrics</p>
                </div>
                <DateRangeFilter currentRange={dateRange} onRangeChange={setDateRange} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Revenue"
                    value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon="fa-sack-dollar"
                    color="emerald"
                />
                {/* Net Income Removed */}
                <StatCard
                    label="Total Spend"
                    value={`$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon="fa-money-bill-transfer"
                    color="red"
                />
                <StatCard
                    label="Total Patients"
                    value={totalPatients.toLocaleString()}
                    icon="fa-users"
                    color="blue"
                />
                <StatCard
                    label="New Patients"
                    value={totalNewPts.toLocaleString()}
                    icon="fa-user-plus"
                    color="amber"
                />
                <StatCard
                    label="Est. Patients"
                    value={totalEstPts.toLocaleString()}
                    icon="fa-user-check"
                    color="teal"
                />
                <StatCard
                    label="Nurse Visits"
                    value={totalNurseVisits.toLocaleString()}
                    icon="fa-user-nurse"
                    color="purple"
                />
                <StatCard
                    label="X-Rays"
                    value={totalXRays.toLocaleString()}
                    icon="fa-bone"
                    color="indigo"
                />
            </div>

            {/* Main Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Income vs Expenses Chart */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Income vs Expenses (Monthly)
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={incomeExpenseByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                                    </linearGradient>
                                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: [8, 8, 0, 0] }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="income" name="Income" fill="url(#colorInc)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="expense" name="Expense" fill="url(#colorExp)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue Area Chart */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Revenue & Patient Trend
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={optimizedRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.4} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} minTickGap={30} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                                <Line yAxisId="right" type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Main Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">

                {/* Payment Methods Breakdown */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Collections (Methods)
                    </h3>
                    <div className="h-[250px] w-full flex flex-col items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={methodData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    cornerRadius={8}
                                    stroke="none"
                                >
                                    {methodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Collection Breakdown Table */}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm max-w-sm mx-auto">
                        {methodData.map((m, i) => (
                            <div key={m.name} className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">{m.name}</span>
                                </div>
                                <span className="font-bold text-slate-800 dark:text-slate-200">${m.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Patients by Insurance */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Patients by Insurance
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={insuranceData} margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 13, fontWeight: 500, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }} />
                                <Bar dataKey="value" name="Patients" radius={[0, 8, 8, 0]} maxBarSize={40}>
                                    {insuranceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Patients by Provider */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Visits by Provider
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={providerPatientData} margin={{ top: 20 }}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 500, fill: '#64748B' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: [8, 8, 0, 0] }} />
                                <Bar dataKey="value" name="Patients" fill="url(#barGradient)" radius={[8, 8, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Inventory & Spending Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Inventory Health */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-4">
                        <span className="section-title-bar"></span>
                        Inventory Health
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl transition-all hover:scale-[1.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
                                    <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                                </div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">Below Minimum</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{lowStockCount}</span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl transition-all hover:scale-[1.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                                    <i className="fa-solid fa-clock text-xl"></i>
                                </div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">Expiring (30d)</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{expiringCount}</span>
                        </div>

                        <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl transition-all hover:scale-[1.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center shadow-inner">
                                    <i className="fa-solid fa-ban text-xl"></i>
                                </div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">Expired</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{expiredCount}</span>
                        </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-8 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <i className="fa-solid fa-gem text-indigo-400"></i> Top Valued Items
                    </h4>
                    <div className="space-y-3">
                        {topExpensiveItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[70%]">{item.name}</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${item.averageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Spend by Provider Chart */}
                <div className="glass-panel p-6 lg:col-span-2">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Inventory Spend by Provider
                    </h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={providerSpendData} margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                                <XAxis type="number" tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 13, fontWeight: 500, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }} />
                                <Bar dataKey="value" name="Total Spend" radius={[0, 8, 8, 0]} maxBarSize={45}>
                                    {providerSpendData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Pending Orders List - could be added if needed, but we have a dedicated page */}

        </div >
    );
};

export default DashboardAnalytics;
