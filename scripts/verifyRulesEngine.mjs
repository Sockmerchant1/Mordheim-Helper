import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { rulesDbSchema, warbandSeedCollectionSchema, warbandSeedSchema } from "../src/rules/schemas.ts";
import {
  calculateRosterCost,
  calculateWarbandRating,
  getAllowedEquipment,
  getAllowedFighterTypes,
  getAllowedSkills,
  getAllowedWarbands,
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

const rulesDb = await loadRulesDb();

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
  const [sourceDocuments, equipmentItems, skillSeed, specialRules, hiredSwords, ruleReferences, witchHunters, mercenaries] = await Promise.all([
    readJson("../src/data/sources.json"),
    readJson("../src/data/equipment.json"),
    readJson("../src/data/skills.json"),
    readJson("../src/data/specialRules.json"),
    readJson("../src/data/hiredSwords.json"),
    readJson("../src/data/ruleReferences.json"),
    readJson("../src/data/warbands/witch-hunters.json"),
    readJson("../src/data/warbands/mercenaries.json")
  ]);
  const warbandSeed = warbandSeedSchema.parse(witchHunters);
  const mercenarySeed = warbandSeedCollectionSchema.parse(mercenaries);
  return rulesDbSchema.parse({
    sourceDocuments,
    warbandTypes: [warbandSeed.warbandType, ...mercenarySeed.warbandTypes],
    fighterTypes: [...warbandSeed.fighterTypes, ...mercenarySeed.fighterTypes],
    equipmentItems,
    equipmentLists: [...warbandSeed.equipmentLists, ...mercenarySeed.equipmentLists],
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
