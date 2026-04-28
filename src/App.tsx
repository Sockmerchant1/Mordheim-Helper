import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Coins,
  Copy,
  Download,
  Plus,
  Printer,
  Save,
  Search,
  Shield,
  Swords,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { deleteRoster, listRosters, saveRoster } from "./api/rosters";
import { rulesDb, warbandIndex, type WarbandIndexRecord } from "./data/rulesDb";
import {
  calculateRosterCost,
  calculateWarbandRating,
  createRosterMemberFromType,
  getAllowedEquipment,
  getAllowedFighterTypes,
  getAllowedSkills,
  validateRoster
} from "./rules/engine";
import { rosterSchema } from "./rules/schemas";
import type {
  EquipmentItem,
  FighterType,
  Roster,
  RosterMember,
  Skill,
  SpecialRule,
  ValidationIssue
} from "./rules/types";

type Mode = "list" | "create" | "roster";
type LookupItem =
  | { type: "equipment"; item: EquipmentItem }
  | { type: "skill"; item: Skill }
  | { type: "specialRule"; item: SpecialRule };

export default function App() {
  const [mode, setMode] = useState<Mode>("list");
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [activeRosterId, setActiveRosterId] = useState<string>();
  const [draftRoster, setDraftRoster] = useState<Roster>(() => createRosterDraft("witch-hunters"));
  const [showIllegalOptions, setShowIllegalOptions] = useState(false);
  const [allowDraftSave, setAllowDraftSave] = useState(false);
  const [lookupItem, setLookupItem] = useState<LookupItem>();
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listRosters().then((items) => {
      setRosters(items);
      setActiveRosterId(items[0]?.id);
    });
  }, []);

  const activeRoster = useMemo(
    () => (mode === "create" ? draftRoster : rosters.find((roster) => roster.id === activeRosterId)),
    [activeRosterId, draftRoster, mode, rosters]
  );

  async function persistRoster(roster: Roster) {
    const saved = await saveRoster({
      ...roster,
      claimedCost: calculateRosterCost(roster, rulesDb),
      claimedWarbandRating: calculateWarbandRating(roster, rulesDb),
      treasuryGold: roster.campaignLog.length === 0 && currentWarband(roster)?.startingGold
        ? Math.max(0, currentWarband(roster)!.startingGold - calculateRosterCost(roster, rulesDb))
        : roster.treasuryGold
    });
    setRosters((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setActiveRosterId(saved.id);
    setMode("roster");
  }

  async function removeRoster(id: string) {
    await deleteRoster(id);
    setRosters((current) => current.filter((roster) => roster.id !== id));
    if (activeRosterId === id) setActiveRosterId(undefined);
  }

  function updateActiveRoster(updater: (roster: Roster) => Roster) {
    if (!activeRoster) return;
    const updated = { ...updater(activeRoster), updatedAt: new Date().toISOString() };
    if (mode === "create") {
      setDraftRoster(updated);
    } else {
      setRosters((current) => current.map((roster) => (roster.id === updated.id ? updated : roster)));
    }
  }

  function duplicateRoster(roster: Roster) {
    const now = new Date().toISOString();
    const copy = {
      ...roster,
      id: `roster-${crypto.randomUUID()}`,
      name: `${roster.name} Copy`,
      isDraft: true,
      createdAt: now,
      updatedAt: now,
      members: roster.members.map((member) => ({ ...member, id: `member-${crypto.randomUUID()}` }))
    };
    void persistRoster(copy);
  }

  function exportRoster(roster: Roster) {
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug(roster.name)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importRoster(file: File) {
    const imported = rosterSchema.parse(JSON.parse(await file.text()));
    await persistRoster({
      ...imported,
      id: imported.id || `roster-${crypto.randomUUID()}`,
      updatedAt: new Date().toISOString()
    });
  }

  const validation = activeRoster ? validateRoster(activeRoster, rulesDb) : [];
  const blockingErrors = validation.some((issue) => issue.severity === "error");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mordheim campaign helper</p>
          <h1>Warband Manager</h1>
        </div>
        <nav aria-label="Main">
          <button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>
            <ClipboardList aria-hidden /> Warbands
          </button>
          <button
            className={mode === "create" ? "active" : ""}
            onClick={() => {
              setDraftRoster(createRosterDraft("witch-hunters"));
              setMode("create");
            }}
          >
            <Plus aria-hidden /> Create
          </button>
          <button className={mode === "roster" ? "active" : ""} disabled={!activeRosterId} onClick={() => setMode("roster")}>
            <Swords aria-hidden /> Roster
          </button>
        </nav>
      </header>

      {mode === "list" && (
        <WarbandList
          rosters={rosters}
          onCreate={() => {
            setDraftRoster(createRosterDraft("witch-hunters"));
            setMode("create");
          }}
          onSelect={(id) => {
            setActiveRosterId(id);
            setMode("roster");
          }}
          onDuplicate={duplicateRoster}
          onDelete={removeRoster}
          onExport={exportRoster}
          onImportClick={() => importInputRef.current?.click()}
        />
      )}

      {(mode === "create" || mode === "roster") && activeRoster && (
        <main className="workspace">
          {mode === "create" ? (
            <CreateWizard
              roster={activeRoster}
              validation={validation}
              showIllegalOptions={showIllegalOptions}
              allowDraftSave={allowDraftSave}
              blockingErrors={blockingErrors}
              onRosterChange={setDraftRoster}
              onLookup={setLookupItem}
              onToggleIllegal={setShowIllegalOptions}
              onToggleDraftSave={setAllowDraftSave}
              onSave={() => persistRoster({ ...activeRoster, isDraft: blockingErrors })}
            />
          ) : (
            <RosterView
              roster={activeRoster}
              validation={validation}
              showIllegalOptions={showIllegalOptions}
              allowDraftSave={allowDraftSave}
              blockingErrors={blockingErrors}
              onRosterChange={updateActiveRoster}
              onLookup={setLookupItem}
              onToggleIllegal={setShowIllegalOptions}
              onToggleDraftSave={setAllowDraftSave}
              onSave={() => persistRoster({ ...activeRoster, isDraft: blockingErrors })}
              onExport={() => exportRoster(activeRoster)}
            />
          )}
        </main>
      )}

      {lookupItem && <LookupPanel lookupItem={lookupItem} onClose={() => setLookupItem(undefined)} />}

      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importRoster(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function WarbandList({
  rosters,
  onCreate,
  onSelect,
  onDuplicate,
  onDelete,
  onExport,
  onImportClick
}: {
  rosters: Roster[];
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDuplicate: (roster: Roster) => void;
  onDelete: (id: string) => void;
  onExport: (roster: Roster) => void;
  onImportClick: () => void;
}) {
  const [grade, setGrade] = useState("");
  const [race, setRace] = useState("");
  const [officialOnly, setOfficialOnly] = useState(true);
  const [query, setQuery] = useState("");

  const filteredIndex = warbandIndex.warbands.filter((warband) => {
    if (officialOnly && !warband.isOfficial) return false;
    if (grade && warband.broheimGrade !== grade) return false;
    if (race && warband.race !== race) return false;
    if (query && !warband.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const grades = unique(warbandIndex.warbands.map((warband) => warband.broheimGrade));
  const races = unique(warbandIndex.warbands.map((warband) => warband.race));

  return (
    <main className="list-page">
      <section className="toolbar-band">
        <div>
          <h2>Saved Rosters</h2>
          <p>{rosters.length} local roster{rosters.length === 1 ? "" : "s"}</p>
        </div>
        <div className="button-row">
          <button className="primary" onClick={onCreate}>
            <Plus aria-hidden /> New warband
          </button>
          <button onClick={onImportClick}>
            <Upload aria-hidden /> Import JSON
          </button>
        </div>
      </section>

      <section className="roster-list" aria-label="Saved rosters">
        {rosters.length === 0 ? (
          <div className="empty-state">No saved rosters yet.</div>
        ) : (
          rosters.map((roster) => (
            <article className="roster-row" key={roster.id}>
              <div>
                <h3>{roster.name}</h3>
                <p>
                  {warbandName(roster.warbandTypeId)} · {calculateWarbandRating(roster, rulesDb)} rating ·{" "}
                  {calculateRosterCost(roster, rulesDb)} gc
                </p>
              </div>
              <div className="icon-row">
                <button onClick={() => onSelect(roster.id)}>Open</button>
                <button aria-label={`Duplicate ${roster.name}`} onClick={() => onDuplicate(roster)}>
                  <Copy aria-hidden />
                </button>
                <button aria-label={`Export ${roster.name}`} onClick={() => onExport(roster)}>
                  <Download aria-hidden />
                </button>
                <button aria-label={`Delete ${roster.name}`} onClick={() => onDelete(roster.id)}>
                  <Trash2 aria-hidden />
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="rules-library">
        <div className="section-heading">
          <div>
            <h2>Broheim Warband Index</h2>
            <p>Discovered from {warbandIndex.sourceUrl}</p>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={officialOnly} onChange={(event) => setOfficialOnly(event.target.checked)} />
            Official only
          </label>
        </div>
        <div className="filters">
          <label>
            <Search aria-hidden />
            <span>Name</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span>Grade</span>
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="">All</option>
              {grades.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Race</span>
            <select value={race} onChange={(event) => setRace(event.target.value)}>
              <option value="">All</option>
              {races.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Warband</th>
                <th>Race</th>
                <th>Grade</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndex.slice(0, 80).map((warband: WarbandIndexRecord) => (
                <tr key={`${warband.name}-${warband.sourceUrl}`}>
                  <td>{warband.name}</td>
                  <td>{warband.race}</td>
                  <td>{warband.broheimGradeLabel}</td>
                  <td>
                    <a href={warband.sourceUrl} target="_blank" rel="noreferrer">
                      {warband.sourceCode || "PDF"}
                    </a>
                  </td>
                  <td>
                    <span className={warband.implementationStatus === "implemented" ? "pill success" : "pill"}>
                      {warband.implementationStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function CreateWizard({
  roster,
  validation,
  showIllegalOptions,
  allowDraftSave,
  blockingErrors,
  onRosterChange,
  onLookup,
  onToggleIllegal,
  onToggleDraftSave,
  onSave
}: {
  roster: Roster;
  validation: ValidationIssue[];
  showIllegalOptions: boolean;
  allowDraftSave: boolean;
  blockingErrors: boolean;
  onRosterChange: (roster: Roster) => void;
  onLookup: (item: LookupItem) => void;
  onToggleIllegal: (value: boolean) => void;
  onToggleDraftSave: (value: boolean) => void;
  onSave: () => void;
}) {
  const warband = currentWarband(roster)!;
  const allowedFighters = getAllowedFighterTypes(warband.id, roster, rulesDb);

  function updateRoster(updater: (roster: Roster) => Roster) {
    onRosterChange({ ...updater(roster), updatedAt: new Date().toISOString() });
  }

  return (
    <div className="two-column">
      <section className="primary-flow">
        <div className="wizard-steps" aria-label="Create warband steps">
          {["Select", "Name", "Hire", "Equip", "Validate", "Save"].map((step, index) => (
            <span className="step" key={step}>
              {index + 1}. {step}
            </span>
          ))}
        </div>

        <section className="form-band">
          <h2>Create Warband</h2>
          <div className="form-grid">
            <label>
              <span>Warband type</span>
              <select
                value={roster.warbandTypeId}
                onChange={(event) => onRosterChange(createRosterDraft(event.target.value))}
              >
                {rulesDb.warbandTypes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Warband name</span>
              <input value={roster.name} onChange={(event) => updateRoster((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              <span>Starting treasury</span>
              <input value={`${warband.startingGold} gc`} readOnly />
            </label>
          </div>
          <SourceNote sourceUrl={warband.sourceUrl} label={`${warband.name} · Broheim grade ${warband.broheimGrade}`} />
        </section>

        <RosterHeader roster={roster} />

        <section className="add-member-band">
          <div className="section-heading">
            <div>
              <h2>Add Warriors</h2>
              <p>Only currently legal fighter types are enabled.</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={showIllegalOptions} onChange={(event) => onToggleIllegal(event.target.checked)} />
              Show illegal options
            </label>
          </div>
          <div className="fighter-buttons">
            {rulesDb.fighterTypes
              .filter((fighterType) => fighterType.warbandTypeId === warband.id)
              .map((fighterType) => {
                const legal = allowedFighters.some((item) => item.id === fighterType.id);
                if (!legal && !showIllegalOptions) return null;
                return (
                  <button
                    key={fighterType.id}
                    disabled={!legal}
                    className={!legal ? "blocked" : ""}
                    onClick={() =>
                      updateRoster((current) => ({
                        ...current,
                        members: [
                          ...current.members,
                          createRosterMemberFromType(
                            fighterType,
                            current.id,
                            fighterType.category === "henchman" ? "henchman_group" : "hero"
                          )
                        ]
                      }))
                    }
                  >
                    <Plus aria-hidden />
                    {fighterType.name} · {fighterType.hireCost} gc
                  </button>
                );
              })}
          </div>
        </section>

        <MemberSections
          roster={roster}
          validation={validation}
          showIllegalOptions={showIllegalOptions}
          onRosterChange={updateRoster}
          onLookup={onLookup}
        />
      </section>

      <aside className="side-panel">
        <ValidationPanel issues={validation} />
        <SavePanel
          blockingErrors={blockingErrors}
          allowDraftSave={allowDraftSave}
          onToggleDraftSave={onToggleDraftSave}
          onSave={onSave}
        />
      </aside>
    </div>
  );
}

function RosterView({
  roster,
  validation,
  showIllegalOptions,
  allowDraftSave,
  blockingErrors,
  onRosterChange,
  onLookup,
  onToggleIllegal,
  onToggleDraftSave,
  onSave,
  onExport
}: {
  roster: Roster;
  validation: ValidationIssue[];
  showIllegalOptions: boolean;
  allowDraftSave: boolean;
  blockingErrors: boolean;
  onRosterChange: (updater: (roster: Roster) => Roster) => void;
  onLookup: (item: LookupItem) => void;
  onToggleIllegal: (value: boolean) => void;
  onToggleDraftSave: (value: boolean) => void;
  onSave: () => void;
  onExport: () => void;
}) {
  return (
    <div className="two-column">
      <section className="primary-flow print-sheet">
        <RosterHeader roster={roster} />
        <div className="action-strip no-print">
          <label className="toggle">
            <input type="checkbox" checked={showIllegalOptions} onChange={(event) => onToggleIllegal(event.target.checked)} />
            Show illegal options
          </label>
          <button onClick={onSave}>
            <Save aria-hidden /> Save
          </button>
          <button onClick={onExport}>
            <Download aria-hidden /> Export
          </button>
          <button onClick={() => window.print()}>
            <Printer aria-hidden /> Print
          </button>
        </div>
        <MemberSections
          roster={roster}
          validation={validation}
          showIllegalOptions={showIllegalOptions}
          onRosterChange={onRosterChange}
          onLookup={onLookup}
        />
        <CampaignPanel roster={roster} onRosterChange={onRosterChange} />
      </section>
      <aside className="side-panel no-print">
        <ValidationPanel issues={validation} />
        <SavePanel
          blockingErrors={blockingErrors}
          allowDraftSave={allowDraftSave}
          onToggleDraftSave={onToggleDraftSave}
          onSave={onSave}
        />
      </aside>
    </div>
  );
}

function RosterHeader({ roster }: { roster: Roster }) {
  const warband = currentWarband(roster)!;
  const cost = calculateRosterCost(roster, rulesDb);
  const rating = calculateWarbandRating(roster, rulesDb);
  const remainingGold = warband.startingGold - cost;
  const displayedTreasury = roster.campaignLog.length === 0 ? Math.max(0, remainingGold) : roster.treasuryGold;

  return (
    <section className="roster-header">
      <div>
        <p className="eyebrow">Warband name</p>
        <h2>{roster.name || "Unnamed Warband"}</h2>
        <SourceNote sourceUrl={warband.sourceUrl} label={`${warband.name} · ${warband.sourceCode}`} />
      </div>
      <div className="metric-grid">
        <Metric icon={<Coins aria-hidden />} label="Treasury" value={`${displayedTreasury} gc`} tone={remainingGold < 0 ? "bad" : "good"} />
        <Metric icon={<Swords aria-hidden />} label="Cost" value={`${cost} gc`} />
        <Metric icon={<Shield aria-hidden />} label="Rating" value={rating.toString()} />
        <Metric icon={<BookOpen aria-hidden />} label="Wyrdstone" value={roster.wyrdstoneShards.toString()} />
      </div>
      <div className="stored-equipment">
        <strong>Stored equipment</strong>
        <p>{roster.storedEquipment.length ? roster.storedEquipment.map(equipmentName).join(", ") : "None"}</p>
      </div>
    </section>
  );
}

function MemberSections({
  roster,
  validation,
  showIllegalOptions,
  onRosterChange,
  onLookup
}: {
  roster: Roster;
  validation: ValidationIssue[];
  showIllegalOptions: boolean;
  onRosterChange: (updater: (roster: Roster) => Roster) => void;
  onLookup: (item: LookupItem) => void;
}) {
  const sections = [
    { title: "Heroes", members: roster.members.filter((member) => member.kind === "hero") },
    { title: "Henchman Groups", members: roster.members.filter((member) => member.kind === "henchman_group") },
    { title: "Hired Swords", members: roster.members.filter((member) => member.kind === "hired_sword") }
  ];

  return (
    <>
      {sections.map((section) => (
        <section className="member-section" key={section.title}>
          <h2>{section.title}</h2>
          {section.members.length === 0 ? (
            <div className="empty-state">No {section.title.toLowerCase()}.</div>
          ) : (
            <div className="member-grid">
              {section.members.map((member) => (
                <MemberCard
                  key={member.id}
                  roster={roster}
                  member={member}
                  issues={validation.filter((issue) => issue.affectedMemberId === member.id)}
                  showIllegalOptions={showIllegalOptions}
                  onLookup={onLookup}
                  onChange={(updated) =>
                    onRosterChange((current) => ({
                      ...current,
                      members: current.members.map((item) => (item.id === member.id ? updated : item))
                    }))
                  }
                  onRemove={() =>
                    onRosterChange((current) => ({
                      ...current,
                      members: current.members.filter((item) => item.id !== member.id)
                    }))
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}

function MemberCard({
  roster,
  member,
  issues,
  showIllegalOptions,
  onLookup,
  onChange,
  onRemove
}: {
  roster: Roster;
  member: RosterMember;
  issues: ValidationIssue[];
  showIllegalOptions: boolean;
  onLookup: (item: LookupItem) => void;
  onChange: (member: RosterMember) => void;
  onRemove: () => void;
}) {
  const fighterType = rulesDb.fighterTypes.find((item) => item.id === member.fighterTypeId)!;
  const specialRules = unique([...fighterType.specialRuleIds, ...member.specialRules])
    .map((id) => rulesDb.specialRules.find((rule) => rule.id === id))
    .filter(Boolean) as SpecialRule[];

  return (
    <article className="member-card">
      <header>
        <div>
          <label>
            <span>Name</span>
            <input value={member.displayName} onChange={(event) => onChange({ ...member, displayName: event.target.value })} />
          </label>
          <p className="member-type">{fighterType.name}</p>
        </div>
        <button className="icon-danger" aria-label={`Remove ${member.displayName}`} onClick={onRemove}>
          <Trash2 aria-hidden />
        </button>
      </header>

      <div className="member-controls">
        {member.kind === "henchman_group" && (
          <label>
            <span>No.</span>
            <input
              type="number"
              min={fighterType.groupMinSize ?? 1}
              max={fighterType.groupMaxSize ?? undefined}
              value={member.groupSize}
              onChange={(event) => onChange({ ...member, groupSize: Number(event.target.value) })}
            />
          </label>
        )}
        <label>
          <span>XP</span>
          <input
            type="number"
            min={0}
            value={member.experience}
            onChange={(event) => onChange({ ...member, experience: Number(event.target.value) })}
          />
        </label>
        <label>
          <span>Status</span>
          <select value={member.status} onChange={(event) => onChange({ ...member, status: event.target.value as RosterMember["status"] })}>
            <option value="active">Active</option>
            <option value="missing">Missing</option>
            <option value="dead">Dead</option>
            <option value="retired">Retired</option>
          </select>
        </label>
      </div>

      <ProfileTable base={fighterType.profile} current={member.currentProfile} onChange={(profile) => onChange({ ...member, currentProfile: profile })} />

      <EquipmentPicker roster={roster} member={member} showIllegalOptions={showIllegalOptions} onChange={onChange} onLookup={onLookup} />

      <div className="member-detail-grid">
        <section>
          <h3>Skills</h3>
          <SkillPicker roster={roster} member={member} onChange={onChange} onLookup={onLookup} />
        </section>
        <section>
          <h3>Special Rules</h3>
          <div className="chip-list">
            {specialRules.length ? (
              specialRules.map((rule) => (
                <button className="chip" key={rule.id} onClick={() => onLookup({ type: "specialRule", item: rule })}>
                  {rule.name}
                </button>
              ))
            ) : (
              <span className="muted">None</span>
            )}
          </div>
        </section>
      </div>

      <label>
        <span>Injuries and notes</span>
        <textarea value={[...member.injuries, member.notes].filter(Boolean).join("\n")} onChange={(event) => onChange({ ...member, notes: event.target.value })} />
      </label>

      {issues.length > 0 && (
        <div className="member-issues">
          {issues.map((issue) => (
            <ValidationMessage issue={issue} key={`${issue.code}-${issue.message}`} />
          ))}
        </div>
      )}
    </article>
  );
}

function ProfileTable({
  base,
  current,
  onChange
}: {
  base: RosterMember["currentProfile"];
  current: RosterMember["currentProfile"];
  onChange: (profile: RosterMember["currentProfile"]) => void;
}) {
  const stats = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
  return (
    <div className="profile-table" role="table" aria-label="Profile">
      <div role="row">
        {stats.map((stat) => (
          <strong role="columnheader" key={stat}>
            {stat}
          </strong>
        ))}
      </div>
      <div role="row">
        {stats.map((stat) => (
          <span role="cell" key={`${stat}-base`}>
            {base[stat]}
          </span>
        ))}
      </div>
      <div role="row">
        {stats.map((stat) => (
          <input
            aria-label={`Current ${stat}`}
            key={`${stat}-current`}
            type="number"
            value={current[stat]}
            onChange={(event) => onChange({ ...current, [stat]: Number(event.target.value) })}
          />
        ))}
      </div>
    </div>
  );
}

function EquipmentPicker({
  roster,
  member,
  showIllegalOptions,
  onChange,
  onLookup
}: {
  roster: Roster;
  member: RosterMember;
  showIllegalOptions: boolean;
  onChange: (member: RosterMember) => void;
  onLookup: (item: LookupItem) => void;
}) {
  const [category, setCategory] = useState<EquipmentItem["category"] | "all">("all");
  const options = getAllowedEquipment(member, roster, rulesDb);
  const visibleOptions = options.filter((option) => {
    if (category !== "all" && option.item.category !== category) return false;
    return showIllegalOptions || option.allowed || member.equipment.includes(option.item.id);
  });

  function toggle(itemId: string) {
    const exists = member.equipment.includes(itemId);
    onChange({
      ...member,
      equipment: exists ? member.equipment.filter((id, index) => id !== itemId || index !== member.equipment.indexOf(itemId)) : [...member.equipment, itemId]
    });
  }

  return (
    <section className="equipment-picker">
      <div className="section-heading compact">
        <h3>Equipment</h3>
        <select value={category} onChange={(event) => setCategory(event.target.value as EquipmentItem["category"] | "all")}>
          <option value="all">All</option>
          <option value="close_combat">Close combat</option>
          <option value="missile">Missile</option>
          <option value="armour">Armour</option>
          <option value="miscellaneous">Misc.</option>
        </select>
      </div>
      <div className="equipment-list">
        {visibleOptions.map((option) => {
          const selected = member.equipment.includes(option.item.id);
          return (
            <div className={`equipment-option ${!option.allowed ? "blocked" : ""}`} key={option.item.id}>
              <label>
                <input type="checkbox" checked={selected} disabled={!option.allowed && !selected} onChange={() => toggle(option.item.id)} />
                <span>{option.item.name}</span>
                <small>{option.item.cost} gc</small>
              </label>
              <button aria-label={`Lookup ${option.item.name}`} onClick={() => onLookup({ type: "equipment", item: option.item })}>
                <BookOpen aria-hidden />
              </button>
              <p>{option.reason}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkillPicker({
  roster,
  member,
  onChange,
  onLookup
}: {
  roster: Roster;
  member: RosterMember;
  onChange: (member: RosterMember) => void;
  onLookup: (item: LookupItem) => void;
}) {
  const options = getAllowedSkills(member, roster, rulesDb);
  const selectedSkills = member.skills.map((id) => rulesDb.skills.find((skill) => skill.id === id)).filter(Boolean) as Skill[];

  return (
    <div className="skill-picker">
      <div className="chip-list">
        {selectedSkills.map((skill) => (
          <button className="chip" key={skill.id} onClick={() => onLookup({ type: "skill", item: skill })}>
            {skill.name}
          </button>
        ))}
        {selectedSkills.length === 0 && <span className="muted">None</span>}
      </div>
      <select
        value=""
        onChange={(event) => {
          const skill = rulesDb.skills.find((item) => item.id === event.target.value);
          if (skill && !member.skills.includes(skill.id)) onChange({ ...member, skills: [...member.skills, skill.id] });
        }}
      >
        <option value="">Add skill</option>
        {options.map((option) => (
          <option value={option.item.id} disabled={!option.allowed} key={option.item.id}>
            {option.item.name} {option.allowed ? "" : `- ${option.reason}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function CampaignPanel({
  roster,
  onRosterChange
}: {
  roster: Roster;
  onRosterChange: (updater: (roster: Roster) => Roster) => void;
}) {
  const [description, setDescription] = useState("");
  const [goldDelta, setGoldDelta] = useState(0);
  const [wyrdstoneDelta, setWyrdstoneDelta] = useState(0);

  function addLog() {
    if (!description.trim() && goldDelta === 0 && wyrdstoneDelta === 0) return;
    onRosterChange((current) => ({
      ...current,
      treasuryGold: current.treasuryGold + goldDelta,
      wyrdstoneShards: current.wyrdstoneShards + wyrdstoneDelta,
      campaignLog: [
        {
          id: `log-${crypto.randomUUID()}`,
          rosterId: current.id,
          date: new Date().toISOString(),
          type: "post_battle",
          description: description || "Post-battle update",
          goldDelta,
          wyrdstoneDelta,
          rosterChanges: ""
        },
        ...current.campaignLog
      ]
    }));
    setDescription("");
    setGoldDelta(0);
    setWyrdstoneDelta(0);
  }

  return (
    <section className="campaign-panel">
      <div className="section-heading">
        <div>
          <h2>Campaign Log</h2>
          <p>Post-game income, exploration, injuries, advances and notes.</p>
        </div>
      </div>
      <div className="campaign-form">
        <label>
          <span>Note</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          <span>Gold delta</span>
          <input type="number" value={goldDelta} onChange={(event) => setGoldDelta(Number(event.target.value))} />
        </label>
        <label>
          <span>Wyrdstone delta</span>
          <input type="number" value={wyrdstoneDelta} onChange={(event) => setWyrdstoneDelta(Number(event.target.value))} />
        </label>
        <button onClick={addLog}>
          <Plus aria-hidden /> Add entry
        </button>
      </div>
      <div className="campaign-log">
        {roster.campaignLog.length === 0 ? (
          <div className="empty-state">No campaign entries yet.</div>
        ) : (
          roster.campaignLog.map((entry) => (
            <article key={entry.id}>
              <strong>{new Date(entry.date).toLocaleDateString()}</strong>
              <p>{entry.description}</p>
              <small>
                Gold {entry.goldDelta >= 0 ? "+" : ""}
                {entry.goldDelta} · Wyrdstone {entry.wyrdstoneDelta >= 0 ? "+" : ""}
                {entry.wyrdstoneDelta}
              </small>
            </article>
          ))
        )}
      </div>
      <label>
        <span>Campaign notes</span>
        <textarea value={roster.campaignNotes} onChange={(event) => onRosterChange((current) => ({ ...current, campaignNotes: event.target.value }))} />
      </label>
    </section>
  );
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  return (
    <section className="validation-panel" aria-live="polite">
      <h2>Validation</h2>
      {issues.map((issue) => (
        <ValidationMessage issue={issue} key={`${issue.code}-${issue.message}-${issue.affectedMemberId ?? "roster"}`} />
      ))}
    </section>
  );
}

function ValidationMessage({ issue }: { issue: ValidationIssue }) {
  const Icon = issue.severity === "error" ? AlertTriangle : CheckCircle2;
  return (
    <article className={`validation-message ${issue.severity}`}>
      <Icon aria-hidden />
      <div>
        <strong>{issue.message}</strong>
        <p>{issue.detail}</p>
        {issue.suggestedFix && <p className="suggestion">{issue.suggestedFix}</p>}
        {issue.source?.sourceUrl && (
          <a href={issue.source.sourceUrl} target="_blank" rel="noreferrer">
            {issue.source.label || issue.source.sourceDocumentId} {issue.source.pageRef ? `· ${issue.source.pageRef}` : ""}
          </a>
        )}
      </div>
    </article>
  );
}

function SavePanel({
  blockingErrors,
  allowDraftSave,
  onToggleDraftSave,
  onSave
}: {
  blockingErrors: boolean;
  allowDraftSave: boolean;
  onToggleDraftSave: (value: boolean) => void;
  onSave: () => void;
}) {
  return (
    <section className="save-panel">
      <label className="toggle">
        <input type="checkbox" checked={allowDraftSave} onChange={(event) => onToggleDraftSave(event.target.checked)} />
        Allow draft save with errors
      </label>
      <button className="primary" disabled={blockingErrors && !allowDraftSave} onClick={onSave}>
        <Save aria-hidden /> Save roster
      </button>
    </section>
  );
}

function LookupPanel({ lookupItem, onClose }: { lookupItem: LookupItem; onClose: () => void }) {
  const item = lookupItem.item;
  const title = item.name;
  const category =
    lookupItem.type === "equipment"
      ? lookupItem.item.category.replaceAll("_", " ")
      : lookupItem.type === "skill"
        ? skillCategoryName(lookupItem.item.categoryId)
        : "special rule";
  const summary =
    lookupItem.type === "equipment"
      ? lookupItem.item.rulesSummary
      : lookupItem.type === "skill"
        ? lookupItem.item.effectSummary
        : lookupItem.item.effectSummary;
  const restrictions = "restrictions" in item ? item.restrictions : undefined;
  const sourceUrl = "sourceUrl" in item ? item.sourceUrl : undefined;
  const pageRef = "pageRef" in item ? item.pageRef : undefined;

  return (
    <aside className="lookup-panel" role="dialog" aria-modal="true" aria-label={`${title} lookup`}>
      <button className="close-button" onClick={onClose}>
        Close
      </button>
      <p className="eyebrow">{category}</p>
      <h2>{title}</h2>
      <p>{summary}</p>
      {restrictions && (
        <>
          <h3>Restrictions</h3>
          <p>{restrictions}</p>
        </>
      )}
      {lookupItem.type === "equipment" && <p className="cost-line">{lookupItem.item.cost} gc</p>}
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          Source {pageRef ? `· ${pageRef}` : ""}
        </a>
      )}
    </aside>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SourceNote({ sourceUrl, label }: { sourceUrl: string; label: string }) {
  return (
    <a className="source-note" href={sourceUrl} target="_blank" rel="noreferrer">
      <BookOpen aria-hidden /> {label}
    </a>
  );
}

function createRosterDraft(warbandTypeId: string): Roster {
  const warband = rulesDb.warbandTypes.find((item) => item.id === warbandTypeId) ?? rulesDb.warbandTypes[0];
  const leader = rulesDb.fighterTypes.find((fighterType) => fighterType.id === warband.leaderFighterTypeId);
  const now = new Date().toISOString();
  const rosterId = `roster-${crypto.randomUUID()}`;
  return {
    id: rosterId,
    name: `${warband.name} Warband`,
    warbandTypeId: warband.id,
    treasuryGold: warband.startingGold,
    wyrdstoneShards: 0,
    storedEquipment: [],
    campaignNotes: "",
    members: leader ? [createRosterMemberFromType(leader, rosterId, "hero", leader.name)] : [],
    campaignLog: [],
    isDraft: true,
    createdAt: now,
    updatedAt: now
  };
}

function currentWarband(roster: Roster) {
  return rulesDb.warbandTypes.find((warband) => warband.id === roster.warbandTypeId);
}

function warbandName(warbandTypeId: string) {
  return rulesDb.warbandTypes.find((warband) => warband.id === warbandTypeId)?.name ?? warbandTypeId;
}

function equipmentName(itemId: string) {
  return rulesDb.equipmentItems.find((item) => item.id === itemId)?.name ?? itemId;
}

function skillCategoryName(categoryId: string) {
  return rulesDb.skillCategories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items)).sort();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "roster";
}
