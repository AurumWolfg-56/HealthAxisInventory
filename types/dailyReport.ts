
export interface Insurances {
  medicaid: number;
  bcbs_il: number;
  meridian: number;
  commercial: number;
  medicare: number;
  workersComp: number;
  selfPay: number;
}

export interface Financials {
  methods: {
    cash: number;
    credit: number;
    check: number;
    moneyOrder: number;
  };
  types: {
    billPay: number;
    copay: number;
    selfPay: number;
  };
}

export interface Stats {
  newPts: number;
  estPts: number;
  xrays: number;
}

export interface DailyReportState {
  step: number;
  financials: Financials;
  insurances: Insurances;
  operational: {
    nurseVisits: number;
    providerVisits: Record<string, number>;
  };
  stats: Stats;
  notes: string;
  errors: string[];
}

export interface DailyReport {
  id: string;
  timestamp: string; // ISO String
  author: string;
  financials: Financials;
  insurances: Insurances;
  operational: {
    nurseVisits: number;
    providerVisits: Record<string, number>;
  };
  stats: Stats;
  notes: string;
  totals: {
    revenue: number;
    patients: number;
  };
  isBalanced: boolean;
}

export type DailyReportAction =
  | { type: 'SET_FIN_METHOD'; payload: { key: keyof Financials['methods']; value: number } }
  | { type: 'SET_FIN_TYPE'; payload: { key: keyof Financials['types']; value: number } }
  | { type: 'SET_INSURANCE'; payload: { key: keyof Insurances; value: number } }
  | { type: 'SET_OP_NURSE'; payload: number }
  | { type: 'SET_OP_PROVIDER'; payload: { id: string; value: number } }
  | { type: 'REMOVE_OP_PROVIDER'; payload: string }
  | { type: 'SET_STAT'; payload: { key: keyof Stats; value: number } }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'VALIDATE_AND_SET_ERRORS'; payload: string[] }
  | { type: 'LOAD_DATA'; payload: Partial<DailyReportState> };
