import { rosterSchema } from "../rules/schemas";
import type { Roster } from "../rules/types";

const localKey = "mordheim.rosters";

export async function listRosters(): Promise<Roster[]> {
  try {
    const response = await fetch("/api/rosters");
    if (!response.ok) throw new Error(response.statusText);
    return rosterSchema.array().parse(await response.json());
  } catch {
    return readLocal();
  }
}

export async function saveRoster(roster: Roster): Promise<Roster> {
  const parsed = rosterSchema.parse({ ...roster, updatedAt: new Date().toISOString() });
  try {
    const response = await fetch(parsed.id ? `/api/rosters/${parsed.id}` : "/api/rosters", {
      method: parsed.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    });
    if (!response.ok) throw new Error(response.statusText);
    const saved = rosterSchema.parse(await response.json());
    writeLocal(upsertLocal(saved));
    return saved;
  } catch {
    writeLocal(upsertLocal(parsed));
    return parsed;
  }
}

export async function deleteRoster(id: string): Promise<void> {
  try {
    await fetch(`/api/rosters/${id}`, { method: "DELETE" });
  } finally {
    writeLocal(readLocal().filter((roster) => roster.id !== id));
  }
}

function upsertLocal(roster: Roster): Roster[] {
  const existing = readLocal().filter((item) => item.id !== roster.id);
  return [roster, ...existing];
}

function readLocal(): Roster[] {
  try {
    return rosterSchema.array().parse(JSON.parse(localStorage.getItem(localKey) ?? "[]"));
  } catch {
    return [];
  }
}

function writeLocal(rosters: Roster[]) {
  localStorage.setItem(localKey, JSON.stringify(rosters));
}
