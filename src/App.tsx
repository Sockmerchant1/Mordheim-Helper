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
  RotateCcw,
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
import rulesLookupSeed from "./data/rulesLookup.json";
import { rulesDb, warbandIndex, type WarbandIndexRecord } from "./data/rulesDb";
import {
  DEFAULT_MORDHEIM_ADVANCE_THRESHOLDS,
  calculateRosterCost,
  calculateWarbandRating,
  createRosterMemberFromType,
  getAllowedEquipment,
  getAllowedFighterTypes,
  getAllowedSkills,
  getAllowedSpecialRules,
  getPendingAdvances,
  validateRoster
} from "./rules/engine";
import { rosterSchema } from "./rules/schemas";
import type {
  EquipmentItem,
  FighterType,
  HiredSword,
  Roster,
  RosterMember,
  Skill,
  SpecialRule,
  ValidationIssue
} from "./rules/types";

type Mode = "list" | "create" | "roster" | "play" | "afterBattle";
type RuleLookupCategory = "skill" | "spell" | "prayer" | "weapon-rule" | "injury" | "special-rule" | "equipment" | "misc";
type RuleLookupRecord = {
  id: string;
  name: string;
  category: RuleLookupCategory;
  text: string;
  source?: string;
  sourceUrl?: string;
  page?: string;
  tags?: string[];
  aliases?: string[];
};
type LookupItem =
  | { type: "equipment"; item: EquipmentItem }
  | { type: "skill"; item: Skill }
  | { type: "specialRule"; item: SpecialRule }
  | { type: "rule"; item: RuleLookupRecord };

type BattleStatus = "active" | "hidden" | "knocked_down" | "stunned" | "out_of_action";
type BattleMemberState = {
  memberId: string;
  status: BattleStatus;
  currentWounds: number;
  enemyOoaXp: number;
  objectiveXp: number;
  otherXp: number;
};
type BattleState = {
  rosterId: string;
  updatedAt: string;
  members: Record<string, BattleMemberState>;
};
type BattleResult = "win" | "loss" | "draw" | "routed" | "wiped-out" | "other";
type AfterBattleDraft = {
  id: string;
  warbandId: string;
  createdAt: string;
  battleStateSnapshot: BattleState;
  battleResult: {
    opponent?: string;
    scenario?: string;
    result?: BattleResult;
    notes?: string;
    datePlayed?: string;
    leaderSurvived?: boolean;
    routType?: string;
  };
  xp: AfterBattleXpEntry[];
  injuries: AfterBattleInjuryEntry[];
  exploration: {
    diceValues: number[];
    wyrdstoneShards: number;
    specialResults?: string[];
    notes?: string;
  };
  treasury: {
    before: number;
    wyrdstoneSold: number;
    shardSaleIncome: number;
    otherIncome: number;
    deductions: number;
    manualAdjustment: number;
    after: number;
  };
  transactions: AfterBattleTransaction[];
  advances: AfterBattleAdvanceEntry[];
  rosterUpdates: AfterBattleRosterUpdate[];
};
type AfterBattleXpEntry = {
  fighterId: string;
  fighterName: string;
  startingXp: number;
  previousXp: number;
  survived: number;
  leaderBonus: number;
  enemyOoa: number;
  objective: number;
  underdog: number;
  other: number;
  gainedXp: number;
  finalXp: number;
  notes?: string;
  pendingAdvanceThresholds: number[];
};
type AfterBattleInjuryEntry = {
  fighterId: string;
  fighterName: string;
  result: string;
  permanentEffect?: string;
  notes?: string;
  resolvedOutsideApp?: boolean;
  casualties?: number;
};
type AfterBattleTransaction = {
  id: string;
  action: "bought" | "sold" | "moved" | "discarded" | "found" | "other";
  itemName: string;
  value?: number;
  assignedTo?: string;
  notes?: string;
};
type AfterBattleAdvanceEntry = {
  id: string;
  fighterId: string;
  fighterName: string;
  xpThreshold: number;
  result: string;
  notes?: string;
};
type AfterBattleRosterUpdate = {
  id: string;
  type: string;
  targetId?: string;
  description: string;
  payload?: Record<string, unknown>;
};

const rulesLookupRecords = buildRulesLookupRecords();

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

  async function persistRoster(roster: Roster, nextMode: Mode = "play") {
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
    setMode(nextMode);
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
          <button className={mode === "play" ? "active" : ""} disabled={!activeRosterId} onClick={() => setMode("play")}>
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
            setMode("play");
          }}
          onDuplicate={duplicateRoster}
          onDelete={removeRoster}
          onExport={exportRoster}
          onImportClick={() => importInputRef.current?.click()}
        />
      )}

      {(mode === "create" || mode === "roster" || mode === "play" || mode === "afterBattle") && activeRoster && (
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
          ) : mode === "roster" ? (
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
              onSave={() => persistRoster({ ...activeRoster, isDraft: blockingErrors }, "roster")}
              onExport={() => exportRoster(activeRoster)}
            />
          ) : mode === "play" ? (
            <PlayModeView
              roster={activeRoster}
              onEditRoster={() => setMode("roster")}
              onAfterBattle={() => setMode("afterBattle")}
              onLookup={setLookupItem}
            />
          ) : (
            <AfterBattleView
              roster={activeRoster}
              onBackToPlay={() => setMode("play")}
              onEditRoster={() => setMode("roster")}
              onApply={(updatedRoster) => persistRoster(updatedRoster, "play")}
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
                <button onClick={() => onSelect(roster.id)}>Play</button>
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
        <HirePanel roster={roster} onRosterChange={onRosterChange} />
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

function PlayModeView({
  roster,
  onEditRoster,
  onAfterBattle,
  onLookup
}: {
  roster: Roster;
  onEditRoster: () => void;
  onAfterBattle: () => void;
  onLookup: (item: LookupItem) => void;
}) {
  const [battleState, setBattleState] = useState<BattleState>(() => readBattleState(roster));
  const [fighterFilter, setFighterFilter] = useState<"all" | "active">("all");
  const [heroesFirst, setHeroesFirst] = useState(true);
  const [compact, setCompact] = useState(true);
  const [showRulesSearch, setShowRulesSearch] = useState(false);
  const [rulesQuery, setRulesQuery] = useState("");
  const [recentRuleIds, setRecentRuleIds] = useState<string[]>(() => readRecentRuleIds());

  useEffect(() => {
    setBattleState(readBattleState(roster));
  }, [roster.id]);

  useEffect(() => {
    setBattleState((current) => {
      const next = ensureBattleState(roster, current);
      writeBattleState(next);
      return next;
    });
  }, [roster]);

  function updateBattleMember(member: RosterMember, patch: Partial<BattleMemberState>) {
    setBattleState((current) => {
      const currentMember = current.members[member.id] ?? defaultBattleMemberState(member);
      const next = {
        ...ensureBattleState(roster, current),
        updatedAt: new Date().toISOString(),
        members: {
          ...current.members,
          [member.id]: { ...currentMember, ...patch, memberId: member.id }
        }
      };
      writeBattleState(next);
      return next;
    });
  }

  function resetBattleState() {
    if (!window.confirm("Reset temporary battle state for this warband? This will not change the saved roster.")) return;
    const next = createBattleState(roster);
    writeBattleState(next);
    setBattleState(next);
  }

  function openRule(record: RuleLookupRecord) {
    const resolvedRecord = rulesLookupRecords.find((item) => item.id === record.id) ?? record;
    const nextRecent = [resolvedRecord.id, ...recentRuleIds.filter((id) => id !== resolvedRecord.id)].slice(0, 6);
    setRecentRuleIds(nextRecent);
    writeRecentRuleIds(nextRecent);
    onLookup({ type: "rule", item: resolvedRecord });
  }

  const playableMembers = roster.members.filter((member) => member.status !== "dead" && member.status !== "retired");
  const sortedMembers = [...playableMembers].sort((a, b) => {
    if (!heroesFirst) return playableMembers.indexOf(a) - playableMembers.indexOf(b);
    const aOrder = a.kind === "hero" ? 0 : a.kind === "henchman_group" ? 1 : 2;
    const bOrder = b.kind === "hero" ? 0 : b.kind === "henchman_group" ? 1 : 2;
    return aOrder - bOrder;
  });
  const visibleMembers = sortedMembers.filter((member) => {
    const state = battleState.members[member.id] ?? defaultBattleMemberState(member);
    return fighterFilter === "all" || state.status !== "out_of_action";
  });
  const totalFighters = countRosterFighters(playableMembers);
  const outOfAction = playableMembers.reduce((total, member) => {
    const state = battleState.members[member.id];
    return total + (state?.status === "out_of_action" ? memberModelCount(member) : 0);
  }, 0);
  const warband = currentWarband(roster);

  return (
    <section className={`play-mode ${compact ? "compact-play" : "comfortable-play"}`}>
      <div className="play-summary">
        <div>
          <p className="eyebrow">Play Mode</p>
          <h2>{roster.name}</h2>
          <p>{warband?.name ?? roster.warbandTypeId}</p>
        </div>
        <div className="play-metrics">
          <Metric icon={<Shield aria-hidden />} label="Rating" value={calculateWarbandRating(roster, rulesDb).toString()} />
          <Metric icon={<Swords aria-hidden />} label="Fighters" value={totalFighters.toString()} />
          <Metric icon={<AlertTriangle aria-hidden />} label="Out" value={outOfAction.toString()} tone={outOfAction > 0 ? "bad" : undefined} />
          <Metric icon={<BookOpen aria-hidden />} label="Rout at" value={`${calculateRoutThreshold(totalFighters)} out`} />
        </div>
        <div className="play-actions">
          <button onClick={() => setShowRulesSearch((value) => !value)}>
            <Search aria-hidden /> Rules
          </button>
          <button onClick={resetBattleState}>
            <RotateCcw aria-hidden /> Reset Battle State
          </button>
          <button onClick={onEditRoster}>Edit roster</button>
          <button className="primary" onClick={onAfterBattle}>
            End Battle / After Battle
          </button>
        </div>
      </div>

      {showRulesSearch && (
        <RulesSearchPanel
          query={rulesQuery}
          recentRuleIds={recentRuleIds}
          onQueryChange={setRulesQuery}
          onOpenRule={openRule}
        />
      )}

      <div className="play-controls" aria-label="Play Mode filters">
        <label>
          <span>Show fighters</span>
          <select value={fighterFilter} onChange={(event) => setFighterFilter(event.target.value as "all" | "active")}>
            <option value="all">Show all fighters</option>
            <option value="active">Show active only</option>
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={heroesFirst} onChange={(event) => setHeroesFirst(event.target.checked)} />
          Heroes first
        </label>
        <label className="toggle">
          <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
          Compact density
        </label>
      </div>

      <div className="play-card-grid">
        {visibleMembers.map((member) => (
          <PlayFighterCard
            key={member.id}
            roster={roster}
            member={member}
            battleState={battleState.members[member.id] ?? defaultBattleMemberState(member)}
            onBattleChange={(patch) => updateBattleMember(member, patch)}
            onOpenRule={openRule}
          />
        ))}
      </div>
    </section>
  );
}

function RulesSearchPanel({
  query,
  recentRuleIds,
  onQueryChange,
  onOpenRule
}: {
  query: string;
  recentRuleIds: string[];
  onQueryChange: (value: string) => void;
  onOpenRule: (record: RuleLookupRecord) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const recentRules = recentRuleIds
    .map((id) => rulesLookupRecords.find((record) => record.id === id))
    .filter((record): record is RuleLookupRecord => Boolean(record));
  const results = normalizedQuery
    ? rulesLookupRecords
        .filter((record) => ruleMatchesQuery(record, normalizedQuery))
        .slice(0, 30)
    : recentRules;

  return (
    <section className="rules-search-panel">
      <label>
        <span>Rules search</span>
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search skills, spells, equipment and rules" />
      </label>
      <div className="lookup-results">
        {results.length === 0 ? (
          <div className="empty-state">{query ? "No rules found." : "Recent lookups will appear here."}</div>
        ) : (
          results.map((record) => (
            <button className="lookup-result" key={record.id} onClick={() => onOpenRule(record)}>
              <strong>{record.name}</strong>
              <span>{record.category.replaceAll("-", " ")}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function PlayFighterCard({
  roster,
  member,
  battleState,
  onBattleChange,
  onOpenRule
}: {
  roster: Roster;
  member: RosterMember;
  battleState: BattleMemberState;
  onBattleChange: (patch: Partial<BattleMemberState>) => void;
  onOpenRule: (record: RuleLookupRecord) => void;
}) {
  const fighterType = rulesDb.fighterTypes.find((item) => item.id === member.fighterTypeId)!;
  const equipment = member.equipment
    .map((itemId) => rulesDb.equipmentItems.find((item) => item.id === itemId))
    .filter((item): item is EquipmentItem => Boolean(item));
  const weapons = equipment.filter((item) => item.category === "close_combat" || item.category === "missile");
  const armour = equipment.filter((item) => item.category === "armour");
  const otherEquipment = equipment.filter((item) => item.category !== "close_combat" && item.category !== "missile" && item.category !== "armour");
  const skills = member.skills
    .map((id) => rulesDb.skills.find((skill) => skill.id === id))
    .filter((skill): skill is Skill => Boolean(skill));
  const specialRules = unique([...fighterType.specialRuleIds, ...member.specialRules])
    .map((id) => rulesDb.specialRules.find((rule) => rule.id === id))
    .filter((rule): rule is SpecialRule => Boolean(rule));
  const castableRules = specialRules.filter((rule) => rule.validation.selectableAs);
  const passiveRules = specialRules.filter((rule) => !rule.validation.selectableAs);
  const maxWounds = maxBattleWounds(member);
  const startingXp = member.startingXp ?? fighterType.startingExperience;
  const currentXp = member.currentXp ?? member.experience;
  const equipmentRuleIds = unique(equipment.flatMap((item) => item.specialRuleIds));
  const equipmentRules = equipmentRuleIds
    .map((id) => rulesDb.specialRules.find((rule) => rule.id === id))
    .filter((rule): rule is SpecialRule => Boolean(rule));
  const statusRule = ruleRecordForBattleStatus(battleState.status);

  return (
    <article className={`play-fighter-card status-${battleState.status}`}>
      <header>
        <div>
          <p className="eyebrow">{member.kind === "henchman_group" ? `Henchmen x${member.groupSize}` : fighterType.category}</p>
          <h3>{member.displayName || fighterType.name}</h3>
          <p>{fighterType.name}</p>
        </div>
        <label>
          <span>Battle status</span>
          <select value={battleState.status} onChange={(event) => onBattleChange({ status: event.target.value as BattleStatus })}>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="knocked_down">Knocked down</option>
            <option value="stunned">Stunned</option>
            <option value="out_of_action">Out of action</option>
          </select>
        </label>
      </header>

      <CompactProfile profile={member.currentProfile} />

      <div className="play-xp-line">
        <span>Starting XP {startingXp}</span>
        <span>Current XP {currentXp}</span>
      </div>

      <div className="battle-xp-controls" aria-label={`${member.displayName} battle experience`}>
        <strong>Battle XP {battleState.enemyOoaXp + battleState.objectiveXp + battleState.otherXp}</strong>
        <div className="battle-xp-row">
          <span>Enemy out</span>
          <button aria-label="Remove enemy out XP" onClick={() => onBattleChange({ enemyOoaXp: Math.max(0, battleState.enemyOoaXp - 1) })}>-</button>
          <b>{battleState.enemyOoaXp}</b>
          <button aria-label="Add enemy out XP" onClick={() => onBattleChange({ enemyOoaXp: battleState.enemyOoaXp + 1 })}>+</button>
        </div>
        <div className="battle-xp-row">
          <span>Objective</span>
          <button aria-label="Remove objective XP" onClick={() => onBattleChange({ objectiveXp: Math.max(0, battleState.objectiveXp - 1) })}>-</button>
          <b>{battleState.objectiveXp}</b>
          <button aria-label="Add objective XP" onClick={() => onBattleChange({ objectiveXp: battleState.objectiveXp + 1 })}>+</button>
        </div>
        <div className="battle-xp-row">
          <span>Other</span>
          <button aria-label="Remove other XP" onClick={() => onBattleChange({ otherXp: Math.max(0, battleState.otherXp - 1) })}>-</button>
          <b>{battleState.otherXp}</b>
          <button aria-label="Add other XP" onClick={() => onBattleChange({ otherXp: battleState.otherXp + 1 })}>+</button>
        </div>
      </div>

      <div className="wound-tracker">
        <span>Wounds</span>
        <button aria-label="Reduce current wounds" onClick={() => onBattleChange({ currentWounds: Math.max(0, battleState.currentWounds - 1) })}>
          -
        </button>
        <strong>{Math.min(battleState.currentWounds, maxWounds)} / {maxWounds}</strong>
        <button aria-label="Increase current wounds" onClick={() => onBattleChange({ currentWounds: Math.min(maxWounds, battleState.currentWounds + 1) })}>
          +
        </button>
      </div>

      <PlayChipSection title="Weapons" items={weapons.map(ruleRecordForEquipment)} onOpenRule={onOpenRule} />
      <PlayChipSection title="Armour" items={armour.map(ruleRecordForEquipment)} onOpenRule={onOpenRule} />
      <PlayChipSection title="Equipment" items={otherEquipment.map(ruleRecordForEquipment)} onOpenRule={onOpenRule} />
      <PlayChipSection title="Skills" items={skills.map(ruleRecordForSkill)} onOpenRule={onOpenRule} />
      <PlayChipSection title="Spells & Prayers" items={castableRules.map(ruleRecordForSpecialRule)} onOpenRule={onOpenRule} />
      <PlayChipSection title="Injuries" items={member.injuries.map(ruleRecordForInjury)} onOpenRule={onOpenRule} />
      <PlayChipSection
        title="Special Rules"
        items={[...(statusRule ? [statusRule] : []), ...[...passiveRules, ...equipmentRules].map(ruleRecordForSpecialRule)]}
        onOpenRule={onOpenRule}
      />
      {member.notes && (
        <div className="play-notes">
          <strong>Notes</strong>
          <p>{member.notes}</p>
        </div>
      )}
    </article>
  );
}

function CompactProfile({ profile }: { profile: RosterMember["currentProfile"] }) {
  const stats = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
  return (
    <div className="compact-profile" role="table" aria-label="Current profile">
      {stats.map((stat) => (
        <div role="cell" key={stat}>
          <span>{stat}</span>
          <strong>{profile[stat]}</strong>
        </div>
      ))}
    </div>
  );
}

function PlayChipSection({
  title,
  items,
  onOpenRule
}: {
  title: string;
  items: RuleLookupRecord[];
  onOpenRule: (record: RuleLookupRecord) => void;
}) {
  const uniqueItems = uniqueById(items);
  return (
    <section className="play-chip-section">
      <h4>{title}</h4>
      <div className="chip-list">
        {uniqueItems.length ? (
          uniqueItems.map((record) => (
            <button className="chip" key={record.id} onClick={() => onOpenRule(record)}>
              {record.name}
            </button>
          ))
        ) : (
          <span className="muted">None</span>
        )}
      </div>
    </section>
  );
}

function HirePanel({
  roster,
  onRosterChange
}: {
  roster: Roster;
  onRosterChange: (updater: (roster: Roster) => Roster) => void;
}) {
  const [hireMode, setHireMode] = useState<"warband" | "hiredSwords">("warband");
  const warband = currentWarband(roster)!;
  const allowedWarbandFighters = getAllowedFighterTypes(warband.id, roster, rulesDb);
  const availableHiredSwords = rulesDb.hiredSwords.filter((hiredSword) => {
    if (hiredSword.implementationStatus !== "implemented") return false;
    if (hiredSword.allowedWarbandTypeIds.length > 0 && !hiredSword.allowedWarbandTypeIds.includes(roster.warbandTypeId)) return false;
    if (hiredSword.blockedWarbandTypeIds.includes(roster.warbandTypeId)) return false;
    return true;
  });

  function hireWarbandFighter(fighterType: FighterType) {
    onRosterChange((current) => {
      const kind: RosterMember["kind"] = fighterType.category === "henchman" ? "henchman_group" : "hero";
      const member = createRosterMemberFromType(fighterType, current.id, kind);
      const hireCost = fighterType.hireCost * member.groupSize;
      const campaignHire = current.campaignLog.length > 0;
      return {
        ...current,
        treasuryGold: campaignHire ? Math.max(0, current.treasuryGold - hireCost) : current.treasuryGold,
        members: [...current.members, member],
        campaignLog: campaignHire
          ? [
              {
                id: id("log"),
                rosterId: current.id,
                date: new Date().toISOString(),
                type: "purchase",
                description: `Hired ${fighterType.name}`,
                goldDelta: -hireCost,
                wyrdstoneDelta: 0,
                rosterChanges: `${fighterType.name} added to the warband.`
              },
              ...current.campaignLog
            ]
          : current.campaignLog
      };
    });
  }

  function hireHiredSword(hiredSword: HiredSword) {
    const fighterType = fighterTypeForHiredSword(hiredSword);
    if (!fighterType) return;
    onRosterChange((current) => {
      const alreadyHired = current.members.some((member) => member.status !== "dead" && member.status !== "retired" && member.fighterTypeId === fighterType.id);
      if (alreadyHired) return current;
      const member = createHiredSwordMember(hiredSword, fighterType, current.id);
      const campaignHire = current.campaignLog.length > 0;
      return {
        ...current,
        treasuryGold: campaignHire ? Math.max(0, current.treasuryGold - hiredSword.hireFee) : current.treasuryGold,
        members: [...current.members, member],
        campaignLog: campaignHire
          ? [
              {
                id: id("log"),
                rosterId: current.id,
                date: new Date().toISOString(),
                type: "purchase",
                description: `Hired ${hiredSword.name}`,
                goldDelta: -hiredSword.hireFee,
                wyrdstoneDelta: 0,
                rosterChanges: `${hiredSword.name} added as a hired sword. Upkeep: ${hiredSword.upkeep} gc.`
              },
              ...current.campaignLog
            ]
          : current.campaignLog
      };
    });
  }

  return (
    <section className="hired-swords-panel no-print">
      <div className="section-heading">
        <div>
          <h2>Hire Fighters</h2>
          <p>Switch between normal warband recruits and hired swords.</p>
        </div>
        <div className="segmented-control" role="group" aria-label="Hire type">
          <button className={hireMode === "warband" ? "active" : ""} onClick={() => setHireMode("warband")}>
            Warband
          </button>
          <button className={hireMode === "hiredSwords" ? "active" : ""} onClick={() => setHireMode("hiredSwords")}>
            Hired Swords
          </button>
        </div>
      </div>
      <div className="hired-sword-grid">
        {hireMode === "warband" && allowedWarbandFighters.length === 0 ? (
          <div className="empty-state">No legal warband fighters can be hired right now.</div>
        ) : hireMode === "warband" ? (
          allowedWarbandFighters.map((fighterType) => {
            const groupSize = fighterType.category === "henchman" ? fighterType.groupMinSize ?? 1 : 1;
            const hireCost = fighterType.hireCost * groupSize;
            return (
              <article className="hired-sword-option" key={fighterType.id}>
                <div>
                  <strong>{fighterType.name}</strong>
                  <p>{fighterType.category === "henchman" ? `Henchman group starts at ${groupSize}.` : "Hero recruit."}</p>
                  <small>Hire {hireCost} gc{groupSize > 1 ? ` (${groupSize} models)` : ""}.</small>
                </div>
                <button onClick={() => hireWarbandFighter(fighterType)}>
                  <Plus aria-hidden /> Hire
                </button>
              </article>
            );
          })
        ) : availableHiredSwords.length === 0 ? (
          <div className="empty-state">No hired swords are available to this warband yet.</div>
        ) : (
          availableHiredSwords.map((hiredSword) => {
            const alreadyHired = roster.members.some((member) => member.status !== "dead" && member.status !== "retired" && member.fighterTypeId === `hired-sword-${hiredSword.id}`);
            return (
              <article className="hired-sword-option" key={hiredSword.id}>
                <div>
                  <strong>{hiredSword.name}</strong>
                  <p>{hiredSword.availabilitySummary}</p>
                  <small>Hire {hiredSword.hireFee} gc. Upkeep {hiredSword.upkeep} gc.</small>
                </div>
                <button disabled={alreadyHired} onClick={() => hireHiredSword(hiredSword)}>
                  <Plus aria-hidden /> {alreadyHired ? "Hired" : "Hire"}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function fighterTypeForHiredSword(hiredSword: HiredSword) {
  return rulesDb.fighterTypes.find((fighterType) => fighterType.id === `hired-sword-${hiredSword.id}`);
}

function createHiredSwordMember(hiredSword: HiredSword, fighterType: FighterType, rosterId: string): RosterMember {
  const member = createRosterMemberFromType(fighterType, rosterId, "hired_sword", hiredSword.name);
  return {
    ...member,
    equipment: [...hiredSword.equipmentItemIds],
    skills: [],
    specialRules: [...fighterType.specialRuleIds],
    notes: [
      `Hired Sword. Hire fee: ${hiredSword.hireFee} gc. Upkeep: ${hiredSword.upkeep} gc.`,
      hiredSword.availabilitySummary,
      hiredSword.notes
    ].filter(Boolean).join("\n")
  };
}

function AfterBattleView({
  roster,
  onBackToPlay,
  onEditRoster,
  onApply
}: {
  roster: Roster;
  onBackToPlay: () => void;
  onEditRoster: () => void;
  onApply: (roster: Roster) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<AfterBattleDraft>(() => readAfterBattleDraft(roster) ?? createAfterBattleDraft(roster, readBattleState(roster)));
  const steps = [
    "Battle result",
    "Experience",
    "Serious injuries",
    "Exploration",
    "Income",
    "Trading",
    "Advances",
    "Roster updates",
    "Review"
  ];

  useEffect(() => {
    setDraft(readAfterBattleDraft(roster) ?? createAfterBattleDraft(roster, readBattleState(roster)));
    setStepIndex(0);
  }, [roster.id]);

  useEffect(() => {
    writeAfterBattleDraft(draft);
  }, [draft]);

  function updateDraft(updater: (current: AfterBattleDraft) => AfterBattleDraft) {
    setDraft((current) => syncDraftAdvances(updater(current)));
  }

  const canContinue = canContinueAfterBattleStep(stepIndex, draft, roster);

  return (
    <section className="after-battle">
      <div className="after-battle-header">
        <div>
          <p className="eyebrow">After Battle</p>
          <h2>{roster.name}</h2>
          <p>Draft saved locally until you apply the final updates.</p>
        </div>
        <div className="button-row">
          <button onClick={onBackToPlay}>Back to Play Mode</button>
          <button onClick={onEditRoster}>Edit roster</button>
        </div>
      </div>

      <nav className="after-steps" aria-label="After Battle steps">
        {steps.map((step, index) => (
          <button
            key={step}
            className={index === stepIndex ? "active" : ""}
            onClick={() => setStepIndex(index)}
          >
            {index + 1}. {step}
          </button>
        ))}
      </nav>

      <div className="after-step-body">
        {stepIndex === 0 && <BattleResultStep draft={draft} onChange={updateDraft} />}
        {stepIndex === 1 && <ExperienceStep draft={draft} onChange={updateDraft} />}
        {stepIndex === 2 && <SeriousInjuriesStep draft={draft} roster={roster} onChange={updateDraft} />}
        {stepIndex === 3 && <ExplorationStep draft={draft} onChange={updateDraft} />}
        {stepIndex === 4 && <IncomeStep draft={draft} onChange={updateDraft} />}
        {stepIndex === 5 && <TradingStep draft={draft} roster={roster} onChange={updateDraft} />}
        {stepIndex === 6 && <AdvancesStep draft={draft} onChange={updateDraft} />}
        {stepIndex === 7 && <RosterUpdatesStep draft={draft} roster={roster} onChange={updateDraft} />}
        {stepIndex === 8 && (
          <ReviewApplyStep
            draft={draft}
            roster={roster}
            onApply={() => {
              const updated = applyAfterBattleDraft(roster, draft);
              clearAfterBattleDraft(roster.id);
              resetBattleStateStorage(roster);
              onApply(updated);
            }}
          />
        )}
      </div>

      <div className="after-step-actions">
        <button disabled={stepIndex === 0} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>
          Previous
        </button>
        {stepIndex < steps.length - 1 ? (
          <button className="primary" disabled={!canContinue} onClick={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}>
            Next
          </button>
        ) : (
          <span className="muted">Review the draft, then apply when ready.</span>
        )}
      </div>
    </section>
  );
}

function BattleResultStep({
  draft,
  onChange
}: {
  draft: AfterBattleDraft;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function updateBattleResult(patch: Partial<AfterBattleDraft["battleResult"]>) {
    onChange((current) => ({ ...current, battleResult: { ...current.battleResult, ...patch } }));
  }

  return (
    <section className="after-card">
      <h3>Battle result</h3>
      <div className="form-grid">
        <label>
          <span>Opponent warband</span>
          <input value={draft.battleResult.opponent ?? ""} onChange={(event) => updateBattleResult({ opponent: event.target.value })} />
        </label>
        <label>
          <span>Scenario</span>
          <input value={draft.battleResult.scenario ?? ""} onChange={(event) => updateBattleResult({ scenario: event.target.value })} />
        </label>
        <label>
          <span>Result</span>
          <select value={draft.battleResult.result ?? ""} onChange={(event) => updateBattleResult({ result: event.target.value as BattleResult })}>
            <option value="">Select result</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="draw">Draw</option>
            <option value="routed">Routed</option>
            <option value="wiped-out">Wiped out</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>Date played</span>
          <input type="date" value={draft.battleResult.datePlayed ?? ""} onChange={(event) => updateBattleResult({ datePlayed: event.target.value })} />
        </label>
        <label>
          <span>Rout detail</span>
          <select value={draft.battleResult.routType ?? ""} onChange={(event) => updateBattleResult({ routType: event.target.value })}>
            <option value="">Not recorded</option>
            <option value="voluntary">Voluntary rout</option>
            <option value="failed-test">Failed rout test</option>
            <option value="not-routed">Did not rout</option>
          </select>
        </label>
        <label className="toggle after-toggle">
          <input
            type="checkbox"
            checked={draft.battleResult.leaderSurvived ?? true}
            onChange={(event) => updateBattleResult({ leaderSurvived: event.target.checked })}
          />
          Leader survived
        </label>
      </div>
      <label>
        <span>Notes</span>
        <textarea value={draft.battleResult.notes ?? ""} onChange={(event) => updateBattleResult({ notes: event.target.value })} />
      </label>
    </section>
  );
}

function ExperienceStep({
  draft,
  onChange
}: {
  draft: AfterBattleDraft;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function updateXpEntry(fighterId: string, patch: Partial<AfterBattleXpEntry>) {
    onChange((current) => ({
      ...current,
      xp: current.xp.map((entry) => {
        if (entry.fighterId !== fighterId) return entry;
        return recalculateXpEntry({ ...entry, ...patch });
      })
    }));
  }

  return (
    <section className="after-card">
      <h3>Experience</h3>
      <div className="xp-grid">
        {draft.xp.length === 0 ? (
          <div className="empty-state">No fighters in this roster can gain experience.</div>
        ) : (
          draft.xp.map((entry) => (
            <article className="xp-panel" key={entry.fighterId}>
              <header>
                <div>
                  <strong>{entry.fighterName}</strong>
                  <p>Starting {entry.startingXp} XP. Previous {entry.previousXp} XP.</p>
                </div>
                <span className="pill">{advanceSummary(entry.pendingAdvanceThresholds.length)}</span>
              </header>
              <div className="xp-controls">
                <NumberField label="Survived" value={entry.survived} onChange={(value) => updateXpEntry(entry.fighterId, { survived: value })} />
                <NumberField label="Leader bonus" value={entry.leaderBonus} onChange={(value) => updateXpEntry(entry.fighterId, { leaderBonus: value })} />
                <NumberField label="Enemy OOA" value={entry.enemyOoa} onChange={(value) => updateXpEntry(entry.fighterId, { enemyOoa: value })} />
                <NumberField label="Objective" value={entry.objective} onChange={(value) => updateXpEntry(entry.fighterId, { objective: value })} />
                <NumberField label="Underdog" value={entry.underdog} onChange={(value) => updateXpEntry(entry.fighterId, { underdog: value })} />
                <NumberField label="Manual / other" value={entry.other} onChange={(value) => updateXpEntry(entry.fighterId, { other: value })} />
              </div>
              <div className="quick-xp">
                <button onClick={() => updateXpEntry(entry.fighterId, { other: entry.other - 1 })}>-1 other XP</button>
                <button onClick={() => updateXpEntry(entry.fighterId, { other: entry.other + 1 })}>+1 other XP</button>
              </div>
              <div className="xp-total-line">
                <strong>Gained {entry.gainedXp}</strong>
                <strong>Final XP {entry.finalXp}</strong>
                <span>Thresholds: {entry.pendingAdvanceThresholds.length ? entry.pendingAdvanceThresholds.join(", ") : "none"}</span>
              </div>
              <label>
                <span>XP notes</span>
                <input value={entry.notes ?? ""} onChange={(event) => updateXpEntry(entry.fighterId, { notes: event.target.value })} />
              </label>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SeriousInjuriesStep({
  draft,
  roster,
  onChange
}: {
  draft: AfterBattleDraft;
  roster: Roster;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function updateInjury(fighterId: string, patch: Partial<AfterBattleInjuryEntry>) {
    onChange((current) => ({
      ...current,
      injuries: current.injuries.map((entry) => (entry.fighterId === fighterId ? { ...entry, ...patch } : entry))
    }));
  }

  return (
    <section className="after-card">
      <h3>Serious injuries</h3>
      {draft.injuries.length === 0 ? (
        <div className="empty-state">No fighters were marked Out of Action in Play Mode.</div>
      ) : (
        <div className="injury-grid">
          {draft.injuries.map((entry) => {
            const member = roster.members.find((item) => item.id === entry.fighterId);
            return (
              <article className="injury-panel" key={entry.fighterId}>
                <header>
                  <strong>{entry.fighterName}</strong>
                  <span className="pill">{member?.kind === "henchman_group" ? "Henchman group" : "Hero"}</span>
                </header>
                {member?.kind === "henchman_group" && (
                  <NumberField label="Casualties / group size reduction" value={entry.casualties ?? 0} onChange={(value) => updateInjury(entry.fighterId, { casualties: Math.max(0, value) })} />
                )}
                <label>
                  <span>Injury result</span>
                  <select value={entry.result} onChange={(event) => updateInjury(entry.fighterId, { result: event.target.value })}>
                    <option value="">Select or mark resolved</option>
                    {SERIOUS_INJURY_RESULTS.map((result) => (
                      <option key={result}>{result}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Permanent effect</span>
                  <input value={entry.permanentEffect ?? ""} onChange={(event) => updateInjury(entry.fighterId, { permanentEffect: event.target.value })} />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={entry.resolvedOutsideApp ?? false}
                    onChange={(event) => updateInjury(entry.fighterId, { resolvedOutsideApp: event.target.checked })}
                  />
                  Resolved outside app
                </label>
                <label>
                  <span>Notes</span>
                  <textarea value={entry.notes ?? ""} onChange={(event) => updateInjury(entry.fighterId, { notes: event.target.value })} />
                </label>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ExplorationStep({
  draft,
  onChange
}: {
  draft: AfterBattleDraft;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  const [diceInput, setDiceInput] = useState(() => draft.exploration.diceValues.join(", "));

  useEffect(() => {
    setDiceInput(draft.exploration.diceValues.join(", "));
  }, [draft.id]);

  function updateExploration(patch: Partial<AfterBattleDraft["exploration"]>) {
    onChange((current) => ({ ...current, exploration: { ...current.exploration, ...patch } }));
  }

  return (
    <section className="after-card">
      <h3>Exploration</h3>
      <div className="form-grid">
        <label>
          <span>Dice rolled</span>
          <input
            value={diceInput}
            onChange={(event) => {
              setDiceInput(event.target.value);
              updateExploration({ diceValues: parseDiceValues(event.target.value) });
            }}
            placeholder="Example: 1, 3, 3, 6"
          />
        </label>
        <NumberField label="Wyrdstone shards found" value={draft.exploration.wyrdstoneShards} onChange={(value) => updateExploration({ wyrdstoneShards: Math.max(0, value) })} />
        <label>
          <span>Special results</span>
          <input
            value={(draft.exploration.specialResults ?? []).join(", ")}
            onChange={(event) => updateExploration({ specialResults: splitList(event.target.value) })}
          />
        </label>
      </div>
      <p className="muted">Notable combinations: {describeExplorationDice(draft.exploration.diceValues)}</p>
      <label>
        <span>Exploration notes</span>
        <textarea value={draft.exploration.notes ?? ""} onChange={(event) => updateExploration({ notes: event.target.value })} />
      </label>
    </section>
  );
}

function IncomeStep({
  draft,
  onChange
}: {
  draft: AfterBattleDraft;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function updateTreasury(patch: Partial<AfterBattleDraft["treasury"]>) {
    onChange((current) => ({ ...current, treasury: { ...current.treasury, ...patch } }));
  }

  return (
    <section className="after-card">
      <h3>Income and treasury</h3>
      <div className="form-grid">
        <NumberField label="Treasury before" value={draft.treasury.before} onChange={(value) => updateTreasury({ before: value })} />
        <NumberField label="Wyrdstone sold" value={draft.treasury.wyrdstoneSold} onChange={(value) => updateTreasury({ wyrdstoneSold: Math.max(0, value) })} />
        <NumberField label="Shard sale income" value={draft.treasury.shardSaleIncome} onChange={(value) => updateTreasury({ shardSaleIncome: value })} />
        <NumberField label="Other income" value={draft.treasury.otherIncome} onChange={(value) => updateTreasury({ otherIncome: value })} />
        <NumberField label="Upkeep / deductions" value={draft.treasury.deductions} onChange={(value) => updateTreasury({ deductions: value })} />
        <NumberField label="Manual adjustment" value={draft.treasury.manualAdjustment} onChange={(value) => updateTreasury({ manualAdjustment: value })} />
        <NumberField label="Treasury after" value={draft.treasury.after} onChange={(value) => updateTreasury({ after: value })} />
      </div>
    </section>
  );
}

function TradingStep({
  draft,
  roster,
  onChange
}: {
  draft: AfterBattleDraft;
  roster: Roster;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function addTransaction() {
    onChange((current) => ({
      ...current,
      transactions: [
        ...current.transactions,
        { id: id("trade"), action: "bought", itemName: "", value: 0, assignedTo: "stash", notes: "" }
      ]
    }));
  }

  function updateTransaction(transactionId: string, patch: Partial<AfterBattleTransaction>) {
    onChange((current) => ({
      ...current,
      transactions: current.transactions.map((entry) => (entry.id === transactionId ? { ...entry, ...patch } : entry))
    }));
  }

  return (
    <section className="after-card">
      <div className="section-heading">
        <div>
          <h3>Trading and equipment</h3>
          <p>Record purchases, sales, found items and equipment moves as a ledger.</p>
        </div>
        <button onClick={addTransaction}>
          <Plus aria-hidden /> Add transaction
        </button>
      </div>
      <div className="transaction-list">
        {draft.transactions.length === 0 ? (
          <div className="empty-state">No trading transactions recorded.</div>
        ) : (
          draft.transactions.map((transaction) => (
            <article className="transaction-row" key={transaction.id}>
              <label>
                <span>Action</span>
                <select value={transaction.action} onChange={(event) => updateTransaction(transaction.id, { action: event.target.value as AfterBattleTransaction["action"] })}>
                  <option value="bought">Bought</option>
                  <option value="sold">Sold</option>
                  <option value="moved">Moved</option>
                  <option value="discarded">Discarded</option>
                  <option value="found">Found</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span>Item</span>
                <input value={transaction.itemName} onChange={(event) => updateTransaction(transaction.id, { itemName: event.target.value })} />
              </label>
              <NumberField label="Cost / income" value={transaction.value ?? 0} onChange={(value) => updateTransaction(transaction.id, { value })} />
              <label>
                <span>Assigned to</span>
                <select value={transaction.assignedTo ?? ""} onChange={(event) => updateTransaction(transaction.id, { assignedTo: event.target.value })}>
                  <option value="">Unassigned</option>
                  <option value="stash">Stash</option>
                  {roster.members.map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Notes / rarity</span>
                <input value={transaction.notes ?? ""} onChange={(event) => updateTransaction(transaction.id, { notes: event.target.value })} />
              </label>
              <button
                className="icon-danger"
                aria-label="Remove transaction"
                onClick={() => onChange((current) => ({ ...current, transactions: current.transactions.filter((entry) => entry.id !== transaction.id) }))}
              >
                <Trash2 aria-hidden />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function AdvancesStep({
  draft,
  onChange
}: {
  draft: AfterBattleDraft;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  function updateAdvance(advanceId: string, patch: Partial<AfterBattleAdvanceEntry>) {
    onChange((current) => ({
      ...current,
      advances: current.advances.map((entry) => (entry.id === advanceId ? { ...entry, ...patch } : entry))
    }));
  }

  return (
    <section className="after-card">
      <h3>Advances</h3>
      {draft.advances.length === 0 ? (
        <div className="empty-state">No advances are due from the XP entered so far.</div>
      ) : (
        <div className="advance-grid">
          {draft.advances.map((advance) => (
            <article className="advance-panel" key={advance.id}>
              <strong>{advance.fighterName}</strong>
              <p>XP threshold reached: {advance.xpThreshold}</p>
              <label>
                <span>Advance result</span>
                <select value={advance.result} onChange={(event) => updateAdvance(advance.id, { result: event.target.value })}>
                  <option value="">Select result</option>
                  {ADVANCE_RESULTS.map((result) => (
                    <option key={result}>{result}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Notes</span>
                <input value={advance.notes ?? ""} onChange={(event) => updateAdvance(advance.id, { notes: event.target.value })} />
              </label>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RosterUpdatesStep({
  draft,
  roster,
  onChange
}: {
  draft: AfterBattleDraft;
  roster: Roster;
  onChange: (updater: (current: AfterBattleDraft) => AfterBattleDraft) => void;
}) {
  const automaticUpdates = previewRosterUpdates(roster, draft);

  function addManualUpdate() {
    onChange((current) => ({
      ...current,
      rosterUpdates: [...current.rosterUpdates, { id: id("update"), type: "note", description: "" }]
    }));
  }

  function updateRosterUpdate(updateId: string, patch: Partial<AfterBattleRosterUpdate>) {
    onChange((current) => ({
      ...current,
      rosterUpdates: current.rosterUpdates.map((entry) => (entry.id === updateId ? { ...entry, ...patch } : entry))
    }));
  }

  return (
    <section className="after-card">
      <div className="section-heading">
        <div>
          <h3>Roster updates</h3>
          <p>Automatic updates are previewed here. Add extra manual campaign changes as notes before review.</p>
        </div>
        <button onClick={addManualUpdate}>
          <Plus aria-hidden /> Add manual update
        </button>
      </div>
      <div className="review-list">
        {automaticUpdates.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="transaction-list">
        {draft.rosterUpdates.map((update) => (
          <article className="transaction-row" key={update.id}>
            <label>
              <span>Update type</span>
              <select value={update.type} onChange={(event) => updateRosterUpdate(update.id, { type: event.target.value })}>
                <option value="note">Note</option>
                <option value="recruit">Recruit new warrior</option>
                <option value="equipment">Equipment change</option>
                <option value="rename">Rename fighter</option>
                <option value="skill">Skill / spell / rule</option>
                <option value="injury">Injury</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              <span>Target</span>
              <select value={update.targetId ?? ""} onChange={(event) => updateRosterUpdate(update.id, { targetId: event.target.value })}>
                <option value="">Roster / stash</option>
                {roster.members.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Description</span>
              <input value={update.description} onChange={(event) => updateRosterUpdate(update.id, { description: event.target.value })} />
            </label>
            <button
              className="icon-danger"
              aria-label="Remove roster update"
              onClick={() => onChange((current) => ({ ...current, rosterUpdates: current.rosterUpdates.filter((entry) => entry.id !== update.id) }))}
            >
              <Trash2 aria-hidden />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewApplyStep({
  draft,
  roster,
  onApply
}: {
  draft: AfterBattleDraft;
  roster: Roster;
  onApply: () => void;
}) {
  const updatedRoster = applyAfterBattleDraft(roster, draft);
  const beforeRating = calculateWarbandRating(roster, rulesDb);
  const afterRating = calculateWarbandRating(updatedRoster, rulesDb);
  const blockingMessages = reviewBlockingMessages(draft, roster);

  return (
    <section className="after-card">
      <h3>Review and apply</h3>
      {blockingMessages.length > 0 && (
        <div className="member-issues">
          {blockingMessages.map((message) => (
            <article className="validation-message error" key={message}>
              <AlertTriangle aria-hidden />
              <div>
                <strong>{message}</strong>
                <p>Return to the relevant step and finish this before applying permanent updates.</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="review-grid">
        <ReviewBlock title="Battle result" lines={[
          `Opponent: ${draft.battleResult.opponent || "not recorded"}`,
          `Scenario: ${draft.battleResult.scenario || "not recorded"}`,
          `Result: ${draft.battleResult.result || "not recorded"}`
        ]} />
        <ReviewBlock title="XP gained" lines={draft.xp.map((entry) => `${entry.fighterName}: ${entry.previousXp} -> ${entry.finalXp} XP (${advanceSummary(entry.pendingAdvanceThresholds.length)})`)} />
        <ReviewBlock title="Injuries" lines={draft.injuries.map((entry) => `${entry.fighterName}: ${entry.resolvedOutsideApp ? "resolved outside app" : entry.result || "not recorded"}`)} />
        <ReviewBlock title="Exploration" lines={[
          `Dice: ${draft.exploration.diceValues.join(", ") || "not recorded"}`,
          `Wyrdstone found: ${draft.exploration.wyrdstoneShards}`,
          `Special: ${(draft.exploration.specialResults ?? []).join(", ") || "none"}`
        ]} />
        <ReviewBlock title="Treasury" lines={[
          `${draft.treasury.before} gc -> ${draft.treasury.after} gc`,
          `Wyrdstone sold: ${draft.treasury.wyrdstoneSold}`
        ]} />
        <ReviewBlock title="Trading" lines={draft.transactions.map((entry) => `${entry.action}: ${entry.itemName || "unnamed item"} ${entry.value ? `(${entry.value} gc)` : ""}`)} />
        <ReviewBlock title="Advances" lines={draft.advances.map((entry) => `${entry.fighterName} at ${entry.xpThreshold} XP: ${entry.result || "not selected"}`)} />
        <ReviewBlock title="Roster changes" lines={previewRosterUpdates(roster, draft)} />
        <ReviewBlock title="Warband rating" lines={[`${beforeRating} before`, `${afterRating} after`]} />
      </div>
      <button className="primary apply-button" disabled={blockingMessages.length > 0} onClick={onApply}>
        Apply After Battle Updates
      </button>
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ReviewBlock({ title, lines }: { title: string; lines: string[] }) {
  const visibleLines = lines.length ? lines : ["None"];
  return (
    <article className="review-block">
      <h4>{title}</h4>
      {visibleLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </article>
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
  const castableRules = specialRules.filter((rule) => Boolean(rule.validation.selectableAs));
  const passiveRules = specialRules.filter((rule) => !rule.validation.selectableAs);
  const castableOptions = getAllowedSpecialRules(member, roster, rulesDb);
  const hasCastableChoices = castableRules.length > 0 || castableOptions.some((option) => option.allowed);
  const hasRequiredEquipmentChoices = fighterType.validation.requiredOneOfEquipmentItemIds.length > 0;

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

      {hasRequiredEquipmentChoices && (
        <RequiredEquipmentOptionPicker roster={roster} member={member} fighterType={fighterType} onChange={onChange} onLookup={onLookup} />
      )}

      <EquipmentPicker roster={roster} member={member} showIllegalOptions={showIllegalOptions} onChange={onChange} onLookup={onLookup} />

      <div className="member-detail-grid">
        <section>
          <h3>Skills</h3>
          <SkillPicker roster={roster} member={member} onChange={onChange} onLookup={onLookup} />
        </section>
        {hasCastableChoices && (
          <section>
            <h3>Prayers & Spells</h3>
            <SpellPrayerPicker roster={roster} member={member} onChange={onChange} onLookup={onLookup} />
          </section>
        )}
        <section>
          <h3>Special Rules</h3>
          <div className="chip-list">
            {passiveRules.length ? (
              passiveRules.map((rule) => (
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

function RequiredEquipmentOptionPicker({
  roster,
  member,
  fighterType,
  onChange,
  onLookup
}: {
  roster: Roster;
  member: RosterMember;
  fighterType: FighterType;
  onChange: (member: RosterMember) => void;
  onLookup: (item: LookupItem) => void;
}) {
  const requiredIds = fighterType.validation.requiredOneOfEquipmentItemIds;
  const requiredItems = requiredIds
    .map((id) => rulesDb.equipmentItems.find((item) => item.id === id))
    .filter((item): item is EquipmentItem => Boolean(item));
  const selectedItems = member.equipment
    .map((id) => requiredItems.find((item) => item.id === id))
    .filter((item): item is EquipmentItem => Boolean(item));
  const allowedOptions = getAllowedEquipment(member, roster, rulesDb)
    .filter((option) => requiredIds.includes(option.item.id) && option.allowed && !member.equipment.includes(option.item.id));
  const isNurgleBlessing = requiredItems.some((item) => item.validation.costGroupId === "nurgle-blessing");
  const title = isNurgleBlessing ? "Blessings of Nurgle" : "Required options";
  const placeholder = isNurgleBlessing ? "Add Blessing of Nurgle" : "Add required option";
  const helpText = isNurgleBlessing
    ? "Tainted Ones must start with at least one Blessing. Additional Blessings are allowed and their paid cost is included in the roster total."
    : "This fighter type must include at least one of these paid options.";

  function removeItem(itemId: string) {
    onChange({ ...member, equipment: member.equipment.filter((id, index) => id !== itemId || index !== member.equipment.indexOf(itemId)) });
  }

  return (
    <section className="required-option-picker">
      <div className="section-heading compact">
        <div>
          <h3>{title}</h3>
          <p>{helpText}</p>
        </div>
      </div>
      <div className="chip-list">
        {selectedItems.map((item) => (
          <span className="choice-chip" key={item.id}>
            <button className="chip" onClick={() => onLookup({ type: "equipment", item })}>
              {item.name} ({item.cost} gc)
            </button>
            <button className="mini-remove" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>
              Remove
            </button>
          </span>
        ))}
        {selectedItems.length === 0 && <span className="muted">None selected</span>}
      </div>
      <select
        value=""
        onChange={(event) => {
          const item = requiredItems.find((entry) => entry.id === event.target.value);
          if (item && !member.equipment.includes(item.id)) onChange({ ...member, equipment: [...member.equipment, item.id] });
        }}
      >
        <option value="">{placeholder}</option>
        {allowedOptions.map((option) => (
          <option value={option.item.id} key={option.item.id}>
            {option.item.name} - {option.item.cost} gc
          </option>
        ))}
      </select>
    </section>
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
  const options = getAllowedSkills(member, roster, rulesDb).filter((option) => option.allowed);
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
          <option value={option.item.id} key={option.item.id}>
            {option.item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function SpellPrayerPicker({
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
  const options = getAllowedSpecialRules(member, roster, rulesDb).filter((option) => option.item.validation.selectableAs && option.allowed);
  const selectedRules = member.specialRules
    .map((id) => rulesDb.specialRules.find((rule) => rule.id === id))
    .filter((rule): rule is SpecialRule => Boolean(rule?.validation.selectableAs));

  function removeRule(ruleId: string) {
    onChange({ ...member, specialRules: member.specialRules.filter((id) => id !== ruleId) });
  }

  return (
    <div className="skill-picker">
      <div className="chip-list">
        {selectedRules.map((rule) => (
          <span className="choice-chip" key={rule.id}>
            <button className="chip" onClick={() => onLookup({ type: "specialRule", item: rule })}>
              {rule.name}
            </button>
            <button className="mini-remove" aria-label={`Remove ${rule.name}`} onClick={() => removeRule(rule.id)}>
              Remove
            </button>
          </span>
        ))}
        {selectedRules.length === 0 && <span className="muted">None</span>}
      </div>
      <select
        value=""
        onChange={(event) => {
          const rule = rulesDb.specialRules.find((item) => item.id === event.target.value);
          if (rule && !member.specialRules.includes(rule.id)) onChange({ ...member, specialRules: [...member.specialRules, rule.id] });
        }}
      >
        <option value="">Add prayer or spell</option>
        {options.map((option) => (
          <option value={option.item.id} key={option.item.id}>
            {option.item.name}
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
              {entry.rosterChanges && (
                <div className="campaign-summary">
                  {entry.rosterChanges.split("\n").filter(Boolean).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
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
  const overrideRecord = lookupRecordForLookupItem(lookupItem);
  const title = overrideRecord?.name ?? item.name;
  const category =
    overrideRecord
      ? overrideRecord.category.replaceAll("-", " ")
      : lookupItem.type === "equipment"
        ? lookupItem.item.category.replaceAll("_", " ")
        : lookupItem.type === "skill"
          ? skillCategoryName(lookupItem.item.categoryId)
          : lookupItem.type === "specialRule"
            ? lookupItem.item.validation.selectableAs ?? "special rule"
            : lookupItem.item.category.replaceAll("-", " ");
  const summary =
    overrideRecord
      ? overrideRecord.text || "Rule text not available yet. Add this rule to the rules data file."
      : lookupItem.type === "equipment"
        ? lookupItem.item.rulesSummary
        : lookupItem.type === "skill"
          ? lookupItem.item.effectSummary
          : lookupItem.type === "specialRule"
            ? lookupItem.item.effectSummary
            : lookupItem.item.text || "Rule text not available yet. Add this rule to the rules data file.";
  const restrictions = lookupItem.type !== "rule" && "restrictions" in item ? item.restrictions : undefined;
  const sourceUrl = overrideRecord?.sourceUrl ?? ("sourceUrl" in item ? item.sourceUrl : undefined);
  const pageRef = overrideRecord?.page ?? ("pageRef" in item ? item.pageRef : undefined);
  const sourceLabel = overrideRecord?.source;

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
      {overrideRecord && (
        <>
          {(overrideRecord.tags?.length || overrideRecord.aliases?.length) && (
            <div className="lookup-tags">
              {[...(overrideRecord.tags ?? []), ...(overrideRecord.aliases ?? [])].map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {(sourceLabel || pageRef) && (
            <p className="lookup-source">
              {sourceLabel}
              {pageRef ? ` · ${pageRef}` : ""}
            </p>
          )}
        </>
      )}
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

const SERIOUS_INJURY_RESULTS = [
  "Dead",
  "Multiple injuries",
  "Miss next game",
  "Captured",
  "Hardened",
  "Bitter enmity / hatred",
  "Nervous condition",
  "Leg wound / movement reduction",
  "Arm wound / combat reduction",
  "Eye injury / ballistic skill reduction",
  "Old battle wound",
  "Full recovery",
  "Other / custom"
];

const ADVANCE_RESULTS = [
  "+1 M",
  "+1 WS",
  "+1 BS",
  "+1 S",
  "+1 T",
  "+1 W",
  "+1 I",
  "+1 A",
  "+1 Ld",
  "New skill",
  "New spell / prayer",
  "Other / custom"
];

function buildRulesLookupRecords(): RuleLookupRecord[] {
  return uniqueById([
    ...(rulesLookupSeed as RuleLookupRecord[]),
    ...rulesDb.equipmentItems.map(ruleRecordForEquipment),
    ...rulesDb.skills.map(ruleRecordForSkill),
    ...rulesDb.specialRules.map(ruleRecordForSpecialRule),
    ...rulesDb.ruleReferences.map((rule): RuleLookupRecord => ({
      id: `reference-${rule.id}`,
      name: rule.name,
      category: "misc",
      text: rule.summary || "Rule text not available yet. Add this rule to the rules data file.",
      source: rule.sourceDocumentId,
      sourceUrl: rule.sourceUrl,
      page: rule.pageRef,
      tags: [rule.ruleCategory],
      aliases: [rule.id]
    }))
  ]);
}

function lookupRecordForLookupItem(lookupItem: LookupItem): RuleLookupRecord | undefined {
  if (lookupItem.type === "rule") return lookupItem.item;
  const prefix = lookupItem.type === "equipment" ? "equipment" : lookupItem.type === "skill" ? "skill" : "special";
  return rulesLookupRecords.find((record) => record.id === `${prefix}-${lookupItem.item.id}`);
}

function ruleRecordForEquipment(item: EquipmentItem): RuleLookupRecord {
  return {
    id: `equipment-${item.id}`,
    name: item.name,
    category: "equipment",
    text: item.rulesSummary || "Rule text not available yet. Add this rule to the rules data file.",
    source: item.sourceDocumentId,
    sourceUrl: item.sourceUrl,
    page: item.pageRef,
    tags: [item.category.replaceAll("_", " "), ...(item.specialRuleIds ?? [])],
    aliases: [item.id, item.rarity ?? ""].filter(Boolean)
  };
}

function ruleRecordForSkill(skill: Skill): RuleLookupRecord {
  return {
    id: `skill-${skill.id}`,
    name: skill.name,
    category: "skill",
    text: skill.effectSummary || "Rule text not available yet. Add this rule to the rules data file.",
    source: skill.sourceDocumentId,
    sourceUrl: skill.sourceUrl,
    page: skill.pageRef,
    tags: [skill.categoryId, ...skill.relatedRuleIds],
    aliases: [skill.id]
  };
}

function ruleRecordForSpecialRule(rule: SpecialRule): RuleLookupRecord {
  const category: RuleLookupCategory =
    rule.validation.selectableAs === "prayer" ? "prayer" :
      rule.validation.selectableAs === "spell" ? "spell" :
        rule.validation.selectableAs === "ritual" ? "spell" :
          "special-rule";
  return {
    id: `special-${rule.id}`,
    name: rule.name,
    category,
    text: rule.effectSummary || "Rule text not available yet. Add this rule to the rules data file.",
    source: rule.sourceDocumentId,
    sourceUrl: rule.sourceUrl,
    page: rule.pageRef,
    tags: [rule.appliesTo, ...rule.relatedRuleIds, rule.validation.selectableAs ?? ""].filter(Boolean),
    aliases: [rule.id]
  };
}

function ruleRecordForInjury(injury: string): RuleLookupRecord {
  const normalized = injury.toLowerCase();
  const existing = rulesLookupRecords.find((record) => {
    if (record.category !== "injury") return false;
    return record.name.toLowerCase() === normalized || record.aliases?.some((alias) => alias.toLowerCase() === normalized);
  });
  if (existing) return existing;
  return {
    id: `injury-${slug(injury)}`,
    name: injury,
    category: "injury",
    text: "Rule text not available yet. Add this rule to the rules data file.",
    tags: ["injury"],
    aliases: [injury]
  };
}

function ruleRecordForBattleStatus(status: BattleStatus): RuleLookupRecord | undefined {
  const statusRuleIds: Partial<Record<BattleStatus, string>> = {
    hidden: "battle-hidden",
    knocked_down: "battle-knocked-down",
    stunned: "battle-stunned",
    out_of_action: "battle-out-of-action"
  };
  const ruleId = statusRuleIds[status];
  return ruleId ? rulesLookupRecords.find((record) => record.id === ruleId) : undefined;
}

function ruleMatchesQuery(record: RuleLookupRecord, normalizedQuery: string) {
  return [
    record.name,
    record.category,
    record.text,
    ...(record.tags ?? []),
    ...(record.aliases ?? [])
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function createBattleState(roster: Roster): BattleState {
  return {
    rosterId: roster.id,
    updatedAt: new Date().toISOString(),
    members: Object.fromEntries(
      roster.members
        .filter((member) => member.status !== "dead" && member.status !== "retired")
        .map((member) => [member.id, defaultBattleMemberState(member)])
    )
  };
}

function ensureBattleState(roster: Roster, current?: BattleState): BattleState {
  const base = current?.rosterId === roster.id ? current : createBattleState(roster);
  const liveMemberIds = new Set(roster.members.filter((member) => member.status !== "dead" && member.status !== "retired").map((member) => member.id));
  const members = Object.fromEntries(
    roster.members
      .filter((member) => liveMemberIds.has(member.id))
      .map((member) => {
        const existing = base.members[member.id];
        const maxWounds = maxBattleWounds(member);
        return [
          member.id,
          {
            ...defaultBattleMemberState(member),
            ...existing,
            memberId: member.id,
            currentWounds: Math.min(existing?.currentWounds ?? maxWounds, maxWounds)
          }
        ];
      })
  );
  return { rosterId: roster.id, updatedAt: base.updatedAt, members };
}

function defaultBattleMemberState(member: RosterMember): BattleMemberState {
  return {
    memberId: member.id,
    status: "active",
    currentWounds: maxBattleWounds(member),
    enemyOoaXp: 0,
    objectiveXp: 0,
    otherXp: 0
  };
}

function readBattleState(roster: Roster): BattleState {
  try {
    const stored = JSON.parse(localStorage.getItem(battleStateKey(roster.id)) ?? "null") as BattleState | null;
    return ensureBattleState(roster, stored ?? undefined);
  } catch {
    return createBattleState(roster);
  }
}

function writeBattleState(state: BattleState) {
  localStorage.setItem(battleStateKey(state.rosterId), JSON.stringify(state));
}

function resetBattleStateStorage(roster: Roster) {
  localStorage.setItem(battleStateKey(roster.id), JSON.stringify(createBattleState(roster)));
}

function battleStateKey(rosterId: string) {
  return `mordheim.playState.${rosterId}`;
}

function readRecentRuleIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("mordheim.recentRules") ?? "[]");
  } catch {
    return [];
  }
}

function writeRecentRuleIds(ids: string[]) {
  localStorage.setItem("mordheim.recentRules", JSON.stringify(ids));
}

function maxBattleWounds(member: RosterMember) {
  return Math.max(1, member.currentProfile.W * memberModelCount(member));
}

function memberModelCount(member: RosterMember) {
  return member.kind === "henchman_group" ? Math.max(0, member.groupSize) : 1;
}

function countRosterFighters(members: RosterMember[]) {
  return members.reduce((total, member) => total + memberModelCount(member), 0);
}

function calculateRoutThreshold(totalFighters: number) {
  return Math.max(1, Math.ceil(totalFighters / 4));
}

function createAfterBattleDraft(roster: Roster, battleState: BattleState): AfterBattleDraft {
  const now = new Date().toISOString();
  const activeMembers = roster.members.filter((member) => member.status !== "dead" && member.status !== "retired");
  const xp = activeMembers.flatMap((member) => {
    const fighterType = rulesDb.fighterTypes.find((item) => item.id === member.fighterTypeId);
    if (!fighterType?.canGainExperience) return [];
    const startingXp = member.startingXp ?? fighterType.startingExperience;
    const previousXp = member.currentXp ?? member.experience;
    const memberBattleState = battleState.members[member.id] ?? defaultBattleMemberState(member);
    return [recalculateXpEntry({
      fighterId: member.id,
      fighterName: member.displayName || fighterType.name,
      startingXp,
      previousXp,
      survived: 0,
      leaderBonus: 0,
      enemyOoa: memberBattleState.enemyOoaXp,
      objective: memberBattleState.objectiveXp,
      underdog: 0,
      other: memberBattleState.otherXp,
      gainedXp: 0,
      finalXp: previousXp,
      notes: "",
      pendingAdvanceThresholds: []
    })];
  });
  const injuries = activeMembers
    .filter((member) => battleState.members[member.id]?.status === "out_of_action")
    .map((member) => ({
      fighterId: member.id,
      fighterName: member.displayName,
      result: "",
      permanentEffect: "",
      notes: "",
      casualties: member.kind === "henchman_group" ? 0 : undefined
    }));

  return syncDraftAdvances({
    id: id("after-battle"),
    warbandId: roster.id,
    createdAt: now,
    battleStateSnapshot: ensureBattleState(roster, battleState),
    battleResult: {
      datePlayed: now.slice(0, 10),
      leaderSurvived: true
    },
    xp,
    injuries,
    exploration: {
      diceValues: [],
      wyrdstoneShards: 0,
      specialResults: [],
      notes: ""
    },
    treasury: {
      before: roster.treasuryGold,
      wyrdstoneSold: 0,
      shardSaleIncome: 0,
      otherIncome: 0,
      deductions: 0,
      manualAdjustment: 0,
      after: roster.treasuryGold
    },
    transactions: [],
    advances: [],
    rosterUpdates: []
  });
}

function recalculateXpEntry(entry: AfterBattleXpEntry): AfterBattleXpEntry {
  const gainedXp = entry.survived + entry.leaderBonus + entry.enemyOoa + entry.objective + entry.underdog + entry.other;
  const finalXp = Math.max(entry.startingXp, entry.previousXp + gainedXp);
  return {
    ...entry,
    gainedXp,
    finalXp,
    pendingAdvanceThresholds: getPendingAdvances(entry.previousXp, finalXp, DEFAULT_MORDHEIM_ADVANCE_THRESHOLDS)
  };
}

function syncDraftAdvances(draft: AfterBattleDraft): AfterBattleDraft {
  const existing = new Map(draft.advances.map((advance) => [`${advance.fighterId}:${advance.xpThreshold}`, advance]));
  const advances = draft.xp.flatMap((entry) =>
    entry.pendingAdvanceThresholds.map((threshold) => {
      const key = `${entry.fighterId}:${threshold}`;
      return existing.get(key) ?? {
        id: `advance-${entry.fighterId}-${threshold}`,
        fighterId: entry.fighterId,
        fighterName: entry.fighterName,
        xpThreshold: threshold,
        result: "",
        notes: ""
      };
    })
  );
  return { ...draft, advances };
}

function readAfterBattleDraft(roster: Roster): AfterBattleDraft | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(afterBattleKey(roster.id)) ?? "null") as AfterBattleDraft | null;
    if (!stored || stored.warbandId !== roster.id) return undefined;
    return syncDraftAdvances(stored);
  } catch {
    return undefined;
  }
}

function writeAfterBattleDraft(draft: AfterBattleDraft) {
  localStorage.setItem(afterBattleKey(draft.warbandId), JSON.stringify(draft));
}

function clearAfterBattleDraft(rosterId: string) {
  localStorage.removeItem(afterBattleKey(rosterId));
}

function afterBattleKey(rosterId: string) {
  return `mordheim.afterBattle.${rosterId}`;
}

function applyAfterBattleDraft(roster: Roster, draft: AfterBattleDraft): Roster {
  const now = new Date().toISOString();
  const xpByMember = new Map(draft.xp.map((entry) => [entry.fighterId, entry]));
  const injuriesByMember = new Map(draft.injuries.map((entry) => [entry.fighterId, entry]));
  const advancesByMember = new Map<string, AfterBattleAdvanceEntry[]>();
  for (const advance of draft.advances.filter((entry) => entry.result.trim())) {
    advancesByMember.set(advance.fighterId, [...(advancesByMember.get(advance.fighterId) ?? []), advance]);
  }

  const members = roster.members.map((member) => {
    const xp = xpByMember.get(member.id);
    const injury = injuriesByMember.get(member.id);
    const advances = advancesByMember.get(member.id) ?? [];
    let next: RosterMember = { ...member };

    if (xp) {
      next = {
        ...next,
        startingXp: xp.startingXp,
        currentXp: xp.finalXp,
        experience: xp.finalXp
      };
    }

    if (advances.length) {
      next = {
        ...next,
        advances: [...next.advances, ...advances.map((advance) => `${advance.xpThreshold}: ${advance.result}`)],
        advancesTaken: [
          ...(next.advancesTaken ?? []),
          ...advances.map((advance) => ({
            id: advance.id,
            xpAt: advance.xpThreshold,
            result: advance.result,
            date: draft.battleResult.datePlayed || now,
            notes: advance.notes
          }))
        ]
      };
    }

    if (injury && !injury.resolvedOutsideApp) {
      const injuryText = [injury.result, injury.permanentEffect, injury.notes].filter(Boolean).join(" - ");
      if (injuryText) next = { ...next, injuries: [...next.injuries, injuryText] };
      if (injury.result.toLowerCase() === "dead") next = { ...next, status: "dead" };
      if (member.kind === "henchman_group" && injury.casualties) {
        const groupSize = Math.max(0, next.groupSize - injury.casualties);
        next = { ...next, groupSize, status: groupSize === 0 ? "dead" : next.status };
      }
    }

    return next;
  });

  const goldDelta = draft.treasury.after - roster.treasuryGold;
  const wyrdstoneDelta = draft.exploration.wyrdstoneShards - draft.treasury.wyrdstoneSold;
  const resultLabel = draft.battleResult.result?.replaceAll("-", " ") ?? "result not recorded";
  const historyLines = [
    `Battle result: ${resultLabel}`,
    `Opponent: ${draft.battleResult.opponent || "not recorded"}`,
    `Scenario: ${draft.battleResult.scenario || "not recorded"}`,
    `Date played: ${draft.battleResult.datePlayed || "not recorded"}`,
    `Leader survived: ${draft.battleResult.leaderSurvived === false ? "no" : "yes"}`,
    draft.battleResult.routType ? `Rout: ${draft.battleResult.routType.replaceAll("-", " ")}` : "",
    `XP: ${draft.xp.map((entry) => `${entry.fighterName} +${entry.gainedXp} (${entry.previousXp} to ${entry.finalXp})`).join(", ") || "none"}`,
    `Advances: ${draft.advances.map((entry) => `${entry.fighterName} ${entry.xpThreshold} XP - ${entry.result || "not selected"}`).join(", ") || "none"}`,
    `Injuries: ${draft.injuries.map((entry) => `${entry.fighterName} ${entry.resolvedOutsideApp ? "resolved outside app" : entry.result || "unrecorded"}`).join(", ") || "none"}`,
    `Exploration: dice ${draft.exploration.diceValues.join(", ") || "not recorded"}; ${draft.exploration.wyrdstoneShards} wyrdstone found`,
    `Treasury: ${draft.treasury.before} gc to ${draft.treasury.after} gc`,
    `Trading: ${draft.transactions.map((entry) => `${entry.action} ${entry.itemName || "unnamed item"}${typeof entry.value === "number" ? ` (${entry.value} gc)` : ""}`).join(", ") || "none"}`,
    `Roster updates: ${draft.rosterUpdates.map((entry) => entry.description).filter(Boolean).join("; ") || "none"}`
  ].filter(Boolean);

  return {
    ...roster,
    treasuryGold: draft.treasury.after,
    wyrdstoneShards: Math.max(0, roster.wyrdstoneShards + wyrdstoneDelta),
    members,
    campaignLog: [
      {
        id: id("log"),
        rosterId: roster.id,
        date: now,
        type: "post_battle",
        description: `After Battle: ${resultLabel} - ${draft.battleResult.scenario || "Battle"} vs ${draft.battleResult.opponent || "unknown opponent"}`,
        goldDelta,
        wyrdstoneDelta,
        rosterChanges: historyLines.join("\n")
      },
      ...roster.campaignLog
    ],
    updatedAt: now
  };
}

function previewRosterUpdates(roster: Roster, draft: AfterBattleDraft): string[] {
  const lines = [
    ...draft.xp.map((entry) => `${entry.fighterName}: set XP to ${entry.finalXp}`),
    ...draft.advances.filter((entry) => entry.result).map((entry) => `${entry.fighterName}: record ${entry.result} at ${entry.xpThreshold} XP`),
    ...draft.injuries.filter((entry) => entry.result || entry.resolvedOutsideApp).map((entry) => `${entry.fighterName}: ${entry.resolvedOutsideApp ? "injury resolved outside app" : entry.result}`),
    `Treasury: ${roster.treasuryGold} gc to ${draft.treasury.after} gc`,
    `Wyrdstone: ${roster.wyrdstoneShards} to ${Math.max(0, roster.wyrdstoneShards + draft.exploration.wyrdstoneShards - draft.treasury.wyrdstoneSold)}`,
    ...draft.rosterUpdates.map((entry) => entry.description).filter(Boolean)
  ];
  return lines.length ? lines : ["No roster updates recorded."];
}

function reviewBlockingMessages(draft: AfterBattleDraft, roster: Roster): string[] {
  const messages: string[] = [];
  for (const injury of draft.injuries) {
    const member = roster.members.find((item) => item.id === injury.fighterId);
    if (member?.kind !== "henchman_group" && !injury.resolvedOutsideApp && !injury.result.trim()) {
      messages.push(`${injury.fighterName} needs a serious injury result.`);
    }
  }
  for (const advance of draft.advances) {
    if (!advance.result.trim()) messages.push(`${advance.fighterName} needs an advance result for ${advance.xpThreshold} XP.`);
  }
  return messages;
}

function canContinueAfterBattleStep(stepIndex: number, draft: AfterBattleDraft, roster: Roster) {
  if (stepIndex === 2) {
    return !reviewBlockingMessages({ ...draft, advances: [] }, roster).some((message) => message.includes("serious injury"));
  }
  if (stepIndex === 6) {
    return draft.advances.every((advance) => advance.result.trim());
  }
  return true;
}

function advanceSummary(count: number) {
  if (count === 0) return "No advance due";
  if (count === 1) return "1 advance to allocate";
  return `${count} advances to allocate`;
}

function parseDiceValues(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 6);
}

function describeExplorationDice(values: number[]) {
  if (values.length === 0) return "none recorded";
  const counts = values.reduce<Record<number, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const combos = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([value, count]) => `${count} x ${value}`);
  return combos.length ? combos.join(", ") : "no doubles or triples";
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
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
