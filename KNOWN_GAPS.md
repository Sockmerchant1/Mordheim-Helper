# Known Gaps

- Witch Hunters, the three official Mercenary variants, Sisters of Sigmar, Carnival of Chaos, Skaven, Undead, and Orc Mob are implemented and covered by rules-engine verification.
- Warband index discovery is implemented, but most discovered warbands are still `not_started`.
- Trading post rarity, rare item search, campaign discounts and selling rules are not fully automated.
- Play Mode and the After Battle workflow are implemented, but injury rolls, exploration tables, trading availability and most roster update details remain manual entry by design.
- The After Battle flow applies XP, recorded advances, serious injury notes, treasury, wyrdstone and campaign history. Recruiting, equipment moves and other roster edits are captured as review notes for now, then can be handled in the Roster Editor.
- The rules lookup drawer uses concise local summaries and placeholder entries where full wording has not been reviewed into the rules data.
- Injuries and advances are recordable, but most roll-table outcomes are manual.
- Core hired swords can be hired from the Roster Editor. Some unique hired sword equipment such as Elf Bow, Elven Cloak, Lance, Warhorse, Staff and Spiked Gauntlet is currently noted in text rather than fully modeled as separate equipment records.
- Prayers of Sigmar, Magic of the Horned Rat, Nurgle Rituals, Necromancy and Waaagh! Magic are selectable lookup records; other prayer/spell lists are still placeholders until their warbands are implemented.
- Carnival of Chaos validates roster composition, Blessings of Nurgle costs and the Plague Cart warband-size bonus, but full Plague Cart vehicle handling remains a source-reference lookup.
- Skaven validates roster composition, Skaven-only equipment, fighting claws exclusivity, Tail Fighting's extra tail weapon allowance, Horned Rat spell lookups and Rat Ogre large-creature rating.
- Undead validates roster composition, Vampire/Necromancer/Dreg limits, Dire Wolf limits, no-equipment fighters, Necromancy spell lookups and Undead special rules.
- Orc Mob validates roster composition, Goblin-to-Orc and Cave Squig-to-Goblin ratio limits, Shaman armour limits, Troll limits, Goblin special equipment dependencies, Orc special skills and Waaagh! Magic lookups.
- Netlify deployment is configured as a static local-first app. Roster data is browser-local on hosted deployments unless a future remote API is configured.
- Hired sword upkeep and Dramatis Personae rating overrides are modeled but not fully seeded.
- CSV export and PDF export are not implemented; JSON export/import and browser print are implemented.
- SQLite uses Node 24 `node:sqlite` directly rather than Prisma or Drizzle.
- In this sandbox, Vite/Vitest/Playwright package executables fail with `spawn EPERM`; TypeScript checks and the Node-native rules verification pass.
