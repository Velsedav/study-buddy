import Database from "@tauri-apps/plugin-sql";
import { readFile, writeFile, exists, remove } from "@tauri-apps/plugin-fs";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { DEFAULT_QUOTES } from "./defaultQuotes";

export type Objective = {
  id: string;
  title: string;
  goal_kind: "count" | "metric" | "amount" | "manual";
  goal_target: number | null;
  goal_unit: string | null;
  cover_data: string | null;
  current_value: number;
  created_at: number;
  updated_at: number;
  pin_bottom: number;
  frequency_days: number | null;
};

export type SlotRow = { slot_index: number; objective_id: string | null };

export type Subobjective = {
  id: string;
  objective_id: string;
  title: string;
  note: string | null;
  target_total: number | null;
  progress_current: number;
  unit: string | null;
  is_done: number;
  created_at: number;
  updated_at: number;
};

export type MediaItem = {
  id: string;
  subobjective_id: string;
  kind: "quote" | "image";
  data: string;
  created_at: number;
};

export type QuoteRow = {
  id: string;
  text: string;
  created_at: number;
};

let dbPromise: Promise<Database> | null = null;
let schemaReady = false;

export async function getBingoDb() {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:bingo.db");
  }
  const db = await dbPromise;
  if (!schemaReady) {
    await ensureSchema(db);
    schemaReady = true;
  }
  return db;
}

export async function closeBingoDb() {
  if (!dbPromise) return;
  const db = await dbPromise;
  // @ts-ignore
  if (typeof db.close === "function") await db.close();
  dbPromise = null;
  schemaReady = false;
}

function now() {
  return Date.now();
}

function escapeSqliteString(value: string) {
  return value.split("'").join("''");
}

async function dbFilePath() {
  const dir = await appConfigDir();
  return await join(dir, "bingo.db");
}

async function ensureColumn(db: Database, table: string, column: string, typeSql: string) {
  const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(${table});`);
  const existsCol = cols.some((c) => c.name === column);
  if (!existsCol) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql};`);
  }
}

async function ensureSchema(db: Database) {
  await db.execute("PRAGMA foreign_keys = ON;");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS slots (
      slot_index INTEGER PRIMARY KEY,
      objective_id TEXT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal_kind TEXT NOT NULL,
      goal_target REAL NULL,
      goal_unit TEXT NULL,
      cover_data TEXT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      pin_bottom INTEGER NOT NULL DEFAULT 0,
      frequency_days INTEGER NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subobjectives (
      id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NULL,
      target_total REAL NULL,
      progress_current REAL NOT NULL DEFAULT 0,
      unit TEXT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_sessions (
      id TEXT PRIMARY KEY,
      subobjective_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      FOREIGN KEY (subobjective_id) REFERENCES subobjectives(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      subobjective_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (subobjective_id) REFERENCES subobjectives(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bingo_quotes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await ensureColumn(db, "objectives", "cover_data", "TEXT");
  await ensureColumn(db, "objectives", "pin_bottom", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "objectives", "frequency_days", "INTEGER");

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bingo_subobjectives_objective_id ON subobjectives(objective_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bingo_time_sessions_subobjective_id ON time_sessions(subobjective_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bingo_media_items_subobjective_id ON media_items(subobjective_id);`);

  try { await db.execute(`PRAGMA journal_mode=WAL;`); } catch { }
  try { await db.execute(`PRAGMA synchronous=NORMAL;`); } catch { }

  const qCount = await db.select<{ c: number }[]>("SELECT COUNT(*) as c FROM bingo_quotes;");
  if ((qCount?.[0]?.c ?? 0) === 0) {
    for (const text of DEFAULT_QUOTES) {
      await db.execute(`INSERT INTO bingo_quotes (id, text, created_at) VALUES (?, ?, ?)`, [
        crypto.randomUUID(), text, now()
      ]);
    }
  }

  const slotCount = await db.select<{ c: number }[]>("SELECT COUNT(*) as c FROM slots;");
  if ((slotCount?.[0]?.c ?? 0) === 0) {
    for (let i = 0; i < 16; i++) {
      await db.execute("INSERT INTO slots (slot_index, objective_id) VALUES (?, NULL);", [i]);
    }
  }
}

export async function listSlotsWithObjectives() {
  const db = await getBingoDb();
  return db.select<(SlotRow & Partial<Objective>)[]>(
    `SELECT s.slot_index, s.objective_id,
            o.id, o.title, o.goal_kind, o.goal_target, o.goal_unit, o.cover_data,
            o.current_value, o.created_at, o.updated_at, o.pin_bottom, o.frequency_days
     FROM slots s
     LEFT JOIN objectives o ON o.id = s.objective_id
     ORDER BY s.slot_index ASC`
  );
}

export async function createObjectiveAndAssignSlot(
  slotIndex: number,
  patch: Partial<Objective> & { title: string }
) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  const t = now();
  const goal_kind = (patch.goal_kind ?? "count") as Objective["goal_kind"];
  const goal_target = patch.goal_target ?? null;
  const goal_unit = patch.goal_unit ?? null;
  const cover_data = patch.cover_data ?? null;

  await db.execute(
    `INSERT INTO objectives
     (id, title, goal_kind, goal_target, goal_unit, cover_data, current_value, created_at, updated_at, pin_bottom, frequency_days)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, NULL)`,
    [id, patch.title, goal_kind, goal_target, goal_unit, cover_data, t, t]
  );
  await db.execute(`UPDATE slots SET objective_id = ? WHERE slot_index = ?`, [id, slotIndex]);
  return id;
}

export async function updateObjective(id: string, patch: Partial<Objective>) {
  const db = await getBingoDb();
  const t = now();
  const existing = await db.select<Objective[]>(`SELECT * FROM objectives WHERE id = ?`, [id]);
  if (!existing[0]) return;
  const merged: Objective = { ...existing[0], ...patch, updated_at: t };
  await db.execute(
    `UPDATE objectives
     SET title=?, goal_kind=?, goal_target=?, goal_unit=?, cover_data=?, current_value=?,
         pin_bottom=?, frequency_days=?, updated_at=?
     WHERE id=?`,
    [merged.title, merged.goal_kind, merged.goal_target, merged.goal_unit,
     merged.cover_data ?? null, merged.current_value, merged.pin_bottom ?? 0,
     merged.frequency_days ?? null, merged.updated_at, id]
  );
}

export async function getObjective(id: string) {
  const db = await getBingoDb();
  const rows = await db.select<Objective[]>(`SELECT * FROM objectives WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function listSubobjectives(objectiveId: string) {
  const db = await getBingoDb();
  return db.select<Subobjective[]>(
    `SELECT * FROM subobjectives WHERE objective_id = ? ORDER BY created_at ASC`,
    [objectiveId]
  );
}

export async function createSubobjective(
  objectiveId: string,
  title: string,
  unit?: string | null,
  targetTotal?: number | null
) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  const t = now();
  await db.execute(
    `INSERT INTO subobjectives
     (id, objective_id, title, note, target_total, progress_current, unit, is_done, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, 0, ?, 0, ?, ?)`,
    [id, objectiveId, title, targetTotal ?? null, unit ?? null, t, t]
  );
  return id;
}

export async function updateSubobjective(id: string, patch: Partial<Subobjective>) {
  const db = await getBingoDb();
  const t = now();
  const rows = await db.select<Subobjective[]>(`SELECT * FROM subobjectives WHERE id = ?`, [id]);
  if (!rows[0]) return;
  const merged = { ...rows[0], ...patch, updated_at: t };
  await db.execute(
    `UPDATE subobjectives
     SET title=?, note=?, target_total=?, progress_current=?, unit=?, is_done=?, updated_at=?
     WHERE id=?`,
    [merged.title, merged.note ?? null, merged.target_total ?? null,
     merged.progress_current ?? 0, merged.unit ?? null, merged.is_done ?? 0, merged.updated_at, id]
  );
}

export async function deleteSubobjective(id: string) {
  const db = await getBingoDb();
  await db.execute(`DELETE FROM subobjectives WHERE id = ?`, [id]);
}

export async function addTimeSession(subobjectiveId: string, startedAt: number, endedAt: number) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  const duration = Math.max(0, endedAt - startedAt);
  await db.execute(
    `INSERT INTO time_sessions (id, subobjective_id, started_at, ended_at, duration_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [id, subobjectiveId, startedAt, endedAt, duration]
  );
}

export async function getTimeStatsForObjective(objectiveId: string) {
  const db = await getBingoDb();
  const rows = await db.select<{ total_ms: number; last_end: number | null }[]>(
    `SELECT COALESCE(SUM(ts.duration_ms), 0) as total_ms,
            MAX(ts.ended_at) as last_end
     FROM subobjectives so
     LEFT JOIN time_sessions ts ON ts.subobjective_id = so.id
     WHERE so.objective_id = ?`,
    [objectiveId]
  );
  return rows[0] ?? { total_ms: 0, last_end: null };
}

export async function getTimeStatsForSubobjectives(subIds: string[]) {
  if (subIds.length === 0) return new Map<string, { total_ms: number; last_end: number | null }>();
  const db = await getBingoDb();
  const q = `SELECT subobjective_id, COALESCE(SUM(duration_ms),0) as total_ms, MAX(ended_at) as last_end
             FROM time_sessions
             WHERE subobjective_id IN (${subIds.map(() => "?").join(",")})
             GROUP BY subobjective_id`;
  const rows = await db.select<{ subobjective_id: string; total_ms: number; last_end: number | null }[]>(q, subIds);
  const map = new Map<string, { total_ms: number; last_end: number | null }>();
  for (const r of rows) map.set(r.subobjective_id, { total_ms: r.total_ms, last_end: r.last_end });
  return map;
}

export async function listMediaForSubobjectives(subIds: string[]) {
  if (subIds.length === 0) return [];
  const db = await getBingoDb();
  const q = `SELECT * FROM media_items
             WHERE subobjective_id IN (${subIds.map(() => "?").join(",")})
             ORDER BY created_at ASC`;
  return db.select<MediaItem[]>(q, subIds);
}

export async function addQuote(subobjectiveId: string, quoteText: string) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO media_items (id, subobjective_id, kind, data, created_at) VALUES (?, ?, 'quote', ?, ?)`,
    [id, subobjectiveId, quoteText, now()]
  );
}

export async function addImage(subobjectiveId: string, dataUrl: string) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO media_items (id, subobjective_id, kind, data, created_at) VALUES (?, ?, 'image', ?, ?)`,
    [id, subobjectiveId, dataUrl, now()]
  );
}

export type DashboardRow = (SlotRow & Partial<Objective>) & {
  total_ms: number;
  last_end: number | null;
};

export async function listDashboardRows(): Promise<DashboardRow[]> {
  const db = await getBingoDb();
  return db.select<DashboardRow[]>(`
    SELECT
      s.slot_index, s.objective_id,
      o.id, o.title, o.goal_kind, o.goal_target, o.goal_unit, o.cover_data,
      o.current_value, o.created_at, o.updated_at, o.pin_bottom, o.frequency_days,
      COALESCE(SUM(ts.duration_ms), 0) AS total_ms,
      MAX(ts.ended_at) AS last_end
    FROM slots s
    LEFT JOIN objectives o ON o.id = s.objective_id
    LEFT JOIN subobjectives so ON so.objective_id = o.id
    LEFT JOIN time_sessions ts ON ts.subobjective_id = so.id
    GROUP BY s.slot_index, s.objective_id, o.id, o.title, o.goal_kind, o.goal_target,
             o.goal_unit, o.cover_data, o.current_value, o.created_at, o.updated_at,
             o.pin_bottom, o.frequency_days
    ORDER BY s.slot_index ASC
  `);
}

export async function addManualTimeDelta(subobjectiveId: string, deltaMs: number) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  const t = now();
  await db.execute(
    `INSERT INTO time_sessions (id, subobjective_id, started_at, ended_at, duration_ms)
     VALUES (?, ?, ?, ?, ?)`,
    [id, subobjectiveId, t, t, Math.trunc(deltaMs)]
  );
}

export async function setSubobjectiveTotalTime(subobjectiveId: string, desiredTotalMs: number) {
  const db = await getBingoDb();
  const rows = await db.select<{ total_ms: number }[]>(
    `SELECT COALESCE(SUM(duration_ms), 0) as total_ms FROM time_sessions WHERE subobjective_id = ?`,
    [subobjectiveId]
  );
  const current = rows?.[0]?.total_ms ?? 0;
  const delta = Math.trunc(desiredTotalMs - current);
  if (delta !== 0) await addManualTimeDelta(subobjectiveId, delta);
}

export async function deleteMediaItem(mediaId: string) {
  const db = await getBingoDb();
  await db.execute(`DELETE FROM media_items WHERE id = ?`, [mediaId]);
}

export async function listBingoQuotes() {
  const db = await getBingoDb();
  return db.select<QuoteRow[]>(`SELECT * FROM bingo_quotes ORDER BY created_at ASC`);
}

export async function addBingoQuote(text: string) {
  const db = await getBingoDb();
  const id = crypto.randomUUID();
  await db.execute(`INSERT INTO bingo_quotes (id, text, created_at) VALUES (?, ?, ?)`, [id, text, now()]);
  return id;
}

export async function deleteBingoQuote(id: string) {
  const db = await getBingoDb();
  await db.execute(`DELETE FROM bingo_quotes WHERE id = ?`, [id]);
}

export async function exportBingoBackupTo(path: string) {
  const db = await getBingoDb();
  try { await db.execute("PRAGMA wal_checkpoint(TRUNCATE);"); } catch { }
  const escaped = escapeSqliteString(path);
  await db.execute(`VACUUM INTO '${escaped}';`);
}

export async function importBingoBackupFrom(path: string) {
  await closeBingoDb();
  const bytes = await readFile(path);
  const dest = await dbFilePath();
  const wal = dest + "-wal";
  const shm = dest + "-shm";
  if (await exists(dest)) await remove(dest);
  if (await exists(wal)) await remove(wal);
  if (await exists(shm)) await remove(shm);
  await writeFile(dest, bytes);
}
