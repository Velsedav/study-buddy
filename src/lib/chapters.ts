// ── Subject Chapters & Spaced Repetition Recommendations ──

export type FocusType = 'skill' | 'comprehension' | 'memorisation' | null;

export const FOCUS_TYPE_LABELS: Record<string, string> = {
    skill: '🎯 Savoir Faire',
    comprehension: '💡 Comprendre',
    memorisation: '🧠 Mémoriser',
};

export const FOCUS_TYPE_COLORS: Record<string, string> = {
    skill: '#f59e0b',
    comprehension: '#3b82f6',
    memorisation: '#8b5cf6',
};

export interface Chapter {
    id: string;
    subjectId: string;
    name: string;
    studyCount: number;
    lastStudiedAt: string | null;
    createdAt: string;
    focusType: FocusType;
    spacingOverride?: string; // e.g. "1 1 2 5 7", overrides the global default
}

const LS_KEY = 'study-buddy-chapters';
const DEFAULT_SPACING_KEY = 'study-buddy-default-spacing';
export const DEFAULT_SPACING = '1 1 2 5 7';

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

export function getDefaultSpacing(): string {
    return localStorage.getItem(DEFAULT_SPACING_KEY) || DEFAULT_SPACING;
}

export function setDefaultSpacing(schedule: string) {
    localStorage.setItem(DEFAULT_SPACING_KEY, schedule);
}

export function parseSpacing(schedule: string): number[] {
    return schedule.trim().split(/\s+/).map(Number).filter(n => n > 0 && !isNaN(n));
}

function getIntervalForCount(intervals: number[], studyCount: number): number {
    if (intervals.length === 0) return 1;
    const idx = studyCount - 1; // studyCount is 1-based
    return idx < intervals.length ? intervals[idx] : intervals[intervals.length - 1];
}

export function getAllChapters(): Chapter[] {
    return loadAll();
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
        focusType: null,
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
    if (ch) {
        ch.studyCount += 1;
        ch.lastStudiedAt = new Date().toISOString();
    }
    saveAll(all);
}

export function updateChapterFocusType(id: string, focusType: FocusType) {
    const all = loadAll();
    const ch = all.find(c => c.id === id);
    if (ch) {
        ch.focusType = focusType;
    }
    saveAll(all);
}

export function updateChapterSpacing(id: string, spacingOverride: string | null) {
    const all = loadAll();
    const ch = all.find(c => c.id === id);
    if (ch) {
        if (spacingOverride) {
            ch.spacingOverride = spacingOverride;
        } else {
            delete ch.spacingOverride;
        }
    }
    saveAll(all);
}

export interface Recommendation {
    chapter: Chapter;
    subjectName: string;
    daysOverdue: number;
}

export function getRecommendations(subjectNames: Record<string, string>): Recommendation[] {
    const all = loadAll();
    const defaultSpacing = getDefaultSpacing();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const recommendations: Recommendation[] = [];

    for (const ch of all) {
        if (ch.studyCount === 0 || !ch.lastStudiedAt) continue;

        const schedule = ch.spacingOverride || defaultSpacing;
        const intervals = parseSpacing(schedule);
        const intervalDays = getIntervalForCount(intervals, ch.studyCount);

        const lastStudied = new Date(ch.lastStudiedAt);
        lastStudied.setHours(0, 0, 0, 0);

        const dueDate = new Date(lastStudied);
        dueDate.setDate(dueDate.getDate() + intervalDays);

        const diffMs = now.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (daysOverdue >= 0) {
            recommendations.push({
                chapter: ch,
                subjectName: subjectNames[ch.subjectId] || 'Unknown',
                daysOverdue,
            });
        }
    }

    recommendations.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return recommendations;
}
