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

const STRUCTURED_NOTE_PROMPT = `You are a US outpatient/urgent care clinical documentation expert and certified medical coder. Take the raw provider dictation and produce properly structured medical documentation.

OUTPUT — Return ONLY valid JSON:

{
  "chiefComplaint": "Brief 1-2 sentence CC using patient's own words when possible",
  "hpi": "Start with patient demographics if mentioned (e.g., 'A 34-year-old male presents with...'). Follow OLDCARTS format: Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity. Include pertinent positives AND negatives. Include ROS elements if mentioned. Use professional medical terminology. Include any exam findings or vitals mentioned.",
  "diagnoses": "Numbered list of diagnoses WITH suggested ICD-10 codes. Format:\\n1. ICD-10 code - Diagnosis description\\n2. ICD-10 code - Diagnosis description\\nUse the most specific and appropriate ICD-10 code for each diagnosis.",
  "plan": "Comprehensive numbered plan organized BY DIAGNOSIS. For EACH diagnosis include:\\n\\n1. [Diagnosis Name - description only, no codes]\\n   a) Medications: drug, dose, route, frequency, duration with rationale\\n   b) Diagnostic workup: labs/imaging with medical necessity justification\\n   c) Non-pharmacological: lifestyle modifications, activity restrictions\\n   d) Patient education: warning signs, when to return to clinic/ER\\n   e) Follow-up: specific timeline and purpose\\n   f) [SUGGESTED] Additional evidence-based interventions commonly recommended for this specific condition that the provider may want to consider based on current clinical guidelines",
  "suggestedCPT": "99213, 99214, or 99215",
  "mdmLevel": "Provide a brief explanation of why this E/M level was chosen. You MUST explicitly state which 2 of the 3 MDM elements (Problems, Data, Risk) meet or exceed the selected level.",
  "upcodingSuggestions": ["If level is 99213, provide 3-5 SPECIFIC suggestions tailored to THIS case that could legitimately bring documentation to 99214. If level is 99214 or 99215, provide 3-5 SPECIFIC documentation tips to guarantee the quality of the note and defend this level in an audit (e.g. 'Ensure the specific medical necessity for the antibiotics is explicitly documented to defend Moderate Risk')."],
  "conductAlerts": ["Any clinical logic issues specific to THIS case. Examples: medication interaction concerns, missing safety assessments, incomplete evaluation given the symptoms. Leave empty if none found."]
}

CRITICAL RULES FOR E/M LEVEL (MDM - CPT 2026 Guidelines):
Evaluate Medical Decision Making (MDM) using the "2 out of 3" Rule: Choose the visit level based on the HIGHEST 2 of the 3 MDM elements (Problems, Data, Risk) supported by documentation.

- Level 99213 (Low Complexity): Requires 2 out of 3 of the following:
  * Problems (Low): 2+ minor/self-limited problems, OR 1 stable chronic illness, OR 1 acute uncomplicated illness/injury, OR 1 stable acute illness.
  * Data (Low): Minimal/Low data. (e.g., ordering 1-2 unique tests, or assessing an independent historian).
  * Risk (Low): Low risk of morbidity from additional diagnostic testing or treatment.

- Level 99214 (Moderate Complexity): Requires 2 out of 3 of the following:
  * Problems (Moderate): 1+ chronic illnesses with exacerbation/progression/side effects, OR 2+ stable chronic illnesses, OR 1 undiagnosed new problem with uncertain prognosis, OR 1 acute illness with systemic symptoms, OR 1 acute complicated injury.
  * Data (Moderate): Must meet 1 of 3 categories: (1) Any combination of 3 from: review external notes, review unique tests, order unique tests, independent historian. (2) Independent interpretation of tests. (3) Discussion of management/test with external physician/appropriate source.
  * Risk (Moderate): Prescription drug management, decision regarding minor surgery with identified risk factors, decision regarding elective major surgery without identified risk factors, OR diagnosis/treatment significantly limited by social determinants of health.

- Level 99215 (High Complexity): Requires 2 out of 3 of the following:
  * Problems (High): 1+ chronic illnesses with severe exacerbation/progression, OR 1 acute/chronic illness or injury that poses a threat to life or bodily function.
  * Data (High): Extensive data (Must meet at least 2 of the 3 categories mentioned in Moderate).
  * Risk (High): Drug therapy requiring intensive monitoring for toxicity, decision regarding elective major surgery with identified risk factors, emergency major surgery, decision regarding hospitalization or escalation of hospital-level care, DNR/de-escalate care, parenteral controlled substances.

OTHER CRITICAL RULES:
1. HPI MUST start with patient demographics (age, sex) if mentioned in dictation
2. HPI must follow OLDCARTS — gold standard for US insurance
3. Diagnoses section: INCLUDE suggested ICD-10 codes with each diagnosis
4. Plan: use diagnosis DESCRIPTION only, NO ICD codes in the plan
5. Plan must be organized BY DIAGNOSIS with complete sub-items
6. For each diagnosis, include [SUGGESTED] items based on CURRENT clinical guidelines for THAT SPECIFIC condition
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
