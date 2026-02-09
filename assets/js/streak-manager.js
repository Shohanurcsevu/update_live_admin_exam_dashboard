class StreakManager {
    constructor() {
        this.streakData = {
            current_streak: 0,
            longest_streak: 0,
            last_activity_date: null
        };
        this.missionProgress = 0;
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
    }

    async init() {
        await this.fetchStreak();
        this.updateUI();
        this.initEmberParticles();
        this.startMissionTracking();
    }

    async fetchStreak() {
        try {
            // Try fetching from API first
            const response = await fetch('api/streak/get-streak.php');
            const result = await response.json();

            if (result.success) {
                this.streakData = result.data;
                // Cache locally
                await idbManager.setMetadata('streak_data', this.streakData);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.warn('Failed to fetch streak from API, using local cache:', error);
            const cached = await idbManager.getMetadata('streak_data');
            if (cached) {
                this.streakData = cached;
            }
        }
    }

    async recordActivity() {
        try {
            const response = await fetch('api/streak/record-activity.php', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                const oldStreak = this.streakData.current_streak;
                this.streakData.current_streak = result.data.current_streak;
                this.streakData.last_activity_date = new Date().toISOString().split('T')[0];

                this.updateUI();

                // Trigger celebration effects
                if (result.data.is_new_day) {
                    this.showSuccessEffects(result.data.current_streak);
                }
            }
        } catch (error) {
            console.error('Failed to record activity:', error);
        }
    }

    updateUI() {
        const counterEl = document.getElementById('streak-counter');
        const countEl = document.getElementById('streak-count');
        const flameEl = document.getElementById('streak-flame-icon');

        if (!counterEl || !countEl || !flameEl) return;

        const streak = this.streakData.current_streak;
        countEl.textContent = streak;

        // Dynamic Colors & Animations
        const color = this.getFlameColor(streak);
        flameEl.style.color = color;

        // Always show the counter if initialized
        counterEl.classList.remove('hidden');
        counterEl.classList.add('flex');

        // Apply Flicker to active streaks
        if (streak > 0) {
            flameEl.classList.add('streak-flicker');
        } else {
            flameEl.classList.remove('streak-flicker');
        }

        // High Streak Pulse
        if (streak >= 7) {
            flameEl.classList.add('streak-high-pulse');
        } else {
            flameEl.classList.remove('streak-high-pulse');
        }

        // Toggle Ember Particles for 30+ streaks
        if (streak >= 30) {
            this.startEmberParticles();
        } else {
            this.stopEmberParticles();
        }
    }

    getFlameColor(streak) {
        if (streak === 0) return '#9ca3af'; // Gray
        if (streak <= 3) return '#fbbf24'; // Yellow
        if (streak <= 7) return '#f97316'; // Orange
        if (streak <= 14) return '#ef4444'; // Red
        if (streak <= 30) return '#a855f7'; // Purple
        return '#3b82f6'; // Blue (Diamond)
    }

    showSuccessEffects(streak) {
        // Confetti for first day or every 7-day milestone
        if (streak === 1 || streak % 7 === 0) {
            if (typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }
    }

    // --- NEW: Radial Mission Progress ---
    startMissionTracking() {
        // Poll for mission progress every 30 seconds
        this.updateRadialProgress();
        setInterval(() => this.updateRadialProgress(), 30000);

        // Also listen for mentor data updates if StudyMentor exists
        if (window.studyMentor) {
            const originalFetch = window.studyMentor.fetchMentorData;
            window.studyMentor.fetchMentorData = async () => {
                await originalFetch.call(window.studyMentor);
                this.updateRadialProgress();
            };
        }
    }

    async updateRadialProgress() {
        try {
            const response = await fetch('api/performance/mastery-trends.php');
            const result = await response.json();

            if (result.success && result.data.subjects) {
                const subjects = result.data.subjects;
                const totalSubjects = subjects.length;
                const conqueredSubjects = (result.data.daily_stats?.exams_created || []).filter(subj => {
                    const taken = (result.data.daily_stats?.exams_taken || []).find(t => t.id === subj.id);
                    return taken && taken.count >= subj.count;
                }).length;

                const progress = totalSubjects > 0 ? (conqueredSubjects / totalSubjects) * 100 : 0;
                this.setRadialProgress(progress);
            }
        } catch (error) {
            console.warn('Failed to fetch mission progress for streak ring');
        }
    }

    setRadialProgress(percent) {
        const ringPath = document.getElementById('streak-ring-path');
        if (!ringPath) return;

        const circumference = 100.5; // 2 * PI * 16 (approx)
        const offset = circumference - (percent / 100) * circumference;
        ringPath.style.strokeDashoffset = offset;

        // Color transition for ring
        if (percent === 100) {
            ringPath.style.stroke = '#22c55e'; // Green when complete
        } else {
            ringPath.style.stroke = 'currentColor';
        }
    }

    // --- NEW: Ember Particle System ---
    initEmberParticles() {
        this.canvas = document.getElementById('streak-ember-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
    }

    startEmberParticles() {
        if (this.animationId) return;
        this.animate();
    }

    stopEmberParticles() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height,
            size: Math.random() * 2 + 1,
            speedY: Math.random() * 1 + 0.5,
            opacity: 1,
            color: Math.random() > 0.5 ? '#f97316' : '#fbbf24'
        };
    }

    animate() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.particles.length < 15 && Math.random() < 0.1) {
            this.particles.push(this.createParticle());
        }

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.y -= p.speedY;
            p.opacity -= 0.01;

            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();

            if (p.opacity <= 0) {
                this.particles.splice(i, 1);
                i--;
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

const streakManager = new StreakManager();
