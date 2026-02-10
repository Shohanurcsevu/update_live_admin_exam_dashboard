/**
 * Study Target Tracker & Feasibility Planner
 * Handles real-time metrics, feasibility checks, and ECG animation.
 */

const StudyTargetTracker = {
    DAILY_TARGET_HOURS: 15,
    DAILY_TARGET_SECONDS: 15 * 3600,
    updateInterval: null,
    ecgInterval: null,
    firstStartTime: null,
    studiedSeconds: 0,
    subjects: [],
    allSubjects: [],
    efficiency: {},

    async init() {
        console.log("Initializing Study Target Tracker...");
        await this.fetchAllSubjects(); // Fetch all subjects first
        this.fetchData(); // Then fetch daily data
        this.fetchYesterdayProgress(); // Fetch ghost runner data
        this.fetchAIInsights(); // Fetch AI recommendations
        this.fetchSubjectEfficiency(); // Fetch efficiency patterns
        this.startUpdateLoop();
        this.initECG();
        this.initFlowOrb();
        setInterval(() => {
            this.fetchData();
            this.fetchYesterdayProgress();
            this.fetchSubjectEfficiency();
        }, 30000);
    },

    async fetchAIInsights() {
        try {
            const response = await fetch('api/analytics/get-ai-insights.php');
            const result = await response.json();

            if (result.success && result.data) {
                const container = document.getElementById('ai-insights-container');
                const textEl = document.getElementById('ai-recommendation-text');

                if (container && textEl) {
                    textEl.innerHTML = result.data.recommendation.replace(
                        result.data.peak_window,
                        `<span class="text-blue-600 font-black">${result.data.peak_window}</span>`
                    ).replace(
                        result.data.toughest_subject,
                        `<span class="text-indigo-600 font-black">${result.data.toughest_subject}</span>`
                    );
                    container.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error("AI Insights Error:", e);
        }
    },

    async fetchAllSubjects() {
        try {
            const response = await fetch('api/exam/subjects.php');
            const result = await response.json();
            if (result.success) {
                this.allSubjects = result.data || [];
            }
        } catch (error) {
            console.error("Error fetching all subjects:", error);
        }
    },

    async fetchData() {
        try {
            const response = await fetch('api/analytics/daily-study-time.php');
            const result = await response.json();
            if (result.success) {
                this.studiedSeconds = result.total_today_seconds || 0;
                const dailyData = result.subjects || [];

                // Merge dailyData into allSubjects
                this.subjects = this.allSubjects.map(subj => {
                    const daySubj = dailyData.find(d => d.subject_id == subj.id || d.subject_name === subj.subject_name);
                    return {
                        subject_name: subj.subject_name,
                        subject_id: subj.id,
                        seconds: daySubj ? daySubj.seconds : 0,
                        formatted: daySubj ? daySubj.formatted : '0m',
                        session_count: daySubj ? daySubj.session_count : 0
                    };
                });

                // Try to detect first start time if not set
                if (!this.firstStartTime && this.studiedSeconds > 0) {
                    this.detectFirstStartTime();
                }

                this.renderSubjectCards();
            }
        } catch (error) {
            console.error("Error fetching study target data:", error);
        }
    },

    async detectFirstStartTime() {
        // Fallback: Check localStorage first
        const storedStart = localStorage.getItem('study_first_start_today');
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem('study_first_start_date');

        if (storedStart && storedDate === today) {
            this.firstStartTime = new Date(parseInt(storedStart));
            return;
        }

        // Otherwise, fetch from our new first-activity API
        try {
            const response = await fetch('api/analytics/get-first-activity.php');
            const result = await response.json();
            if (result.success && result.timestamp) {
                // Correct for MySQL timestamp format
                this.firstStartTime = new Date(result.timestamp.replace(/-/g, '/'));
                localStorage.setItem('study_first_start_today', this.firstStartTime.getTime());
                localStorage.setItem('study_first_start_date', today);
            } else {
                // If no activity found, we don't set firstStartTime yet
                // But we can back-calculate if they have already studied
                if (this.studiedSeconds > 0) {
                    this.firstStartTime = new Date(Date.now() - (this.studiedSeconds * 1000));
                }
            }
        } catch (e) {
            console.error("Failed to detect first start time:", e);
        }
    },

    startUpdateLoop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => this.updateUI(), 1000);
    },

    updateUI() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);

        const secondsUntilMidnight = Math.max(0, (midnight - now) / 1000);
        const remainingStudySeconds = Math.max(0, this.DAILY_TARGET_SECONDS - this.studiedSeconds);

        // Update DOM
        const studiedEl = document.getElementById('target-studied-hours');
        const remainingEl = document.getElementById('target-remaining-hours');
        const timeLeftEl = document.getElementById('target-time-left');

        if (studiedEl) studiedEl.textContent = this.formatTime(this.studiedSeconds);
        if (remainingEl) remainingEl.textContent = this.formatTime(remainingStudySeconds);
        if (timeLeftEl) {
            const h = Math.floor(secondsUntilMidnight / 3600);
            const m = Math.floor((secondsUntilMidnight % 3600) / 60);
            const s = Math.floor(secondsUntilMidnight % 60);
            timeLeftEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        const firstActivityEl = document.getElementById('first-activity-time');
        if (firstActivityEl && this.firstStartTime) {
            const h = this.firstStartTime.getHours();
            const m = this.firstStartTime.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            firstActivityEl.textContent = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
        }

        // --- NEW: Predicted Finish Clock ---
        this.updatePredictedFinish(remainingStudySeconds);

        // --- NEW: Flow Orb Pace State ---
        this.updateFlowOrbState();

        // --- NEW: Ghost Runner & Pace Logic ---
        const mainBar = document.getElementById('main-progress-bar');
        const ghostBar = document.getElementById('ghost-progress-bar');
        const percentageEl = document.getElementById('target-percentage');
        const paceEl = document.getElementById('pace-indicator');

        const dailyTargetSeconds = 15 * 3600;
        const todayPercent = Math.min(100, (this.studiedSeconds / dailyTargetSeconds) * 100);

        if (mainBar) mainBar.style.width = `${todayPercent}%`;
        if (percentageEl) percentageEl.textContent = `${Math.round(todayPercent)}%`;

        if (this.yesterdaySeconds !== undefined) {
            const yesterdayPercent = Math.min(100, (this.yesterdaySeconds / dailyTargetSeconds) * 100);
            if (ghostBar) {
                ghostBar.style.width = `${yesterdayPercent}%`;
            }

            if (paceEl) {
                const diffSeconds = this.studiedSeconds - this.yesterdaySeconds;
                const absDiff = Math.abs(diffSeconds);
                const diffFormatted = this.formatTime(absDiff);

                paceEl.classList.remove('hidden');
                if (diffSeconds >= 0) {
                    paceEl.textContent = `${diffFormatted} ahead of yesterday`;
                    paceEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
                } else {
                    paceEl.textContent = `${diffFormatted} behind yesterday`;
                    paceEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600";
                }
            }
        }

        this.checkFeasibility(secondsUntilMidnight, remainingStudySeconds);
    },

    async fetchYesterdayProgress() {
        try {
            const response = await fetch('api/analytics/get-yesterday-progress.php');
            const result = await response.json();
            if (result.success) {
                this.yesterdaySeconds = result.data.yesterday_total_seconds;
            }
        } catch (e) {
            console.error("Ghost Runner Error:", e);
        }
    },

    async fetchSubjectEfficiency() {
        try {
            const response = await fetch('api/analytics/get-subject-efficiency.php');
            const result = await response.json();
            if (result.success) {
                this.efficiency = result.data;
                this.renderSubjectCards(); // Re-render to show indicators
            }
        } catch (e) {
            console.error("Efficiency API Error:", e);
        }
    },

    updatePredictedFinish(remainingSeconds) {
        const clockEl = document.getElementById('predicted-finish-clock');
        if (!clockEl) return;

        if (remainingSeconds <= 0) {
            clockEl.textContent = "Goal Reached! 🎉";
            clockEl.className = "text-xs font-black text-emerald-600";
            return;
        }

        // Calculation: Now + Remaining Time + Break Buffer (allow 10% for breaks/distractions)
        const bufferMultiplier = 1.1;
        const totalSecondsToGoal = remainingSeconds * bufferMultiplier;

        const finishDate = new Date();
        finishDate.setSeconds(finishDate.getSeconds() + totalSecondsToGoal);

        const h = finishDate.getHours();
        const m = finishDate.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;

        clockEl.textContent = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
        clockEl.className = "text-xs font-black text-indigo-600 animate-pulse";
    },

    checkFeasibility(timeLeft, studyNeeded) {
        const statusEl = document.getElementById('feasibility-status');
        const iconContainer = document.getElementById('feasibility-icon-container');
        const iconEl = document.getElementById('feasibility-icon');
        const tomorrowContainer = document.getElementById('tomorrow-planner-container');

        if (!statusEl) return;

        if (timeLeft >= studyNeeded) {
            statusEl.textContent = "You can still complete today’s 15-hour target";
            statusEl.className = "text-sm font-bold text-emerald-600 uppercase tracking-wider";
            iconContainer.className = "w-12 h-12 rounded-xl flex items-center justify-center text-white achievable-badge shadow-lg";
            iconEl.textContent = "task_alt";
            tomorrowContainer.classList.add('hidden');
        } else {
            statusEl.textContent = "Not enough time left today to complete 15 hours";
            statusEl.className = "text-sm font-bold text-rose-600 uppercase tracking-wider";
            iconContainer.className = "w-12 h-12 rounded-xl flex items-center justify-center text-white danger-badge shadow-lg stat-pulse";
            iconEl.textContent = "warning";
            tomorrowContainer.classList.remove('hidden');
            this.updateTomorrowPlan(studyNeeded - timeLeft);
        }
    },

    updateTomorrowPlan(carryoverSeconds) {
        const tomorrowStartTimeEl = document.getElementById('tomorrow-start-time');
        if (!tomorrowStartTimeEl) return;

        // Baseline: Use today's first activity time if available, otherwise default to 9 AM
        let baseStartHour = 9;
        if (this.firstStartTime) {
            // Get today's start as a decimal (e.g., 7:30 AM = 7.5)
            baseStartHour = this.firstStartTime.getHours() + (this.firstStartTime.getMinutes() / 60);
        }

        let carryOverHours = carryoverSeconds / 3600;

        // Recommendation: Shift back from their "natural" start time to accommodate extra load
        // We subtract the carryover to ensure they have enough total hours tomorrow.
        let startHour = baseStartHour - carryOverHours;

        // Final sanity check: To finish 15h + carryover by midnight, 
        // they MUST start no later than (24 - 15 - carryover) = (9 - carryover)
        startHour = Math.min(startHour, 9 - carryOverHours);

        // Clamp to sane hours (not earlier than 4 AM)
        startHour = Math.max(4, startHour);

        const h = Math.floor(startHour);
        const m = Math.floor((startHour % 1) * 60);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;

        tomorrowStartTimeEl.textContent = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
    },

    renderSubjectCards() {
        const container = document.getElementById('study-target-subjects');
        if (!container) return;

        if (this.subjects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <p class="text-gray-400 text-sm font-bold">Start a study session to see distribution</p>
                </div>
            `;
            return;
        }

        const remainingTotal = Math.max(0, this.DAILY_TARGET_SECONDS - this.studiedSeconds);
        // Divide remaining load equally among active subjects
        const equalLoad = remainingTotal / this.subjects.length;

        container.innerHTML = this.subjects.map(subject => {
            const studied = this.formatTime(subject.seconds);
            const remaining = this.formatTime(equalLoad);
            const eff = this.efficiency[subject.subject_id] || { status: 'neutral', reason: 'No data' };

            const statusColors = {
                efficient: 'bg-emerald-500',
                grinding: 'bg-amber-500',
                empty: 'bg-rose-500',
                neutral: 'bg-slate-400'
            };

            return `
                <div class="bg-white p-4 rounded-xl border border-gray-100 subject-mini-card group transition-all hover:shadow-md">
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-black text-gray-800 text-sm truncate flex-1">${subject.subject_name}</h4>
                        <div class="flex items-center gap-1" title="${eff.reason}">
                            <span class="efficiency-pulse efficiency-${eff.status}"></span>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                            <span class="text-gray-400">Studied</span>
                            <span class="text-emerald-600">${studied}</span>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                            <span class="text-gray-400">Assigned</span>
                            <span class="text-blue-600">+${remaining}</span>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                         <span class="text-[9px] font-black text-gray-300 uppercase">Sessions: ${subject.session_count}</span>
                         <span class="material-symbols-outlined text-sm text-blue-200">monitoring</span>
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 left-0 w-full h-full bg-white/95 rounded-xl p-4 flex flex-col justify-center gap-1 pointer-events-none">
                        <p class="text-[9px] font-black text-gray-400 uppercase">Efficiency Status</p>
                        <p class="text-[10px] font-bold text-gray-800">${eff.reason}</p>
                        ${eff.accuracy ? `<p class="text-[9px] font-black text-indigo-600 uppercase">Accuracy: ${eff.accuracy}%</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    },

    initECG() {
        const canvas = document.getElementById('ecg-canvas');
        const containerRoot = canvas ? canvas.closest('.bg-slate-900\\/5') : null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        canvas.width = container.clientWidth;
        canvas.height = 80;

        let points = [];
        let particles = [];
        const maxPoints = 150;
        let frameCount = 0;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Pulse intensity based on study today
            const studyBoost = (this.studiedSeconds / 3600);
            const baseIntensity = 15;
            const intensity = Math.min(35, baseIntensity + studyBoost * 4);
            const pulseInterval = Math.max(50, 100 - studyBoost * 8);

            frameCount++;
            let y = canvas.height / 2;
            const phase = frameCount % Math.floor(pulseInterval);

            // Exotic Pulse Logic
            let activeSpike = false;
            if (phase > 10 && phase < 15) {
                y -= intensity * 0.4; // P wave
            } else if (phase >= 15 && phase < 18) {
                y += intensity * 1.8; // QRS Deep Spike
                activeSpike = true;
            } else if (phase >= 18 && phase < 22) {
                y -= intensity * 2.2; // QRS High Spike
                activeSpike = true;
            } else if (phase >= 22 && phase < 26) {
                y += intensity * 0.6; // Recovery
            } else {
                y += (Math.random() - 0.5) * 3; // Nervous baseline
            }

            // Sync card pulse with big spikes
            if (activeSpike && containerRoot) {
                containerRoot.style.transform = 'scale(1.005)';
                containerRoot.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            } else if (containerRoot) {
                containerRoot.style.transform = 'scale(1)';
                containerRoot.style.borderColor = 'rgba(15, 23, 42, 0.1)';
            }

            points.push({ y, time: Date.now() });
            if (points.length > maxPoints) points.shift();

            // Create Spark Particles on spikes
            if (activeSpike && Math.random() > 0.5) {
                particles.push({
                    x: (points.length - 1) / maxPoints * canvas.width,
                    y: y,
                    vx: -Math.random() * 2,
                    vy: (Math.random() - 0.5) * 4,
                    life: 1
                });
            }

            // Draw Neon Grid
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.05)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < canvas.width; i += 30) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            }

            // Draw Particles
            particles.forEach((p, idx) => {
                ctx.beginPath();
                ctx.fillStyle = `rgba(239, 68, 68, ${p.life})`;
                ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
                ctx.fill();
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                if (p.life <= 0) particles.splice(idx, 1);
            });

            // Draw Main ECG Line with Glow
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ef4444';
            ctx.beginPath();

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
            gradient.addColorStop(0.8, 'rgba(239, 68, 68, 0.8)');
            gradient.addColorStop(1, '#ef4444');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';

            for (let i = 0; i < (points.length - 1); i++) {
                const px = (i / maxPoints) * canvas.width;
                const nextPx = ((i + 1) / maxPoints) * canvas.width;
                ctx.moveTo(px, points[i].y);
                ctx.lineTo(nextPx, points[i + 1].y);
            }
            ctx.stroke();

            // Leading Eye
            const lastPoint = points[points.length - 1];
            const lx = (points.length - 1) / maxPoints * canvas.width;

            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.fillStyle = '#ef4444';
            ctx.arc(lx, lastPoint.y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Outer Ring
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            ctx.arc(lx, lastPoint.y, 7 + Math.sin(frameCount * 0.1) * 3, 0, Math.PI * 2);
            ctx.stroke();

            ctx.shadowBlur = 0;
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    },

    updateFlowOrbState() {
        const container = document.querySelector('.orb-container');
        if (!container) return;

        if (this.yesterdaySeconds === undefined) return;

        const diff = this.studiedSeconds - this.yesterdaySeconds;

        container.classList.remove('orb-heaven', 'orb-struggle', 'orb-neutral');

        if (diff > 1800) { // More than 30 mins ahead
            container.classList.add('orb-heaven');
            this.orbState = 'heaven';
        } else if (diff < -1800) { // More than 30 mins behind
            container.classList.add('orb-struggle');
            this.orbState = 'struggle';
        } else {
            container.classList.add('orb-neutral');
            this.orbState = 'neutral';
        }
    },

    initFlowOrb() {
        const canvas = document.getElementById('flow-orb-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 18;

        let angle = 0;
        this.orbState = 'neutral';

        const animateOrb = () => {
            ctx.clearRect(0, 0, width, height);

            // Set properties based on state
            let speed = 0.02;
            let color = '#ef4444'; // Neutral/Red
            let viscosity = 0.5;

            if (this.orbState === 'heaven') {
                speed = 0.08;
                color = '#10b981'; // Emerald
                viscosity = 0.8;
            } else if (this.orbState === 'struggle') {
                speed = 0.01;
                color = '#f59e0b'; // Amber
                viscosity = 0.2;
            }

            angle += speed;

            // Draw Liquid Sphere Background
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
            ctx.fill();

            // Draw Liquid Waves
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.clip();

            // Wave 1
            ctx.beginPath();
            const waveHeight = radius * (1 - viscosity);
            ctx.moveTo(0, centerY + waveHeight);

            for (let x = 0; x <= width; x++) {
                const y = centerY + Math.sin(x * 0.1 + angle) * (radius * 0.2) + (radius * (0.2 - viscosity * 0.4));
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6;
            ctx.fill();

            // Wave 2 (Offset)
            ctx.beginPath();
            ctx.moveTo(0, centerY + waveHeight);
            for (let x = 0; x <= width; x++) {
                const y = centerY + Math.cos(x * 0.15 + angle * 0.8) * (radius * 0.15) + (radius * (0.3 - viscosity * 0.5));
                ctx.lineTo(x, y);
            }
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.4;
            ctx.fill();

            ctx.restore();

            // Reflection/Gloss
            ctx.beginPath();
            ctx.arc(centerX - 5, centerY - 5, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();

            requestAnimationFrame(animateOrb);
        };

        animateOrb();
    }
};

window.StudyTargetTracker = StudyTargetTracker;
