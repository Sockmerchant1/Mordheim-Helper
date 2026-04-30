import type { Roster, RosterMember } from "../../src/rules/types";

const now = "2026-04-28T00:00:00.000Z";

export function validOrcMob(): Roster {
  return {
    id: "roster-orc-mob",
    name: "Grubnash's Ladz",
    warbandTypeId: "orc-mob",
    treasuryGold: 500,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: [
      hero("boss", "orc-boss", "Grubnash", 20, ["dagger", "sword"], ["leader"]),
      hero("shaman", "orc-shaman", "Old Git", 10, ["dagger"], ["spellcaster", "waaagh-magic"]),
      hero("big-un", "orc-big-un", "Snagga", 15, ["dagger", "axe"]),
      henchmen("boyz", "orc-boy", "Da Boyz", 2, ["dagger", "axe"]),
      henchmen("goblins", "goblin-warrior", "Stikkits", 2, ["dagger", "short-bow"]),
      henchmen("squigs", "cave-squig", "Biters", 1, [])
    ],
    campaignLog: [],
    claimedCost: 290,
    claimedWarbandRating: 85,
    isDraft: false,
    createdAt: now,
    updatedAt: now
  };
}

export function orcNoBoss(): Roster {
  const roster = validOrcMob();
  roster.members = roster.members.filter((member) => member.fighterTypeId !== "orc-boss");
  return roster;
}

export function orcTwoBosses(): Roster {
  const roster = validOrcMob();
  roster.members.push(hero("boss-2", "orc-boss", "Second Boss", 20, ["dagger"], ["leader"]));
  return roster;
}

export function tooManyOrcShamans(): Roster {
  const roster = validOrcMob();
  roster.members.push(hero("shaman-2", "orc-shaman", "Other Git", 10, ["dagger"], ["spellcaster", "waaagh-magic"]));
  return roster;
}

export function tooManyOrcBigUns(): Roster {
  const roster = validOrcMob();
  roster.members.push(hero("big-un-2", "orc-big-un", "Second Big 'Un", 15, ["dagger"]));
  roster.members.push(hero("big-un-3", "orc-big-un", "Third Big 'Un", 15, ["dagger"]));
  return roster;
}

export function tooManyGoblinWarriorsForOrcs(): Roster {
  const roster = baseOrcRoster("too-many-goblins", "Too Many Goblins");
  roster.members = [
    hero("boss", "orc-boss", "Grubnash", 20, ["dagger"], ["leader"]),
    henchmen("goblins", "goblin-warrior", "Too Many Stikkits", 3, ["dagger"])
  ];
  return roster;
}

export function tooManyCaveSquigsForGoblins(): Roster {
  const roster = baseOrcRoster("too-many-squigs", "Too Many Squigs");
  roster.members = [
    hero("boss", "orc-boss", "Grubnash", 20, ["dagger"], ["leader"]),
    henchmen("goblins", "goblin-warrior", "Stikkit", 1, ["dagger"]),
    henchmen("squigs", "cave-squig", "Too Many Biters", 2, [])
  ];
  return roster;
}

export function tooManyCaveSquigsMaximum(): Roster {
  const roster = validOrcMob();
  roster.members.push(henchmen("squigs-2", "cave-squig", "More Biters", 5, []));
  return roster;
}

export function tooManyTrolls(): Roster {
  const roster = validOrcMob();
  roster.members.push(henchmen("troll-1", "troll", "Gorbad", 1, []));
  roster.members.push(henchmen("troll-2", "troll", "Gorbad's Mate", 1, []));
  return roster;
}

export function shamanWithArmour(): Roster {
  const roster = validOrcMob();
  roster.members[1] = {
    ...roster.members[1],
    equipment: ["dagger", "light-armour"]
  };
  return roster;
}

export function caveSquigWithWeapon(): Roster {
  const roster = validOrcMob();
  roster.members[5] = {
    ...roster.members[5],
    equipment: ["dagger"]
  };
  return roster;
}

export function ballAndChainWithoutMushrooms(): Roster {
  const roster = validOrcMob();
  roster.members[4] = {
    ...roster.members[4],
    equipment: ["ball-and-chain"]
  };
  return roster;
}

export function ballAndChainWithShield(): Roster {
  const roster = validOrcMob();
  roster.members[4] = {
    ...roster.members[4],
    equipment: ["mad-cap-mushrooms", "ball-and-chain", "shield"]
  };
  return roster;
}

export function goblinWithBallAndChain(): Roster {
  const roster = validOrcMob();
  roster.members[4] = {
    ...roster.members[4],
    groupSize: 1,
    equipment: ["mad-cap-mushrooms", "ball-and-chain"]
  };
  roster.claimedCost = undefined;
  roster.claimedWarbandRating = undefined;
  return roster;
}

export function invalidOrcSkill(): Roster {
  const roster = validOrcMob();
  roster.members[2] = {
    ...roster.members[2],
    skills: ["da-cunnin-plan"]
  };
  return roster;
}

function baseOrcRoster(id: string, name: string): Roster {
  return {
    id: `roster-orc-${id}`,
    name,
    warbandTypeId: "orc-mob",
    treasuryGold: 500,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: [],
    campaignLog: [],
    isDraft: false,
    createdAt: now,
    updatedAt: now
  };
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
    rosterId: "roster-orc-mob",
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
    "orc-boss": { M: 4, WS: 4, BS: 4, S: 4, T: 4, W: 1, I: 3, A: 1, Ld: 8 },
    "orc-shaman": { M: 4, WS: 3, BS: 3, S: 3, T: 4, W: 1, I: 3, A: 1, Ld: 7 },
    "orc-big-un": { M: 4, WS: 4, BS: 3, S: 3, T: 4, W: 1, I: 3, A: 1, Ld: 7 },
    "orc-boy": { M: 4, WS: 3, BS: 3, S: 3, T: 4, W: 1, I: 2, A: 1, Ld: 7 },
    "goblin-warrior": { M: 4, WS: 2, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 5 },
    "cave-squig": { M: 0, WS: 4, BS: 0, S: 4, T: 3, W: 1, I: 4, A: 1, Ld: 5 },
    troll: { M: 6, WS: 3, BS: 1, S: 5, T: 4, W: 3, I: 1, A: 3, Ld: 4 }
  };
  return profiles[fighterTypeId];
}
