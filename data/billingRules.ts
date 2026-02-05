
import { BillingRule } from '../types';

export const billingRules: BillingRule[] = [
  { "id": "br_1", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Strep Test", "cpt": "87880", "billToClient": true },
  { "id": "br_2", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Influenza", "cpt": "87804", "billToClient": true },
  { "id": "br_3", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Urinalysis (UA)", "cpt": "81003", "billToClient": true },
  { "id": "br_4", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "HbA1c", "cpt": "83036", "billToClient": true },
  { "id": "br_5", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Pregnancy", "cpt": "81025", "billToClient": true },
  { "id": "br_6", "insurers": ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Mono Spot", "cpt": "86308", "billToClient": true },
  { "id": "br_7", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "CBC", "cpt": "85025", "billToClient": true },
  { "id": "br_8", "insurers": ["BCBS", "Aetna", "Cigna"], "testName": "CMP (Comprehensive)", "cpt": "80053", "billToClient": true },
  { "id": "br_9", "insurers": ["Meridian"], "testName": "CMP (Comprehensive) QW", "cpt": "80053-QW", "billToClient": true },
  { "id": "br_10", "insurers": ["BCBS", "Aetna", "Cigna"], "testName": "Lipid Panel", "cpt": "80061", "billToClient": true },
  { "id": "br_11", "insurers": ["Meridian"], "testName": "Lipid Panel QW", "cpt": "80061-QW", "billToClient": true },
  { "id": "br_12", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "General Health Panel", "cpt": "80050", "billToClient": true },
  { "id": "br_13", "insurers": ["BCBS", "Aetna", "Cigna"], "testName": "TSH", "cpt": "84443", "billToClient": true },
  { "id": "br_14", "insurers": ["Meridian"], "testName": "TSH QW", "cpt": "84443-QW", "billToClient": true },
  { "id": "br_15", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "T3 Total", "cpt": "84481", "billToClient": true },
  { "id": "br_16", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "T4 Free", "cpt": "84439", "billToClient": true },
  { "id": "br_17", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "FSH", "cpt": "83001", "billToClient": true },
  { "id": "br_18", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "PSA Total", "cpt": "84153", "billToClient": true },
  { "id": "br_19", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "GGT", "cpt": "82977", "billToClient": true },
  { "id": "br_20", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Vitamin B12", "cpt": "82607", "billToClient": true },
  { "id": "br_21", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Folate", "cpt": "82746", "billToClient": true },
  { "id": "br_22", "insurers": ["BCBS", "Aetna", "Cigna", "Meridian"], "testName": "Urine Culture", "cpt": "87086", "billToClient": true },
  { "id": "br_23", "insurers": ["Meridian"], "testName": "Sedimentation Rate", "cpt": "85652", "billToClient": true },
  { "id": "br_24", "insurers": ["Meridian"], "testName": "Vitamin D, 25-Hydroxy", "cpt": "82306", "billToClient": true }
];
