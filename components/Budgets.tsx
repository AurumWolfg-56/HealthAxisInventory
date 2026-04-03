import React, { useState, useMemo, useRef } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { useInventory } from "../contexts/InventoryContext";
import { Budget, Order, User } from "../types";
import { BudgetService } from "../services/BudgetService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

interface BudgetsProps {
  user: User | null;
  t: (key: string) => string;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getStatusInfo = (pct: number) => {
  if (pct >= 100)
    return {
      label: "OVER BUDGET",
      color: "text-red-500",
      bg: "bg-red-500",
      badge:
        "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    };
  if (pct >= 90)
    return {
      label: "CRITICAL",
      color: "text-red-500",
      bg: "bg-red-500",
      badge:
        "bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 border-red-100 dark:border-red-800",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    };
  if (pct >= 75)
    return {
      label: "WARNING",
      color: "text-amber-500",
      bg: "bg-amber-500",
      badge:
        "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    };
  if (pct >= 50)
    return {
      label: "ON TRACK",
      color: "text-medical-500",
      bg: "bg-medical-500",
      badge:
        "bg-medical-50 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400 border-medical-100 dark:border-medical-800",
      glow: "",
    };
  return {
    label: "HEALTHY",
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    badge:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800",
    glow: "",
  };
};

const getLocalDateString = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ──────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────
const Budgets: React.FC<BudgetsProps> = ({ user, t }) => {
  const { budgets, setBudgets } = useAppData();
  const { orders } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "cards" | "chart" | "trends" | "history"
  >("cards");

  const exportRef = useRef<HTMLDivElement>(null);

  // Known clinic vendors — always shown even if no orders exist yet
  const KNOWN_VENDORS = [
    "Amazon",
    "Henry Schein",
    "Labcorp",
    "McKesson",
    "Medline",
  ];

  // Merge known vendors + any from orders (deduped)
  const availableVendors = useMemo(() => {
    const set = new Set<string>(KNOWN_VENDORS);
    orders.forEach((o) => {
      if (o.vendor) set.add(o.vendor);
    });
    // Remove Walmart (one-time, not tracked)
    set.delete("Walmart");
    return [...set].sort();
  }, [orders]);

  // Modal Form State
  const [formData, setFormData] = useState<Partial<Budget>>({
    category: "",
    categories: [],
    amount: 0,
    period: "MONTHLY",
    isRecurring: false,
    notes: "",
    startDate: getLocalDateString(new Date()),
    endDate: getLocalDateString(
      new Date(new Date().setMonth(new Date().getMonth() + 1)),
    ),
  });

  const openModal = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData({
        ...budget,
        // Ensure categories is populated — use category as fallback for old budgets
        categories:
          budget.categories && budget.categories.length > 0
            ? budget.categories
            : budget.category
              ? [budget.category]
              : [],
      });
    } else {
      setEditingBudget(null);
      setFormData({
        category: "",
        categories: [],
        amount: 0,
        period: "MONTHLY",
        isRecurring: false,
        notes: "",
        startDate: getLocalDateString(new Date()),
        endDate: getLocalDateString(
          new Date(new Date().setMonth(new Date().getMonth() + 1)),
        ),
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) return;

    const vendors = formData.categories || [];
    const saveData = {
      ...formData,
      category:
        vendors.length > 0 ? vendors[0] : formData.category || "General",
      categories: vendors,
    };

    setIsSaving(true);
    try {
      if (editingBudget && editingBudget.id) {
        const updated = await BudgetService.updateBudget(
          editingBudget.id,
          saveData,
        );
        if (updated)
          setBudgets((prev) =>
            prev.map((b) => (b.id === updated.id ? updated : b)),
          );
      } else {
        const created = await BudgetService.createBudget(
          saveData as any,
          user.id,
        );
        if (created) setBudgets((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save budget", error);
      alert("Failed to save budget. Check console.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this budget limit?"))
      return;
    try {
      await BudgetService.deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Failed to delete budget", error);
    }
  };

  // Auto-roll recurring budgets
  const handleAutoRoll = async (budget: Budget) => {
    if (!user?.id) return;
    const start = parseLocalDate(budget.endDate);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    if (budget.period === "MONTHLY") end.setMonth(end.getMonth() + 1);
    else if (budget.period === "QUARTERLY") end.setMonth(end.getMonth() + 3);
    else end.setFullYear(end.getFullYear() + 1);

    try {
      const created = await BudgetService.createBudget(
        {
          category: budget.category,
          categories: budget.categories || [],
          amount: budget.amount,
          period: budget.period,
          isRecurring: true,
          notes: budget.notes || "",
          startDate: getLocalDateString(start),
          endDate: getLocalDateString(end),
        },
        user.id,
      );
      if (created) setBudgets((prev) => [created, ...prev]);
    } catch (err) {
      console.error("Auto-roll failed:", err);
    }
  };

  // Toggle vendor selection
  const toggleVendor = (vendor: string) => {
    const current = formData.categories || [];
    if (current.includes(vendor)) {
      setFormData({
        ...formData,
        categories: current.filter((v) => v !== vendor),
      });
    } else {
      setFormData({ ...formData, categories: [...current, vendor] });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Budget Stats — match by VENDOR
  // ──────────────────────────────────────────────────────────────
  const budgetStats = useMemo(() => {
    return budgets.map((budget) => {
      const [sY, sM, sD] = budget.startDate.split("-").map(Number);
      const [eY, eM, eD] = budget.endDate.split("-").map(Number);

      const budgetStart = new Date(sY, sM - 1, sD, 0, 0, 0, 0).getTime();
      const budgetEnd = new Date(eY, eM - 1, eD, 23, 59, 59, 999).getTime();
      const vendors =
        budget.categories && budget.categories.length > 0
          ? budget.categories
          : budget.category
            ? [budget.category]
            : [];

      const matchingOrders: { order: Order; amount: number }[] = [];
      let spent = 0;

      orders.forEach((order) => {
        if (order.status === "CANCELLED") return;
        const orderDate = new Date(order.orderDate).getTime();
        if (orderDate < budgetStart || orderDate > budgetEnd) return;

        // Match by VENDOR name
        if (
          vendors.some((v) => v.toLowerCase() === order.vendor?.toLowerCase())
        ) {
          const total = order.grandTotal || order.subtotal || 0;
          spent += total;
          matchingOrders.push({ order, amount: total });
        }
      });

      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const isExpired = budgetEnd < Date.now();
      const status = getStatusInfo(percentUsed);

      return {
        ...budget,
        spent,
        percentUsed: Math.min(percentUsed, 100),
        truePercentUsed: percentUsed,
        status,
        matchingOrders,
        isExpired,
        vendors,
      };
    });
  }, [budgets, orders]);

  const totalBudgeted = budgetStats.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgetStats.reduce((sum, b) => sum + b.spent, 0);
  const alertCount = budgetStats.filter((b) => b.truePercentUsed >= 75).length;

  // ──────────────────────────────────────────────────────────────
  // Chart Data — Budget vs Actual by vendor
  // ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    // filter chart to only show non-expired budgets to see current active status
    return budgetStats
      .filter((b) => !b.isExpired)
      .map((b) => ({
        name:
          b.vendors.length > 1
            ? `${b.vendors[0]} +${b.vendors.length - 1}`
            : b.vendors[0] || b.category || "N/A",
        Budget: b.amount,
        Spent: b.spent,
        pct: b.truePercentUsed,
      }));
  }, [budgetStats]);

  // ──────────────────────────────────────────────────────────────
  // Grouped History Data — By period string
  // ──────────────────────────────────────────────────────────────
  const groupedHistory = useMemo(() => {
    const history: Record<string, typeof budgetStats> = {};

    const expiredBudgets = budgetStats.filter((b) => b.isExpired);

    expiredBudgets.forEach((b) => {
      const d = parseLocalDate(b.endDate);
      const periodKey = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      if (!history[periodKey]) history[periodKey] = [];
      history[periodKey].push(b);
    });

    const sortedKeys = Object.keys(history).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    return sortedKeys.map((key) => ({
      period: key,
      budgets: history[key].sort((b1, b2) => b2.amount - b1.amount),
    }));
  }, [budgetStats]);

  // ──────────────────────────────────────────────────────────────
  // Trend Data — monthly spending by vendor
  // ──────────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const months: Record<string, Record<string, number>> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      months[key] = {};
    }

    orders.forEach((order) => {
      if (order.status === "CANCELLED" || !order.vendor) return;
      const d = new Date(order.orderDate);
      const key = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      if (!months[key]) return;
      const total = order.grandTotal || order.subtotal || 0;
      months[key][order.vendor] = (months[key][order.vendor] || 0) + total;
    });

    const trackedVendors: string[] = [
      ...new Set<string>(budgetStats.flatMap((b) => b.vendors)),
    ];

    return Object.entries(months).map(([month, vendorMap]) => {
      const point: any = { month };
      let total = 0;
      trackedVendors.forEach((v) => {
        const val = vendorMap[v] || 0;
        point[v] = val;
        total += val;
      });
      point["Total"] = total;
      return point;
    });
  }, [orders, budgetStats]);

  const trendVendors: string[] = [
    ...new Set<string>(budgetStats.flatMap((b) => b.vendors)),
  ];
  const TREND_COLORS = [
    "#10b981",
    "#6366f1",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
  ];

  // ──────────────────────────────────────────────────────────────
  // Export to PDF
  // ──────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    const el = exportRef.current;
    if (!el) return;
    // @ts-ignore
    const html2pdf =
      (
        await import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js")
      ).default || window.html2pdf;
    html2pdf()
      .set({
        margin: 0.5,
        filename: `Budget_Report_${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      })
      .from(el)
      .save();
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-8 animate-fade-in-up pb-24 h-full" ref={exportRef}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-medical-500 to-medical-600 flex items-center justify-center shadow-lg shadow-medical-500/30 text-white">
            <i className="fa-solid fa-wallet text-2xl"></i>
          </div>
          <div>
            <h2 className="text-display text-slate-900 dark:text-white">
              Budget Control
            </h2>
            <p className="text-caption mt-1">
              Track spending limits by vendor.
            </p>
          </div>
          {alertCount > 0 && (
            <div className="ml-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              {alertCount} Alert{alertCount > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-fit overflow-x-auto custom-scrollbar snap-x pb-2 md:pb-0">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            {(
              [
                ["cards", "fa-grip", "Cards"],
                ["chart", "fa-chart-column", "Chart"],
                ["trends", "fa-chart-line", "Trends"],
                ["history", "fa-clock-rotate-left", "History"],
              ] as const
            ).map(([view, icon, label]) => (
              <button
                key={view}
                onClick={() => setActiveView(view as any)}
                className={`flex-shrink-0 snap-start px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeView === view ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <i className={`fa-solid ${icon}`}></i>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleExportPDF}
            className="h-11 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 text-sm"
          >
            <i className="fa-solid fa-file-pdf"></i>
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => openModal()}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-medical-600 to-medical-500 text-white font-semibold shadow-xl shadow-medical-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <i className="fa-solid fa-plus"></i>
            <span>New Budget</span>
          </button>
        </div>
      </header>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="glass-panel p-5 md:p-6 rounded-2xl border border-white/50 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-medical-500/10 dark:bg-medical-500/5 rounded-full blur-3xl group-hover:bg-medical-500/20 transition-colors"></div>
          <div className="flex items-center gap-2.5 mb-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400 text-sm">
              <i className="fa-solid fa-vault"></i>
            </div>
            <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
              Total Allocated
            </h3>
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight relative z-10">
            ${fmt(totalBudgeted)}
          </p>
        </div>

        <div className="glass-panel p-5 md:p-6 rounded-2xl border border-white/50 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-medical-500/10 dark:bg-medical-500/5 rounded-full blur-3xl group-hover:bg-medical-500/20 transition-colors"></div>
          <div className="flex items-center gap-2.5 mb-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400 text-sm">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
              Total Spent
            </h3>
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums text-slate-900 dark:text-white tracking-tight relative z-10">
            ${fmt(totalSpent)}
          </p>
        </div>

        <div className="glass-panel p-5 md:p-6 rounded-2xl border border-white/50 dark:border-slate-800/50 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors"></div>
          <div className="flex items-center gap-2.5 mb-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm">
              <i className="fa-solid fa-piggy-bank"></i>
            </div>
            <h3 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
              Remaining
            </h3>
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold tabular-nums tracking-tight relative z-10 ${totalBudgeted - totalSpent < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            ${fmt(Math.max(0, totalBudgeted - totalSpent))}
          </p>
        </div>
      </div>

      {/* ─── CHART VIEW ─── */}
      {activeView === "chart" && budgetStats.length > 0 && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/50 dark:border-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
            <i className="fa-solid fa-chart-column text-medical-500"></i>
            Budget vs Actual by Vendor
          </h3>
          <div style={{ width: "100%", minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                />
                <Bar
                  dataKey="Budget"
                  fill="#10b981"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={50}
                />
                <Bar dataKey="Spent" radius={[8, 8, 0, 0]} maxBarSize={50}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.pct >= 90
                          ? "#ef4444"
                          : entry.pct >= 75
                            ? "#f59e0b"
                            : "#10b981"
                      }
                    />
                  ))}
                </Bar>
                <Legend wrapperStyle={{ fontWeight: 700, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── TRENDS VIEW ─── */}
      {activeView === "trends" && trendData.length > 0 && (
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-white/50 dark:border-slate-800/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
            <i className="fa-solid fa-chart-line text-medical-500"></i>
            6-Month Vendor Spending Trends
          </h3>
          <div style={{ width: "100%", minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={(v) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 16,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => [`$${fmt(value)}`, undefined]}
                />
                {trendVendors.map((v, i) => (
                  <Line
                    key={v}
                    type="monotone"
                    dataKey={v}
                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Legend wrapperStyle={{ fontWeight: 700, fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── HISTORY VIEW ─── */}
      {activeView === "history" && (
        <div className="space-y-8 animate-fade-in-up">
          <div className="flex items-center gap-3 px-2">
            <i className="fa-solid fa-clock-rotate-left text-xl text-slate-400"></i>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
              Comparative Historical Budgets
            </h3>
          </div>

          {groupedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-4xl mb-6 shadow-inner">
                <i className="fa-solid fa-box-archive"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                No Past Budgets Yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                When your budgets expire, their performance comparisons will be
                permanently saved and displayed here.
              </p>
            </div>
          ) : (
            groupedHistory.map((group) => {
              const totalLimit = group.budgets.reduce(
                (sum, b) => sum + b.amount,
                0,
              );
              const totalSpent = group.budgets.reduce(
                (sum, b) => sum + b.spent,
                0,
              );
              const savings = totalLimit - totalSpent;
              const isOverage = savings < 0;

              return (
                <div
                  key={group.period}
                  className="glass-panel overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white">
                        {group.period}
                      </h4>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        {group.budgets.length} expired constraint
                        {group.budgets.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          Planned vs Spent
                        </p>
                        <p className="font-bold font-mono text-slate-800 dark:text-white">
                          ${fmt(totalLimit)}{" "}
                          <span className="text-slate-400">/</span> $
                          {fmt(totalSpent)}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          {isOverage ? "Overage" : "Savings"}
                        </p>
                        <p
                          className={`font-bold font-mono text-lg ${isOverage ? "text-red-500" : "text-emerald-500"}`}
                        >
                          {isOverage ? "-" : "+"}${fmt(Math.abs(savings))}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead>
                        <tr className="bg-white/50 dark:bg-slate-900/50">
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Vendor / Detail
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                            Limit
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                            Actual Spent
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                            Variance
                          </th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                        {group.budgets.map((b) => {
                          const varSaved = b.amount - b.spent;
                          const varOverage = varSaved < 0;

                          return (
                            <tr
                              key={b.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group/row"
                            >
                              <td className="p-4 max-w-[200px] truncate">
                                <div
                                  className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate"
                                  title={b.vendors.join(", ")}
                                >
                                  {b.vendors.join(", ") || b.category}
                                </div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                                  {b.period} · {b.matchingOrders.length} orders
                                </div>
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-slate-500 dark:text-slate-400 border-l border-slate-100 dark:border-slate-800">
                                ${fmt(b.amount)}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-slate-800 dark:text-white bg-slate-50/50 dark:bg-transparent">
                                ${fmt(b.spent)}
                              </td>
                              <td
                                className={`p-4 text-center font-mono font-bold ${varOverage ? "text-red-500 bg-red-50/30 dark:bg-red-500/5" : "text-emerald-500"}`}
                              >
                                {varOverage ? "" : "+"}${fmt(varSaved)}
                              </td>
                              <td className="p-4 text-center">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${b.status.badge}`}
                                >
                                  {b.status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── BUDGET CARDS ─── */}
      {activeView === "cards" && (
        <>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-6 mb-4 px-2 flex items-center gap-3">
            Vendor Budgets
            <span className="text-sm font-bold text-slate-400">
              ({budgetStats.length})
            </span>
          </h3>

          {budgetStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-4xl mb-6 shadow-inner">
                <i className="fa-solid fa-truck-field"></i>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                No Vendor Budgets
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
                Set spending limits for your vendors (Amazon, McKesson, etc.)
                and track orders against them automatically.
              </p>
              <button
                onClick={() => openModal()}
                className="px-8 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform"
              >
                Create First Budget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {budgetStats.map((budget) => {
                const isExpanded = expandedBudget === budget.id;
                return (
                  <div
                    key={budget.id}
                    className={`glass-panel rounded-2xl border border-white/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col group transition-all duration-300 ${budget.status.glow}`}
                  >
                    <div className="p-6 md:p-8">
                      {/* Header */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {budget.vendors.map((v) => (
                              <span
                                key={v}
                                className="px-3 py-1 bg-medical-50 dark:bg-medical-500/10 text-medical-600 dark:text-medical-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-medical-100 dark:border-medical-500/20 flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-truck text-[8px]"></i>
                                {v}
                              </span>
                            ))}
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                              {budget.period}
                            </span>
                            {budget.isRecurring && (
                              <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-purple-100 dark:border-purple-800 flex items-center gap-1">
                                <i className="fa-solid fa-rotate text-[8px]"></i>{" "}
                                Auto
                              </span>
                            )}
                            {budget.isExpired && (
                              <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-300 dark:border-slate-600 text-[10px] uppercase font-bold tracking-widest">
                                EXPIRED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <h4 className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                              {parseLocalDate(
                                budget.startDate,
                              ).toLocaleDateString()}{" "}
                              —{" "}
                              {parseLocalDate(
                                budget.endDate,
                              ).toLocaleDateString()}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center justify-between w-full md:w-auto gap-2">
                          <span
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${budget.status.badge}`}
                          >
                            {budget.truePercentUsed >= 75 && (
                              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                            )}
                            {budget.status.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openModal(budget)}
                              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-medical-600 dark:hover:text-medical-400 hover:bg-medical-50 dark:hover:bg-medical-900/30 flex items-center justify-center transition-all text-sm"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(budget.id)}
                              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-all text-sm"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">
                            Spent
                          </p>
                          <p
                            className={`text-2xl font-bold tabular-nums leading-none ${budget.truePercentUsed >= 100 ? "text-red-500" : "text-slate-900 dark:text-white"}`}
                          >
                            ${fmt(budget.spent)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">
                            Limit
                          </p>
                          <p className="text-xl font-bold text-slate-500 dark:text-slate-400 leading-none">
                            / ${fmt(budget.amount)}
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000 ease-out ${budget.status.bg} ${budget.status.glow}`}
                          style={{ width: `${budget.percentUsed}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-2.5 text-xs font-bold font-mono">
                        <span
                          className={
                            budget.truePercentUsed >= 100
                              ? "text-red-500 animate-pulse"
                              : "text-slate-500 dark:text-slate-400"
                          }
                        >
                          {budget.truePercentUsed.toFixed(1)}% Used
                        </span>
                        <span className="text-slate-400">
                          ${fmt(Math.max(0, budget.amount - budget.spent))}{" "}
                          Remaining
                        </span>
                      </div>

                      {budget.notes && (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic px-1">
                          {budget.notes}
                        </p>
                      )}

                      {/* Auto-roll for expired recurring */}
                      {budget.isExpired && budget.isRecurring && (
                        <button
                          onClick={() => handleAutoRoll(budget)}
                          className="mt-4 w-full py-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all flex items-center justify-center gap-2 border border-purple-100 dark:border-purple-800"
                        >
                          <i className="fa-solid fa-rotate"></i> Roll to Next
                          Period
                        </button>
                      )}

                      {/* Breakdown toggle */}
                      {budget.matchingOrders.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedBudget(isExpanded ? null : budget.id)
                          }
                          className="mt-4 w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                        >
                          <i
                            className={`fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`}
                          ></i>
                          {isExpanded ? "Hide" : "View"} Orders (
                          {budget.matchingOrders.length})
                        </button>
                      )}
                    </div>

                    {/* Expanded Order Breakdown */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800 p-4 md:px-8 md:pb-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl space-y-2 animate-fade-in-up">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 px-1">
                          Order Breakdown
                        </p>
                        {budget.matchingOrders
                          .sort(
                            (a, b) =>
                              new Date(b.order.orderDate).getTime() -
                              new Date(a.order.orderDate).getTime(),
                          )
                          .map(({ order, amount }) => (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-medical-50 dark:bg-medical-900/20 flex items-center justify-center text-medical-500 text-xs flex-shrink-0">
                                  <i className="fa-solid fa-receipt"></i>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                    {order.poNumber || "No PO#"}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {new Date(
                                      order.orderDate,
                                    ).toLocaleDateString()}{" "}
                                    · {order.items.length} item
                                    {order.items.length > 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white ml-3 flex-shrink-0">
                                ${fmt(amount)}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL                                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !isSaving && setIsModalOpen(false)}
          ></div>
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[95vh] rounded-2xl shadow-2xl relative z-10 flex flex-col overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-800">
            <div className="shrink-0 p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-medical-100 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400 flex items-center justify-center text-xl">
                  <i
                    className={`fa-solid ${editingBudget ? "fa-pen" : "fa-wallet"}`}
                  ></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingBudget ? "Edit Budget" : "New Vendor Budget"}
                </h3>
              </div>
              <button
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto custom-scrollbar"
            >
              <div className="p-6 md:p-8 space-y-6">
                {/* Vendor Select */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
                    <i className="fa-solid fa-truck text-medical-400"></i>{" "}
                    Vendors
                    <span className="text-slate-300 dark:text-slate-600 font-normal normal-case tracking-normal">
                      (select one or more)
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto custom-scrollbar">
                    {availableVendors.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        No vendors found. Create purchase orders first.
                      </p>
                    ) : (
                      availableVendors.map((vendor) => {
                        const isSelected = (formData.categories || []).includes(
                          vendor,
                        );
                        return (
                          <button
                            key={vendor}
                            type="button"
                            onClick={() => toggleVendor(vendor)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isSelected
                                ? "bg-medical-500 text-white shadow-md shadow-medical-500/30"
                                : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-medical-300 dark:hover:border-medical-600"
                            }`}
                          >
                            {isSelected && (
                              <i className="fa-solid fa-check mr-1 text-[10px]"></i>
                            )}
                            {vendor}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {/* Custom vendor input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Or type a new vendor name..."
                      className="flex-1 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-medical-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = (
                            e.target as HTMLInputElement
                          ).value.trim();
                          if (
                            val &&
                            !(formData.categories || []).includes(val)
                          ) {
                            setFormData({
                              ...formData,
                              categories: [...(formData.categories || []), val],
                            });
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                  </div>
                  {(formData.categories || []).length === 0 && (
                    <p className="text-[10px] text-amber-500 font-bold ml-1">
                      Select at least one vendor
                    </p>
                  )}
                </div>

                {/* Amount + Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                      Spending Limit ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400 font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        required
                        min="1"
                        step="0.01"
                        value={formData.amount || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            amount:
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full h-11 pl-9 pr-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-medical-500 focus:ring-4 focus:ring-medical-500/10"
                        placeholder="Enter limit"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                      Period
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.period}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            period: e.target.value as any,
                          })
                        }
                        className="w-full h-11 px-5 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-medical-500 focus:ring-4 focus:ring-medical-500/10 cursor-pointer"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-slate-400 pointer-events-none text-xs"></i>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="w-full h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-medical-500 focus:ring-4 focus:ring-medical-500/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      className="w-full h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none focus:border-medical-500 focus:ring-4 focus:ring-medical-500/10"
                    />
                  </div>
                </div>

                {/* Auto-Renew */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <i className="fa-solid fa-rotate"></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        Auto-Renew
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Create next period when this expires
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        isRecurring: !formData.isRecurring,
                      })
                    }
                    className={`w-14 h-8 rounded-full transition-all duration-300 relative ${formData.isRecurring ? "bg-purple-500" : "bg-slate-200 dark:bg-slate-700"}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-all duration-300 ${formData.isRecurring ? "left-7" : "left-1"}`}
                    ></div>
                  </button>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={2}
                    placeholder="Add any notes..."
                    className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-none focus:border-medical-500 focus:ring-4 focus:ring-medical-500/10 resize-none text-sm"
                  />
                </div>
              </div>

              <div className="p-6 md:px-8 md:pb-8">
                <button
                  type="submit"
                  disabled={
                    isSaving || (formData.categories || []).length === 0
                  }
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-medical-600 to-medical-500 text-white font-semibold text-sm shadow-xl shadow-medical-500/30 hover:shadow-medical-500/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-3"
                >
                  {isSaving ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-check"></i>
                  )}
                  {isSaving ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;
