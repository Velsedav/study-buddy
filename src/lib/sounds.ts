export const SFX = {
    HOVER: 'hover_sound',
    CHECKLIST: 'checklist_sound',
    PAUSE: 'pause_theme',
    START_SESSION: 'start_study_session',
    DROP_BLOCK: 'drop_block',
    DRAG_UP: 'drag_up',
    DRAG_DOWN: 'drag_down',
    CANCELLING: 'cancelling',
    ENTER_LESSON: 'entering_lesson',
    PERFECT_SCORE: 'perfect_score',
    COOLDOWN: '10sec-cooldown'
} as const;

export type SoundEffect = typeof SFX[keyof typeof SFX];

/** Human-friendly display names for each sound effect */
export const SFX_LABELS: Record<SoundEffect, string> = {
    hover_sound: 'Hover',
    checklist_sound: 'Checklist',
    pause_theme: 'Pause',
    start_study_session: 'Start Session',
    drop_block: 'Drop Block',
    drag_up: 'Drag Up',
    drag_down: 'Drag Down',
    cancelling: 'Cancel / Error',
    entering_lesson: 'Enter Lesson',
    perfect_score: 'Perfect Score',
    '10sec-cooldown': '10s Warning',
};

// ── Volume Management ──

export interface VolumeSettings {
    master: number; // 0–100
    individual: Partial<Record<SoundEffect, number>>; // 0–100 per effect
}

const DEFAULT_VOLUMES: VolumeSettings = {
    master: 100,
    individual: {},
};

let volumeSettings: VolumeSettings = DEFAULT_VOLUMES;

export function loadVolumeSettings(): VolumeSettings {
    try {
        const saved = localStorage.getItem('study-buddy-volume');
        if (saved) {
            volumeSettings = { ...DEFAULT_VOLUMES, ...JSON.parse(saved) };
            return volumeSettings;
        }
    } catch { }
    return DEFAULT_VOLUMES;
}

export function saveVolumeSettings(settings: VolumeSettings) {
    volumeSettings = settings;
    localStorage.setItem('study-buddy-volume', JSON.stringify(settings));
}

export function getEffectiveVolume(effectName: SoundEffect): number {
    const master = (volumeSettings.master ?? 100) / 100;
    const individual = (volumeSettings.individual[effectName] ?? 100) / 100;
    return master * individual;
}

// Initialize on load
loadVolumeSettings();

// ── Audio Cache & Playback ──

const audioCache: { [key: string]: HTMLAudioElement } = {};

/** Stop all currently playing sounds */
export function stopAllSounds() {
    for (const key in audioCache) {
        const audio = audioCache[key];
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
    }
}

export function playSFX(effectName: SoundEffect, theme: string = 'glassmorphism') {
    const isTerminalTheme = theme === 'orange-terminal' || theme === 'green-terminal';
    const prefix = isTerminalTheme ? '02_' : '01_';

    const fileName = `${prefix}${effectName}.mp3`;
    const filePath = `/audio/${fileName}`;

    try {
        if (!audioCache[filePath]) {
            audioCache[filePath] = new Audio(filePath);
        }

        // Stop any currently playing sounds before starting new one
        stopAllSounds();

        const audio = audioCache[filePath];
        audio.volume = getEffectiveVolume(effectName);
        audio.currentTime = 0;

        audio.play().catch(e => {
            console.warn(`Could not play sound ${fileName}:`, e.message);
        });
    } catch (e) {
        console.error("Audio playback error:", e);
    }
}

/** Play a specific SFX for testing in settings (always uses 01_ prefix) */
export function testSFX(effectName: SoundEffect) {
    const fileName = `01_${effectName}.mp3`;
    const filePath = `/audio/${fileName}`;

    try {
        if (!audioCache[filePath]) {
            audioCache[filePath] = new Audio(filePath);
        }

        // Stop any currently playing sounds before testing
        stopAllSounds();

        const audio = audioCache[filePath];
        audio.volume = getEffectiveVolume(effectName);
        audio.currentTime = 0;
        audio.play().catch(e => {
            console.warn(`Could not play test sound ${fileName}:`, e.message);
        });
    } catch (e) {
        console.error("Audio test error:", e);
    }
}
