import type { Roster, RosterMember } from "../../src/rules/types";

const now = "2026-04-28T00:00:00.000Z";

export function validSistersOfSigmar(): Roster {
  return {
    id: "roster-sisters",
    name: "Rock of Mercy",
    warbandTypeId: "sisters-of-sigmar",
    treasuryGold: 500,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: [
      hero("matriarch", "sigmarite-matriarch", "Mother Adelheid", 20, ["dagger", "sigmarite-warhammer"]),
      hero("superior", "sister-superior", "Sister Magda", 8, ["dagger", "steel-whip"]),
      hero("augur", "augur", "Blind Hanna", 0, ["dagger", "sling"]),
      henchmen("novices", "novice", "Novices", 2, ["dagger", "hammer"]),
      henchmen("sisters", "sigmarite-sister", "Sisters", 2, ["dagger", "mace"])
    ],
    campaignLog: [],
    claimedCost: 238,
    claimedWarbandRating: 63,
    isDraft: false,
    createdAt: now,
    updatedAt: now
  };
}

export function sistersNoMatriarch(): Roster {
  const roster = validSistersOfSigmar();
  roster.members = roster.members.filter((member) => member.fighterTypeId !== "sigmarite-matriarch");
  return roster;
}

export function tooManySisterSuperiors(): Roster {
  const roster = validSistersOfSigmar();
  roster.members.push(hero("superior-2", "sister-superior", "Sister Agnes", 8, ["dagger"]));
  roster.members.push(hero("superior-3", "sister-superior", "Sister Klara", 8, ["dagger"]));
  roster.members.push(hero("superior-4", "sister-superior", "Sister Elsa", 8, ["dagger"]));
  return roster;
}

export function tooManyAugurs(): Roster {
  const roster = validSistersOfSigmar();
  roster.members.push(hero("augur-2", "augur", "Second Sight", 0, ["dagger"]));
  return roster;
}

export function tooManyNovices(): Roster {
  const roster = validSistersOfSigmar();
  roster.members[3] = henchmen("novices", "novice", "Novices", 11, ["dagger"]);
  return roster;
}

export function tooManySistersWarriors(): Roster {
  const roster = validSistersOfSigmar();
  roster.members.push(henchmen("more-sisters", "sigmarite-sister", "More Sisters", 5, ["dagger"]));
  roster.members.push(henchmen("even-more-sisters", "sigmarite-sister", "Even More Sisters", 5, ["dagger"]));
  return roster;
}

export function augurWithArmour(): Roster {
  const roster = validSistersOfSigmar();
  roster.members[2] = {
    ...roster.members[2],
    equipment: ["dagger", "light-armour"]
  };
  return roster;
}

export function noviceWithHolyTome(): Roster {
  const roster = validSistersOfSigmar();
  roster.members[3] = {
    ...roster.members[3],
    equipment: ["dagger", "holy-tome"]
  };
  return roster;
}

export function sisterSuperiorWithMatriarchOnlySkill(): Roster {
  const roster = validSistersOfSigmar();
  roster.members[1] = {
    ...roster.members[1],
    skills: ["utter-determination"]
  };
  return roster;
}

export function matriarchWithSpecialSkill(): Roster {
  const roster = validSistersOfSigmar();
  roster.members[0] = {
    ...roster.members[0],
    skills: ["utter-determination"]
  };
  return roster;
}

function hero(id: string, fighterTypeId: string, displayName: string, experience: number, equipment: string[]): RosterMember {
  return member(id, fighterTypeId, displayName, "hero", 1, experience, equipment);
}

function henchmen(id: string, fighterTypeId: string, displayName: string, groupSize: number, equipment: string[]): RosterMember {
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
  return {
    id,
    rosterId: "roster-sisters",
    fighterTypeId,
    displayName,
    kind,
    groupSize,
    currentProfile: profileFor(fighterTypeId),
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

function profileFor(fighterTypeId: string): RosterMember["currentProfile"] {
  const profiles: Record<string, RosterMember["currentProfile"]> = {
    "sigmarite-matriarch": { M: 4, WS: 4, BS: 4, S: 3, T: 3, W: 1, I: 4, A: 1, Ld: 8 },
    "sister-superior": { M: 4, WS: 4, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    augur: { M: 4, WS: 2, BS: 2, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 },
    novice: { M: 4, WS: 2, BS: 2, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 6 },
    "sigmarite-sister": { M: 4, WS: 3, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 }
  };
  return profiles[fighterTypeId];
}
