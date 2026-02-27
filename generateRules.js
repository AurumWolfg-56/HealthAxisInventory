const fs = require('fs');

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
    "00147 Routine Venipuncture",
    "00155 ALT (SGPT)",
    "001033 AST (SGOT)",
    "001082 Bilirubin, Direct",
    "001090 Bilirubin, Total",
    "001158 Calcium",
    "001165 Cholesterol, Total",
    "001242 Creatine Kinase (CK)",
    "001289 GGT",
    "001339 Iron",
    "001347 Iron Binding Capacity",
    "001370 LDH",
    "001384 LDL",
    "001453 Lipid Panel",
    "001535 Magnesium, Serum",
    "001634 Phosphorus",
    "001716 Potassium",
    "001856 Protein, Total",
    "002013 Uric Acid",
    "002146 Urine Urinalysis w/ Micro",
    "002161 Urine Microalbumin/Creat Ratio",
    "004126 CBC with Diff & Plt (Path)",
    "004241 CBC without Diff (Path)",
    "004258 WBC",
    "004266 RBC",
    "005009 Urinalysis, Complete w Reflex Culture",
    "005011 Urinalysis w/o Micro",
    "005054 T4 (Thyroxine) Free",
    "006536 Hematocrit",
    "006596 Hemoglobin",
    "006734 Comprehensive Metabolic Panel (CMP)",
    "006841 Basic Metabolic Panel (BMP)",
    "007054 Sodium",
    "007804 TSH High Sensitivity",
    "008624 PSA, Total",
    "008632 PSA, Free and Total",
    "008806 Amylase",
    "008845 Lipase",
    "009215 Microalbumin, Urine",
    "009223 Microalbumin/Creat Ratio, Urine",
    "009264 Thyroid Panel",
    "009280 Ferritin",
    "009942 Uric Acid, Urine",
    "009959 Calcium, Urine",
    "010025 Hepatic Function Panel",
    "010165 Renal Function Panel",
    "010173 Electrolyte Panel",
    "010181 Lipid Panel w/ Chol/HDL Ratio",
    "010215 T3 Uptake",
    "010223 T3, Free",
    "010231 T3, Total",
    "010249 T4, Total",
    "010256 Thyroxine Binding Globulin",
    "010363 hCG, Quantitative",
    "011312 Prolactin",
    "011320 Luteinizing Hormone (LH)",
    "011338 Follicle Stimulating Hormone (FSH)",
    "011379 Estradiol",
    "011411 Progesterone",
    "011452 Testosterone, Total",
    "011460 Testosterone, Free & Total",
    "011585 Vitamin B12",
    "011593 Folic Acid",
    "011684 CEA",
    "011692 CA 125",
    "011700 CA 15-3",
    "011718 CA 19-9",
    "012211 Sed Rate, Westergren",
    "012229 C-Reactive Protein (CRP)",
    "012237 Rheumatoid Factor",
    "012245 ANA",
    "012252 Vitamin D, 25-Hydroxy",
    "012260 Insulin",
    "012278 C-Peptide",
    "012286 Hemoglobin A1c",
    "012294 Glucose",
    "012302 Glucose Serum"
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

let fileContent = `import { BillingRule } from '../types';

export const billingRules: BillingRule[] = [
`;

allRules.forEach((rule, index) => {
    fileContent += `  ${JSON.stringify(rule)}${index < allRules.length - 1 ? ',' : ''}\n`;
});

fileContent += `];\n`;

fs.writeFileSync('r:/APPS/healthaxis-inventory-pwa/data/billingRules.ts', fileContent);
console.log('done');
