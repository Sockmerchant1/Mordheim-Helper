import { rosterSchema } from "../rules/schemas";
import type { Roster } from "../rules/types";

const localKey = "mordheim.rosters";
const apiBaseUrl = (import.meta.env.VITE_ROSTER_API_BASE_URL ?? "").replace(/\/$/, "");
const storageMode = import.meta.env.VITE_ROSTER_STORAGE ?? "auto";

export async function listRosters(): Promise<Roster[]> {
  if (!shouldUseRemoteApi()) return readLocal();
  try {
    const response = await fetch(apiUrl("/api/rosters"));
    if (!response.ok) throw new Error(response.statusText);
    return rosterSchema.array().parse(await response.json());
  } catch {
    return readLocal();
  }
}

export async function saveRoster(roster: Roster): Promise<Roster> {
  const parsed = rosterSchema.parse({ ...roster, updatedAt: new Date().toISOString() });
  if (!shouldUseRemoteApi()) {
    writeLocal(upsertLocal(parsed));
    return parsed;
  }
  try {
    const response = await fetch(apiUrl(parsed.id ? `/api/rosters/${parsed.id}` : "/api/rosters"), {
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
  if (shouldUseRemoteApi()) {
    try {
      await fetch(apiUrl(`/api/rosters/${id}`), { method: "DELETE" });
    } finally {
      writeLocal(readLocal().filter((roster) => roster.id !== id));
    }
  } else {
    writeLocal(readLocal().filter((roster) => roster.id !== id));
  }
}

function shouldUseRemoteApi() {
  if (storageMode === "local") return false;
  if (storageMode === "remote") return true;
  if (apiBaseUrl) return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
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
