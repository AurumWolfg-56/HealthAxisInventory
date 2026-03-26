/**
 * Clinical Note Generator
 * Single LLM call: raw dictation → structured CC, HPI, Plan
 * Optimized for US insurance acceptance and E/M coding.
 * 
 * Uses the fast model (Llama 3.1 8B) for speed.
 */

import { chat } from './LocalAIService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StructuredNote {
  chiefComplaint: string;
  hpi: string;
  plan: string;
  suggestedCPT: string;
  mdmLevel: string;
  insuranceTips: string[];
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const STRUCTURED_NOTE_PROMPT = `You are a US outpatient/urgent care clinical documentation expert. Your job is to take a raw provider dictation and produce properly structured medical documentation sections optimized for insurance approval and E/M coding compliance.

OUTPUT FORMAT — Return ONLY valid JSON with these exact fields:

{
  "chiefComplaint": "Brief 1-2 sentence CC using the patient's own words when possible",
  "hpi": "Properly structured HPI paragraph following OLDCARTS format (Onset, Location, Duration, Character, Aggravating factors, Relieving factors, Timing, Severity). Include pertinent positives AND negatives. Use professional medical terminology. Include ROS elements if mentioned in the dictation.",
  "plan": "Numbered treatment plan. Each item should include:\\n1. Diagnosis with ICD-10 code\\n   - Treatment/intervention with medical necessity justification\\n   - Follow-up instructions\\n2. Next diagnosis...\\nInclude: medications (dose, route, frequency, duration), referrals, patient education, return precautions, and follow-up timeline.",
  "suggestedCPT": "99213, 99214, or 99215 based on documented complexity",
  "mdmLevel": "Brief 1-line explanation of why this E/M level (e.g., 'Moderate: 1 chronic exacerbation + Rx management')",
  "insuranceTips": ["Specific tips to improve this note's insurance acceptance, if any"]
}

CRITICAL RULES:
1. HPI must follow OLDCARTS structure — this is the gold standard for insurance acceptance
2. Plan must link each diagnosis to its treatment with medical necessity language
3. Use ICD-10 codes in the plan (e.g., "J06.9 - Acute upper respiratory infection")
4. Include pertinent negatives in HPI (e.g., "Denies chest pain, shortness of breath")
5. If the dictation mentions vital signs, exam findings, or test results, weave them into the HPI
6. The plan should reflect current US medical practice guidelines
7. Keep language professional but clear — avoid overly complex jargon
8. Return ONLY the JSON, no markdown, no explanations`;

// ─── Main Function ──────────────────────────────────────────────────────────

export async function generateStructuredNote(rawDictation: string): Promise<StructuredNote> {
  console.log('[NoteGen] Generating structured note from dictation...');
  
  const response = await chat(
    STRUCTURED_NOTE_PROMPT,
    `RAW DICTATION:\n\n${rawDictation}`,
    { model: 'fast', temperature: 0.2, maxTokens: 4096 }
  );

  // Parse JSON
  let clean = response.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const jsonStart = clean.indexOf('{');
  if (jsonStart > 0) clean = clean.slice(jsonStart);

  try {
    const result = JSON.parse(clean) as StructuredNote;
    console.log(`[NoteGen] ✅ Generated: CPT ${result.suggestedCPT}`);
    return result;
  } catch (err) {
    console.error('[NoteGen] JSON parse failed, returning raw sections');
    return {
      chiefComplaint: '',
      hpi: response,
      plan: '',
      suggestedCPT: '99213',
      mdmLevel: 'Unable to determine — review manually',
      insuranceTips: [],
    };
  }
}
