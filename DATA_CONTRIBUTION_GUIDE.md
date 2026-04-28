# Data Contribution Guide

Use Broheim documents as sources, but keep app data concise and reviewable.

## Workflow

1. Open the Broheim warband index and identify the warband PDF, source code and Broheim grade.
2. Add or update the source document in `src/data/sources.json`.
3. Extract text only as a review aid:

```bash
python scripts/extractPdfText.py path/to/warband.pdf scratch/<warband>.txt
```

4. Manually review the PDF against the extracted text.
5. Encode structured data in `src/data/warbands/<id>.json`.
6. Add or reuse equipment, skills and special rules.
7. Add source URL and page reference to every record.
8. Add tests for roster limits, equipment lists, skill access, cost and rating.

## Warband JSON Checklist

Each warband seed should include:

- one `warbandType`
- every hero and henchman `fighterType`
- hire cost, starting XP and full profile for each fighter
- min/max count and group size limits
- equipment list ids
- skill category ids
- special rule ids
- source document and page reference
- implementation status

## Equipment Checklist

Each equipment item needs:

- category
- cost
- rarity if relevant
- concise rules summary
- validation metadata for weapon slots, armour type or non-repeatability
- source URL and page reference

## Review Rules

- Do not paste long rulebook text.
- Do not trust PDF extraction without manual review.
- Prefer generic validation metadata over warband-specific code.
- If a rule is uncertain, mark the warband `extracted` or `reviewed`, not `tested`.
- Add a known gap when a rule cannot yet be enforced.
