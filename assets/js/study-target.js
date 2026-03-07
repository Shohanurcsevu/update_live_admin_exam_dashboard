/**
 * Study Target Tracker & Feasibility Planner
 * Handles real-time metrics, feasibility checks, and ECG animation.
 */

const StudyTargetTracker = {
    DAILY_TARGET_HOURS: 12,
    DAILY_TARGET_SECONDS: 12 * 3600,
    updateInterval: null,
    ecgInterval: null,
    firstStartTime: null,
    studiedSeconds: 0,
    subjects: [],
    allSubjects: [],
    efficiency: {},
    currentPaceMultiplier: 1.0,
    protocolActive: false,
    protocolTriggered: false,
    estimatedFinishLabel: "Calculating...",
    paceTimer: null,
    initialized: false,
    lastStudyChangeTime: null,
    rhythmGhostPoints: [],
    recoveryStartTime: null,
    wasFlatline: false,
    currentStatus: "Active Pulse",
    ecgPoints: [],
    ecgFrameCount: 0,
    ecgParticles: [],
    flowOrbFrameCount: 0,
    smoothedBpm: 0,
    sessionTimeline: [],
    yesterdaySessions: [],
    momentumScore: 0,
    serverClockOffset: 0,

    async init() {
        // --- Per-page setup: always re-run to attach to fresh DOM elements ---
        // These are destroyed and recreated on each SPA navigation.
        this.initECG();
        this.initPaceSlider();
        this.initMissionControl();
        this.initFlowOrb();

        // --- One-time setup: guard with initialized flag to prevent duplicate intervals ---
        if (this.initialized) {
            console.log("[ST-TRACKER] Re-attached elements. Intervals and loop already running.");
            return;
        }

        console.log("[ST-TRACKER] First-time initialization (setting intervals)...");
        this.initialized = true;

        await this.fetchAllSubjects(); // Fetch all subjects first
        this.fetchData(true); // Then fetch daily data (force refresh to ensure new fields)
        this.fetchYesterdayProgress(); // Fetch ghost runner data
        this.fetchAIInsights(); // Fetch AI recommendations
        this.fetchSubjectEfficiency(); // Fetch efficiency patterns
        this.fetchEstimatedFinish(); // Fetch server-side finish time estimate
        this.fetchSessionTimeline(); // Fetch session streak timeline
        this.fetchYesterdayGhost(); // Fetch yesterday's sessions for Bio-Sync Ghost
        this.fetchFocusHeatmap(); // Fetch 7-day focus heatmap
        this.startUpdateLoop();
        setInterval(() => {
            this.fetchData();
            this.fetchYesterdayProgress();
            this.fetchSubjectEfficiency();
            this.fetchEstimatedFinish();
            this.fetchSessionTimeline();
            this.fetchFocusHeatmap();
            this.saveRhythmSnapshot(this.ecgPoints); // Feature: Rhythm Memory
        }, 30000);
    },

    async fetchAIInsights() {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-ai-insights.php', 60);

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
            const result = await CacheManager.fetchWithCache('api/exam/subjects.php', 60);
            if (result) {
                this.allSubjects = result || [];
            }
        } catch (error) {
            console.error("Error fetching all subjects:", error);
        }
    },

    async fetchData(forceRefresh = false) {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/daily-study-time.php', 1, forceRefresh);
            if (result) {
                const newSeconds = result.total_today_seconds || 0;

                // --- NEW: Sync Server Clock Offset ---
                if (result.server_time) {
                    this.serverClockOffset = (result.server_time * 1000) - Date.now();
                }

                // --- Sync activity state with DB ---
                if (result.last_active_timestamp) {
                    const serverActivityTime = result.last_active_timestamp;
                    
                    // Always trust server timestamp if it's newer than our local tracker
                    // or if it's the very first time we are loading.
                    if (this.lastStudyChangeTime === null || serverActivityTime > this.lastStudyChangeTime) {
                        this.lastStudyChangeTime = serverActivityTime;
                        console.log("[ST-TRACKER] Synced activity time from server:", new Date(this.lastStudyChangeTime).toLocaleTimeString());
                    }
                }

                // Track study activity changes locally
                if (newSeconds !== this.studiedSeconds) {
                    if (this.studiedSeconds > 0) {
                        // Trigger Defibrillator Surge if coming back from Flatline (20m+ gap)
                        const gapMs = (this.lastStudyChangeTime === null) ? 0 : (Date.now() - this.lastStudyChangeTime);
                        if (gapMs > 20 * 60 * 1000) {
                            this.recoveryStartTime = Date.now();
                            console.log("[ST-TRACKER] Defibrillator Surge Triggered!");
                        }
                    }
                    this.lastStudyChangeTime = Date.now();
                }

                this.studiedSeconds = newSeconds;
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
            const result = await CacheManager.fetchWithCache('api/analytics/get-first-activity.php', 30);
            if (result && result.timestamp) {
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
        this.renderPredictedFinish();

        // --- NEW: Flow Orb Pace State ---
        this.updateFlowOrbState();

        // --- NEW: Sync Profile Progress Ring ---
        if (window.FontPicker && typeof window.FontPicker.updateProgressRing === 'function') {
            window.FontPicker.updateProgressRing();
        }

        // --- NEW: Ghost Runner & Pace Logic ---
        const mainBar = document.getElementById('main-progress-bar');
        const ghostBar = document.getElementById('ghost-progress-bar');
        const percentageEl = document.getElementById('target-percentage');
        const paceEl = document.getElementById('pace-indicator');

        const todayPercent = Math.min(100, (this.studiedSeconds / this.DAILY_TARGET_SECONDS) * 100);

        if (mainBar) mainBar.style.width = `${todayPercent}%`;
        if (percentageEl) percentageEl.textContent = `${Math.round(todayPercent)}%`;

        if (this.yesterdaySeconds !== undefined) {
            const yesterdayPercent = Math.min(100, (this.yesterdaySeconds / this.DAILY_TARGET_SECONDS) * 100);
            if (ghostBar) {
                ghostBar.style.width = `${yesterdayPercent}%`;
            }

            const diffSeconds = this.studiedSeconds - this.yesterdaySeconds;

            // Trigger Comeback Protocol if > 1 hour behind
            if (diffSeconds < -3600 && !this.protocolActive && !this.protocolTriggered) {
                this.showMissionBanner();
            }

            // --- NEW: Time Buffer Logic ---
            const bufferSeconds = secondsUntilMidnight - remainingStudySeconds;
            const absBuffer = Math.abs(bufferSeconds);
            const bufferFormatted = this.formatTime(absBuffer);

            const bufferDisplay = document.getElementById('buffer-time-display');
            const bufferBadge = document.getElementById('buffer-status-badge');
            const bufferIcon = document.getElementById('buffer-status-icon');

            if (bufferDisplay) {
                if (bufferSeconds >= 0) {
                    bufferDisplay.textContent = `+${bufferFormatted}`;
                    bufferDisplay.className = "text-xl font-black text-emerald-600";
                    if (bufferBadge) {
                        bufferBadge.textContent = "Safe Margin";
                        bufferBadge.className = "text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter";
                    }
                    if (bufferIcon) {
                        bufferIcon.textContent = "verified_user";
                        bufferIcon.className = "material-symbols-outlined text-[10px] text-emerald-500";
                    }
                } else {
                    bufferDisplay.textContent = `-${bufferFormatted}`;
                    bufferDisplay.className = "text-xl font-black text-rose-600";
                    if (bufferBadge) {
                        bufferBadge.textContent = "Overdue";
                        bufferBadge.className = "text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter";
                    }
                    if (bufferIcon) {
                        bufferIcon.textContent = "warning";
                        bufferIcon.className = "material-symbols-outlined text-[10px] text-rose-500 animate-pulse";
                    }
                }
            }

            // Keep Pace Indicator for Ghost Runner (Subtle)
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

        // --- Required Pace Auto-Calculation ---
        this.updateRequiredPace(secondsUntilMidnight, remainingStudySeconds);

        this.checkFeasibility(secondsUntilMidnight, remainingStudySeconds);
    },

    updateRequiredPace(secondsUntilMidnight, remainingStudySeconds) {
        const valueEl = document.getElementById('required-pace-value');
        const remainingEl = document.getElementById('required-pace-remaining');
        if (!valueEl) return;

        const hoursLeft = secondsUntilMidnight / 3600;
        const remainingStudyHours = remainingStudySeconds / 3600;

        if (remainingStudySeconds <= 0) {
            valueEl.textContent = 'Done!';
            valueEl.className = 'text-[11px] font-black text-emerald-600 tabular-nums';
            if (remainingEl) {
                remainingEl.textContent = 'Target reached';
                remainingEl.className = 'text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full';
            }
            return;
        }

        if (hoursLeft <= 0.01) {
            valueEl.textContent = '60m/hr';
            valueEl.className = 'text-[11px] font-black text-rose-500 tabular-nums';
            if (remainingEl) {
                remainingEl.textContent = 'Day over';
                remainingEl.className = 'text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full';
            }
            return;
        }

        // Core calculation: how many minutes per hour must be study time
        const minsPerHour = Math.min(60, Math.round((remainingStudyHours / hoursLeft) * 60));

        // Color coding based on intensity
        let colorClass, badgeClass;
        if (minsPerHour <= 45) {
            // Comfortable — plenty of break time
            colorClass = 'text-[11px] font-black text-emerald-600 tabular-nums';
            badgeClass = 'text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full';
        } else if (minsPerHour <= 55) {
            // Pushing it — need focus
            colorClass = 'text-[11px] font-black text-amber-600 tabular-nums';
            badgeClass = 'text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full';
        } else {
            // Near impossible — every minute counts
            colorClass = 'text-[11px] font-black text-rose-500 tabular-nums';
            badgeClass = 'text-[8px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full';
        }

        valueEl.textContent = `${minsPerHour}m/hr`;
        valueEl.className = colorClass;

        if (remainingEl) {
            const rh = Math.floor(remainingStudyHours);
            const rm = Math.round((remainingStudyHours % 1) * 60);
            remainingEl.textContent = rh > 0 ? `${rh}h ${rm}m to study` : `${rm}m to study`;
            remainingEl.className = badgeClass;
        }
    },

    async fetchYesterdayProgress() {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-yesterday-progress.php', 60);
            if (result && result.success) {
                this.yesterdaySeconds = result.yesterday_total_seconds;
            }
        } catch (e) {
            console.error("Ghost Runner Error:", e);
        }
    },

    async fetchYesterdayGhost() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        try {
            const result = await CacheManager.fetchWithCache(`api/analytics/get-session-timeline.php?date=${dateStr}`, 60);
            if (result && result.success) {
                this.yesterdaySessions = result.sessions || [];
                console.log(`[ST-TRACKER] Bio-Sync: Loaded ${this.yesterdaySessions.length} sessions from yesterday`);
            }
        } catch (e) {
            console.error("Bio-Sync Ghost Error:", e);
        }
    },

    isTimeActiveInSessions(hourDecimal, sessionList) {
        if (!sessionList || sessionList.length === 0) return false;
        return sessionList.some(s => {
            const start = s.start_hour;
            const end = s.start_hour + s.duration_hours;
            return hourDecimal >= start && hourDecimal <= end && s.type !== 'break';
        });
    },

    async fetchSubjectEfficiency() {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-subject-efficiency.php', 15);
            if (result) {
                this.efficiency = result;
                this.renderSubjectCards(); // Re-render to show indicators
            }
        } catch (e) {
            console.error("Efficiency API Error:", e);
        }
    },



    async fetchEstimatedFinish(pace = null) {
        const multiplier = pace || this.currentPaceMultiplier || 1.0;
        try {
            const result = await CacheManager.fetchWithCache(`api/analytics/get-estimated-finish.php?pace=${multiplier}`, 2);
            if (result) {
                this.estimatedFinishLabel = result.formatted_time;
                this.renderPredictedFinish();
            }
        } catch (e) {
            console.error("Est. Finish API Error:", e);
        }
    },

    renderPredictedFinish() {
        const clockEl = document.getElementById('predicted-finish-clock');
        if (!clockEl) return;

        clockEl.textContent = this.estimatedFinishLabel;

        const multiplier = this.currentPaceMultiplier || 1.0;

        if (this.estimatedFinishLabel.includes("Goal")) {
            clockEl.className = "text-xl font-black text-emerald-600";
            return;
        }

        if (multiplier > 1) {
            clockEl.className = "text-xl font-black text-emerald-600 animate-pulse";
        } else if (multiplier < 1) {
            clockEl.className = "text-xl font-black text-rose-600 animate-pulse";
        } else {
            clockEl.className = "text-xl font-black text-indigo-600 animate-pulse";
        }
    },

    initPaceSlider() {
        const slider = document.getElementById('pace-slider');
        const label = document.getElementById('pace-multiplier-label');
        const simBar = document.getElementById('sim-ghost-bar');
        const resetBtn = document.getElementById('reset-pace-btn');

        if (!slider) return;

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                slider.value = 1.0;
                slider.dispatchEvent(new Event('input'));
            });
        }

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.currentPaceMultiplier = val;

            if (label) {
                let text = `${val.toFixed(1)}x`;
                if (val === 1.0) text += " (Normal)";
                else if (val > 1.0) text += " (Speed)";
                else text += " (Slow)";
                label.textContent = text;
            }

            // Update Ghost Bar Visibility
            if (simBar) {
                if (val !== 1.0) {
                    simBar.classList.remove('hidden');
                    const dailyTargetSeconds = 12 * 3600;
                    const remainingSeconds = Math.max(0, dailyTargetSeconds - this.studiedSeconds);
                    const currentPercent = (this.studiedSeconds / dailyTargetSeconds) * 100;
                    const simulatedGain = ((remainingSeconds - (remainingSeconds / val)) / dailyTargetSeconds) * 100;

                    if (val > 1.0) {
                        simBar.style.left = `${currentPercent}%`;
                        simBar.style.width = `${simulatedGain}%`;
                        simBar.style.background = 'rgba(16, 185, 129, 0.2)';
                    } else {
                        simBar.style.left = `${currentPercent + (simulatedGain)}%`;
                        simBar.style.width = `${Math.abs(simulatedGain)}%`;
                        simBar.style.background = 'rgba(244, 63, 94, 0.2)';
                    }
                } else {
                    simBar.classList.add('hidden');
                }
            }

            if (this.paceTimer) clearTimeout(this.paceTimer);
            this.paceTimer = setTimeout(() => {
                this.fetchEstimatedFinish(val);
            }, 500);
        });
    },

    initMissionControl() {
        const btn = document.getElementById('initiate-protocol-btn');
        const container = document.getElementById('mission-theme-container');
        const banner = document.getElementById('mission-control-banner');

        if (btn) {
            btn.addEventListener('click', () => {
                this.protocolActive = true;
                if (container) container.classList.add('mission-stealth');
                if (banner) banner.classList.remove('active');
                this.showToast("Comeback Protocol Initiated. Stealth Mode Active.", "info");
            });
        }
    },

    showMissionBanner() {
        const banner = document.getElementById('mission-control-banner');
        if (banner) {
            banner.classList.add('active');
            this.protocolTriggered = true;
            this.showToast("Critical Lag Detected. Initiate Protocol?", "warning");
        }
    },

    showToast(msg, type) {
        console.log(`[ST-TRACKER] ${type.toUpperCase()}: ${msg}`);
    },

    checkFeasibility(timeLeft, studyNeeded) {
        const statusEl = document.getElementById('feasibility-status');
        const iconContainer = document.getElementById('feasibility-icon-container');
        const iconEl = document.getElementById('feasibility-icon');
        const tomorrowContainer = document.getElementById('tomorrow-planner-container');

        if (!statusEl) return;

        if (timeLeft >= studyNeeded) {
            statusEl.textContent = "You can still complete today’s 12-hour target";
            statusEl.className = "text-sm font-bold text-emerald-600 uppercase tracking-wider";
            iconContainer.className = "w-12 h-12 rounded-xl flex items-center justify-center text-white achievable-badge shadow-lg";
            iconEl.textContent = "task_alt";
            tomorrowContainer.classList.remove('hidden');
            this.updateTomorrowPlan(0); // On Track = No Carryover
        } else {
            statusEl.textContent = "Not enough time left today to complete 12 hours";
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

        // Final sanity check: To finish 12h + carryover by midnight, 
        // they MUST start no later than (24 - 12 - carryover) = (12 - carryover)
        startHour = Math.min(startHour, 12 - carryOverHours);

        // Clamp to sane hours (not earlier than 4 AM)
        startHour = Math.max(4, startHour);

        const h = Math.floor(startHour);
        const m = Math.floor((startHour % 1) * 60);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;

        tomorrowStartTimeEl.textContent = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;

        // Visual indicator for carryover
        const label = tomorrowStartTimeEl.previousElementSibling;
        if (carryoverSeconds > 0) {
            tomorrowStartTimeEl.classList.remove('text-emerald-600');
            tomorrowStartTimeEl.classList.add('text-rose-600');
            if (label) label.textContent = "Recovery Start";
        } else {
            tomorrowStartTimeEl.classList.remove('text-rose-600');
            tomorrowStartTimeEl.classList.add('text-emerald-600');
            if (label) label.textContent = "Optimal Start";
        }
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
                <div class="relative h-44 bg-white rounded-xl border border-gray-100 subject-mini-card group transition-all hover:shadow-md overflow-hidden">
                    <div class="h-full overflow-y-auto custom-scrollbar p-4">
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
                    </div>
                    
                    <!-- Hover Overlay -->
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-white/95 p-4 flex flex-col justify-center gap-1 pointer-events-none z-10 backdrop-blur-sm">
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

    // ─── Feature: Rhythm Memory ───────────────────────────────────────────────

    saveRhythmSnapshot(points) {
        if (!points || points.length < 10) return;
        const today = new Date().toISOString().slice(0, 10);
        const key = `ecg_rhythm_${today}`;
        const payload = {
            date: today,
            studiedSeconds: this.studiedSeconds,
            points: points.slice(-150).map(p => Math.round(p.y * 10) / 10)
        };
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) { /* localStorage full, ignore */ }
    },

    loadBestDayRhythm() {
        const today = new Date().toISOString().slice(0, 10);
        let bestKey = null;
        let bestSeconds = 0;

        for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const key = `ecg_rhythm_${dateStr}`;
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const data = JSON.parse(raw);
                    if (data.studiedSeconds > bestSeconds) {
                        bestSeconds = data.studiedSeconds;
                        bestKey = key;
                    }
                }
            } catch (e) { /* ignore parse errors */ }
        }

        if (bestKey) {
            try {
                const data = JSON.parse(localStorage.getItem(bestKey));
                this.rhythmGhostPoints = data.points || [];
                console.log(`[ST-TRACKER] Rhythm Memory: loaded ghost from ${bestKey} (${Math.round(bestSeconds / 3600)}h)`);
            } catch (e) {
                this.rhythmGhostPoints = [];
            }
        }
    },

    // ─── ECG Canvas ──────────────────────────────────────────────────────────

    // ─── ECG Constants ─────────────────────────────────────────────────────────
    ECG_MAX_POINTS: 150,
    ECG_PARTICLE_CAP: 120,
    ECG_GRID_SIZE: 10,
    ECG_CANVAS_HEIGHT: 80,
    ECG_RECOVERY_DURATION_MS: 10000,

    // Fatigue thresholds (ms)
    FATIGUE_FADING_MS:   3 * 60 * 1000,   // 3 minutes
    FATIGUE_CRITICAL_MS: 10 * 60 * 1000,  // 10 minutes
    FATIGUE_FAILING_MS:  15 * 60 * 1000,  // 15 minutes
    FATIGUE_DEAD_MS:     20 * 60 * 1000,  // 20 minutes

    // Heart Rate Zones (mapped to study intensity)
    HEART_RATE_ZONES: [
        { name: 'Flatline', min: 0,  max: 0,  color: '#94a3b8', bgClass: 'bg-gray-100',  textClass: 'text-gray-400'  },
        { name: 'Resting',  min: 1,  max: 59, color: '#64748b', bgClass: 'bg-slate-100', textClass: 'text-slate-500' },
        { name: 'Warm-up',  min: 60, max: 69, color: '#10b981', bgClass: 'bg-emerald-50',textClass: 'text-emerald-600'},
        { name: 'Active',   min: 70, max: 84, color: '#3b82f6', bgClass: 'bg-blue-50',   textClass: 'text-blue-600'  },
        { name: 'Peak',     min: 85, max: 999,color: '#ef4444', bgClass: 'bg-rose-50',   textClass: 'text-rose-500'  },
    ],

    // Color palette for multi-subject waveforms
    SUBJECT_COLORS: [
        { hex: '#3b82f6', rgb: '59, 130, 246' },  // Blue
        { hex: '#10b981', rgb: '16, 185, 129' },   // Emerald
        { hex: '#f59e0b', rgb: '245, 158, 11' },   // Amber
        { hex: '#8b5cf6', rgb: '139, 92, 246' },   // Violet
        { hex: '#ec4899', rgb: '236, 72, 153' },   // Pink
        { hex: '#14b8a6', rgb: '20, 184, 166' },   // Teal
    ],

    // ─── ECG Setup ──────────────────────────────────────────────────────────
    initECG() {
        const canvas = document.getElementById('ecg-canvas');
        if (!canvas) return;

        this.ecgCanvas = canvas;
        this.ecgCtx = canvas.getContext('2d');
        this.ecgContainer = canvas.parentElement;
        this.ecgContainerRoot = canvas.closest('[data-ecg-root]') || canvas.closest('.bg-slate-900\\/5');
        if (!this.ecgPoints) this.ecgPoints = [];

        // Per-subject point buffers (persisted across re-inits)
        if (!this.subjectPointBuffers) this.subjectPointBuffers = [];

        const resizeCanvas = () => {
            if (this.ecgContainer.clientWidth > 0) {
                canvas.width = this.ecgContainer.clientWidth;
                canvas.height = this.ECG_CANVAS_HEIGHT;
            }
        };

        window.removeEventListener('resize', resizeCanvas);
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const animate = () => {
            if (!this.ecgCtx || !document.body.contains(this.ecgCanvas)) return;

            // Fallback for initial zero-width container
            if (this.ecgCanvas.width === 0 && this.ecgContainer.clientWidth > 0) {
                resizeCanvas();
            }

            this.drawECGFrame();
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    },

    // ─── ECG Main Frame Orchestrator ────────────────────────────────────────
    drawECGFrame() {
        const ctx = this.ecgCtx;
        const canvas = this.ecgCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const activeSubjects = this.subjects.filter(s => s.seconds > 0);
        const state = this.calculateECGState(activeSubjects);

        this.updateMomentumLabel(state);
        this.updateBPMDisplay(state);

        this.ecgFrameCount++;
        const frameCount = this.ecgFrameCount;

        // Layer 1: Grid
        this.drawECGGrid(ctx, canvas, state.isFlatline);

        // Layer 2: Bio-Sync Ghost waveform (Yesterday's activity sync)
        this.drawBioSyncGhost(ctx, canvas, frameCount, state);

        // Layer 3: Calculate the new ECG point
        const pointResult = this.calculateECGPoint(canvas, frameCount, state);

        // Sync card border on spike
        this.syncCardBorder(state, pointResult, frameCount);

        // Push new points
        this.ecgPoints.push({ y: pointResult.mainY, time: Date.now() });
        if (this.ecgPoints.length > this.ECG_MAX_POINTS) this.ecgPoints.shift();

        if (!this.ghostPoints) this.ghostPoints = [];
        this.ghostPoints.push({ y: pointResult.ghostY, time: Date.now() });
        if (this.ghostPoints.length > this.ECG_MAX_POINTS) this.ghostPoints.shift();

        // Layer 4: Per-subject waveform overlays
        this.drawSubjectOverlays(ctx, canvas, activeSubjects, state, frameCount);

        // Layer 5: Particles
        this.updateECGParticles(ctx, canvas, state, pointResult);

        // Layer 6: Main ECG line + leading eye
        this.drawECGLine(ctx, canvas, state, frameCount);

        // Layer 7: Flatline overlay
        if (state.isFlatline) {
            this.drawFlatlineOverlay(ctx, canvas, frameCount, state.gapMs);
        }

        // Periodic rhythm snapshot
        if (frameCount % 1800 === 0) {
            this.saveRhythmSnapshot(this.ecgPoints);
        }

        // --- NEW: Sync Active Session Block on Timeline ---
        if (frameCount % 60 === 0) { 
            // Every second (at 60fps), slightly update the width of any active block 
            // This makes the timeline feel alive as you study.
            const activeBlock = document.querySelector('.timeline-block-active');
            if (activeBlock) {
                const now = new Date();
                const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
                const startHour = parseFloat(activeBlock.dataset.startHour);
                if (!isNaN(startHour)) {
                    const widthPercent = Math.max(0.3, ((currentHour - startHour) / 24) * 100);
                    activeBlock.style.width = `${widthPercent}%`;
                }
            }
        }
    },

    // ─── State Calculation ──────────────────────────────────────────────────
    calculateECGState(activeSubjects) {
        const now = Date.now() + this.serverClockOffset;
        const gapMs = (this.lastStudyChangeTime === null) ? 0 : (now - this.lastStudyChangeTime);

        let fatigueFactor = 1.0;
        let statusLabel = 'Active Pulse';
        let statusColorClass = 'text-rose-500 bg-rose-50 border-rose-100/50';

        if (gapMs > this.FATIGUE_DEAD_MS) {
            fatigueFactor = 0;
            statusLabel = 'Signal Lost';
            statusColorClass = 'text-gray-400 bg-gray-100 border-gray-200/50 animate-pulse';
        } else if (gapMs > this.FATIGUE_FAILING_MS) {
            const p = (gapMs - this.FATIGUE_FAILING_MS) / (this.FATIGUE_DEAD_MS - this.FATIGUE_FAILING_MS);
            fatigueFactor = 0.2 * (1 - p);
            statusLabel = 'Failing Sync';
            statusColorClass = 'text-slate-500 bg-slate-100 border-slate-200/50 animate-pulse';
        } else if (gapMs > this.FATIGUE_CRITICAL_MS) {
            const p = (gapMs - this.FATIGUE_CRITICAL_MS) / (this.FATIGUE_FAILING_MS - this.FATIGUE_CRITICAL_MS);
            fatigueFactor = 0.5 - (p * 0.3);
            statusLabel = 'Critical Drift';
            statusColorClass = 'text-amber-600 bg-amber-50 border-amber-100/50 animate-pulse';
        } else if (gapMs > this.FATIGUE_FADING_MS) {
            const p = (gapMs - this.FATIGUE_FADING_MS) / (this.FATIGUE_CRITICAL_MS - this.FATIGUE_FADING_MS);
            fatigueFactor = 1.0 - (p * 0.5);
            statusLabel = 'Fading Rhythm';
            statusColorClass = 'text-rose-400 bg-rose-50 border-rose-100/50';
        }

        const isFlatline = (this.firstStartTime !== null && this.studiedSeconds > 0 && fatigueFactor === 0);

        // Defibrillator Surge
        const isRecovering = this.recoveryStartTime && (Date.now() - this.recoveryStartTime < this.ECG_RECOVERY_DURATION_MS);

        if (isRecovering) {
            const elapsed = Date.now() - this.recoveryStartTime;
            const flicker = Math.sin(elapsed * 0.1) > 0;
            statusLabel = flicker ? 'SYNCING...' : 'SURGE DETECTED';
            statusColorClass = 'text-cyan-600 bg-cyan-50 border-cyan-100/50 animate-pulse font-black';
            fatigueFactor = 1.0 + Math.random() * 0.5;
        }

        // BPM calculation
        const baseBpm = Math.min(95, 50 + (activeSubjects.length - 1) * 5);
        let bpm = isFlatline ? 0 : Math.max(20, baseBpm * fatigueFactor);
        if (isRecovering) bpm += (Math.random() - 0.5) * 40;

        const pulseInterval = isFlatline ? 99999 : Math.round((60 / Math.max(1, bpm)) * 60);

        return { gapMs, fatigueFactor, statusLabel, statusColorClass, isFlatline, isRecovering, bpm, pulseInterval };
    },

    // ─── Momentum Label Update ──────────────────────────────────────────────
    updateMomentumLabel(state) {
        const momentumLabel = document.getElementById('momentum-label');
        this.currentStatus = state.statusLabel;
        if (!momentumLabel) return;

        if (this.protocolActive && !state.isFlatline && !state.isRecovering) {
            momentumLabel.textContent = 'Stealth Mode';
            momentumLabel.className = 'text-[8px] font-bold text-cyan-500 px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-100/50';
        } else {
            momentumLabel.textContent = state.statusLabel;
            momentumLabel.className = `text-[8px] font-bold px-2 py-0.5 rounded-full border ${state.statusColorClass}`;
        }
    },

    // ─── Heart Rate Zone Display ─────────────────────────────────────────────
    updateBPMDisplay(state) {
        const bpmEl = document.getElementById('ecg-bpm-value');
        const zoneEl = document.getElementById('ecg-zone-label');
        if (!bpmEl || !zoneEl) return;

        // Smooth the BPM to prevent jittery numbers (lerp 5% toward actual)
        const targetBpm = Math.round(state.bpm);
        this.smoothedBpm += (targetBpm - this.smoothedBpm) * 0.05;
        const displayBpm = Math.round(this.smoothedBpm);

        // Find matching zone
        const zone = this.HEART_RATE_ZONES.find(z => displayBpm >= z.min && displayBpm <= z.max)
                  || this.HEART_RATE_ZONES[0];

        bpmEl.textContent = state.isFlatline ? '--' : displayBpm;
        bpmEl.style.color = zone.color;

        zoneEl.textContent = state.isFlatline ? 'Offline' : zone.name;
        zoneEl.className = `text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter leading-none mt-0.5 ${zone.bgClass} ${zone.textClass}`;
    },

    // ─── Grid Drawing ───────────────────────────────────────────────────────
    drawECGGrid(ctx, canvas, isFlatline) {
        const gridSize = this.ECG_GRID_SIZE;
        const r = isFlatline ? 100 : 239;
        const g = isFlatline ? 100 : 68;
        const b = isFlatline ? 100 : 68;

        for (let x = 0; x < canvas.width; x += gridSize) {
            const isMajor = x % (gridSize * 5) === 0;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isMajor ? 0.2 : 0.05})`;
            ctx.lineWidth = isMajor ? 1 : 0.5;
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            const isMajor = y % (gridSize * 5) === 0;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isMajor ? 0.2 : 0.05})`;
            ctx.lineWidth = isMajor ? 1 : 0.5;
            ctx.stroke();
        }
    },

    // ─── Bio-Sync Ghost Waveform ───────────────────────────────────────────
    drawBioSyncGhost(ctx, canvas, frameCount, state) {
        if (!this.yesterdaySessions || this.yesterdaySessions.length === 0) return;

        if (!this.ghostPoints) this.ghostPoints = [];
        
        // Draw the ghost trail
        if (this.ghostPoints.length <= 1) return;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'; // Faint grey
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        
        const firstPoint = this.ghostPoints[0];
        ctx.moveTo(0, firstPoint.y);
        
        for (let i = 1; i < this.ghostPoints.length; i++) {
            const x = (i / this.ECG_MAX_POINTS) * canvas.width;
            ctx.lineTo(x, this.ghostPoints[i].y);
        }
        ctx.stroke();

        // Ghost label indicator
        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('PAST SYNC ◈', 4, 8);
    },

    // ─── ECG Point Calculation ──────────────────────────────────────────────
    calculateECGPoint(canvas, frameCount, state) {
        const centerX = canvas.height / 2;
        const studyBoost = this.studiedSeconds / 3600;
        const baseIntensity = 15;
        const targetIntensity = Math.min(35, baseIntensity + studyBoost * 4);
        let intensity = state.isFlatline ? 0 : Math.max(4, targetIntensity * state.fatigueFactor);

        if (state.isRecovering) {
            intensity *= (1.5 + Math.random() * 1.0);
        }

        let mainY = centerX;
        let activeSpike = false;

        if (state.isFlatline) {
            mainY = centerX + Math.sin(frameCount * 0.05) * 2 + (Math.random() - 0.5) * 1.5;
        } else {
            const phase = frameCount % Math.floor(state.pulseInterval);
            if (phase > (state.pulseInterval * 0.2) && phase < (state.pulseInterval * 0.3)) {
                mainY -= intensity * 0.2;
            } else if (phase >= (state.pulseInterval * 0.3) && phase < (state.pulseInterval * 0.35)) {
                mainY += intensity * 0.9;
                activeSpike = true;
            } else if (phase >= (state.pulseInterval * 0.35) && phase < (state.pulseInterval * 0.45)) {
                mainY -= intensity * 1.1;
                activeSpike = true;
            } else if (phase >= (state.pulseInterval * 0.6) && phase < (state.pulseInterval * 0.8)) {
                mainY += intensity * 0.3;
            } else {
                mainY += (Math.random() - 0.5) * 3;
            }
        }

        // --- Bio-Sync Ghost Wave Calculation ---
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        const wasActiveYesterday = this.isTimeActiveInSessions(currentHour, this.yesterdaySessions);
        
        // Ghost follows a steady "Past" rhythm if active yesterday
        const yesterdayBpm = 65; 
        const ghostInterval = Math.round((60 / yesterdayBpm) * 60);
        const ghostCycle = frameCount % ghostInterval;
        let ghostY = centerX;

        if (wasActiveYesterday) {
            const ghostIntensity = 18; 
            if (ghostCycle < 15) {
                const p = ghostCycle / 15;
                ghostY = centerX + Math.sin(p * Math.PI * 2) * (ghostIntensity * 1.1);
            } else if (ghostCycle > 25 && ghostCycle < 40) {
                const p = (ghostCycle - 25) / 15;
                ghostY = centerX - Math.sin(p * Math.PI) * (ghostIntensity * 0.3);
            }
            ghostY += (Math.random() - 0.5) * 1.0;
        } else {
            // Faint flatline for past inactivity
            ghostY = centerX + Math.sin(frameCount * 0.03) * 0.5;
        }

        return { mainY, ghostY, activeSpike, intensity };
    },

    // ─── Accent Color Helper ────────────────────────────────────────────────
    getAccentColors(state, frameCount) {
        if (state.isRecovering) {
            const flicker = Math.sin(frameCount * 0.5) > 0;
            return {
                hex: flicker ? '#06b6d4' : '#ffffff',
                rgb: flicker ? '6, 182, 212' : '255, 255, 255'
            };
        }
        if (state.isFlatline) return { hex: '#94a3b8', rgb: '148, 163, 184' };
        if (this.protocolActive) return { hex: '#22d3ee', rgb: '34, 211, 238' };
        return { hex: '#ef4444', rgb: '239, 68, 68' };
    },

    // ─── Card Border Sync ───────────────────────────────────────────────────
    syncCardBorder(state, pointResult, frameCount) {
        const root = this.ecgContainerRoot;
        if (!root) return;

        const accent = this.getAccentColors(state, frameCount);
        if (pointResult.activeSpike) {
            root.style.transform = 'scale(1.005)';
            root.style.borderColor = `rgba(${accent.rgb}, 0.4)`;
        } else {
            root.style.transform = 'scale(1)';
            root.style.borderColor = 'rgba(15, 23, 42, 0.1)';
        }
    },

    // ─── Subject Waveform Overlays ──────────────────────────────────────────
    drawSubjectOverlays(ctx, canvas, activeSubjects, state, frameCount) {
        if (state.isFlatline || activeSubjects.length <= 1) {
            this.subjectPointBuffers = [];
            return;
        }

        // Ensure one buffer per active subject
        while (this.subjectPointBuffers.length < activeSubjects.length) {
            this.subjectPointBuffers.push([]);
        }

        activeSubjects.forEach((subj, idx) => {
            const color = this.SUBJECT_COLORS[idx % this.SUBJECT_COLORS.length];
            const subjectPhaseOffset = Math.floor(state.pulseInterval * (idx / activeSubjects.length));
            const subjectPhase = (frameCount + subjectPhaseOffset) % Math.floor(state.pulseInterval);

            const subjectIntensity = Math.min(20, 8 + (subj.seconds / 3600) * 3);
            const vertOffset = (idx - (activeSubjects.length - 1) / 2) * 3;

            let sy = (canvas.height / 2) + vertOffset;
            if (subjectPhase >= (state.pulseInterval * 0.3) && subjectPhase < (state.pulseInterval * 0.45)) {
                sy -= subjectIntensity * 1.0;
            } else if (subjectPhase >= (state.pulseInterval * 0.6) && subjectPhase < (state.pulseInterval * 0.8)) {
                sy += subjectIntensity * 0.25;
            } else {
                sy += (Math.random() - 0.5) * 1.5;
            }

            const buf = this.subjectPointBuffers[idx];
            buf.push(sy);
            if (buf.length > this.ECG_MAX_POINTS) buf.shift();

            if (buf.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${color.rgb}, 0.3)`;
                ctx.lineWidth = 1;
                ctx.lineJoin = 'round';
                ctx.moveTo(0, buf[0]);
                for (let i = 1; i < buf.length; i++) {
                    ctx.lineTo((i / this.ECG_MAX_POINTS) * canvas.width, buf[i]);
                }
                ctx.stroke();
            }
        });

        // Trim if subjects dropped
        if (this.subjectPointBuffers.length > activeSubjects.length) {
            this.subjectPointBuffers = this.subjectPointBuffers.slice(0, activeSubjects.length);
        }
    },

    // ─── Particle System ────────────────────────────────────────────────────
    updateECGParticles(ctx, canvas, state, pointResult) {
        const frameCount = this.ecgFrameCount;
        const accent = this.getAccentColors(state, frameCount);

        // Spawn new particles
        if (!state.isFlatline) {
            const burstCount = pointResult.activeSpike
                ? Math.floor(Math.random() * 3) + 3
                : (Math.random() > 0.75 ? 1 : 0);

            const lxNow = (this.ecgPoints.length - 1) / this.ECG_MAX_POINTS * canvas.width;
            for (let i = 0; i < burstCount; i++) {
                this.ecgParticles.push({
                    x: lxNow + (Math.random() - 0.5) * 10,
                    y: pointResult.mainY + (Math.random() - 0.5) * 7,
                    vx: (Math.random() - 0.5) * (pointResult.activeSpike ? 3 : 1.2) - 0.3,
                    vy: (Math.random() - 0.5) * (pointResult.activeSpike ? 8 : 2.5),
                    life: pointResult.activeSpike ? 0.8 + Math.random() * 0.15 : 0.4 + Math.random() * 0.2,
                    size: pointResult.activeSpike ? Math.random() * 2 + 0.6 : Math.random() * 1 + 0.3
                });
            }

            if (this.ecgParticles.length > this.ECG_PARTICLE_CAP) {
                this.ecgParticles.splice(0, this.ecgParticles.length - this.ECG_PARTICLE_CAP);
            }
        }

        // Update & render existing particles
        const colorPrefix = `rgba(${accent.rgb}, `;
        for (let i = this.ecgParticles.length - 1; i >= 0; i--) {
            const p = this.ecgParticles[i];
            ctx.beginPath();
            ctx.fillStyle = colorPrefix + p.life + ')';
            ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2);
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            p.life -= (pointResult.activeSpike ? 0.03 : 0.015);
            if (p.life <= 0) this.ecgParticles.splice(i, 1);
        }
    },

    // ─── Main ECG Line + Leading Eye ────────────────────────────────────────
    drawECGLine(ctx, canvas, state, frameCount) {
        const accent = this.getAccentColors(state, frameCount);
        if (this.ecgPoints.length < 2) return;

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, `rgba(${accent.rgb}, 0.1)`);
        gradient.addColorStop(0.8, `rgba(${accent.rgb}, 0.8)`);
        gradient.addColorStop(1, accent.hex);

        // Build one continuous path (reused for both passes)
        const buildPath = () => {
            ctx.beginPath();
            ctx.moveTo(0, this.ecgPoints[0].y);
            for (let i = 1; i < this.ecgPoints.length; i++) {
                ctx.lineTo((i / this.ECG_MAX_POINTS) * canvas.width, this.ecgPoints[i].y);
            }
        };

        // Glow pass: thicker translucent line (replaces expensive shadowBlur)
        const glowWidth = state.isFlatline ? 6 : 10;
        buildPath();
        ctx.strokeStyle = `rgba(${accent.rgb}, ${state.isFlatline ? 0.15 : 0.2})`;
        ctx.lineWidth = glowWidth;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Sharp line pass
        buildPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = state.isFlatline ? 1.5 : 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Leading Eye (still uses shadowBlur — only 2 arcs, negligible cost)
        const lastPoint = this.ecgPoints[this.ecgPoints.length - 1];
        const lx = (this.ecgPoints.length - 1) / this.ECG_MAX_POINTS * canvas.width;
        ctx.shadowBlur = 20;
        ctx.shadowColor = accent.hex;
        ctx.beginPath();
        ctx.fillStyle = accent.hex;
        ctx.arc(lx, lastPoint.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${accent.rgb}, 0.5)`;
        ctx.arc(lx, lastPoint.y, 7 + Math.sin(frameCount * 0.1) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    },

    // ─── Flatline Overlay ───────────────────────────────────────────────────
    drawFlatlineOverlay(ctx, canvas, frameCount, gapMs) {
        const pulseAlpha = 0.04 + Math.sin(frameCount * 0.05) * 0.03;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const textAlpha = 0.5 + Math.sin(frameCount * 0.05) * 0.4;
        ctx.fillStyle = `rgba(239, 68, 68, ${textAlpha})`;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('▬ SIGNAL LOST — RECONNECT ▬', canvas.width / 2, canvas.height / 2 - 6);
        ctx.font = '7px monospace';
        ctx.fillStyle = `rgba(239, 68, 68, ${textAlpha * 0.6})`;
        const gapFormatted = gapMs > 3600000 ? (gapMs / 3600000).toFixed(1) + 'h' : Math.floor(gapMs / 60000) + 'm';
        ctx.fillText(`No activity detected for ${gapFormatted}`, canvas.width / 2, canvas.height / 2 + 8);
        ctx.textAlign = 'left';
    },

    // ─── Session Streak Timeline ─────────────────────────────────────────────
    async fetchSessionTimeline() {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-session-timeline.php', 10);
            if (result && result.success) {
                this.sessionTimeline = result.sessions || [];
                this.renderSessionTimeline(result.current_hour);
            }
        } catch (e) {
            console.error('[ST-TRACKER] Timeline fetch error:', e);
        }
    },

    renderSessionTimeline(currentHour) {
        const bar = document.getElementById('session-timeline-bar');
        const countEl = document.getElementById('timeline-session-count');
        const nowMarker = document.getElementById('timeline-now-marker');
        if (!bar) return;

        // Expanded high-contrast vibrant color palette
        const colors = [
            { main: 'rgba(59, 130, 246, 0.85)', grad: 'rgba(37, 99, 235, 0.9)' },   // Blue
            { main: 'rgba(16, 185, 129, 0.85)', grad: 'rgba(5, 150, 105, 0.9)' },   // Emerald
            { main: 'rgba(245, 158, 11, 0.85)', grad: 'rgba(217, 119, 6, 0.9)' },   // Amber
            { main: 'rgba(139, 92, 246, 0.85)', grad: 'rgba(124, 58, 237, 0.9)' },  // Violet
            { main: 'rgba(236, 72, 153, 0.85)', grad: 'rgba(219, 39, 119, 0.9)' },  // Pink
            { main: 'rgba(20, 184, 166, 0.85)', grad: 'rgba(13, 148, 136, 0.9)' },  // Teal
            { main: 'rgba(244, 63, 94, 0.85)',  grad: 'rgba(225, 29, 72, 0.9)' },   // Rose
            { main: 'rgba(14, 165, 233, 0.85)', grad: 'rgba(2, 132, 199, 0.9)' },   // Sky
            { main: 'rgba(168, 85, 247, 0.85)', grad: 'rgba(147, 51, 234, 0.9)' },  // Purple
            { main: 'rgba(132, 204, 22, 0.85)', grad: 'rgba(101, 163, 13, 0.9)' },  // Lime
        ];

        // Build a subject → color index map
        const subjectColorMap = {};
        let colorIdx = 0;
        this.sessionTimeline.forEach(s => {
            const subjectKey = (s.subject || 'Session').trim();
            if (!(subjectKey in subjectColorMap)) {
                subjectColorMap[subjectKey] = colorIdx++ % colors.length;
            }
        });

        // Clear old blocks (keep the now marker)
        const oldBlocks = bar.querySelectorAll('.timeline-block');
        oldBlocks.forEach(b => b.remove());

        // Render each session as a positioned block
        this.sessionTimeline.forEach(session => {
            const leftPercent = (session.start_hour / 24) * 100;
            const widthPercent = Math.max(0.3, (session.duration_hours / 24) * 100);
            const ci = subjectColorMap[(session.subject || 'Session').trim()] || 0;
            const palette = colors[ci];

            const block = document.createElement('div');
            const isActive = session.type === 'pomodoro_active';
            const isBreak = session.type === 'break';
            
            block.className = `timeline-block absolute top-0 h-full rounded-sm transition-all cursor-default ${isActive ? 'timeline-block-active z-10' : 'z-0'}`;
            block.style.left = `${leftPercent}%`;
            block.style.width = `${widthPercent}%`;
            block.dataset.startHour = session.start_hour;
            
            if (isBreak) {
                block.style.background = 'linear-gradient(to bottom, rgba(148, 163, 184, 0.4), rgba(100, 116, 139, 0.5))';
                block.style.borderBottom = '1px dashed rgba(255,255,255,0.4)';
            } else {
                block.style.background = `linear-gradient(to bottom, ${palette.main}, ${palette.grad})`;
                block.style.opacity = (session.type === 'exam' || isActive) ? '1.0' : '0.8';
            }

            // Exam/Active sessions get accents
            if (session.type === 'exam') {
                block.style.borderTop = '2px solid rgba(255,255,255,0.6)';
            } else if (isActive) {
                block.style.boxShadow = `0 0 10px ${palette.main}`;
            }

            // Tooltip
            const durationMin = Math.round(session.duration_hours * 60);
            const startH = Math.floor(session.start_hour);
            const startM = Math.round((session.start_hour % 1) * 60);
            const ampm = startH >= 12 ? 'PM' : 'AM';
            const displayH = startH % 12 || 12;
            
            let label = '🍅 Pomodoro';
            if (session.type === 'exam') label = '📝 Exam';
            if (isActive) label = '🔥 ACTIVE FOCUS';
            if (isBreak) label = '☕ Break';

            block.title = `${session.subject || 'Session'}\n${label} · ${isActive ? 'Ongoing' : durationMin + 'm'}\nStarted: ${displayH}:${String(startM).padStart(2, '0')} ${ampm}`;

            bar.appendChild(block);
        });

        // Ensure we have the pulse animation CSS
        if (!document.getElementById('timeline-active-css')) {
            const style = document.createElement('style');
            style.id = 'timeline-active-css';
            style.innerHTML = `
                @keyframes timeline-pulse {
                    0% { opacity: 0.7; }
                    50% { opacity: 1.0; }
                    100% { opacity: 0.7; }
                }
                @keyframes timeline-radar {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(3.5); opacity: 0; }
                }
                @keyframes timeline-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .timeline-block-active {
                    animation: timeline-pulse 2s infinite ease-in-out;
                    background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    background-size: 200% 100%;
                    animation: timeline-pulse 2s infinite ease-in-out, timeline-shimmer 3s infinite linear;
                }
                .timeline-radar-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    animation: timeline-radar 2s infinite;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }

        // Update now marker + clock (use client time for accuracy)
        if (nowMarker) {
            const now = new Date();
            const clientHour = now.getHours() + now.getMinutes() / 60;
            const nowPercent = (clientHour / 24) * 100;
            nowMarker.style.left = `${nowPercent}%`;

            const clockEl = document.getElementById('timeline-now-clock');
            const dotEl = document.getElementById('timeline-now-dot');
            if (clockEl) {
                const h = now.getHours();
                const m = now.getMinutes();
                const ampm = h >= 12 ? 'pm' : 'am';
                const displayH = h % 12 || 12;
                clockEl.textContent = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;

                // Dynamic coloring every hour (cycles through HSL)
                const hue = (h * 15) % 360; 
                const accentColor = `hsl(${hue}, 80%, 45%)`;
                const bgColor = `hsla(${hue}, 80%, 98%, 0.95)`;
                
                clockEl.style.color = accentColor;
                clockEl.style.backgroundColor = bgColor;
                clockEl.style.borderColor = `hsla(${hue}, 80%, 45%, 0.3)`;
                
                if (dotEl) {
                    dotEl.style.backgroundColor = accentColor;
                    dotEl.style.boxShadow = `0 0 8px ${accentColor}`;
                    
                    // Add radar ring if missing
                    if (!dotEl.querySelector('.timeline-radar-ring')) {
                        const ring = document.createElement('div');
                        ring.className = 'timeline-radar-ring';
                        dotEl.appendChild(ring);
                    }
                    const ring = dotEl.querySelector('.timeline-radar-ring');
                    if (ring) ring.style.backgroundColor = accentColor;
                }
            }
        }

        // Update session count
        if (countEl) {
            const count = this.sessionTimeline.length;
            countEl.textContent = `${count} session${count !== 1 ? 's' : ''}`;
        }
    },

    // ─── Focus Heatmap Grid (7×24) ─────────────────────────────────────────
    async fetchFocusHeatmap() {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-focus-heatmap.php', 60);
            if (result && result.success) {
                this.renderFocusHeatmap(result);
            }
        } catch (e) {
            console.error('[ST-TRACKER] Heatmap fetch error:', e);
        }
    },

    renderFocusHeatmap(data) {
        const container = document.getElementById('focus-heatmap-grid');
        const peakBadge = document.getElementById('heatmap-peak-badge');
        if (!container) return;

        const { grid, days, peak_hour, peak_minutes } = data;

        // Update peak badge
        if (peakBadge && peak_hour !== undefined) {
            const h = peak_hour % 12 || 12;
            const ampm = peak_hour >= 12 ? 'PM' : 'AM';
            peakBadge.textContent = `Peak: ${h}${ampm}`;
            peakBadge.className = 'text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full';
        }

        // Intensity color scale (0 = empty, up to peak_minutes or 60)
        const maxMins = Math.max(peak_minutes || 30, 10);
        const getColor = (mins) => {
            if (mins <= 0) return 'rgba(241, 245, 249, 0.6)'; // slate-100
            const ratio = Math.min(1, mins / maxMins);
            if (ratio < 0.25) return `rgba(199, 210, 254, ${0.4 + ratio * 2})`; // indigo-200
            if (ratio < 0.5) return `rgba(165, 180, 252, ${0.5 + ratio})`; // indigo-300
            if (ratio < 0.75) return `rgba(129, 140, 248, ${0.6 + ratio * 0.4})`; // indigo-400
            return `rgba(99, 102, 241, ${0.7 + ratio * 0.3})`; // indigo-500
        };

        // Build grid HTML
        let html = '<div style="display:grid; grid-template-columns: 28px repeat(24, 1fr); gap: 1px; min-width: 400px;">';

        // Header row: empty corner + hour labels
        html += '<div></div>';
        for (let h = 0; h < 24; h++) {
            if (h % 3 === 0) {
                const label = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
                html += `<div style="text-align:center;font-size:7px;font-weight:800;color:#9ca3af;line-height:1;padding-bottom:2px;">${label}</div>`;
            } else {
                html += '<div></div>';
            }
        }

        // Data rows
        for (let d = 0; d < 7; d++) {
            // Day label
            const isToday = d === 6;
            const dayStyle = isToday
                ? 'font-size:8px;font-weight:900;color:#4f46e5;line-height:14px;'
                : 'font-size:8px;font-weight:700;color:#9ca3af;line-height:14px;';
            html += `<div style="${dayStyle}">${days[d]}</div>`;

            // 24 hour cells
            for (let h = 0; h < 24; h++) {
                const mins = grid[d] ? grid[d][h] : 0;
                const bg = getColor(mins);
                const minsRounded = Math.round(mins);
                const hourLabel = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`;
                const tooltip = minsRounded > 0
                    ? `${days[d]} ${hourLabel}: ${minsRounded}m studied`
                    : `${days[d]} ${hourLabel}: No study`;

                html += `<div title="${tooltip}" style="
                    background:${bg};
                    height:14px;
                    border-radius:2px;
                    transition:background 0.3s;
                    cursor:default;
                "></div>`;
            }
        }

        html += '</div>';
        container.innerHTML = html;
    },


    updateFlowOrbState() {
        const container = document.querySelector('.orb-container');
        if (!container) return;

        if (this.yesterdaySeconds === undefined) return;

        const diff = this.studiedSeconds - this.yesterdaySeconds;

        container.classList.remove('orb-heaven', 'orb-struggle', 'orb-neutral');

        if (diff > 1800) {
            container.classList.add('orb-heaven');
            this.orbState = 'heaven';
        } else if (diff < -1800) {
            container.classList.add('orb-struggle');
            this.orbState = 'struggle';
        } else {
            container.classList.add('orb-neutral');
            this.orbState = 'neutral';
        }

        this.momentumScore = this.calculateMomentumScore();
    },

    // ─── Momentum Score (0-100) ──────────────────────────────────────────────
    // Weighted: Progress (40%) + Pace (25%) + Vitality (20%) + Sessions (15%)
    calculateMomentumScore() {
        // Factor 1: Today's progress vs 12h target (0-40 pts)
        const targetSec = (this.targetHours || 12) * 3600;
        const progressRatio = Math.min(1, this.studiedSeconds / targetSec);
        const progressScore = progressRatio * 40;

        // Factor 2: Pace vs yesterday (0-25 pts)
        // Ahead of yesterday = 25, even = 15, behind = 5, no data = 12
        let paceScore = 12;
        if (this.yesterdaySeconds !== undefined && this.yesterdaySeconds > 0) {
            const diff = this.studiedSeconds - this.yesterdaySeconds;
            if (diff > 1800) paceScore = 25;        // 30m+ ahead
            else if (diff > 0) paceScore = 20;       // slightly ahead
            else if (diff > -1800) paceScore = 12;   // close
            else paceScore = 5;                       // behind
        } else if (this.studiedSeconds > 0) {
            paceScore = 18; // studying with no yesterday = decent
        }

        // Factor 3: Vitality / fatigue state (0-20 pts)
        // Use currentStatus from ECG state
        let vitalityScore = 10;
        const status = this.currentStatus || '';
        if (status === 'Active Pulse') vitalityScore = 20;
        else if (status === 'Fading Rhythm') vitalityScore = 14;
        else if (status === 'Critical Drift') vitalityScore = 8;
        else if (status === 'Failing Sync') vitalityScore = 4;
        else if (status === 'Signal Lost') vitalityScore = 0;
        else if (status === 'Stealth Mode') vitalityScore = 18;
        else if (status.includes('SYNCING') || status.includes('SURGE')) vitalityScore = 16;

        // Factor 4: Session count today (0-15 pts)
        // More sessions = better consistency. Cap at 8+ sessions = full marks
        const sessionCount = this.sessionTimeline ? this.sessionTimeline.length : 0;
        const sessionScore = Math.min(15, (sessionCount / 8) * 15);

        return Math.round(Math.min(100, progressScore + paceScore + vitalityScore + sessionScore));
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
            if (!document.body.contains(canvas)) return;
            ctx.clearRect(0, 0, width, height);

            // Set properties based on state
            let speed = 0.02;
            let color = this.protocolActive ? '#22d3ee' : '#ef4444'; // Use Cyan in Stealth Mode
            let viscosity = 0.5;

            if (this.protocolActive) {
                speed = 0.1; // Maximum overdrive
                viscosity = 0.9;
                color = '#a855f7'; // Shift to Violet in Overdrive
            } else if (this.orbState === 'heaven') {
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

            // Momentum Score number in center
            const score = this.momentumScore || 0;
            ctx.globalAlpha = 1;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${score >= 100 ? 11 : 13}px system-ui, sans-serif`;
            // White text with subtle shadow for readability
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(score, centerX, centerY);
            ctx.shadowBlur = 0;

            // Reflection/Gloss (moved above score area)
            ctx.beginPath();
            ctx.arc(centerX - 5, centerY - 8, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fill();

            requestAnimationFrame(animateOrb);
        };

        animateOrb();
    }
};

window.StudyTargetTracker = StudyTargetTracker;
