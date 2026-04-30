# Mordheim Warband Manager

An unofficial local-first Mordheim roster and campaign helper. The app separates canonical rules data from player roster state so rosters reference structured records for fighter types, equipment, skills, special rules, source documents and campaign log entries.

The first fully seeded warbands are **Witch Hunters**, the official **Mercenaries** variants, **Sisters of Sigmar**, **Carnival of Chaos**, **Skaven**, **Undead**, and **Orc Mob**. The attached workbook was used as a roster layout and data-entry reference only; Broheim-hosted rule documents are treated as the source references.

## Stack

- React + TypeScript + Vite
- Zod for rules and roster schemas
- SQLite persistence through Node 24 `node:sqlite`
- Vitest rules-engine tests
- Playwright UI flow specs
- Simple CSS for responsive and printable roster layouts

## Deploy To Netlify

This app is ready to deploy to Netlify as a static Vite site. Netlify uses `netlify.toml`, runs `npm run build`, and publishes `dist`.

On Netlify, roster data is saved in each player's browser storage. No paid database or server is required, but players should use JSON export/import to back up or move rosters between devices.

See `NETLIFY_DEPLOY.md` for step-by-step setup and the GitHub upload checklist.

## Run Locally

Requires Node 24+ because the local SQLite API uses `node:sqlite`. The Netlify deployment does not run that local API; it uses browser storage instead.

```bash
npm install
npm run dev
```

The Vite app runs at `http://127.0.0.1:5173` and the local API runs at `http://127.0.0.1:5174`. Roster state is stored in `.local/mordheim.sqlite`; rules data stays in `src/data`.

## Tests

```bash
npm test
npm run test:e2e
npm run typecheck
```

If Playwright browsers are not installed yet, run `npx playwright install` once before `npm run test:e2e`.

This workspace blocks package child executables, so Vite/Vitest/Playwright cannot launch here. I added a Node-native verification path that exercises the implemented warband rules:

```bash
npm run test:node
```

## Data Model Summary

Rules data:

- `SourceDocument`
- `WarbandType`
- `FighterType`
- `EquipmentItem`
- `EquipmentList`
- `SkillCategory`
- `Skill`
- `SpecialRule`
- `HiredSword`
- `RuleReference`

Roster state:

- `Roster`
- `RosterMember`
- `CampaignLogEntry`

Rules live in JSON seed files under `src/data`; campaign roster state is saved separately as JSON in SQLite. Play Mode battle state and in-progress After Battle drafts are temporary local browser data and are only applied to the permanent roster after final confirmation.

## App Modes

- **Roster Editor**: the existing long-term roster builder and campaign editor.
- **Play Mode**: opened by the Roster button for quick table use, temporary fighter status, wound tracking and rules lookup.
- **After Battle**: a guided post-game draft for result, XP, serious injuries, exploration, income, trading, advances, roster updates and final review.

The After Battle flow compares pre-battle XP with final XP using the central advancement threshold helper in `src/rules/engine.ts`, queues one advance slot per crossed threshold, and writes one campaign history entry when updates are applied.

## Rules Validation

The pure TypeScript rules engine in `src/rules/engine.ts` accepts a roster and rules database, then returns:

- allowed warbands, fighter types, equipment, skills, prayers, spells and rituals
- calculated roster cost
- calculated warband rating
- structured validation issues with severity, code, detail, suggested fix and source reference

Validation currently covers implemented-warband composition, leader requirements, model limits, ratio limits, group size limits, equipment list restrictions, required roster options, required paired equipment, exclusive equipment, weapon count limits, Skaven Tail Fighting weapon allowance, armour conflicts, henchman equipment uniformity, skill category access, prayer/spell/ritual access, experience sanity checks, cost totals and rating totals.

Hired swords are seeded from local data and can be hired from the Roster Editor. They are stored as roster members with canonical fighter profiles, hire fees, upkeep notes and source references, but they do not count toward normal warband size or hero limits.

## Implemented Warbands

- Witch Hunters
- Reiklanders
- Middenheimers
- Marienburgers
- Sisters of Sigmar
- Carnival of Chaos
- Skaven
- Undead
- Orc Mob

## Adding A Warband

1. Add or confirm the source document in `src/data/sources.json`.
2. Create `src/data/warbands/<warband-id>.json`.
3. Define one `warbandType`, all `fighterTypes`, and the warband `equipmentLists`.
4. Reuse existing equipment, skills and special rules where possible.
5. Add concise summaries and page references; do not copy full rulebook sections.
6. Import the seed in `src/data/rulesDb.ts`.
7. Add fixtures and tests in `tests/fixtures` and `tests/rules-engine.test.ts`.

Run:

```bash
npm run seed:index
npm run test:node
```

## Adding A Skill

1. Add the skill id to the relevant category in `src/data/skills.json`.
2. Add a concise skill record with `effectSummary`, `restrictions`, source URL and page ref.
3. Add the category id to any fighter types that can select it.
4. Add a rules-engine test for at least one allowed and one blocked fighter.

## Adding A Hired Sword

1. Add a reviewed record to `src/data/hiredSwords.json`.
2. Include hire fee, upkeep, availability, concise effect summary and source reference.
3. Add or link a fighter type record if the hired sword should appear as a roster member.
4. Add validation tests for hire/upkeep and rating behavior.

## Source And Copyright Note

This app stores concise mechanics, summaries, validation metadata and source/page references. It must not reproduce whole PDFs or long rulebook sections. Broheim URLs and page refs are included so players can check the original rules.

This is an unofficial helper app and is not affiliated with Games Workshop or Broheim. It is not a replacement for the Mordheim rulebooks.
