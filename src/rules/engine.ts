import type {
  AllowedOption,
  EquipmentItem,
  FighterType,
  Roster,
  RosterMember,
  RulesDb,
  Skill,
  SourceRef,
  SpecialRule,
  ValidationIssue,
  WarbandFilter,
  WarbandType
} from "./types";

export const DEFAULT_MORDHEIM_ADVANCE_THRESHOLDS = [
  2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 55, 60, 65, 70, 75,
  80, 90
];

const HERO_ADVANCE_XP = DEFAULT_MORDHEIM_ADVANCE_THRESHOLDS;

export function getPendingAdvances(previousXp: number, newXp: number, thresholds = DEFAULT_MORDHEIM_ADVANCE_THRESHOLDS): number[] {
  return thresholds.filter((threshold) => previousXp < threshold && newXp >= threshold);
}

export function getAllowedWarbands(rulesDb: RulesDb, filters: WarbandFilter = {}): WarbandType[] {
  return rulesDb.warbandTypes.filter((warband) => {
    if (filters.officialOnly && warband.broheimGrade !== "1a") return false;
    if (filters.broheimGrade && warband.broheimGrade !== filters.broheimGrade) return false;
    if (filters.sourceCode && warband.sourceCode !== filters.sourceCode) return false;
    if (filters.race && warband.race !== filters.race) return false;
    return true;
  });
}

export function getAllowedFighterTypes(
  warbandTypeId: string,
  roster: Roster,
  rulesDb: RulesDb
): FighterType[] {
  const warband = findWarband(rulesDb, warbandTypeId);
  if (!warband) return [];

  const activeMembers = rosterMembersInWarband(roster, rulesDb);
  const currentHeroCount = activeMembers.filter((member) => {
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    return fighterType?.category === "hero";
  }).length;

  return rulesDb.fighterTypes.filter((fighterType) => {
    if (fighterType.warbandTypeId !== warbandTypeId) return false;

    const currentCount = countFighterType(roster, fighterType.id, rulesDb);
    if (fighterType.maxCount !== null && currentCount >= fighterType.maxCount) return false;
    if (fighterType.category === "hero" && currentHeroCount >= warband.maxHeroes) return false;

    return true;
  });
}

export function getAllowedEquipment(
  member: RosterMember,
  roster: Roster,
  rulesDb: RulesDb
): AllowedOption<EquipmentItem>[] {
  return rulesDb.equipmentItems.map((item) => equipmentOptionFor(item, member, roster, rulesDb));
}

export function getAllowedSkills(
  member: RosterMember,
  roster: Roster,
  rulesDb: RulesDb
): AllowedOption<Skill>[] {
  const fighterType = findFighterType(rulesDb, member.fighterTypeId);
  const warband = fighterType ? findWarband(rulesDb, fighterType.warbandTypeId) : undefined;

  return rulesDb.skills.map((skill) => {
    const source = sourceForSkill(skill);
    if (!fighterType) {
      return blocked(skill, "Unknown fighter type.", source);
    }
    if (member.skills.includes(skill.id)) {
      return blocked(skill, "Already selected.", source);
    }
    if (fighterType.category !== "hero" && fighterType.category !== "hired_sword") {
      return blocked(skill, "Only heroes can normally choose skills.", source);
    }
    if (!fighterType.canGainExperience) {
      return blocked(skill, "This fighter type cannot gain experience.", source);
    }

    const explicitAccess =
      member.specialRules.includes(`skill:${skill.id}`) ||
      member.specialRules.includes(`skill-category:${skill.categoryId}`);
    if (!fighterType.skillCategoryIds.includes(skill.categoryId) && !explicitAccess) {
      return blocked(skill, `${fighterType.name} does not have ${skill.categoryId} skill access.`, source);
    }

    if (
      skill.validation.allowedFighterTypeIds.length > 0 &&
      !skill.validation.allowedFighterTypeIds.includes(fighterType.id)
    ) {
      return blocked(skill, `${skill.name} is restricted to specific fighter types.`, source);
    }
    const missingRequiredRule = skill.validation.requiredSpecialRuleIds.find(
      (ruleId) => !member.specialRules.includes(ruleId) && !fighterType.specialRuleIds.includes(ruleId)
    );
    if (missingRequiredRule) {
      return blocked(skill, `${skill.name} requires ${missingRequiredRule}.`, source);
    }
    if (skill.id === "battle-tongue" && warband?.leaderFighterTypeId !== fighterType.id) {
      return blocked(skill, "Battle Tongue is leader-only.", source);
    }
    if (skill.id === "sorcery" && !member.specialRules.includes("spellcaster")) {
      return blocked(skill, "Sorcery is spellcaster-only.", source);
    }

    return allowed(skill, "Allowed by fighter type skill access.", source);
  });
}

export function getAllowedSpecialRules(
  member: RosterMember,
  roster: Roster,
  rulesDb: RulesDb
): AllowedOption<SpecialRule>[] {
  return rulesDb.specialRules.map((rule) => specialRuleOptionFor(rule, member, roster, rulesDb));
}

export function calculateRosterCost(roster: Roster, rulesDb: RulesDb): number {
  return rosterMembersInWarband(roster, rulesDb).reduce((total, member) => {
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    if (!fighterType) return total;
    const warriors = member.kind === "henchman_group" ? member.groupSize : 1;
    const fixedEquipmentCost = member.kind === "hired_sword" ? 0 : equipmentCost(member, rulesDb);
    return total + fighterType.hireCost * warriors + fixedEquipmentCost;
  }, 0);
}

export function calculateWarbandRating(roster: Roster, rulesDb: RulesDb): number {
  return rosterMembersInWarband(roster, rulesDb).reduce((rating, member) => {
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    if (!fighterType) return rating;
    const warriors = member.kind === "henchman_group" ? member.groupSize : 1;
    const basePerWarrior =
      fighterType.ratingOverride ?? (fighterType.isLargeCreature ? 20 : 5);
    return rating + basePerWarrior * warriors + Math.max(0, member.experience);
  }, 0);
}

export function validateRoster(roster: Roster, rulesDb: RulesDb): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const warband = findWarband(rulesDb, roster.warbandTypeId);
  const source = sourceForRule(rulesDb, "starting-warband");

  if (!warband) {
    issues.push(issue("error", "UNKNOWN_WARBAND", "Unknown warband type.", "The roster references a warband type that is not present in rules data.", undefined, "warbandTypeId"));
    return issues;
  }

  if (!roster.name.trim()) {
    issues.push(issue("error", "MISSING_ROSTER_NAME", "Warband name is required.", "Give the roster a campaign-facing name before saving as valid.", undefined, "name", source, "Enter a warband name."));
  }

  const activeMembers = rosterMembersInWarband(roster, rulesDb);
  const warriorCount = countWarriors(roster, rulesDb);
  const maxWarriors = effectiveMaxWarriors(roster, warband.maxWarriors, rulesDb);
  const heroCount = activeMembers.filter((member) => findFighterType(rulesDb, member.fighterTypeId)?.category === "hero").length;
  const rosterCost = calculateRosterCost(roster, rulesDb);
  const rating = calculateWarbandRating(roster, rulesDb);

  if (roster.campaignLog.length === 0 && rosterCost > warband.startingGold) {
    issues.push(issue(
      "error",
      "STARTING_TREASURY_OVERSPENT",
      `The roster cost is ${rosterCost} gc, which exceeds the starting treasury by ${rosterCost - warband.startingGold} gc.`,
      `${warband.name} starts with ${warband.startingGold} gc before campaign income or purchases.`,
      undefined,
      "treasuryGold",
      source,
      "Remove equipment or warriors until the starting cost is legal."
    ));
  }

  if (warriorCount < warband.minWarriors) {
    issues.push(issue("error", "MIN_WARRIORS", `The warband has ${warriorCount} warriors; minimum is ${warband.minWarriors}.`, "Starting warbands must meet the minimum model count.", undefined, "members", source, "Hire more warriors."));
  }
  if (warriorCount > maxWarriors) {
    issues.push(issue("error", "MAX_WARRIORS", `The warband has ${warriorCount} warriors. ${warband.name} are limited to ${maxWarriors}.`, "The warband type and active roster rules set the maximum number of warriors.", undefined, "members", sourceForWarband(warband), "Remove warriors or reduce henchman group sizes."));
  }
  if (heroCount > warband.maxHeroes) {
    issues.push(issue("error", "MAX_HEROES", `The warband has ${heroCount} heroes; maximum is ${warband.maxHeroes}.`, "The warband type sets a maximum number of heroes.", undefined, "members", sourceForWarband(warband), "Remove excess heroes."));
  }

  const leaderCount = activeMembers.filter((member) => member.fighterTypeId === warband.leaderFighterTypeId).length;
  if (leaderCount !== 1) {
    issues.push(issue("error", "REQUIRED_LEADER", `${warband.name} must include exactly one ${findFighterType(rulesDb, warband.leaderFighterTypeId)?.name ?? "leader"}.`, "The required leader is defined by the warband list.", undefined, "members", sourceForRule(rulesDb, "required-leader"), "Add the required leader or remove duplicates."));
  }

  for (const fighterType of rulesDb.fighterTypes.filter((item) => item.warbandTypeId === warband.id)) {
    const count = countFighterType(roster, fighterType.id, rulesDb);
    if (count < fighterType.minCount) {
      issues.push(issue("error", "FIGHTER_MIN_COUNT", `${fighterType.name} requires at least ${fighterType.minCount}.`, "The warband list defines this minimum.", undefined, "members", fighterType.source, `Add ${fighterType.name}.`));
    }
    if (fighterType.maxCount !== null && count > fighterType.maxCount) {
      issues.push(issue("error", "FIGHTER_MAX_COUNT", `${fighterType.name} maximum is ${fighterType.maxCount}, but the roster has ${count}.`, "The warband list defines this maximum.", undefined, "members", fighterType.source, `Remove excess ${fighterType.name} models.`));
    }
    for (const ratioConstraint of fighterType.validation.maxCountPerFighterTypeIds) {
      const baseCount = ratioConstraint.fighterTypeIds.reduce((total, fighterTypeId) => total + countFighterType(roster, fighterTypeId, rulesDb), 0);
      const allowedCount = Math.floor(baseCount * ratioConstraint.multiplier);
      if (count > allowedCount) {
        issues.push(issue(
          "error",
          "FIGHTER_RATIO_LIMIT",
          `${fighterType.name} maximum is ${allowedCount}, but the roster has ${count}.`,
          ratioConstraint.description ?? "This fighter type is limited by the number of another fighter type in the warband.",
          undefined,
          "members",
          fighterType.source,
          `Add supporting warriors or remove excess ${fighterType.name} models.`
        ));
      }
    }
  }

  for (const member of activeMembers) {
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    if (!fighterType) {
      issues.push(issue("error", "UNKNOWN_FIGHTER_TYPE", "Unknown fighter type.", "The member references a fighter type that is not in rules data.", member.id, "fighterTypeId"));
      continue;
    }

    if (!member.displayName.trim()) {
      issues.push(issue("error", "MISSING_MEMBER_NAME", `${fighterType.name} needs a name.`, "Names make campaign logs and injuries auditable.", member.id, "displayName", fighterType.source, "Enter a member or group name."));
    }

    if (member.kind === "hired_sword") {
      validateHiredSword(member, roster, rulesDb, issues);
    }

    if (member.kind === "henchman_group") {
      const min = fighterType.groupMinSize ?? 1;
      const max = fighterType.groupMaxSize ?? warband.maxWarriors;
      if (member.groupSize < min || member.groupSize > max) {
        issues.push(issue("error", "HENCHMAN_GROUP_SIZE", `${fighterType.name} group size must be ${min}-${max}.`, "The warband list defines henchman group limits.", member.id, "groupSize", fighterType.source, "Adjust the group size."));
      }
      if (member.perModelEquipment && !perModelEquipmentIsUniform(member.perModelEquipment)) {
        issues.push(issue("error", "HENCHMAN_EQUIPMENT_UNIFORMITY", "This Henchman group has mixed weapons or armour.", "Every model in a Henchman group must have identical weapons and armour.", member.id, "equipment", sourceForRule(rulesDb, "weapon-use-limits"), "Make each model in the group carry the same equipment."));
      }
    }

    if (member.kind !== "hired_sword") {
      for (const itemId of unique(member.equipment)) {
        const item = findEquipment(rulesDb, itemId);
        if (!item) {
          issues.push(issue("error", "UNKNOWN_EQUIPMENT", `Unknown equipment id: ${itemId}.`, "The roster references equipment that is not present in the rules database.", member.id, "equipment"));
          continue;
        }
        const option = equipmentOptionFor(item, member, roster, rulesDb, { ignoreCurrentLimit: true });
        if (!option.allowed) {
          issues.push(issue("error", "INVALID_EQUIPMENT", `${fighterType.name} cannot take ${item.name}.`, option.reason, member.id, "equipment", sourceForEquipment(item), "Choose an item from the fighter's equipment list."));
        }
      }
    }

    if (
      fighterType.validation.requiredOneOfEquipmentItemIds.length > 0 &&
      !fighterType.validation.requiredOneOfEquipmentItemIds.some((itemId) => member.equipment.includes(itemId))
    ) {
      const requiredItems = fighterType.validation.requiredOneOfEquipmentItemIds
        .map((itemId) => findEquipment(rulesDb, itemId))
        .filter((item): item is EquipmentItem => Boolean(item));
      const isNurgleBlessing = requiredItems.some((item) => item.validation.costGroupId === "nurgle-blessing");
      const requiredLabel = isNurgleBlessing ? "at least one Blessing of Nurgle" : "a required option";
      const availableOptions = requiredItems.map((item) => item.name).join(", ");
      issues.push(issue(
        "error",
        "REQUIRED_EQUIPMENT_OPTION",
        `${fighterType.name} must choose ${requiredLabel}.`,
        availableOptions
          ? `Choose one of: ${availableOptions}.`
          : "This fighter type has a rules-data requirement to include at least one item from a specific list.",
        member.id,
        "equipment",
        fighterType.source,
        isNurgleBlessing ? "Add a Blessing of Nurgle." : "Add one of the required options."
      ));
    }

    if (member.kind !== "hired_sword") validateWeaponAndArmourLimits(member, rulesDb, issues);
    validateSkills(member, roster, rulesDb, issues);
    validateSpecialRules(member, roster, rulesDb, issues);
    validateExperience(member, fighterType, rulesDb, issues);
  }

  if (typeof roster.claimedCost === "number" && roster.claimedCost !== rosterCost) {
    issues.push(issue("warning", "CLAIMED_COST_MISMATCH", `Saved cost is ${roster.claimedCost} gc, but calculated cost is ${rosterCost} gc.`, "The app calculates cost from fighter types and equipment data.", undefined, "claimedCost", sourceForRule(rulesDb, "starting-warband"), "Use the calculated total."));
  }

  if (typeof roster.claimedWarbandRating === "number" && roster.claimedWarbandRating !== rating) {
    issues.push(issue("warning", "CLAIMED_RATING_MISMATCH", `Saved rating is ${roster.claimedWarbandRating}, but calculated rating is ${rating}.`, "Warband rating is calculated from active warriors and accumulated experience.", undefined, "claimedWarbandRating", sourceForRule(rulesDb, "warband-rating"), "Use the calculated rating."));
  }

  if (issues.length === 0) {
    issues.push(issue("info", "ROSTER_VALID", "Roster is valid.", "No blocking validation issues were found.", undefined, undefined, sourceForWarband(warband)));
  }

  return issues;
}

export function createRosterMemberFromType(
  fighterType: FighterType,
  rosterId: string,
  kind: RosterMember["kind"],
  name = fighterType.name
): RosterMember {
  return {
    id: cryptoSafeId("member"),
    rosterId,
    fighterTypeId: fighterType.id,
    displayName: name,
    kind,
    groupSize: kind === "henchman_group" ? fighterType.groupMinSize ?? 1 : 1,
    currentProfile: { ...fighterType.profile },
    startingXp: fighterType.startingExperience,
    currentXp: fighterType.startingExperience,
    experience: fighterType.startingExperience,
    advances: [],
    advancesTaken: [],
    injuries: [],
    equipment: [],
    skills: [],
    specialRules: [...fighterType.specialRuleIds],
    notes: "",
    status: "active"
  };
}

export function sourceForEquipment(item: EquipmentItem): SourceRef {
  return {
    sourceDocumentId: item.sourceDocumentId,
    sourceUrl: item.sourceUrl,
    pageRef: item.pageRef,
    label: item.name
  };
}

export function sourceForSkill(skill: Skill): SourceRef {
  return {
    sourceDocumentId: skill.sourceDocumentId,
    sourceUrl: skill.sourceUrl,
    pageRef: skill.pageRef,
    label: skill.name
  };
}

export function sourceForSpecialRule(rule: SpecialRule): SourceRef {
  return {
    sourceDocumentId: rule.sourceDocumentId,
    sourceUrl: rule.sourceUrl,
    pageRef: rule.pageRef,
    label: rule.name
  };
}

export function sourceForWarband(warband: WarbandType): SourceRef {
  return {
    sourceDocumentId: warband.sourceDocumentId,
    sourceUrl: warband.sourceUrl,
    label: warband.name
  };
}

function specialRuleOptionFor(
  rule: SpecialRule,
  member: RosterMember,
  _roster: Roster,
  rulesDb: RulesDb,
  options: { ignoreAlreadySelected?: boolean } = {}
): AllowedOption<SpecialRule> {
  const fighterType = findFighterType(rulesDb, member.fighterTypeId);
  const source = sourceForSpecialRule(rule);
  if (!fighterType) return blocked(rule, "Unknown fighter type.", source);
  if (!rule.validation.selectableAs) return blocked(rule, "This rule is not selected directly.", source);
  if (!options.ignoreAlreadySelected && member.specialRules.includes(rule.id)) {
    return blocked(rule, "Already selected.", source);
  }

  if (
    rule.validation.allowedFighterTypeIds.length > 0 &&
    !rule.validation.allowedFighterTypeIds.includes(fighterType.id)
  ) {
    return blocked(rule, `${rule.name} is restricted to specific fighter types.`, source);
  }

  const activeRuleIds = new Set([...fighterType.specialRuleIds, ...member.specialRules]);
  const missingRequiredRule = rule.validation.requiredSpecialRuleIds.find((ruleId) => !activeRuleIds.has(ruleId));
  if (missingRequiredRule) {
    return blocked(rule, `${rule.name} requires ${missingRequiredRule}.`, source);
  }

  return allowed(rule, `Allowed by ${rule.validation.selectableAs} access.`, source);
}

function equipmentOptionFor(
  item: EquipmentItem,
  member: RosterMember,
  roster: Roster,
  rulesDb: RulesDb,
  options: { ignoreCurrentLimit?: boolean } = {}
): AllowedOption<EquipmentItem> {
  const fighterType = findFighterType(rulesDb, member.fighterTypeId);
  const source = sourceForEquipment(item);
  if (!fighterType) return blocked(item, "Unknown fighter type.", source);

  const listAllowed = fighterType.equipmentListIds
    .flatMap((listId) => rulesDb.equipmentLists.filter((list) => list.id === listId))
    .some((list) => list.allowedEquipmentItemIds.includes(item.id));

  const skillAllowed =
    (item.category === "close_combat" && member.skills.includes("weapons-training")) ||
    (item.category === "missile" && member.skills.includes("weapons-expert"));

  if (!listAllowed && !skillAllowed) {
    return blocked(item, `${item.name} is not in the ${fighterType.name} equipment list.`, source);
  }

  if (!options.ignoreCurrentLimit) {
    const simulated = { ...member, equipment: [...member.equipment, item.id] };
    const temporaryIssues: ValidationIssue[] = [];
    validateWeaponAndArmourLimits(simulated, rulesDb, temporaryIssues);
    const blocker = temporaryIssues.find((entry) => entry.severity === "error");
    if (blocker) return blocked(item, blocker.message, source);
  }

  return allowed(item, skillAllowed && !listAllowed ? "Allowed by weapon-use skill." : "Allowed by equipment list.", source);
}

function validateWeaponAndArmourLimits(member: RosterMember, rulesDb: RulesDb, issues: ValidationIssue[]) {
  const equipmentSets = member.perModelEquipment?.length ? member.perModelEquipment : [member.equipment];
  const source = sourceForRule(rulesDb, "weapon-use-limits");

  equipmentSets.forEach((equipment, index) => {
    const items = equipment
      .map((itemId) => findEquipment(rulesDb, itemId))
      .filter((item): item is EquipmentItem => Boolean(item));
    const counts = items.reduce(
      (acc, item) => {
        acc.closeCombat += item.validation.closeCombatSlots;
        acc.missile += item.validation.missileSlots;
        if (item.validation.isFreeFirstPerWarrior && !acc.freeCloseCombatUsed) {
          acc.closeCombat -= item.validation.closeCombatSlots;
          acc.freeCloseCombatUsed = true;
        }
        if (item.validation.isBodyArmour) acc.bodyArmour += 1;
        if (item.validation.isShield || item.validation.isBuckler) acc.shieldOrBuckler += 1;
        if (item.validation.isHelmet) acc.helmets += 1;
        return acc;
      },
      {
        closeCombat: 0,
        missile: 0,
        bodyArmour: 0,
        shieldOrBuckler: 0,
        helmets: 0,
        freeCloseCombatUsed: false
      }
    );

    const label = equipmentSets.length > 1 ? ` model ${index + 1}` : "";
    const weaponItems = items.filter((item) => item.category === "close_combat" || item.category === "missile");
    const exclusiveWeapon = weaponItems.find((item) => item.validation.disallowsOtherWeapons);
    const tailFightingAllowsExtraWeapon =
      counts.closeCombat === 3 &&
      member.skills.includes("tail-fighting") &&
      items.some((item) => item.id === "dagger" || item.id === "sword") &&
      !exclusiveWeapon;
    if (exclusiveWeapon && weaponItems.some((item) => item.id !== exclusiveWeapon.id)) {
      issues.push(issue("error", "CANNOT_COMBINE_WEAPONS", `${exclusiveWeapon.name} cannot be combined with other weapons.`, "This weapon is marked as requiring exclusive use in its rules metadata.", member.id, "equipment", sourceForEquipment(exclusiveWeapon), "Remove the other weapons from this fighter."));
    }
    for (const item of items) {
      const missingRequiredItem = item.validation.requiredEquipmentItemIds.find((requiredId) => !equipment.includes(requiredId));
      if (missingRequiredItem) {
        issues.push(issue("error", "MISSING_REQUIRED_EQUIPMENT", `${item.name} requires ${findEquipment(rulesDb, missingRequiredItem)?.name ?? missingRequiredItem}.`, "This item has a paired equipment requirement in rules metadata.", member.id, "equipment", sourceForEquipment(item), "Add the required item or remove this item."));
      }
      if (item.validation.disallowsOtherEquipment) {
        const allowedCompanions = new Set([item.id, ...item.validation.requiredEquipmentItemIds]);
        const blockedCompanion = equipment.find((itemId) => !allowedCompanions.has(itemId));
        if (blockedCompanion) {
          issues.push(issue("error", "CANNOT_COMBINE_EQUIPMENT", `${item.name} cannot be combined with ${findEquipment(rulesDb, blockedCompanion)?.name ?? blockedCompanion}.`, "This item is marked as excluding other equipment in rules metadata.", member.id, "equipment", sourceForEquipment(item), "Remove the other equipment from this fighter."));
        }
      }
    }
    if (counts.closeCombat > 2 && !tailFightingAllowsExtraWeapon) {
      issues.push(issue("error", "TOO_MANY_CLOSE_COMBAT_WEAPONS", `This fighter${label} has too many close combat weapons.`, "A warrior may carry up to two close combat weapons in addition to the free dagger.", member.id, "equipment", source, "Remove a close combat weapon."));
    }
    if (counts.missile > 2) {
      issues.push(issue("error", "TOO_MANY_MISSILE_WEAPONS", `This fighter${label} has too many missile weapons.`, "A warrior may carry up to two different missile weapons. A brace of pistols counts as one missile weapon for this app's validation metadata.", member.id, "equipment", source, "Remove a missile weapon."));
    }
    if (counts.bodyArmour > 1) {
      issues.push(issue("error", "TOO_MUCH_BODY_ARMOUR", `This fighter${label} has more than one suit of body armour.`, "Only one body armour item can be worn at a time.", member.id, "equipment", source, "Keep one body armour item."));
    }
    if (counts.shieldOrBuckler > 1) {
      issues.push(issue("error", "TOO_MANY_SHIELDS", `This fighter${label} has more than one shield or buckler.`, "Only one shield-like item can be used at a time.", member.id, "equipment", source, "Keep either a shield or a buckler."));
    }
    if (counts.helmets > 1) {
      issues.push(issue("error", "TOO_MANY_HELMETS", `This fighter${label} has more than one helmet.`, "Only one helmet can be worn at a time.", member.id, "equipment", source, "Keep one helmet."));
    }
  });

  for (const itemId of unique(member.equipment)) {
    const item = findEquipment(rulesDb, itemId);
    if (!item?.validation.nonRepeatable) continue;
    if (member.equipment.filter((id) => id === itemId).length > 1) {
      issues.push(issue("error", "DUPLICATE_NON_REPEATABLE_ITEM", `${item.name} cannot be duplicated on the same fighter.`, "The item is marked non-repeatable in rules validation metadata.", member.id, "equipment", sourceForEquipment(item), "Remove the duplicate item."));
    }
  }
}

function validateSkills(member: RosterMember, roster: Roster, rulesDb: RulesDb, issues: ValidationIssue[]) {
  const allowedSkillOptions = getAllowedSkills({ ...member, skills: [] }, roster, rulesDb);
  for (const skillId of member.skills) {
    const skill = rulesDb.skills.find((entry) => entry.id === skillId);
    if (!skill) {
      issues.push(issue("error", "UNKNOWN_SKILL", `Unknown skill id: ${skillId}.`, "The roster references a skill that is not present in rules data.", member.id, "skills"));
      continue;
    }
    const option = allowedSkillOptions.find((entry) => entry.item.id === skillId);
    if (!option?.allowed) {
      issues.push(issue("error", "INVALID_SKILL", `${skill.name} is not legal for this fighter.`, option?.reason ?? "The fighter type does not have this skill access.", member.id, "skills", sourceForSkill(skill), "Choose a skill from an allowed category."));
    }
  }
}

function validateSpecialRules(member: RosterMember, roster: Roster, rulesDb: RulesDb, issues: ValidationIssue[]) {
  const fighterType = findFighterType(rulesDb, member.fighterTypeId);
  for (const ruleId of member.specialRules) {
    const rule = rulesDb.specialRules.find((entry) => entry.id === ruleId);
    if (!rule) {
      issues.push(issue("error", "UNKNOWN_SPECIAL_RULE", `Unknown special rule id: ${ruleId}.`, "The roster references a special rule that is not present in rules data.", member.id, "specialRules"));
      continue;
    }
    if (fighterType?.specialRuleIds.includes(ruleId)) continue;

    const option = specialRuleOptionFor(rule, member, roster, rulesDb, { ignoreAlreadySelected: true });
    if (!option.allowed) {
      issues.push(issue("error", "INVALID_SPECIAL_RULE", `${rule.name} is not legal for this fighter.`, option.reason, member.id, "specialRules", sourceForSpecialRule(rule), "Choose a prayer, spell or ability from the fighter's allowed list."));
    }
  }
}

function validateHiredSword(member: RosterMember, roster: Roster, rulesDb: RulesDb, issues: ValidationIssue[]) {
  const hiredSwordId = member.fighterTypeId.replace(/^hired-sword-/, "");
  const hiredSword = rulesDb.hiredSwords.find((entry) => entry.id === hiredSwordId);
  if (!hiredSword) {
    issues.push(issue("error", "UNKNOWN_HIRED_SWORD", "Unknown hired sword.", "The roster references a hired sword that is not in the hired sword data.", member.id, "fighterTypeId"));
    return;
  }

  const duplicates = roster.members.filter((entry) => entry.status !== "dead" && entry.status !== "retired" && entry.fighterTypeId === member.fighterTypeId);
  if (duplicates.length > 1) {
    issues.push(issue("error", "DUPLICATE_HIRED_SWORD", `${hiredSword.name} can only be hired once.`, "Hired swords are rare; a warband may only have one of each type.", member.id, "members", sourceForHiredSword(hiredSword), "Retire or remove the duplicate hired sword."));
  }

  if (hiredSword.allowedWarbandTypeIds.length > 0 && !hiredSword.allowedWarbandTypeIds.includes(roster.warbandTypeId)) {
    issues.push(issue("error", "HIRED_SWORD_NOT_AVAILABLE", `${hiredSword.name} is not available to this warband.`, hiredSword.availabilitySummary, member.id, "members", sourceForHiredSword(hiredSword), "Choose a hired sword available to this warband."));
  }

  if (hiredSword.blockedWarbandTypeIds.includes(roster.warbandTypeId)) {
    issues.push(issue("error", "HIRED_SWORD_NOT_AVAILABLE", `${hiredSword.name} is not available to this warband.`, hiredSword.availabilitySummary, member.id, "members", sourceForHiredSword(hiredSword), "Choose a hired sword available to this warband."));
  }
}

function sourceForHiredSword(hiredSword: RulesDb["hiredSwords"][number]): SourceRef {
  return {
    sourceDocumentId: hiredSword.sourceDocumentId,
    sourceUrl: hiredSword.sourceUrl,
    pageRef: hiredSword.pageRef,
    label: hiredSword.name
  };
}

function validateExperience(
  member: RosterMember,
  fighterType: FighterType,
  rulesDb: RulesDb,
  issues: ValidationIssue[]
) {
  if (member.experience < fighterType.startingExperience) {
    issues.push(issue("error", "EXPERIENCE_BELOW_STARTING", `${fighterType.name} starts with ${fighterType.startingExperience} XP.`, "Current experience cannot be lower than starting experience.", member.id, "experience", fighterType.source, "Set XP to at least the fighter type starting value."));
  }
  if (!fighterType.canGainExperience && member.experience > fighterType.startingExperience) {
    issues.push(issue("error", "EXPERIENCE_NOT_ALLOWED", `${fighterType.name} cannot gain experience.`, "This fighter type is marked as unable to gain experience.", member.id, "experience", sourceForRule(rulesDb, "experience-advances"), "Reset XP to the starting value."));
  }

  const possibleAdvanceCount = HERO_ADVANCE_XP.filter(
    (threshold) => threshold > fighterType.startingExperience && threshold <= member.experience
  ).length;
  if ((fighterType.category === "hero" || fighterType.category === "hired_sword") && member.advances.length > possibleAdvanceCount) {
    issues.push(issue("warning", "ADVANCE_COUNT_HIGH", `${fighterType.name} has more recorded advances than the current XP normally supports.`, "The app uses core hero XP thresholds as a consistency check.", member.id, "advances", sourceForRule(rulesDb, "experience-advances"), "Review XP or remove extra advances."));
  }
}

function equipmentCost(member: RosterMember, rulesDb: RulesDb): number {
  if (member.perModelEquipment?.length) {
    return member.perModelEquipment.reduce((total, equipment) => total + equipmentSetCost(equipment, rulesDb), 0);
  }

  const warriors = member.kind === "henchman_group" ? member.groupSize : 1;
  return equipmentSetCost(member.equipment, rulesDb) * warriors;
}

function equipmentSetCost(equipment: string[], rulesDb: RulesDb): number {
  const freeTracker = new Set<string>();
  const groupedCosts = new Map<string, { cost: number; multiplier: number }[]>();
  let total = 0;

  for (const itemId of equipment) {
    const item = findEquipment(rulesDb, itemId);
    if (!item) continue;
    if (item.validation.isFreeFirstPerWarrior && !freeTracker.has(item.id)) {
      freeTracker.add(item.id);
      continue;
    }
    if (item.validation.costGroupId && item.validation.costGroupSubsequentMultiplier > 1) {
      const entries = groupedCosts.get(item.validation.costGroupId) ?? [];
      entries.push({ cost: item.cost, multiplier: item.validation.costGroupSubsequentMultiplier });
      groupedCosts.set(item.validation.costGroupId, entries);
      continue;
    }
    total += item.cost;
  }

  for (const entries of groupedCosts.values()) {
    const [first, ...later] = entries.sort((a, b) => b.cost - a.cost);
    total += first.cost;
    total += later.reduce((subtotal, entry) => subtotal + entry.cost * entry.multiplier, 0);
  }

  return total;
}

function rosterMembersInWarband(roster: Roster, rulesDb: RulesDb): RosterMember[] {
  return roster.members.filter((member) => {
    if (member.status === "dead" || member.status === "retired") return false;
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    if (member.kind === "hired_sword" && fighterType?.category === "hired_sword") return true;
    return fighterType?.warbandTypeId === roster.warbandTypeId;
  });
}

function countWarriors(roster: Roster, rulesDb: RulesDb): number {
  return rosterMembersInWarband(roster, rulesDb).filter((member) => member.kind !== "hired_sword").reduce(
    (count, member) => count + (member.kind === "henchman_group" ? member.groupSize : 1),
    0
  );
}

function effectiveMaxWarriors(roster: Roster, baseMax: number, rulesDb: RulesDb): number {
  return rosterMembersInWarband(roster, rulesDb).reduce((max, member) => {
    const fighterType = findFighterType(rulesDb, member.fighterTypeId);
    return max + (fighterType?.validation.warbandMaxWarriorsBonus ?? 0);
  }, baseMax);
}

function countFighterType(roster: Roster, fighterTypeId: string, rulesDb: RulesDb): number {
  const fighterType = findFighterType(rulesDb, fighterTypeId);
  return rosterMembersInWarband(roster, rulesDb)
    .filter((member) => member.fighterTypeId === fighterTypeId)
    .reduce((count, member) => {
      if (fighterType?.category === "henchman") return count + member.groupSize;
      return count + 1;
    }, 0);
}

function perModelEquipmentIsUniform(equipmentSets: string[][]): boolean {
  if (equipmentSets.length < 2) return true;
  const [first, ...rest] = equipmentSets.map((items) => [...items].sort().join("|"));
  return rest.every((value) => value === first);
}

function findWarband(rulesDb: RulesDb, id: string) {
  return rulesDb.warbandTypes.find((warband) => warband.id === id);
}

function findFighterType(rulesDb: RulesDb, id: string) {
  return rulesDb.fighterTypes.find((fighterType) => fighterType.id === id);
}

function findEquipment(rulesDb: RulesDb, id: string) {
  return rulesDb.equipmentItems.find((item) => item.id === id);
}

function sourceForRule(rulesDb: RulesDb, id: string): SourceRef | undefined {
  const reference = rulesDb.ruleReferences.find((rule) => rule.id === id);
  if (!reference) return undefined;
  return {
    sourceDocumentId: reference.sourceDocumentId,
    sourceUrl: reference.sourceUrl,
    pageRef: reference.pageRef,
    label: reference.name
  };
}

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  detail: string,
  affectedMemberId?: string,
  field?: string,
  source?: SourceRef,
  suggestedFix?: string
): ValidationIssue {
  return { severity, code, message, detail, affectedMemberId, field, source, suggestedFix };
}

function allowed<T>(item: T, reason: string, source?: SourceRef): AllowedOption<T> {
  return { item, allowed: true, reason, source };
}

function blocked<T>(item: T, reason: string, source?: SourceRef): AllowedOption<T> {
  return { item, allowed: false, reason, source };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function cryptoSafeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}
