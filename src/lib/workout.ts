export interface MuscleGroup {
    id: string;
    label: string;
    emoji: string;
    category: 'upper' | 'lower' | 'core' | 'stretch';
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
    // Haut du corps
    { id: 'biceps',      label: 'Biceps',      emoji: '💪', category: 'upper' },
    { id: 'triceps',     label: 'Triceps',     emoji: '💪', category: 'upper' },
    { id: 'epaules',     label: 'Épaules',     emoji: '🏋️', category: 'upper' },
    // Bas du corps
    { id: 'quadriceps',  label: 'Quadriceps',  emoji: '🦵', category: 'lower' },
    { id: 'ischios',     label: 'Ischios',     emoji: '🦵', category: 'lower' },
    { id: 'fessiers',    label: 'Fessiers',    emoji: '🍑', category: 'lower' },
    { id: 'mollets',     label: 'Mollets',     emoji: '🦵', category: 'lower' },
    // Core
    { id: 'abdos',       label: 'Abdos',       emoji: '🔥', category: 'core' },
    { id: 'obliques',    label: 'Obliques',    emoji: '🔥', category: 'core' },
    { id: 'gainage',     label: 'Gainage',     emoji: '🧱', category: 'core' },
    // Étirements
    { id: 'front-split', label: 'Front Split', emoji: '🤸', category: 'stretch' },
    { id: 'split',       label: 'Split',       emoji: '🤸', category: 'stretch' },
    { id: 'psoas',       label: 'Psoas',       emoji: '🧘', category: 'stretch' },
];

export const CATEGORY_LABELS: Record<MuscleGroup['category'], string> = {
    upper:   'Haut du corps',
    lower:   'Bas du corps',
    core:    'Core',
    stretch: 'Étirements',
};

const WORKOUT_LOG_KEY = 'study-buddy-workout-log';

export type WorkoutLog = Record<string, string>; // id → ISO date string

export function loadWorkoutLog(): WorkoutLog {
    try {
        const saved = localStorage.getItem(WORKOUT_LOG_KEY);
        if (saved) return JSON.parse(saved);
    } catch {}
    return {};
}

export function markMuscleWorked(id: string, log: WorkoutLog): WorkoutLog {
    const next = { ...log, [id]: new Date().toISOString() };
    localStorage.setItem(WORKOUT_LOG_KEY, JSON.stringify(next));
    return next;
}

export function isMuscleEligible(id: string, log: WorkoutLog): boolean {
    const lastStr = log[id];
    if (!lastStr) return true;
    const lastDay = new Date(lastStr);
    lastDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / 86_400_000);
    return diffDays >= 2;
}
