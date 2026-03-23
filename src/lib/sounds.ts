// ── Sound Effect Registry ──
// Naming convention: {theme}_{category}_{action}
// Themes: glass_ | term_
// Categories: ui_ | session_ | timer_ | reward_ | bingo_

export const SFX = {
    // UI — ambient/functional
    HOVER:          'glass_ui_hover',
    CHECK:          'glass_ui_check',
    CANCEL:         'glass_ui_cancel',
    DROP:           'glass_ui_drop',
    DRAG_UP:        'glass_ui_drag_up',
    DRAG_DOWN:      'glass_ui_drag_down',
    ENTER_MENU:     'glass_enter_menu',
    // Session
    SESSION_START:  'glass_session_start',
    SESSION_SWITCH: 'glass_session_switch',
    SESSION_END:    'glass_session_end',
    SESSION_FINISH: 'glass_session_finish',
    ENTER_LESSON:   'glass_session_enter_lesson',
    // Timer — play over ongoing sounds
    WARN_10:        'glass_timer_warn10',
    INTERVAL_WORK:  'glass_timer_interval_work',
    INTERVAL_REST:  'glass_timer_interval_rest',
    // Reward
    REWARD_CORRECT: 'glass_reward_correct',
    REWARD_PERFECT: 'glass_reward_perfect',
    // Bingoals
    BINGO_CHECK:    'glass_bingo_check',
    BINGO_LINE:     'glass_bingo_line',
    BINGO_COMPLETE: 'glass_bingo_complete',
    BINGO_ADD:      'glass_bingo_add',
} as const;

export type SoundEffect = typeof SFX[keyof typeof SFX];

/** Human-friendly display names for each sound effect */
export const SFX_LABELS: Record<SoundEffect, string> = {
    glass_ui_hover:               'Hover',
    glass_ui_check:               'Checklist',
    glass_ui_cancel:              'Cancel / Error',
    glass_ui_drop:                'Drop Block',
    glass_ui_drag_up:             'Drag Up',
    glass_ui_drag_down:           'Drag Down',
    glass_enter_menu:             'Enter Menu',
    glass_session_start:          'Start Session',
    glass_session_switch:         'Switch Task',
    glass_session_end:            'Session End',
    glass_session_finish:         'Session Finish',
    glass_session_enter_lesson:   'Enter Lesson',
    glass_timer_warn10:           '10s Warning',
    glass_timer_interval_work:    'Interval — Work',
    glass_timer_interval_rest:    'Interval — Rest',
    glass_reward_correct:         'Correct Answer',
    glass_reward_perfect:         'Perfect Score',
    glass_bingo_check:            'Bingo Check',
    glass_bingo_line:             'Bingo Line',
    glass_bingo_complete:         'Bingo Complete',
    glass_bingo_add:              'Bingo Add Goal',
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

// ── Theme Resolution ──

/** Module-level active theme — updated by SettingsProvider on every theme change */
let currentTheme: string = 'glassmorphism';
export function setAudioTheme(theme: string) { currentTheme = theme; }

/** Terminal-theme variants that have been recorded and are available on disk */
const TERM_SOUNDS = new Set([
    // UI
    'term_ui_hover',
    'term_ui_check',
    'term_ui_cancel',
    'term_ui_drop',
    'term_ui_drag_up',
    'term_ui_drag_down',
    // Navigation
    'term_enter_menu',
    // Session
    'term_session_start',
    'term_session_switch',
    'term_session_end',
    'term_session_enter_lesson',
    // Timer
    'term_timer_warn10',
    'term_timer_interval_work',
    'term_timer_interval_rest',
    // Bingo
    'term_bingo_check',
]);

/** Resolve the actual file name to play, swapping glass_ → term_ when available */
function resolveFileName(effectName: SoundEffect, theme: string): string {
    if (!theme.startsWith('terminal-')) return effectName;
    const termVariant = effectName.replace(/^glass_/, 'term_');
    return TERM_SOUNDS.has(termVariant) ? termVariant : effectName;
}

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

/** Timer-category sounds play over ongoing audio — they are never blocked by stopAllSounds */
function isTimerSound(effectName: string): boolean {
    return effectName.includes('timer_');
}

export function playSFX(effectName: SoundEffect, theme: string = currentTheme) {
    const resolved = resolveFileName(effectName, theme);
    const fileName = `${resolved}.mp3`;
    const filePath = `/audio/${fileName}`;

    try {
        if (!audioCache[filePath]) {
            audioCache[filePath] = new Audio(filePath);
        }

        // Timer and hover sounds play over ongoing audio; all others stop the current sound first
        if (!isTimerSound(effectName) && effectName !== 'glass_ui_hover') {
            stopAllSounds();
        }

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

/** Play a specific SFX for testing in settings — respects current theme */
export function testSFX(effectName: SoundEffect) {
    playSFX(effectName);
}
