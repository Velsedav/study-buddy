const DEV_MODE_KEY = 'study-buddy-dev-mode';
const WORKOUT_MODE_KEY = 'study-buddy-workout-mode';
const DEV_NAV_KEY = 'study-buddy-dev-nav';

export function isDevNavUnlocked(): boolean {
    return localStorage.getItem(DEV_NAV_KEY) === 'true';
}

export function toggleDevNav(): boolean {
    if (isDevNavUnlocked()) {
        localStorage.removeItem(DEV_NAV_KEY);
        return false;
    }
    localStorage.setItem(DEV_NAV_KEY, 'true');
    return true;
}

export function isDevMode(): boolean {
    return localStorage.getItem(DEV_MODE_KEY) === 'true';
}

export function setDevMode(enabled: boolean): void {
    if (enabled) {
        localStorage.setItem(DEV_MODE_KEY, 'true');
    } else {
        localStorage.removeItem(DEV_MODE_KEY);
    }
}

export function isWorkoutMode(): boolean {
    return localStorage.getItem(WORKOUT_MODE_KEY) === 'true';
}

export function setWorkoutMode(enabled: boolean): void {
    if (enabled) {
        localStorage.setItem(WORKOUT_MODE_KEY, 'true');
    } else {
        localStorage.removeItem(WORKOUT_MODE_KEY);
    }
}
