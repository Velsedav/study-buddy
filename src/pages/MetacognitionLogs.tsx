import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { getMetacognitionLogs, type MetacognitionLog } from '../lib/db';
import { useTranslation } from '../lib/i18n';

export default function MetacognitionLogs() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<MetacognitionLog[]>([]);

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

    return (
        <div className="metacognition-logs-page" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-wrapper bg-orange"><Wrench size={24} /></div>
                    {t('nav.metacognition_logs')}
                </h1>
            </div>

            {logs.length === 0 ? (
                <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                    <Wrench size={48} className="text-muted" style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
                    <p className="text-muted">No metacognition logs found yet.</p>
                    <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                        Logs are generated when you complete a Metacognition Mode pit stop.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {logs.map(log => (
                        <div key={log.id} className="glass" style={{ padding: '24px', position: 'relative' }}>
                            <div className="text-muted" style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '0.9rem' }}>
                                {new Date(log.created_at).toLocaleDateString()}
                            </div>
                            <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wrench size={18} className="icon-gold" />
                                Pit Stop Reflection
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <h4 className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Retention</h4>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                        {log.retention || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Focus Drop</h4>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                        {log.focus_drop || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Memorization Alignment</h4>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                        {log.memorization_align || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="icon-gold" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '8px' }}>Metacognitive Fix</h4>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                                        {log.mechanical_fix || 'None implemented.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
