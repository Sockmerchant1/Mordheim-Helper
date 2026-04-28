import { describe, expect, it } from "vitest";
import { rulesDb } from "../src/data/rulesDb";
import {
  calculateRosterCost,
  calculateWarbandRating,
  getAllowedEquipment,
  getAllowedFighterTypes,
  getAllowedSkills,
  getAllowedWarbands,
  validateRoster
} from "../src/rules/engine";
import {
  illegalEquipmentWitchHunters,
  invalidHenchmanGroupWitchHunters,
  invalidSkillWitchHunters,
  legalBraceAndCrossbow,
  noCaptainWitchHunters,
  overspentWitchHunters,
  tooManyCloseCombatWeapons,
  tooManyMissileWeapons,
  tooManyPriests,
  tooManyWarhounds,
  tooManyWarriorsWitchHunters,
  tooManyWitchHunters,
  twoCaptainWitchHunters,
  validStartingWitchHunters
} from "./fixtures/witchHunterRosters";
import {
  marienburgExpensiveButLegal,
  mercenaryIllegalEquipment,
  mercenaryNoCaptain,
  reiklandOverspentWithMarienburgGear,
  tooManyMercenaryMarksmen,
  tooManyMercenarySwordsmen,
  tooManyMercenaryWarriors,
  validMarienburgers,
  validMercenaries,
  validMiddenheimers,
  validReiklanders
} from "./fixtures/mercenaryRosters";
import {
  augurWithArmour,
  matriarchWithSpecialSkill,
  noviceWithHolyTome,
  sisterSuperiorWithMatriarchOnlySkill,
  sistersNoMatriarch,
  tooManyAugurs,
  tooManyNovices,
  tooManySisterSuperiors,
  tooManySistersWarriors,
  validSistersOfSigmar
} from "./fixtures/sistersRosters";

describe("rules engine - Witch Hunters", () => {
  it("returns allowed warbands with filters", () => {
    expect(getAllowedWarbands(rulesDb, { officialOnly: true }).map((warband) => warband.id)).toContain("witch-hunters");
    expect(getAllowedWarbands(rulesDb, { race: "Human" }).map((warband) => warband.id)).toContain("witch-hunters");
  });

  it("requires exactly one Witch Hunter Captain", () => {
    expect(codes(validStartingWitchHunters())).not.toContain("REQUIRED_LEADER");
    expect(codes(noCaptainWitchHunters())).toContain("REQUIRED_LEADER");
    expect(codes(twoCaptainWitchHunters())).toContain("REQUIRED_LEADER");
  });

  it("enforces Witch Hunter maximum total warriors", () => {
    expect(codes(tooManyWarriorsWitchHunters())).toContain("MAX_WARRIORS");
  });

  it("enforces maximum of three Witch Hunters", () => {
    expect(codes(tooManyWitchHunters())).toContain("FIGHTER_MAX_COUNT");
  });

  it("enforces maximum of one Warrior-Priest", () => {
    expect(codes(tooManyPriests())).toContain("FIGHTER_MAX_COUNT");
  });

  it("enforces maximum of five Warhounds", () => {
    expect(codes(tooManyWarhounds())).toContain("FIGHTER_MAX_COUNT");
    expect(codes(tooManyWarhounds())).toContain("HENCHMAN_GROUP_SIZE");
  });

  it("calculates starting cost from hire costs and equipment", () => {
    expect(calculateRosterCost(validStartingWitchHunters(), rulesDb)).toBe(292);
    expect(codes(overspentWitchHunters())).toContain("STARTING_TREASURY_OVERSPENT");
  });

  it("restricts equipment by fighter type equipment list", () => {
    expect(codes(illegalEquipmentWitchHunters())).toContain("INVALID_EQUIPMENT");
    const roster = validStartingWitchHunters();
    const options = getAllowedEquipment(roster.members[2], roster, rulesDb);
    expect(options.find((option) => option.item.id === "bow")?.allowed).toBe(false);
    expect(options.find((option) => option.item.id === "crossbow")?.allowed).toBe(true);
  });

  it("enforces close combat weapon limits", () => {
    expect(codes(tooManyCloseCombatWeapons())).toContain("TOO_MANY_CLOSE_COMBAT_WEAPONS");
  });

  it("enforces missile weapon limits", () => {
    expect(codes(tooManyMissileWeapons())).toContain("TOO_MANY_MISSILE_WEAPONS");
  });

  it("counts a brace of pistols correctly for weapon limits", () => {
    expect(codes(legalBraceAndCrossbow())).not.toContain("TOO_MANY_MISSILE_WEAPONS");
  });

  it("enforces henchman group equipment uniformity", () => {
    expect(codes(invalidHenchmanGroupWitchHunters())).toContain("HENCHMAN_EQUIPMENT_UNIFORMITY");
  });

  it("calculates warband rating", () => {
    expect(calculateWarbandRating(validStartingWitchHunters(), rulesDb)).toBe(88);
  });

  it("restricts skills by fighter skill categories", () => {
    expect(codes(invalidSkillWitchHunters())).toContain("INVALID_SKILL");
    const roster = validStartingWitchHunters();
    const captainSkills = getAllowedSkills(roster.members[0], roster, rulesDb);
    expect(captainSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed).toBe(true);
    const priestSkills = getAllowedSkills(roster.members[1], roster, rulesDb);
    expect(priestSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed).toBe(false);
  });

  it("skill lookup returns effect text and source reference", () => {
    const roster = validStartingWitchHunters();
    const captainSkills = getAllowedSkills(roster.members[0], roster, rulesDb);
    const stepAside = captainSkills.find((option) => option.item.id === "step-aside");
    expect(stepAside?.item.effectSummary).toContain("5+ save");
    expect(stepAside?.source?.sourceDocumentId).toBe("mordheim-core-rules");
    expect(stepAside?.source?.pageRef).toBeTruthy();
  });

  it("returns only fighter types still legal to add", () => {
    const roster = validStartingWitchHunters();
    expect(getAllowedFighterTypes("witch-hunters", roster, rulesDb).map((fighter) => fighter.id)).toContain("witch-hunter");

    const fullHunters = tooManyWitchHunters();
    expect(getAllowedFighterTypes("witch-hunters", fullHunters, rulesDb).map((fighter) => fighter.id)).not.toContain("witch-hunter");
  });
});

describe("rules engine - Mercenaries", () => {
  it("loads all three official Mercenary variants", () => {
    const ids = getAllowedWarbands(rulesDb, { officialOnly: true }).map((warband) => warband.id);
    expect(ids).toContain("reiklanders");
    expect(ids).toContain("middenheimers");
    expect(ids).toContain("marienburgers");
  });

  it("validates basic starting rosters for each Mercenary variant", () => {
    expect(errorCodes(validReiklanders())).toEqual([]);
    expect(errorCodes(validMiddenheimers())).toEqual([]);
    expect(errorCodes(validMarienburgers())).toEqual([]);
    expect(calculateRosterCost(validReiklanders(), rulesDb)).toBe(254);
    expect(calculateWarbandRating(validReiklanders(), rulesDb)).toBe(63);
  });

  it("requires exactly one Mercenary Captain", () => {
    expect(codes(mercenaryNoCaptain())).toContain("REQUIRED_LEADER");
  });

  it("enforces Mercenary maximum total warriors", () => {
    expect(codes(tooManyMercenaryWarriors())).toContain("MAX_WARRIORS");
  });

  it("enforces Marksmen and Swordsmen caps", () => {
    expect(codes(tooManyMercenaryMarksmen())).toContain("FIGHTER_MAX_COUNT");
    expect(codes(tooManyMercenarySwordsmen())).toContain("FIGHTER_MAX_COUNT");
  });

  it("applies variant profiles and starting treasury", () => {
    const reiklandMarksman = rulesDb.fighterTypes.find((fighter) => fighter.id === "reikland-marksman");
    const middenheimCaptain = rulesDb.fighterTypes.find((fighter) => fighter.id === "middenheim-mercenary-captain");
    const middenheimChampion = rulesDb.fighterTypes.find((fighter) => fighter.id === "middenheim-champion");
    const marienburg = rulesDb.warbandTypes.find((warband) => warband.id === "marienburgers");

    expect(reiklandMarksman?.profile.BS).toBe(4);
    expect(middenheimCaptain?.profile.S).toBe(4);
    expect(middenheimChampion?.profile.S).toBe(4);
    expect(marienburg?.startingGold).toBe(600);
    expect(errorCodes(marienburgExpensiveButLegal())).not.toContain("STARTING_TREASURY_OVERSPENT");
    expect(codes(reiklandOverspentWithMarienburgGear())).toContain("STARTING_TREASURY_OVERSPENT");
  });

  it("enforces Mercenary and Marksman equipment lists", () => {
    expect(codes(mercenaryIllegalEquipment())).toContain("INVALID_EQUIPMENT");

    const roster = validReiklanders();
    const warriorOptions = getAllowedEquipment(roster.members[3], roster, rulesDb);
    const marksmanOptions = getAllowedEquipment(roster.members[4], roster, rulesDb);

    expect(warriorOptions.find((option) => option.item.id === "long-bow")?.allowed).toBe(false);
    expect(marksmanOptions.find((option) => option.item.id === "long-bow")?.allowed).toBe(true);
    expect(marksmanOptions.find((option) => option.item.id === "heavy-armour")?.allowed).toBe(false);
  });

  it("enforces variant skill tables", () => {
    const reikland = validMercenaries("reikland");
    const middenheim = validMercenaries("middenheim");
    const marienburg = validMercenaries("marienburg");

    const reiklandChampionSkills = getAllowedSkills(reikland.members[1], reikland, rulesDb);
    const middenheimChampionSkills = getAllowedSkills(middenheim.members[1], middenheim, rulesDb);
    const marienburgChampionSkills = getAllowedSkills(marienburg.members[1], marienburg, rulesDb);

    expect(reiklandChampionSkills.find((option) => option.item.id === "quick-shot")?.allowed).toBe(true);
    expect(reiklandChampionSkills.find((option) => option.item.id === "step-aside")?.allowed).toBe(false);
    expect(middenheimChampionSkills.find((option) => option.item.id === "quick-shot")?.allowed).toBe(false);
    expect(middenheimChampionSkills.find((option) => option.item.id === "step-aside")?.allowed).toBe(true);
    expect(marienburgChampionSkills.find((option) => option.item.id === "mighty-blow")?.allowed).toBe(false);
    expect(marienburgChampionSkills.find((option) => option.item.id === "step-aside")?.allowed).toBe(true);
  });

  it("returns source-backed Mercenary special rules", () => {
    const rules = ["reikland-discipline", "middenheim-physical-prowess", "marienburg-traders", "expert-swordsmen"]
      .map((id) => rulesDb.specialRules.find((rule) => rule.id === id));
    expect(rules.every((rule) => rule?.sourceDocumentId === "mhr-mercenaries")).toBe(true);
    expect(rules.every((rule) => rule?.pageRef)).toBe(true);
  });
});

describe("rules engine - Sisters of Sigmar", () => {
  it("loads the official Sisters of Sigmar warband", () => {
    const ids = getAllowedWarbands(rulesDb, { officialOnly: true }).map((warband) => warband.id);
    expect(ids).toContain("sisters-of-sigmar");
  });

  it("validates a basic starting Sisters roster", () => {
    expect(errorCodes(validSistersOfSigmar())).toEqual([]);
    expect(calculateRosterCost(validSistersOfSigmar(), rulesDb)).toBe(238);
    expect(calculateWarbandRating(validSistersOfSigmar(), rulesDb)).toBe(63);
  });

  it("requires exactly one Sigmarite Matriarch", () => {
    expect(codes(sistersNoMatriarch())).toContain("REQUIRED_LEADER");
  });

  it("enforces Sister Superior, Augur, Novice and total warrior limits", () => {
    expect(codes(tooManySisterSuperiors())).toContain("FIGHTER_MAX_COUNT");
    expect(codes(tooManyAugurs())).toContain("FIGHTER_MAX_COUNT");
    expect(codes(tooManyNovices())).toContain("FIGHTER_MAX_COUNT");
    expect(codes(tooManySistersWarriors())).toContain("MAX_WARRIORS");
  });

  it("enforces Augur armour restriction and heroine-only equipment", () => {
    expect(codes(augurWithArmour())).toContain("INVALID_EQUIPMENT");
    expect(codes(noviceWithHolyTome())).toContain("INVALID_EQUIPMENT");

    const roster = validSistersOfSigmar();
    const augurOptions = getAllowedEquipment(roster.members[2], roster, rulesDb);
    const noviceOptions = getAllowedEquipment(roster.members[3], roster, rulesDb);

    expect(augurOptions.find((option) => option.item.id === "light-armour")?.allowed).toBe(false);
    expect(augurOptions.find((option) => option.item.id === "holy-tome")?.allowed).toBe(true);
    expect(noviceOptions.find((option) => option.item.id === "holy-tome")?.allowed).toBe(false);
  });

  it("enforces Sisters special skill restrictions", () => {
    expect(errorCodes(matriarchWithSpecialSkill())).toEqual([]);
    expect(codes(sisterSuperiorWithMatriarchOnlySkill())).toContain("INVALID_SKILL");

    const roster = validSistersOfSigmar();
    const matriarchSkills = getAllowedSkills(roster.members[0], roster, rulesDb);
    const superiorSkills = getAllowedSkills(roster.members[1], roster, rulesDb);
    const augurSkills = getAllowedSkills(roster.members[2], roster, rulesDb);

    expect(matriarchSkills.find((option) => option.item.id === "utter-determination")?.allowed).toBe(true);
    expect(superiorSkills.find((option) => option.item.id === "utter-determination")?.allowed).toBe(false);
    expect(augurSkills.find((option) => option.item.id === "absolute-faith")?.allowed).toBe(true);
    expect(augurSkills.find((option) => option.item.id === "mighty-blow")?.allowed).toBe(false);
  });

  it("returns source-backed Sisters lookup data", () => {
    const sigmariteWarhammer = rulesDb.equipmentItems.find((item) => item.id === "sigmarite-warhammer");
    const blessedSight = rulesDb.specialRules.find((rule) => rule.id === "blessed-sight");
    const signOfSigmar = rulesDb.skills.find((skill) => skill.id === "sign-of-sigmar");

    expect(sigmariteWarhammer?.sourceDocumentId).toBe("mhr-sisters-of-sigmar");
    expect(sigmariteWarhammer?.specialRuleIds).toContain("sigmarite-warhammer-holy");
    expect(blessedSight?.sourceDocumentId).toBe("mhr-sisters-of-sigmar");
    expect(signOfSigmar?.sourceDocumentId).toBe("mhr-sisters-of-sigmar");
  });
});

function codes(roster: ReturnType<typeof validStartingWitchHunters>) {
  return validateRoster(roster, rulesDb).map((issue) => issue.code);
}

function errorCodes(roster: ReturnType<typeof validStartingWitchHunters>) {
  return validateRoster(roster, rulesDb)
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.code);
}
