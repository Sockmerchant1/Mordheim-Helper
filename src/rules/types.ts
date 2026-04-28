import type { z } from "zod";
import type {
  campaignLogEntrySchema,
  equipmentItemSchema,
  equipmentListSchema,
  fighterTypeSchema,
  hiredSwordSchema,
  profileSchema,
  rosterMemberSchema,
  rosterSchema,
  rulesDbSchema,
  skillCategorySchema,
  skillSchema,
  sourceDocumentSchema,
  sourceRefSchema,
  specialRuleSchema,
  validationIssueSchema,
  warbandSeedCollectionSchema,
  warbandSeedSchema,
  warbandTypeSchema
} from "./schemas";

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type WarbandType = z.infer<typeof warbandTypeSchema>;
export type FighterType = z.infer<typeof fighterTypeSchema>;
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type EquipmentList = z.infer<typeof equipmentListSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SpecialRule = z.infer<typeof specialRuleSchema>;
export type HiredSword = z.infer<typeof hiredSwordSchema>;
export type RosterMember = z.infer<typeof rosterMemberSchema>;
export type CampaignLogEntry = z.infer<typeof campaignLogEntrySchema>;
export type Roster = z.infer<typeof rosterSchema>;
export type RulesDb = z.infer<typeof rulesDbSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type WarbandSeed = z.infer<typeof warbandSeedSchema>;
export type WarbandSeedCollection = z.infer<typeof warbandSeedCollectionSchema>;

export type AllowedOption<T> = {
  item: T;
  allowed: boolean;
  reason: string;
  source?: SourceRef;
};

export type WarbandFilter = {
  officialOnly?: boolean;
  broheimGrade?: string;
  sourceCode?: string;
  race?: string;
};
