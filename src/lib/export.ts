import { writeTextFile, readTextFile, readFile, writeFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getDb } from './db';
import { getBingoDb } from './bingoals/db';

// ── Config ────────────────────────────────────────────────────────────────────

const EXPORT_CONFIG_KEY = 'study-buddy-export-config';
const LAST_EXPORT_KEY = 'study-buddy-last-export';
const EXPORT_FILENAME = 'studybuddy-backup.json';

export interface ExportConfig {
    path1: string;
    path2: string;
}

export function getExportConfig(): ExportConfig {
    try {
        const raw = localStorage.getItem(EXPORT_CONFIG_KEY);
        if (raw) return { path1: '', path2: '', ...JSON.parse(raw) };
    } catch {}
    return { path1: '', path2: '' };
}

export function saveExportConfig(config: ExportConfig) {
    localStorage.setItem(EXPORT_CONFIG_KEY, JSON.stringify(config));
}

export function getLastExportTime(): string | null {
    return localStorage.getItem(LAST_EXPORT_KEY);
}

function setLastExportTime() {
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
}

// ── Dump ──────────────────────────────────────────────────────────────────────

/** Convert bytes to a base64 data URL string. */
function bytesToBase64(bytes: Uint8Array, mimeType = 'image/jpeg'): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return `data:${mimeType};base64,` + btoa(binary);
}

/** Convert a base64 data URL back to Uint8Array. */
function base64ToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function dumpStudyBuddyDb() {
    const db = await getDb();
    const [subjects, tags, subject_tags, subgoals, sessions, session_blocks, quotes, metacognition_logs] = await Promise.all([
        db.select<any[]>('SELECT * FROM subjects'),
        db.select('SELECT * FROM tags'),
        db.select('SELECT * FROM subject_tags'),
        db.select('SELECT * FROM subgoals'),
        db.select('SELECT * FROM sessions ORDER BY started_at'),
        db.select('SELECT * FROM session_blocks ORDER BY session_id, idx'),
        db.select('SELECT * FROM quotes ORDER BY idx'),
        db.select('SELECT * FROM metacognition_logs ORDER BY created_at'),
    ]);

    // Embed subject cover images as base64 so they survive cross-device transfers
    const subject_covers: { path: string; data: string }[] = [];
    for (const s of subjects as any[]) {
        if (!s.cover_path) continue;
        try {
            const bytes = await readFile(s.cover_path, { baseDir: BaseDirectory.AppData });
            const ext = s.cover_path.split('.').pop()?.toLowerCase() || 'jpg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            subject_covers.push({ path: s.cover_path, data: bytesToBase64(bytes, mime) });
        } catch {
            // File missing or unreadable — skip, don't abort the whole export
        }
    }

    return { subjects, tags, subject_tags, subgoals, sessions, session_blocks, quotes, metacognition_logs, subject_covers };
}

async function dumpBingoDb() {
    const db = await getBingoDb();
    const [objectives, subobjectives, time_sessions, media_items, bingo_year_slots, bingo_quotes, slots] = await Promise.all([
        db.select('SELECT * FROM objectives'),
        db.select('SELECT * FROM subobjectives'),
        db.select('SELECT * FROM time_sessions'),
        db.select('SELECT * FROM media_items'),
        db.select('SELECT * FROM bingo_year_slots'),
        db.select('SELECT * FROM bingo_quotes'),
        db.select('SELECT * FROM slots'),
    ]);
    return { objectives, subobjectives, time_sessions, media_items, bingo_year_slots, bingo_quotes, slots };
}

const LS_KEYS = [
    'study-buddy-chapters',
    'study-buddy-default-spacing',
    'study-buddy-mastery-ratings',
    'study-buddy-pre-recall',
    'study-buddy-technique-week',
    'study-buddy-weekly-technique',
    'study-buddy-srs-state',
    'study-buddy-quiz-state',
    'study-buddy-learned-techs',
    'study-buddy-workout-log',
    'study-buddy-goal-dates',
    'study-buddy-custom-prep',
    'study-buddy-custom-break',
];

function dumpLocalStorage(): Record<string, string | null> {
    const data: Record<string, string | null> = {};
    for (const key of LS_KEYS) {
        data[key] = localStorage.getItem(key);
    }
    return data;
}

async function createBackup() {
    const [studyBuddy, bingoals] = await Promise.all([dumpStudyBuddyDb(), dumpBingoDb()]);
    return {
        version: 1,
        app_version: '1.6.0',
        exported_at: new Date().toISOString(),
        study_buddy: studyBuddy,
        bingoals,
        local_storage: dumpLocalStorage(),
    };
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Join a folder path with the backup filename using the correct OS separator. */
function folderToFilePath(folderPath: string): string {
    const clean = folderPath.replace(/[/\\]+$/, '');
    const sep = clean.includes('\\') && !clean.startsWith('/') ? '\\' : '/';
    return clean + sep + EXPORT_FILENAME;
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Export to a specific file path (already includes filename). */
export async function exportToFilePath(filePath: string): Promise<void> {
    const backup = await createBackup();
    await writeTextFile(filePath, JSON.stringify(backup, null, 2));
    setLastExportTime();
}

/** Export to all configured folder paths. Returns which paths succeeded / failed. */
export async function exportToConfiguredPaths(): Promise<{ saved: string[]; errors: { path: string; error: string }[] }> {
    const config = getExportConfig();
    const folders = [config.path1, config.path2].filter(p => p.trim() !== '');

    if (folders.length === 0) return { saved: [], errors: [] };

    const backup = await createBackup();
    const json = JSON.stringify(backup, null, 2);
    const saved: string[] = [];
    const errors: { path: string; error: string }[] = [];

    for (const folder of folders) {
        const filePath = folderToFilePath(folder);
        try {
            await writeTextFile(filePath, json);
            saved.push(filePath);
        } catch (e) {
            errors.push({ path: filePath, error: String(e) });
        }
    }

    if (saved.length > 0) setLastExportTime();
    return { saved, errors };
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

/** Open a folder picker. Returns the chosen folder path or null. */
export async function pickExportFolder(): Promise<string | null> {
    const result = await open({ directory: true, multiple: false } as any);
    return typeof result === 'string' ? result : null;
}

/** Open a file save dialog. Returns the chosen file path or null. */
export async function pickSaveFilePath(): Promise<string | null> {
    const result = await save({
        filters: [{ name: 'Study Buddy Backup', extensions: ['json'] }],
        defaultPath: EXPORT_FILENAME,
    });
    return typeof result === 'string' ? result : null;
}

/** Open a file open dialog for import. Returns the chosen file path or null. */
export async function pickImportFilePath(): Promise<string | null> {
    const result = await open({
        filters: [{ name: 'Study Buddy Backup', extensions: ['json'] }],
        multiple: false,
    } as any);
    return typeof result === 'string' ? result : null;
}

// ── Import & Merge ────────────────────────────────────────────────────────────

async function mergeStudyBuddyDb(data: Record<string, any[]>) {
    const db = await getDb();

    // Restore subject cover image files before inserting subjects
    const covers: { path: string; data: string }[] = data.subject_covers ?? [];
    if (covers.length > 0) {
        const hasCoversDir = await exists('covers', { baseDir: BaseDirectory.AppData });
        if (!hasCoversDir) {
            await mkdir('covers', { baseDir: BaseDirectory.AppData, recursive: true });
        }
        for (const cover of covers) {
            try {
                // Only write if the file doesn't already exist locally
                const alreadyExists = await exists(cover.path, { baseDir: BaseDirectory.AppData });
                if (!alreadyExists) {
                    await writeFile(cover.path, base64ToBytes(cover.data), { baseDir: BaseDirectory.AppData });
                }
            } catch {}
        }
    }

    for (const s of data.subjects ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO subjects
                 (id,name,cover_path,pinned,created_at,last_studied_at,total_minutes,deadline,result,archived,deleted_at,subject_type)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [s.id, s.name, s.cover_path, s.pinned, s.created_at, s.last_studied_at,
                 s.total_minutes, s.deadline, s.result, s.archived, s.deleted_at, s.subject_type ?? null]
            );
        } catch {}
    }

    for (const t of data.tags ?? []) {
        try {
            await db.execute(`INSERT OR IGNORE INTO tags (id,name) VALUES ($1,$2)`, [t.id, t.name]);
        } catch {}
    }

    for (const st of data.subject_tags ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO subject_tags (subject_id,tag_id) VALUES ($1,$2)`,
                [st.subject_id, st.tag_id]
            );
        } catch {}
    }

    for (const sg of data.subgoals ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO subgoals (id,subject_id,text,done,created_at) VALUES ($1,$2,$3,$4,$5)`,
                [sg.id, sg.subject_id, sg.text, sg.done, sg.created_at]
            );
        } catch {}
    }

    for (const s of data.sessions ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO sessions (id,started_at,ended_at,template,repeats,planned_minutes,actual_minutes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [s.id, s.started_at, s.ended_at, s.template, s.repeats, s.planned_minutes, s.actual_minutes]
            );
        } catch {}
    }

    for (const b of data.session_blocks ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO session_blocks (id,session_id,idx,type,minutes,subject_id,technique_id,started_at,ended_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [b.id, b.session_id, b.idx, b.type, b.minutes, b.subject_id, b.technique_id, b.started_at ?? null, b.ended_at ?? null]
            );
        } catch {}
    }

    for (const q of data.quotes ?? []) {
        if (String(q.id).startsWith('default_')) continue;
        try {
            await db.execute(
                `INSERT OR IGNORE INTO quotes (id,text,idx) VALUES ($1,$2,$3)`,
                [q.id, q.text, q.idx]
            );
        } catch {}
    }

    for (const m of data.metacognition_logs ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO metacognition_logs
                 (id,created_at,retention,focus_drop,memorization_align,mechanical_fix,free_time_hours,priority_subject_ids)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [m.id, m.created_at, m.retention, m.focus_drop, m.memorization_align,
                 m.mechanical_fix, m.free_time_hours ?? null, m.priority_subject_ids ?? null]
            );
        } catch {}
    }
}

async function mergeBingoDb(data: Record<string, any[]>) {
    const db = await getBingoDb();

    for (const o of data.objectives ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO objectives
                 (id,title,goal_kind,goal_target,goal_unit,cover_data,current_value,created_at,updated_at,pin_bottom,frequency_days)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [o.id, o.title, o.goal_kind, o.goal_target, o.goal_unit, o.cover_data,
                 o.current_value, o.created_at, o.updated_at, o.pin_bottom, o.frequency_days ?? null]
            );
        } catch {}
    }

    for (const s of data.subobjectives ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO subobjectives
                 (id,objective_id,title,note,target_total,progress_current,unit,is_done,created_at,updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [s.id, s.objective_id, s.title, s.note ?? null, s.target_total ?? null,
                 s.progress_current, s.unit ?? null, s.is_done, s.created_at, s.updated_at]
            );
        } catch {}
    }

    for (const ts of data.time_sessions ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO time_sessions (id,subobjective_id,started_at,ended_at,duration_ms) VALUES (?,?,?,?,?)`,
                [ts.id, ts.subobjective_id, ts.started_at, ts.ended_at, ts.duration_ms]
            );
        } catch {}
    }

    for (const m of data.media_items ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO media_items (id,subobjective_id,kind,data,created_at) VALUES (?,?,?,?,?)`,
                [m.id, m.subobjective_id, m.kind, m.data, m.created_at]
            );
        } catch {}
    }

    for (const s of data.bingo_year_slots ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO bingo_year_slots (slot_index,year,objective_id) VALUES (?,?,?)`,
                [s.slot_index, s.year, s.objective_id ?? null]
            );
        } catch {}
    }

    for (const q of data.bingo_quotes ?? []) {
        try {
            await db.execute(
                `INSERT OR IGNORE INTO bingo_quotes (id,text,created_at) VALUES (?,?,?)`,
                [q.id, q.text, q.created_at]
            );
        } catch {}
    }
}

function mergeLocalStorage(data: Record<string, string | null>) {
    // chapters: merge by ID (additive — keep local + add missing from import)
    const localChaptersRaw = localStorage.getItem('study-buddy-chapters');
    const importedChaptersRaw = data['study-buddy-chapters'];
    if (importedChaptersRaw) {
        try {
            const local: any[] = localChaptersRaw ? JSON.parse(localChaptersRaw) : [];
            const imported: any[] = JSON.parse(importedChaptersRaw);
            const localIds = new Set(local.map((c: any) => c.id));
            const merged = [...local, ...imported.filter((c: any) => !localIds.has(c.id))];
            localStorage.setItem('study-buddy-chapters', JSON.stringify(merged));
        } catch {}
    }

    // mastery ratings: merge by composite key
    const localRatingsRaw = localStorage.getItem('study-buddy-mastery-ratings');
    const importedRatingsRaw = data['study-buddy-mastery-ratings'];
    if (importedRatingsRaw) {
        try {
            const local: any[] = localRatingsRaw ? JSON.parse(localRatingsRaw) : [];
            const imported: any[] = JSON.parse(importedRatingsRaw);
            const localKeys = new Set(
                local.map((r: any) => `${r.chapterId}::${r.sessionId}::${r.ratedAt}`)
            );
            const merged = [
                ...local,
                ...imported.filter((r: any) => !localKeys.has(`${r.chapterId}::${r.sessionId}::${r.ratedAt}`))
            ];
            localStorage.setItem('study-buddy-mastery-ratings', JSON.stringify(merged));
        } catch {}
    }

    // everything else: restore only if the key is absent locally
    const skipKeys = new Set(['study-buddy-chapters', 'study-buddy-mastery-ratings']);
    for (const key of LS_KEYS) {
        if (skipKeys.has(key)) continue;
        if (data[key] != null && localStorage.getItem(key) === null) {
            localStorage.setItem(key, data[key]!);
        }
    }
}

/** Load a backup file, validate it, and merge everything into the local databases. */
export async function importBackup(filePath: string): Promise<void> {
    const raw = await readTextFile(filePath);
    const backup = JSON.parse(raw);

    if (!backup.version || !backup.study_buddy || !backup.bingoals) {
        throw new Error('Invalid backup file — missing required sections.');
    }

    await mergeStudyBuddyDb(backup.study_buddy);
    await mergeBingoDb(backup.bingoals);
    if (backup.local_storage) {
        mergeLocalStorage(backup.local_storage);
    }
}

/** Called on window close. Silently exports to all configured paths, swallows errors. */
export async function autoExportToConfiguredPaths(): Promise<void> {
    const config = getExportConfig();
    const folders = [config.path1, config.path2].filter(p => p.trim() !== '');
    if (folders.length === 0) return;

    try {
        const backup = await createBackup();
        const json = JSON.stringify(backup, null, 2);
        for (const folder of folders) {
            try {
                await writeTextFile(folderToFilePath(folder), json);
            } catch {}
        }
        setLastExportTime();
    } catch {}
}
