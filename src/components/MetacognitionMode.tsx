import { useState } from 'react';
import { Wrench, PowerOff, Target, Settings2, Copy, CheckCircle2 } from 'lucide-react';
import { saveMetacognitionLog } from '../lib/db';

export default function MetacognitionMode({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [copied, setCopied] = useState(false);

    // Telemetry Form Data
    const [retention, setRetention] = useState<string>('');
    const [focusDrop, setFocusDrop] = useState<string>('');
    const [memorizationAlign, setMemorizationAlign] = useState<string>('');

    // Tune Engine Data
    const [metacognitiveFix, setMetacognitiveFix] = useState<string>('');

    const generateExportText = () => {
        return `
# Metacognition Mode Reflection
Date: ${new Date().toLocaleDateString()}

## La combinaison secrète
- Attentes des partiels (Mémorisation/Compréhension/Coeffs) : ${memorizationAlign || 'N/A'}
- Sacrifices & Heures dans le vide : ${focusDrop || 'N/A'}

## Metacognitive Fix
${metacognitiveFix || 'None implemented.'}
        `.trim();
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generateExportText());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy', e);
        }
    };

    return (
        <div className="metacognition-mode-container glass">
            <div className="metacognition-header">
                <div className="metacognition-title">
                    <Wrench className="icon-gold" size={24} />
                    <h2>Metacognition Mode</h2>
                </div>
                <p>Time for a pit stop. Step outside the study material and analyze your workflow.</p>
            </div>

            <div className="metacognition-steps">
                <button className={`mc-step ${step >= 1 ? 'active' : ''}`} onClick={() => setStep(1)}>1. Halt</button>
                <div className="mc-step-line"></div>
                <button className={`mc-step ${step >= 2 ? 'active' : ''}`} onClick={() => setStep(2)}>2. Telemetry</button>
                <div className="mc-step-line"></div>
                <button className={`mc-step ${step >= 3 ? 'active' : ''}`} onClick={() => setStep(3)}>3. Tune</button>
            </div>

            <div className="metacognition-content">
                {step === 1 && (
                    <div className="mc-step-pane animation-fade-in">
                        <div className="mc-pane-header">
                            <PowerOff size={20} className="text-muted" />
                            <h3>Step 1: Halt Execution for no more than 15 minutes ("Ok Siri ! Minuteur 15 minutes !)</h3>
                        </div>
                        <p className="mc-desc text-muted">Completely detach from the material.</p>
                        <p>Close the book, the notebook, or the laptop.</p>
                        <p>You are no longer studying the subject; you are studying your approach to studying.</p>
                        <button className="btn btn-primary" onClick={() => setStep(2)}>Execution Halted. Continue</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="mc-step-pane animation-fade-in">
                        <div className="mc-pane-header">
                            <Target size={20} className="text-muted" />
                            <h3>Step 2: Gather Telemetry</h3>
                        </div>
                        <p className="mc-desc text-muted">Run a diagnostic this week of studying by answering these questions, take a step back andthink about your own thoughts:</p>

                        <div className="mc-form">
                            <div className="form-group">
                                <label style={{ fontWeight: 600, color: 'var(--text)' }}>Qu'est-ce qui est vraiment important et valorisé pour mes partiels ? Quelle matière a le plus gros coefficient ? Il faut favoriser la mémorisation ? La compréhension ? L'application pratique sur des cas concrets ? Qu'est-ce qui domine ?</label>
                                <textarea
                                    className="mc-input"
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                    value={memorizationAlign}
                                    onChange={e => setMemorizationAlign(e.target.value)}
                                    placeholder="e.g. L'application pratique domine fortement..."
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label style={{ fontWeight: 600, color: 'var(--text)' }}>Est-ce que je dois sacrifier des choses dans ma vie personnelle ? Qu'est-ce qui ne sert ni ma vie ni mes études (heures passées dans le vide) ?</label>
                                <textarea
                                    className="mc-input"
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                    value={focusDrop}
                                    onChange={e => setFocusDrop(e.target.value)}
                                    placeholder="e.g. Moins de réseaux sociaux avant de dormir..."
                                />
                            </div>
                        </div>
                        <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => setStep(3)}>Next Step</button>
                    </div>
                )}

                {step === 3 && (
                    <div className="m-step-pane animation-fade-in">
                        <div className="m-pane-header">
                            <Settings2 size={20} className="text-muted" />
                            <h3>Step 3: Tune The Engine</h3>
                        </div>
                        <p className="m-desc text-muted">Implement a hard metacognitive fix for the next session. Do not rely on willpower. Rely on systems.</p>

                        <div className="form-group m-form mt-2">
                            <label>My System Rule for the Next Session:</label>
                            <textarea
                                className="m-input"
                                rows={3}
                                value={metacognitiveFix}
                                onChange={e => setMetacognitiveFix(e.target.value)}
                                placeholder='e.g. "I will leave my phone in another room..."'
                            />
                        </div>

                        <div className="m-actions mt-4">
                            <button className={`btn ${copied ? 'btn-success' : 'btn-secondary'}`} onClick={handleCopy}>
                                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                                {copied ? 'Copied to Clipboard!' : 'Export to LLM'}
                            </button>
                            <button className="btn btn-primary ml-auto" onClick={async () => {
                                await saveMetacognitionLog({
                                    retention: retention,
                                    focus_drop: focusDrop,
                                    memorization_align: memorizationAlign,
                                    mechanical_fix: metacognitiveFix,
                                });
                                setStep(1);
                                setRetention('');
                                setFocusDrop('');
                                setMemorizationAlign('');
                                setMetacognitiveFix('');
                                onComplete();
                            }}>Complete Pit Stop</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
