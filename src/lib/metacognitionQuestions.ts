// Metacognition reminder questions keyed by technique_id
// Displayed during WORK blocks in the study session

export const METACOGNITION_QUESTIONS: Record<string, { tier: string; questions: string[] }> = {
    // 🏆 S-TIER
    t1: {
        tier: 'S',
        questions: [
            '"Si je ferme les yeux tout de suite, suis-je capable d\'expliquer ce que je viens de lire avec mes propres mots ?"',
            '"Est-ce que je suis vraiment en train de chercher la réponse dans ma mémoire, ou est-ce que j\'ai triché en regardant mon cours ?"',
        ],
    },
    a1: {
        tier: 'S',
        questions: [
            '"Ai-je vraiment deviné la réponse exacte, ou ai-je retourné la carte trop vite en me disant \'ah oui je le savais\' ?"',
            '"À quel point suis-je certain(e) de me souvenir de ce concept si on me pose la question demain ?"',
        ],
    },
    s4: {
        tier: 'S',
        questions: [
            '"Quel est le principe fondamental (ou la règle abstraite) qui se cache derrière cet exercice spécifique ?"',
            '"Ma réponse est-elle vraiment cohérente et logique compte tenu du contexte du problème ?"',
            '"Est-ce que mon erreur est une simple faute d\'inattention, ou une vraie faille de compréhension ?"',
        ],
    },
    new1: {
        tier: 'S',
        questions: [
            '"Quelles sont les informations cruciales que j\'ai oubliées de noter, et pourquoi m\'ont-elles échappé ?"',
            '"Maintenant que je vois mes erreurs, sur quelles lacunes exactes dois-je concentrer ma prochaine session ?"',
        ],
    },
    t5: {
        tier: 'S',
        questions: [
            '"À quel type de problème ai-je affaire ici, et quels indices me permettent de choisir la bonne méthode ?"',
            '"En quoi ce problème est-il fondamentalement différent de celui que je viens juste de résoudre ?"',
        ],
    },
    // 🥇 A-TIER
    t3: {
        tier: 'A',
        questions: [
            '"Est-ce que j\'utilise trop le jargon du manuel, ou puis-je l\'expliquer simplement à un enfant de 10 ans ?"',
            '"À quel moment précis de mon explication est-ce que je commence à bafouiller ou à hésiter ?"',
        ],
    },
    b2: {
        tier: 'A',
        questions: [
            '"Comment ce concept se connecte-t-il logiquement à ce que je savais déjà ?"',
            '"Que se passe-t-il sur cette branche si je modifie une variable sur la branche opposée ?"',
        ],
    },
    a3: {
        tier: 'A',
        questions: [
            '"En lisant uniquement les grands titres et les schémas, qu\'est-ce que je m\'attends à apprendre dans ce chapitre ?"',
            '"Comment ce nouveau sujet s\'intègre-t-il dans le grand plan du cours ?"',
        ],
    },
    s5: {
        tier: 'A',
        questions: [
            '"Suis-je en train de faire le \'dictaphone\' en recopiant, ou suis-je vraiment en train de filtrer et synthétiser ?"',
            '"Quelle image, schéma ou métaphore pourrais-je dessiner pour résumer cette idée abstraite ?"',
        ],
    },
    // ⚠️ D-TIER & F-TIER (alarm questions)
    d1: {
        tier: 'D',
        questions: [
            '"Est-ce que je comprends vraiment la logique derrière cette phrase, ou est-ce que je m\'efforce juste d\'apprendre une suite de mots par cœur ?"',
        ],
    },
    d2: {
        tier: 'D',
        questions: [
            '"Est-ce que je comprends vraiment la logique derrière cette phrase, ou est-ce que je m\'efforce juste d\'apprendre une suite de mots par cœur ?"',
        ],
    },
    b1: {
        tier: 'F',
        questions: [
            '"Attention : est-ce que je suis victime de l\'illusion de compétence simplement parce que ce texte me semble familier ?"',
            '"Si je ferme ce cahier tout de suite, est-ce que je peux réciter les trois idées principales sans regarder ?"',
        ],
    },
    e1: {
        tier: 'F',
        questions: [
            '"Attention : est-ce que je suis victime de l\'illusion de compétence simplement parce que ce texte me semble familier ?"',
            '"Si je ferme ce cahier tout de suite, est-ce que je peux réciter les trois idées principales sans regarder ?"',
        ],
    },
    f1: {
        tier: 'F',
        questions: [
            '"Suis-je en train de regarder ce cours passivement comme une série Netflix, ou est-ce que je mets pause pour prédire ce que le prof va dire ?"',
        ],
    },
    f2: {
        tier: 'F',
        questions: [
            '"Est-ce que passer 15 minutes à rendre ce titre magnifique m\'aide vraiment à mieux comprendre le concept, ou est-ce que je perds mon temps (et mon énergie) ?"',
        ],
    },
    // A-TIER additions
    c1: {
        tier: 'A',
        questions: [
            '"Suis-je en train de filtrer efficacement, ou est-ce que je garde tout par peur de manquer quelque chose ?"',
            '"Quels sont les 3 concepts clés de cette section que je dois absolument retenir ?"',
        ],
    },
    // S-TIER exercises
    s6: {
        tier: 'S',
        questions: [
            '"Quel est le principe fondamental qui se cache derrière cet exercice ?"',
            '"Est-ce que mon erreur est une faute d\'inattention ou une faille de compréhension ?"',
        ],
    },
};
