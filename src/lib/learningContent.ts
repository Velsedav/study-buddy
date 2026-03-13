export interface QuizOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

export interface QuizQuestion {
    id: number;
    question: string;
    options: QuizOption[];
}

export interface Lesson {
    id: string;
    title: string;
    content: string;
    question: QuizQuestion;
}

export interface Chapter {
    id: string;
    title: string;
    lessons: Lesson[];
}

export interface Section {
    id: string;
    icon: string;
    title: string;
    description: string;
    chapters: Chapter[];
    color: string;
}

export const curriculum: Section[] = [
    {
        id: "section-1",
        icon: "🧠",
        title: "Section 1: The Brain's Engine (Health & Mindset)",
        description: "To build a high-performance vehicle, you must first take care of the engine. This section covers the biological and psychological foundations of learning.",
        color: "var(--primary)",
        chapters: [
            {
                id: "chapter-1-1",
                title: "Chapter 1.1: The Biology of Learning",
                lessons: [
                    {
                        id: "lesson-1-1-a",
                        title: "Subsection A: The Overnight Upgrade (Sleep)",
                        content: "You might think pulling an all-nighter makes you a dedicated student, but biologically, it is destroying your progress. When you are awake, your brain accumulates toxic metabolic by-products. When you sleep, your brain cells literally shrink, allowing cerebral fluids to wash these toxins away. More importantly, sleep is when your brain consolidates memories; it replays the day's events and physically grows new \"dendritic spines\" (the connections between neurons). Without sleep, your learning foundation is built on sand.",
                        question: {
                            id: 1,
                            question: "What is the primary cognitive benefit of getting a full night's sleep after studying?",
                            options: [
                                { id: "a", text: "It allows the brain to wash away accumulated toxins and physically grow new neural connections to solidify memories.", isCorrect: true },
                                { id: "b", text: "It gives your eyes a rest so you can read faster the next day.", isCorrect: false },
                                { id: "c", text: "It completely clears your short-term memory so you can memorize a whole new subject the next morning.", isCorrect: false },
                                { id: "d", text: "It burns the calories consumed during studying, preventing cognitive fatigue.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-1-1-b",
                        title: "Subsection B: Brain Fertilizer (Exercise)",
                        content: "Exercise isn't just for athletes; it is a cheat code for students. When you engage in intense physical activity, your brain releases a protein called BDNF (Brain-Derived Neurotrophic Factor). Think of BDNF as high-grade fertilizer for your brain—it helps neurons grow, connect, and strengthen, dramatically improving your memory and ability to learn. Even just 5 to 10 minutes of walking or intense movement increases blood flow to the brain by 30 to 40%, instantly giving you a surge of focus.",
                        question: {
                            id: 2,
                            question: "How does physical exercise directly impact your ability to study?",
                            options: [
                                { id: "a", text: "It increases blood flow and releases BDNF, a protein that acts like fertilizer to help neural connections grow and strengthen.", isCorrect: true },
                                { id: "b", text: "It exhausts the body so that you are forced to sit still at your desk for longer periods.", isCorrect: false },
                                { id: "c", text: "It distracts your brain, which is the only way to cure the \"illusion of competence.\"", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-1-1-c",
                        title: "Subsection C: Brain Fuel (Nutrition)",
                        content: "Your brain consumes about 20% of your body's total energy, despite being only 2% of your weight. If you fuel it with highly processed sugars, you will experience a rapid glucose spike followed by an inevitable crash, destroying your focus. To maintain sustained cognitive performance, you must eat foods rich in Omega-3 fatty acids (like walnuts and salmon), antioxidants (like berries), and complex carbohydrates that release energy slowly. Hydration is equally critical; even a 2% drop in hydration can profoundly impair your concentration and short-term memory.\n\n![Brain Nutrition](/assets/images/learning%20center/food.png)",
                        question: {
                            id: 21,
                            question: "Why should you avoid highly processed sugars before a long study session?",
                            options: [
                                { id: "a", text: "They cause a rapid energy spike followed by a severe crash, which destroys sustained focus.", isCorrect: true },
                                { id: "b", text: "They permanently decrease the size of your working memory.", isCorrect: false },
                                { id: "c", text: "They prevent your brain from entering the \"default mode network\" required for sleep.", isCorrect: false }
                            ]
                        }
                    }
                ]
            },
            {
                id: "chapter-1-2",
                title: "Chapter 1.2: Focus & Friction",
                lessons: [
                    {
                        id: "lesson-1-2-a",
                        title: "Subsection A: The Illusion of Laziness",
                        content: "Many students feel guilty when they cannot focus at 8:00 PM after a long day of classes, labeling themselves as \"lazy.\" Science says otherwise. Your brain follows a biological clock. Your prefrontal cortex—the area responsible for deep focus and complex thought—gradually depletes its energy throughout the day. Your metabolism and cognitive performance naturally peak in the morning (around 10:30 AM) and crash in the evening. You aren't lazy; you are simply trying to run a marathon on an empty battery.",
                        question: {
                            id: 3,
                            question: "Why is it typically much harder to engage in deep studying late in the evening?",
                            options: [
                                { id: "a", text: "Your prefrontal cortex depletes its energy throughout the day, making evening study biologically much harder than morning study.", isCorrect: true },
                                { id: "b", text: "You have likely consumed too much sugar during the day, causing a permanent insulin crash.", isCorrect: false },
                                { id: "c", text: "You are naturally a lazy person and lack the innate talent required for late-night studying.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-1-2-b",
                        title: "Subsection B: Defeating Procrastination (The Pain Center)",
                        content: "When you think about a task you don't want to do (like studying for a math test), your brain actually activates the insular cortex—the pain center of the brain. To escape this literal feeling of pain, your brain tricks you into opening social media for a quick dopamine hit. The secret to beating procrastination is the Pomodoro Technique. By committing to just 25 minutes of focused work followed by a 5-minute break, you lower the barrier to entry. Once you start the timer and begin working, the \"pain\" disappears within minutes.",
                        question: {
                            id: 4,
                            question: "What is happening in your brain when you procrastinate on a difficult assignment?",
                            options: [
                                { id: "a", text: "Thinking about the hard task activates your brain's pain center, making you seek temporary relief through distractions.", isCorrect: true },
                                { id: "b", text: "Your brain is telling you that the material is too difficult and you should wait until you are smarter to attempt it.", isCorrect: false },
                                { id: "c", text: "Your working memory is full, and procrastination is your brain's way of deleting old files.", isCorrect: false },
                                { id: "d", text: "You are entering the \"diffuse mode\" of thinking, which is a highly productive state.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-1-2-c",
                        title: "Subsection C: Focused Mode vs. Diffuse Mode",
                        content: "Your brain operates in two fundamentally different thinking modes, and mastering both is the key to solving hard problems. Focused Mode is a tight, concentrated state where your prefrontal cortex is engaged—perfect for practicing known techniques and following familiar pathways. Diffuse Mode is the opposite: a relaxed, big-picture state where your brain makes unexpected connections across distant neural regions. This is why your best ideas strike in the shower or during a walk.\n\nThe crucial insight: you cannot be in both modes simultaneously. To tackle a hard problem, you must first engage Focused Mode to load the problem into your brain, then deliberately switch to Diffuse Mode (take a walk, sleep, rest) to let it incubate. The Pomodoro break is not laziness—it is a biological necessity for your brain to consolidate and make creative leaps.",
                        question: {
                            id: 21,
                            question: "Why is your break after a focused study session scientifically important, not just a reward?",
                            options: [
                                { id: "a", text: "The relaxed Diffuse Mode allows your brain to make unexpected connections and consolidate the material you studied in Focused Mode.", isCorrect: true },
                                { id: "b", text: "Breaks reset your pain center so procrastination disappears for the rest of the day.", isCorrect: false },
                                { id: "c", text: "Taking breaks reduces cortisol permanently, which increases your IQ over time.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-2",
        icon: "🛠️",
        title: "Section 2: Core Study Techniques (The Workflow)",
        description: "This section dismantles the worst study habits and replaces them with highly efficient, scientifically proven workflows.",
        color: "var(--secondary)",
        chapters: [
            {
                id: "chapter-2-1",
                title: "Chapter 2.1: The Illusion of Competence vs. Active Recall",
                lessons: [
                    {
                        id: "lesson-2-1-a",
                        title: "Subsection A: The Re-reading Trap",
                        content: "Re-reading your notes and highlighting textbooks feels incredibly productive. It feels like learning. However, cognitive psychologists have proven this is an \"Illusion of Competence\". When you read a text multiple times, the words become fluent and familiar. Your brain confuses this easy familiarity with true mastery. You haven't actually encoded the information; you just recognize it. This is why students can study for 10 hours by reading, yet completely blank out during the exam.",
                        question: {
                            id: 5,
                            question: "Why do cognitive scientists warn against repeatedly re-reading and highlighting notes?",
                            options: [
                                { id: "a", text: "It creates a false sense of mastery; you recognize the words, but you haven't actually committed the concepts to memory.", isCorrect: true },
                                { id: "b", text: "Highlighting uses too much physical energy, which drains your brain's BDNF levels.", isCorrect: false },
                                { id: "c", text: "It forces your brain into \"diffuse mode,\" preventing you from focusing on details.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-2-1-b",
                        title: "Subsection B: Active Recall & The Blank Page",
                        content: "If you want to build durable memory, you must practice pulling information out of your brain, not just cramming it in. This is called Retrieval Practice or Active Recall. The ultimate form of this is the \"Blank Page\" method (or \"blurting\"). After reading a chapter, close the book, grab a blank piece of paper, and write down absolutely everything you can remember in 5 minutes. It will feel difficult and frustrating, but that exact struggle is what signals your brain to strengthen the neural pathways, permanently anchoring the knowledge.",
                        question: {
                            id: 6,
                            question: "What is the most effective way to ensure a concept is permanently locked into your memory?",
                            options: [
                                { id: "a", text: "Closing your materials and struggling to recall and write down the information from scratch.", isCorrect: true },
                                { id: "b", text: "Copying the textbook word-for-word into a beautiful, color-coded notebook.", isCorrect: false },
                                { id: "c", text: "Reading the chapter summary five times right before you go to sleep.", isCorrect: false },
                                { id: "d", text: "Skimming the text while listening to classical music.", isCorrect: false }
                            ]
                        }
                    }
                ]
            },
            {
                id: "chapter-2-2",
                title: "Chapter 2.2: Structuring Your Practice",
                lessons: [
                    {
                        id: "lesson-2-2-a",
                        title: "Subsection A: Spaced Repetition",
                        content: "Humans are biologically wired to forget. Within days of learning something, you will forget over 70% of it if you don't attempt to retain it—this is known as the \"Forgetting Curve\". You can hack this curve using Spaced Repetition. Instead of massing all your study time into one 5-hour cram session the night before an exam, you spread those 5 hours over a week or a month. By reviewing the material just as you are about to forget it, you force your brain to work harder to retrieve it, which builds thicker, stronger neural \"brick walls\".",
                        question: {
                            id: 7,
                            question: "How does \"Spaced Practice\" defeat the brain's natural Forgetting Curve?",
                            options: [
                                { id: "a", text: "By reviewing material just as you are about to forget it, forcing your brain to work harder and build stronger permanent memories.", isCorrect: true },
                                { id: "b", text: "By allowing you to cram more effectively the night before the exam without losing sleep.", isCorrect: false },
                                { id: "c", text: "By spacing your notes visually on the page so your brain can process the white space.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-2-2-b",
                        title: "Subsection B: Interleaved Practice",
                        content: "Most math textbooks use \"blocked practice\": you learn Formula A, and then do 20 problems using Formula A. This is a trap. You aren't learning how to solve a problem; you are just blindly repeating a pattern. The secret to true mastery is \"Interleaving\"—mixing up different types of problems or subjects in the same study session. By shuffling the topics, your brain is forced to constantly evaluate which formula or concept to use. This builds mental flexibility and prepares you for the unpredictability of a real exam.",
                        question: {
                            id: 8,
                            question: "Why is \"Interleaving\" (mixing up different types of problems) superior to practicing one single topic at a time?",
                            options: [
                                { id: "a", text: "It forces your brain to learn when to apply specific solutions, building mental flexibility for real exams.", isCorrect: true },
                                { id: "b", text: "It allows your brain to rest by switching to easier subjects whenever you get frustrated.", isCorrect: false },
                                { id: "c", text: "It tricks your brain into thinking you are playing a video game, releasing dopamine.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-2-2-c",
                        title: "Subsection C: The 'Bashing' Trap & The Cortisol Block",
                        content: "Many students fall into the \"bashing\" trap—when they get an exercise wrong, they immediately redo the exact same exercise over and over until they get it right. This feels productive but provides a false sense of mastery. The problem? You're training pattern recognition for one specific problem, not building transferable understanding.\n\nWorse, repeated failure triggers cortisol—the stress hormone. High cortisol literally blocks memory formation and retrieval. When you feel frustrated and stuck, your brain is chemically preventing you from learning effectively. This is the \"cortisol block.\"\n\nThe solution is simple: when you fail an exercise, STOP. Write the error in your \"Carnet d'erreurs\" (error notebook), go back to the relevant course material, understand the concept, then attempt a DIFFERENT exercise that tests the same principle. This breaks the cortisol cycle and builds genuine understanding.",
                        question: {
                            id: 19,
                            question: "Why is 'bashing' (repeating the exact same failed exercise over and over) counterproductive?",
                            options: [
                                { id: "a", text: "It triggers cortisol (the stress hormone) which blocks memory formation, and only trains pattern recognition for one specific problem rather than building real understanding.", isCorrect: true },
                                { id: "b", text: "It is actually the best method—repetition is always the key to mastery.", isCorrect: false },
                                { id: "c", text: "It is only bad if you do it for more than 3 hours straight.", isCorrect: false },
                                { id: "d", text: "It uses too much paper and ink, which is wasteful.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-2-2-d",
                        title: "Subsection D: How to Organize Your Study (The 4-Step Loop)",
                        content: "The most effective study workflow follows a simple 4-step loop:\n\n**Step 1: Test Yourself.** Before reviewing any material, attempt exercises or self-test from memory. This immediately reveals what you actually know vs. what you think you know.\n\n**Step 2: Carnet d'erreurs (Error Notebook).** Write down every mistake, every gap, every concept you struggled with. Be brutally honest. This is your personal diagnostic report.\n\n**Step 3: If you can't fix the mistakes, go back to the course.** Only now do you re-read the relevant course material—but with surgical precision. You know exactly which parts you need to understand better because your error notebook told you.\n\n**Step 4: Repeat.** After reviewing the course material, go back to Step 1 with NEW exercises. The loop continues until you can test yourself without errors.\n\nThis loop is powerful because it flips the traditional study approach on its head. Instead of \"read first, practice later,\" you practice first and only read when your mistakes tell you exactly what to study.",
                        question: {
                            id: 20,
                            question: "In the 4-step study loop, what is the purpose of the 'Carnet d'erreurs' (error notebook)?",
                            options: [
                                { id: "a", text: "It acts as a personal diagnostic report that tells you exactly which course material to review, making your study surgically precise.", isCorrect: true },
                                { id: "b", text: "It is a notebook for writing down your feelings about studying to manage stress.", isCorrect: false },
                                { id: "c", text: "It replaces the need for testing yourself because writing errors is enough.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-3",
        icon: "🧩",
        title: "Section 3: Information Processing & Metacognition",
        description: "How to organize complex data, overcome mental blocks, and verify that you actually understand what you study.",
        color: "var(--accent)",
        chapters: [
            {
                id: "chapter-3-1",
                title: "Chapter 3.1: Bypassing the Cognitive Bottleneck",
                lessons: [
                    {
                        id: "lesson-3-1-a",
                        title: "Subsection A: Priming your Brain",
                        content: "Your working memory is tiny; it can only hold about four pieces of information at once. If you try to read a dense textbook chapter from start to finish cold, your brain will overflow and leak information. You must \"prime\" the pump. Spend 3 to 5 minutes quickly skimming the chapter before reading it. Look only at bold headings, diagrams, bullet points, and summaries. This doesn't build understanding; it builds a structural framework—a coat hanger in your brain—so that when you do read deeply, the complex facts have a place to hang.",
                        question: {
                            id: 9,
                            question: "What is the main cognitive purpose of \"priming\" or skimming a chapter before reading it deeply?",
                            options: [
                                { id: "a", text: "To build a structural framework in your brain so that complex details have a place to attach when you read deeply.", isCorrect: true },
                                { id: "b", text: "To find the answers to the homework so you don't actually have to read the chapter.", isCorrect: false },
                                { id: "c", text: "To activate your brain's pain center and get the procrastination out of the way early.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-3-1-b",
                        title: "Subsection B: Mind Mapping (The GRINDE Framework)",
                        content: "Mind maps are not about drawing pretty pictures. Linear notes isolate data, but the human brain processes information as a vast, interconnected network. A scientifically effective mind map follows the GRINDE framework: Grouped, Reflective, Interconnected, Non-verbal, Directional, and Emphasized. The most crucial step is Interconnection—drawing physical links between ideas on completely different branches. If your map is just a table of contents arranged in a circle with no cross-links, you are suffering from \"linear siloing\" and missing out on higher-order critical thinking.",
                        question: {
                            id: 10,
                            question: "According to cognitive science, what is the most critical element that transforms a mind map from a simple drawing into a powerful learning tool?",
                            options: [
                                { id: "a", text: "Cross-linking interconnected ideas between entirely different branches to force synthesis and critical thinking.", isCorrect: true },
                                { id: "b", text: "Using perfectly curved lines and at least seven different aesthetic highlighter colors.", isCorrect: false },
                                { id: "c", text: "Writing out full, detailed paragraphs at the end of each branch so no information is lost.", isCorrect: false },
                                { id: "d", text: "Converting every single word of the mind map into an Anki flashcard immediately.", isCorrect: false }
                            ]
                        }
                    }
                ]
            },
            {
                id: "chapter-3-2",
                title: "Chapter 3.2: Elaboration & Metacognition",
                lessons: [
                    {
                        id: "lesson-3-2-a",
                        title: "Subsection A: Self-Explanation (The Feynman Technique)",
                        content: "Have you ever read a page, nodded along, and realized you understood nothing? To fix this, use \"Elaboration\" and \"Self-Explanation.\" When you finish a complex paragraph, look away and try to explain it aloud in your own words, as if you were teaching a 5-year-old (or a rubber duck!). If you rely on the textbook's exact jargon, you are just reciting. If you stumble or can't simplify the concept, you have instantly found a gap in your knowledge. Teaching others (even imaginary ones) is one of the highest forms of learning.",
                        question: {
                            id: 11,
                            question: "How does the \"Rubber Ducky\" or self-explanation technique guarantee deeper understanding?",
                            options: [
                                { id: "a", text: "Explaining a concept in your own simple words immediately exposes gaps and contradictions in your understanding.", isCorrect: true },
                                { id: "b", text: "Talking out loud increases your lung capacity, which pumps more oxygen to the brain.", isCorrect: false },
                                { id: "c", text: "It allows you to memorize the textbook's exact definitions through auditory feedback.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-3-2-b",
                        title: "Subsection B: Metacognition (Knowing what you don't know)",
                        content: "\"Metacognition\" is your ability to accurately judge what you actually know versus what you think you know. Poor students have terrible metacognition; they read their notes, feel confident, and stop studying prematurely. The only way to calibrate your metacognition is through constant self-testing. Do not wait for the professor's exam to test you. Create your own tests, use flashcards, and use practice exams. When you make an error on a practice test, your brain receives the feedback needed to correct its illusions.",
                        question: {
                            id: 12,
                            question: "What is \"metacognition\" in the context of studying, and how do you improve it?",
                            options: [
                                { id: "a", text: "It is your awareness of what you actually know, which is best improved by constantly testing yourself to find your weak spots.", isCorrect: true },
                                { id: "b", text: "It is a state of deep focus achieved only through 90-minute sleep cycles.", isCorrect: false },
                                { id: "c", text: "It is the ability to intuitively know which questions the professor will put on the final exam.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-4",
        icon: "🧠",
        title: "Section 4: Memory Architecture & Cognitive Load",
        description: "This section teaches users how to stop overwhelming their brains by understanding the physical limitations of their memory.",
        color: "var(--danger)",
        chapters: [
            {
                id: "chapter-4-1",
                title: "Chapter 4.1: The Working Memory Bottleneck",
                lessons: [
                    {
                        id: "lesson-4-1-a",
                        title: "Subsection A: The School Bag Metaphor",
                        content: "Your brain has two main memory systems: working memory and long-term memory. Your working memory is the part of your brain that processes information in real-time. Think of it like a small school bag: it is very useful because it is close at hand, but it has a severe limitation—it can only hold about four pieces of information at once. If you try to take in too many new ideas simultaneously, you exceed your \"cognitive load\". The information simply spills out of the bag and is lost. To learn effectively, you must minimize distractions to keep your working memory entirely focused on the task at hand.",
                        question: {
                            id: 13,
                            question: "What happens when you experience \"cognitive overload\" while studying?",
                            options: [
                                { id: "a", text: "Your working memory runs out of \"slots\" to hold information, making it nearly impossible to process new ideas.", isCorrect: true },
                                { id: "b", text: "Your long-term memory becomes completely full and starts permanently deleting old memories.", isCorrect: false },
                                { id: "c", text: "Your brain enters the \"diffuse mode,\" causing you to fall asleep instantly.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-4-1-b",
                        title: "Subsection B: The Power of Chunking",
                        content: "Since your working memory can only hold about four items, how do you learn complex subjects? The answer is \"Chunking.\" Chunking is the process of binding separate pieces of information together through meaning. Think of a puzzle: when you first start, you have hundreds of individual pieces. But as you connect them, they form a single \"chunk\" (a completed section of the puzzle). Once a concept is fully chunked, it only takes up one slot in your working memory instead of four, freeing up massive cognitive space to learn even harder material.",
                        question: {
                            id: 14,
                            question: "How does \"chunking\" help bypass the strict limits of your working memory?",
                            options: [
                                { id: "a", text: "It binds multiple, scattered details into a single, meaningful concept, taking up less space in your working memory.", isCorrect: true },
                                { id: "b", text: "It increases the physical size of your working memory so you can hold twenty items instead of four.", isCorrect: false },
                                { id: "c", text: "It bypasses your working memory entirely and sends information directly to your spinal cord.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-5",
        icon: "🏆",
        title: "Section 5: The Path to Mastery",
        description: "This section covers the difference between casually studying and training like an expert.",
        color: "var(--success)",
        chapters: [
            {
                id: "chapter-5-1",
                title: "Chapter 5.1: Deliberate Practice",
                lessons: [
                    {
                        id: "lesson-5-1-a",
                        title: "Subsection A: The Trap of \"Lazy Learning\"",
                        content: "Spending four hours studying does not guarantee you learned anything. Many students engage in \"lazy learning\"—they repeatedly practice the material they already find easy because it feels good and safe. True experts use \"Deliberate Practice.\" Deliberate practice means intentionally identifying your weakest points and focusing your mental effort almost exclusively on the material that is most difficult for you. It requires stepping outside your comfort zone and embracing the struggle.",
                        question: {
                            id: 15,
                            question: "According to the science of expertise, what is \"Deliberate Practice\"?",
                            options: [
                                { id: "a", text: "Intentionally focusing your effort on the specific material or steps that are the most difficult for you.", isCorrect: true },
                                { id: "b", text: "Practicing the same easy concepts over and over until you can do them with your eyes closed.", isCorrect: false },
                                { id: "c", text: "Studying for at least 10,000 hours, regardless of what material you are reviewing.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-5-1-b",
                        title: "Subsection B: Unpacking Component Skills",
                        content: "You cannot master a highly complex skill (like writing a perfect essay or performing a surgical procedure) by just trying to do the whole thing at once. Complex tasks must be \"unpacked\" into smaller component skills. If you are struggling with a subject, don't just keep re-reading the whole chapter. Identify the exact underlying skill you are missing, practice that specific component in isolation, and then integrate it back into the whole task.",
                        question: {
                            id: 16,
                            question: "What should you do if you are consistently failing at a highly complex academic task?",
                            options: [
                                { id: "a", text: "Break the complex task down into its smaller component skills and practice the ones you are weakest at.", isCorrect: true },
                                { id: "b", text: "Continue attempting the full, complex task repeatedly until you eventually figure it out through trial and error.", isCorrect: false },
                                { id: "c", text: "Switch to a different learning style to see if the complex task suddenly becomes easier.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-6",
        icon: "🛑",
        title: "Section 6: Mindset & Myths",
        description: "This section dismantles the psychological barriers and popular myths that hold students back.",
        color: "var(--text-dark)",
        chapters: [
            {
                id: "chapter-6-1",
                title: "Chapter 6.1: The Myth of Learning Styles",
                lessons: [
                    {
                        id: "lesson-6-1-a",
                        title: "Subsection A: Visual vs. Auditory Learners",
                        content: "You have probably been told that you have a specific \"Learning Style\"—that you are primarily a \"visual learner,\" an \"auditory learner,\" or a \"kinesthetic learner.\" Cognitive psychology has repeatedly proven that this is a myth; there is no scientific evidence that matching instruction to a student's preferred learning style improves their performance. In reality, human beings learn best when multiple senses are combined. You shouldn't limit yourself to one style. To build strong neural connections, use your eyes, ears, and hands simultaneously.",
                        question: {
                            id: 17,
                            question: "What does cognitive science research conclude about the popular concept of \"Learning Styles\"?",
                            options: [
                                { id: "a", text: "It is a myth; students actually learn best when they engage multiple senses at the same time, rather than limiting themselves to just one.", isCorrect: true },
                                { id: "b", text: "It is highly accurate, and you should refuse to study any material that isn't presented in your preferred style.", isCorrect: false },
                                { id: "c", text: "Only adults have fixed learning styles, whereas children can learn through any method.", isCorrect: false }
                            ]
                        }
                    }
                ]
            },
            {
                id: "chapter-6-2",
                title: "Chapter 6.2: Motivation and Mindset",
                lessons: [
                    {
                        id: "lesson-6-2-a",
                        title: "Subsection A: The Growth Mindset & Desirable Difficulties",
                        content: "When learning feels incredibly difficult, many students believe it means they aren't smart enough. This is a \"fixed mindset.\" Research shows that having a \"growth mindset\"—the belief that your intellectual abilities are physically increased through hard work and struggle—drastically improves academic success. The frustration you feel when you can't solve a problem is actually a \"desirable difficulty\". That feeling of friction isn't a sign of failure; it is the literal feeling of your brain growing new neural pathways.",
                        question: {
                            id: 18,
                            question: "How should you interpret the feeling of frustration when studying highly difficult material?",
                            options: [
                                { id: "a", text: "As a \"desirable difficulty\" that signals your brain is actively growing and strengthening its intellectual capabilities.", isCorrect: true },
                                { id: "b", text: "As a clear indicator that you lack the innate talent required for that particular subject.", isCorrect: false },
                                { id: "c", text: "As a sign that you should immediately stop studying and re-read your notes from the beginning.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "section-7",
        icon: "🥗",
        title: "Section 7: Nutrition & Performance Cognitive",
        description: "Ce que vous mangez influence directement la qualité de votre concentration, de votre mémoire et de votre motivation. Découvrez les mécanismes biologiques qui relient l'assiette au cerveau.",
        color: "var(--success)",
        chapters: [
            {
                id: "chapter-7-1",
                title: "Chapter 7.1: Glycémie & Lipides Cérébraux",
                lessons: [
                    {
                        id: "lesson-7-1-a",
                        title: "Leçon 1 : La Glycémie et l'Énergie Stable",
                        content: "Le cerveau consomme environ 20 % de l'énergie totale du corps. Contrairement aux muscles, il ne peut pas stocker le glucose et dépend d'un apport sanguin constant. Les sucres raffinés provoquent une sécrétion massive d'insuline, suivie d'une hypoglycémie réactionnelle qui déclenche brouillard mental, irritabilité et chute de concentration. Pour lisser cette courbe, il faut consommer les fibres, graisses et protéines AVANT les glucides lors d'un repas afin de ralentir la vidange gastrique.",
                        question: {
                            id: 22,
                            question: "Lequel de ces mécanismes explique pourquoi l'ordre de consommation des aliments influence la concentration de l'après-midi ?",
                            options: [
                                { id: "a", text: "Les fibres captent les molécules de glucose pour les transporter directement vers le cortex préfrontal.", isCorrect: false },
                                { id: "b", text: "La structure « fibres-graisses-protéines » crée un obstacle physique et chimique qui ralentit l'absorption des glucides, évitant ainsi un pic d'insuline dévastateur.", isCorrect: true },
                                { id: "c", text: "Manger des glucides en dernier permet de saturer les récepteurs d'adénosine, empêchant le « coup de barre » post-prandial.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-7-1-b",
                        title: "Leçon 2 : Le Hack de l'Amidon Résistant",
                        content: "La structure moléculaire des féculents change selon leur préparation. En faisant cuire, puis refroidir (au moins 24h au frigo) des aliments comme le riz, les pâtes ou les pommes de terre, une partie de l'amidon se transforme en amidon résistant par un processus de rétrogradation. Cela réduit l'index glycémique (IG) de l'aliment jusqu'à 40 %. L'amidon ainsi modifié n'est plus digéré dans l'intestin grêle mais fermente dans le côlon, fournissant une énergie beaucoup plus stable au cerveau.",
                        question: {
                            id: 23,
                            question: "Pour un étudiant cherchant à éviter le « crash » d'énergie pendant un examen de 4 heures, quelle préparation de pain blanc est scientifiquement la plus efficace pour stabiliser la glycémie ?",
                            options: [
                                { id: "a", text: "Du pain blanc frais, riche en glucides simples immédiatement biodisponibles.", isCorrect: false },
                                { id: "b", text: "Du pain blanc qui a été congelé, décongelé, puis grillé au grille-pain.", isCorrect: true },
                                { id: "c", text: "Du pain blanc grillé directement après l'achat sans passage au froid.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-7-1-c",
                        title: "Leçon 4 : Lipides Structuraux et Préparation des Graines",
                        content: "Le cerveau sec est composé à 60 % de graisses. Le DHA (Oméga-3) est un constituant majeur des membranes neuronales ; il influence la fluidité synaptique et la vitesse de transmission des signaux. Les sources marines (saumon, sardines) sont prioritaires car la conversion des sources végétales (lin, chia) en DHA est très inefficace chez l'humain. De plus, les graines de chia et de lin doivent être moulues, sinon leur enveloppe protectrice empêche toute absorption des nutriments.",
                        question: {
                            id: 25,
                            question: "Pourquoi la consommation de graines de lin entières saupoudrées sur un yaourt est-elle considérée comme un geste nutritionnel « neutre » pour le cerveau ?",
                            options: [
                                { id: "a", text: "Parce que les enzymes digestives humaines sont incapables de briser l'enveloppe externe de la graine, qui est évacuée intacte.", isCorrect: true },
                                { id: "b", text: "Parce que le calcium du yaourt neutralise les acides gras ALA avant leur absorption.", isCorrect: false },
                                { id: "c", text: "Parce que les Oméga-3 végétaux s'oxydent instantanément au contact de l'air une fois la graine sortie de son emballage.", isCorrect: false }
                            ]
                        }
                    }
                ]
            },
            {
                id: "chapter-7-2",
                title: "Chapter 7.2: Synergie, Toxicologie & Dopamine",
                lessons: [
                    {
                        id: "lesson-7-2-a",
                        title: "Leçon 3 : Synergies et Bloqueurs de Nutriments",
                        content: "L'efficacité d'un aliment ne dépend pas seulement de ce qu'il contient, mais de ce avec quoi il est consommé.\n\n- **Fer** : Le café et le thé consommés pendant un repas réduisent l'absorption du fer de 39 % à 64 % à cause des polyphénols.\n- **Curcuma** : Sa curcumine est 2000 % mieux absorbée si elle est associée à la pipérine du poivre noir.\n- **Vitamines A, D, E, K** : Elles sont liposolubles et ne peuvent être absorbées qu'en présence de graisses (huile d'olive, avocat, œufs).",
                        question: {
                            id: 24,
                            question: "Une étudiante carencée en fer (cofacteur essentiel de la dopamine) souhaite optimiser son déjeuner pour sa concentration. Quelle combinaison est à éviter absolument ?",
                            options: [
                                { id: "a", text: "Un steak de bœuf accompagné d'un verre de jus d'orange (vitamine C).", isCorrect: false },
                                { id: "b", text: "Une salade de lentilles (fer non-héminique) consommée avec un thé vert brûlant.", isCorrect: true },
                                { id: "c", text: "Des œufs au plat (fer + lipides) suivis d'une marche de 15 minutes.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-7-2-b",
                        title: "Leçon 5 : Neuro-Toxicologie et Matériel de Cuisson",
                        content: "Les performances cognitives peuvent être « parasitées » par l'environnement culinaire. Les revêtements antiadhésifs (Téflon) peuvent libérer des PFAS (produits chimiques éternels) neurotoxiques à haute température. Il est recommandé d'utiliser l'acier inoxydable ou la fonte. De plus, pour éviter le brouillard cérébral lié à l'histamine (molécule qui augmente dans les restes conservés trop longtemps au frigo), il est impératif de congeler rapidement les plats préparés à l'avance.",
                        question: {
                            id: 26,
                            question: "Quel est le risque cognitif majeur associé à l'utilisation répétée de contenants en plastique chauffés au micro-ondes pour le « meal prep » étudiant ?",
                            options: [
                                { id: "a", text: "La dénaturation des protéines qui deviennent alors impossibles à convertir en tyrosine.", isCorrect: false },
                                { id: "b", text: "La migration de bisphénols et de phtalates qui miment les hormones et perturbent l'équilibre neuro-chimique.", isCorrect: true },
                                { id: "c", text: "La destruction des antioxydants (baies, légumes) par les ondes électromagnétiques.", isCorrect: false }
                            ]
                        }
                    },
                    {
                        id: "lesson-7-2-c",
                        title: "Leçon 6 : Le Petit-Déjeuner de la Dopamine",
                        content: "Pour maintenir la motivation et l'alerte dès le matin, le cerveau a besoin de tyrosine, un acide aminé précurseur de la dopamine et de la noradrénaline. L'objectif est de consommer environ 30 grammes de protéines dès le réveil (œufs, skyr, dinde, soja). Cela prévient le « brouillard mental » de 10h00. Enfin, attendez 90 à 120 minutes après le réveil avant votre premier café pour laisser le pic de cortisol naturel agir sans créer de dépendance ou de crash brutal.",
                        question: {
                            id: 27,
                            question: "Pourquoi un petit-déjeuner composé uniquement de céréales sucrées et de jus d'orange est-il le pire choix pour un étudiant ayant un examen à 10h00 ?",
                            options: [
                                { id: "a", text: "Il sature les récepteurs de sérotonine, provoquant une envie de dormir immédiate.", isCorrect: false },
                                { id: "b", text: "Il ne fournit aucun acide aminé pour la synthèse de dopamine et provoque une hypoglycémie réactionnelle pile au moment de l'examen.", isCorrect: true },
                                { id: "c", text: "Le sucre empêche physiquement l'oxygène d'atteindre les mitochondries des neurones.", isCorrect: false }
                            ]
                        }
                    }
                ]
            }
        ]
    }
];
