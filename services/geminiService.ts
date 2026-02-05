import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini with Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

// Predefined categories for intelligent matching
export const INVENTORY_CATEGORIES = [
  'Surgical', 'Pharma', 'PPE', 'Diagnostics', 'Laboratory',
  'Wound Care', 'Respiratory', 'Cardiovascular', 'Orthopedic',
  'Consumables', 'Equipment', 'Office Supplies'
];

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
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return JSON.parse(text) as ScannedItemData;

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
    return JSON.parse(text);

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
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return { intent: "UNKNOWN", item: "", quantity: 0 };
    return JSON.parse(resultText);

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
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as ParsedOrderData;

  } catch (error) {
    console.error("Gemini Invoice Error:", error);
    throw error;
  }
};

