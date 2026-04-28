# Known Gaps

- Witch Hunters and the three official Mercenary variants are implemented and covered by rules-engine verification.
- Warband index discovery is implemented, but most discovered warbands are still `not_started`.
- Trading post rarity, rare item search, campaign discounts and selling rules are not fully automated.
- Injuries and advances are recordable, but most roll-table outcomes are manual.
- Prayers, spells and hired swords have lookup placeholders rather than complete reviewed data.
- Hired sword upkeep and Dramatis Personae rating overrides are modeled but not fully seeded.
- CSV export and PDF export are not implemented; JSON export/import and browser print are implemented.
- SQLite uses Node 24 `node:sqlite` directly rather than Prisma or Drizzle.
- In this sandbox, Vite/Vitest/Playwright package executables fail with `spawn EPERM`; TypeScript checks and the Node-native rules verification pass.
