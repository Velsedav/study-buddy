// ── Subject Chapters & Spaced Repetition Recommendations ──

export interface Chapter {
    id: string;
    subjectId: string;
    name: string;
    studyCount: number;   // 0–3
    lastStudiedAt: string | null;
    createdAt: string;
}

const LS_KEY = 'study-buddy-chapters';

function loadAll(): Chapter[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw);
    } catch { }
    return [];
}

function saveAll(chapters: Chapter[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(chapters));
}

export function getChaptersForSubject(subjectId: string): Chapter[] {
    return loadAll().filter(c => c.subjectId === subjectId);
}

export function addChapter(subjectId: string, name: string): Chapter {
    const all = loadAll();
    const ch: Chapter = {
        id: crypto.randomUUID(),
        subjectId,
        name,
        studyCount: 0,
        lastStudiedAt: null,
        createdAt: new Date().toISOString(),
    };
    all.push(ch);
    saveAll(all);
    return ch;
}

export function deleteChapter(id: string) {
    const all = loadAll().filter(c => c.id !== id);
    saveAll(all);
}

export function incrementStudyCount(id: string) {
    const all = loadAll();
    const ch = all.find(c => c.id === id);
    if (ch && ch.studyCount < 3) {
        ch.studyCount += 1;
        ch.lastStudiedAt = new Date().toISOString();
    }
    saveAll(all);
}

/**
 * Spaced repetition recommendation engine.
 * After studyCount=1 → recommend next day (1 day later)
 * After studyCount=2 → recommend 3 days later
 * After studyCount=3 → done (mastered)
 */
const SPACING_DAYS = [1, 3, 5]; // after 1st study → 1 day, after 2nd → 3 days, after 3rd → 5 days

export interface Recommendation {
    chapter: Chapter;
    subjectName: string;
    daysOverdue: number; // negative = not yet due
}

export function getRecommendations(subjectNames: Record<string, string>): Recommendation[] {
    const all = loadAll();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const recommendations: Recommendation[] = [];

    for (const ch of all) {
        if (ch.studyCount >= 3 || ch.studyCount === 0 || !ch.lastStudiedAt) continue;

        const spacingIndex = ch.studyCount - 1; // 0, 1, or 2
        const intervalDays = SPACING_DAYS[spacingIndex] ?? 5;

        const lastStudied = new Date(ch.lastStudiedAt);
        lastStudied.setHours(0, 0, 0, 0);

        const dueDate = new Date(lastStudied);
        dueDate.setDate(dueDate.getDate() + intervalDays);

        const diffMs = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Show if due today or overdue
        if (daysOverdue >= 0) {
            recommendations.push({
                chapter: ch,
                subjectName: subjectNames[ch.subjectId] || 'Unknown',
                daysOverdue,
            });
        }
    }

    // Sort most overdue first
    recommendations.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return recommendations;
}
