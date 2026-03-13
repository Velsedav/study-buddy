import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { isDevMode, setDevMode, isWorkoutMode, setWorkoutMode } from '../lib/devMode';
import { MUSCLE_GROUPS, CATEGORY_LABELS, loadWorkoutLog, isMuscleEligible } from '../lib/workout';
import MetacognitionMode from '../components/MetacognitionMode';
import './Dev.css';

export default function DevPage() {
    const [noLimits, setNoLimits] = useState(isDevMode);
    const [workoutMode, setWorkoutModeState] = useState(isWorkoutMode);
    const [showMetacognition, setShowMetacognition] = useState(false);

    function handleNoLimitsToggle() {
        const next = !noLimits;
        setDevMode(next);
        setNoLimits(next);
    }

    function handleWorkoutToggle() {
        const next = !workoutMode;
        setWorkoutMode(next);
        setWorkoutModeState(next);
    }

    const workoutLog = loadWorkoutLog();
    const eligibleCount = MUSCLE_GROUPS.filter(m => isMuscleEligible(m.id, workoutLog)).length;

    if (showMetacognition) {
        return <MetacognitionMode onComplete={() => setShowMetacognition(false)} />;
    }

    return (
        <div className="dev-page">
            <div className="page-header">
                <div className="page-title-group">
                    <div className="icon-wrapper bg-purple"><FlaskConical size={20} /></div>
                    <h1>Dev</h1>
                </div>
            </div>

            <div className="dev-content">
            <div className="dev-section">
                <div className="dev-toggle-row">
                    <div className="dev-toggle-info">
                        <div className="dev-toggle-title">Supprimer les limites quotidiennes</div>
                        <div className="dev-toggle-desc">Débloque les liens "Learn more" et les sections verrouillées dans le centre d'apprentissage.</div>
                    </div>
                    <button
                        className={`dev-toggle-btn${noLimits ? ' active' : ''}`}
                        onClick={handleNoLimitsToggle}
                    >
                        {noLimits ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="dev-toggle-row">
                    <div className="dev-toggle-info">
                        <div className="dev-toggle-title">Mode Musculation 💪</div>
                        <div className="dev-toggle-desc">Affiche une section exercices pendant les pauses. Chaque muscle ou étirement s'affiche uniquement s'il n'a pas été pratiqué depuis 2 jours ou plus.</div>
                    </div>
                    <button
                        className={`dev-toggle-btn${workoutMode ? ' active' : ''}`}
                        onClick={handleWorkoutToggle}
                    >
                        {workoutMode ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            <div className="dev-section">
                <div className="dev-toggle-row">
                    <div className="dev-toggle-info">
                        <div className="dev-toggle-title">Pit Stop Métacognitif</div>
                        <div className="dev-toggle-desc">Lance le mode métacognition directement pour tester sans attendre la fin de semaine.</div>
                    </div>
                    <button className="dev-toggle-btn" onClick={() => setShowMetacognition(true)}>
                        Lancer
                    </button>
                </div>
            </div>

            {workoutMode && (
                <div className="dev-section">
                    <h3 className="dev-section-title">Muscles & étirements disponibles</h3>
                    <p className="dev-section-desc">{eligibleCount} / {MUSCLE_GROUPS.length} éléments affichés en ce moment</p>
                    {(['upper', 'lower', 'core', 'stretch'] as const).map(cat => (
                        <div key={cat}>
                            <div className="dev-category-label">{CATEGORY_LABELS[cat]}</div>
                            <div className="dev-muscle-grid">
                                {MUSCLE_GROUPS.filter(m => m.category === cat).map(m => {
                                    const eligible = isMuscleEligible(m.id, workoutLog);
                                    return (
                                        <div key={m.id} className={`dev-muscle-chip${eligible ? '' : ' resting'}`}>
                                            <span>{m.emoji} {m.label}</span>
                                            {!eligible && (
                                                <span className="dev-muscle-rest">Repos J+2</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}
