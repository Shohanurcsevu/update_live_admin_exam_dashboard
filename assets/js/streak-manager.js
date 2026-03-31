class StreakManager {
    constructor() {
        this.streakData = {
            current_streak: 0,
            longest_streak: 0,
            last_activity_date: null
        };
        this.missionProgress = 0;
        
        // Streak Particles
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;

        // Trophy Particles
        this.trophyParticles = [];
        this.trophyCanvas = null;
        this.trophyCtx = null;
        this.trophyAnimationId = null;
    }

    async init() {
        await this.fetchStreak();
        this.updateUI();
        this.initEmberParticles();
        this.initTrophyParticles();
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

        // Update Tooltip with Progression
        this.updateTooltip(streak, counterEl);

        // --- NEW: Trophy Logic ---
        this.updateTrophyUI(streak);
    }

    updateTrophyUI(streak) {
        const trophyContainer = document.getElementById('header-trophy-container');
        const trophyIcon = document.getElementById('header-trophy-icon');
        const trophyLabel = document.getElementById('header-trophy-label');
        const trophyTierName = document.getElementById('header-trophy-tier-name');
        const trophyFlame = document.getElementById('header-trophy-flame');
        
        // Tooltip detail elements
        const progressBar = document.getElementById('trophy-progress-bar');
        const daysLeftEl = document.getElementById('trophy-days-left');
        const nextTierEl = document.getElementById('trophy-next-tier');

        if (!trophyContainer) return;
        
        // Ensure visible
        trophyContainer.classList.remove('hidden');
        trophyContainer.classList.add('flex');

        // Identify current tier
        const tiers = this.getTiers();
        let currentTier = { threshold: 0, name: 'Iron', color: '#71717a' }; // Default/Low Streak Tier
        
        for (const tier of tiers) {
            if (streak >= tier.threshold) {
                currentTier = tier;
            }
        }

        if (trophyLabel) trophyLabel.textContent = currentTier.name;
        if (trophyTierName) trophyTierName.textContent = currentTier.name;
        
        if (trophyIcon) {
            trophyIcon.style.color = currentTier.color;
            
            // Add sparkle for higher tiers (threshold >= 14 or special names)
            if (currentTier.threshold >= 14) {
                trophyIcon.classList.add('animate-sparkle');
            } else {
                trophyIcon.classList.remove('animate-sparkle');
            }
        }

        // Update Flame Effect
        if (trophyFlame) {
            const fireColor = '#ff4d00'; // Fixed Electric Orange for the flame
            trophyFlame.style.color = fireColor;
            trophyFlame.style.opacity = '1';
            
            // Apply glow effect matching the fire color
            trophyFlame.style.filter = `drop-shadow(0 0 5px ${fireColor})`;
            
            // All tiers now have an "igniting" flame
            trophyFlame.classList.add('streak-flicker');
        }

        // --- NEW: Update Progress Bar & Tooltip Details ---
        const nextInfo = this.getNextTierInfo(streak);
        if (nextInfo && progressBar && daysLeftEl && nextTierEl) {
            // Find current tier threshold (to calculate progress from 0% of current rank)
            const currentThreshold = currentTier.threshold;
            const nextThreshold = nextInfo.threshold;
            
            const totalRequired = nextThreshold - currentThreshold;
            const currentlyDone = streak - currentThreshold;
            const progressPercent = Math.min(100, Math.max(0, (currentlyDone / totalRequired) * 100));

            progressBar.style.width = `${progressPercent}%`;
            daysLeftEl.textContent = `${nextInfo.daysLeft} Day${nextInfo.daysLeft > 1 ? 's' : ''} to next`;
            nextTierEl.textContent = nextInfo.name;
        } else if (!nextInfo && progressBar) {
            // Ultimate Rank Reached
            progressBar.style.width = '100%';
            if (daysLeftEl) daysLeftEl.textContent = 'MAX RANK';
            if (nextTierEl) nextTierEl.textContent = 'LEGENDARY';
        }

        // Remove any special container styling if not applicable
        trophyContainer.classList.remove('border-amber-200', 'bg-amber-50/50');
    }

    updateTooltip(streak, counterEl) {
        const nextTier = this.getNextTierInfo(streak);
        const lastActivity = this.streakData.last_activity_date;
        const today = new Date().toISOString().split('T')[0];
        const isActiveToday = lastActivity === today;

        let tooltip = `Streak: ${streak} days\n`;

        if (!isActiveToday) {
            tooltip += `🔥 COMPLETE A SESSION TO IGNITE TODAY!\n`;
        } else {
            tooltip += `✅ Streak secured for today!\n`;
        }

        if (nextTier) {
            tooltip += `🎯 ${nextTier.daysLeft} days until ${nextTier.name} Tier`;
        } else {
            tooltip += `👑 ULTIMATE LEGEND STATUS REACHED!`;
        }

        counterEl.title = tooltip;
    }

    getTiers() {
        return [
            { threshold: 7, name: 'Yellow', color: '#facc15' },
            { threshold: 14, name: 'Orange', color: '#f97316' },
            { threshold: 21, name: 'Red', color: '#ef4444' },
            { threshold: 28, name: 'Purple', color: '#a855f7' },
            { threshold: 35, name: 'Blue', color: '#3b82f6' },
            { threshold: 42, name: 'Emerald', color: '#10b981' },
            { threshold: 49, name: 'Cyan', color: '#06b6d4' },
            { threshold: 56, name: 'Rose', color: '#f43f5e' },
            { threshold: 63, name: 'Indigo', color: '#6366f1' },
            { threshold: 70, name: 'Violet', color: '#8b5cf6' },
            { threshold: 77, name: 'Pink', color: '#ec4899' },
            { threshold: 84, name: 'Sky', color: '#0ea5e9' },
            { threshold: 91, name: 'Lime', color: '#84cc16' },
            { threshold: 98, name: 'Amber', color: '#f59e0b' },
            { threshold: 105, name: 'Teal', color: '#14b8a6' },
            { threshold: 112, name: 'Fuchsia', color: '#d946ef' },
            { threshold: 119, name: 'Slate', color: '#64748b' },
            { threshold: 126, name: 'Lavender', color: '#a78bfa' },
            { threshold: 133, name: 'Crimson', color: '#dc2626' },
            { threshold: 140, name: 'Cobalt', color: '#2563eb' },
            { threshold: 147, name: 'Forest', color: '#059669' },
            { threshold: Infinity, name: 'Legendary Gold', color: '#facc15' }
        ];
    }

    getNextTierInfo(streak) {
        const tiers = this.getTiers();
        for (const tier of tiers) {
            if (streak < tier.threshold) {
                return {
                    daysLeft: tier.threshold - streak,
                    name: tier.name,
                    threshold: tier.threshold
                };
            }
        }
        return null;
    }

    getFlameColor(streak) {
        if (streak === 0) return '#9ca3af'; // Gray (Inactive)
        const tiers = this.getTiers();
        for (const tier of tiers) {
            if (streak <= tier.threshold) return tier.color;
        }
        return '#facc15'; // Default to Gold
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

    // --- NEW: Trophy Ember System ---
    initTrophyParticles() {
        this.trophyCanvas = document.getElementById('trophy-ember-canvas');
        if (!this.trophyCanvas) return;
        this.trophyCtx = this.trophyCanvas.getContext('2d');
        this.startTrophyParticles();
    }

    startTrophyParticles() {
        if (this.trophyAnimationId) return;
        this.animateTrophy();
    }

    createTrophyParticle() {
        return {
            x: Math.random() * this.trophyCanvas.width,
            y: this.trophyCanvas.height,
            size: Math.random() * 1.5 + 0.5, // Tiny embers
            speedY: Math.random() * 0.8 + 0.3, // Rising speed
            opacity: 1,
            color: '#ff4d00' // Fixed Fire Color
        };
    }

    animateTrophy() {
        if (!this.trophyCtx) return;
        this.trophyCtx.clearRect(0, 0, this.trophyCanvas.width, this.trophyCanvas.height);

        // Emit particles
        if (this.trophyParticles.length < 10 && Math.random() < 0.15) {
            this.trophyParticles.push(this.createTrophyParticle());
        }

        for (let i = 0; i < this.trophyParticles.length; i++) {
            const p = this.trophyParticles[i];
            p.y -= p.speedY;
            p.opacity -= 0.008; // Slower fade

            this.trophyCtx.globalAlpha = p.opacity;
            this.trophyCtx.fillStyle = p.color;
            this.trophyCtx.beginPath();
            this.trophyCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.trophyCtx.fill();

            if (p.opacity <= 0) {
                this.trophyParticles.splice(i, 1);
                i--;
            }
        }

        this.trophyAnimationId = requestAnimationFrame(() => this.animateTrophy());
    }
}

const streakManager = new StreakManager();
