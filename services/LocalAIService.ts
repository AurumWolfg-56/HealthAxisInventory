/**
 * Local AI Service
 * Connects to LM Studio's OpenAI-compatible API at localhost:1234.
 * Replaces geminiService.ts — all AI processing stays local.
 *
 * Models (loaded in LM Studio):
 * - Text:   bartowski/meta-llama-3.1-8b-instruct (fast intent extraction)
 * - Smart:  qwen2.5-14b-instruct (complex reasoning, reports, invoice parsing)
 * - Embed:  text-embedding-nomic-embed-text-v1.5 (semantic search)
 *
 * OCR Pipeline (for invoice/label scanning):
 *   Image → Tesseract.js (OCR in browser) → extracted text → Qwen2.5-14B → JSON
 *   This is more reliable than GGUF vision models which have broken image support.
 *   Tesseract.js runs as WebAssembly in the browser — no server dependency.
 */

// ─── Configuration ──────────────────────────────────────────────────────────
// Primary: LM Studio direct — CORS enabled via: lms server start --port 1234 --cors
// Fallback: AI Gateway (whisper_server.py) — proxy with CORS (also serves Whisper STT)
// Both endpoints now support CORS for norvexiscore.com
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

  // Vision tasks need much more time — large invoice OCR can take 2-5 min on 7B models
  const timeoutMs = isVision ? 300000 : 60000;

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

// ─── Public API: OCR + AI Functions ──────────────────────────────────────────

/**
 * Optimizes an image for OCR processing.
 * Resizes to max 2000px (OCR works better with higher res than vision models)
 * and converts to high-quality JPEG for Tesseract.
 */
const optimizeImageForOCR = async (
  base64Image: string,
  maxDimension: number = 2000
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // Higher quality for OCR accuracy
      const optimized = canvas.toDataURL('image/png');
      console.log(`[LocalAI] 🖼️ Image prepared for OCR: ${width}x${height}`);
      resolve(optimized);
    };
    img.onerror = () => {
      console.warn('[LocalAI] Image preparation failed, using original');
      resolve(base64Image);
    };
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
};

/**
 * Extracts text from an image using Tesseract.js OCR.
 * Runs entirely in the browser (WebAssembly) — no server needed.
 * Lazily loads Tesseract on first use.
 */
let tesseractWorker: any = null;

const extractTextFromImage = async (base64Image: string): Promise<string> => {
  const startTime = Date.now();
  console.log('[LocalAI] 📸 Starting Tesseract.js OCR...');

  try {
    // Import Tesseract.js dynamically (lazy load)
    const Tesseract = await import('tesseract.js');

    // Optimize image for OCR
    const optimizedImage = await optimizeImageForOCR(base64Image);

    // Create or reuse worker
    if (!tesseractWorker) {
      console.log('[LocalAI] ⏳ Initializing Tesseract worker (first use)...');
      tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            if (pct % 25 === 0) console.log(`[LocalAI] OCR progress: ${pct}%`);
          }
        }
      });
    }

    const result = await tesseractWorker.recognize(optimizedImage);
    const text = result.data.text;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const confidence = Math.round(result.data.confidence);

    console.log(`[LocalAI] ✅ OCR complete: ${text.length} chars, ${confidence}% confidence, ${elapsed}s`);
    return text;
  } catch (error) {
    console.error('[LocalAI] ❌ OCR error:', error);
    // Cleanup broken worker
    if (tesseractWorker) {
      try { await tesseractWorker.terminate(); } catch {}
      tesseractWorker = null;
    }
    throw new Error('Failed to extract text from image. Please try a clearer photo.');
  }
};

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
 * Scans an inventory item label using OCR + text AI.
 * Uses Tesseract.js for image-to-text, then Qwen2.5-14B for structured extraction.
 * This is more reliable than GGUF vision models which have inconsistent image support.
 */
export const scanItemLabel = async (base64Image: string): Promise<ScannedItemData> => {
  console.log('[LocalAI] 🔍 Starting OCR-based item scan...');

  // Step 1: OCR — Extract text from image using Tesseract.js
  const ocrText = await extractTextFromImage(base64Image);
  if (!ocrText || ocrText.trim().length < 5) {
    throw new Error('Could not read text from image. Please ensure the label is clear and well-lit.');
  }
  console.log(`[LocalAI] 📄 OCR extracted ${ocrText.length} chars`);

  // Step 2: AI — Parse the extracted text into structured JSON
  const systemPrompt = `You are a medical supply data extraction system. You receive OCR text from product labels/packaging and extract structured information. Output ONLY valid JSON, no commentary.`;

  const prompt = `The following text was extracted via OCR from a medical supply label/packaging:

--- OCR TEXT START ---
${ocrText}
--- OCR TEXT END ---

Parse this text and return a JSON object with exactly these fields:
{
  "name": "exact product name found in text",
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
        { role: 'user', content: prompt }
      ],
      { model: 'smart', jsonMode: true, maxTokens: 4096 }
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
 * Parse invoice/purchase order images using OCR + text AI.
 * Uses Tesseract.js for image-to-text, then Qwen2.5-14B for structured extraction.
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
  console.log('[LocalAI] 🔍 Starting OCR-based invoice scan...');

  // Step 1: OCR — Extract text from image using Tesseract.js
  const ocrText = await extractTextFromImage(base64Image);
  if (!ocrText || ocrText.trim().length < 10) {
    console.error('[LocalAI] OCR returned insufficient text:', ocrText);
    return null;
  }
  console.log(`[LocalAI] 📄 OCR extracted ${ocrText.length} chars from invoice`);

  // Step 2: AI — Parse the extracted text into structured JSON
  const systemPrompt = `You are a document parsing system specialized in reading invoices, purchase orders, and order confirmations. You receive OCR text and extract structured data with high accuracy. Extract every number, product name, and price carefully. Output ONLY valid JSON.`;

  const prompt = `The following text was extracted via OCR from an invoice/order document:

--- OCR TEXT START ---
${ocrText}
--- OCR TEXT END ---

Parse this invoice text and return a JSON object with this exact structure:
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
- Extract EVERY line item from the invoice text
- unitCost is the UNIT price, not quantity × price
- Use 0 for any unclear numeric values
- Parse numbers exactly (remove $ signs, commas)`;

  try {
    const response = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      { model: 'smart', jsonMode: true, maxTokens: 8192 }
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
