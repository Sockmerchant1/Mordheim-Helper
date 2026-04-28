import type { Roster, RosterMember } from "../../src/rules/types";

const now = "2026-04-28T00:00:00.000Z";

type MercenaryVariant = "reikland" | "middenheim" | "marienburg";

const warbandTypeByVariant: Record<MercenaryVariant, string> = {
  reikland: "reiklanders",
  middenheim: "middenheimers",
  marienburg: "marienburgers"
};

export function validReiklanders(): Roster {
  return validMercenaries("reikland");
}

export function validMiddenheimers(): Roster {
  return validMercenaries("middenheim");
}

export function validMarienburgers(): Roster {
  return validMercenaries("marienburg");
}

export function marienburgExpensiveButLegal(): Roster {
  const roster = baseRoster("marienburg", "High Tide Company");
  roster.members = [
    hero("captain", "marienburg-mercenary-captain", "Captain van der Laan", 20, ["dagger", "mace"]),
    hero("champion", "marienburg-champion", "Silas", 8, ["dagger", "axe"]),
    hero("youngblood", "marienburg-youngblood", "Pieter", 0, ["dagger"]),
    henchmen("marksmen", "marienburg-marksman", "Canal Marksmen", 2, ["dagger", "hunting-rifle"])
  ];
  return roster;
}

export function reiklandOverspentWithMarienburgGear(): Roster {
  const roster = marienburgExpensiveButLegal();
  return {
    ...roster,
    name: "Too Rich for Reikland",
    warbandTypeId: "reiklanders",
    members: [
      hero("captain", "reikland-mercenary-captain", "Captain Adler", 20, ["dagger", "mace"]),
      hero("champion", "reikland-champion", "Konrad", 8, ["dagger", "axe"]),
      hero("youngblood", "reikland-youngblood", "Matthias", 0, ["dagger"]),
      henchmen("marksmen", "reikland-marksman", "Altdorf Marksmen", 2, ["dagger", "hunting-rifle"])
    ]
  };
}

export function tooManyMercenaryMarksmen(): Roster {
  const roster = baseRoster("reikland", "Too Many Crossbows");
  roster.members = [
    hero("captain", "reikland-mercenary-captain", "Captain Adler", 20, ["dagger"]),
    henchmen("marksmen-a", "reikland-marksman", "Marksmen A", 5, ["dagger", "bow"]),
    henchmen("marksmen-b", "reikland-marksman", "Marksmen B", 3, ["dagger", "bow"])
  ];
  return roster;
}

export function tooManyMercenarySwordsmen(): Roster {
  const roster = baseRoster("reikland", "Too Many Swords");
  roster.members = [
    hero("captain", "reikland-mercenary-captain", "Captain Adler", 20, ["dagger"]),
    henchmen("swords-a", "reikland-swordsman", "Swordsmen A", 5, ["dagger", "sword"]),
    henchmen("swords-b", "reikland-swordsman", "Swordsmen B", 1, ["dagger", "sword"])
  ];
  return roster;
}

export function tooManyMercenaryWarriors(): Roster {
  const roster = baseRoster("reikland", "Too Many Boots");
  roster.members = [
    hero("captain", "reikland-mercenary-captain", "Captain Adler", 20, ["dagger"]),
    hero("champion-a", "reikland-champion", "Konrad", 8, ["dagger"]),
    hero("champion-b", "reikland-champion", "Otto", 8, ["dagger"]),
    hero("youngblood-a", "reikland-youngblood", "Matthias", 0, ["dagger"]),
    hero("youngblood-b", "reikland-youngblood", "Lukas", 0, ["dagger"]),
    henchmen("warriors", "reikland-warrior", "Warriors", 5, ["dagger"]),
    henchmen("marksmen", "reikland-marksman", "Marksmen", 5, ["dagger", "bow"]),
    henchmen("swordsmen", "reikland-swordsman", "Swordsmen", 1, ["dagger", "sword"])
  ];
  return roster;
}

export function mercenaryNoCaptain(): Roster {
  const roster = validReiklanders();
  roster.members = roster.members.filter((member) => member.fighterTypeId !== "reikland-mercenary-captain");
  return roster;
}

export function mercenaryIllegalEquipment(): Roster {
  const roster = validReiklanders();
  roster.members[3] = {
    ...roster.members[3],
    equipment: ["dagger", "long-bow"]
  };
  return roster;
}

export function validMercenaries(variant: MercenaryVariant): Roster {
  const roster = baseRoster(variant, `${variantTitle(variant)} Company`);
  roster.members = [
    hero("captain", `${variant}-mercenary-captain`, "Captain", 20, ["dagger", "mace"]),
    hero("champion", `${variant}-champion`, "Champion", 8, ["dagger", "axe"]),
    hero("youngblood", `${variant}-youngblood`, "Youngblood", 0, ["dagger"]),
    henchmen("warriors", `${variant}-warrior`, "Warriors", 2, ["dagger", "mace"]),
    henchmen("marksman", `${variant}-marksman`, "Marksman", 1, ["dagger", "bow"]),
    henchmen("swordsman", `${variant}-swordsman`, "Swordsman", 1, ["dagger", "sword"])
  ];
  return roster;
}

function baseRoster(variant: MercenaryVariant, name: string): Roster {
  return {
    id: `roster-${variant}`,
    name,
    warbandTypeId: warbandTypeByVariant[variant],
    treasuryGold: variant === "marienburg" ? 600 : 500,
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
    rosterId: "roster-mercenary",
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
  if (fighterTypeId.endsWith("mercenary-captain")) {
    return { M: 4, WS: 4, BS: 4, S: fighterTypeId.startsWith("middenheim") ? 4 : 3, T: 3, W: 1, I: 4, A: 1, Ld: 8 };
  }
  if (fighterTypeId.endsWith("champion")) {
    return { M: 4, WS: 4, BS: 3, S: fighterTypeId.startsWith("middenheim") ? 4 : 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 };
  }
  if (fighterTypeId.endsWith("youngblood")) {
    return { M: 4, WS: 2, BS: 2, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 6 };
  }
  if (fighterTypeId.endsWith("swordsman")) {
    return { M: 4, WS: 4, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 };
  }
  if (fighterTypeId.endsWith("marksman")) {
    return { M: 4, WS: 3, BS: fighterTypeId.startsWith("reikland") ? 4 : 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 };
  }
  return { M: 4, WS: 3, BS: 3, S: 3, T: 3, W: 1, I: 3, A: 1, Ld: 7 };
}

function variantTitle(variant: MercenaryVariant): string {
  return variant === "reikland" ? "Reikland" : variant === "middenheim" ? "Middenheim" : "Marienburg";
}
