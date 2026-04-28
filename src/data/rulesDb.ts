import equipmentItems from "./equipment.json";
import hiredSwords from "./hiredSwords.json";
import ruleReferences from "./ruleReferences.json";
import skillsSeed from "./skills.json";
import sourceDocuments from "./sources.json";
import specialRules from "./specialRules.json";
import carnivalOfChaos from "./warbands/carnival-of-chaos.json";
import mercenaries from "./warbands/mercenaries.json";
import sistersOfSigmar from "./warbands/sisters-of-sigmar.json";
import skaven from "./warbands/skaven.json";
import witchHunters from "./warbands/witch-hunters.json";
import warbandIndexSeed from "./warbandIndex.json";
import { rulesDbSchema, warbandSeedCollectionSchema, warbandSeedSchema } from "../rules/schemas";
import type { RulesDb } from "../rules/types";

const warbandSeeds = [
  warbandSeedSchema.parse(witchHunters),
  warbandSeedSchema.parse(sistersOfSigmar),
  warbandSeedSchema.parse(carnivalOfChaos),
  warbandSeedSchema.parse(skaven)
];
const warbandSeedCollections = [warbandSeedCollectionSchema.parse(mercenaries)];

export const rulesDb: RulesDb = rulesDbSchema.parse({
  sourceDocuments,
  warbandTypes: [
    ...warbandSeeds.map((seed) => seed.warbandType),
    ...warbandSeedCollections.flatMap((seed) => seed.warbandTypes)
  ],
  fighterTypes: [
    ...warbandSeeds.flatMap((seed) => seed.fighterTypes),
    ...warbandSeedCollections.flatMap((seed) => seed.fighterTypes)
  ],
  equipmentItems,
  equipmentLists: [
    ...warbandSeeds.flatMap((seed) => seed.equipmentLists),
    ...warbandSeedCollections.flatMap((seed) => seed.equipmentLists)
  ],
  skillCategories: skillsSeed.categories,
  skills: skillsSeed.skills,
  specialRules,
  hiredSwords,
  ruleReferences
});

export type WarbandIndexRecord = {
  id: string;
  name: string;
  race: string;
  broheimGrade: string;
  broheimGradeLabel: string;
  isOfficial: boolean;
  sourceCode: string;
  sourceUrl: string;
  implementationStatus: "not_started" | "extracted" | "reviewed" | "implemented" | "tested";
};

export const warbandIndex = warbandIndexSeed as {
  sourceUrl: string;
  extractedAt: string;
  warbands: WarbandIndexRecord[];
};
