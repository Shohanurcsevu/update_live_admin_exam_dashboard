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

    async init() {
        console.log("Initializing Study Target Tracker...");
        await this.fetchAllSubjects();
        this.fetchData();
        this.startUpdateLoop();
        this.initECG();

        // Fetch every 30 seconds for data, but update UI every second
        setInterval(() => this.fetchData(), 30000);
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

        // Otherwise, fetch from activity log
        try {
            const response = await fetch('api/recent-activity.php');
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                // Find oldest activity of today
                const todayActivities = result.data.filter(a => {
                    // Check if it's a study activity (pomodoro or exam)
                    const isStudy = a.activity_type.includes('Exam') || a.activity_type.includes('Subject') || a.activity_type.includes('pomodoro');
                    return isStudy;
                });

                if (todayActivities.length > 0) {
                    // Note: api/recent-activity.php might not provide exact timestamps in a way we can parse perfectly here
                    // Let's assume the first activity we find in the list (which is usually ordered DESC) that's from today
                    // is a good indicator. For now, let's use current time if we can't find it, or better, 
                    // set it to 1 hour ago if we just started.
                    this.firstStartTime = new Date(Date.now() - (this.studiedSeconds * 1000));
                    localStorage.setItem('study_first_start_today', this.firstStartTime.getTime());
                    localStorage.setItem('study_first_start_date', today);
                }
            }
        } catch (e) {
            this.firstStartTime = new Date(Date.now() - (this.studiedSeconds * 1000));
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

        this.checkFeasibility(secondsUntilMidnight, remainingStudySeconds);
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

        // Recommendation logic:
        // Baseline start is 9 AM (to finish 15h by midnight)
        // If they have carryover, start earlier.
        let baseStartHour = 9;
        let carryOverHours = carryoverSeconds / 3600;

        // If they started today at say 8 AM, then maybe suggest 8 AM or earlier.
        let startHour = baseStartHour - (carryOverHours / 2); // Spread extra load
        if (this.firstStartTime) {
            const todayStartHour = this.firstStartTime.getHours();
            startHour = Math.min(startHour, todayStartHour - 0.5);
        }

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

            return `
                <div class="bg-white p-4 rounded-xl border border-gray-100 subject-mini-card">
                    <h4 class="font-black text-gray-800 text-sm mb-3 truncate">${subject.subject_name}</h4>
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
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;

        // Set fixed resolution
        canvas.width = container.clientWidth;
        canvas.height = 60;

        let points = [];
        const maxPoints = 100;
        let frameCount = 0;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background grid
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 20) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
            }
            for (let j = 0; j < canvas.height; j += 20) {
                ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
            }

            // Pulse intensity based on study today
            const baseIntensity = 10;
            const studyBoost = (this.studiedSeconds / 3600);
            const intensity = Math.min(25, baseIntensity + studyBoost * 3);

            // Frequency of main pulse peaks. Slower update rate.
            const pulseInterval = Math.max(60, 120 - studyBoost * 10);

            frameCount++;

            let y = canvas.height / 2;
            const phase = frameCount % pulseInterval;

            // Simulate ECG QRS complex spikes
            if (phase > 10 && phase < 15) {
                y -= intensity; // P wave or start of complex
            } else if (phase >= 15 && phase < 18) {
                y += intensity * 1.5; // Deep spike
            } else if (phase >= 18 && phase < 22) {
                y -= intensity * 0.5; // Return spike
            } else {
                // Subtle baseline wobble
                y += (Math.random() - 0.5) * 2;
            }

            points.push({ y, time: Date.now() });

            if (points.length > maxPoints) points.shift();

            // Draw ECG line
            ctx.beginPath();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';

            for (let i = 0; i < points.length; i++) {
                const px = (i / maxPoints) * canvas.width;
                if (i === 0) ctx.moveTo(px, points[i].y);
                else ctx.lineTo(px, points[i].y);
            }
            ctx.stroke();

            // Leading dot with glow
            const lastPoint = points[points.length - 1];
            ctx.beginPath();
            ctx.fillStyle = '#3b82f6';
            ctx.arc((points.length - 1) / maxPoints * canvas.width, lastPoint.y, 3, 0, Math.PI * 2);
            ctx.fill();

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }
};

window.StudyTargetTracker = StudyTargetTracker;
