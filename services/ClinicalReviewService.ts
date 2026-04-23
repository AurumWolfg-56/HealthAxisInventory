/**
 * Clinical Note Generator
 * Single LLM call: raw dictation → structured CC, HPI, Diagnoses, Plan
 * Optimized for US insurance acceptance and E/M coding.
 */

import { chat, checkConnection } from './LocalAIService';
import { DictationProtocolService } from './DictationProtocolService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StructuredNote {
  chiefComplaint: string;
  hpi: string;
  objective: string;
  diagnoses: string;
  plan: string;
  suggestedCPT: string;
  mdmLevel: string;
  procedures_performed: string[];
  upcodingSuggestions: string[];
  conductAlerts: string[];
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const getStructuredNotePrompt = (knownProtocols: string[] = []) => `You are a US outpatient/urgent care clinical documentation expert and certified medical coder. Take the raw provider dictation and produce properly structured medical documentation.

OUTPUT — Return ONLY valid JSON:

{
  "chiefComplaint": "Brief 1-2 sentence CC using patient's own words",
  "hpi": "Start with patient demographics ONLY if mentioned. Group symptoms cohesively. Use EXCLUSIVELY advanced professional medical terminology (e.g., erythema, edema, dyspnea, diaphoresis). DO NOT explain medical terms. Explicitly document pertinent negatives if implied. DO NOT write 'not provided' or 'N/A' for missing info; just omit it.",
  "objective": "Physical exam findings. Format as a strict list separated by body system (e.g., '**General:**...', '**HEENT:**...'). If the provider dictates a 'macro' or 'dot phrase' (e.g., 'insert normal neuro macro'), generate a comprehensive, structured normal physical exam for that system. EXTREMELY CONCISE to maximize generation speed.",
  "diagnoses": "Numbered list of diagnoses WITH suggested ICD-10 codes. MUST use line breaks between each diagnosis (e.g., '1. Diagnosis A (ICD)\\n2. Diagnosis B (ICD)'). Extremely concise.",
  "plan": "Numbered plan organized BY DIAGNOSIS. Instead of rigid sub-categories, write a highly condensed bulleted list of actions for each diagnosis (e.g., '• COVID test ordered. • Supportive care with hydration. • Return precautions given.'). Omit any action not performed.",
  "suggestedCPT": "99213, 99214, or 99215",
  "mdmLevel": "Briefly explain why this E/M level was chosen. Explicitly state which 2 of the 3 MDM elements (Problems, Data, Risk) meet or exceed the selected level.",
  "procedures_performed": ["Identify any specific clinical procedures performed during the visit based on the dictation. Return an array of procedure names. Keep it extremely concise. Leave empty if none.${knownProtocols.length > 0 ? ` IMPORTANT: Map any performed procedure to one of these EXACT known protocols if applicable: [${knownProtocols.join(', ')}].` : ''}"],
  "upcodingSuggestions": ["If level is 99213, provide 3-5 concise suggestions to bring it to 99214. If 99214/99215, provide concise tips to defend this level."],
  "conductAlerts": ["CRITICAL MEDICAL/LEGAL RISK ALERTS. If 'Red Flag' symptoms are dictated (e.g., thunderclap headache, chest pain radiating to back), trigger a warning to document a thorough exam or justify ER transfer to prevent malpractice. Leave empty if no high-risk symptoms."]
}

CRITICAL RULES FOR E/M LEVEL (MDM - CPT 2026 Guidelines):
Evaluate Medical Decision Making (MDM) using the "2 out of 3" Rule: Choose the visit level based on the HIGHEST 2 of the 3 MDM elements (Problems, Data, Risk) supported by documentation.

- Level 99213 (Low Complexity): Requires 2 out of 3 of the following:
  * Problems (Low): 2+ minor/self-limited problems, OR 1 stable chronic illness, OR 1 acute uncomplicated illness/injury, OR 1 stable acute illness.
  * Data (Low): Minimal/Low data. (e.g., ordering 1-2 unique tests).
  * Risk (Low): Low risk of morbidity from additional diagnostic testing or treatment.

- Level 99214 (Moderate Complexity): Requires 2 out of 3 of the following:
  * Problems (Moderate): 1+ chronic illnesses with exacerbation/progression/side effects, OR 2+ stable chronic illnesses, OR 1 undiagnosed new problem with uncertain prognosis, OR 1 acute illness with systemic symptoms (Note: Systemic symptoms MUST be severe and affect the whole body, e.g., high fever, severe fatigue. Localized swelling/rash is NOT systemic).
  * Data (Moderate): ORDERING AND/OR REVIEWING 3 OR MORE UNIQUE TESTS equals Moderate Data. Independent interpretation of tests.
  * Risk (Moderate): PRESCRIPTION DRUG MANAGEMENT equals Moderate Risk. Decision regarding minor surgery with identified risk factors.

- Level 99215 (High Complexity): Requires 2 out of 3 of the following:
  * Problems (High): 1+ chronic illnesses with severe exacerbation/progression, OR 1 acute/chronic illness posing a threat to life.
  * Data (High): Extensive data.
  * Risk (High): Drug therapy requiring intensive monitoring for toxicity, decision regarding elective major surgery with identified risk factors.

OTHER CRITICAL RULES:
1. EXTREME CONCISENESS & ZERO FLUFF: Omit any unmentioned details. NEVER use phrases like "not provided", "none prescribed", or "N/A".
2. PROFESSIONAL TONE: Use strict medical terminology. No conversational or layperson terms except in CC.
3. PERTINENT NEGATIVES: Ensure the HPI naturally includes relevant negative findings.
4. ABBREVIATIONS: Recognize standard medical abbreviations (e.g., BID, PRN, c/o, SOB, WNL). Translate conversational abbreviations into formal medical terminology (e.g., 'dyspnea' instead of 'SOB'), but retain universally accepted safe abbreviations (like PRN or BID) in the Plan section.
5. Diagnoses section: INCLUDE suggested ICD-10 codes with each diagnosis.
6. Plan: use diagnosis DESCRIPTION only, NO ICD codes in the plan.
7. Return ONLY valid JSON, no markdown`;

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

  let knownProtocols: string[] = [];
  try {
    const protocols = await DictationProtocolService.fetchAll();
    knownProtocols = protocols.map(p => p.name);
  } catch (e) {
    console.warn('[NoteGen] Failed to fetch known protocols for prompt injection', e);
  }

  const response = await chat(
    getStructuredNotePrompt(knownProtocols),
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
            // More robust regex to match strings containing escaped quotes, stopping at unescaped quotes
            const extractString = (key: string) => {
                const match = accumulatedJson.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)`));
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
                procedures_performed: extractArray('procedures_performed') || partialNote.procedures_performed,
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
      procedures_performed: partialNote.procedures_performed || [],
      upcodingSuggestions: [], conductAlerts: [],
    };
  }
}
