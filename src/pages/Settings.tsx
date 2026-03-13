import { useSettings } from '../lib/settings';
import type { Theme, WeekStart } from '../lib/settings';
import { useState, useEffect } from 'react';
import { Palette, Calendar, Keyboard, Globe, Database, AlertTriangle, Trash2, Volume2, Play, Brain, Power, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { deleteAllData } from '../lib/db';
import { getDefaultSpacing, setDefaultSpacing, parseSpacing, DEFAULT_SPACING } from '../lib/chapters';
import { getAutostart, setAutostart } from '../lib/autostart';
import { CustomSelect } from '../components/CustomSelect';
import { SFX, SFX_LABELS, loadVolumeSettings, saveVolumeSettings, testSFX, stopAllSounds } from '../lib/sounds';
import type { SoundEffect, VolumeSettings } from '../lib/sounds';
import './Settings.css';

export default function SettingsTab() {
    const {
        theme, setTheme,
        weekStart, setWeekStart,
        language, setLanguage
    } = useSettings();
    const { t } = useTranslation();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [volumeSettings, setVolumeSettings] = useState<VolumeSettings>(loadVolumeSettings);
    const [defaultSpacing, setDefaultSpacingState] = useState(() => getDefaultSpacing());
    const [spacingError, setSpacingError] = useState('');
    const [autostartEnabled, setAutostartEnabled] = useState(false);

    useEffect(() => {
        getAutostart().then(setAutostartEnabled);
    }, []);

    const handleSpacingChange = (val: string) => {
        setDefaultSpacingState(val);
        const parsed = parseSpacing(val);
        if (parsed.length === 0) {
            setSpacingError('Enter at least one positive number');
        } else {
            setSpacingError('');
            setDefaultSpacing(val);
        }
    };

    useEffect(() => {
        saveVolumeSettings(volumeSettings);
    }, [volumeSettings]);

    // Stop all sounds when leaving Settings
    useEffect(() => {
        return () => stopAllSounds();
    }, []);

    const handleMasterVolume = (val: number) => {
        setVolumeSettings(prev => ({ ...prev, master: val }));
    };

    const handleIndividualVolume = (effect: SoundEffect, val: number) => {
        setVolumeSettings(prev => ({
            ...prev,
            individual: { ...prev.individual, [effect]: val }
        }));
    };

    interface ThemeOption {
        id: Theme;
        name: string;
        color: string;
        background?: string;
    }

    const THEME_GROUPS: { name: string; themes: ThemeOption[] }[] = [
        {
            name: 'Sailor Moon',
            themes: [
                { id: 'classic-uniform', name: 'Classic Uniform', color: '#1c3272' },
                { id: 'cosmic-manicure', name: 'Cosmic Manicure', color: '#9024f2' },
                { id: 'chibi-moon', name: 'Chibi Moon', color: '#ffb3e1' },
                { id: 'transformation-ribbon', name: 'Transformation Ribbon', color: '#9d5ceb', background: 'linear-gradient(120deg, #b08dd9 0%, #63ccd4 100%)' },
            ]
        },
        {
            name: 'Terminal',
            themes: [
                { id: 'terminal-orange', name: 'Orange Terminal', color: '#ff8c00' },
                { id: 'terminal-green', name: 'Green Terminal', color: '#00ff00' },
            ]
        },
        {
            name: 'Modern & Experimental',
            themes: [
                { id: 'pastel', name: 'Pastel Baseline', color: '#f08cb8' },
                { id: 'neumorphism', name: 'Neumorphism', color: '#9baec8' },
                { id: 'neobrutalism', name: 'Neobrutalism', color: '#ffde59' },
                { id: 'honey-lemon', name: 'Honey Lemon', color: '#ffeb3b' },
            ]
        }
    ] as const;

    const ALL_THEMES = THEME_GROUPS.flatMap(g => g.themes);
    const activeThemeObj = ALL_THEMES.find(t => t.id === theme) || ALL_THEMES[0];
    const activeThemeColor = activeThemeObj.color;
    const activeThemeBackground = ('background' in activeThemeObj ? activeThemeObj.background : null) || activeThemeColor;
    const activeThemeName = activeThemeObj.name;

    const handleExport = () => {
        // Simple placeholder for export
        alert("Data export functionality will be implemented with Tauri dialog APIs.");
    };

    const handleImport = () => {
        // Simple placeholder for import
        alert("Data import functionality will be implemented with Tauri dialog APIs.");
    };

    const handleDeleteAll = async () => {
        if (deleteInput.toLowerCase() === t('settings.delete_keyword').toLowerCase()) {
            await deleteAllData();
            alert("Database Cleared!");
            window.location.reload();
        } else {
            alert("Keyword didn't match.");
        }
    };

    return (
        <div className="settings-tab fade-in">
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-orange"><SettingsIcon size={20} /></div>
                    <h1>{t('nav.settings')}</h1>
                </div>
            </div>
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content danger-modal">
                        <div className="settings-header danger-modal-header">
                            <AlertTriangle size={24} />
                            <h2>{t('settings.danger_zone')}</h2>
                        </div>
                        <p className="danger-modal-text">
                            {t('settings.delete_confirm_msg')}
                            <br /><br />
                            <strong>{t('settings.delete_keyword')}</strong>
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder={t('settings.delete_keyword')}
                            className="danger-modal-input"
                        />
                        <div className="danger-modal-actions">
                            <button className="btn btn-secondary" onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteInput('');
                            }}>Cancel</button>
                            <button
                                className="btn btn-danger-outline btn-danger-outline-solid"
                                disabled={deleteInput.toLowerCase() !== t('settings.delete_keyword').toLowerCase()}
                                onClick={handleDeleteAll}
                            >
                                <Trash2 size={18} style={{ marginRight: '8px' }} />
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="settings-content">
            {/* ── Appearance ── */}
            <div className="settings-section settings-section-appearance settings-section-base">
                <div className="settings-header">
                    <Palette size={18} className="text-muted" />
                    <h3>{t('settings.appearance')}</h3>
                </div>
                <div className="form-group theme-selector-container">
                    <div className="card-select-theme" style={{ borderColor: activeThemeColor }}>
                        <div className="card-select-theme-title" style={{ background: activeThemeBackground }}>
                            <p>Select the <strong>{activeThemeName}</strong></p>
                        </div>
                        <div className="card-select-theme-colors grouped-themes">
                            {THEME_GROUPS.map((group) => (
                                <div key={group.name} className="theme-group">
                                    <h4 className="theme-group-title">{group.name}</h4>
                                    <div className="theme-group-grid">
                                        {group.themes.map((t) => (
                                            <button
                                                key={t.id}
                                                className={`theme-color-select ${theme === t.id ? 'active' : ''}`}
                                                style={{ background: t.background || t.color }}
                                                onClick={() => setTheme(t.id)}
                                                title={t.name}
                                                aria-label={t.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Preferences + Language side by side ── */}
            <div className="settings-row">
                <div className="settings-section settings-section-preferences settings-section-base">
                    <div className="settings-header">
                        <Calendar size={18} className="text-muted" />
                        <h3>{t('settings.preferences')}</h3>
                    </div>
                    <div className="form-group">
                        <label>{t('settings.first_day')}</label>
                        <CustomSelect
                            value={weekStart}
                            onChange={(val) => setWeekStart(val as WeekStart)}
                            options={[
                                { value: "monday", label: t('settings.monday') },
                                { value: "sunday", label: t('settings.sunday') }
                            ]}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <Power size={15} className="text-muted" />
                            Launch at login
                            <input
                                type="checkbox"
                                checked={autostartEnabled}
                                onChange={async (e) => {
                                    const val = e.target.checked;
                                    setAutostartEnabled(val);
                                    await setAutostart(val);
                                }}
                                style={{ marginLeft: 'auto', width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                        </label>
                    </div>
                </div>

                <div className="settings-section settings-section-language settings-section-base">
                    <div className="settings-header">
                        <Globe size={18} className="text-muted" />
                        <h3>{t('settings.language')}</h3>
                    </div>
                    <div className="form-group">
                        <CustomSelect
                            value={language}
                            onChange={(val) => setLanguage(val)}
                            options={[
                                { value: "en", label: "English" },
                                { value: "fr", label: "Français" },
                                { value: "es", label: "Español" },
                                { value: "id", label: "Bahasa Indonesia" },
                                { value: "zh-CN", label: "简体中文 (Simplified Chinese)" },
                                { value: "zh-TW", label: "繁體中文 (Traditional Chinese)" }
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* ── Spaced Repetition + Shortcuts side by side ── */}
            <div className="settings-row">
                <div className="settings-section settings-section-base">
                    <div className="settings-header">
                        <Brain size={18} className="text-muted" />
                        <h3>Spaced Repetition</h3>
                    </div>
                    <p className="settings-desc">
                        Default review schedule — space-separated days between sessions. The last value repeats forever.
                    </p>
                    <div className="form-group">
                        <label>Review intervals (days)</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={defaultSpacing}
                                onChange={e => handleSpacingChange(e.target.value)}
                                placeholder={DEFAULT_SPACING}
                                style={{ flex: 1 }}
                            />
                            <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                onClick={() => handleSpacingChange(DEFAULT_SPACING)}
                            >
                                Reset
                            </button>
                        </div>
                        {spacingError
                            ? <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>{spacingError}</p>
                            : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                e.g. <code>1 1 2 5 7</code> → next day, next day, 2 days, 5 days, then every 7 days forever
                            </p>
                        }
                    </div>
                </div>

                <div className="settings-section settings-section-shortcuts settings-section-base">
                    <div className="settings-header">
                        <Keyboard size={18} className="text-muted" />
                        <h3>Shortcuts</h3>
                    </div>
                    <p className="settings-desc">Manage your keyboard shortcuts.</p>
                    <div className="shortcut-list">
                        <div className="shortcut-item">
                            <span>New Subject</span>
                            <kbd>Ctrl+N</kbd>
                        </div>
                        <div className="shortcut-item">
                            <span>Search</span>
                            <kbd>Ctrl+F</kbd>
                        </div>
                        <div className="shortcut-item">
                            <span>Zoom In/Out</span>
                            <kbd>Ctrl+Scroll</kbd>
                        </div>
                    </div>
                    <button className="btn btn-secondary w-full shortcut-btn">Modify Shortcuts</button>
                </div>
            </div>

            {/* ── Audio ── */}
            <div className="settings-section settings-section-audio settings-section-base">
                <div className="settings-header">
                    <Volume2 size={18} className="text-muted" />
                    <h3>Audio</h3>
                </div>
                <div className="form-group">
                    <label className="audio-header-label">
                        <span>Master Volume</span>
                        <span className="audio-master-val">{volumeSettings.master}%</span>
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={volumeSettings.master}
                        onChange={e => handleMasterVolume(Number(e.target.value))}
                        className="volume-slider master-slider"
                    />
                </div>
                <div className="audio-individual-list">
                    {Object.values(SFX).map(effect => (
                        <div key={effect} className="audio-item">
                            <div className="audio-item-label">
                                <span>{SFX_LABELS[effect]}</span>
                                <span className="audio-item-volume">{volumeSettings.individual[effect] ?? 100}%</span>
                            </div>
                            <div className="audio-item-controls">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={volumeSettings.individual[effect] ?? 100}
                                    onChange={e => handleIndividualVolume(effect, Number(e.target.value))}
                                    className="volume-slider"
                                />
                                <button
                                    className="btn-icon audio-test-btn"
                                    onClick={() => testSFX(effect)}
                                    title={`Test ${SFX_LABELS[effect]}`}
                                >
                                    <Play size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Data Management + Danger Zone side by side ── */}
            <div className="settings-row">
                <div className="settings-section settings-section-data settings-section-base">
                    <div className="settings-header">
                        <Database size={18} className="text-muted" />
                        <h3>{t('settings.data_management')}</h3>
                    </div>
                    <p className="settings-desc">Backup or restore your Study Buddy database.</p>
                    <div className="data-actions">
                        <button className="btn btn-secondary w-full" onClick={handleExport}>{t('settings.export')}</button>
                        <button className="btn btn-secondary w-full" onClick={handleImport}>{t('settings.import')}</button>
                    </div>
                </div>

                <div className="settings-section settings-section-danger settings-section-base">
                    <div className="settings-header settings-danger-header">
                        <AlertTriangle size={18} className="settings-danger-icon" />
                        <h3 className="settings-danger-title">{t('settings.danger_zone')}</h3>
                    </div>
                    <p className="settings-desc settings-danger-desc">{t('settings.delete_all_data')}</p>
                    <button
                        className="btn btn-danger-outline w-full delete-all-btn"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        <Trash2 size={18} style={{ marginRight: '8px' }} />
                        {t('settings.delete_all_data')}
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
}
