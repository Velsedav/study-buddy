import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Calendar, Sparkles, Pencil, Lightbulb, BarChart2, Settings as SettingsIcon, Wrench } from 'lucide-react';
import { getQuotes, addQuote } from '../lib/db';
import type { Quote } from '../lib/db';
import QuoteEditorModal from './QuoteEditorModal';
import { useTranslation } from '../lib/i18n';
import { playSFX } from '../lib/sounds';
import { useSettings } from '../lib/settings';

const MASCOT_DEFAULT_QUOTE = "The exam is won at home, not on exam day 🏠";

export default function Layout() {
    const location = useLocation();
    const { t } = useTranslation();
    const { theme } = useSettings();
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [animClass, setAnimClass] = useState('quote-visible');
    const [editorOpen, setEditorOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const navItems = [
        { path: '/', label: t('nav.subjects'), icon: BookOpen },
        { path: '/plan', label: t('nav.planner'), icon: Calendar },
        { path: '/learning', label: t('nav.learning'), icon: Lightbulb },
        { path: '/analytics', label: t('nav.analytics'), icon: BarChart2 },
        { path: '/metacognition-logs', label: t('nav.metacognition_logs'), icon: Wrench },
        { path: '/settings', label: t('nav.settings'), icon: SettingsIcon },
    ];

    const loadQuotes = useCallback(async () => {
        try {
            const q = await getQuotes();
            // Seed the default mascot quote if not present
            const hasMascotQuote = q.some(quote => quote.text.includes("The exam is won at home"));
            if (!hasMascotQuote) {
                await addQuote(MASCOT_DEFAULT_QUOTE);
                const updated = await getQuotes();
                setQuotes(updated);
            } else {
                setQuotes(q);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => { loadQuotes(); }, [loadQuotes]);

    // Rotate quotes every 4.5s with anime-style bounce animation
    useEffect(() => {
        if (quotes.length <= 1) return;

        function cycle() {
            // Start exit animation
            setAnimClass('quote-exit');

            // After exit animation (300ms), switch quote and enter
            timeoutRef.current = setTimeout(() => {
                setCurrentIdx(prev => (prev + 1) % quotes.length);
                setAnimClass('quote-enter');

                // After enter animation completes, set to visible (idle)
                timeoutRef.current = setTimeout(() => {
                    setAnimClass('quote-visible');
                }, 500);
            }, 300);
        }

        const interval = setInterval(cycle, 4500);
        return () => {
            clearInterval(interval);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [quotes.length]);

    // Global Zoom via Ctrl+Wheel
    useEffect(() => {
        let currentZoom = parseFloat(localStorage.getItem('study-buddy-zoom') || '1.0');

        // Ensure starting zoom applies
        document.documentElement.style.fontSize = `${16 * currentZoom}px`;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                currentZoom = Math.min(Math.max(currentZoom + delta, 0.5), 2.0);

                document.documentElement.style.fontSize = `${16 * currentZoom}px`;
                localStorage.setItem('study-buddy-zoom', currentZoom.toString());
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const currentQuote = quotes.length > 0
        ? quotes[currentIdx % quotes.length]?.text
        : 'Let\'s do our best today! ✨';

    const isTerminal = theme === 'terminal-orange' || theme === 'terminal-green';

    // Terminal typing effect
    const [typedText, setTypedText] = useState('');
    const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!isTerminal) return;
        if (typingRef.current) clearTimeout(typingRef.current);
        setTypedText('');

        let i = 0;
        const full = currentQuote;
        function typeNext() {
            i++;
            setTypedText(full.slice(0, i));
            if (i < full.length) {
                typingRef.current = setTimeout(typeNext, 12);
            }
        }
        typingRef.current = setTimeout(typeNext, 80);
        return () => { if (typingRef.current) clearTimeout(typingRef.current); };
    }, [currentQuote, isTerminal]);

    return (
        <div className="layout">
            {/* Sidebar Navigation */}
            <nav className="glass sidebar">
                <div className="logo">
                    <Sparkles className="icon-gold" size={32} />
                    <h2>Study Buddy</h2>
                </div>

                <ul className="nav-links">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`nav-link ${active ? 'active' : ''}`}
                                    onMouseEnter={() => playSFX('hover_sound', theme)}
                                >
                                    <Icon size={20} />
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>

                {isTerminal ? (
                    <div className="terminal-quote-container">
                        <div className="terminal-quote-line">
                            <span className="terminal-prompt">&gt; </span>
                            <span className="terminal-typed">{typedText}</span>
                            <span className="terminal-cursor">█</span>
                        </div>
                        <button
                            className="quote-edit-btn terminal-edit-btn"
                            onClick={() => setEditorOpen(true)}
                            title="Edit quotes"
                        >
                            <Pencil size={12} />
                        </button>
                    </div>
                ) : (
                    <div className="mascot-container">
                        <div className="mascot-bubble-wrapper">
                            <div className={`mascot-bubble ${animClass}`} key={currentIdx}>
                                {currentQuote}
                            </div>
                            <button
                                className="quote-edit-btn"
                                onClick={() => setEditorOpen(true)}
                                title="Edit quotes"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                        <img src="/mascot.png" alt="Study Buddy Mascot" className="mascot-img" />
                    </div>
                )}
            </nav>

            {/* Main Content Area */}
            <main className="main-content">
                <div className="top-decoration"></div>
                <Outlet />
            </main>

            {editorOpen && (
                <QuoteEditorModal
                    onClose={() => setEditorOpen(false)}
                    onChanged={loadQuotes}
                />
            )}
        </div>
    );
}
