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
            totalDuration: 25 * 60, // Track original duration
            subject: null,
            subjectId: null,
            intervalId: null
        };
        this.breakSession = {
            isActive: false,
            timeRemaining: 5 * 60, // 5 minutes in seconds
            subject: null,
            subjectId: null,
            intervalId: null,
            currentActivity: null
        };
        this.countdownRefreshInterval = null; // For Boss Challenge countdown updates
        this.reportRefreshInterval = null; // For real-time study report updates
        this.expandedMissionSubjects = new Set(); // Track expanded mission subject cards
        this.expandedRevisionSubjects = new Set(); // Track expanded revision subject cards
        this.inactiveNudgeIntervalId = null; // Track the inactive nudge interval

        // Server-Sync State
        this.serverInactivityData = {
            idleBaseline: 0,
            syncTime: 0,
            serverOffset: 0 // ServerTime - ClientTime
        };

        this.isSoundEnabled = localStorage.getItem('study_mentor_sound_enabled') !== 'false';

        this.init();
    }

    async init() {
        window.studyMentor = this; // Expose for onclick handlers
        // Request notification permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        this.createWidget();
        this.attachEventListeners();
        await this.fetchMentorData();
        await this.restoreSession();

        // Only show greeting if no session was restored
        if (!this.focusSession.isActive && !this.breakSession.isActive) {
            this.showWelcomeGreeting();
        }

        this.startTimeBasedNudges();
        this.startInactiveNudge(); // Start monitoring timer activity
        this.updateStatusIndicator(); // Initial indicator state
        this.injectPressureCSS();

        // Save session on page unload/refresh
        window.addEventListener('beforeunload', () => {
            if (this.focusSession.isActive && this.focusSession.intervalId) {
                this.saveSession('update', { remaining_seconds: this.focusSession.timeRemaining, type: 'focus' });
            } else if (this.breakSession.isActive && this.breakSession.intervalId) {
                this.saveSession('update', { remaining_seconds: this.breakSession.timeRemaining, type: 'break' });
            }
        });
    }

    async restoreSession() {
        try {
            const response = await fetch('api/pomodoro/status.php');
            const result = await response.json();

            if (result.success && result.session) {
                const session = result.session;
                const type = session.session_type || 'focus';

                if (type === 'focus') {
                    this.focusSession.subject = session.subject_name;
                    this.focusSession.subjectId = session.subject_id;
                    this.focusSession.timeRemaining = session.remaining_seconds;
                    this.focusSession.totalDuration = (session.duration_minutes || 25) * 60;

                    if (session.status === 'active') {
                        this.focusSession.isActive = true;
                        this.startFocusTimer(true);
                    } else if (session.status === 'paused') {
                        this.focusSession.isActive = true;
                        this.updateFocusUI(true);
                    }
                } else if (type === 'break') {
                    this.breakSession.isActive = true;
                    this.breakSession.subject = session.subject_name;
                    this.breakSession.subjectId = session.subject_id;
                    this.breakSession.timeRemaining = session.remaining_seconds;
                    this.breakSession.currentActivity = { text: "Resuming your break...", emoji: "☕" };

                    if (session.status === 'paused') {
                        this.updateBreakUI(true);
                    } else {
                        this.startBreakTimer(true);
                    }
                }
                console.log('Restored session:', session);
            }
        } catch (e) {
            console.error('Failed to restore session:', e);
        }
    }

    async saveSession(action, data = {}) {
        // Actions: start, pause, resume, update, complete
        // meaningful data: subject_id, subject_name, duration (for start)
        // remaining_seconds (for update/pause)

        const payload = { action: action, ...data };

        // Map to specific endpoints
        let endpoint = 'api/pomodoro/update.php';
        if (action === 'start') endpoint = 'api/pomodoro/start.php';
        if (action === 'complete') endpoint = 'api/pomodoro/complete.php';

        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            });
        } catch (e) {
            console.error('Failed to save session state:', e);
        }
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
        return this.focusSession.isActive;
    }

    isBreakModeActive() {
        return this.breakSession.isActive;
    }

    async startFocusSession(subjectId, subjectName) {
        // If there's an active session (even if different subject), stop it first
        if (this.focusSession.isActive || this.breakSession.isActive) {
            if (this.focusSession.isActive && this.focusSession.subject === subjectName) {
                // Same subject, maybe just accidentally closed the widget? Just toggling would be enough
                // However, we want "Start" to be a clean start or a resume.
                // Let's check status. If it's active in our memory, we just return.
                return;
            }
            // Stop current session (focus or break)
            await this.stopFocusSession();
        }

        this.focusSession.isActive = true;
        this.focusSession.subject = subjectName;
        this.focusSession.subjectId = subjectId;
        this.focusSession.timeRemaining = 25 * 60;
        this.focusSession.totalDuration = 25 * 60;

        // Reset inactivity logically (will be verified by server on next sync)
        this.serverInactivityData.lastPomodoroEnd = Math.floor(Date.now() / 1000) + this.serverInactivityData.serverOffset;
        this.serverInactivityData.totalBreakSeconds = 0;

        // DB Call to Start
        await this.saveSession('start', {
            subject_id: subjectId,
            subject_name: subjectName,
            duration: 25,
            type: 'focus'
        });

        this.startFocusTimer();
        this.updateFocusUI();
        this.updateStatusIndicator();
        this.closePanel();
    }

    pauseFocusSession() {
        clearInterval(this.focusSession.intervalId);
        this.focusSession.intervalId = null;
        this.saveSession('pause', { remaining_seconds: this.focusSession.timeRemaining });
        this.updateFocusUI(true); // Show paused state
        this.updateStatusIndicator();
    }

    resumeFocusSession() {
        this.saveSession('resume');
        this.startFocusTimer(true);
        this.updateStatusIndicator();
    }

    startFocusTimer(resuming = false) {
        if (this.focusSession.intervalId) clearInterval(this.focusSession.intervalId);

        // Initial UI update
        this.updateFocusUI();

        this.focusSession.intervalId = setInterval(() => {
            this.focusSession.timeRemaining--;
            this.updateFocusUI();

            // 5-Minute Warning
            if (this.focusSession.timeRemaining === 300) { // 300 seconds = 5 minutes
                this.sendNotification("AI Mentor: Focus Check", `5 minutes left! Finish strong, Sohan. You're crushing ${this.focusSession.subject}!`);
            }

            // Sync to DB every 30 seconds (Increased from 5s)
            if (this.focusSession.timeRemaining % 30 === 0) {
                this.saveSession('update', { remaining_seconds: this.focusSession.timeRemaining, type: 'focus' });
            }

            if (this.focusSession.timeRemaining <= 0) {
                this.completeFocusSession();
            }
        }, 1000);

        // Immediate sync after 1s if just started
        setTimeout(() => {
            if (this.focusSession.isActive) {
                this.saveSession('update', { remaining_seconds: this.focusSession.timeRemaining, type: 'focus' });
            }
        }, 1000);
    }

    updateFocusUI() {
        const teaserText = document.getElementById('teaser-text');
        const badge = document.getElementById('mentor-badge');
        const teaser = document.getElementById('mentor-teaser');

        // Check if we're on the exam-taking page
        const params = new URLSearchParams(window.location.search);
        const isExamPage = params.get('page') === 'exam-taking' || params.get('page') === 'take-exam-interface';

        if (teaser && teaserText) {
            const minutes = Math.floor(this.focusSession.timeRemaining / 60);
            const seconds = this.focusSession.timeRemaining % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Hide UI on exam page, but keep timer running
            if (isExamPage) {
                teaser.classList.add('hidden');
                badge?.classList.add('hidden');
                return; // Exit early, timer continues in background
            }

            teaser.classList.remove('hidden');
            badge?.classList.remove('hidden');

            // Force Boss Theme Visuals for Timer
            this.applyTimerTheme();

            const isPaused = arguments[0] === true;

            teaserText.innerHTML = `
                <div class="flex flex-col items-center">
                    <span class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                        ${isPaused ? '⏸️ PAUSED' : `Focusing: ${this.focusSession.subject}`}
                    </span>
                    <span class="text-3xl font-black ${isPaused ? 'opacity-50' : ''}">${timeStr}</span>
                    <div class="flex gap-2 mt-2">
                        ${isPaused
                    ? `<button onclick="studyMentor.resumeFocusSession()" class="text-[8px] font-bold text-white bg-emerald-600 px-2 py-1 rounded uppercase tracking-tighter">Resume</button>`
                    : `<button onclick="studyMentor.pauseFocusSession()" class="text-[8px] font-bold text-white bg-amber-600 px-2 py-1 rounded uppercase tracking-tighter">Pause</button>`
                }
                        <button onclick="studyMentor.stopFocusSession()" class="text-[8px] font-bold text-gray-400 hover:text-white uppercase tracking-tighter self-center">Stop</button>
                    </div>
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
        if (this.isFocusModeActive() || this.isBreakModeActive()) return;

        const teaser = document.getElementById('mentor-teaser');
        const teaserBorder = document.getElementById('teaser-border');
        const teaserContent = document.getElementById('teaser-content');
        const teaserDecor = document.getElementById('teaser-decor');
        const teaserEmoji = document.getElementById('teaser-emoji');
        const teaserText = document.getElementById('teaser-text');
        const badge = document.getElementById('mentor-badge');

        if (teaser && teaserText) {
            this.isMotivationalNudgeActive = true;

            // Apply theme
            teaserBorder.className = `relative p-[3px] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 theme-${theme}-border`;
            teaserContent.className = `rounded-[13px] p-5 text-center relative z-10 border border-white/10 transition-colors duration-500 theme-${theme}-bg`;
            teaser.classList.add('animate-float');

            // Apply Decorations
            if (teaserDecor) {
                teaserDecor.innerHTML = '';
                if (theme === 'champion') {
                    teaserDecor.innerHTML = '<div class="champion-sweep"></div>';
                } else if (theme === 'focus') {
                    teaserDecor.innerHTML = '<div class="focus-pulse"></div>';
                } else if (theme === 'boss') {
                    teaserBorder.classList.add('boss-heartbeat');
                }
            }

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

            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (this.isFocusModeActive() || this.isBreakModeActive()) return;
                teaser.classList.add('hidden');
                teaser.classList.remove('animate-float');
                teaserBorder.classList.remove('boss-heartbeat');
                this.isMotivationalNudgeActive = false;
            }, 10000);
        }
    }

    completeFocusSession() {
        clearInterval(this.focusSession.intervalId);
        const completedSubject = this.focusSession.subject || "General Focus";
        this.focusSession.isActive = false;

        // DB Call to Complete
        this.saveSession('complete', {
            remaining_seconds: 0
        });

        this.updateStatusIndicator();

        // Backend log is handled by complete.php now, so we can remove the manual fetch here
        // But we DO need to fetch fresh data to update the UI
        setTimeout(() => this.fetchMentorData(), 1000);

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
            this.startBreakSession(this.focusSession.subjectId, this.focusSession.subject);
        }, 5000);
    }

    stopFocusSession() {
        // If stopping a focus session manually, calculate and log elapsed time
        if (this.focusSession.isActive && !this.breakSession.isActive) {
            const elapsedSeconds = this.focusSession.totalDuration - this.focusSession.timeRemaining;
            const elapsedMinutes = Math.ceil(elapsedSeconds / 60);

            if (elapsedMinutes > 0) {
                this.saveSession('complete', {
                    duration: elapsedMinutes,
                    remaining_seconds: 0
                });
            } else {
                // If stopped instantly, just clear it without logging study time
                this.saveSession('complete', { remaining_seconds: 0 });
            }
        } else if (this.breakSession.isActive) {
            // If stopping a break, just clear the server session
            this.saveSession('complete', { remaining_seconds: 0 });
        }

        clearInterval(this.focusSession.intervalId);
        clearInterval(this.breakSession.intervalId);
        this.focusSession.isActive = false;
        this.breakSession.isActive = false;
        this.updateStatusIndicator();
        const teaser = document.getElementById('mentor-teaser');
        if (teaser) teaser.classList.add('hidden');
    }

    startBreakSession(subjectId = null, subjectName = null) {
        if (this.breakSession.isActive) return;

        // Reuse focus subject data if not provided (transition case)
        const finalSubjectId = subjectId || this.focusSession.subjectId;
        const finalSubjectName = subjectName || this.focusSession.subject;

        const activities = [
            { text: "Drink a <strong>full glass of water</strong> and stretch your back. I'll wait for you.", emoji: "💧" },
            { text: "Close your eyes for <strong>2 minutes</strong>. Your brain needs to digest what you just learned.", emoji: "🧘‍♂️" },
            { text: "Look at something <strong>20 feet away</strong> for 20 seconds. Save your eyes!", emoji: "👀" },
            { text: "Take <strong>5 deep breaths</strong>. Inhale the dream, exhale the stress.", emoji: "🌬️" }
        ];

        this.breakSession.isActive = true;
        this.breakSession.subject = finalSubjectName;
        this.breakSession.subjectId = finalSubjectId;
        this.breakSession.timeRemaining = 5 * 60;
        this.breakSession.currentActivity = activities[Math.floor(Math.random() * activities.length)];

        // DB Call to Start Break
        this.saveSession('start', {
            type: 'break',
            subject_id: finalSubjectId,
            subject_name: finalSubjectName,
            duration: 5
        });

        this.startBreakTimer();
        this.updateStatusIndicator();
    }

    startBreakTimer(resuming = false) {
        if (this.breakSession.intervalId) clearInterval(this.breakSession.intervalId);

        this.updateBreakUI();

        this.breakSession.intervalId = setInterval(() => {
            this.breakSession.timeRemaining--;
            this.updateBreakUI();

            // Sync to DB every 30 seconds (Increased from 5s)
            if (this.breakSession.timeRemaining % 30 === 0) {
                this.saveSession('update', { remaining_seconds: this.breakSession.timeRemaining, type: 'break' });
            }

            if (this.breakSession.timeRemaining <= 0) {
                this.sendNotification("AI Mentor: Break Over", "Time to get back to work! Let's go.");
                this.stopFocusSession(); // This clears session too
                // Show a final "Back to work" nudge
                this.showWelcomeGreeting();
            }
        }, 1000);

        // Immediate sync after 1s
        setTimeout(() => {
            if (this.breakSession.isActive) {
                this.saveSession('update', { remaining_seconds: this.breakSession.timeRemaining, type: 'break' });
            }
        }, 1000);
    }

    pauseBreakSession() {
        clearInterval(this.breakSession.intervalId);
        this.breakSession.intervalId = null;
        this.saveSession('pause', { remaining_seconds: this.breakSession.timeRemaining, type: 'break' });
        this.updateBreakUI(true); // Show paused state
        this.updateStatusIndicator();
    }

    resumeBreakSession() {
        this.saveSession('resume', { type: 'break' });
        this.startBreakTimer(true);
        this.updateStatusIndicator();
    }

    updateBreakUI() {
        const teaserText = document.getElementById('teaser-text');
        const teaser = document.getElementById('mentor-teaser');
        const badge = document.getElementById('mentor-badge');

        // Check if we're on the exam-taking page
        const params = new URLSearchParams(window.location.search);
        const isExamPage = params.get('page') === 'exam-taking' || params.get('page') === 'take-exam-interface';

        if (teaser && teaserText) {
            const minutes = Math.floor(this.breakSession.timeRemaining / 60);
            const seconds = this.breakSession.timeRemaining % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Hide UI on exam page, but keep timer running
            if (isExamPage) {
                teaser.classList.add('hidden');
                badge?.classList.add('hidden');
                return; // Exit early, timer continues in background
            }

            teaser.classList.remove('hidden');
            badge?.classList.remove('hidden');

            this.applyBreakTheme();

            const isPaused = arguments[0] === true;

            teaserText.innerHTML = `
                <div class="flex flex-col items-center">
                    <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1">
                        ${isPaused ? '⏸️ PAUSED' : 'Health Coach: Break Time'}
                    </span>
                    <span class="text-xs font-bold leading-tight mb-2 ${isPaused ? 'opacity-50' : ''}">
                        ${this.breakSession.currentActivity.text}
                    </span>
                    <span class="text-2xl font-black text-white ${isPaused ? 'opacity-50' : ''}">${timeStr}</span>
                    <div class="flex gap-2 mt-2">
                        ${isPaused
                    ? `<button onclick="studyMentor.resumeBreakSession()" class="text-[8px] font-bold text-white bg-emerald-600 px-2 py-1 rounded uppercase tracking-tighter">Resume</button>`
                    : `<button onclick="studyMentor.pauseBreakSession()" class="text-[8px] font-bold text-white bg-amber-600 px-2 py-1 rounded uppercase tracking-tighter">Pause</button>`
                }
                        <button onclick="studyMentor.stopFocusSession()" class="text-[8px] font-bold text-gray-400 hover:text-white uppercase tracking-tighter self-center">Skip Break</button>
                    </div>
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
        if (this.isFocusModeActive() || this.isBreakModeActive()) return;

        // --- NEW: Yesterday Failure Check ---
        if (this.mentorData?.boss_challenge?.status?.failed_yesterday) {
            this.showCustomNudge({
                title: "MISSION FAILED",
                message: "You failed yesterday's mission, Sohan. No excuses today. GET TO WORK.",
                icon: "👿",
                theme: "boss"
            });
            return;
        }

        const greetings = [
            "পড়তে বস, বাইনচোদ, চাকরি না পেলে খাবি কি ?",
            "অপমান এর শোধ লিতে হবে।",
            "তুই কোন মুখে বাড়ির সামনে রাস্তায় হাটবি।",
            "কালকে চাকরি তে যেতে হবে।",
            "তোর সময় দিয়ে কি করলি।",
            "তোকে দেখায় দিতেই হবে",

        ];

        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

        this.isInitialGreeting = true;

        // Show greeting in teaser after a short delay
        setTimeout(() => {
            if (this.isOpen) {
                this.isInitialGreeting = false;
                return;
            }
            this.showCustomNudge({
                title: "WELCOME BACK",
                message: randomGreeting,
                icon: "🏆",
                theme: "champion"
            });
            this.isInitialGreeting = false;
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
                /* Quick Actions Redesign */
                .quick-action-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 9999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .quick-action-btn:hover {
                    transform: scale(1.15);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                }
                .quick-action-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: #64748b;
                    margin-top: 6px;
                    text-align: center;
                    width: 64px;
                    line-height: 1.1;
                }

                /* Header Status Indicator Styles */
                #header-status-indicator {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 120px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 5;
                }

                .ambulance-alert {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .meltdown-core {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    position: relative;
                    background: radial-gradient(circle, #fff 0%, #f43f5e 60%, #9f1239 100%);
                    box-shadow: 0 0 15px rgba(225, 29, 72, 0.4);
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* WARNING STATE (Idle) */
                .meltdown-core.unstable {
                    animation: warning-pulse 1s infinite cubic-bezier(0.4, 0, 0.6, 1);
                    box-shadow: 0 0 25px rgba(225, 29, 72, 0.6);
                }

                @keyframes warning-pulse {
                    0% { transform: scale(1); opacity: 1; filter: brightness(1); }
                    50% { transform: scale(1.4); opacity: 0.3; filter: brightness(1.5); }
                    100% { transform: scale(1); opacity: 1; filter: brightness(1); }
                }

                /* STABLE STATE (Active) */
                .meltdown-core.stable {
                    background: radial-gradient(circle, #ccfbf1 0%, #2dd4bf 40%, #0d9488 70%, transparent 100%);
                    box-shadow: 0 0 25px rgba(20, 184, 166, 0.5);
                    animation: core-breathe 3s infinite ease-in-out;
                }

                @keyframes core-breathe {
                    0%, 100% { transform: scale(0.95); opacity: 0.9; }
                    50% { transform: scale(1.05); opacity: 1; }
                }

                /* BOOK FLIP ANIMATION (Focus) */
                .book-container {
                    width: 32px;
                    height: 22px;
                    position: relative;
                    perspective: 200px;
                }
                .book-icon {
                    width: 100%;
                    height: 100%;
                    background: #10b981;
                    border-radius: 3px;
                    position: relative;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .book-page {
                    position: absolute;
                    top: 3px;
                    right: 3px;
                    width: 13px;
                    height: 16px;
                    background: #f8fafc;
                    transform-origin: left center;
                    animation: page-turn 3s infinite ease-in-out;
                    border-radius: 0 2px 2px 0;
                    box-shadow: -1px 0 2px rgba(0,0,0,0.05);
                }
                .book-page:nth-child(2) { animation-delay: 1s; }
                .book-page:nth-child(3) { animation-delay: 2s; }

                @keyframes page-turn {
                    0% { transform: rotateY(0deg); opacity: 1; }
                    50%, 100% { transform: rotateY(-180deg); opacity: 0; }
                }

                .core-noise {
                    position: absolute;
                    inset: 0;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                    opacity: 0.2;
                    mix-blend-mode: overlay;
                    border-radius: 50%;
                }

                @keyframes light-sweep {
                    to { left: 200%; }
                }

                .grind-mode {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    animation: fade-in 0.5s ease-out;
                }
                .grind-icon {
                    font-size: 14px;
                    animation: grind-pulse 2s infinite ease-in-out;
                    color: #fbbf24;
                }
                .grind-text {
                    font-size: 8px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #fcd34d;
                    margin-top: 2px;
                }

                @keyframes grind-pulse {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px #fbbf24); }
                    50% { transform: scale(1.1); filter: drop-shadow(0 0 12px #f59e0b); }
                }

                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
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
                    <div class="p-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <!-- Quick Actions Section at Top -->
                        <div class="mb-5 pb-4 border-b border-gray-100">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Quick Actions</p>
                            <div class="flex flex-wrap justify-between gap-y-4 px-1">
                                <!-- Home/Dashboard -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('dashboard')" title="Home Dashboard">
                                    <div class="quick-action-btn bg-indigo-50 text-indigo-600">
                                        <span class="material-symbols-outlined text-xl">home</span>
                                    </div>
                                    <span class="quick-action-label">Dashboard</span>
                                </div>

                                <!-- Create Exams -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('exam')" title="Create Exams">
                                    <div class="quick-action-btn bg-emerald-50 text-emerald-600">
                                        <span class="material-symbols-outlined text-xl">assignment</span>
                                    </div>
                                    <span class="quick-action-label">Create Exams</span>
                                </div>
                                
                                <!-- Take a New Exam -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('take-exam-list')" title="Take a New Exam">
                                    <div class="quick-action-btn bg-purple-50 text-purple-600">
                                        <span class="material-symbols-outlined text-xl">school</span>
                                    </div>
                                    <span class="quick-action-label">Take New Exam</span>
                                </div>

                                <!-- Timely Model Exam -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('timely-model-exam')" title="Timely Model Exam">
                                    <div class="quick-action-btn bg-orange-50 text-orange-600">
                                        <span class="material-symbols-outlined text-xl">timer</span>
                                    </div>
                                    <span class="quick-action-label">Timely Exam</span>
                                </div>

                                <!-- Topic Wise Exams -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('topic-wise-exams')" title="Topic Wise Exams">
                                    <div class="quick-action-btn bg-sky-50 text-sky-600">
                                        <span class="material-symbols-outlined text-xl">grid_view</span>
                                    </div>
                                    <span class="quick-action-label">Topic-wise</span>
                                </div>

                                <!-- Lesson Wise Exams -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('lesson-wise-exams')" title="Lesson Wise Exams">
                                    <div class="quick-action-btn bg-violet-50 text-violet-600">
                                        <span class="material-symbols-outlined text-xl">auto_stories</span>
                                    </div>
                                    <span class="quick-action-label">Lesson-wise</span>
                                </div>

                                <!-- Import Questions -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('import-questions')" title="Import Questions">
                                    <div class="quick-action-btn bg-teal-50 text-teal-600">
                                        <span class="material-symbols-outlined text-xl">upload_file</span>
                                    </div>
                                    <span class="quick-action-label">Import Qs</span>
                                </div>

                                <!-- Review Mistake Bank -->
                                <div class="flex flex-col items-center group cursor-pointer" onclick="studyMentor.handleQuickAction('mistake-bank')" title="Review Mistake Bank">
                                    <div class="quick-action-btn bg-rose-50 text-rose-600">
                                        <span class="material-symbols-outlined text-xl">psychology</span>
                                    </div>
                                    <span class="quick-action-label">Mistake Bank</span>
                                </div>
                            </div>
                        </div>

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

            // Sound Toggle
            const soundToggle = e.target.closest('#toggle-mentor-sound');
            if (soundToggle) {
                this.toggleSound();
            }
        });
    }

    toggleSound() {
        this.isSoundEnabled = !this.isSoundEnabled;
        localStorage.setItem('study_mentor_sound_enabled', this.isSoundEnabled);
        this.updateStatusIndicator();

        // Resume AudioContext if we just enabled sound and it's suspended
        if (this.isSoundEnabled && this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
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

            // Refresh the study report every 60 seconds while open (Increased from 10s)
            this.reportRefreshInterval = setInterval(() => {
                if (this.isOpen) this.renderRecommendations();
            }, 60000);
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

        if (this.reportRefreshInterval) {
            clearInterval(this.reportRefreshInterval);
            this.reportRefreshInterval = null;
        }
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

    async fetchDailyStudyTime() {
        try {
            const response = await fetch('api/analytics/daily-study-time.php');
            const result = await response.json();
            if (result.success) {
                const now = Math.floor(Date.now() / 1000);
                this.serverInactivityData = {
                    idleBaseline: parseInt(result.calc_idle_seconds || 0),
                    syncTime: parseInt(result.server_time),
                    serverOffset: parseInt(result.server_time) - now
                };
                this.updateStatusIndicator();
            }
        } catch (error) {
            console.error("Mentor Sync Error:", error);
        }
    }

    startInactiveNudge() {
        if (this.inactiveNudgeIntervalId) return;

        // Initial sync
        this.fetchDailyStudyTime();

        // Periodic sync every 10 minutes for cross-device consistency (Increased from 2m)
        setInterval(() => this.fetchDailyStudyTime(), 600000);

        let lastNotificationTime = Date.now();

        this.inactiveNudgeIntervalId = setInterval(() => {
            if (!this.isFocusModeActive()) {
                const now = Math.floor(Date.now() / 1000);
                const currentServerTime = now + this.serverInactivityData.serverOffset;

                let displaySeconds = this.serverInactivityData.idleBaseline;

                // Only increment display if NOT in break
                if (!this.isBreakModeActive()) {
                    const elapsedSinceSync = currentServerTime - this.serverInactivityData.syncTime;
                    displaySeconds += Math.max(0, elapsedSinceSync);
                }

                // Update UI every second
                this.updateStatusIndicator(displaySeconds);

                // Play heart monitor beep every 1 seconds during idle
                if (this.isSoundEnabled && !this.isBreakModeActive() && displaySeconds > 0 && displaySeconds % 1 === 0) {
                    this.playHeartbeat();
                }

                // Browser Notification every 60 seconds of inactivity (only if not in any session)
                if (!this.isBreakModeActive()) {
                    const nowMs = Date.now();
                    if (nowMs - lastNotificationTime >= 60000) {
                        this.sendNotification(
                            "AI Mentor: Inactivity Alert",
                            "Sohan, both timers are inactive. Time to get back to work and start a Pomodoro session!"
                        );
                        lastNotificationTime = nowMs;
                    }
                }
            }
        }, 1000);
    }

    formatInactivityTime(seconds) {
        if (seconds < 60) return `${seconds.toString().padStart(2, '0')}s`;

        const pad = (num) => num.toString().padStart(2, '0');
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) {
            return `${pad(h)}::${pad(m)}::${pad(s)}`;
        } else {
            return `${pad(m)}::${pad(s)}`;
        }
    }

    playHeartbeat() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            // Shared context to bypass autoplay restrictions after first click
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();

                // Resume on first click to bypass browser block
                window.addEventListener('click', () => {
                    if (this.audioCtx.state === 'suspended') {
                        this.audioCtx.resume();
                    }
                }, { once: true });
            }

            if (this.audioCtx.state === 'suspended') return;

            const playPulse = (delay, freq, vol) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                // Square wave for much more "piercing" and audible sound
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + delay);

                gain.gain.setValueAtTime(0, this.audioCtx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(vol, this.audioCtx.currentTime + delay + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + delay + 0.15);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(this.audioCtx.currentTime + delay);
                osc.stop(this.audioCtx.currentTime + delay + 0.2);
            };

            // High-pitched "Medical Alert" Beep (Much more audible)
            // Pulse 1: High freq
            playPulse(0, 2500, 0.2);
            // Pulse 2: Slightly offset for "Double Beep" effect
            setTimeout(() => {
                if (this.audioCtx && this.audioCtx.state !== 'closed') {
                    playPulse(0, 2200, 0.15);
                }
            }, 100);

        } catch (e) {
            console.warn("Heartbeat Audio Error:", e);
        }
    }

    updateStatusIndicator(computedSeconds = null) {
        const indicator = document.getElementById('global-header-status-indicator');
        if (!indicator) return;

        let seconds = computedSeconds;
        if (seconds === null) {
            const now = Math.floor(Date.now() / 1000);
            const currentServerTime = now + this.serverInactivityData.serverOffset;
            seconds = this.serverInactivityData.idleBaseline;
            if (!this.isBreakModeActive()) {
                seconds += Math.max(0, currentServerTime - this.serverInactivityData.syncTime);
            }
        }

        const inactiveTimeDisplay = this.formatInactivityTime(seconds);
        const soundIcon = this.isSoundEnabled ? 'volume_up' : 'volume_off';

        if (this.isFocusModeActive()) {
            // Timer is hidden during Focus
            indicator.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="book-container">
                        <div class="book-icon">
                            <div class="book-page"></div>
                            <div class="book-page"></div>
                            <div class="book-page"></div>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Deep Work Active</span>
                </div>
            `;
        } else if (this.isBreakModeActive()) {
            // Timer is visible but paused during Break
            indicator.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="meltdown-core stable" style="background: radial-gradient(circle, #e0f2fe 0%, #0ea5e9 100%); box-shadow: 0 0 15px rgba(14, 165, 233, 0.4);"></div>
                    <div class="flex flex-col items-start border-l border-sky-100 pl-3">
                        <span class="text-[8px] font-black text-gray-400 uppercase tracking-widest">Idle Time</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-black text-sky-800 opacity-60">${inactiveTimeDisplay}</span>
                             <button id="toggle-mentor-sound" class="text-gray-400 hover:text-sky-600 transition-colors">
                                <span class="material-symbols-outlined text-sm">${soundIcon}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Timer is visible and running during Idle
            indicator.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="meltdown-core unstable"></div>
                    <div class="flex flex-col items-start border-l border-rose-100 pl-3">
                        <span class="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Idle</span>
                        <div class="flex items-center gap-2">
                            <span class="text-[12px] font-black text-rose-700">${inactiveTimeDisplay}</span>
                            <button id="toggle-mentor-sound" class="text-rose-300 hover:text-rose-600 transition-colors">
                                <span class="material-symbols-outlined text-sm">${soundIcon}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async fetchMentorData() {
        try {
            const [trendsResult, decksResult, yesterdayResult] = await Promise.all([
                CacheManager.fetchWithCache('api/performance/mastery-trends.php', 30),
                CacheManager.fetchWithCache('api/flashcards/decks.php', 60),
                CacheManager.fetchWithCache('api/revision/get-yesterday-exams.php', 60)
            ]);

            if (trendsResult) {
                this.mentorData = trendsResult;
                this.mentorData.flashcard_decks = decksResult ? decksResult.decks : [];
                this.mentorData.total_cards_due = decksResult ? decksResult.total_cards_due : 0;
                this.mentorData.yesterday_exams = yesterdayResult ? yesterdayResult.yesterday_exams : [];
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
            const result = await CacheManager.fetchWithCache('api/activity-status.php', 5);
            if (result && this.mentorData) {
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
        if (!sessions || sessions.length < 2) return null;

        // Count consecutive sessions of the same subject
        let consecutiveCount = 1;
        const firstSubject = typeof sessions[0] === 'object' ? sessions[0].subject_name : sessions[0];

        for (let i = 1; i < sessions.length; i++) {
            const currentSubject = typeof sessions[i] === 'object' ? sessions[i].subject_name : sessions[i];
            if (currentSubject === firstSubject) {
                consecutiveCount++;
            } else {
                break;
            }
        }

        // Trigger fatigue if 3 or more sessions (75+ mins)
        if (consecutiveCount >= 3) {
            const totalMinutes = consecutiveCount * 25; // Default Pomodoro length

            // Find a different subject to suggest
            const otherSubjects = (this.mentorData.subjects || []).filter(s => s.name !== firstSubject);
            const roadmapSubjects = (this.mentorData.morning_roadmap || []).filter(r => r.subject !== firstSubject);

            let suggestion = "a different topic";
            if (roadmapSubjects.length > 0) {
                suggestion = roadmapSubjects[0].subject;
            } else if (otherSubjects.length > 0) {
                suggestion = otherSubjects[Math.floor(Math.random() * otherSubjects.length)].name;
            }

            return {
                message: `Sohan, you've done <strong>${totalMinutes} mins</strong> of ${firstSubject}. Your brain is melting! Switch to <strong>${suggestion}</strong> for one session to stay sharp!`,
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
            if (this.isOpen || this.isInitialGreeting || this.isFocusModeActive() || this.isBreakModeActive()) {
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
                    teaserText.innerHTML = isStatusMessage ? randomMsg : `${randomMsg} ${timeRemaining}`;
                }

                teaser.classList.remove('hidden');
                badge?.classList.remove('hidden');

                // Auto-hide after 15 seconds
                setTimeout(() => {
                    if (this.isFocusModeActive()) return;
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

        // Save scroll position before re-rendering
        const missionContainer = document.getElementById('mission-subjects-container');
        const savedScrollTop = missionContainer ? missionContainer.scrollTop : 0;

        const revisionContainer = document.getElementById('yesterday-revision-container');
        const savedRevisionScrollTop = revisionContainer ? revisionContainer.scrollTop : 0;

        let recommendationsHTML = '';

        // --- NEW: Daily Study Report ---
        if (window.StudyTargetTracker) {
            const studiedSeconds = window.StudyTargetTracker.studiedSeconds || 0;
            const targetSeconds = window.StudyTargetTracker.DAILY_TARGET_SECONDS || (15 * 3600);
            const studiedFormatted = window.StudyTargetTracker.formatTime(studiedSeconds);
            const percent = Math.min(100, Math.round((studiedSeconds / targetSeconds) * 100));

            // Get predicted finish from the tracker's logic or DOM
            const predictedFinish = document.getElementById('predicted-finish-clock')?.textContent || "--:--";
            const isMissionMode = window.StudyTargetTracker.protocolActive;

            recommendationsHTML += `
                <div class="bg-gradient-to-br ${isMissionMode ? 'from-slate-900 to-indigo-950 border-indigo-500/30' : 'from-indigo-50 to-blue-50 border-indigo-100'} border p-4 rounded-2xl mb-4 shadow-sm relative overflow-hidden">
                    ${isMissionMode ? '<div class="absolute top-0 left-0 w-full h-0.5 bg-cyan-500 animate-pulse"></div>' : ''}
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-indigo-600 ${isMissionMode ? 'text-cyan-400' : ''} text-lg">timer</span>
                            <span class="text-[10px] font-black uppercase tracking-widest ${isMissionMode ? 'text-indigo-300' : 'text-indigo-900/60'}">Daily Study Report</span>
                        </div>
                        <span class="text-[10px] font-bold ${isMissionMode ? 'text-cyan-400' : 'text-indigo-600'} uppercase">${percent}% Goal</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="bg-white/50 ${isMissionMode ? 'bg-slate-800/50' : ''} p-2 rounded-xl">
                            <p class="text-[8px] font-black ${isMissionMode ? 'text-slate-400' : 'text-gray-400'} uppercase tracking-tighter">Time Studied</p>
                            <p class="text-sm font-black ${isMissionMode ? 'text-white' : 'text-gray-900'}">${studiedFormatted}</p>
                        </div>
                        <div class="bg-white/50 ${isMissionMode ? 'bg-slate-800/50' : ''} p-2 rounded-xl">
                            <p class="text-[8px] font-black ${isMissionMode ? 'text-slate-400' : 'text-gray-400'} uppercase tracking-tighter">Est. Finish</p>
                            <p class="text-sm font-black ${isMissionMode ? 'text-indigo-500' : 'text-indigo-600'}">${predictedFinish}</p>
                        </div>
                    </div>

                    <div class="w-full h-1.5 bg-gray-200/50 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }

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
                    id: subj.id,
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
                    focus_sessions: subj.focus_sessions || 0,
                    break_sessions: subj.break_sessions || 0,
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
                <div class="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4 rounded-2xl mb-4 shadow-sm">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">⚔️</span>
                            <div>
                                <p class="text-xs font-bold text-indigo-900 uppercase tracking-wide">Mission Dashboard</p>
                                <p class="text-xs text-gray-600 mt-0.5">Daily Coverage: ${completedMissionSubjects}/${totalMissionSubjects} Subjects</p>
                            </div>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <div class="flex items-center gap-2">
                                ${this.mentorData.mission_streak > 0 ? `
                                    <div class="relative group/flame">
                                        <span class="material-symbols-outlined text-lg ${this.mentorData.mission_streak >= 8 ? 'text-purple-600' : this.mentorData.mission_streak >= 3 ? 'text-orange-600' : 'text-blue-600'}">
                                            local_fire_department
                                        </span>
                                        <div class="absolute bottom-full right-0 mb-2 hidden group-hover/flame:block bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-50">
                                            ${this.mentorData.mission_streak} Day Streak!
                                        </div>
                                    </div>
                                ` : ''}
                                <span class="text-sm font-bold ${missionProgress === 100 ? 'text-green-600' : 'text-indigo-700'}">${missionProgress}%</span>
                            </div>
                            <div class="h-1.5 w-16 bg-indigo-200 rounded-full mt-1 overflow-hidden">
                                <div class="h-full ${missionProgress === 100 ? 'bg-green-500' : 'bg-indigo-600'} transition-all duration-500" style="width: ${missionProgress}%"></div>
                            </div>
                        </div>
                    </div>

                        ${missionProgress === 100 ? this.handleMissionSuccess() : ''}

                        <div id="mission-subjects-container" class="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            ${missionRoadmap.map((item, index) => {
                const statusClass = item.status === 'success' ? 'border-green-200 bg-green-50' :
                    item.status === 'pending_take' ? 'border-yellow-200 bg-yellow-50' :
                        'border-indigo-200 bg-white';

                return `
                                    <div class="mb-2 last:mb-0">
                                        <div class="p-3 rounded-xl border ${statusClass} transition-all hover:shadow-sm">
                                            
                                            <!-- ROW 1: HEADER ROW (Subject Name + Arrow + Mastery + Action Button) -->
                                            <div class="flex justify-between items-center cursor-pointer" onclick="studyMentor.toggleMissionSubject(${index})">
                                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                                    <span class="text-sm font-bold text-gray-800 break-words">${item.name}</span>
                                                    <span class="text-gray-400 text-xs transition-transform" id="mission-arrow-${index}">▼</span>
                                                </div>
                                                <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                                                    <span class="material-symbols-outlined text-base ${item.mastery === 'gold' ? 'text-yellow-600' : item.mastery === 'silver' ? 'text-slate-400' : 'text-orange-600'}" 
                                                          title="${item.mastery.toUpperCase()} Mastery (${Math.round(item.accuracy)}%)">
                                                        military_tech
                                                    </span>
                                                    ${item.status === 'pending_create' ? `
                                                        <button onclick="event.stopPropagation(); window.location.href='https://bcspreli.free.nf/?page=exam'" class="px-2 py-1 text-xs font-bold uppercase tracking-tight text-indigo-700 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors">
                                                            Create
                                                        </button>
                                                    ` : item.status === 'pending_take' ? `
                                                        <button onclick="event.stopPropagation(); window.loadPage('take-exam-list')" class="px-2 py-1 text-xs font-bold uppercase tracking-tight text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors">
                                                            Take Now
                                                        </button>
                                                    ` : `
                                                        <span class="px-2 py-1 text-xs font-bold uppercase tracking-tight text-green-700 bg-green-100 rounded-lg">
                                                            Completed
                                                        </span>
                                                    `}
                                                </div>
                                            </div>

                                            <!-- ROW 2: STATUS STRIP (Created • Taken • Sessions • Breaks) -->
                                            <div class="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-600">
                                                <span class="flex items-center gap-1 ${item.isCreated ? 'text-green-600' : 'text-gray-400'}">
                                                    <span class="material-symbols-outlined text-sm">${item.isCreated ? 'check_circle' : 'circle'}</span>
                                                    Created
                                                </span>
                                                <span class="flex items-center gap-1 ${item.isTaken ? 'text-blue-600' : 'text-gray-400'}">
                                                    <span class="material-symbols-outlined text-sm">${item.isTaken ? 'check_circle' : 'circle'}</span>
                                                    Taken
                                                </span>
                                                <span class="flex items-center gap-1 text-indigo-600">
                                                    <span class="material-symbols-outlined text-sm">timer</span>
                                                    ${item.focus_sessions} Sessions
                                                </span>
                                                <span class="flex items-center gap-1 text-indigo-600">
                                                    <span class="material-symbols-outlined text-sm">self_care</span>
                                                    ${item.break_sessions} Breaks
                                                </span>
                                            </div>

                                            <!-- ROW 3: PROGRESS BAR (If exists) -->
                                            ${item.totalCount > 0 ? `
                                                <div class="mt-2">
                                                    <div class="flex justify-between items-center text-xs text-gray-600 mb-1">
                                                        <span>Progress</span>
                                                        <span>${item.completedCount}/${item.totalCount}</span>
                                                    </div>
                                                    <div class="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                                                        <div class="h-full ${item.isTaken ? 'bg-green-500' : 'bg-indigo-500'} transition-all duration-500" style="width: ${(item.completedCount / item.totalCount) * 100}%"></div>
                                                    </div>
                                                </div>
                                            ` : ''}

                                            <!-- ROW 4: TARGET + FOCUS AREA -->
                                            <div class="flex justify-between items-center mt-2 gap-2">
                                                ${item.target_topic ? `
                                                    <span class="flex items-center gap-1 text-xs font-bold ${item.target_type === 'progression' ? 'text-blue-700' : 'text-amber-700'} px-2 py-1 rounded-lg ${item.target_type === 'progression' ? 'bg-blue-50 border border-blue-200' : 'bg-amber-50 border border-amber-200'}">
                                                        🎯 ${item.target_type === 'progression' ? 'New Coverage' : 'Revision'}: ${item.target_topic}
                                                    </span>
                                                ` : '<div></div>'}
                                                <button onclick="event.stopPropagation(); studyMentor.startFocusSession('${item.id}', '${item.name}')" class="px-3 py-1.5 text-xs font-bold uppercase tracking-tight text-indigo-700 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 rounded-full transition-colors flex items-center gap-1" title="Start Focus Session">
                                                    <span class="material-symbols-outlined text-sm">timer</span>
                                                    Start Focus
                                                </button>
                                            </div>
                                        </div>

                                        <!--Collapsible Exams List-->
                                        <div id="mission-exams-${index}" class="hidden mt-3 ml-4 space-y-2 border-l-2 border-indigo-100 pl-4 py-1">
                                            ${item.today_exams.length > 0 ? item.today_exams.map(exam => `
                                                <div class="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors">
                                                    <div class="flex items-start justify-between gap-3">
                                                        <div class="flex-1 min-w-0">
                                                            <p class="text-sm font-bold text-gray-800 leading-tight">${exam.title}</p>
                                                            <p class="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                                                <span class="material-symbols-outlined text-sm">analytics</span>
                                                                ${exam.total_marks} Marks | ${exam.is_completed ? (exam.completion_type === 'manual' ? '✅ Manual' : '✅ Online') : '⏳ Pending'}
                                                            </p>
                                                        </div>
                                                        ${exam.completion_type !== 'online' ? `
                                                            <div class="flex items-center" onclick="event.stopPropagation()">
                                                                <label class="flex items-center gap-1.5 ${exam.is_completed ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}" 
                                                                       title="${exam.is_completed ? 'Completed (Manual)' : 'Mark as completed offline'}">
                                                                    <input type="checkbox" id="manual-check-${exam.id}" 
                                                                        ${exam.is_completed ? 'checked disabled' : ''} 
                                                                        onchange="studyMentor.toggleExamCompletion(${exam.id}, this.checked)"
                                                                        class="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 bg-white focus:ring-indigo-500">
                                                                </label>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    
                                                    <div class="pt-2 border-t border-gray-100 flex justify-end">
                                                        <button onclick="studyMentor.startExam(${exam.id})" 
                                                                class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 rounded-full transition-all flex items-center gap-1.5">
                                                            <span class="material-symbols-outlined text-sm">${exam.is_completed ? 'refresh' : 'play_circle'}</span>
                                                            ${exam.is_completed ? 'Retake Exam' : 'Start Exam'}
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('') : `
                                                <p class="text-xs text-gray-400 italic py-2">No exams created for this subject yet.</p>
                                            `}
                                        </div>
                                    </div>
                `;
            }).join('')}
                        </div>
                        
                        ${missionProgress === 100 ? `
                            <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
                                <p class="text-xs font-bold text-green-700">🔥 Amazing! You have conquered all subjects today!</p>
                            </div>
                        ` : `
                            <p class="mt-3 text-xs text-gray-500 italic text-center">"Sohan, the goal is simple: 1 Exam per Subject. Keep going!"</p>
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

                    <div id="yesterday-revision-container" class="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
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
            if (teaserText) teaserText.innerHTML = nudge.message;

            // Auto-hide teaser after 8 seconds
            setTimeout(() => {
                if (this.isFocusModeActive() || this.isBreakModeActive()) return;
                teaser?.classList.add('hidden');
            }, 8000);
        } else {
            if (!this.isFocusModeActive() && !this.isBreakModeActive()) {
                badge?.classList.add('hidden');
                teaser?.classList.add('hidden');
            }
        }

        // Restore expanded state for mission subject cards after re-render
        this.expandedMissionSubjects.forEach(index => {
            const examsDiv = document.getElementById(`mission-exams-${index}`);
            const arrow = document.getElementById(`mission-arrow-${index}`);

            if (examsDiv && arrow) {
                examsDiv.classList.remove('hidden');
                arrow.style.transform = 'rotate(180deg)';
            }
        });

        // Restore expanded state for revision subject cards
        this.expandedRevisionSubjects.forEach(index => {
            const examsDiv = document.getElementById(`revision-exams-${index}`);
            const arrow = document.getElementById(`revision-arrow-${index}`);

            if (examsDiv && arrow) {
                examsDiv.classList.remove('hidden');
                arrow.style.transform = 'rotate(180deg)';
            }
        });

        // Restore scroll position for mission subjects container
        if (savedScrollTop > 0) {
            const restoredContainer = document.getElementById('mission-subjects-container');
            if (restoredContainer) {
                restoredContainer.scrollTop = savedScrollTop;
            }
        }

        // Restore scroll position for revision panel
        if (savedRevisionScrollTop > 0) {
            const restoredRevisionContainer = document.getElementById('yesterday-revision-container');
            if (restoredRevisionContainer) {
                restoredRevisionContainer.scrollTop = savedRevisionScrollTop;
            }
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

            // Track expanded state
            if (examsDiv.classList.contains('hidden')) {
                this.expandedRevisionSubjects.delete(index);
            } else {
                this.expandedRevisionSubjects.add(index);
            }
        }
    }

    toggleMissionSubject(index) {
        const examsDiv = document.getElementById(`mission-exams-${index}`);
        const arrow = document.getElementById(`mission-arrow-${index}`);

        if (examsDiv && arrow) {
            examsDiv.classList.toggle('hidden');
            arrow.style.transform = examsDiv.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';

            // Track expanded state
            if (examsDiv.classList.contains('hidden')) {
                this.expandedMissionSubjects.delete(index);
            } else {
                this.expandedMissionSubjects.add(index);
            }
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

    async handleQuickAction(pageName) {
        if (typeof window.loadPage === 'function') {
            await window.loadPage(pageName);
            this.closePanel();
        }
    }

    startExam(examId) {
        // Close mentor panel before navigating to exam
        this.closePanel();

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
