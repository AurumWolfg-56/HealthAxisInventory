// ═══════════════════════════════════════════════════════════════
// NORVEXIS CORE — CENTRALIZED FEATURE FLAG REGISTRY
// All valid feature flag keys MUST be defined here.
// No flag may exist in code without being registered in this file.
// ═══════════════════════════════════════════════════════════════

/** Module flags: show/hide entire sidebar sections */
export const MODULE_FLAGS = {
  MOD_DASHBOARD:     'mod_dashboard',
  MOD_PROTOCOLS:     'mod_protocols',
  MOD_INVENTORY:     'mod_inventory',
  MOD_INTELLIGENCE:  'mod_intelligence',
  MOD_ORDERS:        'mod_orders',
  MOD_BUDGETS:       'mod_budgets',
  MOD_PRICELIST:     'mod_pricelist',
  MOD_BILLING:       'mod_billing',
  MOD_MEDICAL_CODES: 'mod_medical_codes',
  MOD_FORMS:         'mod_forms',
  MOD_VOICE_MEMOS:   'mod_voice_memos',
  MOD_DAILY_CLOSE:   'mod_daily_close',
  MOD_REPORTS:       'mod_reports',
  MOD_PETTY_CASH:    'mod_petty_cash',
  MOD_SCANNER:       'mod_scanner',
  MOD_SCHEDULE:      'mod_schedule',
} as const;

/** Sub-feature flags: granular control within modules */
export const FEATURE_FLAGS = {
  FEAT_PDF_EXPORT:   'feat_pdf_export',
  FEAT_BUDGET_ROLL:  'feat_budget_autoroll',
  FEAT_AI_DICTATION: 'feat_ai_dictation',
  FEAT_AI_ASSIST:    'feat_ai_clinical_assist',
  FEAT_MULTI_LANG:   'feat_multi_lang',
} as const;

/** Full registry — used for validation and typing */
export const ALL_FLAGS = { ...MODULE_FLAGS, ...FEATURE_FLAGS } as const;
export type FeatureFlagKey = typeof ALL_FLAGS[keyof typeof ALL_FLAGS];

/** Default flags applied to new locations */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  // Modules — all on by default
  mod_dashboard: true,
  mod_protocols: true,
  mod_inventory: true,
  mod_intelligence: true,
  mod_orders: true,
  mod_budgets: true,
  mod_pricelist: true,
  mod_billing: true,
  mod_medical_codes: true,
  mod_forms: true,
  mod_voice_memos: true,
  mod_daily_close: true,
  mod_reports: true,
  mod_petty_cash: true,
  mod_scanner: true,
  mod_schedule: true,
  // Sub-features
  feat_pdf_export: true,
  feat_budget_autoroll: true,
  feat_ai_dictation: false,       // Requires local LM Studio
  feat_ai_clinical_assist: false,  // Requires local LM Studio
  feat_multi_lang: true,
};

/**
 * Resolve feature flags for a location.
 * Merges location's stored flags with defaults (defaults fill missing keys).
 */
export function resolveFeatureFlags(
  locationFlags: Record<string, boolean> | null | undefined
): Record<FeatureFlagKey, boolean> {
  return {
    ...DEFAULT_FEATURE_FLAGS,
    ...(locationFlags ?? {}),
  };
}
