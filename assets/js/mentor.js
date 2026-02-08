// FILE: assets/js/mentor.js
// AI Study Mentor - Contextual Study Guide

class StudyMentor {
    constructor() {
        this.isOpen = false;
        this.mentorData = null;
        this.isInitialGreeting = false;
        this.isMotivationalNudgeActive = false;
        this.lastMessageIndex = -1;
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.fetchMentorData();
        this.showWelcomeGreeting();
        this.startTimeBasedNudges();
    }

    showWelcomeGreeting() {
        const greetings = [
            "পড়তে বস, বাইনচোদ, চাকরি না পেলে খাবি কি ?",
            "বাপের, মায়ের অপমান এর শোধ লিতে হবে।",
            "শাহেদ যদি BCS ক্যাডার হয় তুই কোন মুখে বাড়ির সামনে রাস্তায় হাটবি।",
            "আরাফাত বলেছিলো , কালকে চাকরি তে যেতে হবে।",
            "নিশা বলেসে তোর সময় দিয়ে কি করলি।",
            "সোহান, তোকে দেখায় দিতেই হবে",

        ];

        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

        this.isInitialGreeting = true;

        // Show greeting in teaser after a short delay
        setTimeout(() => {
            const teaser = document.getElementById('mentor-teaser');
            const teaserBorder = document.getElementById('teaser-border');
            const teaserContent = document.getElementById('teaser-content');
            const teaserDecor = document.getElementById('teaser-decor');
            const teaserEmoji = document.getElementById('teaser-emoji');
            const teaserText = document.getElementById('teaser-text');
            const badge = document.getElementById('mentor-badge');

            if (teaser && teaserText && !this.isOpen) {
                // Apply Champion Theme for Welcome Greeting
                if (teaserBorder && teaserContent) {
                    teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-champion-border`;
                    teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-champion-bg`;

                    if (teaserDecor) teaserDecor.innerHTML = '<div class="champion-sweep"></div>';
                    if (teaserEmoji) teaserEmoji.innerText = '🏆';

                    teaser.classList.add('animate-float');
                }

                teaserText.innerText = randomGreeting;
                teaser.classList.remove('hidden');
                badge?.classList.remove('hidden');

                // Hide teaser after 10 seconds
                setTimeout(() => {
                    teaser.classList.add('hidden');
                    this.isInitialGreeting = false;
                }, 10000);
            } else {
                this.isInitialGreeting = false;
            }
        }, 1500);
    }


    createWidget() {
        const widget = document.createElement('div');
        widget.id = 'study-mentor-widget';
        widget.className = 'fixed bottom-6 right-6 z-50';
        widget.innerHTML = `
            <!-- Floating Action Button -->
            <button id="mentor-fab" 
                class="relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full w-14 h-14 shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-110 flex items-center justify-center group">
                <span class="material-symbols-outlined text-2xl">psychology</span>
                <!-- Notification Badge -->
                <div id="mentor-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full animate-bounce"></div>
            </button>

            <!-- Teaser Message (Dynamic Theme) -->
            <div id="mentor-teaser" class="hidden absolute bottom-24 right-0 max-w-[320px] min-w-[220px] rounded-2xl overflow-visible mb-4 z-[60]">
                <!-- Outer Border Container -->
                <div id="teaser-border" class="relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500">
                    <!-- Theme Specific Decor Elements (Animated) -->
                    <div id="teaser-decor" class="absolute inset-0 pointer-events-none"></div>
                    
                    <!-- Inner Content -->
                    <div id="teaser-content" class="rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500">
                        <!-- Small Badge/Emoji Placeholder -->
                        <div id="teaser-emoji" class="absolute -top-3 -right-2 text-xl filter drop-shadow-md"></div>
                        
                        <span id="teaser-text" class="text-base font-extrabold text-white leading-tight drop-shadow-md"></span>
                    </div>
                </div>
            </div>

            <style>
                /* Champion Theme */
                .theme-champion-border { background: linear-gradient(135deg, #fcd34d, #eab308, #b45309); }
                .theme-champion-bg { background: linear-gradient(135deg, #7e22ce, #4338ca); }
                .champion-sweep { 
                    position: absolute; inset: 0; 
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    transform: skewX(-12deg);
                    animation: light-sweep 4s infinite ease-in-out;
                }

                /* Focus Theme */
                .theme-focus-border { background: linear-gradient(135deg, #60a5fa, #22d3ee, #3b82f6); box-shadow: 0 0 20px rgba(34, 211, 238, 0.4); }
                .theme-focus-bg { background: linear-gradient(135deg, #1e3a8a, #312e81); }
                .focus-pulse {
                    position: absolute; inset: 0;
                    border: 2px solid #22d3ee;
                    border-radius: 12px;
                    animation: energy-pulse 2s infinite;
                }

                /* Boss Theme */
                .theme-boss-border { background: linear-gradient(135deg, #dc2626, #9f1239, #be123c); }
                .theme-boss-bg { background: linear-gradient(135deg, #030712, #450a0a); }
                .boss-heartbeat { animation: heartbeat 1.5s infinite ease-in-out; }

                /* Animations */
                @keyframes light-sweep {
                    0% { transform: translateX(-200%) skewX(-12deg); }
                    30%, 100% { transform: translateX(200%) skewX(-12deg); }
                }
                
                @keyframes energy-pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 0.2; }
                    100% { transform: scale(1.1); opacity: 0; }
                }

                @keyframes heartbeat {
                    0%, 100% { transform: scale(1); filter: brightness(1); }
                    10%, 30% { transform: scale(1.05); filter: brightness(1.2); }
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .animate-float { animation: float 3s infinite ease-in-out; }

                @keyframes pulse-subtle {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.95; transform: scale(0.99); }
                }
                .animate-pulse-subtle { animation: pulse-subtle 2s infinite ease-in-out; }

                #teaser-text {
                    display: block;
                    word-wrap: break-word;
                    white-space: normal;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
            </style>

            <!-- Mentor Panel -->
            <div id="mentor-panel" 
                class="hidden absolute bottom-20 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                
                <!-- Header -->
                <div class="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined">psychology</span>
                            <h3 class="font-bold">AI Study Mentor</h3>
                        </div>
                        <button id="mentor-close" class="hover:bg-white/20 rounded-full p-1 transition-colors">
                            <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                    <p class="text-xs text-purple-100 mt-1">Your personalized study guide</p>
                </div>

                <!-- Content -->
                <div class="p-4 max-h-96 overflow-y-auto">
                    <div id="mentor-greeting" class="mb-4">
                        <div class="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                            <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
                            <div>
                                <p class="text-sm font-semibold text-gray-800">Hey there!</p>
                                <p class="text-xs text-gray-600 mt-1">Let me analyze your performance...</p>
                            </div>
                        </div>
                    </div>

                    <div id="mentor-recommendations" class="space-y-3">
                        <!-- Recommendations will be injected here -->
                    </div>

                    <!-- Quick Actions -->
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</p>
                        <div class="space-y-2">
                            <button onclick="window.loadPage('mistake-bank')" 
                                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                                <span class="material-symbols-outlined text-rose-500 text-lg">psychology</span>
                                <span>Review Mistake Bank</span>
                            </button>
                            <button onclick="window.loadPage('discipline-tracker')" 
                                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                                <span class="material-symbols-outlined text-blue-500 text-lg">analytics</span>
                                <span>View Full Analytics</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    attachEventListeners() {
        const fab = document.getElementById('mentor-fab');
        const closeBtn = document.getElementById('mentor-close');
        const panel = document.getElementById('mentor-panel');

        fab?.addEventListener('click', () => this.togglePanel());
        closeBtn?.addEventListener('click', () => this.closePanel());

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            const widget = document.getElementById('study-mentor-widget');
            if (this.isOpen && widget && !widget.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    togglePanel() {
        const panel = document.getElementById('mentor-panel');
        if (this.isOpen) {
            this.closePanel();
        } else {
            panel?.classList.remove('hidden');
            this.isOpen = true;
            // Always fetch fresh data when opening to reflect recent study sessions
            this.fetchMentorData();
        }
    }


    closePanel() {
        const panel = document.getElementById('mentor-panel');
        panel?.classList.add('hidden');
        this.isOpen = false;
    }

    async fetchMentorData() {
        try {
            const [trendsResponse, decksResponse] = await Promise.all([
                fetch('api/performance/mastery-trends.php'),
                fetch('api/flashcards/decks.php')
            ]);

            const trendsResult = await trendsResponse.json();
            const decksResult = await decksResponse.json();

            if (trendsResult.success && trendsResult.data) {
                this.mentorData = trendsResult.data;
                this.mentorData.flashcard_decks = decksResult.success ? decksResult.decks : [];
                this.mentorData.total_cards_due = decksResult.success ? decksResult.total_cards_due : 0;
                this.mentorData.activity_status = null; // Will be fetched separately

                // Fetch activity status separately (optional - won't break if it fails)
                this.fetchActivityStatus();

                this.renderRecommendations();
            }
        } catch (error) {
            console.error('Mentor data fetch error:', error);
        }
    }

    async fetchActivityStatus() {
        try {
            const response = await fetch('api/activity-status.php');
            const result = await response.json();
            if (result.success && this.mentorData) {
                this.mentorData.activity_status = result;
                // Re-render to show nudge if inactive
                this.renderRecommendations();
            }
        } catch (error) {
            console.log('Activity status not available (this is optional)');
        }
    }

    generateNudgeMessage() {
        const activity = this.mentorData.activity_status;
        if (!activity || !activity.is_inactive) return null;

        const { minutes_since_last_exam, inactivity_level, streak_at_risk, current_hour } = activity;
        const { mentor_advice, total_exams } = this.mentorData;

        // Priority 0: Brand New User
        if (total_exams === 0 || inactivity_level === 'new_user') {
            return {
                icon: '👋',
                title: 'Welcome!',
                message: 'Ready to start your first exam? I\'ll guide you from here.',
                action: 'Take My First Exam',
                link: 'take-exam-list'
            };
        }

        // Priority 1: Streak at risk
        if (streak_at_risk) {
            return {
                icon: '🔥',
                title: 'Streak Alert!',
                message: 'Your streak is at risk! Just one quick exam keeps it alive.',
                action: 'Save My Streak',
                link: 'take-exam-list'
            };
        }

        // Priority 2: Long inactivity + weak subject
        if (inactivity_level === 'moderate' || inactivity_level === 'high') {
            if (mentor_advice && mentor_advice.length > 0) {
                const weakSubject = mentor_advice[0];
                const hours = Math.floor(minutes_since_last_exam / 60);
                return {
                    icon: '💪',
                    title: 'Let\'s Improve!',
                    message: `It's been ${hours} hour${hours > 1 ? 's' : ''}! Your ${weakSubject.subject} needs work.`,
                    action: `Practice ${weakSubject.subject}`,
                    link: 'take-exam-list'
                };
            }
        }

        // Priority 3: Time-based messages
        const timeMessages = {
            morning: ['Good morning! Start your day with a win. 🌅', 'Early bird gets the knowledge!'],
            afternoon: ['Afternoon slump? A quick quiz energizes the mind!', 'Perfect time for focused study!'],
            evening: ['Evening study session? Let\'s make it count!', 'End your day strong!'],
            night: ['Night owl mode! Quick quiz before bed?', 'Last chance to study today! 🌙']
        };

        let timeOfDay = 'afternoon';
        if (current_hour >= 6 && current_hour < 12) timeOfDay = 'morning';
        else if (current_hour >= 18 && current_hour < 22) timeOfDay = 'evening';
        else if (current_hour >= 22 || current_hour < 6) timeOfDay = 'night';

        const messages = timeMessages[timeOfDay];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        // Different messages based on inactivity level
        if (inactivity_level === 'critical') {
            return {
                icon: '🎯',
                title: 'Welcome Back!',
                message: 'Your comeback starts with one exam. Let\'s do this!',
                action: 'Start Now',
                link: 'take-exam-list'
            };
        } else if (inactivity_level === 'high') {
            return {
                icon: '⏰',
                title: 'Study Nudge',
                message: 'Long break! Let\'s ease back in with a quick quiz.',
                action: 'Start Quiz',
                link: 'take-exam-list'
            };
        } else {
            return {
                icon: '⏰',
                title: 'Study Nudge',
                message: randomMessage,
                action: 'Start Quick Quiz',
                link: 'take-exam-list'
            };
        }
    }

    startTimeBasedNudges() {
        const earlyMessages = [
            "পড় সোহান পড়, দেখায় দে তুই কি!",
            "বাপের স্বপ্ন পূরণ করতেই হবে সোহান!",
            "আজকের দিনটা কাজে লাগা, কালকের দিনটা তোর হবে।",
            "থামা যাবে না, লক্ষ্য এখন অনেক দূরে!",
            "সোহান, তুই পারবি, তোর মধ্যে সেই আগুন আছে!"
        ];

        const lateMessages = [
            "সময় শেষ হয়ে যাচ্ছে, সবাই পড়ছে!",
            "এখনো সময় আছে, একটু জোর দে সোহান!",
            "ক্লান্ত হলে চলবে না, সফলতা দরজায় কড়া নাড়ছে।",
            "শেষ মুহূর্তের পড়াটাই আসল, হাল ছাড়িস না!",
            "সোহান, আজকের টার্গেট শেষ করেই ঘুাবি।"
        ];

        const getTimeRemainingStr = () => {
            const now = new Date();
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            const diff = midnight.getTime() - now.getTime();

            if (diff <= 0) return "";

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            let timeStr = "আর বাকি ";
            if (hours > 0) {
                timeStr += `${this.toBengaliNumber(hours)} ঘণ্টা `;
            }
            if (minutes > 0 || hours === 0) {
                timeStr += `${this.toBengaliNumber(minutes)} মিনিট`;
            }
            return timeStr;
        };

        const getDailyStatusMessage = () => {
            if (!this.mentorData || !this.mentorData.daily_stats) return null;
            const stats = this.mentorData.daily_stats;

            // 1. Specific Exams created but not yet taken today
            if (stats.uncompleted_exams && stats.uncompleted_exams.length > 0) {
                const exam = stats.uncompleted_exams[0]; // Pick the first one
                return `Sohan, the exam '${exam.title}' you created for ${exam.subject} today hasn't been taken yet. Let's finish it!`;
            }

            // 2. No activity today for a subject
            if (stats.subjects_no_activity && stats.subjects_no_activity.length > 0) {
                // Pick a random subject from those with no activity
                const randomSubj = stats.subjects_no_activity[Math.floor(Math.random() * stats.subjects_no_activity.length)];
                return `Sohan, no exam has been created for ${randomSubj.name} yet today. Let's start!`;
            }

            return null;
        };

        const showNudge = () => {
            if (this.isOpen || this.isInitialGreeting) return;

            const now = new Date();
            const currentHour = now.getHours();

            // Decide whether to show a daily status message or a motivational one
            const statusMsg = getDailyStatusMessage();
            let randomMsg;
            let isStatusMessage = false;

            if (statusMsg && Math.random() < 0.4) {
                randomMsg = statusMsg;
                isStatusMessage = true;
            } else {
                // Choose range based on time
                const messages = currentHour >= 20 || currentHour < 5 ? lateMessages : earlyMessages;

                // Randomize message
                let nextIndex;
                do {
                    nextIndex = Math.floor(Math.random() * messages.length);
                } while (nextIndex === this.lastMessageIndex && messages.length > 1);

                this.lastMessageIndex = nextIndex;
                randomMsg = messages[nextIndex];
            }

            const timeRemaining = getTimeRemainingStr();

            // Randomize Theme
            const themes = ['champion', 'focus', 'boss'];
            const theme = themes[Math.floor(Math.random() * themes.length)];

            const teaser = document.getElementById('mentor-teaser');
            const teaserBorder = document.getElementById('teaser-border');
            const teaserContent = document.getElementById('teaser-content');
            const teaserDecor = document.getElementById('teaser-decor');
            const teaserEmoji = document.getElementById('teaser-emoji');
            const teaserText = document.getElementById('teaser-text');
            const badge = document.getElementById('mentor-badge');

            if (teaser && teaserText) {
                this.isMotivationalNudgeActive = true;

                // For status messages, maybe override the theme to something distinct? 
                // Let's keep the random theme for variety but maybe force 'focus' for status?
                const nudgeTheme = isStatusMessage ? 'focus' : theme;

                // Clear and Apply Theme Classes
                teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-${nudgeTheme}-border`;
                teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-${nudgeTheme}-bg`;
                teaser.classList.add('animate-float');

                // Apply Decorations
                teaserDecor.innerHTML = '';
                if (nudgeTheme === 'champion') {
                    teaserDecor.innerHTML = '<div class="champion-sweep"></div>';
                    teaserEmoji.innerText = '🏆';
                } else if (nudgeTheme === 'focus') {
                    teaserDecor.innerHTML = '<div class="focus-pulse"></div>';
                    teaserEmoji.innerText = '⚡';
                } else if (nudgeTheme === 'boss') {
                    teaserBorder.classList.add('boss-heartbeat');
                    teaserEmoji.innerText = '💪';
                }

                teaserText.textContent = isStatusMessage ? randomMsg : `${randomMsg} ${timeRemaining}`;
                teaser.classList.remove('hidden');
                badge?.classList.remove('hidden');

                // Auto-hide after 15 seconds
                setTimeout(() => {
                    teaser.classList.add('hidden');
                    teaser.classList.remove('animate-float');
                    this.isMotivationalNudgeActive = false;
                }, 15000);
            }
        };

        // Every 1 minute (60,000 ms)
        setInterval(showNudge, 60000);
    }

    toBengaliNumber(n) {
        const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return n.toString().split('').map(digit => bengaliDigits[parseInt(digit)] || digit).join('');
    }

    renderRecommendations() {
        const container = document.getElementById('mentor-recommendations');
        const greeting = document.getElementById('mentor-greeting');

        if (!this.mentorData || !container) return;

        const { mentor_advice, insights, subjects } = this.mentorData;

        // Update greeting based on overall performance
        const activeSubjects = subjects.filter(s => s.this_week !== null);
        const avgAccuracy = activeSubjects.length > 0
            ? activeSubjects.reduce((sum, s) => sum + s.this_week, 0) / activeSubjects.length
            : null;

        let greetingMsg = '';

        if (avgAccuracy === null) {
            greetingMsg = "I'm ready to help you excel! Start by taking an exam or reviewing flashcards.";
        } else if (avgAccuracy >= 80) {
            greetingMsg = "You're doing amazing! 🎉 Keep up the excellent work.";
        } else if (avgAccuracy >= 60) {
            greetingMsg = "Good progress! Let's focus on a few areas to boost your scores.";
        } else {
            greetingMsg = "Let's work together to improve your performance!";
        }

        greeting.innerHTML = `
            <div class="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
                <div>
                    <p class="text-sm font-semibold text-gray-800">Hey there!</p>
                    <p class="text-xs text-gray-600 mt-1">${greetingMsg}</p>
                </div>
            </div>
        `;

        // Render specific recommendations
        let recommendationsHTML = '';

        // --- NEW: Daily Due Cards ---
        const dailyStats = this.mentorData.daily_stats;
        if (dailyStats) {
            const { uncompleted_exams, subjects_no_activity } = dailyStats;

            if ((uncompleted_exams && uncompleted_exams.length > 0) || (subjects_no_activity && subjects_no_activity.length > 0)) {
                recommendationsHTML += `
                <div class="mb-4">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Daily Targets</p>
                    <div class="space-y-3">
                        ${(uncompleted_exams || []).slice(0, 3).map(exam => `
                            <div class="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl shadow-sm animate-pulse-subtle">
                                <div class="flex items-start gap-3">
                                    <div class="bg-orange-100 p-2 rounded-lg">
                                        <span class="material-symbols-outlined text-orange-600 text-xl">pending_actions</span>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-xs font-black text-orange-900 uppercase tracking-tighter">${exam.subject}</p>
                                        <p class="text-sm font-medium text-gray-800 mt-1">
                                            Sohan, the exam <strong>'${exam.title}'</strong> you created for <strong>${exam.subject}</strong> today hasn't been taken yet. Let's finish it!
                                        </p>
                                        <button onclick="window.loadPage('take-exam-interface', '?exam_id=${exam.id}')" class="mt-3 text-xs font-bold text-orange-600 flex items-center gap-1 hover:underline">
                                            Finish Now <span class="material-symbols-outlined text-xs">arrow_forward</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                        
                        ${(subjects_no_activity || []).slice(0, 2).map(subj => `
                            <div class="bg-blue-50 border-2 border-blue-200 p-4 rounded-2xl shadow-sm">
                                <div class="flex items-start gap-3">
                                    <div class="bg-blue-100 p-2 rounded-lg">
                                        <span class="material-symbols-outlined text-blue-600 text-xl">edit_calendar</span>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-xs font-black text-blue-900 uppercase tracking-tighter">${subj.name}</p>
                                        <p class="text-sm font-medium text-gray-800 mt-1">
                                            Sohan, no exam has been created for <strong>${subj.name}</strong> yet today. Let's start!
                                        </p>
                                        <button onclick="window.location.href='https://bcspreli.free.nf/?page=exam'" class="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                            Create Exam <span class="material-symbols-outlined text-xs">add_circle</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            }
        }

        if (mentor_advice && mentor_advice.length > 0) {
            recommendationsHTML += mentor_advice.map(advice => {
                const priorityColor = advice.priority === 'high' ? 'red' : 'amber';
                const priorityIcon = advice.priority === 'high' ? 'priority_high' : 'flag';

                return `
                <div class="bg-${priorityColor}-50 border border-${priorityColor}-200 p-3 rounded-xl mb-3 last:mb-0">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-${priorityColor}-600 text-lg">${priorityIcon}</span>
                        <div class="flex-1">
                            <p class="text-xs font-bold text-${priorityColor}-900 uppercase tracking-wider">${advice.subject}</p>
                            <p class="text-sm text-gray-700 mt-1">
                                Focus on <strong>${advice.weak_topic}</strong> 
                                <span class="text-xs text-gray-500">(${advice.topic_accuracy}% accuracy)</span>
                            </p>
                            <p class="text-xs text-gray-600 mt-2">
                                💡 I recommend doing 15-20 questions from this topic today.
                            </p>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        if (recommendationsHTML) {
            container.innerHTML = recommendationsHTML;
        } else if (insights && insights.length > 0) {
            // Fallback to general insights if no specific topic advice
            container.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                    <p class="text-sm text-gray-700">${insights[0].message}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center py-6 text-gray-400">
                    <span class="material-symbols-outlined text-3xl mb-2 opacity-20">verified</span>
                    <p class="text-sm">You're performing well across all subjects!</p>
                </div>
            `;
        }

        // Add flashcard deck recommendations
        const { flashcard_decks, total_cards_due } = this.mentorData;
        if (flashcard_decks && flashcard_decks.length > 0 && total_cards_due > 0) {
            const topDecks = flashcard_decks.filter(d => d.cards_due > 0).slice(0, 2);
            if (topDecks.length > 0) {
                container.innerHTML += `
                    <div class="bg-purple-50 border border-purple-200 p-3 rounded-xl mt-3">
                        <div class="flex items-start gap-2">
                            <span class="material-symbols-outlined text-purple-600 text-lg">style</span>
                            <div class="flex-1">
                                <p class="text-xs font-bold text-purple-900 uppercase tracking-wider mb-2">Flashcards Ready</p>
                                ${topDecks.map(deck => `
                                    <div class="mb-2 last:mb-0">
                                        <p class="text-sm text-gray-700">
                                            <strong>${deck.topic}</strong> 
                                            <span class="text-xs text-gray-500">(${deck.cards_due} cards due)</span>
                                        </p>
                                    </div>
                                `).join('')}
                                <button onclick="window.loadPage('flashcards')" 
                                    class="mt-2 text-xs font-bold text-purple-600 hover:text-purple-700 hover:underline">
                                    Review Now →
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // Add study nudge if user is inactive
        const nudge = this.generateNudgeMessage();
        if (nudge) {
            container.innerHTML += `
                <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-3 rounded-xl mt-3">
                    <div class="flex items-start gap-2">
                        <span class="text-2xl">${nudge.icon}</span>
                        <div class="flex-1">
                            <p class="text-xs font-bold text-orange-900 uppercase tracking-wider">${nudge.title}</p>
                            <p class="text-sm text-gray-700 mt-1">${nudge.message}</p>
                            <button onclick="window.loadPage('${nudge.link}')" 
                                class="mt-2 px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors">
                                ${nudge.action} →
                            </button>
                </div>
            `;
        }

        // Handle Badge and Teaser Visibility
        const badge = document.getElementById('mentor-badge');
        const teaser = document.getElementById('mentor-teaser');
        const teaserText = document.getElementById('teaser-text');

        // Don't overwrite higher priority greetings or active motivational nudges
        if (this.isInitialGreeting || this.isMotivationalNudgeActive) return;

        if (nudge && !this.isOpen) {
            badge?.classList.remove('hidden');
            teaser?.classList.remove('hidden');
            if (teaserText) teaserText.innerText = nudge.message;

            // Auto-hide teaser after 8 seconds
            setTimeout(() => teaser?.classList.add('hidden'), 8000);
        } else {
            badge?.classList.add('hidden');
            teaser?.classList.add('hidden');
        }
    }

}

// Initialize mentor when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new StudyMentor());
} else {
    new StudyMentor();
}
