/**
 * Local AI Service
 * Connects to LM Studio's OpenAI-compatible API at localhost:1234.
 * Replaces geminiService.ts — all AI processing stays local.
 *
 * Models (auto-loaded by LM Studio JIT):
 * - Text:   bartowski/meta-llama-3.1-8b-instruct (fast intent extraction)
 * - Smart:  qwen2.5-14b-instruct (complex reasoning, reports)
 * - Vision: llava-v1.6-mistral-7b (image analysis — item scanning, invoices)
 * - Embed:  text-embedding-nomic-embed-text-v1.5 (semantic search)
 */

// ─── Configuration ──────────────────────────────────────────────────────────
// Uses the local AI gateway (whisper_server.py) which proxies to LM Studio
// and provides CORS headers — works from both localhost and production
const LM_STUDIO_URL = 'http://localhost:8765/v1';

// Model identifiers (must match LM Studio model IDs)
const MODELS = {
  fast: 'bartowski/meta-llama-3.1-8b-instruct',
  smart: 'qwen2.5-14b-instruct',
  vision: 'llava-v1.6-mistral-7b',
  embed: 'text-embedding-nomic-embed-text-v1.5',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface ChatOptions {
  model?: keyof typeof MODELS | string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// ─── Core API Call ──────────────────────────────────────────────────────────

/**
 * Send a chat completion request to LM Studio.
 * Handles timeouts, retries, and JSON extraction.
 */
const chatCompletion = async (
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> => {
  const {
    model = 'fast',
    temperature = 0.1,
    maxTokens = 2048,
    jsonMode = false,
  } = options;

  // Resolve model ID
  const modelId = model in MODELS ? MODELS[model as keyof typeof MODELS] : model;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    console.log(`[LocalAI] Request → ${modelId} (json=${jsonMode})`);

    const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LM Studio error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log(`[LocalAI] ✅ Response (${text.length} chars)`);
    return text;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Local AI timed out (60s). Is LM Studio running?');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error('Cannot connect to LM Studio at localhost:1234. Is the server running?');
    }
    throw error;
  }
};

// ─── Helper: Parse JSON from LLM response ──────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  let clean = text.trim();

  // Strip markdown code blocks
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  // Try to find JSON object or array
  const jsonStart = clean.indexOf('{');
  const jsonArrayStart = clean.indexOf('[');
  const start = jsonStart === -1 ? jsonArrayStart : (jsonArrayStart === -1 ? jsonStart : Math.min(jsonStart, jsonArrayStart));

  if (start > 0) {
    clean = clean.slice(start);
  }

  return JSON.parse(clean) as T;
}

// ─── Public API: Text Functions ─────────────────────────────────────────────

import { CATEGORIES } from '../utils/constants';

export const INVENTORY_CATEGORIES = CATEGORIES;

const INVENTORY_LOCATIONS = [
  'Front Desk', "Manager's Office", 'Nursing Station / Provider Station',
  'Exam Rooms', 'Soiled Utility Room', 'Break Room', 'Laboratory'
];

/**
 * Process a text command into structured intent (after STT).
 * Uses fast model (Llama 3.1 8B) for quick classification.
 */
export const processTextCommand = async (text: string): Promise<{
  intent: 'ADD' | 'SEARCH' | 'CONSUME' | 'UNKNOWN';
  item: string;
  quantity: number;
}> => {
  try {
    const response = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are an inventory command parser. Extract the user's intent from their voice command.
Return a JSON object with: intent (ADD, SEARCH, CONSUME, or UNKNOWN), item (string), quantity (number, default 0).

Examples:
"Search for gloves" → {"intent":"SEARCH","item":"gloves","quantity":0}
"Add 50 masks" → {"intent":"ADD","item":"masks","quantity":50}
"Use 2 syringes" → {"intent":"CONSUME","item":"syringes","quantity":2}
"Buscar gasas" → {"intent":"SEARCH","item":"gasas","quantity":0}
"Agregar 10 vendas" → {"intent":"ADD","item":"vendas","quantity":10}`
        },
        { role: 'user', content: text }
      ],
      { model: 'fast', jsonMode: true, maxTokens: 256 }
    );

    return parseJsonResponse(response);
  } catch (error) {
    console.error('[LocalAI] Text command error:', error);
    return { intent: 'UNKNOWN', item: '', quantity: 0 };
  }
};

/**
 * Process audio command — now delegates to STT first, then text processing.
 * (Audio goes to local Whisper, text goes to local LLM)
 */
export const processAudioCommand = async (base64Audio: string): Promise<{
  intent: 'ADD' | 'SEARCH' | 'CONSUME' | 'UNKNOWN';
  item: string;
  quantity: number;
}> => {
  // This function is kept for backwards compatibility but the pipeline
  // now goes: audio → Whisper (local) → processTextCommand (local LLM)
  // The VoiceAssistant component handles this flow directly.
  console.warn('[LocalAI] processAudioCommand called directly — consider using Whisper → processTextCommand pipeline');
  return { intent: 'UNKNOWN', item: '', quantity: 0 };
};

/**
 * Refines a medical dictation string into professional clinical text.
 * Uses smart model (Qwen2.5-14b) for better medical writing quality.
 */
export const refineClinicalNote = async (text: string): Promise<string> => {
  try {
    const response = await chatCompletion(
      [
        {
          role: 'system',
          content: `You are a medical scribe. Refine the following dictation into a professional clinical note.
Guidelines:
1. Correct medical spelling and expand abbreviations.
2. Maintain the ORIGINAL intent and flow.
3. Output must be a SINGLE professional clinical paragraph.
4. DO NOT use bullet points, headers, or multiple line breaks.
Return ONLY the refined text. No preamble.`
        },
        { role: 'user', content: text }
      ],
      { model: 'smart', temperature: 0.3, maxTokens: 1024 }
    );

    return response.trim() || text;
  } catch (error) {
    console.error('[LocalAI] Clinical note refinement error:', error);
    return text; // Return original on error
  }
};

// ─── Public API: Vision Functions ───────────────────────────────────────────

export interface ScannedItemData {
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStock: number;
  maxStock: number;
  expiryDate: string | null;
  batchNumber: string | null;
  location: string;
  averageCost: number;
  confidence: number;
}

/**
 * Scans an inventory item label using LLaVA vision model.
 * Extracts all relevant data for creating a new inventory entry.
 */
export const scanItemLabel = async (base64Image: string): Promise<ScannedItemData> => {
  // Ensure proper data URL format
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const prompt = `Analyze this image of a medical supply item label/packaging.

Extract and return a JSON object with these fields:
- name: exact product name
- category: choose from [${INVENTORY_CATEGORIES.join(', ')}]
- stock: visible item count or pack size (e.g., "Box of 100" = 100)
- unit: "each", "box", "pack", "case", "vial", "bottle", or "roll"
- minStock: suggest based on criticality (life-saving=20, consumables=10, general=5)
- maxStock: 3-5x the minStock
- expiryDate: YYYY-MM-DD format or null
- batchNumber: lot/batch number or null
- location: suggest from [${INVENTORY_LOCATIONS.join(', ')}]
- averageCost: estimated unit cost in USD
- confidence: 0-100 extraction confidence

Return ONLY valid JSON.`;

  try {
    const response = await chatCompletion(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt }
          ]
        }
      ],
      { model: 'vision', jsonMode: true, maxTokens: 2048 }
    );

    return parseJsonResponse<ScannedItemData>(response);
  } catch (error) {
    console.error('[LocalAI] Item scan error:', error);
    throw error;
  }
};

/**
 * Legacy function for backwards compatibility
 */
export const identifyItemFromImage = scanItemLabel;

/**
 * Parse invoice/purchase order images using LLaVA vision model.
 */
export interface ParsedOrderData {
  poNumber: string;
  vendor: string;
  orderDate: string;
  items: Array<{
    name: string;
    category?: string;
    sku: string;
    quantity: number;
    unitCost: number;
    packSize: string;
  }>;
  subtotal: number;
  totalTax: number;
  shippingCost: number;
  grandTotal: number;
  confidence: number;
}

export const parseInvoiceFromImage = async (base64Image: string): Promise<ParsedOrderData | null> => {
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const prompt = `Analyze this order confirmation, invoice, or purchase order image.

Extract and return a JSON object with:
- vendor: supplier name (e.g., "Henry Schein", "McKesson")
- poNumber: order/confirmation number
- orderDate: YYYY-MM-DD format
- items: array of {name, category, sku, quantity, unitCost, packSize}
  - category: choose from [${INVENTORY_CATEGORIES.join(', ')}]
- subtotal: before tax/shipping
- totalTax: tax amount
- shippingCost: shipping cost
- grandTotal: final total
- confidence: 0-100

Extract ALL visible line items. Use 0 for unclear values. Return ONLY valid JSON.`;

  try {
    const response = await chatCompletion(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt }
          ]
        }
      ],
      { model: 'vision', jsonMode: true, maxTokens: 8192 }
    );

    return parseJsonResponse<ParsedOrderData>(response);
  } catch (error) {
    console.error('[LocalAI] Invoice parse error:', error);
    return null;
  }
};

// ─── Utility: General AI Chat ───────────────────────────────────────────────

/**
 * General-purpose chat with local AI. Used by other services.
 */
export const chat = async (
  systemPrompt: string,
  userMessage: string,
  options?: ChatOptions
): Promise<string> => {
  return chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    options
  );
};

/**
 * Get structured JSON response from local AI.
 */
export const jsonChat = async <T>(
  systemPrompt: string,
  userMessage: string,
  options?: Omit<ChatOptions, 'jsonMode'>
): Promise<T> => {
  const response = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    { ...options, jsonMode: true }
  );
  return parseJsonResponse<T>(response);
};

/**
 * Check if LM Studio is reachable.
 */
export const checkConnection = async (): Promise<{
  connected: boolean;
  models: string[];
}> => {
  try {
    const response = await fetch(`${LM_STUDIO_URL}/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { connected: false, models: [] };
    const data = await response.json();
    return {
      connected: true,
      models: data.data?.map((m: any) => m.id) || [],
    };
  } catch {
    return { connected: false, models: [] };
  }
};
