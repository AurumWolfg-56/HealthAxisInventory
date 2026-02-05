
import React, { useMemo } from 'react';
import { Order, InventoryItem } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

interface OrdersAnalyticsProps {
    orders: Order[];
    inventory: InventoryItem[];
    t: (key: string) => string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const OrdersAnalytics: React.FC<OrdersAnalyticsProps> = ({ orders, inventory, t }) => {

    // --- Metrics Calculations ---
    const metrics = useMemo(() => {
        const totalOrders = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + o.grandTotal, 0);
        const averageOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;

        // Group by Vendor
        const vendorSpend: Record<string, number> = {};
        orders.forEach(order => {
            vendorSpend[order.vendor] = (vendorSpend[order.vendor] || 0) + order.grandTotal;
        });
        const vendorData = Object.entries(vendorSpend)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10

        // Group by Category (requires mapping items)
        const categorySpend: Record<string, number> = {};
        let totalItemsOrdered = 0;

        orders.forEach(order => {
            order.items.forEach(item => {
                totalItemsOrdered += item.quantity;
                let category = 'Uncategorized';
                if (item.inventoryItemId) {
                    const invItem = inventory.find(i => i.id === item.inventoryItemId);
                    if (invItem) category = invItem.category;
                }
                categorySpend[category] = (categorySpend[category] || 0) + item.total;
            });
        });
        const categoryData = Object.entries(categorySpend)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Monthly Trend
        const monthlySpend: Record<string, number> = {};
        orders.forEach(order => {
            const date = new Date(order.orderDate);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlySpend[key] = (monthlySpend[key] || 0) + order.grandTotal;
        });
        const trendData = Object.entries(monthlySpend)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalOrders,
            totalSpend,
            averageOrderValue,
            totalItemsOrdered,
            vendorData,
            categoryData,
            trendData
        };
    }, [orders, inventory]);

    // --- PDF Generation ---
    const generatePDF = async () => {
        // Dynamic import of html2pdf from CDN
        if (!(window as any).html2pdf) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => generatePDF(); // Retry after load
            document.head.appendChild(script);
            return;
        }

        const element = document.getElementById('professional-report');
        const opt = {
            margin: [10, 10, 10, 10], // top, left, bottom, right
            filename: `HealthAxis_Orders_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Temporarily show the report to capture it
        if (element) {
            element.style.display = 'block';
            await (window as any).html2pdf().set(opt).from(element).save();
            element.style.display = 'none'; // Hide again
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Controls */}
            <div className="flex justify-end">
                <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-medical-600 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-105 transition-all"
                >
                    <i className="fa-solid fa-file-pdf"></i>
                    Export Professional Report
                </button>
            </div>

            {/* Main Interactive Dashboard (Screen Only) */}
            <div id="analytics-dashboard" className="space-y-8 bg-slate-50 dark:bg-[#0a0f18] p-4 md:p-8 rounded-[2.5rem]">

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Spend */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <i className="fa-solid fa-sack-dollar text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Spend</h3>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            ${metrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Total Orders */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <i className="fa-solid fa-file-invoice text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Orders</h3>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {metrics.totalOrders}
                        </div>
                    </div>

                    {/* Avg Order Value */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <i className="fa-solid fa-scale-balanced text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Avg. Order Value</h3>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            ${metrics.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Items Logged */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <i className="fa-solid fa-boxes-packing text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Items Received</h3>
                        </div>
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {metrics.totalItemsOrdered}
                        </div>
                    </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Vendor Spend Chart */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Spend by Vendor</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                                <BarChart data={metrics.vendorData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20}>
                                        {metrics.vendorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Monthly Trend Chart (Moved Up) */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">Spending Trend (Monthly)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={300}>
                                <AreaChart data={metrics.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spend']} />
                                    <Area type="monotone" dataKey="value" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- HIDDEN PROFESSIONAL REPORT TEMPLATE --- */}
            <div id="professional-report" className="hidden bg-white text-black p-10 max-w-[210mm] mx-auto">
                {/* 1. Header Header */}
                <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-serif font-black tracking-tight text-gray-900">Orders Analytics Report</h1>
                        <p className="text-sm text-gray-500 mt-1 uppercase tracking-widest font-bold">HealthAxis Inventory Management</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase font-bold">Date Generated</div>
                        <div className="text-lg font-bold">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </div>

                {/* 2. Executive Summary Metrics */}
                <div className="mb-10">
                    <h2 className="text-sm font-bold uppercase text-gray-400 border-b border-gray-200 pb-2 mb-4">Executive Summary</h2>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total Spend</div>
                            <div className="text-2xl font-black text-gray-900">${metrics.totalSpend.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total Orders</div>
                            <div className="text-2xl font-black text-gray-900">{metrics.totalOrders}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Avg Order Value</div>
                            <div className="text-2xl font-black text-gray-900">${metrics.averageOrderValue.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Items Received</div>
                            <div className="text-2xl font-black text-gray-900">{metrics.totalItemsOrdered}</div>
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Breakdown Tables */}
                <div className="grid grid-cols-2 gap-12 mb-10">
                    {/* Top Vendors Table */}
                    <div>
                        <h2 className="text-sm font-bold uppercase text-gray-400 border-b border-gray-200 pb-2 mb-4">Top Vendors by Spend</h2>
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="py-2 font-black text-gray-900">Vendor</th>
                                    <th className="py-2 font-black text-gray-900 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.vendorData.map((v, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-700">{v.name}</td>
                                        <td className="py-2 text-gray-900 font-bold text-right">${v.value.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Monthly Trend Table */}
                    <div>
                        <h2 className="text-sm font-bold uppercase text-gray-400 border-b border-gray-200 pb-2 mb-4">Monthly Spending History</h2>
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="py-2 font-black text-gray-900">Month</th>
                                    <th className="py-2 font-black text-gray-900 text-right">Total Spend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.trendData.slice(0, 12).map((t, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-700">{t.date}</td>
                                        <td className="py-2 text-gray-900 font-bold text-right">${t.value.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Recent Orders Snapshot */}
                <div className="mb-8">
                    <h2 className="text-sm font-bold uppercase text-gray-400 border-b border-gray-200 pb-2 mb-4">Recent High-Value Orders</h2>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 font-black text-gray-900 rounded-l-lg">Date</th>
                                <th className="p-3 font-black text-gray-900">PO Number</th>
                                <th className="p-3 font-black text-gray-900">Vendor</th>
                                <th className="p-3 font-black text-gray-900">Status</th>
                                <th className="p-3 font-black text-gray-900 text-right rounded-r-lg">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.sort((a, b) => b.grandTotal - a.grandTotal).slice(0, 5).map((order) => (
                                <tr key={order.id} className="border-b border-gray-100">
                                    <td className="p-3 text-gray-600">{order.orderDate}</td>
                                    <td className="p-3 font-mono text-gray-900 font-bold">{order.poNumber}</td>
                                    <td className="p-3 text-gray-900">{order.vendor}</td>
                                    <td className="p-3"><span className="px-2 py-1 rounded bg-gray-200 text-xs font-bold text-gray-700">{order.status}</span></td>
                                    <td className="p-3 text-gray-900 font-black text-right">${order.grandTotal.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-400 pt-8 border-t border-gray-100 mt-auto">
                    <p>Confidential Property of HealthAxis. Generated via HealthAxis Inventory PWA.</p>
                </div>
            </div>
        </div>
    );
};

export default OrdersAnalytics;
