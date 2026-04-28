# Known Gaps

- Witch Hunters, the three official Mercenary variants, Sisters of Sigmar, Carnival of Chaos, and Skaven are implemented and covered by rules-engine verification.
- Warband index discovery is implemented, but most discovered warbands are still `not_started`.
- Trading post rarity, rare item search, campaign discounts and selling rules are not fully automated.
- Injuries and advances are recordable, but most roll-table outcomes are manual.
- Prayers of Sigmar, Magic of the Horned Rat and Nurgle Rituals are selectable lookup records; other prayer/spell lists are still placeholders until their warbands are implemented.
- Carnival of Chaos validates roster composition, Blessings of Nurgle costs and the Plague Cart warband-size bonus, but full Plague Cart vehicle handling remains a source-reference lookup.
- Skaven validates roster composition, Skaven-only equipment, fighting claws exclusivity, Tail Fighting's extra tail weapon allowance, Horned Rat spell lookups and Rat Ogre large-creature rating.
- Hired sword upkeep and Dramatis Personae rating overrides are modeled but not fully seeded.
- CSV export and PDF export are not implemented; JSON export/import and browser print are implemented.
- SQLite uses Node 24 `node:sqlite` directly rather than Prisma or Drizzle.
- In this sandbox, Vite/Vitest/Playwright package executables fail with `spawn EPERM`; TypeScript checks and the Node-native rules verification pass.
