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
    timer: 20,
    timerInterval: null,
    isProcessing: false,
    results: [],
    solvedIds: new Set(),
    retryCount: {}, // Track retries for specific QIDs

    init: async function () {
        this.resetState();
        this.showView('loading');

        try {
            // fetch 15 random questions
            const response = await fetch('api/question/random-trivia.php');
            const data = await response.json();

            if (data.success) {
                this.questions = data.data;
                this.showView('start');
            } else {
                window.showToast('Failed to load questions', 'error');
            }
        } catch (error) {
            console.error('Trivia loading error:', error);
            window.showToast('Failed to connect to trivia server', 'error');
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
        this.timer = 20;
        this.isProcessing = false;
        this.results = [];
        this.solvedIds = new Set();
        this.retryCount = {};
    },

    start: function () {
        if (this.questions.length === 0) return;
        this.showView('active');
        this.updateHUD();
        this.loadQuestion();
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
        this.timer = 20;

        // Update UI
        const progressEl = document.getElementById('question-progress');
        if (progressEl) progressEl.textContent = `SOLVED ${this.solvedIds.size} OF 15`;

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

    updateTimerUI: function () {
        const text = document.getElementById('timer-text');
        const bar = document.getElementById('timer-bar');

        if (!text || !bar) return;

        text.textContent = this.timer;

        // Offset Calculation (stroke-dasharray for r=42 is 263.89, let's use 264)
        const offset = 264 - (this.timer / 20) * 264;
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
            this.solvedIds.add(q.id);
            this.calculateScore(this.timer);
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak;
            this.flashBackground('correct');
            this.triggerStreakEffects();
        } else {
            if (buttons[selectedIndex]) buttons[selectedIndex].classList.add('option-wrong');
            if (buttons[q.correct_option - 1]) buttons[q.correct_option - 1].classList.add('option-correct');
            this.streak = 0;
            this.lives--;
            this.flashBackground('wrong');

            // Re-queue
            this.questions.push(q);
            this.retryCount[q.id] = (this.retryCount[q.id] || 0) + 1;
            window.showToast('Failed! Added back as a RETRY question.', 'error');
        }

        this.updateHUD();
        this.results.push({ qid: q.id, correct: isCorrect, time: 20 - this.timer });

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
        this.results.push({ qid: q.id, correct: false, time: 20, timeout: true });

        // Re-queue
        this.questions.push(q);
        this.retryCount[q.id] = (this.retryCount[q.id] || 0) + 1;
        window.showToast('Timeout! Added back as a RETRY question.', 'error');

        setTimeout(() => {
            this.loadQuestion();
        }, 1200);
    },

    calculateScore: function (remainingTime) {
        const base = 100;
        const speedBonus = (remainingTime / 20) * 50;
        const streakMultiplier = 1 + (this.streak * 0.1);
        const multiplier = Math.min(streakMultiplier, 2.0); // Cap at 2x

        const points = Math.round((base + speedBonus) * multiplier);
        this.score += points;
    },

    updateHUD: function () {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) scoreEl.textContent = this.score.toString().padStart(4, '0');

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

        this.saveResults();
    },

    saveResults: async function () {
        try {
            await fetch('api/trivia/save-result.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    score: this.score,
                    max_streak: this.maxStreak,
                    questions_answered: this.results.length
                })
            });
        } catch (error) {
            console.error('Failed to save trivia result:', error);
        }
    },

    reset: function () {
        this.init();
    }
};

// Initialize when the script loads
window.triviaGame.init();
