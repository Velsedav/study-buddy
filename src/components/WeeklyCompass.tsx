import { useState, useEffect } from 'react';
import { getMetacognitionLogs } from '../lib/db';
import { useTranslation } from '../lib/i18n';
import './WeeklyCompass.css';

interface CompassData {
    mechanical_fix: string;
    retention: string;
}

export default function WeeklyCompass() {
    const { t } = useTranslation();
    const [compass, setCompass] = useState<CompassData | null>(null);

    useEffect(() => {
        getMetacognitionLogs().then(logs => {
            const eightDaysAgo = new Date();
            eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
            const recentLog = logs.find(log => {
                const logDate = new Date(log.created_at);
                return logDate >= eightDaysAgo && (log.mechanical_fix || log.retention);
            });
            if (recentLog) {
                setCompass({ mechanical_fix: recentLog.mechanical_fix, retention: recentLog.retention });
            }
        });
    }, []);

    if (!compass) return null;

    return (
        <div className="weekly-compass glass">
            <div className="weekly-compass-header">
                <span>{t('weekly_compass.title')}</span>
            </div>
            {compass.mechanical_fix && (
                <div className="weekly-compass-item">
                    <strong>{t('weekly_compass.system_rule')}</strong> {compass.mechanical_fix}
                </div>
            )}
            {compass.retention && (
                <div className="weekly-compass-item">
                    <strong>{t('weekly_compass.focus_areas')}</strong> {compass.retention}
                </div>
            )}
        </div>
    );
}
