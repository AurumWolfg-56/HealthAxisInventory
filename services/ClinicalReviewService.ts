/**
 * Clinical Note Generator
 * Single LLM call: raw dictation → structured CC, HPI, Diagnoses, Plan
 * Optimized for US insurance acceptance and E/M coding.
 */

import { chat, checkConnection } from './LocalAIService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StructuredNote {
  chiefComplaint: string;
  hpi: string;
  diagnoses: string;
  plan: string;
  suggestedCPT: string;
  mdmLevel: string;
  upcodingSuggestions: string[];
  conductAlerts: string[];
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const STRUCTURED_NOTE_PROMPT = `You are a US outpatient/urgent care clinical documentation expert. Take the raw provider dictation and produce properly structured medical documentation.

OUTPUT — Return ONLY valid JSON:

{
  "chiefComplaint": "Brief 1-2 sentence CC using patient's own words when possible",
  "hpi": "Start with patient demographics if mentioned (e.g., 'A 34-year-old male presents with...'). Follow OLDCARTS format: Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity. Include pertinent positives AND negatives. Include ROS elements if mentioned. Use professional medical terminology. Include any exam findings or vitals mentioned.",
  "diagnoses": "Numbered list of diagnoses WITH suggested ICD-10 codes. Format:\\n1. ICD-10 code - Diagnosis description\\n2. ICD-10 code - Diagnosis description\\nUse the most specific and appropriate ICD-10 code for each diagnosis.",
  "plan": "Comprehensive numbered plan organized BY DIAGNOSIS. For EACH diagnosis include:\\n\\n1. [Diagnosis Name - description only, no codes]\\n   a) Medications: drug, dose, route, frequency, duration with rationale\\n   b) Diagnostic workup: labs/imaging with medical necessity justification\\n   c) Non-pharmacological: lifestyle modifications, activity restrictions\\n   d) Patient education: warning signs, when to return to clinic/ER\\n   e) Follow-up: specific timeline and purpose\\n   f) [SUGGESTED] Additional evidence-based interventions commonly recommended for this specific condition that the provider may want to consider based on current clinical guidelines",
  "suggestedCPT": "99213, 99214, or 99215",
  "mdmLevel": "Brief explanation of why this E/M level",
  "upcodingSuggestions": ["If level is 99213, provide 3-5 SPECIFIC suggestions tailored to THIS particular case that could legitimately bring documentation to 99214. These must be relevant to the patient's actual conditions. For example, if patient has URI: 'Document if patient has underlying asthma or COPD that complicates this URI'. NEVER use generic suggestions. If already 99214+, return empty array."],
  "conductAlerts": ["Any clinical logic issues specific to THIS case. Examples: medication interaction concerns, missing safety assessments, incomplete evaluation given the symptoms. Leave empty if none found."]
}

CRITICAL RULES:
1. HPI MUST start with patient demographics (age, sex) if mentioned in dictation
2. HPI must follow OLDCARTS — gold standard for US insurance
3. Diagnoses section: INCLUDE suggested ICD-10 codes with each diagnosis
4. Plan: use diagnosis DESCRIPTION only, NO ICD codes in the plan
5. Plan must be organized BY DIAGNOSIS with complete sub-items
6. For each diagnosis, include [SUGGESTED] items based on CURRENT clinical guidelines for THAT SPECIFIC condition
7. Include pertinent negatives in HPI
8. The plan should be as COMPREHENSIVE as possible
9. upcodingSuggestions must be SPECIFIC to the patient's conditions — never generic
10. Return ONLY valid JSON, no markdown`;

// ─── Main Function ──────────────────────────────────────────────────────────

export async function generateStructuredNote(
  rawDictation: string,
  patientContext: string = "",
  onUpdate?: (partialNote: Partial<StructuredNote>) => void
): Promise<StructuredNote> {
  console.log('[NoteGen] Generating structured note...');

  // Fast pre-check: fail immediately if AI gateway is unreachable
  const { connected } = await checkConnection();
  if (!connected) {
    throw new Error('Cannot connect to Local AI Gateway. Ensure LM Studio and whisper_server.py are running.');
  }
  
  const contextBlock = patientContext ? `\n\nPATIENT CONTEXT:\n${patientContext}` : '';
  let accumulatedJson = '';
  let partialNote: Partial<StructuredNote> = {};

  const response = await chat(
    STRUCTURED_NOTE_PROMPT,
    `RAW DICTATION:\n\n${rawDictation}${contextBlock}`,
    { 
      model: 'fast', 
      temperature: 0.2, 
      maxTokens: 4096,
      stream: !!onUpdate,
      onChunk: (chunk) => {
        accumulatedJson += chunk;
        if (onUpdate) {
            // Rough regex extraction for partial JSON fields
            const extractString = (key: string) => {
                const match = accumulatedJson.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)`));
                return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : undefined;
            };
            const extractArray = (key: string) => {
                const match = accumulatedJson.match(new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`, 's'));
                if (match) {
                    try { return JSON.parse(`[${match[1]}]`); } catch { return []; }
                }
                return undefined;
            };

            partialNote = {
                chiefComplaint: extractString('chiefComplaint') || partialNote.chiefComplaint,
                hpi: extractString('hpi') || partialNote.hpi,
                diagnoses: extractString('diagnoses') || partialNote.diagnoses,
                plan: extractString('plan') || partialNote.plan,
                suggestedCPT: extractString('suggestedCPT') || partialNote.suggestedCPT,
                mdmLevel: extractString('mdmLevel') || partialNote.mdmLevel,
            };
            onUpdate({ ...partialNote });
        }
      }
    }
  );

  let clean = response.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();
  const jsonStart = clean.indexOf('{');
  if (jsonStart > 0) clean = clean.slice(jsonStart);

  try {
    const result = JSON.parse(clean) as StructuredNote;
    console.log(`[NoteGen] ✅ CPT ${result.suggestedCPT}`);
    if (onUpdate) onUpdate(result);
    return result;
  } catch (e) {
    console.error('[NoteGen] JSON parse failed', e);
    // Return best effort from partial Note
    return {
      chiefComplaint: partialNote.chiefComplaint || '',
      hpi: partialNote.hpi || response,
      diagnoses: partialNote.diagnoses || '',
      plan: partialNote.plan || '',
      suggestedCPT: partialNote.suggestedCPT || '99213',
      mdmLevel: partialNote.mdmLevel || 'Review manually',
      upcodingSuggestions: [], conductAlerts: [],
    };
  }
}
