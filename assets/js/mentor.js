// FILE: assets/js/mentor.js
// AI Study Mentor - Contextual Study Guide

class StudyMentor {
    constructor() {
        this.isOpen = false;
        this.mentorData = null;
        this.isInitialGreeting = false;
        this.isMotivationalNudgeActive = false;
        this.lastMessageIndex = -1;
        this.focusSession = {
            isActive: false,
            timeRemaining: 25 * 60, // 25 minutes in seconds
            subject: null,
            intervalId: null
        };
        this.breakSession = {
            isActive: false,
            timeRemaining: 5 * 60, // 5 minutes in seconds
            intervalId: null,
            currentActivity: null
        };
        this.countdownRefreshInterval = null; // For Boss Challenge countdown updates
        this.init();
    }

    init() {
        window.studyMentor = this; // Expose for onclick handlers
        // Request notification permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        this.createWidget();
        this.attachEventListeners();
        this.fetchMentorData();
        this.showWelcomeGreeting();
        this.startTimeBasedNudges();
        this.injectPressureCSS();
    }

    injectPressureCSS() {
        if (document.getElementById('boss-pressure-css')) return;
        const style = document.createElement('style');
        style.id = 'boss-pressure-css';
        style.innerHTML = `
            @keyframes blood-pulse {
                0%, 100% { border-color: rgba(220, 38, 38, 0.3); box-shadow: 0 0 15px rgba(220, 38, 38, 0.2); }
                50% { border-color: rgba(220, 38, 38, 0.8); box-shadow: 0 0 30px rgba(220, 38, 38, 0.5); }
            }
            @keyframes pressure-glitch {
                0% { transform: translate(0); text-shadow: none; }
                20% { transform: translate(-1px, 1px); text-shadow: 1px 0 #ef4444; }
                40% { transform: translate(-1px, -1px); text-shadow: -1px 0 #991b1b; }
                60% { transform: translate(1px, 1px); }
                80% { transform: translate(1px, -1px); }
                100% { transform: translate(0); }
            }
            .boss-pressure-card {
                animation: blood-pulse 2s infinite ease-in-out !important;
                background: linear-gradient(to bottom right, #0f172a, #450a0a) !important;
                border-width: 2px !important;
            }
            .pressure-glitch-text {
                animation: pressure-glitch 0.3s infinite linear alternate-reverse;
                color: #ef4444 !important;
            }
        `;
        document.head.appendChild(style);
    }

    isFocusModeActive() {
        const params = new URLSearchParams(window.location.search);
        return params.get('page') === 'take-exam-interface' || this.focusSession.isActive || this.breakSession.isActive;
    }

    startFocusSession(subject) {
        if (this.focusSession.isActive) return;

        this.focusSession.isActive = true;
        this.focusSession.subject = subject;
        this.focusSession.timeRemaining = 25 * 60;
        this.closePanel();

        // Show intense Bos Mode Nudge to start
        this.showFocusTeaser();

        this.focusSession.intervalId = setInterval(() => {
            this.focusSession.timeRemaining--;
            this.updateFocusUI();

            // 5-Minute Warning
            if (this.focusSession.timeRemaining === 300) { // 300 seconds = 5 minutes
                this.sendNotification("AI Mentor: Focus Check", `5 minutes left! Finish strong, Sohan. You're crushing ${this.focusSession.subject}!`);
            }

            if (this.focusSession.timeRemaining <= 0) {
                this.completeFocusSession();
            }
        }, 1000);
    }

    updateFocusUI() {
        const teaserText = document.getElementById('teaser-text');
        const badge = document.getElementById('mentor-badge');
        const teaser = document.getElementById('mentor-teaser');

        if (teaser && teaserText) {
            const minutes = Math.floor(this.focusSession.timeRemaining / 60);
            const seconds = this.focusSession.timeRemaining % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            teaser.classList.remove('hidden');
            badge?.classList.remove('hidden');

            // Force Boss Theme Visuals for Timer
            this.applyTimerTheme();

            teaserText.innerHTML = `
                <div class="flex flex-col items-center">
                    <span class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Focusing: ${this.focusSession.subject}</span>
                    <span class="text-3xl font-black">${timeStr}</span>
                    <button onclick="studyMentor.stopFocusSession()" class="mt-2 text-[8px] font-bold text-gray-400 hover:text-white uppercase tracking-tighter">Cancel Session</button>
                </div>
            `;
        }
    }

    applyTimerTheme() {
        const teaserBorder = document.getElementById('teaser-border');
        const teaserContent = document.getElementById('teaser-content');
        const teaserDecor = document.getElementById('teaser-decor');
        const teaserEmoji = document.getElementById('teaser-emoji');

        if (teaserBorder) teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-boss-border boss-heartbeat`;
        if (teaserContent) teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-boss-bg`;
        if (teaserDecor) teaserDecor.innerHTML = '<div class="boss-heartbeat"></div>';
        if (teaserEmoji) teaserEmoji.innerText = '⏱️';
    }

    showFocusTeaser() {
        // Initial "GO!" message
        const teaser = document.getElementById('mentor-teaser');
        if (teaser) teaser.classList.remove('hidden');
    }

    showCustomNudge({ title, message, icon = '🎯', theme = 'boss' }) {
        const teaser = document.getElementById('mentor-teaser');
        const teaserBorder = document.getElementById('teaser-border');
        const teaserContent = document.getElementById('teaser-content');
        const teaserDecor = document.getElementById('teaser-decor');
        const teaserEmoji = document.getElementById('teaser-emoji');
        const teaserText = document.getElementById('teaser-text');
        const badge = document.getElementById('mentor-badge');

        if (teaser && teaserText) {
            // Apply theme
            teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-${theme}-border`;
            teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-${theme}-bg`;

            // Set emoji and text
            if (teaserEmoji) teaserEmoji.innerText = icon;
            teaserText.innerHTML = `
                <div class="text-center">
                    <p class="text-xs font-black uppercase text-yellow-400 mb-1">${title}</p>
                    <p class="text-sm font-bold">${message}</p>
                </div>
            `;

            // Show teaser
            teaser.classList.remove('hidden');
            badge?.classList.remove('hidden');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                teaser.classList.add('hidden');
            }, 5000);
        }
    }

    completeFocusSession() {
        clearInterval(this.focusSession.intervalId);
        const completedSubject = this.focusSession.subject || "General Focus";
        this.focusSession.isActive = false;

        // Log completion to backend
        console.log('Logging session for:', completedSubject);
        fetch('api/log-activity.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'pomodoro_session',
                message: completedSubject,
                details: { duration: 25, timestamp: new Date().toISOString() }
            })
        })
            .then(response => response.json())
            .then(data => {
                console.log('Session log response:', data);
                if (data.success) {
                    this.fetchMentorData(); // Refresh to update counts
                } else {
                    console.error('Session log failed:', data.error);
                }
            })
            .catch(err => console.error('Session log network error:', err));

        // Celebrate!
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        // Notification
        this.sendNotification("AI Mentor: Session Complete", `Victory! 25 minutes of ${completedSubject} completed.`);

        const teaserText = document.getElementById('teaser-text');
        if (teaserText) {
            teaserText.innerHTML = `
                <div class="text-center">
                    <p class="text-xs font-black uppercase text-yellow-400 mb-1">VICTORY!</p>
                    <p class="text-sm font-bold">Sohan, you dominated ${this.focusSession.subject}! 25 minutes of pure focus.</p>
                    <p class="text-[10px] mt-2 opacity-80">TIME FOR REST!</p>
                </div>
            `;
        }

        // Wait 5 seconds for victory celebration, then start break
        setTimeout(() => {
            this.startBreakSession();
        }, 5000);
    }

    stopFocusSession() {
        clearInterval(this.focusSession.intervalId);
        clearInterval(this.breakSession.intervalId);
        this.focusSession.isActive = false;
        this.breakSession.isActive = false;
        const teaser = document.getElementById('mentor-teaser');
        if (teaser) teaser.classList.add('hidden');
    }

    startBreakSession() {
        if (this.breakSession.isActive) return;

        const activities = [
            { text: "Drink a full glass of water and stretch your back. I'll wait for you.", emoji: "💧" },
            { text: "Close your eyes for 2 minutes. Your brain needs to digest what you just learned.", emoji: "🧘‍♂️" },
            { text: "Look at something 20 feet away for 20 seconds. Save your eyes!", emoji: "👀" },
            { text: "Take 5 deep breaths. Inhale the dream, exhale the stress.", emoji: "🌬️" }
        ];

        this.breakSession.isActive = true;
        this.breakSession.timeRemaining = 5 * 60;
        this.breakSession.currentActivity = activities[Math.floor(Math.random() * activities.length)];

        this.updateBreakUI();

        this.breakSession.intervalId = setInterval(() => {
            this.breakSession.timeRemaining--;
            this.updateBreakUI();

            if (this.breakSession.timeRemaining <= 0) {
                this.sendNotification("AI Mentor: Break Over", "Time to get back to work! Let's go.");
                this.stopFocusSession();
                // Show a final "Back to work" nudge
                this.showWelcomeGreeting();
            }
        }, 1000);
    }

    updateBreakUI() {
        const teaserText = document.getElementById('teaser-text');
        const teaser = document.getElementById('mentor-teaser');
        const badge = document.getElementById('mentor-badge');

        if (teaser && teaserText) {
            const minutes = Math.floor(this.breakSession.timeRemaining / 60);
            const seconds = this.breakSession.timeRemaining % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            teaser.classList.remove('hidden');
            badge?.classList.remove('hidden');

            this.applyBreakTheme();

            teaserText.innerHTML = `
                <div class="flex flex-col items-center">
                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1">Health Coach: Break Time</span>
                    <span class="text-xs font-bold leading-tight mb-2">${this.breakSession.currentActivity.text}</span>
                    <span class="text-2xl font-black text-white">${timeStr}</span>
                    <button onclick="studyMentor.stopFocusSession()" class="mt-2 text-[8px] font-bold text-gray-400 hover:text-white uppercase tracking-tighter">Skip Break</button>
                </div>
            `;
        }
    }

    applyBreakTheme() {
        const teaserBorder = document.getElementById('teaser-border');
        const teaserContent = document.getElementById('teaser-content');
        const teaserDecor = document.getElementById('teaser-decor');
        const teaserEmoji = document.getElementById('teaser-emoji');

        if (teaserBorder) teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-focus-border`;
        if (teaserContent) teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-focus-bg`;
        if (teaserDecor) teaserDecor.innerHTML = '<div class="focus-pulse"></div>';
        if (teaserEmoji) teaserEmoji.innerText = this.breakSession.currentActivity.emoji;
    }

    showWelcomeGreeting() {
        // --- NEW: Yesterday Failure Check ---
        if (this.mentorData?.boss_challenge?.status?.failed_yesterday) {
            this.showNudge({
                title: "MISSION FAILED",
                message: "You failed yesterday's mission, Sohan. No excuses today. GET TO WORK.",
                icon: "👿",
                theme: "boss"
            });
            return;
        }

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

                @keyframes widget-heartbeat {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(220, 38, 38, 0)); }
                    50% { transform: scale(1.02); filter: drop-shadow(0 0 15px rgba(220, 38, 38, 0.5)); }
                }
                .strict-mode-pulse { animation: widget-heartbeat 1.5s infinite ease-in-out !important; }

                #teaser-text {
                    display: block;
                    word-wrap: break-word;
                    white-space: normal;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #c7d2fe;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #818cf8;
                }
            </style>

            <!-- Mentor Panel -->
        <div id="mentor-panel" 
            class="hidden absolute bottom-20 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300">
            
            <!-- Header with Discipline Ring -->
            <div id="mentor-header" class="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="relative w-12 h-12 flex items-center justify-center">
                            <svg class="w-full h-full transform -rotate-90">
                                <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="transparent" />
                                <circle id="discipline-ring-inner" cx="24" cy="24" r="20" stroke="white" stroke-width="4" fill="transparent" 
                                    stroke-dasharray="125.6" stroke-dashoffset="125.6" stroke-linecap="round" class="transition-all duration-1000" />
                            </svg>
                            <span id="discipline-ring-text" class="absolute text-[10px] font-bold">0%</span>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm flex items-center gap-1">
                                <span class="material-symbols-outlined text-lg">psychology</span>
                                AI Study Mentor
                            </h3>
                            <p class="text-[9px] text-purple-100 uppercase tracking-widest opacity-80">Daily coverage</p>
                        </div>
                    </div>
                    
                    <button id="mentor-close" class="hover:bg-white/20 rounded-full p-1 transition-colors">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
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

    async acceptChallenge() {
        try {
            const response = await fetch('api/challenge/manage.php?action=accept');
            const result = await response.json();
            if (result.success) {
                // Refresh data to show accepted state
                await this.fetchMentorData();
                this.showNudge({
                    title: "MISSION ACCEPTED",
                    message: "Good Choice, Sohan. Don't let me down. I'll be watching every move.",
                    icon: "💀",
                    theme: "boss"
                });
            }
        } catch (error) {
            console.error('Failed to accept challenge:', error);
        }
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


    async toggleExamCompletion(examId, isChecked) {
        try {
            // Optimistic Update? Ideally. But let's fetch to be safe to update progress bars correctly.
            // Or better: call API, then fetch.
            const response = await fetch('api/exam/toggle-manual-completion.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId })
            });
            const result = await response.json();

            if (result.success) {
                // Refresh data to update progress bars and mission status
                await this.fetchMentorData();
            } else {
                console.error('Failed to toggle completion:', result.error);
                // Revert UI if needed (though we are re-fetching anyway)
                alert('Failed to update status. Please try again.');
                // Helper to revert checkbox if we didn't re-fetch
                const checkbox = document.getElementById(`manual-check-${examId}`);
                if (checkbox) checkbox.checked = !isChecked;
            }
        } catch (error) {
            console.error('Error toggling exam completion:', error);
            const checkbox = document.getElementById(`manual-check-${examId}`);
            if (checkbox) checkbox.checked = !isChecked;
        }
    }

    closePanel() {
        const panel = document.getElementById('mentor-panel');
        panel?.classList.add('hidden');
        this.isOpen = false;
    }

    sendNotification(title, body) {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            new Notification(title, { body: body, icon: 'assets/img/icon.png' });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body: body, icon: 'assets/img/icon.png' });
                }
            });
        }
    }

    async fetchMentorData() {
        try {
            const [trendsResponse, decksResponse, yesterdayResponse] = await Promise.all([
                fetch('api/performance/mastery-trends.php'),
                fetch('api/flashcards/decks.php'),
                fetch('api/revision/get-yesterday-exams.php')
            ]);

            const trendsResult = await trendsResponse.json();
            const decksResult = await decksResponse.json();
            const yesterdayResult = await yesterdayResponse.json();

            if (trendsResult.success && trendsResult.data) {
                this.mentorData = trendsResult.data;
                this.mentorData.flashcard_decks = decksResult.success ? decksResult.decks : [];
                this.mentorData.total_cards_due = decksResult.success ? decksResult.total_cards_due : 0;
                this.mentorData.yesterday_exams = yesterdayResult.success ? yesterdayResult.data.yesterday_exams : [];
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

        const { mentor_advice, total_exams, recent_sessions, morning_roadmap, subjects } = this.mentorData;

        // --- NEW: Cognitive Fatigue Check (High Priority) ---
        const fatigueSuggestion = this.detectFatigue(recent_sessions);
        if (fatigueSuggestion) {
            return {
                icon: '🧠',
                title: 'Cognitive Fatigue!',
                message: fatigueSuggestion.message,
                action: fatigueSuggestion.action,
                link: 'take-exam-list' // Or focus session?
            };
        }

        const { minutes_since_last_exam, inactivity_level, streak_at_risk, current_hour } = activity;

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

    detectFatigue(sessions) {
        if (!sessions || sessions.length < 3) return null;

        // Check if last 3 sessions are the same
        const lastThree = sessions.slice(0, 3);
        const subject = lastThree[0];

        if (lastThree.every(s => s === subject)) {
            // Find a different subject to suggest
            const otherSubjects = (this.mentorData.subjects || []).filter(s => s.name !== subject);
            const roadmapSubjects = (this.mentorData.morning_roadmap || []).filter(r => r.subject !== subject);

            let suggestion = "a different topic";
            if (roadmapSubjects.length > 0) {
                suggestion = roadmapSubjects[0].subject;
            } else if (otherSubjects.length > 0) {
                suggestion = otherSubjects[Math.floor(Math.random() * otherSubjects.length)].name;
            }

            return {
                message: `Sohan, you've done 75 mins of ${subject}. Your brain is melting! Switch to <strong>${suggestion}</strong> for one session to stay sharp!`,
                action: `Switch to ${suggestion}`
            };
        }
        return null;
    }

    checkMissionProgressAndNotify() {
        if (!this.mentorData || !this.mentorData.subjects) return;

        const subjects = this.mentorData.subjects;
        const missionRoadmap = subjects.map(subj => {
            const todayExams = subj.today_exams || [];
            const isCreated = todayExams.length > 0;
            const completedCount = todayExams.filter(exam => exam.is_completed).length;
            const isTaken = isCreated && (completedCount === todayExams.length);
            return { isCreated, isTaken };
        });

        const totalSubjects = missionRoadmap.length;
        const completedSubjects = missionRoadmap.filter(m => m.isTaken).length;
        const remaining = totalSubjects - completedSubjects;

        if (remaining > 0) {
            if (Notification.permission === "granted") {
                new Notification("AI Study Mentor", {
                    body: `Sohan, you have ${remaining} subject missions left to complete! Stay focused.`,
                });
            }
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
            const challengeStatus = this.mentorData?.boss_challenge?.status;
            if (this.isOpen || this.isInitialGreeting || this.isFocusModeActive()) {
                // If focus mode is active, make sure any existing teaser is hidden
                if (this.isFocusModeActive()) {
                    const teaser = document.getElementById('mentor-teaser');
                    if (teaser) teaser.classList.add('hidden');
                    this.isMotivationalNudgeActive = false;
                }
                return;
            }

            const now = new Date();
            const currentHour = now.getHours();

            // Decide whether to show a daily status message or a motivational one
            const statusMsg = getDailyStatusMessage();
            let randomMsg;
            let isStatusMessage = false;
            let isStrictBossMode = false;

            // BOSS ACCOUNTABILITY (Strict Mode Logic)
            if (currentHour >= 15 && (this.currentDailyCoverage || 0) < 50) {
                isStrictBossMode = true;
                isStatusMessage = true;
                const bossMessages = [
                    "Sohan, mortality is approaching! Finish your targets!",
                    "Everyone else is studying, and you're falling behind. GET TO WORK!",
                    "You want the dream? Then EARN IT. No more excuses tonight!",
                    "Is this the effort of a champion? I don't think so. Finish your exams!"
                ];
                randomMsg = bossMessages[Math.floor(Math.random() * bossMessages.length)];
            } else if (statusMsg && Math.random() < 0.4) {
                randomMsg = statusMsg;
                isStatusMessage = true;
            } else {
                // Choose range based on time
                const messages = currentHour >= 15 || currentHour < 5 ? lateMessages : earlyMessages;

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
            const widgetContent = document.getElementById('study-mentor-widget');

            if (teaser && teaserText) {
                this.isMotivationalNudgeActive = true;

                // Decide theme based on state
                let nudgeTheme = theme;
                if (isStrictBossMode || challengeStatus?.failed_yesterday) {
                    nudgeTheme = 'boss';
                } else if (challengeStatus?.is_champion) {
                    nudgeTheme = 'champion';
                } else if (isStatusMessage) {
                    nudgeTheme = 'focus';
                }

                if (nudgeTheme === 'boss') {
                    widgetContent?.classList.add('strict-mode-pulse');
                    if (teaserEmoji) teaserEmoji.innerText = '👿';
                    teaserText.innerHTML = `<span class="bg-red-600 text-[8px] font-black px-1.5 py-0.5 rounded-full inline-block mb-1 animate-pulse">${isStrictBossMode ? 'STRICT MODE' : 'MISSION FAILED'}</span><br>${randomMsg} ${timeRemaining}`;
                } else {
                    widgetContent?.classList.remove('strict-mode-pulse');
                }

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
                    if (!isStrictBossMode && !challengeStatus?.failed_yesterday) {
                        teaserEmoji.innerText = '💪';
                    }
                }

                // Set teaser text, respecting special innerHTML for boss
                if (nudgeTheme !== 'boss') {
                    teaserText.textContent = isStatusMessage ? randomMsg : `${randomMsg} ${timeRemaining}`;
                }

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

        // Every 1 hour (3600000 ms)
        setInterval(() => {
            showNudge();
            this.checkMissionProgressAndNotify();
        }, 3600000);
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

        let recommendationsHTML = '';

        // --- BOSS CHALLENGE CARD ---
        const challenge = this.mentorData.boss_challenge;

        // Clear existing countdown refresh interval
        if (this.countdownRefreshInterval) {
            clearInterval(this.countdownRefreshInterval);
        }

        // Set up auto-refresh for countdown (every 60 seconds) if challenge is active
        if (challenge && challenge.active && this.isOpen) {
            this.countdownRefreshInterval = setInterval(() => {
                if (this.isOpen) {
                    this.renderRecommendations(); // Re-render to update countdown
                }
            }, 60000); // 60 seconds
        }
        if (challenge && challenge.active) {
            const { exams: targetExams, sessions: targetSessions, deadline, is_accepted } = challenge.active;
            const { exams: currentExams, sessions: currentSessions } = challenge.progress;
            const isSuccess = currentExams >= targetExams && currentSessions >= targetSessions;

            // Calculate time remaining until deadline
            const now = new Date();
            const deadlineTime = new Date();
            deadlineTime.setHours(21, 0, 0, 0); // 9 PM

            const msRemaining = deadlineTime - now;
            const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

            // Urgency levels
            const isUrgent = hoursRemaining < 2; // Less than 2 hours
            const isCritical = hoursRemaining < 1; // Less than 1 hour
            const timeExpired = msRemaining < 0;

            const timeRemainingText = timeExpired ? 'EXPIRED' :
                hoursRemaining > 0 ? `${hoursRemaining}h ${minutesRemaining}m left` :
                    `${minutesRemaining}m left`;

            const urgencyColor = timeExpired ? 'bg-black text-red-500 animate-pulse' :
                isCritical ? 'bg-red-600 text-white animate-pulse' :
                    isUrgent ? 'bg-orange-500 text-white' :
                        is_accepted ? 'bg-red-500' : 'bg-gray-400';

            recommendationsHTML += `
                <div class="relative overflow-hidden bg-gradient-to-br ${is_accepted ? 'from-gray-900 to-red-950 text-white' : 'from-gray-50 to-gray-200 border border-gray-300'} p-4 rounded-2xl mb-4 shadow-xl group">
                    <!-- Background Decor -->
                    <div class="absolute -top-4 -right-4 text-6xl opacity-10 transform rotate-12 group-hover:scale-110 transition-transform">⚔️</div>
                    
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                                <span class="text-xl">${is_accepted ? '💀' : '🛡️'}</span>
                                <span class="text-[10px] font-black uppercase tracking-widest ${is_accepted ? 'text-red-500' : 'text-gray-600'}">Boss Challenge</span>
                            </div>
                            <span class="text-[9px] font-bold ${urgencyColor} px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                ${timeExpired ? '⏰ EXPIRED' : `⏰ ${timeRemainingText}`}
                            </span>
                        </div>


                        <div class="mb-3">
                            <div class="flex items-center justify-between">
                                <p class="text-sm font-black leading-tight ${is_accepted ? 'text-white' : 'text-gray-800'}">
                                    Mission: Complete 
                                    <span id="boss-exam-target" class="inline-flex items-center gap-1">
                                        <strong>${targetExams}</strong>
                                    </span> Exams and 
                                    <span id="boss-session-target" class="inline-flex items-center gap-1">
                                        <strong>${targetSessions}</strong>
                                    </span> Sessions today.
                                </p>
                                ${!is_accepted ? `
                                    <button onclick="studyMentor.toggleEditTargets()" class="text-[9px] font-bold ${is_accepted ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors">
                                        ✏️ Edit
                                    </button>
                                ` : ''}
                            </div>
                            
                            <!-- Edit Mode (Hidden by default) -->
                            <div id="boss-edit-targets" class="hidden mt-3 p-3 bg-black/30 rounded-xl border border-white/10">
                                <div class="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <label class="text-[8px] uppercase font-black tracking-widest text-white/70 block mb-1">Exams</label>
                                        <input type="number" id="boss-edit-exams" value="${targetExams}" min="1" max="20" class="w-full bg-black/40 border border-white/20 rounded-lg px-2 py-1 text-sm text-white font-bold focus:outline-none focus:border-red-500">
                                    </div>
                                    <div>
                                        <label class="text-[8px] uppercase font-black tracking-widest text-white/70 block mb-1">Sessions</label>
                                        <input type="number" id="boss-edit-sessions" value="${targetSessions}" min="1" max="20" class="w-full bg-black/40 border border-white/20 rounded-lg px-2 py-1 text-sm text-white font-bold focus:outline-none focus:border-indigo-500">
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="studyMentor.saveCustomTargets()" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-[9px] font-black uppercase py-1.5 rounded-lg transition-colors">
                                        💾 Save
                                    </button>
                                    <button onclick="studyMentor.toggleEditTargets()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-[9px] font-black uppercase py-1.5 rounded-lg transition-colors">
                                        ✖️ Cancel
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-black/20 p-2 rounded-xl border border-white/5">
                                <div class="flex justify-between text-[8px] uppercase font-black tracking-widest mb-1">
                                    <span>Exams</span>
                                    <span>${currentExams}/${targetExams}</span>
                                </div>
                                <div class="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                    <div class="h-full bg-red-500 transition-all duration-1000" style="width: ${Math.min((currentExams / targetExams) * 100, 100)}%"></div>
                                </div>
                            </div>
                            <div class="bg-black/20 p-2 rounded-xl border border-white/5">
                                <div class="flex justify-between text-[8px] uppercase font-black tracking-widest mb-1">
                                    <span>Sessions</span>
                                    <span>${currentSessions}/${targetSessions}</span>
                                </div>
                                <div class="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                    <div class="h-full bg-indigo-500 transition-all duration-1000" style="width: ${Math.min((currentSessions / targetSessions) * 100, 100)}%"></div>
                                </div>
                            </div>
                        </div>

                        ${!is_accepted ? `
                            <button onclick="studyMentor.acceptChallenge()" class="w-full bg-gray-900 text-white text-[10px] font-black uppercase py-2.5 rounded-xl hover:bg-black transition-all shadow-lg shadow-black/20">Accept Mission</button>
                        ` : isSuccess ? `
                            <div class="w-full bg-green-500 text-white text-[10px] font-black uppercase py-2.5 rounded-xl text-center shadow-lg shadow-green-500/20 animate-pulse">Mission Accomplished! 🏆</div>
                        ` : `
                            <div class="w-full bg-red-600/20 border border-red-500/30 text-white text-[10px] font-black uppercase py-2.5 rounded-xl text-center tracking-widest">In Progress...</div>
                        `}
                    </div>
                </div>
            `;
        }

        const now = new Date();
        const hour = now.getHours();
        const morningRoadmap = this.mentorData.morning_roadmap;

        // --- NEW: Mission Dashboard: Today's Subject Roadmap ---
        if (subjects && subjects.length > 0) {
            const created = this.mentorData.daily_stats?.exams_created || [];
            const taken = this.mentorData.daily_stats?.exams_taken || [];

            const missionRoadmap = subjects.map(subj => {
                const todayExams = subj.today_exams || [];
                const totalCount = todayExams.length;
                const completedCount = todayExams.filter(exam => exam.is_completed).length;
                const isCreated = totalCount > 0;
                const isTaken = isCreated && totalCount === completedCount;

                // Find AI Progression/Revision Advice
                const advice = (this.mentorData.mentor_advice || []).find(a => a.subject === subj.name);

                // Mastery Level Logic
                const accuracy = subj.this_week || 0;
                const mastery = accuracy >= 80 ? 'gold' : accuracy >= 50 ? 'silver' : 'bronze';

                return {
                    name: subj.name,
                    isCreated,
                    isTaken,
                    totalCount,
                    completedCount,
                    target_topic: advice ? advice.target_topic : null,
                    target_type: advice ? advice.type : null,
                    mastery,
                    accuracy,
                    today_exams: todayExams,
                    status: (isCreated && isTaken) ? 'success' : (isCreated ? 'pending_take' : 'pending_create')
                };
            });

            const totalMissionSubjects = missionRoadmap.length;
            const completedMissionSubjects = missionRoadmap.filter(m => m.status === 'success').length;
            const missionProgress = Math.round((completedMissionSubjects / totalMissionSubjects) * 100);

            // Check for Boss Pressure Mode
            const currentHour = new Date().getHours();
            const isBossPressure = currentHour >= 16 && missionProgress < 50;

            recommendationsHTML += `
                <div class="bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/30 p-4 rounded-2xl mb-4 shadow-2xl relative overflow-hidden group ${isBossPressure ? 'boss-pressure-card' : ''}">
                    <!-- Tech Decor -->
                    <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all"></div>
                    
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-2">
                                <span class="text-xl">${isBossPressure ? '💀' : '⚔️'}</span>
                                <div>
                                    <p class="text-[10px] font-black ${isBossPressure ? 'pressure-glitch-text' : 'text-indigo-400'} uppercase tracking-widest leading-none">Mission Dashboard</p>
                                    <p class="text-[9px] text-gray-400 mt-0.5">Daily Coverage: ${completedMissionSubjects}/${totalMissionSubjects} Subjects</p>
                                </div>
                            </div>
                            <div class="text-right flex flex-col items-end">
                                <div class="flex items-center gap-1.5">
                                    ${this.mentorData.mission_streak > 0 ? `
                                        <div class="relative group/flame">
                                            <span class="material-symbols-outlined text-lg ${this.mentorData.mission_streak >= 8 ? 'text-purple-500 animate-pulse' : this.mentorData.mission_streak >= 3 ? 'text-orange-500' : 'text-blue-400'} drop-shadow-[0_0_8px_rgba(var(--streak-color),0.8)]" 
                                                  style="--streak-color: ${this.mentorData.mission_streak >= 8 ? '168,85,247' : this.mentorData.mission_streak >= 3 ? '249,115,22' : '96,165,250'}">
                                                local_fire_department
                                            </span>
                                            <div class="absolute bottom-full right-0 mb-2 hidden group-hover/flame:block bg-gray-900 text-white text-[8px] py-1 px-2 rounded whitespace-nowrap z-50">
                                                ${this.mentorData.mission_streak} Day Streak! ${this.mentorData.mission_streak >= 8 ? '🔥 UNSTOPPABLE' : this.mentorData.mission_streak >= 3 ? '⚡ HEATING UP' : '🧊 COLD START'}
                                            </div>
                                        </div>
                                    ` : ''}
                                    <span class="text-[10px] font-black ${missionProgress === 100 ? 'text-green-400' : 'text-indigo-300'}">${missionProgress}%</span>
                                </div>
                                <div class="h-1 w-12 bg-white/10 rounded-full mt-1 overflow-hidden">
                                    <div class="h-full ${missionProgress === 100 ? 'bg-green-400' : (isBossPressure ? 'bg-red-500' : 'bg-indigo-500')} transition-all duration-1000" style="width: ${missionProgress}%"></div>
                                </div>
                            </div>
                        </div>

                        ${missionProgress === 100 ? this.handleMissionSuccess() : ''}

                        <div class="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            ${missionRoadmap.map((item, index) => {
                const statusClass = item.status === 'success' ? 'border-green-500/30 bg-green-500/10' :
                    item.status === 'pending_take' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-white/10 bg-white/5';

                return `
                                    <div class="mb-2 last:mb-0">
                                        <div class="flex items-start justify-between p-2.5 rounded-xl border ${statusClass} transition-all cursor-pointer hover:bg-white/5" onclick="studyMentor.toggleMissionSubject(${index})">
                                            <div class="flex items-start gap-3 flex-1 min-w-0 pr-2">
                                                <div class="flex flex-col">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-bold text-gray-200 break-words">${item.name}</span>
                                                        <span class="text-gray-500 text-[10px] transition-transform" id="mission-arrow-${index}">▼</span>
                                                    </div>
                                                    <div class="flex flex-col gap-1 mt-1">
                                                        <div class="flex flex-col gap-1.5">
                                                            <div class="flex items-center gap-3">
                                                                <span class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter ${item.isCreated ? 'text-green-400' : 'text-gray-500'}">
                                                                    <span class="material-symbols-outlined text-[10px]">${item.isCreated ? 'check_circle' : 'circle'}</span> Created
                                                                </span>
                                                                <span class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter ${item.isTaken ? 'text-blue-400' : 'text-gray-500'}">
                                                                    <span class="material-symbols-outlined text-[10px]">${item.isTaken ? 'check_circle' : 'circle'}</span> Taken
                                                                </span>
                                                            </div>
                                                            ${item.totalCount > 0 ? `
                                                                <div class="flex flex-col gap-1 mb-1">
                                                                    <div class="flex justify-between items-center text-[7px] font-black uppercase tracking-tighter text-gray-400">
                                                                        <span>Progress</span>
                                                                        <span>${item.completedCount}/${item.totalCount} Completed</span>
                                                                    </div>
                                                                    <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                                        <div class="h-full ${item.isTaken ? 'bg-green-400' : 'bg-indigo-500'} transition-all duration-700" style="width: ${(item.completedCount / item.totalCount) * 100}%"></div>
                                                                    </div>
                                                                </div>
                                                            ` : ''}
                                                        </div>
                                                        <div class="flex items-center gap-2 mt-0.5">
                                                            <span class="material-symbols-outlined text-[14px] ${item.mastery === 'gold' ? 'text-yellow-400' : item.mastery === 'silver' ? 'text-slate-300' : 'text-orange-600'} drop-shadow-[0_0_5px_rgba(var(--badge-glow),0.5)]" 
                                                                  style="--badge-glow: ${item.mastery === 'gold' ? '250,204,21' : item.mastery === 'silver' ? '203,213,225' : '234,88,12'}"
                                                                  title="${item.mastery.toUpperCase()} Mastery (${Math.round(item.accuracy)}%)">
                                                                military_tech
                                                            </span>
                                                            <button onclick="event.stopPropagation(); studyMentor.startFocusSession('${item.name}')" class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-indigo-400 hover:text-indigo-300 transition-colors" title="Start Focus Session">
                                                                <span class="material-symbols-outlined text-[12px]">timer</span> Start Focus
                                                            </button>
                                                        </div>
                                                        ${item.target_topic ? `
                                                            <div class="flex">
                                                                <span class="flex items-center gap-1 text-[7px] font-black uppercase tracking-tighter ${item.target_type === 'progression' ? 'text-blue-300' : 'text-yellow-400'} px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                                                    🎯 ${item.target_type === 'progression' ? 'New Coverage' : 'Revision Focus'}: ${item.target_topic}
                                                                </span>
                                                            </div>
                                                        ` : ''}

                                                        <div class="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-white/5">
                                                            ${item.status === 'pending_create' ? `
                                                                <button onclick="event.stopPropagation(); window.location.href='https://bcspreli.free.nf/?page=exam'" class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-indigo-400 hover:text-indigo-300 transition-colors">
                                                                    <span class="material-symbols-outlined text-[12px]">add_circle</span> Create: ${item.target_topic ? item.target_topic.split(' ')[0] : 'Exam'}
                                                                </button>
                                                            ` : item.status === 'pending_take' ? `
                                                                <button onclick="event.stopPropagation(); window.loadPage('take-exam-list')" class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-yellow-500 hover:text-yellow-400 transition-colors animate-pulse-subtle">
                                                                    <span class="material-symbols-outlined text-[12px]">play_circle</span> Take Now
                                                                </button>
                                                            ` : `
                                                                <span class="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-green-400">
                                                                    <span class="material-symbols-outlined text-[12px]">check_circle</span> Mission Completed
                                                                </span>
                                                            `}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="flex items-start pt-1" onclick="event.stopPropagation()">
                                                <span class="material-symbols-outlined text-gray-500 text-sm opacity-50">more_vert</span>
                                            </div>
                                        </div>

                                        <!-- Collapsible Exams List -->
                                        <div id="mission-exams-${index}" class="hidden mt-1 ml-4 space-y-1.5 border-l-2 border-white/5 pl-3 py-1">
                                            ${item.today_exams.length > 0 ? item.today_exams.map(exam => `
                                                <div class="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
                                                    <div class="flex-1 min-w-0">
                                                        <p class="text-[10px] font-bold text-gray-300 truncate">${exam.title}</p>
                                                        <p class="text-[8px] text-gray-500 mt-0.5">${exam.total_marks} Marks | ${exam.is_completed ? (exam.completion_type === 'manual' ? '✅ Manual' : '✅ Online') : '⏳ Pending'}</p>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        ${exam.completion_type !== 'online' ? `
                                                            <label class="flex items-center gap-1 ${exam.is_completed ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}" 
                                                                   title="${exam.is_completed ? 'Completed (Manual)' : 'Mark as completed manually (offline)'}">
                                                                <input type="checkbox" id="manual-check-${exam.id}" 
                                                                    ${exam.is_completed ? 'checked disabled' : ''} 
                                                                    onchange="studyMentor.toggleExamCompletion(${exam.id}, this.checked)"
                                                                    class="form-checkbox h-3 w-3 text-indigo-500 rounded border-gray-600 bg-gray-700 focus:ring-indigo-500 focus:ring-offset-gray-900">
                                                            </label>
                                                        ` : ''}
                                                        <button onclick="studyMentor.startExam(${exam.id})" class="text-[8px] font-bold text-indigo-400 hover:text-indigo-300">
                                                            ${exam.is_completed ? 'Retake' : 'Start'} →
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('') : `
                                                <p class="text-[8px] text-gray-500 italic">No exams created for this subject yet.</p>
                                            `}
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                        
                        ${missionProgress === 100 ? `
                            <div class="mt-3 p-2 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
                                <p class="text-[9px] font-bold text-green-400">🔥 DOMINATION! You have conquered all subjects today!</p>
                            </div>
                        ` : `
                            <p class="mt-3 text-[9px] text-gray-500 italic text-center">"Sohan, the goal is simple: 1 Exam per Subject. Keep going!"</p>
                        `}
                    </div>
                </div>
            `;
        }

        // --- NEW: Yesterday's Revision Panel ---
        const yesterdayExams = this.mentorData.yesterday_exams;
        if (yesterdayExams && yesterdayExams.length > 0) {
            // Calculate total exams and completion stats
            let totalExams = 0;
            let completedExams = 0;
            let takenTodayCount = 0;

            yesterdayExams.forEach(subject => {
                subject.exams.forEach(exam => {
                    totalExams++;
                    if (exam.is_completed) completedExams++;
                    if (exam.taken_today) takenTodayCount++;
                });
            });

            const completionRate = totalExams > 0 ? Math.round((takenTodayCount / totalExams) * 100) : 0;

            recommendationsHTML += `
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-4 rounded-2xl mb-4 shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">📚</span>
                            <div>
                                <p class="text-[10px] font-black text-purple-900 uppercase tracking-widest leading-none">Yesterday's Revision</p>
                                <p class="text-[9px] text-purple-600 mt-0.5">Review material from ${new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-[9px] font-bold text-purple-700">${takenTodayCount}/${totalExams} Done</p>
                            <div class="h-1 w-16 bg-purple-200 rounded-full overflow-hidden mt-1">
                                <div class="h-full bg-purple-600 transition-all duration-500" style="width: ${completionRate}%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        ${yesterdayExams.map((subject, subjectIndex) => {
                const totalSubjectExams = subject.exams.length;
                const reviewedSubjectExams = subject.exams.filter(e => e.taken_today).length;
                const isAllReviewed = totalSubjectExams === reviewedSubjectExams;

                return `
                                <div class="bg-white/50 border border-purple-100/50 rounded-xl overflow-hidden">
                                    <!-- Subject Header -->
                                    <div class="flex items-start justify-between p-3 cursor-pointer hover:bg-purple-100/30 transition-colors" onclick="studyMentor.toggleRevisionSubject(${subjectIndex})">
                                        <div class="flex items-start gap-2 flex-1 min-w-0">
                                            <span class="text-xs font-bold text-purple-900 uppercase tracking-wider break-words">${subject.subject_name}</span>
                                            <span class="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap mt-0.5">
                                                ${reviewedSubjectExams}/${totalSubjectExams}
                                            </span>
                                        </div>
                                        <span class="text-purple-400 text-xs transition-transform" id="revision-arrow-${subjectIndex}">▼</span>
                                    </div>

                                    <!-- Exams List (Collapsible) -->
                                    <div id="revision-exams-${subjectIndex}" class="hidden border-t border-purple-100/30 bg-purple-50/30 space-y-3 p-3">
                                        ${subject.exams.map(exam => {
                    const statusIcon = exam.taken_today ? 'check_circle' : 'history_edu';
                    const statusColor = exam.taken_today ? 'text-green-500' : 'text-purple-600';
                    const bgColor = exam.taken_today ? 'bg-green-50' : 'bg-purple-100';

                    return `
                                                <div class="bg-white border border-purple-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex items-start gap-3">
                                                    <div class="${bgColor} p-2 rounded-lg flex-shrink-0">
                                                        <span class="material-symbols-outlined ${statusColor} text-xl">${statusIcon}</span>
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="flex items-center gap-2">
                                                            <p class="text-[9px] font-black text-purple-800 uppercase tracking-tighter">${subject.subject_name}</p>
                                                            ${exam.taken_today ? '<span class="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Reviewed</span>' : ''}
                                                        </div>
                                                        <p class="text-sm font-bold text-gray-800 mt-0.5 break-words">${exam.title}</p>
                                                        
                                                        <div class="flex items-center gap-2 mt-1 text-[10px] text-gray-500 font-medium">
                                                            <span class="flex items-center gap-1">📊 ${exam.total_marks} Marks</span>
                                                            ${exam.best_score !== null ? `<span class="text-gray-200">|</span> <span class="text-blue-600 font-bold">Best: ${exam.best_score}</span>` : ''}
                                                            ${exam.attempt_count > 0 ? `<span class="text-gray-200">|</span> <span>${exam.attempt_count} Attempts</span>` : ''}
                                                        </div>
                                                        
                                                        <button onclick="studyMentor.startExam(${exam.id})" class="mt-2 text-xs font-bold text-purple-600 flex items-center gap-1 hover:underline group">
                                                            ${exam.taken_today ? 'Retake Exam' : 'Review Exam'} 
                                                            <span class="material-symbols-outlined text-xs group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            `;
                }).join('')}
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>

                    ${takenTodayCount === totalExams ? `
                        <div class="mt-4 pt-3 border-t border-purple-100 text-center">
                            <p class="text-[10px] text-green-600 font-bold">
                                🎉 Amazing! You've reviewed all of yesterday's exams!
                            </p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

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
                const priorityColor = advice.type === 'revision' ? 'red' : 'amber';
                const priorityIcon = advice.type === 'revision' ? 'priority_high' : 'flag';
                const accuracyDisplay = advice.accuracy !== null ? `${advice.accuracy}% accuracy` : 'New Topic';

                return `
                <div class="bg-${priorityColor}-50 border border-${priorityColor}-200 p-3 rounded-xl mb-3 last:mb-0">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-${priorityColor}-600 text-lg">${priorityIcon}</span>
                        <div class="flex-1">
                            <p class="text-xs font-bold text-${priorityColor}-900 uppercase tracking-wider">${advice.subject} ${advice.accuracy !== null ? `- ${advice.accuracy}%` : ''}</p>
                            <p class="text-sm text-gray-700 mt-1">
                                Focus on <strong>${advice.target_topic}</strong> 
                                <span class="text-xs text-gray-500">(${accuracyDisplay})</span>
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

        // --- NEW: Calculate Daily Coverage for Discipline Ring ---
        if (this.mentorData.subjects) {
            const totalSubjects = this.mentorData.subjects.length;
            const conqueredSubjects = (this.mentorData.daily_stats?.exams_created || []).filter(subj => {
                const taken = (this.mentorData.daily_stats?.exams_taken || []).find(t => t.id === subj.id);
                return taken && taken.count >= subj.count;
            }).length;

            const coverage = totalSubjects > 0 ? Math.round((conqueredSubjects / totalSubjects) * 100) : 0;
            this.currentDailyCoverage = coverage; // Save for Boss Mode logic

            // Update Ring UI
            const ringInner = document.getElementById('discipline-ring-inner');
            const ringText = document.getElementById('discipline-ring-text');
            if (ringInner && ringText) {
                const circumference = 125.6; // 2 * PI * 20
                const offset = circumference - (coverage / 100) * circumference;
                ringInner.style.strokeDashoffset = offset;
                ringText.textContent = `${coverage}% `;

                // Color transition
                if (coverage === 100) {
                    ringInner.style.stroke = '#fcd34d'; // Gold
                    ringText.classList.add('text-yellow-300');
                } else {
                    ringInner.style.stroke = 'white';
                    ringText.classList.remove('text-yellow-300');
                }
            }
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
                    </div>
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

    toggleEditTargets() {
        const editPanel = document.getElementById('boss-edit-targets');
        if (editPanel) {
            editPanel.classList.toggle('hidden');
        }
    }

    async saveCustomTargets() {
        const examsInput = document.getElementById('boss-edit-exams');
        const sessionsInput = document.getElementById('boss-edit-sessions');

        if (!examsInput || !sessionsInput) return;

        const exams = parseInt(examsInput.value);
        const sessions = parseInt(sessionsInput.value);

        // Validation
        if (exams < 1 || exams > 20) {
            alert('Exams must be between 1 and 20');
            return;
        }

        if (sessions < 1 || sessions > 20) {
            alert('Sessions must be between 1 and 20');
            return;
        }

        try {
            const response = await fetch('api/challenge/update-targets.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exams, sessions })
            });

            const result = await response.json();

            if (result.success) {
                // Hide edit panel
                this.toggleEditTargets();

                // Refresh mentor data to show updated targets
                await this.fetchMentorData();
                this.renderRecommendations();

                // Show success message
                this.showCustomNudge({
                    title: 'TARGETS UPDATED',
                    message: `New mission: ${exams} exams, ${sessions} sessions. Let's crush it! 💪`,
                    icon: '🎯',
                    theme: 'boss'
                });
            } else {
                alert('Error: ' + (result.error || 'Failed to update targets'));
            }
        } catch (error) {
            console.error('Error updating targets:', error);
            alert('Failed to update targets. Please try again.');
        }
    }



    toggleRevisionSubject(index) {
        const examsDiv = document.getElementById(`revision-exams-${index}`);
        const arrow = document.getElementById(`revision-arrow-${index}`);

        if (examsDiv && arrow) {
            examsDiv.classList.toggle('hidden');
            arrow.style.transform = examsDiv.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    toggleMissionSubject(index) {
        const examsDiv = document.getElementById(`mission-exams-${index}`);
        const arrow = document.getElementById(`mission-arrow-${index}`);

        if (examsDiv && arrow) {
            examsDiv.classList.toggle('hidden');
            arrow.style.transform = examsDiv.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    handleMissionSuccess() {
        if (this.missionSuccessTriggered) return '';
        this.missionSuccessTriggered = true;

        // Log success via API
        fetch('api/log-activity.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'mission_success',
                message: 'Achieved 100% Subject Coverage Roadmap!',
                details: { timestamp: new Date().toISOString() }
            })
        }).catch(err => console.error('Streak logging failed:', err));

        return ''; // Template helper
    }

    startExam(examId) {
        // Navigate to take exam interface with the exam ID
        window.loadPage('take-exam-interface', `exam_id=${examId}`);
    }

}

// Initialize mentor when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.studyMentor = new StudyMentor();
    });
} else {
    window.studyMentor = new StudyMentor();
}
