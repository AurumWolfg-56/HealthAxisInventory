/**
 * Query Engine — Natural Language Data Queries
 * Answers questions about clinic data using local LLM.
 *
 * Flow: User question → LLM classifies intent → data lookup → LLM formats answer
 */

import { jsonChat, chat } from './LocalAIService';
import { InventoryItem, Order, PettyCashTransaction, Protocol } from '../types';
import { DailyReport } from '../types/dailyReport';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface QueryResult {
  answer: string;
  dataUsed: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface QueryIntent {
  category: 'inventory' | 'orders' | 'revenue' | 'expenses' | 'protocols' | 'general';
  action: 'search' | 'count' | 'sum' | 'compare' | 'list' | 'status';
  filters: {
    itemName?: string;
    category?: string;
    dateRange?: string;
    vendor?: string;
  };
}

// ─── Data Context Builder ───────────────────────────────────────────────────
function buildDataContext(
  intent: QueryIntent,
  inventory: InventoryItem[],
  orders: Order[],
  dailyReports: DailyReport[],
  pettyCash: PettyCashTransaction[],
  protocols: Protocol[]
): string {
  const parts: string[] = [];

  if (intent.category === 'inventory' || intent.category === 'general') {
    // Inventory summary
    const lowStock = inventory.filter(i => i.stock <= i.minStock);
    const categories = [...new Set(inventory.map(i => i.category))];

    if (intent.action === 'search' && intent.filters.itemName) {
      const search = intent.filters.itemName.toLowerCase();
      const matches = inventory.filter(i =>
        i.name.toLowerCase().includes(search) ||
        i.category.toLowerCase().includes(search)
      );
      parts.push(`SEARCH RESULTS for "${intent.filters.itemName}":`);
      if (matches.length === 0) {
        parts.push('No items found matching that search.');
      } else {
        matches.slice(0, 15).forEach(i => {
          parts.push(`- ${i.name} | Category: ${i.category} | Stock: ${i.stock} ${i.unit} | Min: ${i.minStock} | Location: ${i.location} | Cost: $${i.averageCost?.toFixed(2) || 'N/A'}${i.expiryDate ? ` | Exp: ${i.expiryDate}` : ''}`);
        });
        if (matches.length > 15) parts.push(`... and ${matches.length - 15} more items`);
      }
    } else if (intent.filters.category) {
      const catItems = inventory.filter(i =>
        i.category.toLowerCase().includes(intent.filters.category!.toLowerCase())
      );
      parts.push(`ITEMS IN CATEGORY "${intent.filters.category}" (${catItems.length}):`);
      catItems.slice(0, 15).forEach(i => {
        parts.push(`- ${i.name} | Stock: ${i.stock} ${i.unit} | Cost: $${i.averageCost?.toFixed(2) || 'N/A'}`);
      });
    } else {
      parts.push(`INVENTORY OVERVIEW: ${inventory.length} total items across ${categories.length} categories`);
      parts.push(`Low stock: ${lowStock.length} items`);
      parts.push(`Categories: ${categories.join(', ')}`);

      // Total valuation
      const totalValue = inventory.reduce((sum, i) => sum + (i.stock * (i.averageCost || 0)), 0);
      parts.push(`Total inventory value: $${totalValue.toFixed(2)}`);

      if (lowStock.length > 0) {
        parts.push(`\nLOW STOCK ITEMS:`);
        lowStock.slice(0, 10).forEach(i => {
          parts.push(`- ${i.name}: ${i.stock}/${i.minStock} ${i.unit}`);
        });
      }
    }
  }

  if (intent.category === 'orders' || intent.category === 'general') {
    parts.push(`\nORDERS: ${orders.length} total`);
    const pending = orders.filter(o => o.status === 'PENDING');
    const received = orders.filter(o => o.status === 'RECEIVED');
    parts.push(`Pending: ${pending.length} | Received: ${received.length}`);

    if (intent.filters.vendor) {
      const vendorOrders = orders.filter(o =>
        o.vendor.toLowerCase().includes(intent.filters.vendor!.toLowerCase())
      );
      parts.push(`Orders from "${intent.filters.vendor}": ${vendorOrders.length}`);
      vendorOrders.slice(0, 5).forEach(o => {
        parts.push(`- PO#${o.poNumber} | ${o.orderDate} | $${o.grandTotal.toFixed(2)} | ${o.status}`);
      });
    }

    const totalSpent = orders.filter(o => o.status === 'RECEIVED')
      .reduce((sum, o) => sum + o.grandTotal, 0);
    parts.push(`Total spent (received): $${totalSpent.toFixed(2)}`);
  }

  if (intent.category === 'revenue' || intent.category === 'general') {
    if (dailyReports.length > 0) {
      const sorted = [...dailyReports].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const recent = sorted.slice(0, 7);
      const totalRevenue = recent.reduce((sum, r) => sum + (r.totals?.revenue || 0), 0);
      const totalPatients = recent.reduce((sum, r) => sum + (r.totals?.patients || 0), 0);

      parts.push(`\nREVENUE (last ${recent.length} reports):`);
      parts.push(`Total: $${totalRevenue.toFixed(2)} | Patients: ${totalPatients}`);
      parts.push(`Average per day: $${(totalRevenue / recent.length).toFixed(2)}`);

      recent.forEach(r => {
        parts.push(`- ${r.timestamp.split('T')[0]}: $${(r.totals?.revenue || 0).toFixed(2)} | ${r.totals?.patients || 0} patients`);
      });
    }
  }

  if (intent.category === 'expenses' || intent.category === 'general') {
    if (pettyCash.length > 0) {
      const recent = [...pettyCash]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      const totalOut = recent.filter(t => t.action === 'WITHDRAWAL')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      parts.push(`\nPETTY CASH (last ${recent.length} transactions):`);
      parts.push(`Total withdrawals: $${totalOut.toFixed(2)}`);
      if (recent.length > 0) {
        parts.push(`Current balance: $${recent[0].runningBalance.toFixed(2)}`);
      }
    }
  }

  if (intent.category === 'protocols' || intent.category === 'general') {
    if (protocols.length > 0) {
      parts.push(`\nCLINIC PROTOCOLS & RULES (${protocols.length} total):`);
      protocols.forEach(p => {
        parts.push(`- Protocol Area: ${p.area} | Severity: ${p.severity}`);
        parts.push(`  Content/Rules: ${p.content}`);
      });
    }
  }

  return parts.join('\n');
}

// ─── Main Query Function ────────────────────────────────────────────────────

export async function queryClinicData(
  question: string,
  inventory: InventoryItem[],
  orders: Order[],
  dailyReports: DailyReport[],
  pettyCash: PettyCashTransaction[],
  protocols: Protocol[]
): Promise<QueryResult> {
  console.log(`[QueryEngine] Processing: "${question}"`);

  // Step 1: Classify intent
  const intent = await jsonChat<QueryIntent>(
    `Classify this clinic data question. Return JSON with:
- category: "inventory" | "orders" | "revenue" | "expenses" | "protocols" | "general"
- action: "search" | "count" | "sum" | "compare" | "list" | "status"
- filters: { itemName?, category?, dateRange?, vendor? }

The clinic manages: medical inventory, purchase orders, daily revenue reports, petty cash, and clinic protocols/rules/SOPs.`,
    question,
    { model: 'fast', maxTokens: 256 }
  );

  console.log('[QueryEngine] Intent:', intent);

  // Step 2: Gather relevant data
  const dataContext = buildDataContext(intent, inventory, orders, dailyReports, pettyCash, protocols);

  // Step 3: Generate human-readable answer
  const answer = await chat(
    `You are Norvexis, an AI clinic data assistant. Answer the user's question based ONLY on the data provided. Be concise, use specific numbers, and format with bullet points when listing multiple items. If the data doesn't contain enough info, say so honestly.`,
    `Question: "${question}"\n\nAvailable Data:\n${dataContext}`,
    { model: 'fast', temperature: 0.2, maxTokens: 512 }
  );

  return {
    answer: answer.trim(),
    dataUsed: intent.category,
    confidence: dataContext.includes('No items found') ? 'LOW' : 'HIGH',
  };
}
