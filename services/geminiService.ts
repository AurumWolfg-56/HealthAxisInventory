import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini with Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
const openAiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

import { CATEGORIES } from '../utils/constants';

/**
 * Safely parses JSON from Gemini responses, stripping any markdown wrappers
 * or trailing characters that might cause a parse error.
 */
function safeParseJson<T>(text: string): T {
  let cleanText = text.trim();
  // Remove markdown JSON code blocks if they exist
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText) as T;
  } catch (err) {
    console.error("Failed to parse clean text as JSON:", cleanText);
    throw err;
  }
}

// Predefined categories for intelligent matching
export const INVENTORY_CATEGORIES = CATEGORIES;

// Predefined locations for intelligent suggestion
const INVENTORY_LOCATIONS = [
  'Front Desk', "Manager's Office", 'Nursing Station / Provider Station',
  'Exam Rooms', 'Soiled Utility Room', 'Break Room', 'Laboratory'
];

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
  confidence: number; // 0-100 extraction confidence
}

/**
 * Scans an inventory item label using Gemini 2.0 Flash vision capabilities.
 * Extracts all relevant data for creating a new inventory entry.
 */
export const scanItemLabel = async (base64Image: string): Promise<ScannedItemData> => {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `You are a medical inventory AI assistant. Analyze this image of a medical supply item label/packaging.

EXTRACTION RULES:
1. **Name**: Extract the exact product name. If brand + product, format as "Brand ProductName".
2. **Category**: Choose the BEST match from: ${INVENTORY_CATEGORIES.join(', ')}.
3. **Stock**: Count visible items or use pack size (e.g., "Box of 100" = 100).
4. **Unit**: Determine unit type: "each", "box", "pack", "case", "vial", "bottle", "roll".
5. **MinStock**: Suggest based on criticality (life-saving = 20+, consumables = 10, general = 5).
6. **MaxStock**: Suggest 3-5x the minStock value.
7. **ExpiryDate**: Extract if visible, format as YYYY-MM-DD. Null if not found.
8. **BatchNumber**: Extract lot/batch number if visible. Null if not found.
9. **Location**: Suggest from: ${INVENTORY_LOCATIONS.join(', ')} based on item type.
10. **AverageCost**: Estimate typical unit cost in USD for this medical item.
11. **Confidence**: Rate your extraction confidence 0-100 based on image clarity.

Be precise and clinical. If unsure, use reasonable medical supply defaults.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            stock: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            minStock: { type: Type.NUMBER },
            maxStock: { type: Type.NUMBER },
            expiryDate: { type: Type.STRING, nullable: true },
            batchNumber: { type: Type.STRING, nullable: true },
            location: { type: Type.STRING },
            averageCost: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER }
          },
          required: ["name", "category", "stock", "unit", "minStock", "maxStock", "location", "averageCost", "confidence"]
        },
        maxOutputTokens: 2048
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return safeParseJson<ScannedItemData>(text);

  } catch (error) {
    console.error("Gemini Scan Error:", error);
    throw error;
  }
};

/**
 * Legacy function for backwards compatibility
 */
export const identifyItemFromImage = scanItemLabel;

/**
 * Process audio command for voice-based inventory operations
 */
export const processAudioCommand = async (base64Audio: string): Promise<{
  intent: 'ADD' | 'SEARCH' | 'CONSUME' | 'UNKNOWN';
  item: string;
  quantity: number;
}> => {
  const base64Data = base64Audio.replace(/^data:.*?;base64,/, "");

  const prompt = `You are an inventory assistant. Listen to the user's voice command and extract the intent.
  Examples:
  "Search for gloves" -> {"intent": "SEARCH", "item": "gloves", "quantity": 0}
  "Add 50 masks" -> {"intent": "ADD", "item": "masks", "quantity": 50}
  "Use 2 syringes" -> {"intent": "CONSUME", "item": "syringes", "quantity": 2}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'audio/webm',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING },
            item: { type: Type.STRING },
            quantity: { type: Type.NUMBER }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return { intent: "UNKNOWN", item: "", quantity: 0 };
    return safeParseJson<any>(text);

  } catch (error) {
    console.error("Gemini Audio Error:", error);
    return { intent: "UNKNOWN", item: "", quantity: 0 };
  }
};

/**
 * Process text command for voice-based inventory operations (after STT)
 */
export const processTextCommand = async (text: string): Promise<{
  intent: 'ADD' | 'SEARCH' | 'CONSUME' | 'UNKNOWN';
  item: string;
  quantity: number;
}> => {
  const prompt = `You are an inventory assistant. Analyze the user's text command and extract the intent.
  User said: "${text}"
  
  Examples:
  "Search for gloves" -> {"intent": "SEARCH", "item": "gloves", "quantity": 0}
  "Add 50 masks" -> {"intent": "ADD", "item": "masks", "quantity": 50}
  "Use 2 syringes" -> {"intent": "CONSUME", "item": "syringes", "quantity": 2}
  
  Return valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING },
            item: { type: Type.STRING },
            quantity: { type: Type.NUMBER }
          }
        },
        maxOutputTokens: 1024
      }
    });

    const resultText = response.text;
    if (!resultText) return { intent: "UNKNOWN", item: "", quantity: 0 };
    return safeParseJson<any>(resultText);

  } catch (error) {
    console.error("Gemini Text Command Error:", error);
    return { intent: "UNKNOWN", item: "", quantity: 0 };
  }
};

/**
 * Refines a medical dictation string into professional clinical text.
 * Expands abbreviations and corrects medical terminology.
 */
export const refineClinicalNote = async (text: string): Promise<string> => {
  const prompt = `You are a medical scribe. Refine the following dictation into a professional clinical note.
  Guidelines:
  1. Correct medical spelling and expand abbreviations.
  2. Maintain the ORIGINAL intent and flow.
  3. Output must be a SINGLE professional clinical paragraph. 
  4. DO NOT use bullet points, headers, or multiple line breaks.
  
  Dictation: "${text}"
  
  Return ONLY the refined text. No preamble.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ text: prompt }],
    });
    return result.text || text;
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    return text;
  }
};

/**
 * Parse invoice/purchase order images with comprehensive extraction
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
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `You are a medical supply order data extraction AI. Analyze this order confirmation, invoice, or purchase order image.

EXTRACTION RULES:
1. **Vendor**: Identify the supplier (e.g., "Henry Schein", "Medline", "Amazon", "McKesson", "Labcorp")
2. **PO Number**: Look for order numbers, confirmation numbers, or PO references
3. **Order Date**: Extract order date, format as YYYY-MM-DD
4. **Line Items**: For EACH item row extract:
   - name: Full product description (clean and readable)
   - category: Best guess from [${INVENTORY_CATEGORIES.join(', ')}]
   - sku: Product code, catalog number, or item number
   - quantity: Number of units ordered (look for "Qty", "Order Qty", etc.)
   - unitCost: Price per unit (look for unit price, not extended price)
   - packSize: Pack description (e.g., "25/BX", "100/CA", "Each")
5. **Subtotal**: Order subtotal before tax/shipping
6. **Tax**: Total tax amount (absolute value, not percentage)
7. **Shipping**: Shipping/freight cost
8. **Grand Total**: Final order total
9. **Confidence**: Rate extraction confidence 0-100

Be precise with numbers. Extract ALL line items visible. If values are unclear, use 0.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg',
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            poNumber: { type: Type.STRING },
            vendor: { type: Type.STRING },
            orderDate: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  sku: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitCost: { type: Type.NUMBER },
                  packSize: { type: Type.STRING }
                },
                required: ["name", "quantity", "unitCost"]
              }
            },
            subtotal: { type: Type.NUMBER },
            totalTax: { type: Type.NUMBER },
            shippingCost: { type: Type.NUMBER },
            grandTotal: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER }
          },
          required: ["vendor", "items", "grandTotal", "confidence"]
        },
        maxOutputTokens: 8192
      }
    });

    const text = response.text;
    if (!text) return null;
    return safeParseJson<ParsedOrderData>(text);

  } catch (error: any) {
    console.error("Gemini Invoice Error:", error);

    // Fallback to OpenAI if Gemini hits a rate limit or quota issue
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('429') || errorMessage.includes('resource exhausted') || errorMessage.includes('quota') || errorMessage.includes('limit')) {
      console.log('Initiating fallback to OpenAI gpt-4o-mini...');
      try {
        if (!openAiKey) {
          throw new Error('OpenAI API key not configured for fallback.');
        }

        const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'invoice_extraction',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    poNumber: { type: 'string' },
                    vendor: { type: 'string' },
                    orderDate: { type: 'string' },
                    subtotal: { type: 'number' },
                    totalTax: { type: 'number' },
                    shippingCost: { type: 'number' },
                    grandTotal: { type: 'number' },
                    confidence: { type: 'number' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          category: { type: 'string' },
                          sku: { type: 'string' },
                          quantity: { type: 'number' },
                          unitCost: { type: 'number' },
                          packSize: { type: 'string' }
                        },
                        required: ["name", "category", "sku", "quantity", "unitCost", "packSize"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["poNumber", "vendor", "orderDate", "subtotal", "totalTax", "shippingCost", "grandTotal", "confidence", "items"],
                  additionalProperties: false
                }
              }
            },
            messages: [
              {
                role: 'system',
                content: 'You extract medical invoice data directly into the provided strict JSON schema.'
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt + '\n\nOutput only valid JSON.' },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}`, detail: 'high' } }
                ]
              }
            ],
            temperature: 0.1
          })
        });

        if (!openAiResponse.ok) {
          const errText = await openAiResponse.text();
          throw new Error(`OpenAI Fallback failed! Status: ${openAiResponse.status}. Details: ${errText}`);
        }

        const openAiData = await openAiResponse.json();
        const content = openAiData.choices?.[0]?.message?.content;

        if (!content) return null;

        return JSON.parse(content) as ParsedOrderData;

      } catch (fallbackError) {
        console.error("OpenAI Fallback also failed:", fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
};

