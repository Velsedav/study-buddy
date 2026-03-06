export type TierType = 'S' | 'A' | 'B' | 'D' | 'E' | 'F';

export type TechCategory = 'memoriser' | 'comprendre' | 'faire';

export const CATEGORY_LABELS: Record<TechCategory, string> = {
    memoriser: 'Savoir Mémoriser',
    comprendre: 'Savoir Comprendre',
    faire: 'Savoir Faire',
};

export const CATEGORY_COLORS: Record<TechCategory, string> = {
    memoriser: '#8b5cf6',
    comprendre: '#3b82f6',
    faire: '#f59e0b',
};

export interface Technique {
    id: string;
    name: string;
    tier: TierType;
    hint: string;
    defaultMinutes?: number;
    advantage?: string;
    category?: TechCategory;
    externalLink?: string;
}

export const TECHNIQUES: Technique[] = [
    // 🏆 S-TIER (God Tier - Maximum Efficiency)
    { id: 't1', name: 'Active Recall', tier: 'S', hint: 'Instead of passively reading, train yourself to pull information out. This struggle builds long-term memory.', advantage: 'Builds powerful long-term memory through effortful retrieval', category: 'memoriser' },
    { id: 'a1', name: 'Anki / Spaced Repetition', tier: 'S', hint: 'Algorithm-optimized flashcards. This is the most direct and efficient way to apply spaced repetition and interrupt the forgetting curve.', defaultMinutes: 25, advantage: 'Algorithm-optimized to defeat the forgetting curve', category: 'memoriser', externalLink: 'https://youtu.be/OxUNYr2ruh8' },
    { id: 's4', name: 'Faire les annales', tier: 'S', hint: 'Using past exams helps spot exact knowledge gaps and prepares you for the real format.', defaultMinutes: 50, advantage: 'Reveals exact exam blind spots & builds exam readiness', category: 'faire' },
    { id: 'new1', name: 'La Feuille Blanche (Blurting)', tier: 'S', hint: 'Write down everything you know from scratch in 10-15 minutes. It is the ultimate diagnostic tool to find what you missed.', defaultMinutes: 15, advantage: 'Ultimate diagnostic: instantly reveals what you truly know', category: 'memoriser', externalLink: 'https://youtu.be/jG-xs9cH9Ks' },
    { id: 't5', name: 'Interleaving (Entrelacement)', tier: 'S', hint: 'Mélange différents types de problèmes ou chapitres dans une même session. Cela t\'apprend non seulement "comment" résoudre un problème, mais surtout "quand" utiliser la bonne méthode.', advantage: 'Teaches WHEN to use formulas, not just HOW', category: 'faire' },
    { id: 's6', name: 'Faire des exercices', tier: 'S', hint: 'Résoudre des problèmes et exercices types pour s\'entraîner. La pratique active est le meilleur prédicteur de performance en examen.', defaultMinutes: 50, advantage: 'Direct practice = best exam performance predictor', category: 'faire' },

    // 🥇 A-TIER (Highly Effective for Comprehension)
    { id: 'c1', name: 'Filtrer le cours (Filtrage & Synthèse)', tier: 'A', hint: 'Trier délibérément le cours pour ne garder que l\'essentiel (concepts clés, zones denses, éléments insistés par le prof) au lieu de tout apprendre. C\'est l\'étape indispensable avant de créer des flashcards.', advantage: 'Eliminates noise & focuses on highest-value content', category: 'comprendre', externalLink: 'https://youtu.be/rzFJkuumZl8?t=282' },
    { id: 't3', name: 'Enseigner aux autres (Feynman)', tier: 'A', hint: 'Explaining a concept out loud helps you instantly identify your gaps in understanding.', advantage: 'Instantly exposes hidden gaps in understanding', category: 'comprendre' },
    { id: 'b2', name: 'Mind-mapping', tier: 'A', hint: 'Forces you to chunk info and draw relationships. Extremely effective if kept to keywords and visual links rather than long text.', defaultMinutes: 20, advantage: 'Creates a visual network that mirrors how the brain stores info', category: 'comprendre' },
    { id: 'a3', name: 'Priming', tier: 'A', hint: 'Skimming headings and diagrams before reading. It builds subconscious familiarity and speeds up deep reading', defaultMinutes: 10, advantage: 'Pre-builds a mental framework so deep reading sticks', category: 'comprendre' },
    { id: 's5', name: 'Créer ses propres notes', tier: 'A', hint: 'Must combine visual and verbal elements (Dual Coding) to be highly effective, rather than acting as a passive transcription', advantage: 'Dual-coded notes are 2x more memorable than plain text', category: 'comprendre' },

    // ⚠️ D-TIER (Low utility, situational at best)
    { id: 'd1', name: 'Apprentissage par coeur', tier: 'D', hint: 'Mémorisation mécanique. Always try to understand the concept first, as comprehension reduces the need for rote memorization', category: 'memoriser' },
    { id: 'd2', name: 'Relecture avant sommeil', tier: 'D', hint: 'Relire son cours juste avant de dormir si = zero énergie', category: 'memoriser' },

    // 🚫 F-TIER (Traps to Avoid - High Time, Low Reward)
    { id: 'b1', name: 'Relire ses propres notes', tier: 'F', hint: 'Re-reading is a "low utility" trap. It creates an illusion of competence but yields very poor retention.' },
    { id: 'e1', name: 'Relire son cours', tier: 'F', hint: 'Reading a text 5 or 10 times is passive, inefficient, and wastes massive amounts of time' },
    { id: 'f1', name: 'Re-regarder cours magistral', tier: 'F', hint: 'Total passivity. Re-consuming material does not mean you are encoding it' },
    { id: 'f2', name: 'Beautifying summaries', tier: 'F', hint: 'Wastes precious cognitive energy on graphic design (arts and crafts) instead of conceptual synthesis' },
];

export function getTierColor(tier: TierType): string {
    switch (tier) {
        case 'S': return 'linear-gradient(135deg, var(--primary), var(--accent))';
        case 'A': return 'var(--success)';
        case 'B': return '#3b82f6';
        case 'D': return '#f59e0b';
        case 'E': return 'var(--danger)';
        case 'F': return '#9ca3af';
    }
}
