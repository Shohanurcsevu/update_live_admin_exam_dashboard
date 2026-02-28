/**
 * Speed Trivia Game Engine
 */
if (window.triviaGameInterval) clearInterval(window.triviaGameInterval);

window.triviaGame = {
    questions: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    lives: 10,
    currentLevel: 1,
    timer: 20,
    timerInterval: null,
    isProcessing: false,
    results: [],
    solvedIds: new Set(),
    retryCount: {},
    ghostData: { yesterday: 0, best: 0, average: 0 },
    stats: { totalRemainingTime: 0, totalAnswered: 0 },
    currentSource: {
        type: 'random',
        subject_id: null,
        lesson_id: null,
        topic_id: null,
        exam_id: null
    },
    categories: null,
    questionCount: 15,

    init: async function () {
        this.resetState();
        this.showView('loading');

        try {
            // Fetch initial subject list
            const response = await fetch('api/trivia/get-categories.php?type=subjects');
            const data = await response.json();

            if (data.success) {
                this.categories = data.data;
                this.populateDropdown('subject', data.data.subjects);
                this.showView('start');
            } else {
                window.showToast('Failed to load subjects', 'error');
                this.showView('start');
            }
        } catch (error) {
            console.error('Trivia init error:', error);
            this.showView('start');
        }
    },

    resetState: function () {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.questions = [];
        this.currentIndex = 0;
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.lives = 10;
        this.currentLevel = 1;
        this.timer = 20;
        this.isProcessing = false;
        this.results = [];
        this.solvedIds = new Set();
        this.retryCount = {};
        this.stats = { totalRemainingTime: 0, totalAnswered: 0 };
        this.currentSource = {
            type: 'random',
            subject_id: null,
            lesson_id: null,
            topic_id: null,
            exam_id: null
        };
        this.updateStopButtonState();
    },

    start: async function () {
        // Collect current selections
        if (this.currentSource.type !== 'random') {
            this.currentSource.subject_id = document.getElementById('select-subject').value;
            this.currentSource.lesson_id = document.getElementById('select-lesson').value;
            this.currentSource.topic_id = document.getElementById('select-topic').value;
            this.currentSource.exam_id = document.getElementById('select-exam').value;

            if (!this.currentSource.subject_id) {
                window.showToast('Please select at least a Subject', 'warning');
                return;
            }
        }

        this.showView('loading');

        try {
            // Fetch questions specifically for this source hierarchy
            const params = new URLSearchParams({
                source_type: this.currentSource.type,
                subject_id: this.currentSource.subject_id || '',
                lesson_id: this.currentSource.lesson_id || '',
                topic_id: this.currentSource.topic_id || '',
                exam_id: this.currentSource.exam_id || '',
                limit: this.questionCount
            });

            const qResp = await fetch(`api/question/random-trivia.php?${params}`);
            const qData = await qResp.json();

            if (!qData.success || qData.data.length === 0) {
                window.showToast('No questions found for this selection!', 'error');
                this.showView('start');
                return;
            }

            this.questions = qData.data.map(q => this.shuffleOptions(q));
            this.totalFetched = qData.data.length;

            // If 'All' was selected, update the label with actual count
            if (this.questionCount === 0) {
                const label = document.getElementById('question-count-label');
                if (label) label.textContent = this.totalFetched;
            }

            // Fetch ghosts for this specific source
            await this.fetchGhosts();

            this.showView('active');
            this.updateHUD();
            this.updateStopButtonState();
            this.loadQuestion();
        } catch (e) {
            console.error('Start error:', e);
            window.showToast('Failed to start session', 'error');
            this.showView('start');
        }
    },

    showView: function (view) {
        const views = ['loading', 'start', 'active', 'result'];
        views.forEach(v => {
            const el = document.getElementById(`game-${v}-view`);
            if (el) el.classList.toggle('hidden', v !== view);
        });

        const loadingEl = document.getElementById('game-loading');
        if (loadingEl) {
            loadingEl.classList.toggle('hidden', view !== 'loading');
        }
    },

    loadQuestion: function () {
        // Game ends if we have no questions left or lives are gone
        if (this.questions.length === 0 || this.lives <= 0) {
            this.endGame();
            return;
        }

        const q = this.questions[0]; // ALWAYS WORK ON THE HEAD
        this.isProcessing = false;
        this.timer = this.getMaxTimer();

        // Update UI
        const progressEl = document.getElementById('question-progress');
        const totalQ = this.questionCount || (this.solvedIds.size + this.questions.length);
        if (progressEl) progressEl.textContent = `SOLVED ${this.solvedIds.size} OF ${totalQ}`;

        const textEl = document.getElementById('question-display-text');
        if (textEl) textEl.textContent = q.question_text;

        const grid = document.getElementById('options-grid');
        if (grid) {
            grid.innerHTML = '';
            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn w-full p-3 text-left bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 hover:border-indigo-300 hover:bg-slate-100 transition-all flex items-center gap-3 group';
                btn.innerHTML = `
                    <span class="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs group-hover:border-indigo-300 group-hover:text-indigo-600 transition-colors">${String.fromCharCode(65 + idx)}</span>
                    <span>${opt}</span>
                `;
                btn.onclick = () => this.handleAnswer(idx);
                grid.appendChild(btn);
            });
        }

        // --- NEW: Retry Badge ---
        const badgeId = 'retry-badge';
        let badge = document.getElementById(badgeId);
        if (this.retryCount[q.id] > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = badgeId;
                badge.className = 'absolute top-4 left-4 bg-orange-500 text-white text-[10px] px-2 py-1 rounded-lg font-black z-20 animate-bounce';
                badge.textContent = 'RETRY';
                const card = document.querySelector('.group.relative.overflow-hidden');
                if (card) card.appendChild(badge);
            }
        } else if (badge) {
            badge.remove();
        }

        this.startTimer();
    },

    startTimer: function () {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.updateTimerUI();

        this.timerInterval = setInterval(() => {
            this.timer -= 1;
            this.updateTimerUI();

            if (this.timer <= 0) {
                clearInterval(this.timerInterval);
                this.handleTimeout();
            }
        }, 1000);
        window.triviaGameInterval = this.timerInterval;
    },

    pauseTimer: function () {
        if (this.timerInterval) clearInterval(this.timerInterval);
    },

    resumeTimer: function () {
        this.startTimer();
    },

    updateTimerUI: function () {
        const text = document.getElementById('timer-text');
        const bar = document.getElementById('timer-bar');

        // Safety: If timer elements are missing, we likely navigated away. Stop the interval.
        if (!text || !bar) {
            if (this.timerInterval) clearInterval(this.timerInterval);
            return;
        }

        text.textContent = this.timer;

        // Offset Calculation (stroke-dasharray for r=42 is 263.89, let's use 264)
        const max = this.getMaxTimer();
        const offset = 264 - (this.timer / max) * 264;
        bar.style.strokeDashoffset = offset;

        // Color Change
        bar.classList.remove('timer-safe', 'timer-warning', 'timer-danger');
        if (this.timer > 10) bar.classList.add('timer-safe');
        else if (this.timer >= 5) bar.classList.add('timer-warning');
        else bar.classList.add('timer-danger');

        // Text color for danger
        text.classList.toggle('text-rose-600', this.timer <= 5);
        if (this.timer <= 5 && this.timer > 0) {
            text.classList.add('animate-pulse');
        } else {
            text.classList.remove('animate-pulse');
        }
    },

    handleAnswer: function (selectedIndex) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        if (this.timerInterval) clearInterval(this.timerInterval);

        const q = this.questions.shift(); // TAKE FROM HEAD
        const buttons = document.querySelectorAll('.option-btn');
        const isCorrect = (selectedIndex + 1) === (q.correct_option);

        if (isCorrect) {
            if (buttons[selectedIndex]) buttons[selectedIndex].classList.add('option-correct');
            const wasSolved = this.solvedIds.has(q.id);
            this.solvedIds.add(q.id);

            this.calculateScore(this.timer);
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak;
            this.flashBackground('correct');
            this.triggerStreakEffects();

            // Check Level Up ONLY if it's a new unique solve
            if (!wasSolved) {
                this.checkLevelUp();
            }
        } else {
            if (buttons[selectedIndex]) buttons[selectedIndex].classList.add('option-wrong');
            if (buttons[q.correct_option - 1]) buttons[q.correct_option - 1].classList.add('option-correct');
            this.streak = 0;
            this.lives--;
            this.flashBackground('wrong');

            // Re-queue
            this.shuffleOptions(q);
            this.questions.push(q);
            this.retryCount[q.id] = (this.retryCount[q.id] || 0) + 1;
            window.showToast('Failed! Added back as a RETRY question.', 'error');
        }

        this.updateHUD();
        this.updateGhostBars();
        this.results.push({ qid: q.id, correct: isCorrect, time: 20 - this.timer });

        // Track stats for normalization
        this.stats.totalAnswered++;
        if (isCorrect) this.stats.totalRemainingTime += this.timer;

        setTimeout(() => {
            this.loadQuestion();
        }, 1200);
    },

    handleTimeout: function () {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const q = this.questions.shift(); // TAKE FROM HEAD
        const buttons = document.querySelectorAll('.option-btn');

        if (buttons[q.correct_option - 1]) {
            buttons[q.correct_option - 1].classList.add('option-correct');
        }

        this.streak = 0;
        this.lives--;
        this.flashBackground('wrong');
        this.updateHUD();
        this.updateGhostBars();
        this.results.push({ qid: q.id, correct: false, time: this.getMaxTimer(), timeout: true });

        this.stats.totalAnswered++;

        // Re-queue
        this.shuffleOptions(q);
        this.questions.push(q);
        this.retryCount[q.id] = (this.retryCount[q.id] || 0) + 1;
        window.showToast('Timeout! Added back as a RETRY question.', 'error');

        setTimeout(() => {
            this.loadQuestion();
        }, 1200);
    },

    calculateScore: function (remainingTime) {
        const base = 100;
        const max = this.getMaxTimer();
        const speedBonus = (remainingTime / max) * 50;
        const streakMultiplier = 1 + (this.streak * 0.1);
        const multiplier = Math.min(streakMultiplier, 2.0); // Cap at 2x

        const points = Math.round((base + speedBonus) * multiplier);
        this.score += points;
    },

    updateHUD: function () {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.textContent = this.score.toString().padStart(4, '0');

        const levelEl = document.getElementById('level-display');
        if (levelEl) levelEl.textContent = this.currentLevel;

        const streakEl = document.getElementById('streak-display');
        if (streakEl) streakEl.textContent = this.streak;

        // Visual heart logic
        const hearts = document.querySelectorAll('#lives-display span');
        hearts.forEach((h, idx) => {
            if (idx >= this.lives) {
                h.classList.replace('text-rose-500', 'text-slate-200');
                h.classList.remove('fill-rose-500');
            } else {
                h.classList.replace('text-slate-200', 'text-rose-500');
                h.classList.add('fill-rose-500');
            }
        });
    },

    flashBackground: function (type) {
        const container = document.getElementById('trivia-game-container');
        if (!container) return;
        const cls = `bg-flash-${type}`;
        container.classList.add(cls);
        setTimeout(() => container.classList.remove(cls), 500);
    },

    triggerStreakEffects: function () {
        const streakHud = document.getElementById('streak-hud');
        if (streakHud) {
            streakHud.classList.remove('streak-pulse');
            void streakHud.offsetWidth; // Trigger reflow
            streakHud.classList.add('streak-pulse');
        }

        // Special confetti milestone
        if (this.streak > 0 && this.streak % 5 === 0) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            window.showToast(`${this.streak} STREAK! 🔥`, 'success');
        }
    },

    endGame: function () {
        this.showView('result');
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.textContent = this.score;

        const finalStreakEl = document.getElementById('final-streak');
        if (finalStreakEl) finalStreakEl.textContent = this.maxStreak;

        const accuracyTextEl = document.getElementById('accuracy-text');
        if (accuracyTextEl) {
            const correctCount = this.results.filter(r => r.correct).length;
            accuracyTextEl.textContent = `You answered ${correctCount} out of ${this.questions.length} correctly.`;
        }

        const resultStatusEl = document.getElementById('result-status');
        if (resultStatusEl) {
            if (this.lives <= 0) {
                resultStatusEl.textContent = "Ran out of lives! Keep practicing.";
            } else {
                resultStatusEl.textContent = "Mission Accomplished! Total dominance.";
            }
        }

        this.updateStopButtonState();
        this.saveResults();
    },

    fetchGhosts: async function () {
        try {
            const params = new URLSearchParams({
                source_type: this.currentSource.type,
                subject_id: this.currentSource.subject_id || '',
                lesson_id: this.currentSource.lesson_id || '',
                topic_id: this.currentSource.topic_id || '',
                exam_id: this.currentSource.exam_id || ''
            });
            const response = await fetch(`api/trivia/get-ghosts.php?${params}`);
            const data = await response.json();
            if (data.success) {
                this.ghostData = data.data;
                this.updateGhostBars(true); // Initial bars
            }
        } catch (e) {
            console.error('Ghost fetch fail:', e);
        }
    },

    getNormalizedScore: function () {
        if (this.stats.totalAnswered === 0) return 0;
        const effectiveCount = this.questionCount || this.totalFetched || 15;

        // 1. Accuracy (600 pts)
        const accuracy = (this.solvedIds.size / effectiveCount) * 600;

        // 2. Speed (250 pts) - Base on correct answers
        const correctCount = this.solvedIds.size;
        const avgSpeed = correctCount > 0 ? (this.stats.totalRemainingTime / correctCount) : 0;
        const speedBonus = (avgSpeed / 20) * 250;

        // 3. Streak (150 pts)
        const streakBonus = (this.maxStreak / effectiveCount) * 150;

        return Math.round(accuracy + speedBonus + streakBonus);
    },

    updateGhostBars: function (initial = false) {
        const today = this.getNormalizedScore();

        const ghosts = [
            { id: 'today', val: today, max: 1000 },
            { id: 'yesterday', val: this.ghostData.yesterday, max: 1000 },
            { id: 'best', val: this.ghostData.best, max: 1000 },
            { id: 'average', val: this.ghostData.average, max: 1000 }
        ];

        ghosts.forEach(g => {
            const bar = document.getElementById(`ghost-${g.id}-bar`);
            const val = document.getElementById(`ghost-${g.id}-val`);
            if (bar) bar.style.width = `${(g.val / 1000) * 100}%`;
            if (val) val.textContent = g.val;

            // Overtake effect
            if (g.id !== 'today' && today > g.val && g.val > 0) {
                bar.parentElement.parentElement.classList.add('overtake-pulse');
                bar.classList.replace('bg-slate-400', 'bg-emerald-400');
            }
        });
    },

    saveResults: async function () {
        const normalized = this.getNormalizedScore();
        const avgRemaining = this.solvedIds.size > 0 ? (this.stats.totalRemainingTime / this.solvedIds.size) : 0;

        try {
            await fetch('api/trivia/save-result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    score: this.score,
                    max_streak: this.maxStreak,
                    questions_answered: this.results.length,
                    level_reached: this.currentLevel,
                    source_type: this.currentSource.type,
                    subject_id: this.currentSource.subject_id,
                    lesson_id: this.currentSource.lesson_id,
                    topic_id: this.currentSource.topic_id,
                    exam_id: this.currentSource.exam_id,
                    // Snapshot data
                    normalized_score: normalized,
                    accuracy: (this.solvedIds.size / (this.questionCount || this.totalFetched || 15)),
                    avg_speed: avgRemaining,
                    correct_count: this.solvedIds.size
                })
            });
        } catch (error) {
            console.error('Failed to save trivia result:', error);
        }
    },

    getMaxTimer: function () {
        if (this.currentLevel === 1) return 20;
        if (this.currentLevel === 2) return 15;
        return 10;
    },

    checkLevelUp: function () {
        const solved = this.solvedIds.size;
        let newLevel = 1;
        if (solved >= 10) newLevel = 3;
        else if (solved >= 5) newLevel = 2;

        if (newLevel > this.currentLevel) {
            this.currentLevel = newLevel;
            this.triggerLevelUp();
        }
    },

    triggerLevelUp: function () {
        const splash = document.getElementById('level-up-splash');
        if (splash) {
            splash.classList.remove('hidden');
            // Bonus Rewards
            this.score += 500;
            if (this.lives < 10) this.lives++;
            this.updateHUD();

            setTimeout(() => {
                splash.classList.add('hidden');
            }, 1500);
        }
    },

    hideTerminateModal: function () {
        const modal = document.getElementById('terminate-modal-overlay');
        if (modal) modal.classList.add('hidden');
        this.resumeTimer();
    },

    terminate: function () {
        this.pauseTimer();
        const modal = document.getElementById('terminate-modal-overlay');
        if (modal) modal.classList.remove('hidden');
    },

    shuffleOptions: function (q) {
        if (!q.options || q.options.length < 2) return q;

        const correctText = q.options[q.correct_option - 1];

        // Fisher-Yates Shuffle
        for (let i = q.options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
        }

        // Update correct_option index
        q.correct_option = q.options.indexOf(correctText) + 1;
        return q;
    },

    setSource: function (type) {
        this.currentSource.type = type;

        const randomBtn = document.getElementById('source-btn-random');
        const categorizedBtn = document.getElementById('source-btn-categorized');
        const filters = document.getElementById('hierarchical-filters');

        if (type === 'random') {
            randomBtn.classList.add('active');
            categorizedBtn.classList.remove('active');
            filters.classList.add('hidden');
        } else {
            randomBtn.classList.remove('active');
            categorizedBtn.classList.add('active');
            filters.classList.remove('hidden');
        }
    },

    setQuestionCount: function (count) {
        this.questionCount = count === 'all' ? 0 : count;
        // Update the description label
        const label = document.getElementById('question-count-label');
        if (label) label.textContent = count === 'all' ? 'All' : count;
        document.querySelectorAll('.question-count-btn').forEach(btn => {
            const btnCount = btn.dataset.count;
            const isActive = (count === 'all') ? btnCount === 'all' : parseInt(btnCount) === count;
            btn.classList.toggle('active', isActive);
            if (isActive) {
                btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md', 'shadow-indigo-200');
                btn.classList.remove('bg-slate-50', 'text-slate-500');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-600', 'shadow-md', 'shadow-indigo-200');
                btn.classList.add('bg-slate-50', 'text-slate-500');
            }
        });
    },

    onHierarchyChange: async function (level) {
        const subjectId = document.getElementById('select-subject').value;
        const lessonId = document.getElementById('select-lesson').value;
        const topicId = document.getElementById('select-topic').value;

        if (level === 'subject') {
            this.resetFilters(['lesson', 'topic', 'exam']);
            if (subjectId) {
                this.updateFilter('lessons', { subject_id: subjectId });
                this.updateFilter('exams', { subject_id: subjectId });
            }
        } else if (level === 'lesson') {
            this.resetFilters(['topic', 'exam']);
            if (lessonId) {
                this.updateFilter('topics', { subject_id: subjectId, lesson_id: lessonId });
                this.updateFilter('exams', { subject_id: subjectId, lesson_id: lessonId });
            }
        } else if (level === 'topic') {
            this.resetFilters(['exam']);
            if (topicId) {
                this.updateFilter('exams', { subject_id: subjectId, lesson_id: lessonId, topic_id: topicId });
            }
        }
    },

    resetFilters: function (levels) {
        levels.forEach(lvl => {
            const select = document.getElementById(`select-${lvl}`);
            const wrapper = document.getElementById(`${lvl}-wrapper`);
            if (select) {
                select.innerHTML = `<option value="">All ${lvl.charAt(0).toUpperCase() + lvl.slice(1)}s</option>`;
                select.disabled = true;
                if (wrapper) wrapper.classList.add('opacity-50');
            }
        });
    },

    updateFilter: async function (type, params) {
        try {
            const query = new URLSearchParams({ type, ...params });
            const resp = await fetch(`api/trivia/get-categories.php?${query}`);
            const data = await resp.json();

            if (data.success) {
                const singularMap = { lessons: 'lesson', topics: 'topic', exams: 'exam' };
                this.populateDropdown(singularMap[type], data.data[type]);
            }
        } catch (e) {
            console.error(`Failed to update ${type}:`, e);
        }
    },

    populateDropdown: function (id, items) {
        const select = document.getElementById(`select-${id}`);
        const wrapper = document.getElementById(`${id}-wrapper`);
        if (!select) return;

        const label = id.charAt(0).toUpperCase() + id.slice(1);
        select.innerHTML = `<option value="">${id === 'subject' ? 'Select ' + label : 'All ' + label + 's'}</option>`;

        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.name;
            select.appendChild(opt);
        });

        select.disabled = false;
        if (wrapper) wrapper.classList.remove('opacity-50');
    },

    confirmTerminate: function () {
        this.resetState();
        this.showView('start');
        const modal = document.getElementById('terminate-modal-overlay');
        if (modal) modal.classList.add('hidden');
        this.updateStopButtonState();
    },

    updateStopButtonState: function () {
        const btn = document.getElementById('stop-button');
        if (!btn) return;

        // Active ONLY during the 'active' view
        const activeView = document.getElementById('game-active-view');
        const isActive = activeView && !activeView.classList.contains('hidden');
        btn.disabled = !isActive;
    },

    reset: function () {
        this.init();
    }
};

// Initialize when the script loads
window.triviaGame.init();
