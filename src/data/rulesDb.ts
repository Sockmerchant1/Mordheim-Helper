import equipmentItems from "./equipment.json";
import hiredSwords from "./hiredSwords.json";
import ruleReferences from "./ruleReferences.json";
import skillsSeed from "./skills.json";
import sourceDocuments from "./sources.json";
import specialRules from "./specialRules.json";
import carnivalOfChaos from "./warbands/carnival-of-chaos.json";
import mercenaries from "./warbands/mercenaries.json";
import orcMob from "./warbands/orc-mob.json";
import sistersOfSigmar from "./warbands/sisters-of-sigmar.json";
import skaven from "./warbands/skaven.json";
import undead from "./warbands/undead.json";
import witchHunters from "./warbands/witch-hunters.json";
import warbandIndexSeed from "./warbandIndex.json";
import { hiredSwordSchema, rulesDbSchema, warbandSeedCollectionSchema, warbandSeedSchema } from "../rules/schemas";
import type { FighterType, RulesDb } from "../rules/types";

const warbandSeeds = [
  warbandSeedSchema.parse(witchHunters),
  warbandSeedSchema.parse(sistersOfSigmar),
  warbandSeedSchema.parse(carnivalOfChaos),
  warbandSeedSchema.parse(skaven),
  warbandSeedSchema.parse(undead),
  warbandSeedSchema.parse(orcMob)
];
const warbandSeedCollections = [warbandSeedCollectionSchema.parse(mercenaries)];
const parsedHiredSwords = hiredSwordSchema.array().parse(hiredSwords);
const hiredSwordFighterTypes: FighterType[] = parsedHiredSwords
  .filter((hiredSword) => hiredSword.profile)
  .map((hiredSword) => ({
    id: `hired-sword-${hiredSword.id}`,
    warbandTypeId: "hired-swords",
    name: hiredSword.name,
    category: "hired_sword",
    minCount: 0,
    maxCount: 1,
    groupMinSize: null,
    groupMaxSize: null,
    hireCost: hiredSword.hireFee,
    startingExperience: hiredSword.startingExperience,
    profile: hiredSword.profile!,
    equipmentListIds: [],
    skillCategoryIds: hiredSword.skillCategoryIds,
    specialRuleIds: hiredSword.specialRuleIds,
    canGainExperience: true,
    isLargeCreature: hiredSword.isLargeCreature,
    ratingOverride: hiredSword.ratingOverride ?? null,
    notes: [hiredSword.effectSummary, hiredSword.availabilitySummary, hiredSword.notes].filter(Boolean).join(" "),
    validation: {
      requiredOneOfEquipmentItemIds: [],
      warbandMaxWarriorsBonus: 0,
      maxCountPerFighterTypeIds: []
    },
    source: {
      sourceDocumentId: hiredSword.sourceDocumentId,
      sourceUrl: hiredSword.sourceUrl,
      pageRef: hiredSword.pageRef,
      label: hiredSword.name
    }
  }));

export const rulesDb: RulesDb = rulesDbSchema.parse({
  sourceDocuments,
  warbandTypes: [
    ...warbandSeeds.map((seed) => seed.warbandType),
    ...warbandSeedCollections.flatMap((seed) => seed.warbandTypes)
  ],
  fighterTypes: [
    ...warbandSeeds.flatMap((seed) => seed.fighterTypes),
    ...warbandSeedCollections.flatMap((seed) => seed.fighterTypes),
    ...hiredSwordFighterTypes
  ],
  equipmentItems,
  equipmentLists: [
    ...warbandSeeds.flatMap((seed) => seed.equipmentLists),
    ...warbandSeedCollections.flatMap((seed) => seed.equipmentLists)
  ],
  skillCategories: skillsSeed.categories,
  skills: skillsSeed.skills,
  specialRules,
  hiredSwords: parsedHiredSwords,
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
