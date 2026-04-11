class StreakManager {
    constructor() {
        this.streakData = {
            current_streak: 0,
            longest_streak: 0,
            last_activity_date: null,
            freeze_available: 1,
            last_freeze_date: null,
            freeze_used_count: 0
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

    // Logical day starts at 5:00 AM (matches dashboard TIMELINE_START_HOUR)
    // Activity before 5 AM counts as the previous calendar day
    getLogicalDate() {
        const now = new Date();
        if (now.getHours() < 5) {
            now.setDate(now.getDate() - 1);
        }
        return now.toISOString().split('T')[0];
    }

    async init() {
        await this.fetchStreak();
        this.updateUI();
        this.initEmberParticles();
        this.initTrophyParticles();
        this.startMissionTracking();
        this.initHeatCalendar();
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
                this.streakData.last_activity_date = this.getLogicalDate();
                this.streakData.freeze_available = result.data.freeze_available;

                this.updateUI();

                // Trigger celebration effects
                if (result.data.is_new_day) {
                    this.showSuccessEffects(result.data.current_streak);
                }

                // Show freeze notification if a freeze was consumed
                if (result.data.freeze_used) {
                    this.showFreezeNotification(result.data.current_streak);
                }
            }
        } catch (error) {
            console.error('Failed to record activity:', error);
        }
    }

    // Calculate streak risk status: safe, at_risk, or broken
    getStreakRiskInfo() {
        const lastActivity = this.streakData.last_activity_date;
        const streak = this.streakData.current_streak;
        if (!lastActivity || streak === 0) return { status: 'none', hoursLeft: 0 };

        const today = this.getLogicalDate();
        if (lastActivity === today) return { status: 'safe', hoursLeft: 0 };

        // Calculate logical yesterday
        const now = new Date();
        const logicalNow = new Date(now);
        if (logicalNow.getHours() < 5) {
            logicalNow.setDate(logicalNow.getDate() - 1);
        }
        const yesterday = new Date(logicalNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (lastActivity === yesterdayStr) {
            // Streak is at risk — calculate hours until next 5 AM deadline
            const deadline = new Date(now);
            if (now.getHours() >= 5) {
                // Deadline is tomorrow at 5 AM
                deadline.setDate(deadline.getDate() + 1);
            }
            deadline.setHours(5, 0, 0, 0);
            const hoursLeft = Math.max(0, Math.round((deadline - now) / (1000 * 60 * 60)));
            return { status: 'at_risk', hoursLeft };
        }

        // Last activity is older than yesterday — streak will reset on next record
        return { status: 'broken', hoursLeft: 0 };
    }

    updateUI() {
        const counterEl = document.getElementById('streak-counter');
        const countEl = document.getElementById('streak-count');
        const flameEl = document.getElementById('streak-flame-icon');

        if (!counterEl || !countEl || !flameEl) return;

        // Check streak risk status
        const riskInfo = this.getStreakRiskInfo();
        const streak = riskInfo.status === 'broken' ? 0 : this.streakData.current_streak;
        countEl.textContent = streak;

        // Dynamic Colors & Animations
        if (riskInfo.status === 'at_risk') {
            // WARNING STATE: Amber pulsing flame
            flameEl.style.color = '#f59e0b';
            counterEl.classList.add('streak-at-risk');
            flameEl.classList.add('streak-risk-pulse');
            flameEl.classList.remove('streak-high-pulse');
        } else {
            const color = this.getFlameColor(streak);
            flameEl.style.color = color;
            counterEl.classList.remove('streak-at-risk');
            flameEl.classList.remove('streak-risk-pulse');
            
            // High Streak Pulse (only when safe)
            if (streak >= 7) {
                flameEl.classList.add('streak-high-pulse');
            } else {
                flameEl.classList.remove('streak-high-pulse');
            }
        }

        // Always show the counter if initialized
        counterEl.classList.remove('hidden');
        counterEl.classList.add('flex');

        // Apply Flicker to active streaks
        if (streak > 0) {
            flameEl.classList.add('streak-flicker');
        } else {
            flameEl.classList.remove('streak-flicker');
        }

        // Toggle Ember Particles for 30+ streaks
        if (streak >= 30) {
            this.startEmberParticles();
        } else {
            this.stopEmberParticles();
        }

        // Update Tooltip with Progression
        this.updateTooltip(streak, counterEl, riskInfo);

        // --- Trophy Logic ---
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
        let currentTier = { threshold: 0, name: 'Newcomer', color: '#71717a' }; // Default (below 7 days)
        
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

        // --- Freeze Badge Update ---
        const freezeBadge = document.getElementById('trophy-freeze-badge');
        const freezeText = document.getElementById('trophy-freeze-text');
        if (freezeBadge && freezeText) {
            if (this.streakData.freeze_available) {
                freezeBadge.className = 'flex items-center justify-center gap-1.5 py-1.5 px-3 mb-3 rounded-lg border text-[10px] font-bold uppercase tracking-tight bg-blue-50/60 border-blue-200/40 text-blue-600';
                freezeText.textContent = 'Freeze Available';
            } else {
                freezeBadge.className = 'flex items-center justify-center gap-1.5 py-1.5 px-3 mb-3 rounded-lg border text-[10px] font-bold uppercase tracking-tight bg-slate-50/60 border-slate-200/40 text-slate-400';
                freezeText.textContent = 'Freeze Used This Week';
            }
        }
    }

    updateTooltip(streak, counterEl, riskInfo = null) {
        const nextTier = this.getNextTierInfo(streak);
        const lastActivity = this.streakData.last_activity_date;
        const today = this.getLogicalDate();
        const isActiveToday = lastActivity === today;
        const freezeAvailable = this.streakData.freeze_available;

        let tooltip = `Streak: ${streak} days\n`;

        // Risk warning takes priority
        if (riskInfo && riskInfo.status === 'at_risk') {
            tooltip += `⚠️ STREAK AT RISK — ${riskInfo.hoursLeft}h remaining!\n`;
            tooltip += `🔥 Start a session now to save your streak!\n`;
        } else if (!isActiveToday) {
            tooltip += `🔥 COMPLETE A SESSION TO IGNITE TODAY!\n`;
        } else {
            tooltip += `✅ Streak secured for today!\n`;
        }

        // Freeze status
        if (freezeAvailable) {
            tooltip += `❄️ Streak Freeze: Available (1 miss forgiven)\n`;
        } else {
            tooltip += `❄️ Streak Freeze: Used this week\n`;
        }

        if (nextTier) {
            tooltip += `🎯 ${nextTier.daysLeft} days until "${nextTier.name}"`;
        } else {
            tooltip += `👑 ULTIMATE LEGEND STATUS REACHED!`;
        }

        counterEl.title = tooltip;
    }

    getTiers() {
        return [
            { threshold: 7,   name: 'First Week',      color: '#facc15' },   // 🟡 Gold spark
            { threshold: 14,  name: 'Committed',        color: '#f97316' },   // 🟠 Warm orange
            { threshold: 21,  name: 'Three Weeks',      color: '#ef4444' },   // 🔴 Fire red
            { threshold: 30,  name: 'Monthly Legend',    color: '#a855f7' },   // 🟣 Royal purple
            { threshold: 40,  name: 'Relentless',        color: '#3b82f6' },   // 🔵 Electric blue
            { threshold: 50,  name: 'Half Century',      color: '#10b981' },   // 🟢 Emerald
            { threshold: 60,  name: 'Unstoppable',       color: '#06b6d4' },   // 🩵 Cyan
            { threshold: 75,  name: 'Diamond',           color: '#818cf8' },   // 💎 Indigo
            { threshold: 90,  name: 'Quarter Year',      color: '#ec4899' },   // 💖 Pink
            { threshold: 100, name: 'Centurion',         color: '#eab308' },   // 🏅 True gold
            { threshold: 120, name: 'Grandmaster',       color: '#dc2626' },   // ♦️ Deep crimson
            { threshold: 150, name: 'Titan',             color: '#0ea5e9' },   // ⚡ Sky blue
            { threshold: 180, name: 'Half Year',         color: '#14b8a6' },   // 🌊 Teal
            { threshold: 200, name: 'Bicentennial',      color: '#d946ef' },   // 🔮 Fuchsia
            { threshold: 250, name: 'Immortal',          color: '#6366f1' },   // 🪐 Deep indigo
            { threshold: 300, name: 'Eternal',           color: '#059669' },   // 🌲 Forest
            { threshold: 365, name: 'Full Year',         color: '#f59e0b' },   // ☀️ Solar gold
            { threshold: Infinity, name: 'Legendary',    color: '#fbbf24' }    // 👑 Ultimate gold
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

    showFreezeNotification(streak) {
        // Show a toast notification that a freeze was consumed
        if (typeof window.showToast === 'function') {
            window.showToast(`❄️ Streak Freeze used! Your ${streak}-day streak was saved. No more freezes this week.`, 'info');
        }
        
        // Blue snowflake confetti to visually confirm the freeze
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 60,
                spread: 50,
                origin: { y: 0.6 },
                colors: ['#60a5fa', '#93c5fd', '#bfdbfe', '#ffffff']
            });
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

    // ─── Streak Heat Calendar ───
    initHeatCalendar() {
        const counter = document.getElementById('streak-counter');
        const popup = document.getElementById('streak-heat-calendar');
        if (!counter || !popup) return;

        counter.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popup.classList.contains('active');
            if (isOpen) {
                popup.classList.remove('active');
                setTimeout(() => popup.classList.add('hidden'), 200);
            } else {
                popup.classList.remove('hidden');
                // Force reflow before adding active class for animation
                popup.offsetHeight;
                popup.classList.add('active');
                this.fetchAndRenderHeatCalendar();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!counter.contains(e.target)) {
                popup.classList.remove('active');
                setTimeout(() => popup.classList.add('hidden'), 200);
            }
        });
    }

    async fetchAndRenderHeatCalendar() {
        try {
            const response = await fetch('api/streak/get-history.php?days=91');
            const result = await response.json();
            if (result.success) {
                this.renderHeatGrid(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch streak history:', error);
        }
    }

    renderHeatGrid(historyData) {
        const grid = document.getElementById('heat-grid');
        const summary = document.getElementById('heat-cal-summary');
        if (!grid) return;

        // Build a date->hours lookup map
        const dateMap = {};
        historyData.forEach(d => { dateMap[d.date] = d.hours; });

        // Generate 91 days (13 weeks) ending today
        const today = new Date();
        const cells = [];
        let activeDays = 0;
        let totalHours = 0;

        // Find the start: go back to the nearest Monday, 13 weeks ago
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        // Align to Monday
        const dayOfWeek = startDate.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + mondayOffset);

        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            const hours = dateMap[dateStr] || 0;
            const level = this.getHeatLevel(hours);
            
            if (hours > 0) {
                activeDays++;
                totalHours += hours;
            }

            cells.push({ date: dateStr, hours, level });
            current.setDate(current.getDate() + 1);
        }

        // Render grid
        grid.innerHTML = '';
        cells.forEach(cell => {
            const el = document.createElement('span');
            el.className = `heat-cell heat-${cell.level}`;
            el.title = `${cell.date}: ${cell.hours > 0 ? cell.hours + 'h studied' : 'No activity'}`;
            grid.appendChild(el);
        });

        // Update summary
        if (summary) {
            summary.textContent = `${activeDays} active days · ${totalHours.toFixed(0)}h total`;
        }
    }

    getHeatLevel(hours) {
        if (hours <= 0) return 0;
        if (hours < 1) return 1;
        if (hours < 3) return 2;
        if (hours < 5) return 3;
        return 4;
    }
}

const streakManager = new StreakManager();
