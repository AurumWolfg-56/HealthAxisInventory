/**
 * MDM Engine — CPT 2026 E/M Level Scoring
 * Deterministic rules engine for Medical Decision Making.
 * NO LLM involved — pure TypeScript for auditability.
 *
 * Based on AMA CPT 2026 Office Visit E/M Guidelines:
 *   Level = highest 2 of 3 elements (Problems, Data, Risk)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type MDMLevel = 'straightforward' | 'low' | 'moderate' | 'high';

export interface ClinicalData {
  problems: {
    items: string[];
    /** LLM-classified: how many/what type of problems documented */
    stableChronicCount: number;
    exacerbatedChronicCount: number;
    acuteUncomplicated: number;
    acuteWithSystemicSymptoms: number;
    newUncertainPrognosis: number;
    selfLimited: number;
    lifeThreatening: boolean;
  };
  data: {
    labsOrdered: string[];
    imagingOrdered: string[];
    outsideRecordsReviewed: boolean;
    independentInterpretation: boolean;
    discussionWithExternal: boolean;
  };
  risk: {
    treatments: string[];
    prescriptionDrugManagement: boolean;
    ivFluidsOrMedications: boolean;
    decisionForHospitalization: boolean;
    decisionForSurgery: boolean;
    intensiveMonitoring: boolean;
    highRiskTreatment: boolean;
  };
  diagnoses: string[];
  planItems: string[];
  isNewPatient: boolean;
}

export interface MDMResult {
  level: MDMLevel;
  cptCode: string;
  cptDescription: string;
  breakdown: {
    problems: { level: MDMLevel; reasoning: string };
    data: { level: MDMLevel; reasoning: string };
    risk: { level: MDMLevel; reasoning: string };
  };
  gaps: MDMGap[];
}

export interface MDMGap {
  targetLevel: MDMLevel;
  targetCPT: string;
  element: 'problems' | 'data' | 'risk';
  currentLevel: MDMLevel;
  suggestion: string;
}

// ─── Level Numeric Mapping ──────────────────────────────────────────────────

const LEVEL_ORDER: Record<MDMLevel, number> = {
  straightforward: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

const LEVEL_FROM_NUM: MDMLevel[] = ['straightforward', 'low', 'moderate', 'high'];

// ─── CPT Code Mapping ──────────────────────────────────────────────────────

const CPT_CODES: Record<string, Record<MDMLevel, { code: string; desc: string }>> = {
  established: {
    straightforward: { code: '99212', desc: 'Established, Straightforward' },
    low: { code: '99213', desc: 'Established, Low Complexity' },
    moderate: { code: '99214', desc: 'Established, Moderate Complexity' },
    high: { code: '99215', desc: 'Established, High Complexity' },
  },
  new: {
    straightforward: { code: '99202', desc: 'New Patient, Straightforward' },
    low: { code: '99203', desc: 'New Patient, Low Complexity' },
    moderate: { code: '99204', desc: 'New Patient, Moderate Complexity' },
    high: { code: '99205', desc: 'New Patient, High Complexity' },
  },
};

// ─── Scoring Functions ──────────────────────────────────────────────────────

function scoreProblems(data: ClinicalData['problems']): { level: MDMLevel; reasoning: string } {
  if (data.lifeThreatening) {
    return { level: 'high', reasoning: 'Life-threatening condition or threat to bodily function' };
  }

  if (data.acuteWithSystemicSymptoms > 0) {
    return { level: 'moderate', reasoning: `${data.acuteWithSystemicSymptoms} acute illness with systemic symptoms` };
  }
  if (data.newUncertainPrognosis > 0) {
    return { level: 'moderate', reasoning: `${data.newUncertainPrognosis} new problem with uncertain prognosis` };
  }
  if (data.exacerbatedChronicCount > 0) {
    return { level: 'moderate', reasoning: `${data.exacerbatedChronicCount} chronic illness with exacerbation` };
  }
  if (data.stableChronicCount >= 2) {
    return { level: 'moderate', reasoning: `${data.stableChronicCount} stable chronic conditions (≥2)` };
  }

  if (data.acuteUncomplicated > 0) {
    return { level: 'low', reasoning: `${data.acuteUncomplicated} uncomplicated acute illness` };
  }
  if (data.stableChronicCount === 1) {
    return { level: 'low', reasoning: '1 stable chronic illness' };
  }

  if (data.selfLimited > 0) {
    return { level: 'straightforward', reasoning: `${data.selfLimited} minor/self-limited problem(s)` };
  }

  return { level: 'straightforward', reasoning: 'No significant problems documented' };
}

function scoreData(data: ClinicalData['data']): { level: MDMLevel; reasoning: string } {
  const reasons: string[] = [];
  let categories = 0;

  if (data.labsOrdered.length > 0) { categories++; reasons.push(`Labs: ${data.labsOrdered.join(', ')}`); }
  if (data.imagingOrdered.length > 0) { categories++; reasons.push(`Imaging: ${data.imagingOrdered.join(', ')}`); }
  if (data.outsideRecordsReviewed) { categories++; reasons.push('Outside records reviewed'); }
  if (data.independentInterpretation) { categories++; reasons.push('Independent interpretation of data'); }
  if (data.discussionWithExternal) { categories++; reasons.push('Discussion with external provider/source'); }

  if (categories >= 3) {
    return { level: 'high', reasoning: `Extensive data from ${categories} categories: ${reasons.join('; ')}` };
  }
  if (data.independentInterpretation || data.discussionWithExternal || categories >= 2) {
    return { level: 'moderate', reasoning: `Multiple data points: ${reasons.join('; ')}` };
  }
  if (categories >= 1) {
    return { level: 'low', reasoning: `Limited data: ${reasons.join('; ')}` };
  }

  return { level: 'straightforward', reasoning: 'Minimal or no data reviewed/ordered' };
}

function scoreRisk(data: ClinicalData['risk']): { level: MDMLevel; reasoning: string } {
  if (data.highRiskTreatment || data.decisionForSurgery) {
    return { level: 'high', reasoning: 'High-risk treatment or decision for surgery' };
  }
  if (data.intensiveMonitoring) {
    return { level: 'high', reasoning: 'Intensive monitoring for drug toxicity' };
  }
  if (data.decisionForHospitalization) {
    return { level: 'high', reasoning: 'Decision for hospitalization' };
  }

  if (data.prescriptionDrugManagement) {
    return { level: 'moderate', reasoning: 'Prescription drug management' };
  }
  if (data.ivFluidsOrMedications) {
    return { level: 'moderate', reasoning: 'IV fluids or medications administered' };
  }

  if (data.treatments.length > 0) {
    return { level: 'low', reasoning: `Low-risk treatment: ${data.treatments.slice(0, 3).join(', ')}` };
  }

  return { level: 'straightforward', reasoning: 'Minimal treatment or management' };
}

// ─── Gap Analysis ───────────────────────────────────────────────────────────

function findGaps(
  current: MDMResult['breakdown'],
  currentLevel: MDMLevel,
  data: ClinicalData
): MDMGap[] {
  const gaps: MDMGap[] = [];
  const currentNum = LEVEL_ORDER[currentLevel];

  // Only suggest upcoding by one level
  if (currentNum >= 3) return gaps; // Already at HIGH

  const targetLevel = LEVEL_FROM_NUM[currentNum + 1];
  const patientType = data.isNewPatient ? 'new' : 'established';
  const targetCPT = CPT_CODES[patientType][targetLevel].code;

  // Check which elements need bumping
  if (LEVEL_ORDER[current.problems.level] < LEVEL_ORDER[targetLevel]) {
    const suggestions: Record<MDMLevel, string> = {
      straightforward: '',
      low: 'Document if patient has a chronic condition (e.g., HTN, DM, asthma) to classify as Low complexity',
      moderate: 'Document exacerbation of a chronic condition, or add a second chronic diagnosis, or document systemic symptoms to qualify for Moderate',
      high: 'Document if the condition is life-threatening or poses a threat to bodily function',
    };
    gaps.push({
      targetLevel, targetCPT, element: 'problems',
      currentLevel: current.problems.level,
      suggestion: suggestions[targetLevel],
    });
  }

  if (LEVEL_ORDER[current.data.level] < LEVEL_ORDER[targetLevel]) {
    const suggestions: Record<MDMLevel, string> = {
      straightforward: '',
      low: 'Order or review at least one lab/test and document it',
      moderate: 'Document independent interpretation of test results, review of external records, or order tests from 2+ categories',
      high: 'Document extensive data review from multiple categories (labs, imaging, external records)',
    };
    gaps.push({
      targetLevel, targetCPT, element: 'data',
      currentLevel: current.data.level,
      suggestion: suggestions[targetLevel],
    });
  }

  if (LEVEL_ORDER[current.risk.level] < LEVEL_ORDER[targetLevel]) {
    const suggestions: Record<MDMLevel, string> = {
      straightforward: '',
      low: 'Document any treatment or management plan',
      moderate: 'Document prescription drug management (new or continued Rx) or IV fluid/medication administration',
      high: 'Document decision for hospitalization, high-risk treatment, or intensive monitoring',
    };
    gaps.push({
      targetLevel, targetCPT, element: 'risk',
      currentLevel: current.risk.level,
      suggestion: suggestions[targetLevel],
    });
  }

  return gaps;
}

// ─── Main Scoring Function ──────────────────────────────────────────────────

export function scoreMDM(data: ClinicalData): MDMResult {
  const problems = scoreProblems(data.problems);
  const dataScore = scoreData(data.data);
  const risk = scoreRisk(data.risk);

  // 2-of-3 rule: E/M level = second highest of the 3 elements
  const levels = [
    LEVEL_ORDER[problems.level],
    LEVEL_ORDER[dataScore.level],
    LEVEL_ORDER[risk.level],
  ].sort((a, b) => b - a); // descending

  const effectiveLevel = LEVEL_FROM_NUM[levels[1]]; // second highest

  const patientType = data.isNewPatient ? 'new' : 'established';
  const cpt = CPT_CODES[patientType][effectiveLevel];

  const breakdown = { problems, data: dataScore, risk };
  const gaps = findGaps(breakdown, effectiveLevel, data);

  return {
    level: effectiveLevel,
    cptCode: cpt.code,
    cptDescription: cpt.desc,
    breakdown,
    gaps,
  };
}
