import type { Roster, RosterMember } from "../../src/rules/types";

const now = "2026-04-28T00:00:00.000Z";

export function validUndead(): Roster {
  return {
    id: "roster-undead",
    name: "Drakenhof Night Watch",
    warbandTypeId: "undead",
    treasuryGold: 500,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: [
      hero("vampire", "vampire", "Count Orlok", 20, ["dagger", "sword"], ["leader", "fear", "undead-immune-to-psychology", "immune-to-poison", "no-pain"]),
      hero("necromancer", "necromancer", "Morbius", 8, ["dagger"], ["spellcaster", "necromancy"]),
      hero("dreg", "dreg", "Igor", 0, ["dagger", "bow"]),
      henchmen("zombies", "zombie", "Shambling Dead", 3, []),
      henchmen("ghouls", "ghoul", "Crypt Eaters", 2, [])
    ],
    campaignLog: [],
    claimedCost: 310,
    claimedWarbandRating: 68,
    isDraft: false,
    createdAt: now,
    updatedAt: now
  };
}

export function undeadNoVampire(): Roster {
  const roster = validUndead();
  roster.members = roster.members.filter((member) => member.fighterTypeId !== "vampire");
  return roster;
}

export function undeadTwoVampires(): Roster {
  const roster = validUndead();
  roster.members.push(hero("vampire-2", "vampire", "Second Vampire", 20, ["dagger"], ["leader", "fear", "undead-immune-to-psychology", "immune-to-poison", "no-pain"]));
  return roster;
}

export function undeadTooManyDregs(): Roster {
  const roster = validUndead();
  roster.members.push(hero("dreg-2", "dreg", "Second Dreg", 0, ["dagger"]));
  roster.members.push(hero("dreg-3", "dreg", "Third Dreg", 0, ["dagger"]));
  roster.members.push(hero("dreg-4", "dreg", "Fourth Dreg", 0, ["dagger"]));
  return roster;
}

export function undeadTooManyDireWolves(): Roster {
  const roster = validUndead();
  roster.members.push(henchmen("wolves", "dire-wolf", "Grave Hounds", 6, []));
  return roster;
}

export function undeadTooManyWarriors(): Roster {
  const roster = validUndead();
  roster.members[3] = henchmen("zombies", "zombie", "Shambling Dead", 5, []);
  roster.members[4] = henchmen("ghouls", "ghoul", "Crypt Eaters", 5, []);
  roster.members.push(henchmen("wolves", "dire-wolf", "Grave Hounds", 4, []));
  return roster;
}

export function zombieWithWeapon(): Roster {
  const roster = validUndead();
  roster.members[3] = {
    ...roster.members[3],
    equipment: ["dagger"]
  };
  return roster;
}

export function ghoulWithArmour(): Roster {
  const roster = validUndead();
  roster.members[4] = {
    ...roster.members[4],
    equipment: ["light-armour"]
  };
  return roster;
}

export function direWolfWithWeapon(): Roster {
  const roster = validUndead();
  roster.members.push(henchmen("wolf", "dire-wolf", "Lone Hound", 1, ["dagger"]));
  return roster;
}

export function invalidUndeadSkill(): Roster {
  const roster = validUndead();
  roster.members[2] = {
    ...roster.members[2],
    skills: ["quick-shot"]
  };
  return roster;
}

function hero(
  id: string,
  fighterTypeId: string,
  displayName: string,
  experience: number,
  equipment: string[],
  specialRules: string[] = [],
  skills: string[] = []
): RosterMember {
  return member(id, fighterTypeId, displayName, "hero", 1, experience, equipment, specialRules, skills);
}

function henchmen(id: string, fighterTypeId: string, displayName: string, groupSize: number, equipment: string[]): RosterMember {
  return member(id, fighterTypeId, displayName, "henchman_group", groupSize, 0, equipment, [], []);
}

function member(
  id: string,
  fighterTypeId: string,
  displayName: string,
  kind: RosterMember["kind"],
  groupSize: number,
  experience: number,
  equipment: string[],
  specialRules: string[],
  skills: string[]
): RosterMember {
  return {
    id,
    rosterId: "roster-undead",
    fighterTypeId,
    displayName,
    kind,
    groupSize,
    currentProfile: profileFor(fighterTypeId),
    experience,
    advances: [],
    advancesTaken: [],
    injuries: [],
    equipment,
    skills,
    specialRules,
    notes: "",
    status: "active"
  };
}

function profileFor(fighterTypeId: string): RosterMember["currentProfile"] {
  const profiles: Record<string, RosterMember["currentProfile"]> = {
    vampire: { M: 6, WS: 4, BS: 4, S: 4, T: 4, W: 2, I: 5, A: 2, Ld: 8 },
    necromancer: { M: 4, WS: 3, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    dreg: { M: 4, WS: 2, BS: 2, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    zombie: { M: 4, WS: 2, BS: 0, S: 3, T: 3, W: 1, I: 1, A: 1, Ld: 5 },
    ghoul: { M: 4, WS: 2, BS: 2, S: 3, T: 4, W: 1, I: 3, A: 2, Ld: 5 },
    "dire-wolf": { M: 9, WS: 3, BS: 0, S: 4, T: 3, W: 1, I: 2, A: 1, Ld: 4 }
  };
  return profiles[fighterTypeId];
}
