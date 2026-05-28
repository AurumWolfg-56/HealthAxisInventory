
import React, { useMemo } from 'react';
import { Order, InventoryItem } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrdersAnalyticsProps {
    orders: Order[];
    inventory: InventoryItem[];
    t: (key: string) => string;
    startDate?: string;
    endDate?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const OrdersAnalytics: React.FC<OrdersAnalyticsProps> = ({ orders, inventory, t, startDate, endDate }) => {

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

        // Date Range
        let dateRange = 'All Time';
        if (startDate || endDate) {
            // Split the date string manually to avoid timezone issues when converting 'YYYY-MM-DD'
            const formatSelectedDate = (dateStr: string) => {
                const [year, month, day] = dateStr.split('-');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            };
            const startStr = startDate ? formatSelectedDate(startDate) : 'Beginning';
            const endStr = endDate ? formatSelectedDate(endDate) : 'Present';
            dateRange = `${startStr} - ${endStr}`;
        } else if (orders.length > 0) {
            const sortedDates = [...orders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
            const firstDate = new Date(sortedDates[0].orderDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const lastDate = new Date(sortedDates[sortedDates.length - 1].orderDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            dateRange = `${firstDate} - ${lastDate}`;
        }

        return {
            totalOrders,
            totalSpend,
            averageOrderValue,
            totalItemsOrdered,
            vendorData,
            categoryData,
            trendData,
            dateRange
        };
    }, [orders, inventory, startDate, endDate]);

    // --- PDF Generation ---
    const generatePDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Brand Colors
        const primaryColor: [number, number, number] = [15, 118, 110]; // Teal 700
        const secondaryColor: [number, number, number] = [100, 116, 139]; // Slate 500

        // 1. Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42); // Slate 900
        doc.text('Orders Analytics Report', 14, 22);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('IMMEDIATE CARE PLUS', 14, 30);

        // Date Info (Top Right)
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...secondaryColor);
        const dateStr = `DATE GENERATED: ${new Date().toLocaleDateString()}`;
        const periodStr = `PERIOD: ${metrics.dateRange}`;
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.text(dateStr, pageWidth - 14, 22, { align: 'right' });
        doc.text(periodStr, pageWidth - 14, 28, { align: 'right' });

        // Line separator
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.5);
        doc.line(14, 35, pageWidth - 14, 35);

        // 2. Executive Summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text('EXECUTIVE SUMMARY', 14, 45);

        // Metrics Row
        const yMetrics = 55;
        doc.setFontSize(9);
        doc.text('Total Spend', 14, yMetrics);
        doc.text('Total Orders', 64, yMetrics);
        doc.text('Avg Order Value', 114, yMetrics);
        doc.text('Items Received', 164, yMetrics);

        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`$${metrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, yMetrics + 7);
        doc.text(`${metrics.totalOrders}`, 64, yMetrics + 7);
        doc.text(`$${metrics.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 114, yMetrics + 7);
        doc.text(`${metrics.totalItemsOrdered}`, 164, yMetrics + 7);

        // 3. Top Vendors Table
        let currentY = yMetrics + 20;

        autoTable(doc, {
            startY: currentY,
            head: [['Vendor', 'Total Spend']],
            body: metrics.vendorData.map(v => [v.name, `$${v.value.toLocaleString()}`]),
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: pageWidth / 2 + 5 },
            styles: { fontSize: 9 }
        });
        const finalYTable1 = (doc as any).lastAutoTable.finalY;

        // 4. Monthly Trend Table
        autoTable(doc, {
            startY: currentY,
            head: [['Month', 'Total Spend']],
            body: metrics.trendData.slice(0, 12).map(t => [t.date, `$${t.value.toLocaleString()}`]),
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: pageWidth / 2 + 5, right: 14 },
            styles: { fontSize: 9 }
        });
        const finalYTable2 = (doc as any).lastAutoTable.finalY;

        // Advance Y below both tables
        currentY = Math.max(finalYTable1, finalYTable2) + 15;

        // 5. Recent High-Value Orders
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...secondaryColor);
        doc.text('RECENT HIGH-VALUE ORDERS', 14, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Date', 'PO Number', 'Vendor', 'Status', 'Amount']],
            body: orders.sort((a, b) => b.grandTotal - a.grandTotal).slice(0, 10).map(order => [
                order.orderDate,
                order.poNumber,
                order.vendor,
                order.status.toUpperCase(),
                `$${order.grandTotal.toLocaleString()}`
            ]),
            headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            styles: { fontSize: 9 }
        });

        // Footer
        const pageCount = (doc.internal as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(
                `Confidential Property of Immediate Care Plus - Page ${i} of ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        doc.save(`ImmediateCarePlus_Orders_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Controls */}
            <div className="flex justify-end">
                <button
                    onClick={generatePDF}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-medical-600 to-medical-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-medical-500/30 hover:shadow-xl hover:scale-105 transition-all"
                >
                    <i className="fa-solid fa-file-pdf"></i>
                    Export Professional Report
                </button>
            </div>

            {/* Main Interactive Dashboard (Screen Only) */}
            <div id="analytics-dashboard" className="space-y-8 bg-slate-50 dark:bg-[#0c1511] p-4 md:p-8 rounded-2xl">

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Spend */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <i className="fa-solid fa-sack-dollar text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Spend</h3>
                        </div>
                        <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                            ${metrics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Total Orders */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <i className="fa-solid fa-file-invoice text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Orders</h3>
                        </div>
                        <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                            {metrics.totalOrders}
                        </div>
                    </div>

                    {/* Avg Order Value */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                <i className="fa-solid fa-scale-balanced text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Avg. Order Value</h3>
                        </div>
                        <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                            ${metrics.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>

                    {/* Items Logged */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <i className="fa-solid fa-boxes-packing text-xl"></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Items Received</h3>
                        </div>
                        <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                            {metrics.totalItemsOrdered}
                        </div>
                    </div>
                </div>

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Vendor Spend Chart */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Spend by Vendor</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={300}>
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
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Spending Trend (Monthly)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={300}>
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
        </div>
    );
};

export default OrdersAnalytics;
