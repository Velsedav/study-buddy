import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

export async function getAutostart(): Promise<boolean> {
    try {
        return await isEnabled();
    } catch {
        return false;
    }
}

export async function setAutostart(enabled: boolean): Promise<void> {
    if (enabled) {
        await enable();
    } else {
        await disable();
    }
}
