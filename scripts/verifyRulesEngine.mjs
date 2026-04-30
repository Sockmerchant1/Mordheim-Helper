import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { rulesDbSchema, warbandSeedCollectionSchema, warbandSeedSchema } from "../src/rules/schemas.ts";
import {
  calculateRosterCost,
  calculateWarbandRating,
  getAllowedEquipment,
  getAllowedFighterTypes,
  getAllowedSkills,
  getAllowedSpecialRules,
  getAllowedWarbands,
  getPendingAdvances,
  validateRoster
} from "../src/rules/engine.ts";
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
} from "../tests/fixtures/witchHunterRosters.ts";
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
} from "../tests/fixtures/mercenaryRosters.ts";
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
} from "../tests/fixtures/sistersRosters.ts";
import {
  bruteWithPistol,
  carnivalNoMaster,
  carnivalWithCartAtSeventeenWarriors,
  carnivalWithoutCartAtSeventeenWarriors,
  invalidCarnivalSkill,
  taintedWithTwoBlessings,
  taintedWithoutBlessing,
  tooManyCarnivalBrutes,
  tooManyPlagueBearers,
  tooManyPlagueCarts,
  tooManyTaintedOnes,
  validCarnivalOfChaos
} from "../tests/fixtures/carnivalRosters.ts";
import {
  fightingClawsWithSword,
  giantRatWithWeapon,
  invalidSkavenSkill,
  skavenNoAssassin,
  skavenTailFightingExtraWeapon,
  skavenTwoAssassins,
  skavenTooManyWeaponsWithoutTailFighting,
  skavenWithRatOgre,
  tooManyBlackSkaven,
  tooManyEshinSorcerers,
  tooManyNightRunners,
  tooManyRatOgres,
  tooManySkavenWarriors,
  validSkaven
} from "../tests/fixtures/skavenRosters.ts";
import {
  direWolfWithWeapon,
  ghoulWithArmour,
  invalidUndeadSkill,
  undeadNoVampire,
  undeadTooManyDireWolves,
  undeadTooManyDregs,
  undeadTooManyWarriors,
  undeadTwoVampires,
  validUndead,
  zombieWithWeapon
} from "../tests/fixtures/undeadRosters.ts";
import {
  ballAndChainWithShield,
  ballAndChainWithoutMushrooms,
  caveSquigWithWeapon,
  goblinWithBallAndChain,
  invalidOrcSkill,
  orcNoBoss,
  orcTwoBosses,
  shamanWithArmour,
  tooManyCaveSquigsForGoblins,
  tooManyCaveSquigsMaximum,
  tooManyGoblinWarriorsForOrcs,
  tooManyOrcBigUns,
  tooManyOrcShamans,
  tooManyTrolls,
  validOrcMob
} from "../tests/fixtures/orcRosters.ts";

const rulesDb = await loadRulesDb();

assert.deepEqual(getPendingAdvances(1, 4), [2, 4]);
assert.deepEqual(getPendingAdvances(4, 6), [6]);
assert.deepEqual(getPendingAdvances(6, 6), []);

assert.ok(getAllowedWarbands(rulesDb, { officialOnly: true }).some((warband) => warband.id === "witch-hunters"));

assert.doesNotMatch(codes(validStartingWitchHunters()).join(","), /REQUIRED_LEADER/);
assert.ok(codes(noCaptainWitchHunters()).includes("REQUIRED_LEADER"));
assert.ok(codes(twoCaptainWitchHunters()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManyWarriorsWitchHunters()).includes("MAX_WARRIORS"));
assert.ok(codes(tooManyWitchHunters()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyPriests()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyWarhounds()).includes("FIGHTER_MAX_COUNT"));
assert.equal(calculateRosterCost(validStartingWitchHunters(), rulesDb), 292);
assert.ok(codes(overspentWitchHunters()).includes("STARTING_TREASURY_OVERSPENT"));
assert.ok(codes(illegalEquipmentWitchHunters()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(tooManyCloseCombatWeapons()).includes("TOO_MANY_CLOSE_COMBAT_WEAPONS"));
assert.ok(codes(tooManyMissileWeapons()).includes("TOO_MANY_MISSILE_WEAPONS"));
assert.ok(!codes(legalBraceAndCrossbow()).includes("TOO_MANY_MISSILE_WEAPONS"));
assert.ok(codes(invalidHenchmanGroupWitchHunters()).includes("HENCHMAN_EQUIPMENT_UNIFORMITY"));
assert.equal(calculateWarbandRating(validStartingWitchHunters(), rulesDb), 88);
assert.ok(codes(invalidSkillWitchHunters()).includes("INVALID_SKILL"));

const roster = validStartingWitchHunters();
const equipmentOptions = getAllowedEquipment(roster.members[2], roster, rulesDb);
assert.equal(equipmentOptions.find((option) => option.item.id === "bow")?.allowed, false);
assert.equal(equipmentOptions.find((option) => option.item.id === "crossbow")?.allowed, true);

const captainSkills = getAllowedSkills(roster.members[0], roster, rulesDb);
const priestSkills = getAllowedSkills(roster.members[1], roster, rulesDb);
assert.equal(captainSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed, true);
assert.equal(priestSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed, false);
const stepAside = captainSkills.find((option) => option.item.id === "step-aside");
assert.match(stepAside?.item.effectSummary ?? "", /5\+ save/);
assert.equal(stepAside?.source?.sourceDocumentId, "mordheim-core-rules");
const priestPrayers = getAllowedSpecialRules(roster.members[1], roster, rulesDb);
const captainPrayers = getAllowedSpecialRules(roster.members[0], roster, rulesDb);
assert.equal(priestPrayers.find((option) => option.item.id === "sigmar-healing-hand")?.allowed, true);
assert.equal(captainPrayers.find((option) => option.item.id === "sigmar-healing-hand")?.allowed, false);
const witchHunterPrayerRoster = validStartingWitchHunters();
witchHunterPrayerRoster.members[1] = { ...witchHunterPrayerRoster.members[1], specialRules: ["sigmar-healing-hand"] };
assert.deepEqual(errorCodes(witchHunterPrayerRoster), []);
const invalidWitchHunterPrayerRoster = validStartingWitchHunters();
invalidWitchHunterPrayerRoster.members[0] = { ...invalidWitchHunterPrayerRoster.members[0], specialRules: ["sigmar-healing-hand"] };
assert.ok(codes(invalidWitchHunterPrayerRoster).includes("INVALID_SPECIAL_RULE"));

assert.ok(getAllowedFighterTypes("witch-hunters", roster, rulesDb).some((fighter) => fighter.id === "witch-hunter"));
assert.ok(!getAllowedFighterTypes("witch-hunters", tooManyWitchHunters(), rulesDb).some((fighter) => fighter.id === "witch-hunter"));

const allowedOfficialWarbands = getAllowedWarbands(rulesDb, { officialOnly: true }).map((warband) => warband.id);
assert.ok(allowedOfficialWarbands.includes("reiklanders"));
assert.ok(allowedOfficialWarbands.includes("middenheimers"));
assert.ok(allowedOfficialWarbands.includes("marienburgers"));
assert.deepEqual(errorCodes(validReiklanders()), []);
assert.deepEqual(errorCodes(validMiddenheimers()), []);
assert.deepEqual(errorCodes(validMarienburgers()), []);
assert.equal(calculateRosterCost(validReiklanders(), rulesDb), 254);
assert.equal(calculateWarbandRating(validReiklanders(), rulesDb), 63);
assert.ok(codes(mercenaryNoCaptain()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManyMercenaryWarriors()).includes("MAX_WARRIORS"));
assert.ok(codes(tooManyMercenaryMarksmen()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyMercenarySwordsmen()).includes("FIGHTER_MAX_COUNT"));
assert.equal(rulesDb.fighterTypes.find((fighter) => fighter.id === "reikland-marksman")?.profile.BS, 4);
assert.equal(rulesDb.fighterTypes.find((fighter) => fighter.id === "middenheim-mercenary-captain")?.profile.S, 4);
assert.equal(rulesDb.fighterTypes.find((fighter) => fighter.id === "middenheim-champion")?.profile.S, 4);
assert.equal(rulesDb.warbandTypes.find((warband) => warband.id === "marienburgers")?.startingGold, 600);
assert.ok(!errorCodes(marienburgExpensiveButLegal()).includes("STARTING_TREASURY_OVERSPENT"));
assert.ok(codes(reiklandOverspentWithMarienburgGear()).includes("STARTING_TREASURY_OVERSPENT"));
assert.ok(codes(mercenaryIllegalEquipment()).includes("INVALID_EQUIPMENT"));

const reiklandRoster = validReiklanders();
const warriorOptions = getAllowedEquipment(reiklandRoster.members[3], reiklandRoster, rulesDb);
const marksmanOptions = getAllowedEquipment(reiklandRoster.members[4], reiklandRoster, rulesDb);
assert.equal(warriorOptions.find((option) => option.item.id === "long-bow")?.allowed, false);
assert.equal(marksmanOptions.find((option) => option.item.id === "long-bow")?.allowed, true);
assert.equal(marksmanOptions.find((option) => option.item.id === "heavy-armour")?.allowed, false);

const reiklandChampionSkills = getAllowedSkills(validMercenaries("reikland").members[1], validMercenaries("reikland"), rulesDb);
const middenheimChampionSkills = getAllowedSkills(validMercenaries("middenheim").members[1], validMercenaries("middenheim"), rulesDb);
const marienburgChampionSkills = getAllowedSkills(validMercenaries("marienburg").members[1], validMercenaries("marienburg"), rulesDb);
assert.equal(reiklandChampionSkills.find((option) => option.item.id === "quick-shot")?.allowed, true);
assert.equal(reiklandChampionSkills.find((option) => option.item.id === "step-aside")?.allowed, false);
assert.equal(middenheimChampionSkills.find((option) => option.item.id === "quick-shot")?.allowed, false);
assert.equal(middenheimChampionSkills.find((option) => option.item.id === "step-aside")?.allowed, true);
assert.equal(marienburgChampionSkills.find((option) => option.item.id === "mighty-blow")?.allowed, false);
assert.equal(marienburgChampionSkills.find((option) => option.item.id === "step-aside")?.allowed, true);

assert.ok(allowedOfficialWarbands.includes("sisters-of-sigmar"));
assert.deepEqual(errorCodes(validSistersOfSigmar()), []);
assert.equal(calculateRosterCost(validSistersOfSigmar(), rulesDb), 249);
assert.equal(calculateWarbandRating(validSistersOfSigmar(), rulesDb), 63);
assert.ok(codes(sistersNoMatriarch()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManySisterSuperiors()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyAugurs()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyNovices()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManySistersWarriors()).includes("MAX_WARRIORS"));
assert.ok(codes(augurWithArmour()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(noviceWithHolyTome()).includes("INVALID_EQUIPMENT"));
assert.deepEqual(errorCodes(matriarchWithSpecialSkill()), []);
assert.ok(codes(sisterSuperiorWithMatriarchOnlySkill()).includes("INVALID_SKILL"));

const sistersRoster = validSistersOfSigmar();
const augurOptions = getAllowedEquipment(sistersRoster.members[2], sistersRoster, rulesDb);
const noviceOptions = getAllowedEquipment(sistersRoster.members[3], sistersRoster, rulesDb);
assert.equal(augurOptions.find((option) => option.item.id === "light-armour")?.allowed, false);
assert.equal(augurOptions.find((option) => option.item.id === "holy-tome")?.allowed, true);
assert.equal(noviceOptions.find((option) => option.item.id === "holy-tome")?.allowed, false);

const matriarchSkills = getAllowedSkills(sistersRoster.members[0], sistersRoster, rulesDb);
const superiorSkills = getAllowedSkills(sistersRoster.members[1], sistersRoster, rulesDb);
const augurSkills = getAllowedSkills(sistersRoster.members[2], sistersRoster, rulesDb);
assert.equal(matriarchSkills.find((option) => option.item.id === "utter-determination")?.allowed, true);
assert.equal(superiorSkills.find((option) => option.item.id === "utter-determination")?.allowed, false);
assert.equal(augurSkills.find((option) => option.item.id === "absolute-faith")?.allowed, true);
assert.equal(augurSkills.find((option) => option.item.id === "mighty-blow")?.allowed, false);
assert.equal(rulesDb.equipmentItems.find((item) => item.id === "sigmarite-warhammer")?.sourceDocumentId, "mhr-sisters-of-sigmar");
assert.ok(rulesDb.equipmentItems.find((item) => item.id === "sigmarite-warhammer")?.specialRuleIds.includes("sigmarite-warhammer-holy"));
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "blessed-sight")?.sourceDocumentId, "mhr-sisters-of-sigmar");
assert.equal(rulesDb.skills.find((skill) => skill.id === "sign-of-sigmar")?.sourceDocumentId, "mhr-sisters-of-sigmar");
const matriarchPrayers = getAllowedSpecialRules(sistersRoster.members[0], sistersRoster, rulesDb);
const superiorPrayers = getAllowedSpecialRules(sistersRoster.members[1], sistersRoster, rulesDb);
assert.equal(matriarchPrayers.find((option) => option.item.id === "sigmar-soulfire")?.allowed, true);
assert.equal(superiorPrayers.find((option) => option.item.id === "sigmar-soulfire")?.allowed, false);
const sistersPrayerRoster = validSistersOfSigmar();
sistersPrayerRoster.members[0] = { ...sistersPrayerRoster.members[0], specialRules: ["sigmar-soulfire"] };
assert.deepEqual(errorCodes(sistersPrayerRoster), []);

assert.ok(allowedOfficialWarbands.includes("carnival-of-chaos"));
assert.deepEqual(errorCodes(validCarnivalOfChaos()), []);
assert.equal(calculateRosterCost(validCarnivalOfChaos(), rulesDb), 321);
assert.equal(calculateWarbandRating(validCarnivalOfChaos(), rulesDb), 68);
assert.ok(codes(carnivalNoMaster()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManyCarnivalBrutes()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyTaintedOnes()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyPlagueBearers()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyPlagueCarts()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(taintedWithoutBlessing()).includes("REQUIRED_EQUIPMENT_OPTION"));
assert.deepEqual(errorCodes(taintedWithTwoBlessings()), []);
assert.equal(calculateRosterCost(taintedWithTwoBlessings(), rulesDb), 396);
assert.deepEqual(errorCodes(carnivalWithCartAtSeventeenWarriors()), []);
assert.ok(codes(carnivalWithoutCartAtSeventeenWarriors()).includes("MAX_WARRIORS"));
assert.ok(codes(bruteWithPistol()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(invalidCarnivalSkill()).includes("INVALID_SKILL"));

const carnivalRoster = validCarnivalOfChaos();
const bruteOptions = getAllowedEquipment(carnivalRoster.members[1], carnivalRoster, rulesDb);
const taintedOptions = getAllowedEquipment(carnivalRoster.members[2], carnivalRoster, rulesDb);
assert.equal(bruteOptions.find((option) => option.item.id === "pistol")?.allowed, false);
assert.equal(bruteOptions.find((option) => option.item.id === "carnival-flail")?.allowed, true);
assert.equal(taintedOptions.find((option) => option.item.id === "blessing-nurgles-rot")?.allowed, true);

const masterSkills = getAllowedSkills(carnivalRoster.members[0], carnivalRoster, rulesDb);
const bruteSkills = getAllowedSkills(carnivalRoster.members[1], carnivalRoster, rulesDb);
const taintedSkills = getAllowedSkills(carnivalRoster.members[2], carnivalRoster, rulesDb);
assert.equal(masterSkills.find((option) => option.item.id === "sorcery")?.allowed, true);
assert.equal(bruteSkills.find((option) => option.item.id === "mighty-blow")?.allowed, true);
assert.equal(bruteSkills.find((option) => option.item.id === "quick-shot")?.allowed, false);
assert.equal(taintedSkills.find((option) => option.item.id === "step-aside")?.allowed, true);
assert.equal(taintedSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed, false);
assert.equal(rulesDb.equipmentItems.find((item) => item.id === "blessing-nurgles-rot")?.sourceDocumentId, "eif-empire-in-flames");
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "nurgle-rituals")?.sourceDocumentId, "eif-empire-in-flames");
assert.equal(rulesDb.skills.find((skill) => skill.id === "strongman")?.sourceDocumentId, "mordheim-core-rules");
const masterRituals = getAllowedSpecialRules(carnivalRoster.members[0], carnivalRoster, rulesDb);
const bruteRituals = getAllowedSpecialRules(carnivalRoster.members[1], carnivalRoster, rulesDb);
assert.equal(masterRituals.find((option) => option.item.id === "nurgle-buboes")?.allowed, true);
assert.equal(bruteRituals.find((option) => option.item.id === "nurgle-buboes")?.allowed, false);

assert.ok(allowedOfficialWarbands.includes("skaven"));
assert.deepEqual(errorCodes(validSkaven()), []);
assert.equal(calculateRosterCost(validSkaven(), rulesDb), 299);
assert.equal(calculateWarbandRating(validSkaven(), rulesDb), 76);
assert.ok(codes(skavenNoAssassin()).includes("REQUIRED_LEADER"));
assert.ok(codes(skavenTwoAssassins()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManySkavenWarriors()).includes("MAX_WARRIORS"));
assert.ok(codes(tooManyBlackSkaven()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyEshinSorcerers()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyNightRunners()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyRatOgres()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(giantRatWithWeapon()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(fightingClawsWithSword()).includes("CANNOT_COMBINE_WEAPONS"));
assert.ok(codes(skavenTooManyWeaponsWithoutTailFighting()).includes("TOO_MANY_CLOSE_COMBAT_WEAPONS"));
assert.deepEqual(errorCodes(skavenTailFightingExtraWeapon()), []);
assert.deepEqual(errorCodes(skavenWithRatOgre()), []);
assert.equal(calculateWarbandRating(skavenWithRatOgre(), rulesDb), 55);
assert.ok(codes(invalidSkavenSkill()).includes("INVALID_SKILL"));

const skavenRoster = validSkaven();
const assassinOptions = getAllowedEquipment({ ...skavenRoster.members[0], equipment: [] }, skavenRoster, rulesDb);
const nightRunnerOptions = getAllowedEquipment(skavenRoster.members[3], skavenRoster, rulesDb);
const giantRatOptions = getAllowedEquipment(skavenRoster.members[5], skavenRoster, rulesDb);
assert.equal(assassinOptions.find((option) => option.item.id === "fighting-claws")?.allowed, true);
assert.equal(assassinOptions.find((option) => option.item.id === "club")?.allowed, false);
assert.equal(nightRunnerOptions.find((option) => option.item.id === "club")?.allowed, true);
assert.equal(nightRunnerOptions.find((option) => option.item.id === "weeping-blades")?.allowed, false);
assert.equal(giantRatOptions.find((option) => option.item.id === "club")?.allowed, false);

const adeptSkills = getAllowedSkills(skavenRoster.members[0], skavenRoster, rulesDb);
const sorcererSkills = getAllowedSkills(skavenRoster.members[1], skavenRoster, rulesDb);
const blackSkavenSkills = getAllowedSkills(skavenRoster.members[2], skavenRoster, rulesDb);
const nightRunnerSkills = getAllowedSkills(skavenRoster.members[3], skavenRoster, rulesDb);
assert.equal(adeptSkills.find((option) => option.item.id === "battle-tongue")?.allowed, true);
assert.equal(sorcererSkills.find((option) => option.item.id === "sorcery")?.allowed, true);
assert.equal(sorcererSkills.find((option) => option.item.id === "mighty-blow")?.allowed, false);
assert.equal(blackSkavenSkills.find((option) => option.item.id === "black-hunger")?.allowed, true);
assert.equal(blackSkavenSkills.find((option) => option.item.id === "wyrdstone-hunter")?.allowed, false);
assert.equal(nightRunnerSkills.find((option) => option.item.id === "infiltration")?.allowed, true);
assert.equal(nightRunnerSkills.find((option) => option.item.id === "step-aside")?.allowed, false);
assert.equal(rulesDb.equipmentItems.find((item) => item.id === "blowpipe")?.sourceDocumentId, "mhr-skaven");
assert.ok(rulesDb.equipmentItems.find((item) => item.id === "blowpipe")?.specialRuleIds.includes("blowpipe-stealthy"));
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "magic-of-the-horned-rat")?.sourceDocumentId, "mhr-skaven");
assert.ok(rulesDb.specialRules.find((rule) => rule.id === "magic-of-the-horned-rat")?.relatedRuleIds.includes("horned-rat-warpfire"));
assert.match(rulesDb.specialRules.find((rule) => rule.id === "horned-rat-warpfire")?.effectSummary ?? "", /Difficulty 8/);
assert.equal(rulesDb.skills.find((skill) => skill.id === "black-hunger")?.sourceDocumentId, "mhr-skaven");
const sorcererSpells = getAllowedSpecialRules(skavenRoster.members[1], skavenRoster, rulesDb);
const adeptSpells = getAllowedSpecialRules(skavenRoster.members[0], skavenRoster, rulesDb);
assert.equal(sorcererSpells.find((option) => option.item.id === "horned-rat-warpfire")?.allowed, true);
assert.equal(adeptSpells.find((option) => option.item.id === "horned-rat-warpfire")?.allowed, false);

assert.ok(allowedOfficialWarbands.includes("undead"));
assert.deepEqual(errorCodes(validUndead()), []);
assert.equal(calculateRosterCost(validUndead(), rulesDb), 310);
assert.equal(calculateWarbandRating(validUndead(), rulesDb), 68);
assert.ok(codes(undeadNoVampire()).includes("REQUIRED_LEADER"));
assert.ok(codes(undeadTwoVampires()).includes("REQUIRED_LEADER"));
assert.ok(codes(undeadTooManyWarriors()).includes("MAX_WARRIORS"));
assert.ok(codes(undeadTooManyDregs()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(undeadTooManyDireWolves()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(zombieWithWeapon()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(ghoulWithArmour()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(direWolfWithWeapon()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(invalidUndeadSkill()).includes("INVALID_SKILL"));

const undeadRoster = validUndead();
const vampireOptions = getAllowedEquipment(undeadRoster.members[0], undeadRoster, rulesDb);
const zombieOptions = getAllowedEquipment(undeadRoster.members[3], undeadRoster, rulesDb);
assert.equal(vampireOptions.find((option) => option.item.id === "halberd")?.allowed, true);
assert.equal(vampireOptions.find((option) => option.item.id === "pistol")?.allowed, false);
assert.equal(zombieOptions.find((option) => option.item.id === "dagger")?.allowed, false);

const vampireSkills = getAllowedSkills(undeadRoster.members[0], undeadRoster, rulesDb);
const necromancerSkills = getAllowedSkills(undeadRoster.members[1], undeadRoster, rulesDb);
const dregSkills = getAllowedSkills(undeadRoster.members[2], undeadRoster, rulesDb);
assert.equal(vampireSkills.find((option) => option.item.id === "mighty-blow")?.allowed, true);
assert.equal(vampireSkills.find((option) => option.item.id === "quick-shot")?.allowed, false);
assert.equal(necromancerSkills.find((option) => option.item.id === "sorcery")?.allowed, true);
assert.equal(necromancerSkills.find((option) => option.item.id === "mighty-blow")?.allowed, false);
assert.equal(dregSkills.find((option) => option.item.id === "mighty-blow")?.allowed, true);
assert.equal(dregSkills.find((option) => option.item.id === "step-aside")?.allowed, false);
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "necromancy")?.sourceDocumentId, "mordheim-core-rules");
assert.ok(rulesDb.specialRules.find((rule) => rule.id === "necromancy")?.relatedRuleIds.includes("necromancy-lifestealer"));
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "no-pain")?.sourceDocumentId, "mhr-undead");
const necromancySpells = getAllowedSpecialRules(undeadRoster.members[1], undeadRoster, rulesDb);
const vampireSpells = getAllowedSpecialRules(undeadRoster.members[0], undeadRoster, rulesDb);
assert.equal(necromancySpells.find((option) => option.item.id === "necromancy-lifestealer")?.allowed, true);
assert.equal(vampireSpells.find((option) => option.item.id === "necromancy-lifestealer")?.allowed, false);

assert.ok(allowedOfficialWarbands.includes("orc-mob"));
assert.deepEqual(errorCodes(validOrcMob()), []);
assert.equal(calculateRosterCost(validOrcMob(), rulesDb), 290);
assert.equal(calculateWarbandRating(validOrcMob(), rulesDb), 85);
assert.ok(codes(orcNoBoss()).includes("REQUIRED_LEADER"));
assert.ok(codes(orcTwoBosses()).includes("REQUIRED_LEADER"));
assert.ok(codes(tooManyOrcShamans()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyOrcBigUns()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyGoblinWarriorsForOrcs()).includes("FIGHTER_RATIO_LIMIT"));
assert.ok(codes(tooManyCaveSquigsForGoblins()).includes("FIGHTER_RATIO_LIMIT"));
assert.ok(codes(tooManyCaveSquigsMaximum()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(tooManyTrolls()).includes("FIGHTER_MAX_COUNT"));
assert.ok(codes(shamanWithArmour()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(caveSquigWithWeapon()).includes("INVALID_EQUIPMENT"));
assert.ok(codes(ballAndChainWithoutMushrooms()).includes("MISSING_REQUIRED_EQUIPMENT"));
assert.ok(codes(ballAndChainWithShield()).includes("CANNOT_COMBINE_EQUIPMENT"));
assert.deepEqual(errorCodes(goblinWithBallAndChain()), []);
assert.ok(codes(invalidOrcSkill()).includes("INVALID_SKILL"));

const orcRoster = validOrcMob();
const bossOptions = getAllowedEquipment(orcRoster.members[0], orcRoster, rulesDb);
const shamanOptions = getAllowedEquipment(orcRoster.members[1], orcRoster, rulesDb);
const goblinOptions = getAllowedEquipment(orcRoster.members[4], orcRoster, rulesDb);
const goblinWithMushroomsOptions = getAllowedEquipment({ ...orcRoster.members[4], equipment: ["mad-cap-mushrooms"] }, orcRoster, rulesDb);
const squigOptions = getAllowedEquipment(orcRoster.members[5], orcRoster, rulesDb);
assert.equal(bossOptions.find((option) => option.item.id === "crossbow")?.allowed, true);
assert.equal(shamanOptions.find((option) => option.item.id === "light-armour")?.allowed, false);
assert.equal(goblinOptions.find((option) => option.item.id === "mad-cap-mushrooms")?.allowed, true);
assert.equal(goblinOptions.find((option) => option.item.id === "ball-and-chain")?.allowed, false);
assert.equal(goblinWithMushroomsOptions.find((option) => option.item.id === "ball-and-chain")?.allowed, true);
assert.equal(squigOptions.find((option) => option.item.id === "dagger")?.allowed, false);

const bossSkills = getAllowedSkills(orcRoster.members[0], orcRoster, rulesDb);
const shamanSkills = getAllowedSkills(orcRoster.members[1], orcRoster, rulesDb);
const bigUnSkills = getAllowedSkills(orcRoster.members[2], orcRoster, rulesDb);
assert.equal(bossSkills.find((option) => option.item.id === "da-cunnin-plan")?.allowed, true);
assert.equal(shamanSkills.find((option) => option.item.id === "sorcery")?.allowed, false);
assert.equal(shamanSkills.find((option) => option.item.id === "waaagh-charge")?.allowed, true);
assert.equal(bigUnSkills.find((option) => option.item.id === "da-cunnin-plan")?.allowed, false);
assert.equal(bigUnSkills.find((option) => option.item.id === "eadbasher")?.allowed, true);
assert.equal(rulesDb.specialRules.find((rule) => rule.id === "waaagh-magic")?.sourceDocumentId, "mhr-orc-mob");
assert.ok(rulesDb.specialRules.find((rule) => rule.id === "waaagh-magic")?.relatedRuleIds.includes("waaagh-zzap"));
assert.equal(rulesDb.skills.find((skill) => skill.id === "eadbasher")?.sourceDocumentId, "mhr-orc-mob");
const shamanSpells = getAllowedSpecialRules(orcRoster.members[1], orcRoster, rulesDb);
const bossSpells = getAllowedSpecialRules(orcRoster.members[0], orcRoster, rulesDb);
assert.equal(shamanSpells.find((option) => option.item.id === "waaagh-zzap")?.allowed, true);
assert.equal(bossSpells.find((option) => option.item.id === "waaagh-zzap")?.allowed, false);

console.log("Rules engine verification passed.");

function codes(roster) {
  return validateRoster(roster, rulesDb).map((issue) => issue.code);
}

function errorCodes(roster) {
  return validateRoster(roster, rulesDb)
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.code);
}

async function loadRulesDb() {
  const [sourceDocuments, equipmentItems, skillSeed, specialRules, hiredSwords, ruleReferences, witchHunters, mercenaries, sisters, carnival, skaven, undead, orcMob] = await Promise.all([
    readJson("../src/data/sources.json"),
    readJson("../src/data/equipment.json"),
    readJson("../src/data/skills.json"),
    readJson("../src/data/specialRules.json"),
    readJson("../src/data/hiredSwords.json"),
    readJson("../src/data/ruleReferences.json"),
    readJson("../src/data/warbands/witch-hunters.json"),
    readJson("../src/data/warbands/mercenaries.json"),
    readJson("../src/data/warbands/sisters-of-sigmar.json"),
    readJson("../src/data/warbands/carnival-of-chaos.json"),
    readJson("../src/data/warbands/skaven.json"),
    readJson("../src/data/warbands/undead.json"),
    readJson("../src/data/warbands/orc-mob.json")
  ]);
  const warbandSeed = warbandSeedSchema.parse(witchHunters);
  const sistersSeed = warbandSeedSchema.parse(sisters);
  const carnivalSeed = warbandSeedSchema.parse(carnival);
  const skavenSeed = warbandSeedSchema.parse(skaven);
  const undeadSeed = warbandSeedSchema.parse(undead);
  const orcMobSeed = warbandSeedSchema.parse(orcMob);
  const mercenarySeed = warbandSeedCollectionSchema.parse(mercenaries);
  return rulesDbSchema.parse({
    sourceDocuments,
    warbandTypes: [warbandSeed.warbandType, sistersSeed.warbandType, carnivalSeed.warbandType, skavenSeed.warbandType, undeadSeed.warbandType, orcMobSeed.warbandType, ...mercenarySeed.warbandTypes],
    fighterTypes: [...warbandSeed.fighterTypes, ...sistersSeed.fighterTypes, ...carnivalSeed.fighterTypes, ...skavenSeed.fighterTypes, ...undeadSeed.fighterTypes, ...orcMobSeed.fighterTypes, ...mercenarySeed.fighterTypes],
    equipmentItems,
    equipmentLists: [...warbandSeed.equipmentLists, ...sistersSeed.equipmentLists, ...carnivalSeed.equipmentLists, ...skavenSeed.equipmentLists, ...undeadSeed.equipmentLists, ...orcMobSeed.equipmentLists, ...mercenarySeed.equipmentLists],
    skillCategories: skillSeed.categories,
    skills: skillSeed.skills,
    specialRules,
    hiredSwords,
    ruleReferences
  });
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(new URL(relativePath, import.meta.url), "utf8"));
}
