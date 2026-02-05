
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
    const totalSpend = filteredOrders.reduce((acc, o) => acc + (o.grandTotal || 0), 0);
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
    const spendByProvider = filteredOrders.reduce((acc, o) => {
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
            const dateObj = new Date(d.date); // This parsing might be tricky with "MMM D" format in all locales
            // Workaround: Use index or just sample. 
            // Better: Re-map from filteredReports with aggregation logic
            return;
        });

        // Simple fallback: if year view, just show as is, Recharts handles density okay-ish, or just limit ticks
        return revenueTrendData;
    }, [revenueTrendData]);

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


    // --- 4. Render ---

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
                    value={`$${totalRevenue.toLocaleString()}`}
                    icon="fa-sack-dollar"
                    color="emerald"
                // trend={{ value: 12, isPositive: true, label: "vs last period" }} // Mock trend for now
                />
                <StatCard
                    label="Net Income"
                    value={`$${netIncome.toLocaleString()}`}
                    icon="fa-scale-balanced"
                    color="indigo"
                />
                <StatCard
                    label="Total Spend"
                    value={`$${totalSpend.toLocaleString()}`}
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

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Area Chart */}
                <div className="lg:col-span-2 glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Revenue & Patient Trend
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={optimizedRevenueData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} minTickGap={30} />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickFormatter={(val) => `$${val / 1000}k`} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Legend />
                                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                <Line yAxisId="right" type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Collections by Method
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={methodData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {methodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Patients by Payer (Insurance) */}
                <div className="glass-panel p-6">
                    <h3 className="section-title mb-6">
                        <span className="section-title-bar"></span>
                        Patients by Insurance
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={insuranceData} margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" name="Patients" radius={[0, 4, 4, 0]}>
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
                        Patients by Provider
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={providerPatientData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" name="Patients" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
                        <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-200 flex items-center justify-center">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-200">Below Minimum</span>
                            </div>
                            <span className="text-xl font-bold text-slate-900 dark:text-white">{lowStockCount}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-200 flex items-center justify-center">
                                    <i className="fa-solid fa-clock"></i>
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-200">Expiring (30d)</span>
                            </div>
                            <span className="text-xl font-bold text-slate-900 dark:text-white">{expiringCount}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                                    <i className="fa-solid fa-ban"></i>
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-200">Expired</span>
                            </div>
                            <span className="text-xl font-bold text-slate-900 dark:text-white">{expiredCount}</span>
                        </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-500 mt-6 mb-2 uppercase tracking-wider">Most Expensive Items</h4>
                    <div className="space-y-3">
                        {topExpensiveItems.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[70%]">{item.name}</span>
                                <span className="font-mono font-medium">${item.averageCost.toFixed(2)}</span>
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
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={providerSpendData} margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                <XAxis type="number" tickFormatter={(val) => `$${val}`} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" name="Total Spend" radius={[0, 4, 4, 0]}>
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

        </div>
    );
};

export default DashboardAnalytics;
