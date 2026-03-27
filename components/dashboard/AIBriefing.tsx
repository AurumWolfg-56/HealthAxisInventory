import React, { useState, useEffect, useCallback } from 'react';
import { generateBriefing, clearBriefingCache, AIBriefing as AIBriefingType } from '../../services/AIBriefingService';
import { InventoryItem, Order, PettyCashTransaction } from '../../types';
import { DailyReport } from '../../types/dailyReport';

interface AIBriefingProps {
  inventory: InventoryItem[];
  dailyReports: DailyReport[];
  orders: Order[];
  pettyCash: PettyCashTransaction[];
}

const AIBriefingCard: React.FC<AIBriefingProps> = ({
  inventory,
  dailyReports,
  orders,
  pettyCash,
}) => {
  const [briefing, setBriefing] = useState<AIBriefingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const loadBriefing = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      // Race the actual briefing against a 6-second timeout
      const TIMEOUT_MS = 6000;
      const result = await Promise.race([
        generateBriefing(inventory, dailyReports, orders, pettyCash, forceRefresh),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI Gateway timeout — running without AI')), TIMEOUT_MS)
        ),
      ]);
      setBriefing(result);
    } catch (err: any) {
      console.warn('[AIBriefing] ⏭️ Fallback:', err.message);
      // Show data-only briefing instead of an error
      const lowStockCount = inventory.filter(i => i.stock <= i.minStock).length;
      const expiringCount = inventory.filter(i => {
        if (!i.expiryDate) return false;
        const days = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / (1000*60*60*24));
        return days >= 0 && days <= 14;
      }).length;
      setBriefing({
        summary: `📊 Your clinic has ${inventory.length} items tracked. ${lowStockCount > 0 ? `⚠️ ${lowStockCount} items are low on stock.` : '✅ All stock levels are healthy.'} ${expiringCount > 0 ? `⚠️ ${expiringCount} items expiring within 14 days.` : ''}`,
        generatedAt: new Date().toISOString(),
        dataPoints: {
          expiringItems: expiringCount,
          lowStockItems: lowStockCount,
          todayRevenue: 0,
          recentOrders: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [inventory, dailyReports, orders, pettyCash]);

  useEffect(() => {
    if (inventory.length > 0) {
      loadBriefing();
    }
  }, []);  // Only on mount

  const handleRefresh = () => {
    clearBriefingCache();
    loadBriefing(true);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-[#0a1f17] dark:via-[#0c1a14] dark:to-[#0a1f17] shadow-lg">
      {/* Decorative gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <i className="fa-solid fa-brain text-white text-lg" />
            </div>
            {loading && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">
              AI Manager Briefing
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {loading ? 'Analyzing clinic data...' : briefing ? `Updated ${formatTime(briefing.generatedAt)}` : 'Ready'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all disabled:opacity-40"
            title="Refresh briefing"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all"
          >
            <i className={`fa-solid fa-chevron-${isCollapsed ? 'down' : 'up'} text-xs`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="px-5 pb-4">
          {/* Loading State */}
          {loading && !briefing && (
            <div className="flex items-center gap-3 py-6">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="h-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full animate-pulse w-3/4" />
                <div className="h-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full animate-pulse w-1/2" />
                <div className="h-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !briefing && (
            <div className="flex items-start gap-3 py-3 px-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
              <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">AI Unavailable</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {error.includes('localhost') ? 'LM Studio server is not running. Start it to enable AI briefings.' : error}
                </p>
              </div>
            </div>
          )}

          {/* Briefing Content */}
          {briefing && (
            <>
              {/* Summary — render each line as a bullet */}
              <div className="space-y-2 mt-1">
                {briefing.summary.split('\n').filter(line => line.trim()).map((line, i) => (
                  <p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {line.replace(/^[-•*]\s*/, '')}
                  </p>
                ))}
              </div>

              {/* Quick Stats Bar */}
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/40">
                <div className="text-center">
                  <div className={`text-lg font-bold ${briefing.dataPoints.lowStockItems > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {briefing.dataPoints.lowStockItems}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Low Stock</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${briefing.dataPoints.expiringItems > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {briefing.dataPoints.expiringItems}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expiring</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    ${briefing.dataPoints.todayRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-500">
                    {briefing.dataPoints.recentOrders}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Orders</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Powered by local AI badge */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border-t border-emerald-100/50 dark:border-emerald-900/20">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/50 uppercase tracking-wider">
          Powered by Local AI • 100% Private
        </span>
      </div>
    </div>
  );
};

export default AIBriefingCard;
