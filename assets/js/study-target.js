/**
 * Study Target Tracker & Feasibility Planner
 * Handles real-time metrics, feasibility checks, and ECG animation.
 */

const StudyTargetTracker = {
    DAILY_TARGET_HOURS: 12,
    DAILY_TARGET_SECONDS: 12 * 3600,
    TIMELINE_START_HOUR: 5, // Timeline cycle: 5 AM to 5 AM
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
    timelineDataLoaded: false, // Guard: don't show break HUD until first fetch
    yesterdaySessions: [],
    yesterdayFullTotalSeconds: 0, // NEW: Static benchmark for Focus Volume
    allTimeBestSeconds: 0, // NEW: Personal Record
    estimatedFinishTimestamp: null, // NEW: For timeline projection
    momentumScore: 0,
    serverClockOffset: 0,
    lastLogTime: 0, // NEW: For client-side rate limiting
    yesterdayBpmLogs: [], // NEW: Persistent ghost logs
    ecgLoopSequence: 0, // NEW: Prevent duplicate loops
    lastStoredBpm: 0,   // NEW: Smart trigger state
    lastStoredStatus: null,
    lastStoredTime: 0,
    currentLogicalDate: null, // NEW: Track date to trigger resets
    hasSonicBoomed: false,   // NEW: For Ghost Runner overtaking effect
    lastVelocity: null,      // NEW: For velocity trend tracking
    lastRawVelocity: null,   // NEW: High-sensitivity trend
    lastResumeTime: null,    // NEW: For Session Depth
    peakVelocity: 0,         // NEW: For Fatigue Drop
    MILESTONE_TITLES: {
        1: "First Spark",
        2: "Steady Pulse",
        3: "Flow State",
        4: "Deep Drive",
        5: "Momentum Core",
        6: "Endurance Peak",
        7: "Unstoppable",
        8: "Limitless",
        9: "Prime Focus",
        10: "Elite Focus",
        11: "Zen Master",
        12: "Legacy Session"
    },
    MILESTONE_PALETTE: ["#f94144","#f3722c","#f8961e","#f9844a","#f9c74f","#90be6d","#43aa8b","#4d908e","#577590","#277da1","#3f37c9","#f72585"],

    // Helper: Convert HEX to RGBA
    hexToRgba(hex, alpha = 1) {
        if (!hex || hex.length < 7) return `rgba(148, 163, 184, ${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    // Helper: Calculate seconds studied yesterday up to a specific 5AM-offset hour
    getYesterdayStudiedAt(targetHour) {
        let totalSeconds = 0;
        this.yesterdaySessions.forEach(session => {
            const start = session.start_hour;
            const end = session.end_hour;

            // Adjust hours for 5AM offset comparison
            const adjTarget = (targetHour < this.TIMELINE_START_HOUR) ? targetHour + 24 : targetHour;
            const adjStart = (start < this.TIMELINE_START_HOUR) ? start + 24 : start;
            const adjEnd = (end < this.TIMELINE_START_HOUR) ? end + 24 : end;

            if (adjTarget > adjStart) {
                const overlapEnd = Math.min(adjTarget, adjEnd);
                const durationHours = overlapEnd - adjStart;
                if (durationHours > 0) {
                    totalSeconds += durationHours * 3600;
                }
            }
        });
        return totalSeconds;
    },

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
        this.fetchYesterdayGhost(); // NEW: Fetch yesterday's BPM history for Ghost Wave
        this.fetchAIInsights(); // Fetch AI recommendations
        this.fetchSubjectEfficiency(); // Fetch efficiency patterns
        this.fetchEstimatedFinish(); // Fetch server-side finish time estimate
        this.fetchSessionTimeline(); // Fetch session streak timeline
        this.fetchYesterdayGhost(); // Fetch yesterday's sessions for Bio-Sync Ghost
        this.fetchFocusHeatmap(); // Fetch 7-day focus heatmap
        this.fetchWeeklyDebt();   // Fetch weekly time debt ledger
        this.startUpdateLoop();
        setInterval(() => {
            this.fetchData();
            this.fetchYesterdayProgress();
            this.fetchSubjectEfficiency();
            this.fetchEstimatedFinish();
            this.fetchSessionTimeline();
            this.fetchFocusHeatmap();
            this.fetchWeeklyDebt();
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
                // --- NEW: Handle Logical Day Transitions (5 AM) ---
                const todayDate = this.getLogicalDate();
                if (this.currentLogicalDate && this.currentLogicalDate !== todayDate) {
                    console.log("[ST-TRACKER] New logical day detected (" + todayDate + "). Resetting daily trackers.");
                    this.firstStartTime = null;
                    this.studiedSeconds = 0;
                    this.lastStudyChangeTime = null;
                    this.recoveryStartTime = null;

                    // Re-fetch all daily and historical data with forceRefresh
                    this.fetchYesterdayProgress();
                    this.fetchYesterdayGhost();
                    this.fetchAIInsights();
                    this.fetchSubjectEfficiency();
                    this.fetchEstimatedFinish();
                    this.fetchSessionTimeline();
                    this.fetchFocusHeatmap();
                    this.detectFirstStartTime(true); // Force refresh on date change
                    this.hasSonicBoomed = false;    // Reset ghost overtaking state
                }
                this.currentLogicalDate = todayDate;

                const serverSeconds = result.total_today_seconds || 0;

                // --- SMART SYNC: Prevent "Sawtooth" jumps ---
                // If we are studying right now, our local counter might be slightly ahead 
                // of what the database just returned (since DB updates are throttled).
                // Only overwrite if the server value is significantly different (> 10s) 
                // or if the server value is actually GREATER than our local estimate.
                if (Math.abs(serverSeconds - this.studiedSeconds) > 10 || serverSeconds > this.studiedSeconds) {
                    this.studiedSeconds = serverSeconds;
                }

                // --- NEW: Handle Yesterday's Static Benchmark & All-Time Best ---
                if (result.yesterday_seconds) {
                    this.yesterdayFullTotalSeconds = result.yesterday_seconds;
                }
                if (result.all_time_best_seconds !== undefined) {
                    this.allTimeBestSeconds = result.all_time_best_seconds;
                }

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
                if (serverSeconds > this.studiedSeconds && this.studiedSeconds > 0) {
                    // Trigger Defibrillator Surge if coming back from Flatline (20m+ gap)
                    const gapMs = (this.lastStudyChangeTime === null) ? 0 : (Date.now() - this.lastStudyChangeTime);
                    if (gapMs > 20 * 60 * 1000) {
                        this.recoveryStartTime = Date.now();
                        console.log("[ST-TRACKER] Defibrillator Surge Triggered!");
                    }
                    this.lastStudyChangeTime = Date.now();
                } else if (this.studiedSeconds === 0 && serverSeconds > 0 && this.lastStudyChangeTime === null) {
                    // Initialization case: trust server time
                    // (already handled by last_active_timestamp sync above, but good to be explicit here)
                }

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
                    this.detectFirstStartTime(forceRefresh);
                }

                this.renderSubjectCards();
            }
        } catch (error) {
            console.error("Error fetching study target data:", error);
        }
    },

    async detectFirstStartTime(forceRefresh = false) {
        const today = this.getLogicalDate();
        const storedDate = localStorage.getItem('study_first_start_date');
        
        // If the stored date doesn't match today, clear stale data
        if (storedDate && storedDate !== today) {
            localStorage.removeItem('study_first_start_today');
            localStorage.removeItem('study_first_start_date');
        }
        
        // Check localStorage (only if not a temporary value)
        const storedStart = localStorage.getItem('study_first_start_today');
        if (storedStart && storedDate === today && !this._firstStartTimeIsTemp) {
            this.firstStartTime = new Date(parseInt(storedStart));
            return;
        }

        // Fetch from server API (always overrides temporary values)
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/get-first-activity.php', 30, forceRefresh);
            if (result && result.timestamp) {
                this.firstStartTime = new Date(result.timestamp.replace(/-/g, '/'));
                this._firstStartTimeIsTemp = false;
                localStorage.setItem('study_first_start_today', this.firstStartTime.getTime());
                localStorage.setItem('study_first_start_date', today);
            } else if (this.studiedSeconds > 0) {
                // No server data — use logical day start (5 AM) for daily density
                const logicalDate = this.getLogicalDate();
                const dayAnchorStr = logicalDate.replace(/-/g, '/') + ' ' + String(this.TIMELINE_START_HOUR).padStart(2, '0') + ':00:00';
                this.firstStartTime = new Date(dayAnchorStr);
                this._firstStartTimeIsTemp = false;
            }
        } catch (e) {
            console.error("Failed to detect first start time:", e);
        }
    },

    // Helper to convert real hour (0-23) to relative timeline percentage (start at 5 AM)
    getRelativeTimelinePercent(h) {
        const relativeHour = (h - this.TIMELINE_START_HOUR + 24) % 24;
        return (relativeHour / 24) * 100;
    },

    // Helper: Get the logical "study date" (rolls over at 5 AM)
    getLogicalDate(offsetDays = 0) {
        const now = new Date(Date.now() + this.serverClockOffset);
        // If it's before 5 AM, our logical "today" is actually yesterday
        if (now.getHours() < this.TIMELINE_START_HOUR) {
            now.setDate(now.getDate() - 1);
        }
        if (offsetDays !== 0) {
            now.setDate(now.getDate() + offsetDays);
        }
        // IMPORTANT: Use local date parts, NOT toISOString() which converts to UTC
        // and shifts the date backwards in UTC+6 timezone during nighttime hours.
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    startUpdateLoop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => this.updateUI(), 1000);
    },

    updateUI() {
        const now = new Date(Date.now() + this.serverClockOffset);
        const rollover = new Date(now.getTime());
        // If it's already past 5 AM, the next rollover is tomorrow at 5 AM
        // If it's before 5 AM, the current rollover is today at 5 AM
        if (now.getHours() >= this.TIMELINE_START_HOUR) {
            rollover.setDate(now.getDate() + 1);
        }
        rollover.setHours(this.TIMELINE_START_HOUR, 0, 0, 0);

        const secondsUntilRollover = Math.max(0, (rollover - now) / 1000);

        // --- NEW: Live Study Time Nudging ---
        const liveActiveBlock = document.querySelector('.timeline-block-active:not(.timeline-block-paused)');
        if (liveActiveBlock) {
            this.studiedSeconds = (this.studiedSeconds || 0) + 1;
            
            // Only set firstStartTime as a TEMPORARY fallback if the async
            // detectFirstStartTime hasn't resolved yet. Don't persist to localStorage
            // — the async function will set the real server value and overwrite this.
            if (!this.firstStartTime) {
                this.firstStartTime = new Date(now.getTime());
                this._firstStartTimeIsTemp = true; // Mark as temporary
            }

            // Track continuous focus start
            if (this.lastResumeTime === null) {
                this.lastResumeTime = now.getTime();
            }
        } else {
            this.lastResumeTime = null;
        }



        const remainingStudySeconds = Math.max(0, this.DAILY_TARGET_SECONDS - this.studiedSeconds);

        // Update DOM
        const studiedEl = document.getElementById('target-studied-hours');
        const remainingEl = document.getElementById('target-remaining-hours');
        const timeLeftEl = document.getElementById('target-time-left');

        if (studiedEl) studiedEl.textContent = this.formatTime(this.studiedSeconds);
        if (remainingEl) remainingEl.textContent = this.formatTime(remainingStudySeconds);
        if (timeLeftEl) {
            const h = Math.floor(secondsUntilRollover / 3600);
            const m = Math.floor((secondsUntilRollover % 3600) / 60);
            const s = Math.floor(secondsUntilRollover % 60);
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

        // --- NEW: Update Session Timeline "Now" Marker (Real-time) ---
        const nowMarker = document.getElementById('timeline-now-marker');
        if (nowMarker) {
            const clientHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
            const nowPercent = this.getRelativeTimelinePercent(clientHour);
            nowMarker.style.left = `${nowPercent}%`;
            nowMarker.classList.remove('hidden');

            const clockEl = document.getElementById('timeline-now-clock');
            const dotEl = document.getElementById('timeline-now-dot');

            // 1. Pulse of Focus: Toggle based on active study session
            const isStudying = document.body.classList.contains('pomo-session-active') || this.momentumScore > 0;
            nowMarker.classList.toggle('now-pulse-active', isStudying);
            nowMarker.classList.toggle('now-pulse-break', !isStudying);

            // --- Subject Aura Sync: Inject active subject color into pulse ---
            if (isStudying && this.activeSubjectPalette) {
                const color = this.activeSubjectPalette.main;
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                nowMarker.style.setProperty('--now-pulse-color', `rgba(${r}, ${g}, ${b}, 0.8)`);
                nowMarker.style.setProperty('--now-pulse-spread', `rgba(${r}, ${g}, ${b}, 0)`);
            } else {
                // Default Cyan for studying if no palette, Amber for break
                nowMarker.style.removeProperty('--now-pulse-color');
                nowMarker.style.removeProperty('--now-pulse-spread');
            }

            if (clockEl) {
                const h = now.getHours();
                const m = now.getMinutes();
                const s = now.getSeconds();
                const ampm = h >= 12 ? 'pm' : 'am';
                const displayH = h % 12 || 12;

                // 2. Live Delta Speedometer: Compare today vs yesterday at this exact minute
                let deltaText = '';
                if (this.yesterdaySessions.length > 0) {
                    const yesterdaySecondsAtThisTime = this.getYesterdayStudiedAt(clientHour);
                    const diff = Math.round((this.studiedSeconds - yesterdaySecondsAtThisTime) / 60); // In minutes
                    if (diff !== 0) {
                        const sign = diff > 0 ? '+' : '';
                        deltaText = ` <span style="opacity:0.7; font-size:0.85em; margin-left:4px" class="${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}">${sign}${diff}m</span>`;
                    }
                }

                clockEl.innerHTML = `<strong style="letter-spacing:0.05em; font-weight:800 !important; color:#0f172a !important;">${displayH}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${ampm}</strong>${deltaText}`;

                // --- Cyber-HUD Style (Red Tag, Black Text) ---
                clockEl.style.textTransform = 'lowercase';
                clockEl.style.fontWeight = '800';
                clockEl.style.fontFamily = "'Inter', 'system-ui', 'Segoe UI', Roboto, sans-serif";

                if (dotEl) {
                    // Marker dot still uses performance colors for clarity (Cyan/Amber)
                    const dotColor = isStudying ? '#06b6d4' : '#f59e0b';
                    dotEl.style.backgroundColor = dotColor;
                    dotEl.style.boxShadow = `0 0 10px ${dotColor}`;
                    const ring = dotEl.querySelector('.timeline-radar-ring');
                    if (ring) ring.style.backgroundColor = dotColor;
                }
            }

            // 3. Yesterday's Ghost Marker: Visual echo of yesterday
            let ghostMarker = document.getElementById('timeline-yesterday-ghost');
            if (!ghostMarker) {
                ghostMarker = document.createElement('div');
                ghostMarker.id = 'timeline-yesterday-ghost';
                ghostMarker.className = 'absolute top-0 w-[2px] h-[40px] bg-slate-400/40 z-0';

                nowMarker.parentElement.appendChild(ghostMarker);
            }
            ghostMarker.style.left = `${nowPercent}%`;

            // Add a small tag to ghost marker if it's over a yesterday session
            const wasStudyingYesterday = this.yesterdaySessions.some(s => clientHour >= s.start_hour && clientHour <= s.end_hour);
            ghostMarker.style.borderLeft = wasStudyingYesterday ? '2px solid rgba(255,255,255,0.8)' : '1px dashed rgba(255,255,255,0.3)';
            ghostMarker.style.opacity = wasStudyingYesterday ? '0.6' : '0.2';

            // --- 4. Next Milestone Ghost Projection (Predictive) ---
            const nextM = Math.floor(this.studiedSeconds / 3600) + 1;
            const remS = (nextM * 3600) - this.studiedSeconds;
            const projH = clientHour + (remS / 3600);
            const projPct = this.getRelativeTimelinePercent(projH);

            let nextGhost = document.getElementById('timeline-next-ghost-milestone');
            if (nextM <= 12 && projH <= 29) {
                if (!nextGhost) {
                    nextGhost = document.createElement('div');
                    nextGhost.id = 'timeline-next-ghost-milestone';
                    nextGhost.className = 'absolute top-0 w-px h-10 z-10 pointer-events-none';
                    nowMarker.parentElement.appendChild(nextGhost);
                }
                const ghostColor = this.MILESTONE_PALETTE[(nextM - 1) % this.MILESTONE_PALETTE.length];
                const icons = ['🥉', '🥈', '🥇', '🏅', '🎖️', '🏆', '🏵️', '💎', '👑', '🌟', '✨', '🔱'];
                const icon = icons[(nextM - 1) % 12];
                const inMins = Math.round(remS / 60);

                nextGhost.style.left = `${projPct}%`;
                nextGhost.style.borderLeft = `2px dashed ${ghostColor}`;
                nextGhost.style.opacity = '0.65'; // Increased from 0.45
                
                nextGhost.innerHTML = `
                    <div class="absolute whitespace-nowrap text-[8px] font-black italic left-[6px] top-1/2 -translate-y-1/2 bg-white/40 px-1.5 py-0.5 rounded-sm backdrop-blur-[3px] flex flex-col items-start leading-tight text-black" 
                         style="border-left: 2px solid ${ghostColor}; pointer-events: none;">
                        <span>${icon} NEXT: ${nextM}h</span>
                        <span class="text-[7px] font-bold mt-0.5 opacity-90">${inMins}m to go</span>
                    </div>
                `;
                nextGhost.classList.remove('hidden');

                // --- 5. Bridging Line (Visual Connector) ---
                let ghostBridge = document.getElementById('timeline-ghost-bridge');
                const gapWidth = projPct - nowPercent;
                
                if (gapWidth > 2) { 
                    if (!ghostBridge) {
                        ghostBridge = document.createElement('div');
                        ghostBridge.id = 'timeline-ghost-bridge';
                        ghostBridge.className = 'absolute top-1/2 -translate-y-1/2 h-px z-0 pointer-events-none';
                        nowMarker.parentElement.appendChild(ghostBridge);
                    }
                    ghostBridge.style.left = `${nowPercent}%`;
                    ghostBridge.style.width = `${gapWidth}%`;
                    ghostBridge.style.borderTop = `2px dashed ${ghostColor}66`; // Increased from 1px @ 44 alpha
                    ghostBridge.innerHTML = ''; 
                    ghostBridge.classList.remove('hidden');
                } else if (ghostBridge) {
                    ghostBridge.classList.add('hidden');
                }
            } else {
                if (nextGhost) nextGhost.classList.add('hidden');
                const ghostBridge = document.getElementById('timeline-ghost-bridge');
                if (ghostBridge) ghostBridge.classList.add('hidden');
            }

            // --- Milestone Glow Engine (Proximity & Reached) ---
            document.querySelectorAll('.timeline-milestone').forEach(ms => {
                const hour = parseFloat(ms.dataset.milestoneHour);
                if (isNaN(hour)) return;

                const diff = hour - clientHour;
                const isReached = clientHour >= hour;
                const isApproaching = diff > 0 && diff <= 0.5; // Within 30 mins

                ms.classList.toggle('milestone-approaching', isApproaching);
                ms.classList.toggle('milestone-reached', isReached);
                
                if (isApproaching) {
                    // Dynamic pulse speed based on proximity (closer = faster)
                    const pulseDur = 0.5 + (diff * 2); // 0.5s to 1.5s
                    ms.style.setProperty('--proximity-pulse-dur', `${pulseDur}s`);
                }
            });

            // --- NEW: Target Projection Line (Fix: pass nowPercent to avoid DOM read blinking) ---
            this.renderPredictedFinish(nowPercent);

            // --- NEW: Break Tracker Line (Real-time dynamic gap) ---
            this.renderBreakTracker(nowPercent);
        }

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

        const projectedBar = document.getElementById('projected-progress-bar');
        if (projectedBar) {
            const projectedSeconds = this.studiedSeconds + (3600 * (this.currentPaceMultiplier || 1.0));
            const projectedPercent = Math.min(100, (projectedSeconds / this.DAILY_TARGET_SECONDS) * 100);
            projectedBar.style.width = `${projectedPercent}%`;
            projectedBar.style.display = (this.studiedSeconds > 0) ? 'block' : 'none';
        }

        if (this.yesterdaySeconds !== undefined) {
            const yesterdayPercent = Math.min(100, (this.yesterdaySeconds / this.DAILY_TARGET_SECONDS) * 100);
            if (ghostBar) {
                ghostBar.style.width = `${yesterdayPercent}%`;
            }

            const now = new Date(Date.now() + this.serverClockOffset);
            const clientHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
            const yesterdayScAtNow = this.getYesterdayStudiedAt(clientHour);
            const diffSeconds = this.studiedSeconds - yesterdayScAtNow;

            // --- NEW: Ghost Runner Phantom Logic ---
            const phantom = document.getElementById('ghost-phantom-runner');
            if (phantom) {
                const yesterdayPercentAtNow = Math.min(100, (yesterdayScAtNow / this.DAILY_TARGET_SECONDS) * 100);
                phantom.style.left = `${yesterdayPercentAtNow}%`;

                // State 1: Behind (Overtaken)
                if (diffSeconds > 0) {
                    phantom.style.opacity = '0.3';
                    phantom.style.filter = 'grayscale(1)';
                    phantom.classList.remove('phantom-warning');

                    // Trigger Sonic Boom?
                    if (!this.hasSonicBoomed) {
                        this.hasSonicBoomed = true;
                        const barContainer = mainBar.parentElement;
                        barContainer.classList.add('sonic-boom-trigger');
                        setTimeout(() => barContainer.classList.remove('sonic-boom-trigger'), 2000);
                        if (typeof showToast === 'function') {
                            showToast("🚀 SONIC BOOM! You just overtook Yesterday's Ghost!", "success");
                        }
                    }
                }
                // State 2: Ahead (Danger)
                else {
                    phantom.style.opacity = '1';
                    phantom.style.filter = 'none';
                    phantom.classList.add('phantom-warning');
                    this.hasSonicBoomed = false; // Reset if ghost passes us again
                }
            }

            // Trigger Comeback Protocol if > 1 hour behind
            if (diffSeconds < -3600 && !this.protocolActive && !this.protocolTriggered) {
                this.showMissionBanner();
            }

            // --- NEW: Time Buffer Logic ---
            const bufferSeconds = secondsUntilRollover - remainingStudySeconds;
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
                    // Overtake celebration logic
                    if (!this.hasOvertakenYesterday && this.yesterdaySeconds > 0) {
                        this.hasOvertakenYesterday = true;
                        if (typeof showToast === 'function') {
                            showToast("🚀 Milestone: You've overtaken yesterday's progress!", 'success');
                        }
                        // Visual bump for the progress bar
                        const mainBar = document.getElementById('main-progress-bar');
                        if (mainBar) {
                            mainBar.classList.add('shadow-[0_0_25px_rgba(34,197,94,0.8)]');
                            setTimeout(() => mainBar.classList.remove('shadow-[0_0_25px_rgba(34,197,94,0.8)]'), 3000);
                        }
                    }
                    paceEl.textContent = `${diffFormatted} ahead of yesterday 🏆`;
                    paceEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-bounce";
                } else {
                    this.hasOvertakenYesterday = false;
                    paceEl.textContent = `${diffFormatted} behind yesterday`;
                    paceEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600";
                }
            }
        }

        // --- Required Pace Auto-Calculation ---
        this.updateRequiredPace(secondsUntilRollover, remainingStudySeconds);

        this.checkFeasibility(secondsUntilRollover, remainingStudySeconds);

        // --- Smooth Timeline Growth ---
        // Only grow ACTIVE (not paused) sessions
        const hasRunningSession = this.sessionTimeline && this.sessionTimeline.some(s =>
            s.type === 'pomodoro_active' || s.type === 'break'
        );
        const activeBlock = document.querySelector('.timeline-block-active');
        if (hasRunningSession && activeBlock && activeBlock.dataset.startHour) {
            const now = new Date(Date.now() + this.serverClockOffset);
            const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
            const startHour = parseFloat(activeBlock.dataset.startHour);
            if (!isNaN(startHour)) {
                const hourDiff = (currentHour - startHour + 24) % 24;
                const widthPercent = Math.max(0.3, (hourDiff / 24) * 100);
                activeBlock.style.width = `${widthPercent}%`;
            }
        }

        // Grow the paused GAP block (dashed bar) in real-time
        const pausedGapBlock = document.querySelector('.timeline-paused-gap');
        if (pausedGapBlock && pausedGapBlock.dataset.startHour) {
            const gapStart = parseFloat(pausedGapBlock.dataset.startHour);
            const clientHr = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
            const serverHr = clientHr; // 'now' is already server-time corrected at line 602
            let gapDuration = serverHr - gapStart;
            if (gapDuration < 0) gapDuration += 24;
            if (gapDuration > 18) gapDuration = 0.01;
            pausedGapBlock.style.width = `${Math.max(0.3, (gapDuration / 24) * 100)}%`;
            // Update tooltip
            const gapMin = Math.round(gapDuration * 60);
            pausedGapBlock.title = `⏸ Paused · ${gapMin}m`;
            const label = pausedGapBlock.querySelector('.timeline-gap-label');
            if (label) label.textContent = `${gapMin}m break`;
        }

        this.updateBioSyncDisplay();
        this.updateFlowOrbState();

        // --- Intelligence Features (throttled to ~10s, error-isolated) ---
        if (this._intellTick === undefined) this._intellTick = 9; // Fire on first tick
        this._intellTick++;
        if (this._intellTick % 10 === 0) {
            try { this.predictFocusCliff(); } catch (e) { console.warn('[ST] FocusCliff err:', e); }
            try { this.checkSubjectRotation(); } catch (e) { console.warn('[ST] Rotation err:', e); }
            try { this.updateCompletionOdds(); } catch (e) { console.warn('[ST] Odds err:', e); }
            try { this.updateDailyStreak(); } catch (e) { console.warn('[ST] Streak err:', e); }
        }

        // High-frequency updates: run every second
        try { this.updateVelocity(); } catch (e) { console.warn('[ST] Velocity err:', e); }
        try { this.updateSessionEndurance(); } catch (e) { console.warn('[ST] Focus Volume err:', e); }
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
            const yesterday = this.getLogicalDate(-1);
            const result = await CacheManager.fetchWithCache(`api/analytics/get-yesterday-progress.php?date=${yesterday}`, 60);
            if (result && result.success) {
                this.yesterdaySeconds = result.yesterday_total_seconds;
            }
        } catch (e) {
            console.error("Ghost Runner Error:", e);
        }
    },

    async fetchYesterdayGhost() {
        try {
            const date = this.getLogicalDate(-1);
            const res = await fetch(`api/analytics/get-ghost-bpm.php?date=${date}`);
            const result = await res.json();

            if (result && result.success) {
                this.yesterdayBpmLogs = result.logs || [];
                console.log(`[ST-TRACKER] Ghost Rhythm Synced: ${this.yesterdayBpmLogs.length} points from database.`);
            } else {
                this.yesterdayBpmLogs = [];
            }
        } catch (e) {
            console.error("[ST-TRACKER] Ghost Sync Error:", e);
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
            // Realistic Case (Actual pace)
            const result = await CacheManager.fetchWithCache(`api/analytics/get-estimated-finish.php?pace=${multiplier}`, 2);
            if (result) {
                this.estimatedFinishLabel = result.formatted_time;
                this.estimatedFinishTimestamp = result.finish_timestamp;

                // Best Case (assuming 1.2x of current multiplier if multiplier is 1.0, or just regular boost)
                const bestMultiplier = Math.max(1.1, multiplier * 1.1);
                const bestResult = await CacheManager.fetchWithCache(`api/analytics/get-estimated-finish.php?pace=${bestMultiplier}`, 5);
                if (bestResult) {
                    this.bestCaseFinishLabel = bestResult.formatted_time;
                }

                this.renderPredictedFinish();
            }
        } catch (e) {
            console.error("Est. Finish API Error:", e);
        }
    },

    renderPredictedFinish(forcedNowPercent = null) {
        const clockEl = document.getElementById('predicted-finish-clock');
        if (!clockEl) return;

        clockEl.textContent = this.estimatedFinishLabel;

        // Best Case Badge
        let bestCaseEl = document.getElementById('best-case-finish');
        if (this.bestCaseFinishLabel && !this.estimatedFinishLabel.includes("Goal")) {
            if (!bestCaseEl) {
                const parent = clockEl.parentElement;
                bestCaseEl = document.createElement('div');
                bestCaseEl.id = 'best-case-finish';
                bestCaseEl.className = 'text-[9px] font-bold text-emerald-500 mt-1 uppercase tracking-tighter';
                parent.appendChild(bestCaseEl);
            }
            bestCaseEl.innerHTML = `<span class="opacity-60">Best Case:</span> ${this.bestCaseFinishLabel} <span class="material-symbols-outlined text-[10px]">rocket_launch</span>`;
            bestCaseEl.style.display = 'block';
        } else if (bestCaseEl) {
            bestCaseEl.style.display = 'none';
        }

        const multiplier = this.currentPaceMultiplier || 1.0;

        if (this.estimatedFinishLabel.includes("Goal")) {
            clockEl.className = "text-xl font-black text-emerald-600";
            // Hide milestone and projection if goal reached
            const milestone = document.getElementById('timeline-predicted-finish-milestone');
            const projection = document.getElementById('timeline-target-projection');
            if (milestone) milestone.style.display = 'none';
            if (projection) projection.style.display = 'none';
            return;
        }

        if (multiplier > 1) {
            clockEl.className = "text-xl font-black text-emerald-600 animate-pulse";
        } else if (multiplier < 1) {
            clockEl.className = "text-xl font-black text-rose-600 animate-pulse";
        } else {
            clockEl.className = "text-xl font-black text-indigo-600 animate-pulse";
        }

        // --- NEW: Render Visual Milestone on Timeline ---
        const bar = document.getElementById('session-timeline-bar');
        if (bar && this.estimatedFinishTimestamp) {
            const finishDate = new Date(this.estimatedFinishTimestamp * 1000);
            const finishHour = finishDate.getHours() + finishDate.getMinutes() / 60;
            const finishPercent = this.getRelativeTimelinePercent(finishHour);

            let milestone = document.getElementById('timeline-predicted-finish-milestone');
            if (!milestone) {
                milestone = document.createElement('div');
                milestone.id = 'timeline-predicted-finish-milestone';
                milestone.className = 'timeline-milestone absolute z-20 flex flex-col items-center';
                bar.parentElement.appendChild(milestone);
            }
            milestone.style.left = `${finishPercent}%`;
            milestone.style.top = '0';
            milestone.style.pointerEvents = 'none';

            // --- Focus Cliff Warning Integration ---
            let isPostCliff = false;
            if (this.focusCliffHour !== null) {
                const adjFinish = (finishHour - this.TIMELINE_START_HOUR + 24) % 24;
                const adjCliff = (this.focusCliffHour - this.TIMELINE_START_HOUR + 24) % 24;
                if (adjFinish > adjCliff) isPostCliff = true;
            }
            milestone.classList.toggle('milestone-post-cliff', isPostCliff);

            // Format finish time (Removed seconds for simplicity)
            const fmtTime = (d) => {
                const hh = d.getHours() % 12 || 12;
                const mm = String(d.getMinutes()).padStart(2, '0');
                const ap = d.getHours() >= 12 ? 'pm' : 'am';
                return `${hh}:${mm} ${ap}`;
            };

            // Style objects to match clock label HUD exactly
            const bracketColor = isPostCliff ? '#f59e0b' : '#ef4444';
            const bracketOverlay = `
                content:''; position:absolute; inset:-4px; pointer-events:none;
                background:
                    linear-gradient(to right, ${bracketColor} 2px, transparent 2px) 0 0,
                    linear-gradient(to bottom, ${bracketColor} 2px, transparent 2px) 0 0,
                    linear-gradient(to left, ${bracketColor} 2px, transparent 2px) 100% 0,
                    linear-gradient(to bottom, ${bracketColor} 2px, transparent 2px) 100% 0,
                    linear-gradient(to right, ${bracketColor} 2px, transparent 2px) 0 100%,
                    linear-gradient(to top, ${bracketColor} 2px, transparent 2px) 0 100%,
                    linear-gradient(to left, ${bracketColor} 2px, transparent 2px) 100% 100%,
                    linear-gradient(to top, ${bracketColor} 2px, transparent 2px) 100% 100%;
                background-repeat:no-repeat; background-size:8px 8px;
            `;

            milestone.innerHTML = `
                <style>
                    #timeline-predicted-finish-milestone .finish-hud-tag::after { ${bracketOverlay} }
                    #timeline-predicted-finish-milestone .finish-hud-connector {
                        content:''; position:absolute;
                        bottom: -8px; left: -15px;
                        width: 12px; height: 1.5px;
                        background: ${bracketColor};
                        transform: rotate(-20deg);
                        transform-origin: left bottom;
                    }
                </style>
                <div class="absolute bottom-[48px] left-[15px]">
                    <div class="finish-hud-tag relative px-2 py-[3px] text-[11px] font-extrabold text-[#0f172a] whitespace-nowrap"
                         style="font-family: 'Inter', 'system-ui', 'Segoe UI', Roboto, sans-serif; text-transform: lowercase; text-shadow: 0 0 10px rgba(255,255,255,0.8), 0 0 2px rgba(255,255,255,0.4);">
                        <strong style="letter-spacing:0.05em; font-weight:800 !important; color:${isPostCliff ? '#b45309' : '#0f172a'} !important;">${fmtTime(finishDate)}</strong>
                        <span class="finish-hud-connector"></span>
                    </div>
                </div>
                <div class="w-[1.5px] h-[40px] ${isPostCliff ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]' : 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]'}"></div>
            `;

            milestone.style.display = 'flex';



            // --- NEW: Target Projection Line ---
            const nowMarker = document.getElementById('timeline-now-marker');
            if (nowMarker || forcedNowPercent !== null) {
                const nowPercent = forcedNowPercent !== null ? forcedNowPercent : parseFloat(nowMarker.style.left || 0);
                let projection = document.getElementById('timeline-target-projection');
                if (!projection) {
                    projection = document.createElement('div');
                    projection.id = 'timeline-target-projection';
                    projection.className = 'absolute top-1/2 -translate-y-1/2 h-[1px] z-10';
                    bar.appendChild(projection);
                }

                if (finishPercent > nowPercent) {
                    projection.style.left = `${nowPercent}%`;
                    projection.style.width = `${finishPercent - nowPercent}%`;
                    projection.style.display = 'block';
                    projection.classList.remove('projection-rollover');

                    // --- Projection Data Badge (Time Remaining) ---
                    const remainingSeconds = this.estimatedFinishTimestamp - ((Date.now() + (this.serverClockOffset || 0)) / 1000);
                    if (remainingSeconds > 0) {
                        const h = Math.floor(remainingSeconds / 3600);
                        const m = Math.floor((remainingSeconds % 3600) / 60);
                        const timeText = h > 0 ? `${h}h ${m}m` : `${m}m`;

                        let label = projection.querySelector('.projection-time-label');
                        if (!label) {
                            label = document.createElement('span');
                            label.className = 'projection-time-label';
                            label.style.cssText = `
                                position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
                                font-size:10px; font-weight:900; color:#ffffff; white-space:nowrap;
                                font-family:'Inter', sans-serif; pointer-events:none;
                                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                                background:#0f172a; padding: 2px 8px; border-radius: 4px; 
                                border: 1.5px solid #ef4444;
                                box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
                            `;
                            projection.appendChild(label);
                        }
                        label.textContent = `in ${timeText}`;
                    }
                } else {
                    // --- NEW: Rollover Warning Logic ---
                    // If finish is behind 'now' in percentage but we are not goal-reached,
                    // it means it has wrapped around to the next logical day (past 5 AM).
                    projection.style.left = `${nowPercent}%`;
                    projection.style.width = `${100 - nowPercent}%`;
                    projection.style.display = 'block';
                    projection.classList.add('projection-rollover');

                    let label = projection.querySelector('.projection-time-label');
                    if (label) {
                        label.textContent = "ROLLOVER RISK: Goal slips to tomorrow";
                        label.style.background = "#be123c"; // rose-700
                        label.style.border = "1.5px solid #ffffff";
                    }
                }
            }
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

    // ─── Feature: Rhythm Memory (Upgraded to Cloud Sync) ─────────────────────

    async logBPMToDatabase(precomputedState) {
        // Allow low BPM if active (starting up from flatline)
        const currentBpm = Math.round(this.smoothedBpm || 0);
        if (currentBpm <= 0 && !this.lastStoredStatus) return; // Still flatline

        const now = Date.now();
        // Use pre-computed state if available (avoids redundant recalculation)
        const state = precomputedState || this.calculateECGState(this.subjects.filter(s => s.seconds > 0));
        const activeSubjects = this.subjects.filter(s => s.seconds > 0);
        const currentStatus = (state.isFlatline || activeSubjects.length === 0) ? 0 : 1;

        // --- SMART TRIGGER LOGIC ---
        let shouldSave = false;
        const timeSinceLastSave = now - this.lastStoredTime;

        // 1. Status Toggle: Always save if you started/stopped studying (BYPASS THROTTLE)
        if (currentStatus !== this.lastStoredStatus) {
            shouldSave = true;
            console.log("[ST-TRACKER] Smart Trigger: Status Flip Detected. Saving Instantly.");
        }
        else {
            // 2. Throttle: For normal rhythm shifts, wait at least 10 seconds
            if (timeSinceLastSave < 10000) return;

            // 3. Significant Shift: Save if BPM changed by +/- 2
            if (Math.abs(currentBpm - this.lastStoredBpm) >= 2) {
                shouldSave = true;
                console.log("[ST-TRACKER] Smart Trigger: Significant Rhythm Shift (+/- 2 BPM).");
            }
            // 4. Keepalive: Save at least every 5 minutes
            else if (timeSinceLastSave > 5 * 60 * 1000) {
                shouldSave = true;
                console.log("[ST-TRACKER] Smart Trigger: 5m Keepalive Handshake.");
            }
        }

        if (!shouldSave) return;

        try {
            const payload = {
                bpm: currentBpm,
                is_active: currentStatus
            };

            this.lastStoredBpm = currentBpm;
            this.lastStoredStatus = currentStatus;
            this.lastStoredTime = now;

            const response = await fetch('api/analytics/save-bpm-log.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result && result.success) {
                console.log(`[ST-TRACKER] BPM Persisted: ${currentBpm} BPM (Sync Success)`);
            } else {
                console.warn("[ST-TRACKER] BPM Sync Failed:", result.error);
            }
        } catch (e) {
            console.error("[ST-TRACKER] Save Error:", e);
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
    FATIGUE_FADING_MS: 20 * 60 * 1000,   // 20 minutes
    FATIGUE_CRITICAL_MS: 60 * 60 * 1000,  // 60 minutes
    FATIGUE_FAILING_MS: 90 * 60 * 1000,   // 90 minutes
    FATIGUE_DEAD_MS: 120 * 60 * 1000,     // 120 minutes

    // Heart Rate Zones (mapped to study intensity)
    HEART_RATE_ZONES: [
        { name: 'Flatline', min: 0, max: 0, color: '#94a3b8', bgClass: 'bg-gray-100', textClass: 'text-gray-400' },
        { name: 'Resting', min: 1, max: 59, color: '#64748b', bgClass: 'bg-slate-100', textClass: 'text-slate-500' },
        { name: 'Warm-up', min: 60, max: 69, color: '#10b981', bgClass: 'bg-emerald-50', textClass: 'text-emerald-600' },
        { name: 'Active', min: 70, max: 84, color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600' },
        { name: 'Peak', min: 85, max: 999, color: '#ef4444', bgClass: 'bg-rose-50', textClass: 'text-rose-500' },
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
        this.ecgLoopSequence++; // Increment sequence to kill previous loops
        const currentSeq = this.ecgLoopSequence;

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
            // Kill loop if sequence changed or element detached
            if (this.ecgLoopSequence !== currentSeq || !this.ecgCtx || !document.body.contains(this.ecgCanvas)) {
                return;
            }

            // Fallback for initial zero-width container
            if (this.ecgCanvas.width === 0 && this.ecgContainer.clientWidth > 0) {
                resizeCanvas();
            }

            try {
                this.drawECGFrame();
            } catch (frameErr) {
                console.error("[ST-TRACKER] ECG Loop Crash Avoided:", frameErr);
            }
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

        this.ecgFrameCount++;
        const frameCount = this.ecgFrameCount;

        // Throttled operations: DOM updates + network (once per second at ~60fps)
        if (frameCount % 60 === 0) {
            this.updateMomentumLabel(state);
            this.updateBPMDisplay(state);
            this.logBPMToDatabase(state);

            // Sync Active Session Block on Timeline
            if (!this._cachedActiveBlock || !document.body.contains(this._cachedActiveBlock)) {
                this._cachedActiveBlock = document.querySelector('.timeline-block-active');
            }
            if (this._cachedActiveBlock) {
                const now = new Date(Date.now() + this.serverClockOffset);
                const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
                const startHour = parseFloat(this._cachedActiveBlock.dataset.startHour);
                if (!isNaN(startHour)) {
                    const hourDiff = (currentHour - startHour + 24) % 24;
                    this._cachedActiveBlock.style.width = `${Math.max(0.3, (hourDiff / 24) * 100)}%`;
                }
            }
        }

        // Layer 1: Grid
        this.drawECGGrid(ctx, canvas, state.isFlatline);

        // Layer 2: Bio-Sync Ghost waveform
        this.drawBioSyncGhost(ctx, canvas, frameCount, state);

        // Layer 3: Calculate the new ECG point
        const pointResult = this.calculateECGPoint(canvas, frameCount, state);

        // Sync card border on spike
        this.syncCardBorder(state, pointResult, frameCount);

        // Push new points (ring buffer style)
        const mainY = isNaN(pointResult.mainY) ? canvas.height / 2 : pointResult.mainY;
        this.ecgPoints.push({ y: mainY });
        if (this.ecgPoints.length > this.ECG_MAX_POINTS) this.ecgPoints.shift();

        if (!this.ghostPoints) this.ghostPoints = [];
        const ghostY = isNaN(pointResult.ghostY) ? canvas.height / 2 : pointResult.ghostY;
        this.ghostPoints.push({ y: ghostY });
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
    },

    // ─── State Calculation ──────────────────────────────────────────────────
    calculateECGState(activeSubjects) {
        const now = Date.now() + this.serverClockOffset;

        // --- NEW: Fix Initial Flatline Bug ---
        // If lastStudyChangeTime is null, we haven't synced yet. 
        // Force a large gapMs to trigger "Signal Lost" instead of defaulting to 50 BPM.
        const gapMs = (this.lastStudyChangeTime === null) ? 21 * 60 * 1000 : (now - this.lastStudyChangeTime);

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
            statusLabel = 'Burnout Risk';
            statusColorClass = 'text-amber-600 bg-amber-50 border-amber-100/50 animate-pulse';
        } else if (gapMs > this.FATIGUE_FADING_MS) {
            const p = (gapMs - this.FATIGUE_FADING_MS) / (this.FATIGUE_CRITICAL_MS - this.FATIGUE_FADING_MS);
            fatigueFactor = 1.0 - (p * 0.5);
            statusLabel = 'Fading Focus';
            statusColorClass = 'text-rose-400 bg-rose-50 border-rose-100/50';
        } else {
            // New Flow State logic based on duration and number of active subjects
            const activeMins = (now - this.lastStudyChangeTime) / 60000;
            if (activeMins > 90 && activeSubjects.length >= 2) {
                statusLabel = 'Hyper Focus';
                statusColorClass = 'text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse font-black';
            } else if (activeMins > 40) {
                statusLabel = 'Flow State';
                statusColorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200 font-bold';
            } else if (activeMins > 10) {
                statusLabel = 'Deep Work';
                statusColorClass = 'text-blue-600 bg-blue-50 border-blue-200';
            } else {
                statusLabel = 'Warm-up';
                statusColorClass = 'text-rose-500 bg-rose-50 border-rose-100/50';
            }
        }

        // Simplified Flatline Detection: Purely based on fatigue factor
        const isFlatline = (fatigueFactor === 0);

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
        // If NO active subjects and NOT recovering, force 0 BPM (Flatline/Sleep)
        const baseBpm = activeSubjects.length > 0 ? Math.max(50, 50 + (activeSubjects.length - 1) * 5) : 0;
        let bpm = (isFlatline || baseBpm === 0) ? 0 : Math.max(20, baseBpm * fatigueFactor);
        if (isRecovering) bpm = Math.max(bpm, 20) + (Math.random() - 0.5) * 40;

        // Sanitize pulse interval (min 60fps / 16ms)
        const pulseInterval = isFlatline ? 99999 : Math.max(16, Math.round((60 / Math.max(1, bpm)) * 60));

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

        // Smooth the BPM — gradual ramp-up from 0 to target (no instant jumps)
        const targetBpm = Math.round(state.bpm);
        // Lerp 8% toward actual each frame (~60fps) = ramps from 0→50 in ~3s
        this.smoothedBpm += (targetBpm - this.smoothedBpm) * 0.08;
        const displayBpm = Math.round(this.smoothedBpm || 0);

        // Find matching zone
        const zone = this.HEART_RATE_ZONES.find(z => displayBpm >= z.min && displayBpm <= z.max)
            || this.HEART_RATE_ZONES[0];

        bpmEl.textContent = state.isFlatline ? '--' : displayBpm;
        bpmEl.style.color = zone.color;

        zoneEl.textContent = state.isFlatline ? 'Offline' : zone.name;
        zoneEl.className = `text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter leading-none mt-0.5 ${zone.bgClass} ${zone.textClass}`;

        // --- Ghost Delta Indicator ---
        const deltaEl = document.getElementById('ghost-delta-badge');
        if (deltaEl) {
            if (state.isFlatline || !this.yesterdayBpmLogs || this.yesterdayBpmLogs.length === 0) {
                deltaEl.classList.add('hidden');
            } else {
                const now = new Date(Date.now() + this.serverClockOffset);
                const currentHour = now.getHours() + now.getMinutes() / 60;

                const ghostLog = this.yesterdayBpmLogs.find(l => Math.abs(l.hour - currentHour) < 0.1);
                const ghostBpm = ghostLog ? ghostLog.bpm : 0;
                const wasActiveYesterday = ghostLog ? ghostLog.isActive : false;

                const delta = displayBpm - ghostBpm;

                deltaEl.classList.remove('hidden');
                if (wasActiveYesterday) {
                    const isFaster = delta >= 0;
                    deltaEl.textContent = `${isFaster ? '+' : ''}${delta} vs ${ghostBpm} BPM`;
                    deltaEl.className = `text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-normal leading-none mt-0.5 ${isFaster ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`;
                } else {
                    deltaEl.textContent = `+${displayBpm} vs 0 BPM ◈ NEW PEAK`;
                    deltaEl.className = `text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-normal leading-none mt-0.5 bg-indigo-100 text-indigo-600`;
                }
            }
        }
    },

    // ─── Grid Drawing (Batched for performance) ─────────────────────────────
    drawECGGrid(ctx, canvas, isFlatline) {
        const gridSize = this.ECG_GRID_SIZE;
        const majorStep = gridSize * 5;
        const r = isFlatline ? 100 : 239;
        const g = isFlatline ? 100 : 68;
        const b = isFlatline ? 100 : 68;

        // Batch minor lines into one path
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvas.width; x += gridSize) {
            if (x % majorStep !== 0) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
            if (y % majorStep !== 0) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        }
        ctx.stroke();

        // Batch major lines into one path
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += majorStep) {
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y < canvas.height; y += majorStep) {
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
    },

    // ─── Bio-Sync Ghost Waveform ───────────────────────────────────────────
    drawBioSyncGhost(ctx, canvas, frameCount, state) {
        if (!this.yesterdayBpmLogs || this.yesterdayBpmLogs.length === 0) return;

        if (!this.ghostPoints) this.ghostPoints = [];

        // Draw the ghost trail
        if (this.ghostPoints.length <= 1) return;

        // Draw the ghost trail with smoothing (High Visibility Sync)
        if (this.ghostPoints.length <= 1) return;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'; // Increased visibility pulse
        ctx.lineWidth = 1.8;
        this.drawSmoothedPath(ctx, canvas, this.ghostPoints);
        ctx.stroke();

        // Ghost label indicator
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
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
                mainY += (Math.random() - 0.5) * 1.5; // Reduced jitter from 3 to 1.5
            }
        }

        // --- Bio-Sync Ghost Wave Calculation (Using REAL History) ---
        const now = new Date(Date.now() + this.serverClockOffset);
        const currentHour = now.getHours() + now.getMinutes() / 60;

        // Find nearest ghost log
        const ghostLog = this.yesterdayBpmLogs.find(l => Math.abs(l.hour - currentHour) < 0.05);
        const wasActiveYesterday = ghostLog ? ghostLog.isActive : false;
        const yesterdayBpm = ghostLog ? Math.max(20, ghostLog.bpm) : 0;

        const ghostInterval = yesterdayBpm > 0 ? Math.max(16, Math.round((60 / yesterdayBpm) * 60)) : 9999;
        const ghostCycle = frameCount % ghostInterval;
        let ghostY = centerX;

        if (wasActiveYesterday && yesterdayBpm > 0) {
            const ghostIntensity = 18;
            if (ghostCycle < 15) {
                const p = ghostCycle / 15;
                ghostY = centerX + Math.sin(p * Math.PI * 2) * (ghostIntensity * 1.1);
            } else if (ghostCycle > 25 && ghostCycle < 40) {
                const p = (ghostCycle - 25) / 15;
                ghostY = centerX - Math.sin(p * Math.PI) * (ghostIntensity * 0.3);
            }
            ghostY += (Math.random() - 0.5) * 0.5;
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
                sy += (Math.random() - 0.5) * 0.8; // Reduced jitter from 1.5 to 0.8
            }

            const buf = this.subjectPointBuffers[idx];
            buf.push(sy);
            if (buf.length > this.ECG_MAX_POINTS) buf.shift();

            if (buf.length > 1) {
                ctx.strokeStyle = `rgba(${color.rgb}, 0.3)`;
                ctx.lineWidth = 1;
                this.drawSmoothedPath(ctx, canvas, buf.map(y => ({ y })));
                ctx.stroke();
            }
        });

        // Trim if subjects dropped
        if (this.subjectPointBuffers.length > activeSubjects.length) {
            this.subjectPointBuffers = this.subjectPointBuffers.slice(0, activeSubjects.length);
        }
    },

    // ─── Particle System (Optimized: swap-and-pop removal) ────────────────
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
                this.ecgParticles.length = this.ECG_PARTICLE_CAP; // Truncate tail
            }
        }

        // Update & render existing particles (swap-and-pop for O(1) removal)
        const colorPrefix = `rgba(${accent.rgb}, `;
        const decayRate = pointResult.activeSpike ? 0.03 : 0.015;
        let len = this.ecgParticles.length;
        for (let i = len - 1; i >= 0; i--) {
            const p = this.ecgParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= decayRate;
            if (p.life <= 0) {
                // Swap with last element and pop (O(1) instead of splice O(n))
                this.ecgParticles[i] = this.ecgParticles[--len];
                this.ecgParticles.length = len;
                continue;
            }
            ctx.beginPath();
            ctx.fillStyle = colorPrefix + p.life + ')';
            ctx.arc(p.x, p.y, p.size || 1, 0, Math.PI * 2);
            ctx.fill();
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

        // Glow pass: thicker translucent line
        const glowWidth = state.isFlatline ? 6 : 10;
        ctx.strokeStyle = `rgba(${accent.rgb}, ${state.isFlatline ? 0.15 : 0.2})`;
        ctx.lineWidth = glowWidth;
        this.drawSmoothedPath(ctx, canvas, this.ecgPoints);
        ctx.stroke();

        // Sharp line pass
        ctx.strokeStyle = gradient;
        ctx.lineWidth = state.isFlatline ? 1.5 : 2.5;
        this.drawSmoothedPath(ctx, canvas, this.ecgPoints);
        ctx.stroke();

        // Leading Eye (optimized: no shadowBlur, use radial gradient glow instead)
        const lastPoint = this.ecgPoints[this.ecgPoints.length - 1];
        const lx = (this.ecgPoints.length - 1) / this.ECG_MAX_POINTS * canvas.width;

        // Soft glow ring (replaces expensive shadowBlur)
        const glowRadius = 7 + Math.sin(frameCount * 0.1) * 3;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${accent.rgb}, 0.3)`;
        ctx.lineWidth = 3;
        ctx.arc(lx, lastPoint.y, glowRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Core dot
        ctx.beginPath();
        ctx.fillStyle = accent.hex;
        ctx.arc(lx, lastPoint.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
    },

    // Helper: Draw a series of points as a smooth quadratic curve (zero-alloc)
    drawSmoothedPath(ctx, canvas, points) {
        if (!points || points.length < 2) return;

        // Find first valid point without creating a new array
        let startIdx = -1;
        for (let i = 0; i < points.length; i++) {
            if (points[i] && !isNaN(points[i].y)) { startIdx = i; break; }
        }
        if (startIdx < 0) return;

        const widthScale = canvas.width / this.ECG_MAX_POINTS;
        ctx.beginPath();
        ctx.lineJoin = 'round';
        ctx.moveTo(startIdx * widthScale, points[startIdx].y);

        let prevValidIdx = startIdx;
        for (let i = startIdx + 1; i < points.length; i++) {
            if (!points[i] || isNaN(points[i].y)) continue; // Skip NaN inline
            const x = i * widthScale;
            // Look ahead for next valid for smooth bezier
            let nextValidY = points[i].y;
            for (let j = i + 1; j < points.length; j++) {
                if (points[j] && !isNaN(points[j].y)) { nextValidY = points[j].y; break; }
            }
            const prevX = prevValidIdx * widthScale;
            const cx = (x + prevX) / 2 + (x - prevX) / 2;
            const cy = (points[i].y + nextValidY) / 2;
            ctx.quadraticCurveTo(x, points[i].y, (x + (i + 1) * widthScale) / 2, cy);
            prevValidIdx = i;
        }

        // Draw last segment
        const lastIdx = points.length - 1;
        if (points[lastIdx] && !isNaN(points[lastIdx].y)) {
            ctx.lineTo(lastIdx * widthScale, points[lastIdx].y);
        }
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
            const today = this.getLogicalDate();
            const yesterday = this.getLogicalDate(-1);

            // Fetch Today's Sessions (bypass cache for immediate results)
            const todayResult = await CacheManager.fetchWithCache(`api/analytics/get-session-timeline.php?date=${today}`, 0);
            if (todayResult && todayResult.success) {
                // EXCLUDE EXAMS: Filter out sessions where type is 'exam'
                this.sessionTimeline = (todayResult.sessions || []).filter(s => s.type !== 'exam');
                this.timelineDataLoaded = true;
            } else if (todayResult) {
                console.warn('[ST-TRACKER] Today timeline fetch fail:', todayResult.error);
            }

            // Fetch Yesterday's Sessions for Ghost Layer (cache for 1 min)
            const yesterdayResult = await CacheManager.fetchWithCache(`api/analytics/get-session-timeline.php?date=${yesterday}`, 60);
            if (yesterdayResult && yesterdayResult.success) {
                // Include ALL sessions (including exams) for the Ghost Runner calculation 
                // to match the main progress bar's studiedSeconds logic.
                this.yesterdaySessions = yesterdayResult.sessions || [];
            }

            this.renderSessionTimeline(todayResult ? todayResult.current_hour : 24);
        } catch (e) {
            console.error('[ST-TRACKER] Timeline fetch error:', e);
        }
    },

    renderSessionTimeline(currentHour) {
        const bar = document.getElementById('session-timeline-bar');
        const countEl = document.getElementById('timeline-session-count');
        const nowMarker = document.getElementById('timeline-now-marker');
        const labelsContainer = document.getElementById('timeline-labels-container');
        if (!bar) return;

        // --- 0. Pre-calculate Milestones for Label Coordination ---
        const calculatedMilestones = [];
        let cumHours = 0;
        const sortedForMilestones = [...this.sessionTimeline].sort((a, b) => a.start_hour - b.start_hour);
        sortedForMilestones.forEach(session => {
            const studyTypes = ['pomodoro', 'pomodoro_active', 'pomodoro_paused', 'exam'];
            if (!studyTypes.includes(session.type)) return;

            const startH = cumHours;
            const endH = cumHours + session.duration_hours;

            for (let m = Math.floor(startH) + 1; m <= Math.floor(endH); m++) {
                if (m > 0) {
                    const hourOfDay = (parseFloat(session.start_hour) + (m - startH)) % 24;
                    calculatedMilestones.push({
                        hourOfDay,
                        m,
                        leftPercent: this.getRelativeTimelinePercent(hourOfDay)
                    });
                }
            }
            cumHours = endH;
        });

        // Apply dashed background pattern to the main bar
        bar.classList.add('timeline-dashed-gaps');

        // Expanded high-contrast vibrant color palette (HEX for easier manipulation)
        const colors = [
            { main: '#3b82f6', grad: '#2563eb' },   // Blue
            { main: '#10b981', grad: '#059669' },   // Emerald
            { main: '#f59e0b', grad: '#d97706' },   // Amber
            { main: '#8b5cf6', grad: '#7c3aed' },   // Violet
            { main: '#ec4899', grad: '#db2677' },   // Pink
            { main: '#14b8a6', grad: '#0d9488' },   // Teal
            { main: '#f43f5e', grad: '#e11d48' },   // Rose
            { main: '#0ea5e9', grad: '#0284c9' },   // Sky
            { main: '#a855f7', grad: '#9333ea' },   // Purple
            { main: '#84cc16', grad: '#65a30d' },   // Lime
        ];

        // Build a subject → color index map from BOTH today and yesterday
        const subjectColorMap = {};
        let colorIdx = 0;
        this.activeSubjectPalette = null; // Reset every render

        [...this.sessionTimeline, ...this.yesterdaySessions].forEach(s => {
            const subjectKey = (s.subject || 'Session').trim();
            if (!(subjectKey in subjectColorMap)) {
                subjectColorMap[subjectKey] = colorIdx++ % colors.length;
            }
        });

        // Clear old blocks and milestones (keep the now marker)
        const oldBlocks = bar.querySelectorAll('.timeline-block, .timeline-ghost-block');
        oldBlocks.forEach(b => b.remove());
        const oldMilestones = bar.parentElement.querySelectorAll('.timeline-milestone');
        oldMilestones.forEach(m => m.remove());
        // Clear the dynamic break bridge so it gets rebuilt fresh
        const oldBreakBridge = document.getElementById('timeline-break-projection');
        if (oldBreakBridge) oldBreakBridge.remove();

        if (labelsContainer) {
            labelsContainer.innerHTML = '';
            labelsContainer.style.position = 'relative'; 
            labelsContainer.style.height = '20px';
            labelsContainer.style.overflow = 'visible';
            
            // Ensure the bar itself doesn't clip the flags now that markers are inside it
            bar.style.overflow = 'visible';
            bar.style.position = 'relative'; 

            // 1. Pixel-based Spacing Calculation
            const containerWidth = labelsContainer.offsetWidth || bar.offsetWidth || 1000;
            const minSpacingPx = 32; 
            const spacingPercent = (minSpacingPx / containerWidth) * 100;

            // 2. Build Unified Candidate List (HOURS ONLY)
            const candidates = [];

            for (let i = 0; i <= 24; i++) {
                const hour = (this.TIMELINE_START_HOUR + i) % 24;
                candidates.push({
                    left: this.getRelativeTimelinePercent(hour),
                    type: 'hour',
                    text: `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}`
                });
            }

            // 3. Render Hour Labels (No collision check needed for plain hours as they are 1h apart, but kept for robustness)
            candidates.forEach(label => {
                const el = document.createElement('span');
                el.className = `absolute text-[10px] font-black text-slate-800 uppercase`;
                el.style.top = '2px';
                el.style.left = `${label.left}%`;
                el.style.transform = 'translateX(-50%)';
                el.textContent = label.text;
                labelsContainer.appendChild(el);
            });
        }

        // 1. Render Yesterday's Shadow (Background Layer)
        this.yesterdaySessions.forEach(session => {
            // EXCLUDE EXAMS from rendering (but they remain in calculation)
            if (session.type === 'exam') return;

            const leftPercent = this.getRelativeTimelinePercent(session.start_hour);
            const widthPercent = (session.duration_hours / 24) * 100;
            if (widthPercent <= 0) return;

            const ci = subjectColorMap[(session.subject || 'Session').trim()] || 0;
            const palette = colors[ci];

            const ghost = document.createElement('div');
            // Improved Ghost Aesthetic: Color-coded but translucent
            ghost.className = 'timeline-ghost-block absolute top-0 h-full z-0 pointer-events-none rounded-sm border-t border-dashed';
            ghost.style.left = `${leftPercent}%`;
            ghost.style.width = `${widthPercent}%`;

            // Use a faint version of the main color
            const ghostColor = this.hexToRgba(palette.main, 0.15);
            const borderColor = this.hexToRgba(palette.main, 0.3);

            ghost.style.backgroundColor = ghostColor;
            ghost.style.borderTopColor = borderColor;

            ghost.title = `Yesterday: ${session.subject || 'Session'}\n${Math.round(session.duration_hours * 60)}m`;
            bar.appendChild(ghost);
        });

        // 2. Render Today's Sessions (Foreground Layer)
        const subjectStudyCounts = {};
        this.activeSubjectPalette = null; // Reset before scanning
        this.lastSessionEndPercent = 0; // Reset for recalculation

        // --- 2a. Compute Inter-Session Break Gaps ---
        // Sort sessions by start_hour to find temporal gaps between completed sessions
        const studyOnlyTypes = ['pomodoro', 'pomodoro_active', 'pomodoro_paused', 'exam'];
        const sortedSessions = [...this.sessionTimeline]
            .filter(s => studyOnlyTypes.includes(s.type) || s.type === 'paused_gap' || s.type === 'break')
            .sort((a, b) => parseFloat(a.start_hour) - parseFloat(b.start_hour));

        const interBreaks = [];
        for (let i = 0; i < sortedSessions.length - 1; i++) {
            const curr = sortedSessions[i];
            const next = sortedSessions[i + 1];
            const currEnd = parseFloat(curr.start_hour) + parseFloat(curr.duration_hours);
            const nextStart = parseFloat(next.start_hour);
            const gapHours = nextStart - currEnd;

            // Only show gaps > 1 minute (0.0167 hours) to avoid micro-gaps
            if (gapHours > 0.0167) {
                interBreaks.push({
                    start_hour: currEnd,
                    duration_hours: gapHours,
                    type: 'inter_break',
                    subject: 'Break'
                });
            }
        }

        // Merge inter-breaks into the session list for rendering
        const allBlocks = [...this.sessionTimeline, ...interBreaks]
            .sort((a, b) => parseFloat(a.start_hour) - parseFloat(b.start_hour));

        allBlocks.forEach((session) => {
            const studyTypes = ['pomodoro', 'pomodoro_active', 'pomodoro_paused', 'exam'];
            const isStudy = studyTypes.includes(session.type);
            const isInterBreak = session.type === 'inter_break';

            let sessionNumber = null;
            if (isStudy) {
                const sName = (session.subject || 'General Study').trim();
                subjectStudyCounts[sName] = (subjectStudyCounts[sName] || 0) + 1;
                sessionNumber = subjectStudyCounts[sName];
            }

            const startHour = parseFloat(session.start_hour);
            const duration = parseFloat(session.duration_hours);

            const leftPercent = this.getRelativeTimelinePercent(startHour);
            const widthPercent = isInterBreak ? (duration / 24) * 100 : Math.max(0.5, (duration / 24) * 100);

            if (isNaN(leftPercent) || isNaN(widthPercent)) {
                console.warn("[ST-TRACKER] Skipping invalid session block:", session);
                return;
            }

            // --- Inter-Session Break Block (Static) ---
            if (isInterBreak) {
                const breakBlock = document.createElement('div');
                breakBlock.className = 'timeline-block timeline-inter-break absolute top-0 h-full z-5 cursor-default';
                breakBlock.style.left = `${leftPercent}%`;
                breakBlock.style.width = `${Math.max(0.3, widthPercent)}%`;
                breakBlock.style.background = 'repeating-linear-gradient(90deg, rgba(100,116,139,0.15) 0px, rgba(100,116,139,0.15) 4px, transparent 4px, transparent 8px)';
                breakBlock.style.borderTop = '1.5px dashed rgba(100,116,139,0.4)';
                breakBlock.style.borderBottom = '1.5px dashed rgba(100,116,139,0.4)';
                breakBlock.style.opacity = '0.8';

                // Duration label (show HH:mm format for > 1h, else Xm)
                const gapMinutes = Math.round(duration * 60);
                let gapLabel;
                if (gapMinutes >= 60) {
                    const gh = Math.floor(gapMinutes / 60);
                    const gm = gapMinutes % 60;
                    gapLabel = `${gh}h${gm > 0 ? gm + 'm' : ''}`;
                } else {
                    gapLabel = `${gapMinutes}m`;
                }

                // Only show label if there's enough visual space (> ~2% of timeline = ~30min)
                if (widthPercent > 1.5) {
                    breakBlock.innerHTML = `<span style="
                        position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
                        font-size:8px; font-weight:700; color:#64748b; white-space:nowrap;
                        font-family:'Inter',sans-serif; pointer-events:none;
                        background:rgba(241,245,249,0.85); padding:0px 4px; border-radius:2px;
                    ">⏸ ${gapLabel}</span>`;
                }

                breakBlock.title = `Break: ${gapLabel}`;

                // Track end for dynamic break bridge - Moved below for study sessions only
                // this.lastSessionEndPercent = Math.max(this.lastSessionEndPercent || 0, leftPercent + widthPercent);
                bar.appendChild(breakBlock);
                return;
            }

            const ci = subjectColorMap[(session.subject || 'Session').trim()] || 0;
            const palette = colors[ci];

            const block = document.createElement('div');
            const isPausedGap = session.type === 'paused_gap';
            // BREAKS are also "active" blocks that need to grow while running
            // pomodoro_paused should NOT get timeline-block-active class (it shouldn't grow)
            const isActive = session.type === 'pomodoro_active' || session.type === 'break';
            const isLiveSession = isActive || session.type === 'pomodoro_paused';
            const isBreak = session.type === 'break';
            const isPaused = session.type === 'pomodoro_paused';

            if (isLiveSession && isStudy) {
                this.activeSubjectPalette = palette;
            }

            // --- Paused Gap: Dashed bar (grows in real-time) ---
            if (isPausedGap) {
                block.className = 'timeline-block timeline-paused-gap absolute top-0 h-full z-10 cursor-default';
                block.style.left = `${leftPercent}%`;
                block.style.width = `${widthPercent}%`;
                block.dataset.startHour = startHour;
                block.style.background = 'repeating-linear-gradient(90deg, rgba(148,163,184,0.4) 0px, rgba(148,163,184,0.4) 6px, transparent 6px, transparent 10px)';
                block.style.borderTop = '1px dashed rgba(148,163,184,0.5)';
                block.style.borderBottom = '1px dashed rgba(148,163,184,0.5)';
                block.style.opacity = '0.7';

                const gapMin = Math.round(duration * 60);
                block.innerHTML = `<span class="timeline-gap-label">${gapMin}m break</span>`;
                block.title = '';
                block.addEventListener('mouseenter', (e) => this.showTimelineTooltip(e, session, palette));
                block.addEventListener('mouseleave', () => this.hideTimelineTooltip());
                block.addEventListener('click', () => this.showSessionDetails(session, palette, sessionNumber));

                // this.lastSessionEndPercent = Math.max(this.lastSessionEndPercent || 0, leftPercent + widthPercent);
                bar.appendChild(block);
                return; // Skip the rest of the styling
            }

            block.className = `timeline-block absolute top-0 h-full rounded-sm transition-all cursor-default ${isActive ? 'timeline-block-active z-10' : 'z-10'} ${isPaused ? 'timeline-block-paused' : ''}`;
            block.style.left = `${leftPercent}%`;
            block.style.width = `${widthPercent}%`;
            block.dataset.startHour = session.start_hour;

            if (isBreak) {
                block.style.background = 'linear-gradient(to bottom, rgba(148, 163, 184, 0.4), rgba(100, 116, 139, 0.5))';
                block.style.borderBottom = '1px dashed rgba(255,255,255,0.4)';
            } else {
                // MULTIPLE BACKGROUNDS: Subject Gradient + Shimmer (if active)
                const subjectGrad = `linear-gradient(to bottom, ${this.hexToRgba(palette.main, 0.85)}, ${this.hexToRgba(palette.grad, 0.9)})`;
                const shimmerGrad = isActive && !isPaused ? `, linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)` : '';

                block.style.background = subjectGrad + shimmerGrad;
                block.style.backgroundSize = isActive && !isPaused ? `100% 100%, 200% 100%` : '100% 100%';
                const isPomodoroType = session.type === 'pomodoro' || session.type === 'pomodoro_active' || session.type === 'pomodoro_paused';
                block.style.opacity = (session.type === 'exam' || isActive || isPomodoroType) ? '1.0' : '0.8';
            }

            // Exam/Active sessions get accents
            if (session.type === 'exam') {
                block.style.borderTop = '2px solid rgba(255,255,255,0.6)';
            } else if (isActive) {
                block.style.boxShadow = `0 0 10px ${palette.main}`;
            }

            block.title = ''; // Clear native title to use our custom tooltip

            // Hover interactions
            block.addEventListener('mouseenter', (e) => {
                this.showTimelineTooltip(e, session, palette);
            });
            block.addEventListener('mouseleave', () => {
                this.hideTimelineTooltip();
            });
            block.addEventListener('click', (e) => {
                this.showSessionDetails(session, palette, sessionNumber);
            });

            // --- Intensity Micro-Wave (Study Sessions only) ---
            if (isStudy) {
                const seed = Math.round(session.start_hour * 1000);
                const waveVal = Math.abs(Math.sin(seed));
                // Increased Amplitude for taller bar: 20% to 60% of block height
                const amplitude = 20 + (waveVal * 40);

                const waveContainer = document.createElement('div');
                waveContainer.className = 'timeline-wave-container';
                waveContainer.innerHTML = `
                    <svg class="timeline-wave-svg" viewBox="0 0 200 100" preserveAspectRatio="none">
                        <path d="M0,50 C25,${50 - amplitude} 75,${50 + amplitude} 100,50 C125,${50 - amplitude} 175,${50 + amplitude} 200,50 L200,100 L0,100 Z" 
                              fill="rgba(255,255,255,0.25)">
                        </path>
                    </svg>
                `;
                block.appendChild(waveContainer);
            }
            // Only update lastSessionEndPercent for FIXED end sessions (completed or paused)
            // exclude 'pomodoro_active' because it ends at 'NOW' which is floating and can drift
            const fixedEndTypes = ['pomodoro', 'pomodoro_paused', 'exam'];
            if (fixedEndTypes.includes(session.type)) {
                // Use factual end hour for tracking, not the clamped visual widthPercent
                const factualEndHour = startHour + duration;
                const endPercent = this.getRelativeTimelinePercent(factualEndHour);
                this.lastSessionEndPercent = Math.max(this.lastSessionEndPercent || 0, endPercent);
            }
            bar.appendChild(block);
        });

        // Update session count pill
        if (countEl) {
            countEl.textContent = `${this.sessionTimeline.length} session${this.sessionTimeline.length !== 1 ? 's' : ''}`;
        }

        // --- NEW: Render Milestones (Flags & Bars only) ---
        calculatedMilestones.forEach(ms => {
            const marker = document.createElement('div');
            // Fixed: Use w-[2px] and items-center to anchor the bridge precisely to marker center
            marker.className = 'timeline-milestone group absolute z-20 flex flex-col items-center cursor-pointer h-full w-[2px]';
            marker.style.left = `${ms.leftPercent}%`;
            marker.style.top = '0';

            const title = this.MILESTONE_TITLES[ms.m] || `${ms.m}h Milestone`;

            const evolution = {
                1: { icon: '🥉', hue: 100 },
                2: { icon: '🥈', hue: 120 },
                3: { icon: '🥇', hue: 210 },
                4: { icon: '🏅', hue: 45 },
                5: { icon: '🎖️', hue: 180 },
                6: { icon: '🏆', hue: 25 },
                7: { icon: '🏵️', hue: 0 },
                8: { icon: '💎', hue: 280 },
                9: { icon: '👑', hue: 320 },
                10: { icon: '🌟', hue: 195 },
                11: { icon: '✨', hue: 240 },
                12: { icon: '🔱', hue: 45 }
            };

            const tier = evolution[ms.m] || { icon: '🏆', hue: 25 };
            const palette = this.MILESTONE_PALETTE;
            const milestoneColor = palette[(ms.m - 1) % palette.length];
            const milestoneColorTransparent = `${milestoneColor}26`; // 15% opacity hex

            // Calculate precise time for the flag label
            const milH = Math.floor(ms.hourOfDay);
            const milM = Math.round((ms.hourOfDay - milH) * 60);
            // Simplified: 'am' or 'pm'
            const milAmpm = milH >= 12 ? 'pm' : 'am';
            const milDisplayH = milH % 12 || 12;
            const milTimeStr = `${milDisplayH}:${milM.toString().padStart(2, '0')} ${milAmpm}`;

            // NEW: Alternating HUD Positioning with Connectors (Top-Left / Bottom-Right)
            // Odd (1,3,5) -> Top-Left (above track, left of marker)
            // Even (2,4,6) -> Bottom-Right (below track, right of marker)
            const isOdd = ms.m % 2 !== 0;
            // 12.5px symmetrical offsets hit the bracket corner at exactly 45 degrees
            const flagPosClass = isOdd 
                ? 'bottom-[calc(100%+18px)] right-[18px]' 
                : 'top-[calc(100%+28px)] left-[28px]';
            const bridgeClass = isOdd ? 'bridge-odd' : 'bridge-even';

            marker.dataset.milestoneHour = ms.hourOfDay;
            marker.style.setProperty('--milestone-color', milestoneColor);
            marker.style.setProperty('--milestone-color-alpha', milestoneColorTransparent);

            marker.innerHTML = `
                <div class="timeline-milestone-flag absolute whitespace-nowrap transition-all duration-300 timeline-milestone-flag-cyber ${flagPosClass}" 
                        style="color: ${milestoneColor};">
                    ${tier.icon} ${ms.m} - ${milTimeStr}<span class="milestone-label hidden ml-1.5 font-bold"> · ${title}</span>
                </div>
                
                <!-- Vertical marker bar with integrated bridge -->
                <div class="timeline-milestone-bar w-[2px] h-full shadow-sm" style="background: ${milestoneColor}; pointer-events: auto; position: relative;">
                    <!-- Slanted HUD Connector (anchored from bar) -->
                    <div class="milestone-bridge ${bridgeClass}"></div>
                </div>
            `;

            // Click to toggle label (Single open mode)
            marker.onclick = (e) => {
                e.stopPropagation();
                const myLabel = marker.querySelector('.milestone-label');
                const isHidden = myLabel.classList.contains('hidden');

                // Close ALL others first
                document.querySelectorAll('.milestone-label').forEach(el => el.classList.add('hidden'));

                // Toggle this one
                if (isHidden) {
                    myLabel.classList.remove('hidden');
                }
            };

            bar.appendChild(marker);
        });

        // Ensure milestones and projection are rendered immediately after bar clear
        this.renderPredictedFinish();

        // Ensure we have the pulse animation CSS
        this.injectTimelineCSS();
    },

    // ─── Break Tracker Rendering (Real-time HUD at Now Marker) ────────────────
    renderBreakTracker(nowPercent) {
        const nowMarker = document.getElementById('timeline-now-marker');
        if (!nowMarker) return;

        // Guard: Don't show anything until first timeline data fetch completes
        if (!this.timelineDataLoaded) return;

        // Granular session state detection
        const isFocusRunning = document.body.classList.contains('pomo-focus-active');
        const isFocusPaused = document.body.classList.contains('pomo-focus-paused');
        const isBreakRunning = document.body.classList.contains('pomo-break-active');
        const isBreakPaused = document.body.classList.contains('pomo-break-paused');
        
        const lastEnd = parseFloat(this.lastSessionEndPercent) || 0;

        // Hide HUD if a focus session is actively running
        if (isFocusRunning) {
            this._wasStudying = true;
            this._breakStartTimestamp = null;
            const breakHud = document.getElementById('timeline-break-hud');
            if (breakHud) breakHud.style.display = 'none';
            return;
        }

        // --- Transition Detection: Capture the exact moment studying stops or pauses ---
        // If we were studying and now we're either on break or paused, record the start timestamp
        if (this._wasStudying && !isFocusRunning) {
            this._wasStudying = false;
            this._breakStartTimestamp = Date.now();
        }

        // Calculate break/pause duration in seconds
        let breakSecondsTotal = 0;
        if (this._breakStartTimestamp) {
            breakSecondsTotal = Math.floor((Date.now() - this._breakStartTimestamp) / 1000);
        } else if (lastEnd > 0) {
            // After refresh, _breakStartTimestamp is null, so we derive from timeline gap
            const breakWidth = Math.max(0, nowPercent - lastEnd);
            // If nowPercent < lastEnd (e.g. just past midnight or clock drift), breakWidth is 0
            breakSecondsTotal = Math.round((breakWidth / 100) * 86400);
        }

        const isNudgeActive = document.body.classList.contains('pomo-nudge-active');
        const isPaused = isFocusPaused || isBreakPaused;
        const isBreak = isBreakRunning || isBreakPaused || (!isFocusRunning && !isFocusPaused);

        // Show HUD if we are in any break, pause, or nudge (waiting) state
        if (breakSecondsTotal >= 0 && (isPaused || isBreak || isNudgeActive)) {
            let breakHud = document.getElementById('timeline-break-hud');
            if (!breakHud) {
                breakHud = document.createElement('span');
                breakHud.id = 'timeline-break-hud';
                breakHud.className = 'timeline-break-hud-cyber';
                nowMarker.appendChild(breakHud);
            }

            // Determine label, icon, and colors based on precise state
            let label = "Break";
            let icon = "⏸";
            let animClass = "animate-hud-pulse";
            let labelColor = "#475569"; // Slate for general break

            if (isNudgeActive) {
                label = "Waiting";
                icon = "📡";
                animClass = "animate-hud-pulse"; // Standard pulse for waiting
                labelColor = "#4f46e5"; // Indigo for waiting/active decision
            } else if (isPaused) {
                label = "Paused";
                icon = "⏳";
                animClass = "animate-hud-spin";
                labelColor = "#b45309"; // Amber for paused
            }

            const bh = Math.floor(breakSecondsTotal / 3600);
            const bm = Math.floor((breakSecondsTotal % 3600) / 60);
            const bs = breakSecondsTotal % 60;
            const hhmmss = [bh, bm, bs].map(v => v.toString().padStart(2, '0')).join(':');
            
            breakHud.innerHTML = `<strong style="letter-spacing:0.05em; font-weight:800; color:${labelColor};"><span class="${animClass}">${icon}</span> ${label} ${hhmmss}</strong>`;
            breakHud.style.display = 'block';
        } else {
            const breakHud = document.getElementById('timeline-break-hud');
            if (breakHud) breakHud.style.display = 'none';
        }
    },

    showTimelineTooltip(e, session, palette) {
        let tooltip = document.getElementById('timeline-detailed-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'timeline-detailed-tooltip';
            document.body.appendChild(tooltip);
        }

        const durationMin = Math.round(session.duration_hours * 60);
        const startH = Math.floor(session.start_hour);
        const startM = Math.round((session.start_hour % 1) * 60);
        const ampm = startH >= 12 ? 'PM' : 'AM';
        const displayH = startH % 12 || 12;
        const timeStr = `${displayH}:${String(startM).padStart(2, '0')} ${ampm}`;

        let typeLabel = 'Session';
        if (session.type === 'pomodoro' || session.type === 'pomodoro_active') typeLabel = '🍅 Focus';
        if (session.type === 'break') typeLabel = '☕ Break';
        if (session.type === 'paused_gap') typeLabel = '⏸ Paused';

        tooltip.innerHTML = `
            <div style="font-size:10px; font-weight:700; color:${palette.main}; margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>${typeLabel}</span>
                <span style="opacity:0.75;">${timeStr}</span>
            </div>
            <div style="font-size:12px; font-weight:800; margin-bottom:6px; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${session.subject || 'Study Session'}</div>
            <div style="display:flex; gap:8px; align-items:center;">
                <div style="font-size:10px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-weight:600;">
                    ${durationMin}m
                </div>
                <div style="font-size:9px; color:rgba(255,255,255,0.4);">Click to explore</div>
            </div>
        `;

        tooltip.classList.add('visible');

        // Position it above the cursor
        const x = e.clientX;
        const y = e.clientY - 15;

        // Use timeout to ensure rect is calculated after innerHTML update
        const rect = tooltip.getBoundingClientRect();
        let left = x - rect.width / 2;
        if (left < 10) left = 10;
        if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${y - rect.height}px`;
    },

    hideTimelineTooltip() {
        const tooltip = document.getElementById('timeline-detailed-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    },

    showSessionDetails(session, palette, sessionNumber) {
        const durationMin = Math.round(session.duration_hours * 60);

        // Fix: Deterministic Efficiency based ONLY on start_hour (stable while session grows)
        const getStableEfficiency = (s) => {
            if (s.type === 'break' || s.type === 'paused_gap') return 'N/A';
            // Use start_hour as a stable seed. Round to 3 decimals to avoid tiny floating point noise
            const seed = Math.round(s.start_hour * 1000);
            const val = Math.abs(Math.sin(seed));
            return (85 + (val * 13)).toFixed(1) + '%';
        };

        const efficiency = getStableEfficiency(session);

        const formatHour = (h) => {
            const hr = Math.floor(h) % 24;
            const min = Math.round((h % 1) * 60);
            const displayH = hr % 12 || 12;
            const ampm = hr >= 12 ? 'PM' : 'AM';
            return `${displayH}:${String(min).padStart(2, '0')} ${ampm}`;
        };

        const startTime = formatHour(session.start_hour);
        const endTime = formatHour(session.start_hour + session.duration_hours);
        const isPaused = session.type === 'paused_gap';
        const isStudy = !!sessionNumber;

        this.showModernModal(`
            <div style="text-align:center; padding:5px;">
                <div style="width:48px; height:48px; background:linear-gradient(135deg, ${palette.main}, ${palette.grad}); border-radius:14px; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 16px ${palette.main}44; transform:rotate(-5deg);">
                    <i class="fas ${isPaused ? 'fa-pause' : (session.type === 'break' ? 'fa-coffee' : 'fa-brain')}" style="color:white; font-size:20px;"></i>
                </div>
                <h3 style="font-size:18px; font-weight:800; color:white; margin-bottom:4px; letter-spacing:-0.5px;">
                    ${isStudy ? `Session #${sessionNumber}: ${session.subject}` : (isPaused ? 'Inactivity Gap' : 'Short Break')}
                </h3>
                <div style="font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-bottom:20px;">
                    ${session.type.replace('_', ' ')}
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:20px;">
                    <div style="background:rgba(255,255,255,0.03); padding:10px 5px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
                        <div style="font-size:8px; color:#475569; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Start</div>
                        <div style="font-size:11px; font-weight:700; color:white; white-space:nowrap;">${startTime}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:10px 5px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
                        <div style="font-size:8px; color:#475569; font-weight:800; text-transform:uppercase; margin-bottom:4px;">End</div>
                        <div style="font-size:11px; font-weight:700; color:white; white-space:nowrap;">${endTime}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:10px 5px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
                        <div style="font-size:8px; color:#475569; font-weight:800; text-transform:uppercase; margin-bottom:4px;">${isPaused ? 'Paused' : 'Total'}</div>
                        <div style="font-size:11px; font-weight:700; color:${palette.main};">${durationMin}m</div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); text-align:left; margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:9px; color:#475569; font-weight:800; text-transform:uppercase;">Efficiency Rating</span>
                        <span style="font-size:14px; font-weight:700; color:white;">${efficiency}</span>
                    </div>
                </div>
                
                <div style="font-size:11px; color:#94a3b8; line-height:1.6; background:rgba(15, 23, 42, 0.4); padding:12px; border-radius:12px; text-align:left; border-left:3px solid ${palette.main};">
                    ${isPaused ? 'This was a period of <strong>momentum decay</strong>. Try to minimize these gaps to keep the ECG active.' :
                (session.type === 'break' ? 'This buffer is essential for cognitive recovery.' : 'Your neural engagement was above average for this subject.')}
                </div>
            </div>
        `);
    },

    showModernModal(html) {
        let modal = document.getElementById('st-tracker-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'st-tracker-modal';
            modal.style.cssText = `
                position:fixed; top:0; left:0; width:100%; height:100%; 
                background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(12px); 
                z-index:10000; display:flex; align-items:center; justify-content:center;
                opacity:0; transition:opacity 0.3s ease;
            `;
            modal.onclick = (e) => { if (e.target === modal) this.closeModernModal(); };
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#1e293b; width:90%; max-width:320px; border-radius:24px; padding:24px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 25px 50px -12px rgba(0,0,0,0.6); transform:scale(0.9) translateY(20px); transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                ${html}
                <button onclick="StudyTargetTracker.closeModernModal()" style="width:100%; margin-top:20px; background:rgba(255,255,255,0.05); border:0; color:#64748b; padding:12px; border-radius:14px; font-weight:700; cursor:pointer; transition:all 0.2s;">Dismiss</button>
            </div>
        `;

        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.children[0].style.transform = 'scale(1) translateY(0)';
        }, 10);
    },

    closeModernModal() {
        const modal = document.getElementById('st-tracker-modal');
        if (modal) {
            modal.style.opacity = '0';
            modal.children[0].style.transform = 'scale(0.9) translateY(20px)';
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        }
    },

    injectTimelineCSS() {
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
                    animation: timeline-pulse 2s infinite ease-in-out, timeline-shimmer 3s infinite linear;
                }
                .timeline-block-paused {
                    opacity: 0.6 !important;
                    border-top: 2px dashed rgba(255,255,255,0.5);
                    animation: none;
                }
                #timeline-now-marker {
                    z-index: 50 !important;
                }
                #timeline-labels-container {
                    margin-top: 8px !important; /* Perfectly aligns hour label baseline with milestone timestamp boxes */
                    transition: margin-top 0.3s ease;
                }
                .timeline-milestone-flag {
                    z-index: 40;
                }
                .timeline-milestone-time {
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .timeline-milestone-bar {
                    position: relative;
                }
                .timeline-dashed-gaps {
                    background-image: repeating-linear-gradient(45deg, 
                        rgba(0,0,0,0.03) 0px, 
                        rgba(0,0,0,0.03) 2px, 
                        transparent 2px, 
                        transparent 4px
                    );
                }
                .timeline-vibrant-gaps {
                    background: linear-gradient(90deg, 
                        rgba(99, 102, 241, 0.08), 
                        rgba(236, 72, 153, 0.05), 
                        rgba(59, 130, 246, 0.08), 
                        rgba(236, 72, 153, 0.05),
                        rgba(99, 102, 241, 0.08)
                    ) !important;
                    background-size: 400% 100% !important;
                    animation: timeline-gap-shimmer 15s infinite linear !important;
                }
                @keyframes timeline-gap-shimmer {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 400% 50%; }
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
                /* NEW: Intensity Micro-Wave Styles */
                @keyframes timeline-wave-move {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                @keyframes now-pulse-dynamic {
                    0% { box-shadow: 0 0 0 0 var(--now-pulse-color, rgba(6, 182, 212, 0.7)); }
                    70% { box-shadow: 0 0 0 10px var(--now-pulse-spread, rgba(6, 182, 212, 0)); }
                    100% { box-shadow: 0 0 0 0 var(--now-pulse-spread, rgba(6, 182, 212, 0)); }
                }
                @keyframes now-pulse-amber {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                @keyframes target-finish-breath {
                    0% { transform: translateY(0) scale(1); opacity: 0.9; }
                    50% { transform: translateY(-2px) scale(1.02); opacity: 1; }
                    100% { transform: translateY(0) scale(1); opacity: 0.9; }
                }
                
                @keyframes hud-icon-pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes hud-icon-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-hud-pulse {
                    display: inline-block;
                    animation: hud-icon-pulse 2s infinite ease-in-out;
                }
                .animate-hud-spin {
                    display: inline-block;
                    animation: hud-icon-spin 4s infinite linear;
                }

                .timeline-gap-label {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 8px;
                    font-weight: 900;
                    color: rgba(71, 85, 105, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    pointer-events: none;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .timeline-paused-gap:hover .timeline-gap-label {
                    opacity: 1;
                }
                .target-finish-anim {
                    animation: target-finish-breath 3s infinite ease-in-out;
                }
                .now-pulse-active {
                    animation: now-pulse-dynamic 2s infinite !important;
                }
                .now-pulse-break {
                    animation: now-pulse-amber 3s infinite !important;
                }
                #timeline-yesterday-ghost {
                    pointer-events: none;
                    opacity: 0.35;
                    mix-blend-mode: overlay;
                    filter: saturate(0.5);
                }

                /* NEW: Ghost Runner Phantom Styles */
                @keyframes phantom-red-glow {
                    0%, 100% { filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.4)); opacity: 0.8; }
                    50% { filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.9)); opacity: 1; }
                }
                .phantom-warning {
                    animation: phantom-red-glow 1s infinite ease-in-out !important;
                    z-index: 20 !important;
                }
                @keyframes sonic-boom-flare {
                    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8); border: 2px solid white; }
                    100% { box-shadow: 0 0 40px 20px rgba(59, 130, 246, 0); border: 2px solid transparent; }
                }
                .sonic-boom-trigger::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 9999px;
                    animation: sonic-boom-flare 1s ease-out forwards;
                    pointer-events: none;
                    z-index: 5;
                }
                #session-timeline-bar {
                    height: 40px !important;
                    transition: height 0.3s ease;
                }
                #timeline-now-marker {
                    height: 40px !important;
                    width: 2px !important;
                    background: #ef4444 !important; /* Cyber Red */
                    box-shadow: 0 0 5px rgba(239, 68, 68, 0.4); /* Pure Red Glow */
                    z-index: 50 !important;
                }
                #timeline-now-clock {
                    bottom: 100% !important;
                    top: auto !important;
                    left: 15px !important;
                    transform: none !important;
                    margin-bottom: 8px !important;
                    z-index: 60 !important;
                    pointer-events: none;
                    background: none !important; /* No Background */
                    border: none !important;
                    padding: 3px 8px !important;
                    border-radius: 0px !important;
                    box-shadow: none !important;
                    font-size: 11px !important;
                    font-family: 'Inter', 'system-ui', 'Segoe UI', Roboto, sans-serif !important;
                    font-weight: 800 !important; /* Balanced Boldness */
                    color: #0f172a !important; /* Dark Slate for consistency */
                    text-shadow: 
                        0 0 10px rgba(255,255,255,0.8), 
                        0 0 2px rgba(255,255,255,0.4) !important;
                    position: absolute;
                }
                /* Cyber HUD Brackets */
                #timeline-now-clock::after, .timeline-milestone-flag-cyber::after {
                    content: '';
                    position: absolute;
                    inset: -4px;
                    background: 
                        linear-gradient(to right, #ef4444 2px, transparent 2px) 0 0,
                        linear-gradient(to bottom, #ef4444 2px, transparent 2px) 0 0,
                        linear-gradient(to left, #ef4444 2px, transparent 2px) 100% 0,
                        linear-gradient(to bottom, #ef4444 2px, transparent 2px) 100% 0,
                        linear-gradient(to right, #ef4444 2px, transparent 2px) 0 100%,
                        linear-gradient(to top, #ef4444 2px, transparent 2px) 0 100%,
                        linear-gradient(to left, #ef4444 2px, transparent 2px) 100% 100%,
                        linear-gradient(to top, #ef4444 2px, transparent 2px) 100% 100%;
                    background-repeat: no-repeat;
                    background-size: 8px 8px;
                    pointer-events: none;
                }
                /* NEW: Milestone Evolution Engine Styles */
                @keyframes milestone-proximity-pulse {
                    0% { box-shadow: 0 0 0 0 var(--milestone-color-alpha); }
                    50% { box-shadow: 0 0 20px 10px var(--milestone-color-alpha); }
                    100% { box-shadow: 0 0 0 0 var(--milestone-color-alpha); }
                }
                .milestone-approaching .timeline-milestone-bar {
                    animation: milestone-proximity-pulse var(--proximity-pulse-dur, 1.5s) infinite ease-in-out;
                }
                .milestone-reached .timeline-milestone-bar {
                    box-shadow: 0 0 15px var(--milestone-color-alpha) !important;
                    filter: brightness(1.2);
                }
                .milestone-reached .timeline-milestone-flag-cyber::after {
                    border-color: var(--milestone-color) !important;
                    opacity: 1 !important;
                }
                .timeline-milestone-flag-cyber {
                    background: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    text-shadow: none !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.05em;
                    line-height: 1 !important;
                    white-space: nowrap;
                    z-index: 60 !important;
                }
                .milestone-bridge {
                    position: absolute;
                    width: 14px;
                    height: 2px;
                    background: #ef4444;
                    pointer-events: none;
                    z-index: 55;
                }
                .bridge-odd {
                    top: 0;
                    right: 0;
                    width: 19.8px;
                    background: var(--milestone-color);
                    transform: rotate(45deg);
                    transform-origin: right top;
                }
                .bridge-even {
                    bottom: 0;
                    left: 0;
                    width: 33.9px;
                    background: var(--milestone-color);
                    transform: rotate(45deg);
                    transform-origin: left bottom;
                }
                #timeline-now-clock::before {
                    content: '';
                    position: absolute;
                    /* Precise bridge from marker top (-15,-8) relative to clock box */
                    bottom: -8px; 
                    left: -15px;  
                    width: 12px;  
                    height: 1.5px;
                    background: #ef4444;
                    transform: rotate(-20deg); /* Aim up-right at the bracket corner */
                    transform-origin: left bottom;
                    box-shadow: none;
                }
                /* Break Timer HUD (Left side of Now marker) */
                .timeline-break-hud-cyber {
                    position: absolute;
                    bottom: 100%;
                    top: auto;
                    right: 15px; /* Mirror of Now clock's left:15px */
                    transform: none;
                    margin-bottom: 8px;
                    z-index: 60;
                    pointer-events: none;
                    background: none;
                    border: none;
                    padding: 3px 8px;
                    border-radius: 0px;
                    box-shadow: none;
                    font-size: 11px;
                    font-family: 'Inter', 'system-ui', 'Segoe UI', Roboto, sans-serif;
                    font-weight: 800;
                    color: #475569;
                    text-shadow: 
                        0 0 10px rgba(255,255,255,0.8), 
                        0 0 2px rgba(255,255,255,0.4);
                    white-space: nowrap;
                    display: none;
                }
                /* Cyber HUD Brackets for Break Timer */
                .timeline-break-hud-cyber::after {
                    content: '';
                    position: absolute;
                    inset: -4px;
                    background: 
                        linear-gradient(to right, #64748b 2px, transparent 2px) 0 0,
                        linear-gradient(to bottom, #64748b 2px, transparent 2px) 0 0,
                        linear-gradient(to left, #64748b 2px, transparent 2px) 100% 0,
                        linear-gradient(to bottom, #64748b 2px, transparent 2px) 100% 0,
                        linear-gradient(to right, #64748b 2px, transparent 2px) 0 100%,
                        linear-gradient(to top, #64748b 2px, transparent 2px) 0 100%,
                        linear-gradient(to left, #64748b 2px, transparent 2px) 100% 100%,
                        linear-gradient(to top, #64748b 2px, transparent 2px) 100% 100%;
                    background-repeat: no-repeat;
                    background-size: 8px 8px;
                    pointer-events: none;
                }
                /* Bridge connector for Break Timer (right side, mirrored) */
                .timeline-break-hud-cyber::before {
                    content: '';
                    position: absolute;
                    bottom: -8px;
                    right: -15px; /* Mirrored from Now clock's left: -15px */
                    width: 12px;
                    height: 1.5px;
                    background: #64748b;
                    transform: rotate(20deg); /* Mirror angle */
                    transform-origin: right bottom;
                    box-shadow: none;
                }
                .timeline-wave-container {
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    pointer-events: none;
                    opacity: 0.5;
                    z-index: 1;
                }
                .timeline-wave-svg {
                    position: absolute;
                    left: 0;
                    bottom: 0;
                    width: 200%;
                    height: 100%;
                    animation: timeline-wave-move 8s infinite linear;
                }
                @keyframes sync-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes sync-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
                .animate-sync-spin {
                    animation: sync-spin 3s infinite linear;
                }
                .animate-sync-pulse {
                    animation: sync-pulse 2s infinite ease-in-out;
                }
                /* NEW: Interactive Timeline Styles */
                .timeline-block {
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s;
                    cursor: pointer !important;
                }
                .timeline-block:hover {
                    transform: scaleY(1.25);
                    filter: brightness(1.1) saturate(1.2);
                    z-index: 100 !important;
                }
                #timeline-detailed-tooltip {
                    position: fixed;
                    z-index: 9999;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 10px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                    color: white;
                    width: 200px;
                    pointer-events: none;
                    opacity: 0;
                    transform: translateY(5px) scale(0.95);
                    transition: opacity 0.15s, transform 0.15s;
                }
                #timeline-detailed-tooltip.visible {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            `;
            document.head.appendChild(style);
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
        this.historicalPeakHour = peak_hour;

        // Update peak badge
        if (peakBadge && peak_hour !== undefined) {
            const h = peak_hour % 12 || 12;
            const ampm = peak_hour >= 12 ? 'PM' : 'AM';
            peakBadge.textContent = `Peak: ${h}${ampm}`;
            peakBadge.className = 'text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full';
        }

        // Intensity color scale
        const maxMins = Math.max(peak_minutes || 30, 10);
        const getColor = (mins) => {
            if (mins <= 0) return 'rgba(241, 245, 249, 0.4)';
            const ratio = Math.min(1, mins / maxMins);
            if (ratio < 0.25) return `rgba(199, 210, 254, ${0.4 + ratio * 2})`;
            if (ratio < 0.5) return `rgba(165, 180, 252, ${0.5 + ratio})`;
            if (ratio < 0.75) return `rgba(129, 140, 248, ${0.6 + ratio * 0.4})`;
            return `rgba(79, 70, 229, ${0.8 + ratio * 0.2})`; // indigo-600 base
        };

        // Align Hours to 5 AM Cycle
        const orderedHours = [];
        for (let i = 0; i < 24; i++) {
            orderedHours.push((i + this.TIMELINE_START_HOUR) % 24);
        }

        // Build grid HTML
        let html = `
            <style>
                .heatmap-cell {
                    height: 14px;
                    border-radius: 4px;
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s, background 0.3s;
                    cursor: pointer;
                    will-change: transform;
                }
                .heatmap-cell:hover {
                    transform: scale(1.15);
                    z-index: 20;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }
            </style>
            <div style="display:grid; grid-template-columns: 32px repeat(24, 1fr); gap: 3px; min-width: 580px; position:relative; padding: 4px 0;">
                <style>
                    .heatmap-cell-active {
                        position: relative;
                        box-shadow: 0 0 0 2px #4f46e5;
                        z-index: 10;
                        animation: heatmap-pulse 2s infinite;
                        border-radius: 4px;
                    }
                    @keyframes heatmap-pulse {
                        0% { box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.4); }
                        50% { box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.6); }
                        100% { box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.4); }
                    }
                </style>
        `;

        // Header row: empty corner + hour labels
        html += '<div></div>';
        const now = new Date(Date.now() + (this.serverClockOffset || 0));
        const currentHour = now.getHours();

        orderedHours.forEach((h) => {
            const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
            html += `<div style="text-align:center;font-size:8px;font-weight:900;color:#6b7280;line-height:1;padding-bottom:6px;text-transform:lowercase;position:relative;">
                        ${label}
                    </div>`;
        });

        // Data rows
        for (let d = 0; d < 7; d++) {
            const isToday = d === 6;
            const dayStyle = isToday
                ? 'font-size:8px;font-weight:900;color:#4f46e5;line-height:12px;padding-right:4px;'
                : 'font-size:8px;font-weight:700;color:#9ca3af;line-height:12px;padding-right:4px;';
            html += `<div style="${dayStyle}">${days[d]}</div>`;

            // 24 hour cells (Ordered 5 AM to 4 AM)
            orderedHours.forEach(h => {
                const mins = grid[d] ? grid[d][h] : 0;
                const bg = getColor(mins);
                const minsRounded = Math.round(mins);
                const hourLabel = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
                const tooltip = minsRounded > 0
                    ? `${days[d]} ${hourLabel}: ${minsRounded}m studied`
                    : `${days[d]} ${hourLabel}: No study`;

                // Golden Window Check (Peak hour +/- 1)
                const isPeak = Math.abs(h - peak_hour) <= 1;
                const peakStyle = isPeak && minsRounded > 20 ? 'border: 1px solid rgba(99, 102, 241, 0.4);' : '';

                // NOW Marker logic (Distinct Style for Active Cell)
                const isNow = isToday && h === currentHour;
                const activeClass = isNow ? 'heatmap-cell-active' : '';

                // If it's active but has no data, give it a tiny 'prime' tint
                const finalBg = (isNow && mins <= 0) ? 'rgba(79, 70, 229, 0.1)' : bg;

                html += `
                    <div class="heatmap-cell h-cell-${h} ${activeClass}" 
                         title="${tooltip}" 
                         style="background:${finalBg}; ${peakStyle}">
                    </div>`;
            });
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
        const targetSec = (this.DAILY_TARGET_HOURS || 12) * 3600;
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
            let color = this.protocolActive ? '#22d3ee' : '#ef4444';
            let viscosity = 0.5;

            // Priority 1: Active Subject Sync (Override)
            if (this.activeSubjectPalette && !this.protocolActive) {
                color = this.activeSubjectPalette.main;
                speed = 0.06;
                viscosity = 0.75;
            }
            // Priority 2: Standard States
            else if (this.protocolActive) {
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
    },

    calculateBioSyncScore() {
        if (this.historicalPeakHour === undefined) return 0;
        if (!this.sessionTimeline || this.sessionTimeline.length === 0) return 0;

        const peak = this.historicalPeakHour;
        const windowStart = (peak - 1.5 + 24) % 24;
        const windowEnd = (peak + 1.5 + 24) % 24;

        let minutesInWindow = 0;
        const now = new Date(Date.now() + (this.serverClockOffset || 0));
        const currentHour = now.getHours() + now.getMinutes() / 60;

        this.sessionTimeline.forEach(session => {
            if (session.type !== 'pomodoro_active' && session.type !== 'pomodoro') return;

            const start = session.start_hour;
            const end = session.end_hour || (session.type.includes('active') ? currentHour : (start + (session.duration_hours || 0)));

            const isInWindow = (h) => {
                if (windowStart <= windowEnd) {
                    return h >= windowStart && h <= windowEnd;
                } else {
                    return h >= windowStart || h <= windowEnd;
                }
            };

            const durationMins = ((end - start + 24) % 24) * 60;
            for (let i = 0; i < durationMins; i += 5) {
                const chunkHour = (start + (i / 60)) % 24;
                if (isInWindow(chunkHour)) {
                    minutesInWindow += Math.min(5, durationMins - i);
                }
            }
        });

        const score = Math.min(100, (minutesInWindow / 144) * 100);
        return Math.round(score);
    },

    updateBioSyncDisplay() {
        const badge = document.getElementById('bio-sync-badge');
        const text = document.getElementById('bio-sync-text');
        if (!badge || !text) return;

        if (this.historicalPeakHour === undefined || this.studiedSeconds <= 0) {
            badge.classList.add('hidden');
            return;
        }

        const score = this.calculateBioSyncScore();
        text.textContent = `${score}% Sync`;
        badge.classList.remove('hidden');

        const icon = badge.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = 'cyclone';
            icon.classList.add('animate-sync-spin');
        }

        // Dynamic Styling & Animation
        if (score >= 80) {
            badge.className = 'text-[10px] font-black text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 px-2 py-0.5 rounded-lg border-b-2 border-emerald-700 shadow-lg flex items-center gap-1.5 animate-sync-pulse';
            badge.title = "Perfect Sync! You're in your natural flow state.";
        } else if (score >= 40) {
            badge.className = 'text-[10px] font-black text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 px-2 py-0.5 rounded-lg border-b-2 border-indigo-700 shadow-md flex items-center gap-1.5 animate-sync-pulse';
            badge.title = "Good Sync. Alignment is strong.";
        } else {
            // High-visibility vibrant orange for low sync to encourage improvement
            badge.className = 'text-[10px] font-black text-white bg-gradient-to-r from-rose-500 via-orange-400 to-rose-600 px-2 py-0.5 rounded-lg border-b-2 border-rose-700 shadow-md flex items-center gap-1.5 animate-sync-pulse';
            badge.title = "Syncing... align your next session with your peak for a massive boost!";
        }
    },

    // ─── Intelligence Feature 1: Cognitive Decay Predictor ──────────────────
    predictFocusCliff() {
        const countdownEl = document.getElementById('focus-cliff-countdown');
        const badgeEl = document.getElementById('focus-cliff-badge');
        if (!countdownEl || !badgeEl) return;

        const now = new Date(Date.now() + this.serverClockOffset);
        const currentHour = now.getHours() + now.getMinutes() / 60;

        // Strategy: Find the hour where yesterday's BPM declined for 3+ consecutive readings
        let focusCliffHour = null;
        if (this.yesterdayBpmLogs && this.yesterdayBpmLogs.length >= 4) {
            // Sort by hour
            const sorted = [...this.yesterdayBpmLogs]
                .filter(l => l.isActive && l.bpm > 0)
                .sort((a, b) => a.hour - b.hour);

            let declineStreak = 0;
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].bpm < sorted[i - 1].bpm) {
                    declineStreak++;
                    if (declineStreak >= 3) {
                        focusCliffHour = sorted[i - 2].hour; // Point where decline began
                        break;
                    }
                } else {
                    declineStreak = 0;
                }
            }
        }

        // If no historical pattern, estimate based on session duration (average ~4h focus)
        if (focusCliffHour === null) {
            if (this.lastStudyChangeTime && this.studiedSeconds > 0) {
                const sessionStartHour = new Date(this.lastStudyChangeTime).getHours();
                focusCliffHour = (sessionStartHour + 4) % 24; // Default 4h cliff
            } else {
                countdownEl.textContent = 'No data';
                badgeEl.textContent = 'Need more history';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500 w-fit uppercase tracking-tighter';
                return;
            }
        }

        // Calculate time until cliff
        let hoursUntilCliff = focusCliffHour - currentHour;
        if (hoursUntilCliff < 0) hoursUntilCliff += 24;
        if (hoursUntilCliff > 12) hoursUntilCliff = 0; // Already passed today

        // Check if we're currently studying
        const isStudying = document.body.classList.contains('pomo-session-active');

        if (hoursUntilCliff <= 0 || !isStudying) {
            // Already past cliff or not studying
            if (isStudying) {
                countdownEl.textContent = 'Now!';
                badgeEl.textContent = 'Take a break';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter animate-pulse';
            } else {
                const cliffH = Math.floor(focusCliffHour);
                const cliffM = Math.round((focusCliffHour % 1) * 60);
                const ampm = cliffH >= 12 ? 'PM' : 'AM';
                const displayH = cliffH % 12 || 12;
                countdownEl.textContent = `${displayH}:${String(cliffM).padStart(2, '0')} ${ampm}`;
                badgeEl.textContent = 'Predicted cliff';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-100 text-violet-600 w-fit uppercase tracking-tighter';
            }
        } else {
            const h = Math.floor(hoursUntilCliff);
            const m = Math.round((hoursUntilCliff % 1) * 60);
            countdownEl.textContent = h > 0 ? `~${h}h ${m}m` : `~${m}m`;

            // Color based on urgency
            if (hoursUntilCliff <= 0.5) {
                badgeEl.textContent = 'Imminent!';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter animate-pulse';
            } else if (hoursUntilCliff <= 1.5) {
                badgeEl.textContent = 'Approaching';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-600 w-fit uppercase tracking-tighter';
            } else {
                badgeEl.textContent = 'Safe zone';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter';
            }
        }
        this.focusCliffHour = focusCliffHour;
    },

    // ─── Intelligence Feature 2: Time Debt Ledger ───────────────────────────
    weeklyDebtData: null,
    weeklyDebtLastFetch: 0,

    async fetchWeeklyDebt() {
        // Throttle: Only fetch once per 5 minutes
        if (Date.now() - this.weeklyDebtLastFetch < 300000 && this.weeklyDebtData !== null) {
            this.renderTimeDebt();
            return;
        }

        try {
            let totalBalance = 0;
            const dayResults = [];

            // Fetch last 7 days of progress in parallel
            const promises = [];
            for (let i = 1; i <= 7; i++) {
                const date = this.getLogicalDate(-i);
                promises.push(
                    CacheManager.fetchWithCache(`api/analytics/get-yesterday-progress.php?date=${date}`, 300)
                        .then(result => ({
                            day: i,
                            seconds: (result && result.success) ? (result.yesterday_total_seconds || 0) : 0
                        }))
                        .catch(() => ({ day: i, seconds: 0 }))
                );
            }

            const results = await Promise.all(promises);
            results.forEach(r => {
                const diff = r.seconds - this.DAILY_TARGET_SECONDS;
                totalBalance += diff;
                dayResults.push({ day: r.day, seconds: r.seconds, diff });
            });

            this.weeklyDebtData = { totalBalance, days: dayResults };
            this.weeklyDebtLastFetch = Date.now();
            this.renderTimeDebt();
        } catch (e) {
            console.error('[ST-TRACKER] Weekly Debt Error:', e);
        }
    },

    renderTimeDebt() {
        const displayEl = document.getElementById('time-debt-display');
        const badgeEl = document.getElementById('time-debt-badge');
        const cardEl = document.getElementById('time-debt-card');
        if (!displayEl || !badgeEl || !this.weeklyDebtData) return;

        const balance = this.weeklyDebtData.totalBalance;
        const absBalance = Math.abs(balance);
        const h = Math.floor(absBalance / 3600);
        const m = Math.round((absBalance % 3600) / 60);
        const formatted = h > 0 ? `${h}h ${m}m` : `${m}m`;

        if (balance >= 0) {
            // Surplus
            displayEl.textContent = `+${formatted}`;
            displayEl.className = 'text-xl font-black text-emerald-600';
            badgeEl.textContent = 'Surplus · 7 Days';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter';
            if (cardEl) {
                cardEl.className = cardEl.className.replace(/bg-\w+-50\/60/, 'bg-emerald-50/60').replace(/border-\w+-\d+/, 'border-emerald-100');
            }
        } else {
            // Debt
            displayEl.textContent = `-${formatted}`;
            displayEl.className = 'text-xl font-black text-rose-600';

            // Suggest action
            const dailyExtra = Math.ceil(absBalance / 7 / 60); // Extra mins per day
            badgeEl.textContent = `Debt · +${dailyExtra}m/day to clear`;
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter';
            if (cardEl) {
                cardEl.className = cardEl.className.replace(/bg-\w+-50\/60/, 'bg-rose-50/60').replace(/border-\w+-\d+/, 'border-rose-100');
            }
        }
    },

    // ─── Intelligence Feature 3: Smart Subject Rotation ─────────────────────
    checkSubjectRotation() {
        const cardEl = document.getElementById('subject-rotation-card');
        const nameEl = document.getElementById('rotation-subject-name');
        const reasonEl = document.getElementById('rotation-reason');
        if (!cardEl || !nameEl || !reasonEl) return;

        // Only show when actively studying
        const isStudying = document.body.classList.contains('pomo-session-active');
        if (!isStudying || !this.subjects || this.subjects.length < 2) {
            cardEl.classList.add('hidden');
            return;
        }

        // Find current active subject (the one being studied right now)
        const activeSubjects = this.subjects.filter(s => s.seconds > 0);
        if (activeSubjects.length === 0) { cardEl.classList.add('hidden'); return; }

        // Sort by study time to find the most-studied subject today
        const sorted = [...activeSubjects].sort((a, b) => b.seconds - a.seconds);
        const topSubject = sorted[0];

        // Only suggest rotation if the top subject has been studied > 90 minutes
        const topMinutes = topSubject.seconds / 60;
        if (topMinutes < 90) {
            cardEl.classList.add('hidden');
            return;
        }

        // Find the best candidate to switch to:
        // Compare against today's subjects list
        const candidates = this.subjects.filter(s => {
            return s.name !== topSubject.name && s.seconds < topSubject.seconds;
        });

        if (candidates.length === 0) { cardEl.classList.add('hidden'); return; }

        // Score candidates: lower today-time = higher priority
        const scored = candidates.map(c => {
            return {
                name: c.name,
                score: (topSubject.seconds - c.seconds) / 60,
                todayMins: Math.round(c.seconds / 60)
            };
        }).sort((a, b) => b.score - a.score);

        const best = scored[0];
        cardEl.classList.remove('hidden');
        nameEl.textContent = best.name;

        const topMins = Math.round(topMinutes);
        if (best.todayMins === 0) {
            reasonEl.textContent = `${topSubject.name} at ${topMins}m · Start this`;
        } else {
            reasonEl.textContent = `${topSubject.name} at ${topMins}m · This only ${best.todayMins}m`;
        }
        reasonEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-cyan-100 text-cyan-600 w-fit uppercase tracking-tighter';
    },

    // ─── Stats Card: Completion Odds ────────────────────────────────────────
    updateCompletionOdds() {
        const valueEl = document.getElementById('completion-odds-value');
        const badgeEl = document.getElementById('completion-odds-badge');
        if (!valueEl || !badgeEl) return;

        const now = new Date(Date.now() + this.serverClockOffset);
        const rollover = new Date(now.getTime());
        if (now.getHours() >= this.TIMELINE_START_HOUR) {
            rollover.setDate(now.getDate() + 1);
        }
        rollover.setHours(this.TIMELINE_START_HOUR, 0, 0, 0);
        const secondsLeft = Math.max(0, (rollover - now) / 1000);

        const remaining = this.DAILY_TARGET_SECONDS - this.studiedSeconds;

        // Already completed
        if (remaining <= 0) {
            valueEl.textContent = '100%';
            valueEl.className = 'text-2xl font-black text-emerald-600';
            badgeEl.textContent = 'Target Complete!';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter';
            return;
        }

        // No time left
        if (secondsLeft <= 0) {
            valueEl.textContent = '0%';
            valueEl.className = 'text-2xl font-black text-rose-600';
            badgeEl.textContent = 'Day over';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter';
            return;
        }

        // Calculate required pace (minutes of study per hour)
        const hoursLeft = secondsLeft / 3600;
        const remainingHours = remaining / 3600;
        const requiredMinsPerHour = (remainingHours / hoursLeft) * 60;

        // Probability model: based on how feasible the required pace is
        // 45 m/hr = very comfortable (95%), 55 m/hr = pushing (60%), 60 m/hr = impossible (5%)
        let odds;
        if (requiredMinsPerHour <= 30) {
            odds = 98;
        } else if (requiredMinsPerHour <= 40) {
            odds = 92 - (requiredMinsPerHour - 30) * 0.5;
        } else if (requiredMinsPerHour <= 50) {
            odds = 87 - (requiredMinsPerHour - 40) * 2;
        } else if (requiredMinsPerHour <= 55) {
            odds = 67 - (requiredMinsPerHour - 50) * 6;
        } else if (requiredMinsPerHour <= 58) {
            odds = 37 - (requiredMinsPerHour - 55) * 8;
        } else if (requiredMinsPerHour <= 60) {
            odds = 13 - (requiredMinsPerHour - 58) * 5;
        } else {
            odds = Math.max(1, 3 - (requiredMinsPerHour - 60));
        }

        // Boost odds if studying right now (active session adds momentum)
        const isStudying = document.body.classList.contains('pomo-session-active');
        if (isStudying) odds = Math.min(99, odds + 5);

        odds = Math.max(1, Math.min(99, Math.round(odds)));

        valueEl.textContent = `${odds}%`;

        // Color coding
        if (odds >= 70) {
            valueEl.className = 'text-2xl font-black text-emerald-600';
            badgeEl.textContent = 'On track';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter';
        } else if (odds >= 40) {
            valueEl.className = 'text-2xl font-black text-amber-600';
            badgeEl.textContent = 'Needs focus';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-600 w-fit uppercase tracking-tighter';
        } else {
            valueEl.className = 'text-2xl font-black text-rose-600';
            badgeEl.textContent = 'At risk';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter animate-pulse';
        }
    },

    // ─── Stats Card: Daily Streak ───────────────────────────────────────────
    updateDailyStreak() {
        const valueEl = document.getElementById('daily-streak-value');
        const badgeEl = document.getElementById('daily-streak-badge');
        if (!valueEl || !badgeEl || !this.weeklyDebtData) return;

        // Count consecutive days from most recent where seconds >= target
        let streak = 0;
        // Sort by day (1 = yesterday, 2 = day before, etc.)
        const sortedDays = [...this.weeklyDebtData.days].sort((a, b) => a.day - b.day);

        for (const d of sortedDays) {
            if (d.seconds >= this.DAILY_TARGET_SECONDS) {
                streak++;
            } else {
                break; // Streak broken
            }
        }

        // Check if today is also on track (projected)
        const now = new Date(Date.now() + this.serverClockOffset);
        const rollover = new Date(now.getTime());
        if (now.getHours() >= this.TIMELINE_START_HOUR) {
            rollover.setDate(now.getDate() + 1);
        }
        rollover.setHours(this.TIMELINE_START_HOUR, 0, 0, 0);
        const secondsLeft = Math.max(0, (rollover - now) / 1000);
        const remaining = this.DAILY_TARGET_SECONDS - this.studiedSeconds;
        const todayOnTrack = remaining <= 0 || (remaining / secondsLeft) < 1; // Can finish at 1:1 pace

        if (streak === 0) {
            valueEl.textContent = '0';
            valueEl.className = 'text-2xl font-black text-gray-400';
            badgeEl.textContent = todayOnTrack ? 'Start one today!' : 'No streak';
            badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500 w-fit uppercase tracking-tighter';
        } else {
            valueEl.textContent = `🔥 ${streak}`;
            valueEl.className = 'text-2xl font-black text-orange-600';

            if (todayOnTrack) {
                badgeEl.textContent = `${streak + 1} if you finish today`;
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-600 w-fit uppercase tracking-tighter';
            } else {
                badgeEl.textContent = 'Streak at risk!';
                badgeEl.className = 'text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-600 w-fit uppercase tracking-tighter animate-pulse';
            }
        }
    },

    // ─── Stats Card: Session Endurance ───────────────────────────────────────
    updateSessionEndurance() {
        const valueEl = document.getElementById('session-endurance-value');
        const badgeEl = document.getElementById('session-endurance-badge');
        const topEl = document.getElementById('session-endurance-top');
        if (!valueEl || !badgeEl) return;
        
        // Update Record if available
        if (topEl && this.allTimeBestSeconds !== undefined) {
            const th = Math.floor(this.allTimeBestSeconds / 3600);
            const tm = Math.floor((this.allTimeBestSeconds % 3600) / 60);
            topEl.textContent = `Top: ${th > 0 ? th + 'h ' + tm + 'm' : tm + 'm'}`;
        }

        // Focus Volume: Today's total vs Yesterday's full STATIC total
        let totalTodayMins = Math.round((this.studiedSeconds || 0) / 60);
        let totalYesterdayMins = Math.round((this.yesterdayFullTotalSeconds || 0) / 60);

        if (totalTodayMins === 0) {
            valueEl.textContent = '0m';
            valueEl.className = 'text-2xl font-black text-gray-400';
            badgeEl.textContent = 'No study volume yet';
            badgeEl.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500 w-fit uppercase tracking-tighter';
            return;
        }

        const h = Math.floor(totalTodayMins / 60);
        const m = totalTodayMins % 60;
        valueEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
        valueEl.className = 'text-2xl font-black text-teal-600';

        // Compare with yesterday's total
        if (totalYesterdayMins > 0) {
            const yh = Math.floor(totalYesterdayMins / 60);
            const ym = totalYesterdayMins % 60;
            const formattedYesterday = yh > 0 ? `${yh}h ${ym}m` : `${ym}m`;

            const diff = totalTodayMins - totalYesterdayMins;
            if (diff > 0) {
                badgeEl.textContent = `+${diff}m vs ${formattedYesterday} · New PR!`;
                badgeEl.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-600 w-fit uppercase tracking-tighter';
            } else if (diff === 0) {
                badgeEl.textContent = `Tied with ${formattedYesterday}`;
                badgeEl.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-teal-100 text-teal-600 w-fit uppercase tracking-tighter';
            } else {
                badgeEl.textContent = `${diff}m vs ${formattedYesterday}`;
                badgeEl.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-600 w-fit uppercase tracking-tighter';
            }
        } else {
            badgeEl.textContent = 'Volume Tracking Active';
            badgeEl.className = 'text-[11px] font-bold px-1.5 py-0.5 rounded-sm bg-teal-100 text-teal-600 w-fit uppercase tracking-tighter';
        }
    },

    // ─── Stats Card: Velocity ───────────────────────────────────────────────
    updateVelocity() {
        const valueEl = document.getElementById('velocity-value');
        const cardEl = document.getElementById('velocity-card');
        const depthEl = document.getElementById('velocity-depth');
        const ratioEl = document.getElementById('velocity-ratio');
        const accelEl = document.getElementById('velocity-accel');
        const fatigueEl = document.getElementById('velocity-fatigue');

        if (!valueEl || !cardEl) return;

        if (this.studiedSeconds <= 0) {
            valueEl.innerHTML = `--<span class="text-xs opacity-50 font-normal ml-1">m/hr</span>`;
            if (depthEl) depthEl.textContent = '--';
            if (ratioEl) ratioEl.textContent = '--';
            if (accelEl) accelEl.textContent = '--';
            if (fatigueEl) fatigueEl.textContent = '--';
            return;
        }

        const now = new Date(Date.now() + this.serverClockOffset);
        const nowMs = now.getTime();

        // --- 1. Real Data-Driven Speedometer ---
        // Use 5 AM anchor (logical day start) since studiedSeconds = total since 5 AM
        // Velocity = (studiedSeconds / secondsSince5AM) * 60
        // Naturally: studying → ratio improves → speed climbs by decimal
        //            paused   → only elapsed grows → speed drops gradually
        const logicalDateStr = this.getLogicalDate();
        const dayAnchorStr = logicalDateStr.replace(/-/g, '/') + ' ' + String(this.TIMELINE_START_HOUR).padStart(2, '0') + ':00:00';
        const dayAnchor = new Date(dayAnchorStr);
        const elapsedSeconds = Math.max(1, (nowMs - dayAnchor.getTime()) / 1000);
        const velocityRaw = (this.studiedSeconds / elapsedSeconds) * 60;
        const currentVelocity = parseFloat(Math.min(60, Math.max(0, velocityRaw)).toFixed(1));

        // --- 2. Acceleration (delta from previous tick) ---
        const prevVelocity = this.lastRawVelocity !== null ? this.lastRawVelocity : currentVelocity;
        const accelerationDelta = currentVelocity - prevVelocity;

        // --- 3. Daily Focus Ratio (same anchor) ---
        const dailyFocusRatio = Math.min(100, (this.studiedSeconds / elapsedSeconds) * 100);

        // Update Peak Velocity for Fatigue Drop tracking
        if (currentVelocity > (this.peakVelocity || 0)) {
            this.peakVelocity = currentVelocity;
        }

        // --- Calculate Other Sub-Metrics ---
        // Session count from timeline
        const sessionBlocks = document.querySelectorAll('.timeline-block');
        const sessionCount = sessionBlocks ? sessionBlocks.length : 0;

        let sessionDepthMins = 0;
        let sessionDepthDisplay = '0m';
        if (this.lastResumeTime) {
            const depthSecs = Math.floor((nowMs - this.lastResumeTime) / 1000);
            sessionDepthMins = Math.floor(depthSecs / 60);
            sessionDepthDisplay = depthSecs < 60 ? `${depthSecs}s` : `${sessionDepthMins}m`;
        }
        const fatigueDropPercent = this.peakVelocity > 0 ? ((this.peakVelocity - currentVelocity) / this.peakVelocity) * 100 : 0;

        // --- Trend Logic (Sticky) ---
        // Use velocityRaw (unrounded) for high-sensitivity trend detection
        if (this._lastTrendIcon === undefined) {
            this._lastTrendIcon = '↑';
            this._lastTrendClass = 'trend-up-animate';
            this._lastTrendColor = 'text-emerald-600';
        }

        if (this.lastRawVelocity !== null) {
            if (velocityRaw > this.lastRawVelocity) {
                this._lastTrendIcon = '↑';
                this._lastTrendClass = 'trend-up-animate';
                this._lastTrendColor = 'text-emerald-600';
            } else if (velocityRaw < this.lastRawVelocity) {
                this._lastTrendIcon = '↓';
                this._lastTrendClass = 'trend-down-animate';
                this._lastTrendColor = 'text-rose-600';
            }
        }
        this.lastRawVelocity = velocityRaw; // Store UNROUNDED for next tick comparison
        this.lastVelocity = currentVelocity;

        // Apply HTML with pixel-aligned trend arrow
        valueEl.innerHTML = `${currentVelocity.toFixed(1)}<span class="text-xs opacity-50 font-normal ml-1">m/hr</span><span class="trend-animate ${this._lastTrendClass} ${this._lastTrendColor}" style="font-size:14px;display:inline-block;position:relative;top:-12px;margin-left:6px;">${this._lastTrendIcon}</span>`;
        
        // --- 4. Gauge Ranges & Colors ---
        // 0–20: distracted (Slate) | 20–40: weak focus (Amber)
        // 40–55: good (Indigo) | 55–60: deep focus (Fuchsia)
        let themeColorClass = 'text-slate-600';
        let bgClass = 'bg-slate-50/60';
        let borderClass = 'border-slate-100';

        if (currentVelocity >= 55) {
            themeColorClass = 'text-fuchsia-600';
            bgClass = 'bg-fuchsia-50/60';
            borderClass = 'border-fuchsia-100';
        } else if (currentVelocity >= 40) {
            themeColorClass = 'text-indigo-600';
            bgClass = 'bg-indigo-50/60';
            borderClass = 'border-indigo-100';
        } else if (currentVelocity >= 20) {
            themeColorClass = 'text-amber-600';
            bgClass = 'bg-amber-50/60';
            borderClass = 'border-amber-100';
        }

        valueEl.className = `text-2xl font-black ${themeColorClass}`;
        cardEl.className = cardEl.className.replace(/bg-\w+-50\/60/, bgClass).replace(/border-\w+-\d+/, borderClass);

        // Inject Sub-Metrics
        if (depthEl) depthEl.textContent = `S${sessionCount}·${sessionDepthDisplay}`;
        if (ratioEl) ratioEl.textContent = `${Math.round(dailyFocusRatio)}%`;
        if (accelEl) {
            const sign = accelerationDelta > 0 ? '+' : (accelerationDelta < 0 ? '' : '');
            accelEl.textContent = `${sign}${accelerationDelta.toFixed(2)}`;
            accelEl.className = `text-[9px] font-black ${accelerationDelta > 0 ? 'text-emerald-500' : (accelerationDelta < 0 ? 'text-rose-500' : themeColorClass)} opacity-80`;
        }
        if (fatigueEl) {
            const fatigueVal = Math.max(0, fatigueDropPercent);
            fatigueEl.textContent = `${fatigueVal.toFixed(1)}%`;
            fatigueEl.className = `text-[9px] font-black ${fatigueVal > 10 ? 'text-rose-500' : themeColorClass} opacity-80`;
        }
    }
};

window.StudyTargetTracker = StudyTargetTracker;
