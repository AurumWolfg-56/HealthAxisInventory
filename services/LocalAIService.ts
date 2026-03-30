/**
 * Local AI Service
 * Connects to LM Studio's OpenAI-compatible API at localhost:1234.
 * Replaces geminiService.ts — all AI processing stays local.
 *
 * Models (loaded in LM Studio):
 * - Text:   bartowski/meta-llama-3.1-8b-instruct (fast intent extraction)
 * - Smart:  qwen2.5-14b-instruct (complex reasoning, reports)
 * - Vision: qwen2.5-vl-7b-instruct (OCR, invoice scanning, item labels)
 * - Embed:  text-embedding-nomic-embed-text-v1.5 (semantic search)
 *
 * Why Qwen2.5-VL over LLaVA for vision:
 *   - Superior OCR and document understanding (tables, numbers, structured text)
 *   - Better at extracting precise values from invoices/labels vs general descriptions
 *   - Native multi-image support and higher resolution processing
 */

// ─── Configuration ──────────────────────────────────────────────────────────
// Primary: LM Studio direct endpoint (both models loaded here)
// Fallback: Local AI gateway (whisper_server.py) which proxies and adds CORS
const LM_STUDIO_DIRECT_URL = 'http://127.0.0.1:1234/v1';
const LM_STUDIO_GATEWAY_URL = 'http://localhost:8765/v1';
let LM_STUDIO_URL = LM_STUDIO_DIRECT_URL;

// Model identifiers (must match LM Studio model IDs exactly)
const MODELS = {
  fast: 'bartowski/meta-llama-3.1-8b-instruct',
  smart: 'qwen2.5-14b-instruct',
  vision: 'qwen2.5-vl-7b-instruct',
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
 * Handles timeouts, endpoint fallback, and JSON extraction.
 * Vision requests get a longer timeout since OCR processing is heavier.
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
  const isVision = model === 'vision' || modelId === MODELS.vision;

  // Vision tasks need more time (OCR + structured extraction)
  const timeoutMs = isVision ? 120000 : 60000;

  // Try primary endpoint first, then fallback
  const endpoints = [LM_STUDIO_URL, LM_STUDIO_URL === LM_STUDIO_DIRECT_URL ? LM_STUDIO_GATEWAY_URL : LM_STUDIO_DIRECT_URL];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[LocalAI] Request → ${modelId} @ ${endpoint} (json=${jsonMode}, vision=${isVision})`);

      const response = await fetch(`${endpoint}/chat/completions`, {
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
      console.log(`[LocalAI] ✅ Response (${text.length} chars) from ${endpoint}`);

      // Remember which endpoint worked
      if (endpoint !== LM_STUDIO_URL) {
        console.log(`[LocalAI] Switching primary endpoint to ${endpoint}`);
        LM_STUDIO_URL = endpoint;
      }

      return text;
    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        console.warn(`[LocalAI] ⏳ Timeout (${timeoutMs / 1000}s) at ${endpoint}`);
        continue; // Try next endpoint
      }
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        console.warn(`[LocalAI] 🔌 Connection failed at ${endpoint}, trying fallback...`);
        continue; // Try next endpoint
      }
      // Non-network error — don't retry
      throw error;
    }
  }

  // All endpoints failed
  if (lastError?.name === 'AbortError') {
    throw new Error(`Local AI timed out (${timeoutMs / 1000}s). Is LM Studio running with ${modelId} loaded?`);
  }
  throw new Error('Cannot connect to LM Studio. Is the server running at 127.0.0.1:1234?');
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
 * Scans an inventory item label using Qwen2.5-VL vision model.
 * Extracts all relevant data for creating a new inventory entry.
 * Qwen2.5-VL excels at OCR and reading text from packaging/labels.
 */
export const scanItemLabel = async (base64Image: string): Promise<ScannedItemData> => {
  // Ensure proper data URL format
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const systemPrompt = `You are a medical supply OCR system. You read product labels and packaging with high accuracy. You output ONLY valid JSON, no commentary.`;

  const prompt = `Read all text on this medical supply label/packaging image carefully.

Extract a JSON object with exactly these fields:
{
  "name": "exact product name from label",
  "category": "one of: ${INVENTORY_CATEGORIES.join(', ')}",
  "stock": number (pack size, e.g. Box of 100 = 100, default 1),
  "unit": "each|box|pack|case|vial|bottle|roll",
  "minStock": number (life-saving=20, consumable=10, general=5),
  "maxStock": number (3-5x minStock),
  "expiryDate": "YYYY-MM-DD or null",
  "batchNumber": "lot/batch number or null",
  "location": "one of: ${INVENTORY_LOCATIONS.join(', ')}",
  "averageCost": number (estimated USD unit cost),
  "confidence": number (0-100)
}`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt }
          ]
        }
      ],
      { model: 'vision', jsonMode: true, maxTokens: 4096 }
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
 * Parse invoice/purchase order images using Qwen2.5-VL vision model.
 * Qwen2.5-VL is excellent at reading tabular data, numbers, and structured documents.
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

  const systemPrompt = `You are a document OCR system specialized in reading invoices, purchase orders, and order confirmations. You extract structured data with high accuracy. Read every number, product name, and price carefully. Output ONLY valid JSON.`;

  const prompt = `Read this invoice/order document image carefully. Extract ALL text and numbers precisely.

Return a JSON object with this exact structure:
{
  "vendor": "supplier company name",
  "poNumber": "order/confirmation number",
  "orderDate": "YYYY-MM-DD",
  "items": [
    {
      "name": "full product description",
      "category": "one of: ${INVENTORY_CATEGORIES.join(', ')}",
      "sku": "product code or item number",
      "quantity": number,
      "unitCost": number (price per unit, NOT extended price),
      "packSize": "pack description e.g. 25/BX, 100/CA, Each"
    }
  ],
  "subtotal": number,
  "totalTax": number (absolute amount, not percentage),
  "shippingCost": number,
  "grandTotal": number,
  "confidence": number (0-100)
}

RULES:
- Extract EVERY line item visible in the document
- unitCost is the UNIT price, not quantity × price
- Use 0 for any unclear numeric values
- Read numbers exactly as printed (prices, quantities, totals)`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
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
 * Check if LM Studio is reachable. Tries both direct and gateway endpoints.
 * Reports loaded models and vision model availability.
 */
export const checkConnection = async (): Promise<{
  connected: boolean;
  models: string[];
  endpoint: string;
  visionReady: boolean;
}> => {
  const endpoints = [LM_STUDIO_DIRECT_URL, LM_STUDIO_GATEWAY_URL];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const models = data.data?.map((m: any) => m.id) || [];
      const visionReady = models.some((m: string) =>
        m.includes('qwen2.5-vl') || m.includes('llava') || m.includes('vision')
      );

      // Update primary URL to working endpoint
      LM_STUDIO_URL = endpoint;

      return { connected: true, models, endpoint, visionReady };
    } catch {
      continue;
    }
  }

  return { connected: false, models: [], endpoint: '', visionReady: false };
};
