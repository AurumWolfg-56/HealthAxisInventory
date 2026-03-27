/**
 * Clinical Note Generator
 * Single LLM call: raw dictation → structured CC, HPI, Diagnoses, Plan
 * Optimized for US insurance acceptance and E/M coding.
 */

import { chat } from './LocalAIService';

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
  "hpi": "OLDCARTS-structured HPI paragraph. Include: Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity. Include pertinent positives AND negatives. Include ROS elements if mentioned. Use professional medical terminology.",
  "diagnoses": "Numbered list of diagnoses with ICD-10 codes. Format:\\n1. ICD-10 - Diagnosis name\\n2. ICD-10 - Diagnosis name",
  "plan": "Comprehensive numbered plan organized BY DIAGNOSIS. For EACH diagnosis include:\\n\\n1. [Diagnosis Name]\\n   a) Medications: drug, dose, route, frequency, duration with rationale\\n   b) Diagnostic workup: labs/imaging to order with medical necessity\\n   c) Non-pharmacological: lifestyle modifications, activity restrictions\\n   d) Patient education: warning signs, when to return\\n   e) Follow-up: specific timeline and purpose\\n   f) SUGGESTED additional measures (mark as [SUGGESTED]): evidence-based interventions commonly done for this condition that the provider may want to consider\\n\\n2. [Next Diagnosis]\\n   ... same structure",
  "suggestedCPT": "99213, 99214, or 99215",
  "mdmLevel": "Brief explanation: e.g. 'Moderate: 1 chronic exacerbation + Rx management'",
  "upcodingSuggestions": ["IF the level is 99213, provide specific actionable suggestions for documentation that would legitimately bring it to 99214. Examples: 'Document review of outside records', 'Document independent interpretation of lab results', 'If patient has a second chronic condition, document its current status'. Leave empty array if already 99214+"],
  "conductAlerts": ["Any logical inconsistencies in the clinical plan. Examples: 'Antibiotic prescribed but no documented infection source', 'NSAID prescribed to patient with documented GI history - consider GI protection', 'No allergy check documented before new prescription'. Leave empty if no issues found."]
}

CRITICAL RULES:
1. HPI must follow OLDCARTS — gold standard for US insurance
2. Diagnoses section is SEPARATE from the plan — list ALL diagnoses with ICD-10
3. Plan must be organized BY DIAGNOSIS with complete sub-items
4. For each diagnosis, include [SUGGESTED] items the provider may want to add based on current medical guidelines
5. Include pertinent negatives in HPI
6. Use medical necessity language to justify tests/treatments
7. The plan should be as COMPREHENSIVE as possible — better to suggest too much than too little
8. If level is 99213, upcodingSuggestions MUST contain actionable items to reach 99214
9. conductAlerts should flag any medical logic errors or missing safety checks
10. Return ONLY valid JSON`;

// ─── Main Function ──────────────────────────────────────────────────────────

export async function generateStructuredNote(rawDictation: string): Promise<StructuredNote> {
  console.log('[NoteGen] Generating structured note...');
  
  const response = await chat(
    STRUCTURED_NOTE_PROMPT,
    `RAW DICTATION:\n\n${rawDictation}`,
    { model: 'fast', temperature: 0.2, maxTokens: 4096 }
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
    return result;
  } catch {
    console.error('[NoteGen] JSON parse failed');
    return {
      chiefComplaint: '', hpi: response, diagnoses: '', plan: '',
      suggestedCPT: '99213', mdmLevel: 'Review manually',
      upcodingSuggestions: [], conductAlerts: [],
    };
  }
}
