import fs from 'fs';

const oldRules = [
    { id: "br_1", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "Strep Test", cpt: "87880", billToClient: true },
    { id: "br_2", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "Influenza", cpt: "87804", billToClient: true },
    { id: "br_3", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "Urinalysis (UA)", cpt: "81003", billToClient: true },
    { id: "br_4", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "HbA1c", cpt: "83036", billToClient: true },
    { id: "br_5", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "Pregnancy", cpt: "81025", billToClient: true },
    { id: "br_6", insurers: ["Medicare", "Medicaid", "UHC", "BCBS", "Aetna", "Cigna", "Meridian"], testName: "Mono Spot", cpt: "86308", billToClient: true },
    { id: "br_7", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "CBC", cpt: "85025", billToClient: true },
    { id: "br_8", insurers: ["BCBS", "Aetna", "Cigna"], testName: "CMP (Comprehensive)", cpt: "80053", billToClient: true },
    { id: "br_9", insurers: ["Meridian"], testName: "CMP (Comprehensive) QW", cpt: "80053-QW", billToClient: true },
    { id: "br_10", insurers: ["BCBS", "Aetna", "Cigna"], testName: "Lipid Panel", cpt: "80061", billToClient: true },
    { id: "br_11", insurers: ["Meridian"], testName: "Lipid Panel QW", cpt: "80061-QW", billToClient: true },
    { id: "br_12", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "General Health Panel", cpt: "80050", billToClient: true },
    { id: "br_13", insurers: ["BCBS", "Aetna", "Cigna"], testName: "TSH", cpt: "84443", billToClient: true },
    { id: "br_14", insurers: ["Meridian"], testName: "TSH QW", cpt: "84443-QW", billToClient: true },
    { id: "br_15", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "T3 Total", cpt: "84481", billToClient: true },
    { id: "br_16", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "T4 Free", cpt: "84439", billToClient: true },
    { id: "br_17", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "FSH", cpt: "83001", billToClient: true },
    { id: "br_18", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "PSA Total", cpt: "84153", billToClient: true },
    { id: "br_19", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "GGT", cpt: "82977", billToClient: true },
    { id: "br_20", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "Vitamin B12", cpt: "82607", billToClient: true },
    { id: "br_21", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "Folate", cpt: "82746", billToClient: true },
    { id: "br_22", insurers: ["BCBS", "Aetna", "Cigna", "Meridian"], testName: "Urine Culture", cpt: "87086", billToClient: true },
    { id: "br_23", insurers: ["Meridian"], testName: "Sedimentation Rate", cpt: "85652", billToClient: true },
    { id: "br_24", insurers: ["Meridian"], testName: "Vitamin D, 25-Hydroxy", cpt: "82306", billToClient: true }
];

const big4 = ["BCBS", "Aetna", "Cigna", "Meridian"];

// unify existing rules
const unifiedOld = oldRules.map(r => {
    const newInsurers = new Set(r.insurers);
    big4.forEach(i => newInsurers.add(i));
    return { ...r, insurers: Array.from(newInsurers) };
});

const rawNew = [
    "85027 CBC without Diff (Path)",
    "85025 CBC with Diff & Plt (Path)",
    "85048 WBC",
    "85041 RBC",
    "81001 Urinalysis, Complete w Reflex Culture",
    "81003 Urinalysis w/o Micro",
    "84439 T4 (Thyroxine) Free",
    "85014 Hematocrit",
    "85018 Hemoglobin",
    "80053 Comprehensive Metabolic Panel (CMP)",
    "80048 Basic Metabolic Panel (BMP)",
    "84295 Sodium",
    "84443 TSH High Sensitivity",
    "84153 PSA, Total",
    "84154 PSA, Free and Total",
    "82150 Amylase",
    "83690 Lipase",
    "82043 Microalbumin, Urine",
    "82043 Microalbumin/Creat Ratio, Urine", // Note: 82043 is microalbumin; typically ordered with creat
    "80050 Thyroid Panel", // Note: General Health usually uses 80050, Thyroid may vary but assigning unique names
    "82728 Ferritin",
    "84560 Uric Acid, Urine",
    "82340 Calcium, Urine",
    "80076 Hepatic Function Panel",
    "80069 Renal Function Panel",
    "80051 Electrolyte Panel",
    "80061 Lipid Panel w/ Chol/HDL Ratio",
    "84479 T3 Uptake",
    "84481 T3, Free",
    "84480 T3, Total",
    "84436 T4, Total",
    "84442 Thyroxine Binding Globulin",
    "84702 hCG, Quantitative",
    "84146 Prolactin",
    "83002 Luteinizing Hormone (LH)",
    "83001 Follicle Stimulating Hormone (FSH)",
    "82670 Estradiol",
    "84144 Progesterone",
    "84403 Testosterone, Total",
    "84402 Testosterone, Free & Total",
    "82607 Vitamin B12",
    "82746 Folic Acid",
    "82378 CEA",
    "86304 CA 125",
    "86300 CA 15-3",
    "86301 CA 19-9",
    "85651 Sed Rate, Westergren",
    "86140 C-Reactive Protein (CRP)",
    "86431 Rheumatoid Factor",
    "86038 ANA",
    "82306 Vitamin D, 25-Hydroxy",
    "83525 Insulin",
    "84681 C-Peptide",
    "83036 Hemoglobin A1c",
    "82947 Glucose",
    "82962 Glucose Serum",
    "36415 Routine Venipuncture",
    "84460 ALT (SGPT)",
    "84450 AST (SGOT)",
    "82248 Bilirubin, Direct",
    "82247 Bilirubin, Total",
    "82310 Calcium",
    "82465 Cholesterol, Total",
    "82550 Creatine Kinase (CK)",
    "82977 GGT",
    "83540 Iron",
    "83550 Iron Binding Capacity",
    "83615 LDH",
    "83721 LDL",
    "80061 Lipid Panel",
    "83735 Magnesium, Serum",
    "84100 Phosphorus",
    "84132 Potassium",
    "84155 Protein, Total",
    "84550 Uric Acid",
    "81015 Urine Urinalysis w/ Micro",
    "82043 Urine Microalbumin/Creat Ratio"
];

let idCounter = 100;
const newRules = rawNew.map(line => {
    const spaceIndex = line.indexOf(' ');
    const code = line.substring(0, spaceIndex);
    const test = line.substring(spaceIndex + 1);

    return {
        id: `br_${idCounter++}`,
        insurers: big4,
        testName: test,
        cpt: code,
        billToClient: true
    };
});

const allRules = [...unifiedOld, ...newRules];

// deduplicate by CPT
const uniqueRulesMap = new Map();
for (const r of allRules) {
    if (!uniqueRulesMap.has(r.cpt)) {
        uniqueRulesMap.set(r.cpt, r);
    }
}
const uniqueRulesArr = Array.from(uniqueRulesMap.values());

let fileContent = `
import { BillingRule } from '../types';

export const billingRules: BillingRule[] = [
`;

uniqueRulesArr.forEach((rule, index) => {
    fileContent += `  ${JSON.stringify(rule)}${index < uniqueRulesArr.length - 1 ? ',' : ''}\n`;
});

fileContent += `];\n`;

fs.writeFileSync('r:/APPS/healthaxis-inventory-pwa/data/billingRules.ts', fileContent);
console.log('done');
