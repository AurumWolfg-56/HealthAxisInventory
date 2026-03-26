/**
 * Clinical Review Service
 * Uses LLM (Qwen 2.5-14B) to extract structured data from clinical notes
 * and generate treatment plans, suggestions, and insurance optimization tips.
 *
 * Pairs with mdmEngine.ts (deterministic scoring) for hybrid accuracy.
 */

import { chat } from './LocalAIService';
import { scoreMDM, type ClinicalData, type MDMResult, type MDMGap } from '../utils/mdmEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClinicalReview {
  clinicalData: ClinicalData;
  mdmResult: MDMResult;
  treatmentPlan: string;
  suggestions: string[];
  logicAlerts: string[];
  insuranceTips: string[];
  isLoading?: boolean;
}

// ─── Step 1: Extract Structured Clinical Data from Free Text ────────────────

const EXTRACTION_PROMPT = `You are a clinical documentation analyzer for a US outpatient/urgent care clinic.
Analyze the clinical note and extract structured data as JSON.

RULES:
- Be conservative: only classify what is explicitly documented
- For problems: classify each diagnosis by type
- For data: only include tests/records explicitly mentioned as ordered or reviewed
- For risk: only flag treatments explicitly documented

Return ONLY valid JSON with this exact structure:
{
  "problems": {
    "items": ["list of problems/diagnoses mentioned"],
    "stableChronicCount": 0,
    "exacerbatedChronicCount": 0,
    "acuteUncomplicated": 0,
    "acuteWithSystemicSymptoms": 0,
    "newUncertainPrognosis": 0,
    "selfLimited": 0,
    "lifeThreatening": false
  },
  "data": {
    "labsOrdered": ["list of labs ordered or reviewed"],
    "imagingOrdered": ["list of imaging ordered or reviewed"],
    "outsideRecordsReviewed": false,
    "independentInterpretation": false,
    "discussionWithExternal": false
  },
  "risk": {
    "treatments": ["list of treatments/medications"],
    "prescriptionDrugManagement": false,
    "ivFluidsOrMedications": false,
    "decisionForHospitalization": false,
    "decisionForSurgery": false,
    "intensiveMonitoring": false,
    "highRiskTreatment": false
  },
  "diagnoses": ["ICD-10 code - description for each diagnosis"],
  "planItems": ["each plan item as documented"],
  "isNewPatient": false
}`;

async function extractClinicalData(note: string): Promise<ClinicalData> {
  const response = await chat(
    EXTRACTION_PROMPT,
    `Clinical Note:\n\n${note}`,
    { model: 'smart', temperature: 0.1, maxTokens: 2048 }
  );

  // Parse JSON from response
  let clean = response.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const jsonStart = clean.indexOf('{');
  if (jsonStart > 0) clean = clean.slice(jsonStart);

  return JSON.parse(clean) as ClinicalData;
}

// ─── Step 2: Generate Treatment Plan + Clinical Suggestions ─────────────────

const PLAN_AND_SUGGESTIONS_PROMPT = `You are an expert US clinical documentation advisor specializing in insurance optimization and E/M coding compliance.

Given a clinical note, its MDM analysis, and gap analysis, generate:

1. **TREATMENT PLAN**: A properly structured, evidence-based treatment plan following current US medical standards. Use clear medical language that maximizes insurance acceptance. Include:
   - Diagnosis-specific treatments with rationale
   - Follow-up timeline
   - Patient education items
   - Referrals if appropriate
   - Red flags / return precautions

2. **LOGIC ALERTS**: Any logical inconsistencies in the assessment/plan (e.g., allergies vs prescribed meds, diagnosis without supporting symptoms, treatment without justification).

3. **UPCODING SUGGESTIONS**: Based on the MDM gaps identified, specific documentation suggestions that could legitimately increase the E/M level. These must be things the provider ACTUALLY did but may have forgotten to document.

4. **INSURANCE TIPS**: Specific language or documentation additions that increase the probability of insurance approval and reduce rejections. Examples:
   - Medical necessity statements
   - Symptom documentation that justifies tests
   - Linking diagnosis to treatment rationale
   - Time-based billing qualifiers if applicable

Return as JSON:
{
  "treatmentPlan": "structured plan text with sections",
  "logicAlerts": ["alert 1", "alert 2"],
  "suggestions": ["upcoding suggestion 1", "suggestion 2"],
  "insuranceTips": ["tip 1", "tip 2"]
}`;

interface ReviewInput {
  note: string;
  mdmResult: MDMResult;
  clinicalData: ClinicalData;
}

async function generateReview(input: ReviewInput): Promise<{
  treatmentPlan: string;
  logicAlerts: string[];
  suggestions: string[];
  insuranceTips: string[];
}> {
  const context = `
CLINICAL NOTE:
${input.note}

MDM ANALYSIS:
- Current Level: ${input.mdmResult.level.toUpperCase()} (${input.mdmResult.cptCode} — ${input.mdmResult.cptDescription})
- Problems: ${input.mdmResult.breakdown.problems.level} — ${input.mdmResult.breakdown.problems.reasoning}
- Data: ${input.mdmResult.breakdown.data.level} — ${input.mdmResult.breakdown.data.reasoning}
- Risk: ${input.mdmResult.breakdown.risk.level} — ${input.mdmResult.breakdown.risk.reasoning}

DIAGNOSES: ${input.clinicalData.diagnoses.join('; ')}
CURRENT PLAN: ${input.clinicalData.planItems.join('; ')}

${input.mdmResult.gaps.length > 0 ? `
DOCUMENTATION GAPS (to reach next level):
${input.mdmResult.gaps.map((g: MDMGap) => `- ${g.element}: currently ${g.currentLevel} → needs ${g.targetLevel}: ${g.suggestion}`).join('\n')}
` : 'No documentation gaps — already at highest documented level.'}`;

  const response = await chat(
    PLAN_AND_SUGGESTIONS_PROMPT,
    context,
    { model: 'smart', temperature: 0.3, maxTokens: 4096 }
  );

  let clean = response.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const jsonStart = clean.indexOf('{');
  if (jsonStart > 0) clean = clean.slice(jsonStart);

  try {
    return JSON.parse(clean);
  } catch {
    // If JSON parsing fails, return the raw text as plan
    return {
      treatmentPlan: response,
      logicAlerts: [],
      suggestions: [],
      insuranceTips: [],
    };
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Full clinical review pipeline:
 * 1. Extract structured data from note (LLM)
 * 2. Score MDM deterministically (rules engine)
 * 3. Generate plan + suggestions (LLM)
 */
export async function performClinicalReview(note: string): Promise<ClinicalReview> {
  console.log('[ClinicalReview] Starting analysis...');

  // Step 1: LLM extracts structured data
  console.log('[ClinicalReview] Step 1: Extracting clinical data...');
  const clinicalData = await extractClinicalData(note);
  console.log('[ClinicalReview] Clinical data extracted:', clinicalData.diagnoses);

  // Step 2: Deterministic MDM scoring
  console.log('[ClinicalReview] Step 2: Scoring MDM...');
  const mdmResult = scoreMDM(clinicalData);
  console.log(`[ClinicalReview] MDM Result: ${mdmResult.cptCode} (${mdmResult.level})`);

  // Step 3: LLM generates plan + suggestions
  console.log('[ClinicalReview] Step 3: Generating clinical review...');
  const review = await generateReview({ note, mdmResult, clinicalData });
  console.log('[ClinicalReview] ✅ Review complete');

  return {
    clinicalData,
    mdmResult,
    treatmentPlan: review.treatmentPlan,
    suggestions: review.suggestions,
    logicAlerts: review.logicAlerts,
    insuranceTips: review.insuranceTips,
  };
}
