/**
 * AI Briefing Service
 * Gathers clinic data and generates an executive summary via local LLM.
 * Caches briefings for 4 hours to avoid redundant AI calls.
 */

import { chat } from './LocalAIService';
import { InventoryItem, Order, PettyCashTransaction } from '../types';
import { DailyReport } from '../types/dailyReport';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AIBriefing {
  summary: string;
  generatedAt: string;
  dataPoints: {
    expiringItems: number;
    lowStockItems: number;
    todayRevenue: number;
    recentOrders: number;
  };
}

// ─── Cache ──────────────────────────────────────────────────────────────────
const CACHE_KEY = 'norvexis_ai_briefing';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCachedBriefing(): AIBriefing | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const briefing = JSON.parse(cached) as AIBriefing;
    const age = Date.now() - new Date(briefing.generatedAt).getTime();
    if (age > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return briefing;
  } catch {
    return null;
  }
}

function cacheBriefing(briefing: AIBriefing): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(briefing));
  } catch {
    // localStorage full, skip caching
  }
}

// ─── Data Snapshot Builder ──────────────────────────────────────────────────

function buildDataSnapshot(
  inventory: InventoryItem[],
  dailyReports: DailyReport[],
  orders: Order[],
  pettyCash: PettyCashTransaction[]
): { prompt: string; dataPoints: AIBriefing['dataPoints'] } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  // ── Inventory alerts
  const lowStock = inventory.filter(i => i.stock <= i.minStock);
  const expiringItems = inventory.filter(i => {
    if (!i.expiryDate) return false;
    const expiry = new Date(i.expiryDate);
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 14;
  });
  const expiredItems = inventory.filter(i => {
    if (!i.expiryDate) return false;
    return new Date(i.expiryDate) < now;
  });

  // ── Revenue trends (last 7 daily reports)
  const recentReports = [...dailyReports]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 7);

  const todayReport = recentReports.find(r => r.timestamp.startsWith(today));
  const todayRevenue = todayReport?.totals?.revenue || 0;
  const todayPatients = todayReport?.totals?.patients || 0;

  const avgRevenue = recentReports.length > 0
    ? recentReports.reduce((sum, r) => sum + (r.totals?.revenue || 0), 0) / recentReports.length
    : 0;

  // ── Recent orders (last 7 days)
  const recentOrders = orders.filter(o => {
    const oDate = new Date(o.orderDate || '');
    return (now.getTime() - oDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });

  // ── Petty cash (last 7 days)
  const recentPettyCash = pettyCash.filter(t => {
    const txDate = new Date(t.timestamp || '');
    return (now.getTime() - txDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  const pettyCashTotal = recentPettyCash.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  // Build concise data snapshot for the LLM
  const prompt = `Today is ${dayOfWeek}, ${today}.

CLINIC DATA SNAPSHOT:

INVENTORY (${inventory.length} items total):
- ${lowStock.length} items at LOW STOCK: ${lowStock.slice(0, 5).map(i => `${i.name} (${i.stock}/${i.minStock})`).join(', ')}${lowStock.length > 5 ? ` ...and ${lowStock.length - 5} more` : ''}
- ${expiringItems.length} items expiring within 14 days: ${expiringItems.slice(0, 5).map(i => `${i.name} (exp: ${i.expiryDate})`).join(', ')}
- ${expiredItems.length} items already EXPIRED
${expiredItems.length > 0 ? `  EXPIRED: ${expiredItems.slice(0, 3).map(i => `${i.name} (${i.expiryDate})`).join(', ')}` : ''}

REVENUE (last 7 reports):
- Today: $${todayRevenue.toFixed(2)} revenue, ${todayPatients} patients
- 7-day average: $${avgRevenue.toFixed(2)}/day
- Trend: ${recentReports.slice(0, 3).map(r => `$${(r.totals?.revenue || 0).toFixed(0)}`).join(' → ')}

ORDERS:
- ${recentOrders.length} orders in last 7 days
- Pending: ${recentOrders.filter(o => o.status === 'PENDING').length}

PETTY CASH (last 7 days):
- ${recentPettyCash.length} transactions totaling $${pettyCashTotal.toFixed(2)}`;

  return {
    prompt,
    dataPoints: {
      expiringItems: expiringItems.length,
      lowStockItems: lowStock.length,
      todayRevenue,
      recentOrders: recentOrders.length,
    }
  };
}

// ─── Generate Briefing ─────────────────────────────────────────────────────

export async function generateBriefing(
  inventory: InventoryItem[],
  dailyReports: DailyReport[],
  orders: Order[],
  pettyCash: PettyCashTransaction[],
  forceRefresh = false
): Promise<AIBriefing> {
  // Check cache first
  if (!forceRefresh) {
    const cached = getCachedBriefing();
    if (cached) {
      console.log('[AIBriefing] Using cached briefing');
      return cached;
    }
  }

  console.log('[AIBriefing] Generating new briefing...');

  const { prompt, dataPoints } = buildDataSnapshot(inventory, dailyReports, orders, pettyCash);

  const systemPrompt = `You are the AI clinic manager assistant for Norvexis, an urgent care / primary care clinic management system.

Generate a concise executive briefing (3-5 bullet points) based on the clinic data. Be actionable and direct.

Rules:
- Start each point with an emoji icon (⚠️ for alerts, 📊 for stats, ✅ for good news, 💰 for financial, 📦 for inventory)
- Keep each bullet to 1-2 sentences max
- Highlight the MOST IMPORTANT items first (expired items, critical low stock, revenue anomalies)
- If everything looks good, say so positively
- Use dollar amounts and specific numbers
- Language: English
- Be professional but conversational — like a trusted manager reporting to the owner`;

  try {
    const summary = await chat(systemPrompt, prompt, {
      model: 'fast',
      temperature: 0.3,
      maxTokens: 512,
    });

    const briefing: AIBriefing = {
      summary: summary.trim(),
      generatedAt: new Date().toISOString(),
      dataPoints,
    };

    cacheBriefing(briefing);
    console.log('[AIBriefing] ✅ Briefing generated and cached');
    return briefing;
  } catch (error) {
    console.error('[AIBriefing] ❌ Generation failed:', error);
    // Return a fallback briefing with just the data points
    return {
      summary: `📊 Your clinic has ${inventory.length} items tracked. ${dataPoints.lowStockItems > 0 ? `⚠️ ${dataPoints.lowStockItems} items are low on stock.` : '✅ All stock levels are healthy.'} ${dataPoints.expiringItems > 0 ? `⚠️ ${dataPoints.expiringItems} items expiring within 14 days.` : ''}`,
      generatedAt: new Date().toISOString(),
      dataPoints,
    };
  }
}

export function clearBriefingCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
