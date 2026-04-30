import { z } from "zod";

export const sourceDocumentTypeSchema = z.enum([
  "core_rules",
  "warband_pdf",
  "supplement",
  "errata"
]);

export const implementationStatusSchema = z.enum([
  "not_started",
  "extracted",
  "reviewed",
  "implemented",
  "tested"
]);

export const sourceDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  type: sourceDocumentTypeSchema,
  broheimGrade: z.string().optional(),
  notes: z.string().optional()
});

export const sourceRefSchema = z.object({
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url().optional(),
  pageRef: z.string().optional(),
  pageNumber: z.number().optional(),
  label: z.string().optional()
});

export const profileSchema = z.object({
  M: z.number(),
  WS: z.number(),
  BS: z.number(),
  S: z.number(),
  T: z.number(),
  W: z.number(),
  I: z.number(),
  A: z.number(),
  Ld: z.number()
});

export const fighterCategorySchema = z.enum([
  "hero",
  "henchman",
  "hired_sword",
  "dramatis_personae"
]);

export const memberKindSchema = z.enum(["hero", "henchman_group", "hired_sword"]);
export const memberStatusSchema = z.enum(["active", "missing", "dead", "retired"]);

export const equipmentCategorySchema = z.enum([
  "close_combat",
  "missile",
  "armour",
  "miscellaneous",
  "mount",
  "drug",
  "artefact"
]);

export const equipmentValidationSchema = z.object({
  closeCombatSlots: z.number().default(0),
  missileSlots: z.number().default(0),
  isFreeFirstPerWarrior: z.boolean().default(false),
  isBodyArmour: z.boolean().default(false),
  isShield: z.boolean().default(false),
  isHelmet: z.boolean().default(false),
  isBuckler: z.boolean().default(false),
  nonRepeatable: z.boolean().default(false),
  grantsWeaponUse: z.array(z.string()).default([]),
  disallowsOtherWeapons: z.boolean().default(false),
  disallowsOtherEquipment: z.boolean().default(false),
  requiredEquipmentItemIds: z.array(z.string()).default([]),
  costGroupId: z.string().optional(),
  costGroupSubsequentMultiplier: z.number().default(1)
});

const defaultEquipmentValidation = {
  closeCombatSlots: 0,
  missileSlots: 0,
  isFreeFirstPerWarrior: false,
  isBodyArmour: false,
  isShield: false,
  isHelmet: false,
  isBuckler: false,
  nonRepeatable: false,
  grantsWeaponUse: [],
  disallowsOtherWeapons: false,
  disallowsOtherEquipment: false,
  requiredEquipmentItemIds: [],
  costGroupSubsequentMultiplier: 1
};

export const equipmentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: equipmentCategorySchema,
  cost: z.number(),
  rarity: z.string().optional(),
  rulesSummary: z.string(),
  specialRuleIds: z.array(z.string()).default([]),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  pageRef: z.string().optional(),
  restrictions: z.string().optional(),
  validation: equipmentValidationSchema.default(defaultEquipmentValidation)
});

export const equipmentListSchema = z.object({
  id: z.string(),
  name: z.string(),
  warbandTypeId: z.string(),
  allowedEquipmentItemIds: z.array(z.string()),
  appliesToFighterTypeIds: z.array(z.string()),
  notes: z.string().optional()
});

export const skillCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  skillIds: z.array(z.string())
});

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  effectSummary: z.string(),
  restrictions: z.string().optional(),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  pageRef: z.string().optional(),
  relatedRuleIds: z.array(z.string()).default([]),
  validation: z.object({
    allowedFighterTypeIds: z.array(z.string()).default([]),
    requiredSpecialRuleIds: z.array(z.string()).default([])
  }).default({ allowedFighterTypeIds: [], requiredSpecialRuleIds: [] })
});

export const specialRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  effectSummary: z.string(),
  appliesTo: z.string(),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  pageRef: z.string().optional(),
  restrictions: z.string().optional(),
  relatedRuleIds: z.array(z.string()).default([]),
  validation: z.object({
    selectableAs: z.enum(["spell", "prayer", "ritual", "ability"]).optional(),
    allowedFighterTypeIds: z.array(z.string()).default([]),
    requiredSpecialRuleIds: z.array(z.string()).default([])
  }).default({ allowedFighterTypeIds: [], requiredSpecialRuleIds: [] })
});

export const warbandTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  race: z.string(),
  broheimGrade: z.string(),
  sourceCode: z.string(),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  implementationStatus: implementationStatusSchema,
  startingGold: z.number(),
  minWarriors: z.number(),
  maxWarriors: z.number(),
  maxHeroes: z.number(),
  leaderFighterTypeId: z.string(),
  notes: z.string().optional()
});

export const fighterTypeSchema = z.object({
  id: z.string(),
  warbandTypeId: z.string(),
  name: z.string(),
  category: fighterCategorySchema,
  minCount: z.number(),
  maxCount: z.number().nullable(),
  groupMinSize: z.number().nullable(),
  groupMaxSize: z.number().nullable(),
  hireCost: z.number(),
  startingExperience: z.number(),
  profile: profileSchema,
  equipmentListIds: z.array(z.string()),
  skillCategoryIds: z.array(z.string()),
  specialRuleIds: z.array(z.string()),
  canGainExperience: z.boolean(),
  isLargeCreature: z.boolean().default(false),
  ratingOverride: z.number().nullable().optional(),
  notes: z.string().optional(),
  validation: z.object({
    requiredOneOfEquipmentItemIds: z.array(z.string()).default([]),
    warbandMaxWarriorsBonus: z.number().default(0),
    maxCountPerFighterTypeIds: z.array(z.object({
      fighterTypeIds: z.array(z.string()),
      multiplier: z.number(),
      description: z.string().optional()
    })).default([])
  }).default({ requiredOneOfEquipmentItemIds: [], warbandMaxWarriorsBonus: 0, maxCountPerFighterTypeIds: [] }),
  source: sourceRefSchema
});

export const warbandSeedSchema = z.object({
  warbandType: warbandTypeSchema,
  fighterTypes: z.array(fighterTypeSchema),
  equipmentLists: z.array(equipmentListSchema)
});

export const warbandSeedCollectionSchema = z.object({
  warbandTypes: z.array(warbandTypeSchema),
  fighterTypes: z.array(fighterTypeSchema),
  equipmentLists: z.array(equipmentListSchema)
});

export const ruleReferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  ruleCategory: z.string(),
  summary: z.string(),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  pageRef: z.string().optional(),
  validationMetadata: z.record(z.string(), z.unknown()).default({})
});

export const hiredSwordSchema = z.object({
  id: z.string(),
  name: z.string(),
  hireFee: z.number(),
  upkeep: z.number(),
  availabilitySummary: z.string(),
  effectSummary: z.string(),
  sourceDocumentId: z.string(),
  sourceUrl: z.string().url(),
  pageRef: z.string().optional(),
  implementationStatus: implementationStatusSchema,
  allowedWarbandTypeIds: z.array(z.string()).default([]),
  blockedWarbandTypeIds: z.array(z.string()).default([]),
  ratingOverride: z.number().optional(),
  startingExperience: z.number().default(0),
  profile: profileSchema.optional(),
  equipmentItemIds: z.array(z.string()).default([]),
  skillCategoryIds: z.array(z.string()).default([]),
  specialRuleIds: z.array(z.string()).default([]),
  isLargeCreature: z.boolean().default(false),
  notes: z.string().optional()
});

export const rosterMemberSchema = z.object({
  id: z.string(),
  rosterId: z.string().optional(),
  fighterTypeId: z.string(),
  displayName: z.string(),
  kind: memberKindSchema,
  groupSize: z.number(),
  currentProfile: profileSchema,
  startingXp: z.number().optional(),
  currentXp: z.number().optional(),
  experience: z.number(),
  advances: z.array(z.string()).default([]),
  advancesTaken: z.array(z.object({
    id: z.string(),
    xpAt: z.number(),
    result: z.string(),
    date: z.string().optional(),
    notes: z.string().optional()
  })).default([]),
  injuries: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  perModelEquipment: z.array(z.array(z.string())).optional(),
  skills: z.array(z.string()).default([]),
  specialRules: z.array(z.string()).default([]),
  notes: z.string().default(""),
  status: memberStatusSchema
});

export const campaignLogEntrySchema = z.object({
  id: z.string(),
  rosterId: z.string().optional(),
  date: z.string(),
  type: z.enum([
    "battle",
    "post_battle",
    "purchase",
    "sale",
    "injury",
    "advance",
    "income",
    "exploration",
    "note"
  ]),
  description: z.string(),
  goldDelta: z.number().default(0),
  wyrdstoneDelta: z.number().default(0),
  rosterChanges: z.string().default("")
});

export const rosterSchema = z.object({
  id: z.string(),
  name: z.string(),
  warbandTypeId: z.string(),
  treasuryGold: z.number(),
  wyrdstoneShards: z.number(),
  storedEquipment: z.array(z.string()).default([]),
  campaignNotes: z.string().default(""),
  members: z.array(rosterMemberSchema).default([]),
  campaignLog: z.array(campaignLogEntrySchema).default([]),
  claimedCost: z.number().optional(),
  claimedWarbandRating: z.number().optional(),
  isDraft: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const rulesDbSchema = z.object({
  sourceDocuments: z.array(sourceDocumentSchema),
  warbandTypes: z.array(warbandTypeSchema),
  fighterTypes: z.array(fighterTypeSchema),
  equipmentItems: z.array(equipmentItemSchema),
  equipmentLists: z.array(equipmentListSchema),
  skillCategories: z.array(skillCategorySchema),
  skills: z.array(skillSchema),
  specialRules: z.array(specialRuleSchema),
  hiredSwords: z.array(hiredSwordSchema),
  ruleReferences: z.array(ruleReferenceSchema)
});

export const validationIssueSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  code: z.string(),
  message: z.string(),
  detail: z.string(),
  affectedMemberId: z.string().optional(),
  field: z.string().optional(),
  suggestedFix: z.string().optional(),
  source: sourceRefSchema.optional()
});
