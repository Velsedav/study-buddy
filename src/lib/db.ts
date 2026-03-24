import Database from '@tauri-apps/plugin-sql';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = await Database.load('sqlite:study_buddy.db');
    }
    return dbInstance;
}

/** 
 * Safe migration fallback. 
 * Since sqlite-plugin migrations might sometimes fail/skip if multi-statement ALTER TABLE is used,
 * we proactively try to add all columns that might be missing. 
 */
export async function patchSchema() {
    const db = await getDb();
    const cols = [
        { name: 'deadline', type: 'TEXT NULL' },
        { name: 'archived', type: 'INT DEFAULT 0' },
        { name: 'focus_type', type: 'TEXT NULL' },
        { name: 'chapters', type: 'TEXT NULL' },
        { name: 'result', type: 'TEXT NULL' },
        { name: 'deleted_at', type: 'TEXT NULL' },
        { name: 'subject_type', type: 'TEXT NULL' }
    ];

    for (const c of cols) {
        try {
            await db.execute(`ALTER TABLE subjects ADD COLUMN ${c.name} ${c.type}`);
            console.log(`[SchemaPatch] Added column ${c.name}`);
        } catch (e) {
            // Ignore error - column likely already exists
        }
    }
}


export interface Subject {
    id: string;
    name: string;
    cover_path: string | null;
    pinned: boolean; // mapped from INT 0/1
    created_at: string;
    last_studied_at: string | null;
    total_minutes: number;
    deadline: string | null;
    result: string | null;
    archived: boolean;
    deleted_at: string | null;
    subject_type: string | null;
}

export interface Tag {
    id: string;
    name: string;
}

export interface Subgoal {
    id: string;
    subject_id: string;
    text: string;
    done: boolean;
    created_at: string;
}

export interface Session {
    id: string;
    started_at: string;
    ended_at: string | null;
    template: string;
    repeats: number;
    planned_minutes: number;
    actual_minutes: number;
}

// Queries
export async function getSubjects(): Promise<Subject[]> {
    const db = await getDb();
    const rows = await db.select<Subject[]>(`SELECT * FROM subjects WHERE deleted_at IS NULL`);
    return rows.map(r => ({ ...r, pinned: Boolean(r.pinned), archived: Boolean(r.archived) }));
}

export async function getSubject(id: string): Promise<Subject | null> {
    const db = await getDb();
    const rows = await db.select<Subject[]>(`SELECT * FROM subjects WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return { ...r, pinned: Boolean(r.pinned), archived: Boolean(r.archived) };
}

export async function getTrashedSubjects(): Promise<Subject[]> {
    const db = await getDb();
    const rows = await db.select<Subject[]>(`SELECT * FROM subjects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`);
    return rows.map(r => ({ ...r, pinned: Boolean(r.pinned), archived: Boolean(r.archived) }));
}

export async function softDeleteSubject(id: string) {
    const db = await getDb();
    await db.execute(`UPDATE subjects SET deleted_at = $1 WHERE id = $2`, [new Date().toISOString(), id]);
}

export async function restoreSubject(id: string) {
    const db = await getDb();
    await db.execute(`UPDATE subjects SET deleted_at = NULL WHERE id = $1`, [id]);
}

export async function permanentlyDeleteSubject(id: string) {
    const db = await getDb();
    await db.execute(`DELETE FROM subject_tags WHERE subject_id = $1`, [id]);
    await db.execute(`DELETE FROM subjects WHERE id = $1`, [id]);
}

export async function getSubjectTags(subjectId: string): Promise<Tag[]> {
    const db = await getDb();
    return db.select<Tag[]>(`
    SELECT t.* FROM tags t
    JOIN subject_tags st ON st.tag_id = t.id
    WHERE st.subject_id = $1
  `, [subjectId]);
}

export async function getAllTags(): Promise<Tag[]> {
    const db = await getDb();
    return db.select<Tag[]>(`SELECT * FROM tags ORDER BY name`);
}

export async function createSubject(subject: Omit<Subject, 'pinned' | 'archived'> & { pinned: boolean, archived: boolean }, tags: string[]) {
    const db = await getDb();
    await db.execute(
        `INSERT INTO subjects (id, name, cover_path, pinned, created_at, last_studied_at, total_minutes, deadline, result, archived, subject_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [subject.id, subject.name, subject.cover_path, subject.pinned ? 1 : 0, subject.created_at, subject.last_studied_at, subject.total_minutes, subject.deadline, subject.result, subject.archived ? 1 : 0, subject.subject_type ?? null]
    );

    for (const tName of tags) {
        // Upsert tag
        const normalized = tName.trim().toLowerCase();
        if (!normalized) continue;

        // Quick and dirty upsert using ignore or checking
        let tagRows = await db.select<Tag[]>(`SELECT * FROM tags WHERE LOWER(name) = $1`, [normalized]);
        let tagId = tagRows[0]?.id;
        if (!tagId) {
            tagId = crypto.randomUUID();
            await db.execute(`INSERT INTO tags (id, name) VALUES ($1, $2)`, [tagId, normalized]);
        }
        await db.execute(`INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES ($1, $2)`, [subject.id, tagId]);
    }
}

export async function deleteSubject(id: string) {
    const db = await getDb();
    await db.execute(`DELETE FROM subject_tags WHERE subject_id = $1`, [id]);
    await db.execute(`DELETE FROM subjects WHERE id = $1`, [id]);
}

export async function updateSubjectPin(id: string, pinned: boolean) {
    const db = await getDb();
    await db.execute(`UPDATE subjects SET pinned = $1 WHERE id = $2`, [pinned ? 1 : 0, id]);
}

export async function updateSubjectCover(id: string, path: string | null) {
    const db = await getDb();
    await db.execute(`UPDATE subjects SET cover_path = $1 WHERE id = $2`, [path, id]);
}

export async function updateSubject(id: string, name: string, coverPath: string | null, tags: string[], deadline: string | null, result: string | null, archived: boolean, subjectType?: string | null) {
    const db = await getDb();
    await db.execute(
        `UPDATE subjects SET name = $1, cover_path = $2, deadline = $3, result = $4, archived = $5, subject_type = $6 WHERE id = $7`,
        [name, coverPath, deadline, result, archived ? 1 : 0, subjectType ?? null, id]
    );

    // Replace all tag associations
    await db.execute(`DELETE FROM subject_tags WHERE subject_id = $1`, [id]);
    for (const tName of tags) {
        const normalized = tName.trim().toLowerCase();
        if (!normalized) continue;
        let tagRows = await db.select<Tag[]>(`SELECT * FROM tags WHERE LOWER(name) = $1`, [normalized]);
        let tagId = tagRows[0]?.id;
        if (!tagId) {
            tagId = crypto.randomUUID();
            await db.execute(`INSERT INTO tags (id, name) VALUES ($1, $2)`, [tagId, normalized]);
        }
        await db.execute(`INSERT OR IGNORE INTO subject_tags (subject_id, tag_id) VALUES ($1, $2)`, [id, tagId]);
    }
}

export async function updateTagName(id: string, newName: string) {
    const db = await getDb();
    await db.execute(`UPDATE tags SET name = $1 WHERE id = $2`, [newName.trim().toLowerCase(), id]);
}

export async function getAllSubjectTagsMap(): Promise<Map<string, string[]>> {
    const db = await getDb();
    const rows = await db.select<{ subject_id: string; tag_name: string }[]>(
        `SELECT st.subject_id, t.name as tag_name FROM subject_tags st JOIN tags t ON t.id = st.tag_id`
    );
    const map = new Map<string, string[]>();
    for (const row of rows) {
        if (!map.has(row.subject_id)) map.set(row.subject_id, []);
        map.get(row.subject_id)!.push(row.tag_name);
    }
    return map;
}

export async function updateSubjectStats(id: string, addMinutes: number, studiedAt: string) {
    const db = await getDb();
    // We need to fetch current total to add, or just do SET total = total + $1
    await db.execute(
        `UPDATE subjects SET total_minutes = total_minutes + $1, last_studied_at = $2 WHERE id = $3`,
        [addMinutes, studiedAt, id]
    );
}

export async function saveSession(session: Omit<Session, 'id'> & { id: string }, blocks: any[]) {
    const db = await getDb();
    await db.execute(
        `INSERT INTO sessions (id, started_at, ended_at, template, repeats, planned_minutes, actual_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [session.id, session.started_at, session.ended_at, session.template, session.repeats, session.planned_minutes, session.actual_minutes]
    );

    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        await db.execute(
            `INSERT INTO session_blocks (id, session_id, idx, type, minutes, subject_id, technique_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [crypto.randomUUID(), session.id, i, b.type, b.minutes, b.subject_id, b.technique_id]
        );
    }
}

// ── Sessions ──
export async function getSessions(): Promise<Session[]> {
    const db = await getDb();
    return db.select<Session[]>(`SELECT * FROM sessions ORDER BY started_at DESC`);
}

export interface SessionBlock {
    id: string;
    session_id: string;
    idx: number;
    type: string;
    minutes: number;
    subject_id: string | null;
    technique_id: string | null;
    started_at: string | null;
    ended_at: string | null;
}

export async function getAllSessionBlocks(): Promise<SessionBlock[]> {
    const db = await getDb();
    return db.select<SessionBlock[]>(`SELECT * FROM session_blocks`);
}

// ── Quotes ──

export interface Quote {
    id: string;
    text: string;
    idx: number;
}

export async function getQuotes(): Promise<Quote[]> {
    const db = await getDb();
    return db.select<Quote[]>(`SELECT * FROM quotes ORDER BY idx`);
}

export async function addQuote(text: string) {
    const db = await getDb();
    const rows = await db.select<{ mx: number | null }[]>(`SELECT MAX(idx) as mx FROM quotes`);
    const nextIdx = (rows[0]?.mx ?? -1) + 1;
    await db.execute(`INSERT INTO quotes (id, text, idx) VALUES ($1, $2, $3)`, [crypto.randomUUID(), text, nextIdx]);
}

export async function updateQuote(id: string, text: string) {
    const db = await getDb();
    await db.execute(`UPDATE quotes SET text = $1 WHERE id = $2`, [text, id]);
}

export async function deleteQuote(id: string) {
    const db = await getDb();
    await db.execute(`DELETE FROM quotes WHERE id = $1`, [id]);
}

// ── Metacognition Logs ──

export interface MetacognitionLog {
    id: string;
    created_at: string;
    retention: string;
    focus_drop: string;
    memorization_align: string;
    mechanical_fix: string;
    free_time_hours: number | null;
    priority_subject_ids: string | null;
}

export async function getMetacognitionLogs(): Promise<MetacognitionLog[]> {
    const db = await getDb();
    return db.select<MetacognitionLog[]>(`SELECT * FROM metacognition_logs ORDER BY created_at DESC`);
}

export async function saveMetacognitionLog(log: Omit<MetacognitionLog, 'id' | 'created_at'>) {
    const db = await getDb();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    await db.execute(
        `INSERT INTO metacognition_logs (id, created_at, retention, focus_drop, memorization_align, mechanical_fix, free_time_hours, priority_subject_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, created_at, log.retention, log.focus_drop, log.memorization_align, log.mechanical_fix, log.free_time_hours, log.priority_subject_ids]
    );
}

// ── Wipe All Data ──
export async function deleteAllData() {
    const db = await getDb();
    await db.execute(`DELETE FROM sessions`);
    await db.execute(`DELETE FROM session_blocks`);
    await db.execute(`DELETE FROM subgoals`);
    await db.execute(`DELETE FROM subject_tags`);
    await db.execute(`DELETE FROM tags`);
    await db.execute(`DELETE FROM subjects`);
    await db.execute(`DELETE FROM quotes WHERE id NOT LIKE 'default_%'`);
    await db.execute(`DELETE FROM metacognition_logs`);

    const keysToRemove = [
        'study-buddy-technique-week',
        'study-buddy-weekly-technique',
        'study-buddy-srs-state',
        'study-buddy-quiz-state',
        'study-buddy-ignored-recs',
        'study-buddy-metacognition-last',
        'study-buddy-learned-techs',
        'study-buddy-technique-link-date',
        'study-buddy-workout-log',
        'study-buddy-goal-dates',
        'study-buddy-chapters',
        'study-buddy-custom-prep',
        'study-buddy-custom-break',
        'activeSession',
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
}
