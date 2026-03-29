import { useSettings } from '../lib/settings';
import type { Theme, WeekStart, MetacognitionDay } from '../lib/settings';
import { useState, useEffect } from 'react';
import { Palette, Calendar, Keyboard, Globe, Database, AlertTriangle, Trash2, Volume2, Play, Brain, Power, Settings as SettingsIcon, FolderOpen, X } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { deleteAllData } from '../lib/db';
import { getDefaultSpacing, setDefaultSpacing, parseSpacing, DEFAULT_SPACING } from '../lib/chapters';
import { getAutostart, setAutostart } from '../lib/autostart';
import { CustomSelect } from '../components/CustomSelect';
import { SFX, SFX_LABELS, loadVolumeSettings, saveVolumeSettings, testSFX, playSFX } from '../lib/sounds';
import type { SoundEffect, VolumeSettings } from '../lib/sounds';
import {
    getExportConfig, saveExportConfig,
    getLastExportTime,
    exportToConfiguredPaths, exportToFilePath,
    pickExportFolder, pickSaveFilePath, pickImportFilePath,
    importBackup,
} from '../lib/export';
import './Settings.css';

export default function SettingsTab() {
    const {
        theme, setTheme,
        weekStart, setWeekStart,
        language, setLanguage,
        metacognitionDay, setMetacognitionDay
    } = useSettings();
    const { t } = useTranslation();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [volumeSettings, setVolumeSettings] = useState<VolumeSettings>(loadVolumeSettings);
    const [defaultSpacing, setDefaultSpacingState] = useState(() => getDefaultSpacing());
    const [spacingError, setSpacingError] = useState('');
    const [autostartEnabled, setAutostartEnabled] = useState(false);

    const [exportPath1, setExportPath1] = useState(() => getExportConfig().path1);
    const [exportPath2, setExportPath2] = useState(() => getExportConfig().path2);
    const [lastExportTime, setLastExportTimeState] = useState(() => getLastExportTime());
    const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        getAutostart().then(setAutostartEnabled);
    }, []);

    function flashStatus(type: 'success' | 'error', message: string) {
        setExportStatus({ type, message });
        setTimeout(() => setExportStatus(null), 4000);
    }

    function persistPaths(p1: string, p2: string) {
        saveExportConfig({ path1: p1, path2: p2 });
    }

    async function handlePickPath(slot: 1 | 2) {
        const folder = await pickExportFolder();
        if (!folder) return;
        if (slot === 1) {
            setExportPath1(folder);
            persistPaths(folder, exportPath2);
        } else {
            setExportPath2(folder);
            persistPaths(exportPath1, folder);
        }
    }

    function handleClearPath(slot: 1 | 2) {
        if (slot === 1) {
            setExportPath1('');
            persistPaths('', exportPath2);
        } else {
            setExportPath2('');
            persistPaths(exportPath1, '');
        }
    }

    const handleSpacingChange = (val: string) => {
        setDefaultSpacingState(val);
        const parsed = parseSpacing(val);
        if (parsed.length === 0) {
            setSpacingError(t('settings.sr_error'));
        } else {
            setSpacingError('');
            setDefaultSpacing(val);
        }
    };

    useEffect(() => {
        saveVolumeSettings(volumeSettings);
    }, [volumeSettings]);

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
                { id: 'terminal-red', name: 'Red Terminal', color: '#ff0000' },
                { id: 'terminal-cyan', name: 'CLI / Cyan', color: '#00d4ff' },
                { id: 'terminal-amber', name: 'Amber Terminal', color: '#ffaa00' },
                { id: 'terminal-purple', name: 'Purple Terminal', color: '#cc33ff' },
                { id: 'terminal-blue', name: 'Blue Terminal', color: '#4499ff' },
            ]
        },
        {
            name: 'Art',
            themes: [
                { id: 'starry-night', name: 'Starry Night', color: '#e8c84a', background: 'linear-gradient(135deg, #0d1b3e 0%, #1e4888 55%, #e8c84a 100%)' },
                { id: 'designers-republic', name: 'TDR — Signal', color: '#e8001d', background: 'linear-gradient(135deg, #f0ede6 0%, #ffffff 45%, #e8001d 100%)' },
                { id: 'tdr-blue', name: 'TDR — Blueprint', color: '#0055cc', background: 'linear-gradient(135deg, #f0ede6 0%, #ffffff 45%, #0055cc 100%)' },
                { id: 'tdr-ember', name: 'TDR — Ember', color: '#e86000', background: 'linear-gradient(135deg, #f0ede6 0%, #ffffff 45%, #e86000 100%)' },
                { id: 'tdr-night', name: 'TDR — Night', color: '#ff1a2d', background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 45%, #ff1a2d 100%)' },
                { id: 'tdr-warp', name: 'TDR — Warp', color: '#f5d000', background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 45%, #f5d000 100%)' },
                { id: 'tdr-acid', name: 'TDR — Acid', color: '#aaff00', background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 45%, #aaff00 100%)' },
            ]
        },
        {
            name: 'Modern & Experimental',
            themes: [
                { id: 'pastel', name: 'Pastel Baseline', color: '#f08cb8' },
                { id: 'neumorphism', name: 'Neumorphism', color: '#9baec8' },
                { id: 'neobrutalism', name: 'Neobrutalism', color: '#ffde59' },
                { id: 'honey-lemon', name: 'Honey Lemon', color: '#ffeb3b' },
                { id: 'ai-pro', name: 'AI Pro', color: '#7c3aed', background: 'linear-gradient(135deg, #070b14 0%, #1a0a3d 50%, #06b6d4 100%)' },
                { id: 'cyber-scan', name: 'Cyber Scan', color: '#b8ff00', background: 'linear-gradient(135deg, #050510 0%, #0a0830 50%, #b8ff00 100%)' },
            ]
        }
    ] as const;

    const [previewThemeId, setPreviewThemeId] = useState<Theme | null>(null);

    const ALL_THEMES = THEME_GROUPS.flatMap(g => g.themes);
    const displayThemeId = previewThemeId ?? theme;
    const activeThemeObj = ALL_THEMES.find(t => t.id === displayThemeId) || ALL_THEMES[0];
    const activeThemeColor = activeThemeObj.color;
    const activeThemeBackground = ('background' in activeThemeObj ? activeThemeObj.background : null) || activeThemeColor;
    const activeThemeName = activeThemeObj.name;

    const handleThemeHover = (id: Theme) => {
        setPreviewThemeId(id);
        document.documentElement.setAttribute('data-theme', id);
    };

    const handleThemeLeave = () => {
        setPreviewThemeId(null);
        document.documentElement.setAttribute('data-theme', theme);
    };

    const handleExport = async () => {
        playSFX(SFX.HOVER, theme);
        const hasPaths = exportPath1.trim() || exportPath2.trim();
        if (hasPaths) {
            try {
                const { saved, errors } = await exportToConfiguredPaths();
                if (errors.length > 0 && saved.length === 0) {
                    flashStatus('error', t('settings.export_error'));
                } else {
                    setLastExportTimeState(new Date().toISOString());
                    flashStatus('success', t('settings.export_success'));
                }
            } catch {
                flashStatus('error', t('settings.export_error'));
            }
        } else {
            // No paths configured — open a save dialog
            const filePath = await pickSaveFilePath();
            if (!filePath) return;
            try {
                await exportToFilePath(filePath);
                setLastExportTimeState(new Date().toISOString());
                flashStatus('success', t('settings.export_success'));
            } catch {
                flashStatus('error', t('settings.export_error'));
            }
        }
    };

    const handleImport = async () => {
        playSFX(SFX.HOVER, theme);
        const filePath = await pickImportFilePath();
        if (!filePath) return;
        try {
            await importBackup(filePath);
            flashStatus('success', t('settings.import_success'));
            setTimeout(() => window.location.reload(), 1500);
        } catch {
            flashStatus('error', t('settings.import_error'));
        }
    };

    const handleDeleteAll = async () => {
        if (deleteInput.toLowerCase() === t('settings.delete_keyword').toLowerCase()) {
            playSFX('glass_ui_cancel', theme);
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
                            <button className="btn btn-secondary" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteInput('');
                            }}>{t('settings.cancel')}</button>
                            <button
                                className="btn btn-danger-outline btn-danger-outline-solid"
                                disabled={deleteInput.toLowerCase() !== t('settings.delete_keyword').toLowerCase()}
                                onMouseEnter={() => playSFX(SFX.HOVER)}
                                onClick={handleDeleteAll}
                            >
                                <Trash2 size={18} style={{ marginRight: '8px' }} />
                                {t('settings.confirm_delete')}
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
                            <p>
                                {previewThemeId ? t('settings.preview_theme') : t('settings.select_theme')}
                                {' '}<strong>{activeThemeName}</strong>
                                {previewThemeId && <span className="theme-preview-hint"> — {t('settings.click_to_apply')}</span>}
                            </p>
                        </div>
                        <div className="card-select-theme-colors grouped-themes" onMouseLeave={handleThemeLeave}>
                            {THEME_GROUPS.map((group) => (
                                <div key={group.name} className="theme-group">
                                    <h4 className="theme-group-title">{group.name}</h4>
                                    <div className="theme-group-grid">
                                        {group.themes.map((th) => (
                                            <button
                                                key={th.id}
                                                className={`theme-color-select ${theme === th.id ? 'active' : ''}`}
                                                style={{ background: th.background || th.color }}
                                                onMouseEnter={() => { handleThemeHover(th.id); playSFX(SFX.HOVER); }}
                                                onClick={() => setTheme(th.id)}
                                                title={th.name}
                                                aria-label={th.name}
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
                    <div className="form-group">
                        <label>{t('settings.metacognition_day')}</label>
                        <CustomSelect
                            value={metacognitionDay}
                            onChange={(val) => setMetacognitionDay(val as MetacognitionDay)}
                            options={[
                                { value: "friday", label: t('settings.metacognition_day_friday') },
                                { value: "saturday", label: t('settings.metacognition_day_saturday') },
                                { value: "sunday", label: t('settings.metacognition_day_sunday') },
                            ]}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <Power size={15} className="text-muted" />
                            {t('settings.launch_at_login')}
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
                        <h3>{t('settings.spaced_repetition')}</h3>
                    </div>
                    <p className="settings-desc">
                        {t('settings.sr_desc')}
                    </p>
                    <div className="form-group">
                        <label>{t('settings.review_intervals')}</label>
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
                                onMouseEnter={() => playSFX(SFX.HOVER)}
                                onClick={() => handleSpacingChange(DEFAULT_SPACING)}
                            >
                                {t('settings.reset')}
                            </button>
                        </div>
                        {spacingError
                            ? <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>{spacingError}</p>
                            : <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                {t('settings.sr_example')}
                            </p>
                        }
                    </div>
                </div>

                <div className="settings-section settings-section-shortcuts settings-section-base">
                    <div className="settings-header">
                        <Keyboard size={18} className="text-muted" />
                        <h3>{t('settings.shortcuts')}</h3>
                    </div>
                    <p className="settings-desc">{t('settings.shortcuts_desc')}</p>
                    <div className="shortcut-list">
                        <div className="shortcut-item">
                            <span>{t('settings.shortcut_new_subject')}</span>
                            <kbd>Ctrl+N</kbd>
                        </div>
                        <div className="shortcut-item">
                            <span>{t('settings.shortcut_search')}</span>
                            <kbd>Ctrl+F</kbd>
                        </div>
                        <div className="shortcut-item">
                            <span>{t('settings.shortcut_zoom')}</span>
                            <kbd>Ctrl+Scroll</kbd>
                        </div>
                    </div>
                    <button className="btn btn-secondary w-full shortcut-btn" onMouseEnter={() => playSFX(SFX.HOVER)}>{t('settings.modify_shortcuts')}</button>
                </div>
            </div>

            {/* ── Audio ── */}
            <div className="settings-section settings-section-audio settings-section-base">
                <div className="settings-header">
                    <Volume2 size={18} className="text-muted" />
                    <h3>{t('settings.audio')}</h3>
                </div>
                <div className="form-group">
                    <label className="audio-header-label">
                        <span>{t('settings.master_volume')}</span>
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
                                    onMouseEnter={() => playSFX(SFX.HOVER)}
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
                    <p className="settings-desc">{t('settings.backup_desc')}</p>

                    <div className="export-locations">
                        <span className="export-locations-label">{t('settings.save_locations')}</span>
                        <div className="export-path-row">
                            <span className="export-path-tag">{t('settings.export_primary')}</span>
                            <span className="export-path-value" title={exportPath1 || undefined}>
                                {exportPath1 || t('settings.export_not_set')}
                            </span>
                            <button
                                className="btn btn-secondary export-path-btn"
                                onMouseEnter={() => playSFX(SFX.HOVER)}
                                onClick={() => handlePickPath(1)}
                            >
                                <FolderOpen size={14} />
                                {t('settings.export_browse')}
                            </button>
                            {exportPath1 && (
                                <button
                                    className="btn-icon export-clear-btn"
                                    onClick={() => handleClearPath(1)}
                                    aria-label="Clear primary location"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="export-path-row">
                            <span className="export-path-tag">{t('settings.export_secondary')}</span>
                            <span className="export-path-value" title={exportPath2 || undefined}>
                                {exportPath2 || t('settings.export_not_set')}
                            </span>
                            <button
                                className="btn btn-secondary export-path-btn"
                                onMouseEnter={() => playSFX(SFX.HOVER)}
                                onClick={() => handlePickPath(2)}
                            >
                                <FolderOpen size={14} />
                                {t('settings.export_browse')}
                            </button>
                            {exportPath2 && (
                                <button
                                    className="btn-icon export-clear-btn"
                                    onClick={() => handleClearPath(2)}
                                    aria-label="Clear secondary location"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <p className="export-auto-note">{t('settings.export_auto_note')}</p>
                    </div>

                    {exportStatus && (
                        <p className={`export-status export-status-${exportStatus.type}`}>
                            {exportStatus.message}
                        </p>
                    )}
                    {lastExportTime && !exportStatus && (
                        <p className="export-last-time">
                            {t('settings.export_last')} {new Date(lastExportTime).toLocaleString()}
                        </p>
                    )}

                    <div className="data-actions">
                        <button className="btn btn-secondary w-full" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={handleExport}>{t('settings.export_now')}</button>
                        <button className="btn btn-secondary w-full" onMouseEnter={() => playSFX(SFX.HOVER)} onClick={handleImport}>{t('settings.import_merge')}</button>
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
                        onMouseEnter={() => playSFX(SFX.HOVER)}
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
