import { mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { rosterSchema } from "../src/rules/schemas.ts";
import type { Roster } from "../src/rules/types.ts";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const localDir = join(rootDir, ".local");
mkdirSync(localDir, { recursive: true });

const db = new DatabaseSync(join(localDir, "mordheim.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS rosters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    warband_type_id TEXT NOT NULL,
    roster_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaign_log_entries (
    id TEXT PRIMARY KEY,
    roster_id TEXT NOT NULL,
    entry_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(roster_id) REFERENCES rosters(id) ON DELETE CASCADE
  );
`);

const server = createServer(async (request, response) => {
  try {
    setHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const segments = url.pathname.split("/").filter(Boolean);

    if (url.pathname === "/api/health") {
      sendJson(response, { ok: true });
      return;
    }

    if (segments[0] === "api" && segments[1] === "rosters") {
      await handleRosters(request, response, segments[2]);
      return;
    }

    sendJson(response, { error: "Not found" }, 404);
  } catch (error) {
    console.error(error);
    sendJson(response, { error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

const port = Number(process.env.PORT ?? 5174);
server.listen(port, "127.0.0.1", () => {
  console.log(`Mordheim roster API listening on http://127.0.0.1:${port}`);
});

async function handleRosters(request: IncomingMessage, response: ServerResponse, id?: string) {
  if (request.method === "GET" && !id) {
    const rows = db.prepare("SELECT roster_json FROM rosters ORDER BY updated_at DESC").all() as Array<{ roster_json: string }>;
    sendJson(response, rows.map((row) => JSON.parse(row.roster_json)));
    return;
  }

  if (request.method === "GET" && id) {
    const row = db.prepare("SELECT roster_json FROM rosters WHERE id = ?").get(id) as { roster_json: string } | undefined;
    if (!row) {
      sendJson(response, { error: "Roster not found" }, 404);
      return;
    }
    sendJson(response, JSON.parse(row.roster_json));
    return;
  }

  if (request.method === "POST" && !id) {
    const roster = normalizeRoster(await readJsonBody(request));
    upsertRoster(roster);
    sendJson(response, roster, 201);
    return;
  }

  if (request.method === "PUT" && id) {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const roster = normalizeRoster({ ...body, id });
    upsertRoster(roster);
    sendJson(response, roster);
    return;
  }

  if (request.method === "DELETE" && id) {
    db.prepare("DELETE FROM campaign_log_entries WHERE roster_id = ?").run(id);
    db.prepare("DELETE FROM rosters WHERE id = ?").run(id);
    sendJson(response, { ok: true });
    return;
  }

  sendJson(response, { error: "Method not allowed" }, 405);
}

function upsertRoster(roster: Roster) {
  const statement = db.prepare(`
    INSERT INTO rosters (id, name, warband_type_id, roster_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      warband_type_id = excluded.warband_type_id,
      roster_json = excluded.roster_json,
      updated_at = excluded.updated_at
  `);
  statement.run(roster.id, roster.name, roster.warbandTypeId, JSON.stringify(roster), roster.createdAt, roster.updatedAt);

  const deleteEntries = db.prepare("DELETE FROM campaign_log_entries WHERE roster_id = ?");
  deleteEntries.run(roster.id);
  const insertEntry = db.prepare("INSERT INTO campaign_log_entries (id, roster_id, entry_json, created_at) VALUES (?, ?, ?, ?)");
  for (const entry of roster.campaignLog) {
    insertEntry.run(entry.id, roster.id, JSON.stringify(entry), entry.date);
  }
}

function normalizeRoster(raw: unknown): Roster {
  const now = new Date().toISOString();
  const candidate = raw as Partial<Roster>;
  return rosterSchema.parse({
    ...candidate,
    id: candidate.id || `roster-${crypto.randomUUID()}`,
    createdAt: candidate.createdAt || now,
    updatedAt: now
  });
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on("error", reject);
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function setHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
