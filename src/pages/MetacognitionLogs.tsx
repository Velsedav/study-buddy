import { useState, useEffect } from 'react';
import { Wrench, ChevronLeft, ChevronRight, ClipboardCopy, Check } from 'lucide-react';
import { getMetacognitionLogs, type MetacognitionLog } from '../lib/db';
import { useTranslation } from '../lib/i18n';
import './MetacognitionLogs.css';

function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string): string {
    const [year, month] = key.split('-');
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatForNotebookLM(logs: MetacognitionLog[], monthLabel: string): string {
    const entries = logs.map((log, i) => {
        const date = new Date(log.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
        return [
            `--- Entry ${i + 1} · ${date} ---`,
            `Priorités & Coefficients: ${log.memorization_align || 'N/A'}`,
            `Problèmes & Malaises: ${log.focus_drop || 'N/A'}`,
            `Règle Système: ${log.mechanical_fix || 'Aucune règle définie.'}`,
            `Zones à Réviser (La Boussole): ${log.retention || 'N/A'}`,
        ].join('\n');
    }).join('\n\n');

    return `# Logs Mode Optimisation — ${monthLabel}\n\nVoici mes logs de réflexion sur ma stratégie d'étude pour ce mois. Merci d'analyser ces entrées et de me donner un retour sur :\n- Les patterns récurrents dans mes problèmes et priorités\n- Si mes règles système s'attaquent aux vraies causes\n- Les ajustements concrets à apporter à ma stratégie le mois prochain\n\n${entries}`;
}

export default function MetacognitionLogs() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<MetacognitionLog[]>([]);
    const [monthIndex, setMonthIndex] = useState(0); // 0 = most recent month
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const data = await getMetacognitionLogs();
            setLogs(data);
        } catch (e) {
            console.error('Failed to load metacognition logs:', e);
        }
    };

    // Unique month keys sorted newest first
    const monthKeys = [...new Set(logs.map(l => getMonthKey(l.created_at)))]
        .sort()
        .reverse();

    const currentMonthKey = monthKeys[monthIndex];
    const monthLogs = currentMonthKey
        ? logs.filter(l => getMonthKey(l.created_at) === currentMonthKey).slice(0, 4)
        : [];

    return (
        <div className="metacognition-logs-page fade-in">
            <div className="page-header metacognition-logs-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-orange"><Wrench size={20} /></div>
                    <h1>{t('nav.metacognition_logs')}</h1>
                </div>
            </div>

            <div className="metacognition-logs-content">
            {logs.length === 0 ? (
                <div className="glass metacognition-logs-empty">
                    <Wrench size={48} className="text-muted empty-wrench-icon" />
                    <p className="text-muted">No metacognition logs found yet.</p>
                    <p className="text-muted empty-subtext">
                        Logs are generated when you complete a Metacognition Mode pit stop.
                    </p>
                </div>
            ) : (
                <>
                    {/* Month navigation */}
                    <div className="month-nav-container">
                        <button
                            className={`btn-icon month-nav-btn ${monthIndex >= monthKeys.length - 1 ? 'disabled' : ''}`}
                            onClick={() => setMonthIndex(i => i + 1)}
                            disabled={monthIndex >= monthKeys.length - 1}
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <h2 className="month-nav-title">
                            {currentMonthKey ? formatMonthLabel(currentMonthKey) : ''}
                        </h2>
                        <button
                            className={`btn-icon month-nav-btn ${monthIndex <= 0 ? 'disabled' : ''}`}
                            onClick={() => setMonthIndex(i => i - 1)}
                            disabled={monthIndex <= 0}
                        >
                            <ChevronRight size={22} />
                        </button>
                    </div>

                    {/* Copy for NotebookLM */}
                    {monthLogs.length > 0 && (
                        <div className="copy-btn-container">
                            <button
                                className={`btn btn-secondary copy-lm-btn ${copied ? 'copy-lm-btn-success' : ''}`}
                                onClick={() => {
                                    const text = formatForNotebookLM(monthLogs, currentMonthKey ? formatMonthLabel(currentMonthKey) : '');
                                    navigator.clipboard.writeText(text);
                                    setCopied(true);
                                }}
                            >
                                {copied ? <Check size={15} /> : <ClipboardCopy size={15} />}
                                {copied ? 'Copied!' : 'Copy for NotebookLM'}
                            </button>
                            {copied && (
                                <span className="open-lm-btn-wrapper">
                                    <a
                                        href="https://notebooklm.google.com/notebook/33dc2ca6-a3da-4218-b679-bd91ce99d7e7"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary open-lm-btn"
                                    >
                                        Open in NotebookLM →
                                    </a>
                                </span>
                            )}
                        </div>
                    )}

                    {/* 2×2 grid — always 4 slots */}
                    <div className="metacog-month-grid">
                        {Array.from({ length: 4 }).map((_, slotIdx) => {
                            const log = monthLogs[slotIdx];
                            if (!log) {
                                return (
                                    <div
                                        key={`empty-${slotIdx}`}
                                        className="glass metacog-log-card metacog-log-empty"
                                        style={{ '--animation-order': slotIdx } as any}
                                    >
                                        <Wrench size={28} className="empty-log-card-icon" />
                                        <p className="empty-log-card-text">No entry</p>
                                    </div>
                                );
                            }
                            return (
                                <div
                                    key={log.id}
                                    className="glass metacog-log-card"
                                    style={{ '--animation-order': slotIdx } as any}
                                >
                                    <div className="log-card-header">
                                        <h3 className="log-card-title">
                                            <Wrench size={15} className="icon-gold" />
                                            Pit Stop
                                        </h3>
                                        <span className="text-muted log-card-date">
                                            {new Date(log.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>

                                    <div className="log-content-container">
                                        <div>
                                            <h4 className="text-muted log-section-title">🎯 Priorités</h4>
                                            <div className="log-section-box">
                                                {log.memorization_align || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-muted log-section-title">🔧 Problèmes</h4>
                                            <div className="log-section-box">
                                                {log.focus_drop || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="icon-gold log-section-title">⚙️ Règle Système</h4>
                                            <div className="log-section-box gold">
                                                {log.mechanical_fix || 'Aucune règle définie.'}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-muted log-section-title">🧭 La Boussole</h4>
                                            <div className="log-section-box">
                                                {log.retention || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Dot indicator */}
                    {monthKeys.length > 1 && (
                        <div className="dot-indicators">
                            {monthKeys.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setMonthIndex(i)}
                                    className={`dot-btn ${i === monthIndex ? 'active' : 'inactive'}`}
                                    aria-label={monthKeys[i] ? formatMonthLabel(monthKeys[i]) : ''}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            </div>
        </div>
    );
}
