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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasLoaded = React.useRef(false);

  const loadBriefing = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      // Race the actual briefing against a 15-second timeout (accommodates local AI cold start)
      const TIMEOUT_MS = 15000;
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
        summary: `📊 Your clinic has ${inventory.length} items. ${lowStockCount > 0 ? `⚠️ ${lowStockCount} items are low on stock!` : '✅ All stock levels healthy.'} ${expiringCount > 0 ? `⏰ ${expiringCount} items expiring soon.` : ''}`,
        generatedAt: new Date().toISOString(),
        dataPoints: {
          expiringItems: expiringCount,
          lowStockItems: lowStockCount,
          totalRevenue7d: 0,
          pendingOrders: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [inventory, dailyReports, orders, pettyCash]);

  // Trigger briefing when inventory data becomes available
  useEffect(() => {
    if (inventory.length > 0 && !hasLoaded.current) {
      hasLoaded.current = true;
      loadBriefing();
    }
  }, [inventory.length]);

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
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
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
            <div className="animate-fade-in mt-2">
              {/* Insight Cards */}
              <div className="space-y-3">
                {briefing.summary.split('\n').filter(line => line.trim()).map((line, i) => {
                  // Extract emoji if present to style it distinctly
                  const match = line.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200d)+/gu);
                  const emoji = match ? match[0] : '';
                  const content = emoji ? line.replace(emoji, '').trim().replace(/^[-•*]\s*/, '') : line.replace(/^[-•*]\s*/, '');
                  
                  return (
                    <div key={i} className="flex gap-3 p-3.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/40 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow group">
                      {emoji && (
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm text-lg group-hover:scale-110 transition-transform">
                          {emoji}
                        </div>
                      )}
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium mt-0.5">
                        {content}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Quick Stats Pills */}
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/40">
                {briefing.dataPoints.lowStockItems > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200/50 dark:border-amber-500/20">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    {briefing.dataPoints.lowStockItems} Low Stock
                  </div>
                )}
                
                {briefing.dataPoints.expiringItems > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100/50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold border border-red-200/50 dark:border-red-500/20">
                    <i className="fa-solid fa-clock"></i>
                    {briefing.dataPoints.expiringItems} Expiring
                  </div>
                )}

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200/50 dark:border-emerald-500/20">
                  <i className="fa-solid fa-sack-dollar"></i>
                  ${briefing.dataPoints.totalRevenue7d.toLocaleString(undefined, { maximumFractionDigits: 0 })} Weekly
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold border border-blue-200/50 dark:border-blue-500/20">
                  <i className="fa-solid fa-box-open"></i>
                  {briefing.dataPoints.pendingOrders} Pending Orders
                </div>
              </div>
            </div>
          )}
        </div>

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
