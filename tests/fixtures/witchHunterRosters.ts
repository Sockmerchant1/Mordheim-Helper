import type { Roster, RosterMember } from "../../src/rules/types";

const now = "2026-04-28T00:00:00.000Z";

export function validStartingWitchHunters(): Roster {
  return {
    id: "roster-valid-wh",
    name: "Ashen Bell Company",
    warbandTypeId: "witch-hunters",
    treasuryGold: 208,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: [
      hero("captain", "witch-hunter-captain", "Captain Holt", 20, ["dagger", "hammer", "brace-of-pistols"]),
      hero("priest", "warrior-priest", "Brother Odo", 12, ["dagger", "hammer"]),
      hero("hunter-1", "witch-hunter", "Elsbeth", 8, ["dagger", "crossbow"]),
      hero("hunter-2", "witch-hunter", "Markus", 8, ["dagger", "axe"]),
      henchmen("zealots", "zealot", "Lantern Zealots", 2, ["dagger", "mace"]),
      henchmen("hounds", "warhound", "Cinder Hounds", 2, [])
    ],
    campaignLog: [],
    claimedCost: 292,
    claimedWarbandRating: 88,
    isDraft: false,
    createdAt: now,
    updatedAt: now
  };
}

export function overspentWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.name = "Overspent Hunters";
  roster.members.push(henchmen("flagellants", "flagellant", "Red Ropes", 5, ["flail"]));
  roster.claimedCost = undefined;
  return roster;
}

export function tooManyWarriorsWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.name = "Crowded Hunters";
  roster.members.push(henchmen("more-zealots", "zealot", "Back Alley Zealots", 5, ["dagger"]));
  roster.members.push(henchmen("more-hounds", "warhound", "Extra Hounds", 3, []));
  return roster;
}

export function illegalEquipmentWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.name = "Illegal Bow";
  roster.members[2] = {
    ...roster.members[2],
    equipment: ["dagger", "bow"]
  };
  return roster;
}

export function invalidHenchmanGroupWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.name = "Mixed Zealots";
  roster.members[4] = {
    ...roster.members[4],
    perModelEquipment: [
      ["dagger", "mace"],
      ["dagger", "axe"]
    ]
  };
  return roster;
}

export function invalidSkillWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.name = "Bad Book";
  roster.members[1] = {
    ...roster.members[1],
    skills: ["wyrdstone-hunter"]
  };
  return roster;
}

export function noCaptainWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.members = roster.members.filter((member) => member.fighterTypeId !== "witch-hunter-captain");
  return roster;
}

export function twoCaptainWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.members.push(hero("captain-2", "witch-hunter-captain", "Captain Duplicate", 20, ["dagger"]));
  return roster;
}

export function tooManyWitchHunters(): Roster {
  const roster = validStartingWitchHunters();
  roster.members.push(hero("hunter-3", "witch-hunter", "Tobias", 8, ["dagger"]));
  roster.members.push(hero("hunter-4", "witch-hunter", "Anna", 8, ["dagger"]));
  return roster;
}

export function tooManyPriests(): Roster {
  const roster = validStartingWitchHunters();
  roster.members.push(hero("priest-2", "warrior-priest", "Brother Duplicate", 12, ["dagger"]));
  return roster;
}

export function tooManyWarhounds(): Roster {
  const roster = validStartingWitchHunters();
  roster.members[5] = henchmen("hounds", "warhound", "Cinder Hounds", 6, []);
  return roster;
}

export function tooManyCloseCombatWeapons(): Roster {
  const roster = validStartingWitchHunters();
  roster.members[0] = {
    ...roster.members[0],
    equipment: ["dagger", "hammer", "axe", "sword"]
  };
  return roster;
}

export function tooManyMissileWeapons(): Roster {
  const roster = validStartingWitchHunters();
  roster.members[0] = {
    ...roster.members[0],
    equipment: ["dagger", "crossbow", "pistol", "brace-of-pistols"]
  };
  return roster;
}

export function legalBraceAndCrossbow(): Roster {
  const roster = validStartingWitchHunters();
  roster.members[0] = {
    ...roster.members[0],
    equipment: ["dagger", "crossbow", "brace-of-pistols"]
  };
  return roster;
}

function hero(
  id: string,
  fighterTypeId: string,
  displayName: string,
  experience: number,
  equipment: string[]
): RosterMember {
  return member(id, fighterTypeId, displayName, "hero", 1, experience, equipment);
}

function henchmen(
  id: string,
  fighterTypeId: string,
  displayName: string,
  groupSize: number,
  equipment: string[]
): RosterMember {
  return member(id, fighterTypeId, displayName, "henchman_group", groupSize, 0, equipment);
}

function member(
  id: string,
  fighterTypeId: string,
  displayName: string,
  kind: RosterMember["kind"],
  groupSize: number,
  experience: number,
  equipment: string[]
): RosterMember {
  const profileByType: Record<string, RosterMember["currentProfile"]> = {
    "witch-hunter-captain": { M: 4, WS: 4, BS: 4, S: 3, T: 3, W: 1, I: 4, A: 1, Ld: 8 },
    "warrior-priest": { M: 4, WS: 3, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 8 },
    "witch-hunter": { M: 4, WS: 3, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    zealot: { M: 4, WS: 2, BS: 2, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    flagellant: { M: 4, WS: 3, BS: 3, S: 4, T: 4, W: 1, I: 3, A: 1, Ld: 10 },
    warhound: { M: 6, WS: 4, BS: 0, S: 4, T: 3, W: 1, I: 4, A: 1, Ld: 5 }
  };

  return {
    id,
    rosterId: "roster-valid-wh",
    fighterTypeId,
    displayName,
    kind,
    groupSize,
    currentProfile: profileByType[fighterTypeId],
    experience,
    advances: [],
    injuries: [],
    equipment,
    skills: [],
    specialRules: [],
    notes: "",
    status: "active"
  };
}
