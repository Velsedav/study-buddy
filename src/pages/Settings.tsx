import { useSettings } from '../lib/settings';
import type { Theme, WeekStart } from '../lib/settings';
import { useState, useEffect } from 'react';
import { Palette, Calendar, Keyboard, Globe, Database, AlertTriangle, Trash2, Volume2, Play } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { deleteAllData } from '../lib/db';
import { CustomSelect } from '../components/CustomSelect';
import { SFX, SFX_LABELS, loadVolumeSettings, saveVolumeSettings, testSFX, stopAllSounds } from '../lib/sounds';
import type { SoundEffect, VolumeSettings } from '../lib/sounds';

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

    const THEMES = [
        { id: 'pastel', name: 'Pastel Baseline', color: '#f08cb8' },
        { id: 'neumorphism', name: 'Neumorphism', color: '#9baec8' },
        { id: 'neobrutalism', name: 'Neobrutalism', color: '#ffde59' },
        { id: 'terminal-orange', name: 'Orange Terminal', color: '#ff8c00' },
        { id: 'terminal-green', name: 'Green Terminal', color: '#00ff00' },
        { id: 'classic-uniform', name: 'Classic Uniform', color: '#1c3272' },
        { id: 'cosmic-manicure', name: 'Cosmic Manicure', color: '#9024f2' },
        { id: 'chibi-moon', name: 'Chibi Moon', color: '#ffb3e1' },
        { id: 'transformation-ribbon', name: 'Transformation Ribbon', color: '#9d5ceb', background: 'linear-gradient(120deg, #b08dd9 0%, #63ccd4 100%)' },
    ] as const;

    const activeTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const activeThemeColor = activeTheme.color;
    const activeThemeBackground = ('background' in activeTheme ? activeTheme.background : null) || activeThemeColor;
    const activeThemeName = activeTheme.name;

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
        <div className="settings-tab">
            <style>{`
                .btn-danger-outline {
                    border: 2px solid var(--danger);
                    background: white;
                    color: var(--danger);
                    transition: all 0.2s ease;
                }
                .btn-danger-outline:hover {
                    background: var(--danger);
                    color: white;
                }
                .danger-modal {
                    border: 2px solid var(--danger);
                }
            `}</style>

            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-content danger-modal">
                        <div className="settings-header" style={{ borderBottomColor: 'var(--danger)', color: 'var(--danger)' }}>
                            <AlertTriangle size={24} />
                            <h2>{t('settings.danger_zone')}</h2>
                        </div>
                        <p style={{ margin: '16px 0', lineHeight: 1.5 }}>
                            {t('settings.delete_confirm_msg')}
                            <br /><br />
                            <strong>{t('settings.delete_keyword')}</strong>
                        </p>
                        <input
                            type="text"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder={t('settings.delete_keyword')}
                            style={{ width: '100%', marginBottom: '16px', border: '2px solid var(--danger)' }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteInput('');
                            }}>Cancel</button>
                            <button
                                className="btn btn-danger-outline"
                                style={{ background: 'var(--danger)', color: 'white' }}
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

            <div className="settings-section">
                <div className="settings-header">
                    <Palette size={18} className="text-muted" />
                    <h3>{t('settings.appearance')}</h3>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px' }}>
                    <div className="card-select-theme" style={{ borderColor: activeThemeColor }}>
                        <div className="card-select-theme-title" style={{ background: activeThemeBackground }}>
                            <p>Select the <strong>{activeThemeName}</strong></p>
                        </div>
                        <div className="card-select-theme-colors">
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    className={`theme-color-select ${theme === t.id ? 'active' : ''}`}
                                    style={{ background: ('background' in t ? t.background : null) || t.color }}
                                    onClick={() => setTheme(t.id as Theme)}
                                    title={t.name}
                                    aria-label={t.name}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="settings-section" style={{ position: 'relative', zIndex: 10 }}>
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
            </div>

            <div className="settings-section" style={{ position: 'relative', zIndex: 9 }}>
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

            <div className="settings-section" style={{ position: 'relative', zIndex: 8 }}>
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
                <button className="btn btn-secondary w-full" style={{ marginTop: '8px' }}>Modify Shortcuts</button>
            </div>

            <div className="settings-section">
                <div className="settings-header">
                    <Volume2 size={18} className="text-muted" />
                    <h3>Audio</h3>
                </div>
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Master Volume</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', minWidth: '40px', textAlign: 'right' }}>{volumeSettings.master}%</span>
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

            <div className="settings-section">
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

            <div className="settings-section" style={{ border: '1px solid var(--danger)' }}>
                <div className="settings-header" style={{ borderBottomColor: 'var(--danger)' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
                    <h3 style={{ color: 'var(--danger)' }}>{t('settings.danger_zone')}</h3>
                </div>
                <p className="settings-desc" style={{ color: 'var(--text-dark)' }}>{t('settings.delete_all_data')}</p>
                <button
                    className="btn btn-danger-outline w-full"
                    onClick={() => setShowDeleteModal(true)}
                    style={{ marginTop: '8px' }}
                >
                    <Trash2 size={18} style={{ marginRight: '8px' }} />
                    {t('settings.delete_all_data')}
                </button>
            </div>
        </div>
    );
}
