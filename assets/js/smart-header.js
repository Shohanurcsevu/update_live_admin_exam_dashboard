/**
 * Smart Header Information Bar Logic
 * Handles real-time clock, date, focus timer, weather, and target goal countdown.
 */

const SmartHeader = {
    timer: null,
    weatherCacheKey: 'smart_header_weather_cache',
    weatherCacheDuration: 30 * 60 * 1000, // 30 minutes
    defaultCity: 'Rajshahi',
    defaultCoords: { lat: 24.3745, lon: 88.6042 },

    init() {
        console.log("Initializing Smart Header...");
        this.updateClock();
        this.updateDate();
        this.fetchWeather();
        this.fetchGoal();
        this.startGlobalTimer();
        this.initEventListeners();
        this.initConnectivityListeners();

        // Initial sync for focus timer if StudyMentor exists
        this.syncFocusTimer();
    },

    startGlobalTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            requestAnimationFrame(() => {
                this.updateClock();
                this.syncFocusTimer();
                this.updateSolarBorder();
                this.updateBackupStatus();

                // Check for midnight to update date and goal
                const now = new Date();
                if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
                    this.updateDate();
                    this.fetchGoal();
                }
            });
        }, 1000);
    },

    updateClock() {
        const clockEl = document.getElementById('header-clock');
        if (!clockEl) return;

        const now = new Date();
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        clockEl.textContent = now.toLocaleTimeString('en-US', options);
    },

    updateDate() {
        const dayTextEl = document.getElementById('header-day-text');
        const monthTextEl = document.getElementById('header-month-text');
        const weekBadge = document.getElementById('header-week-badge');
        const monthBadge = document.getElementById('header-month-badge');

        if (!dayTextEl || !monthTextEl) return;

        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const dayName = days[now.getDay()];
        const dayNameBn = daysBn[now.getDay()];
        const monthName = months[now.getMonth()];
        const dateNum = now.getDate();

        // Update Text
        dayTextEl.textContent = `${dayName} (${dayNameBn})`;
        monthTextEl.textContent = `${dateNum} ${monthName}`;

        // 1. Week Countdown (Days until Friday)
        const currentDay = now.getDay();
        let daysUntilFriday;
        if (currentDay <= 5) {
            daysUntilFriday = 5 - currentDay;
        } else {
            daysUntilFriday = 6;
        }

        if (weekBadge) {
            weekBadge.textContent = daysUntilFriday;
            weekBadge.classList.remove('hidden');
            if (daysUntilFriday <= 1) weekBadge.classList.replace('bg-emerald-500', 'bg-rose-500');
            else weekBadge.classList.replace('bg-rose-500', 'bg-emerald-500');
        }

        // 2. Month Countdown (Days until end of month)
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysUntilMonthEnd = lastDayOfMonth - dateNum;

        if (monthBadge) {
            monthBadge.textContent = daysUntilMonthEnd;
            monthBadge.classList.remove('hidden');
            if (daysUntilMonthEnd <= 3) monthBadge.classList.replace('bg-indigo-500', 'bg-rose-500');
            else monthBadge.classList.replace('bg-rose-500', 'bg-indigo-500');
        }
    },

    updateSolarBorder() {
        const header = document.querySelector('.main-header');
        if (!header) return;

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeDecimal = hour + minute / 60;

        let color = '#f1f5f9'; // Fallback

        // Solar Cycle Colors
        // 5-8: Dawn (Gold/Amber)
        // 8-16: Day (Sky/Indigo)
        // 16-19: Sunset (Orange/Violet)
        // 19-5: Night (Indigo/Slate)

        if (timeDecimal >= 5 && timeDecimal < 9) {
            // Morning Gold (Amber-400 to Orange-400)
            color = '#fbbf24';
        } else if (timeDecimal >= 9 && timeDecimal < 16) {
            // Midday Blue (Sky-400 to Indigo-400)
            color = '#38bdf8';
        } else if (timeDecimal >= 16 && timeDecimal < 19) {
            // Sunset Violet (Orange-500 to Purple-500)
            color = '#8b5cf6';
        } else {
            // Night Indigo (Slate-800)
            color = '#1e293b';
        }

        header.style.setProperty('--header-border-color', color);
        header.classList.add('solar-active');
    },

    updateBackupStatus() {
        const pulse = document.getElementById('backup-pulse');
        const unsavedDot = document.getElementById('unsaved-indicator');
        const statusText = document.getElementById('backup-status-text');
        if (!pulse || !statusText) return;

        const manager = window.autoBackupManager;
        const needsBackup = window.needsBackup;
        if (!manager) return;

        const settings = manager.getSettings();
        const isRunning = manager.isRunning();

        // 🟡 AMBER DOT: Show/Hide based on unsaved data
        if (unsavedDot) {
            if (needsBackup) {
                unsavedDot.classList.remove('hidden');
                unsavedDot.title = 'You have unsaved changes';
            } else {
                unsavedDot.classList.add('hidden');
            }
        }

        // --- Standard Backup Pulse Logic ---

        // 🟢 Blinking Green: A backup is currently in progress
        if (isRunning) {
            pulse.className = 'w-2 h-2 rounded-full cursor-help relative status-syncing';
            statusText.textContent = 'Syncing Backup...';
            pulse.title = 'Backup: Actively Syncing';
            return;
        }

        // 🔴 Solid Red: The last backup failed or requires authentication
        const isAuthorized = manager.getActiveHandle();
        if (settings.lastError || (settings.enabled && settings.folderName && !isAuthorized && manager.supportsFileSystemAccess())) {
            pulse.className = 'w-2 h-2 rounded-full cursor-help relative status-warning';
            statusText.textContent = settings.lastError ? `Error: ${settings.lastError}` : 'Auth Required';
            pulse.title = settings.lastError 
                ? `Last failure: ${new Date(settings.lastAttemptAt).toLocaleTimeString()}` 
                : 'Click to re-authorize backup folder';
            return;
        }

        // ⚫ Solid Slate: Backup is disabled or folder missing
        if (!settings.enabled || (settings.enabled && !settings.folderName && manager.supportsFileSystemAccess())) {
            pulse.className = 'w-2 h-2 rounded-full cursor-help relative bg-slate-400 shadow-none';
            statusText.textContent = !settings.enabled ? 'Auto-Backup Disabled' : 'Folder Required';
            pulse.title = !settings.enabled ? 'Enable in Settings' : 'Select a backup folder';
            return;
        }

        // 🔵 Healthy: Data is fully synced
        pulse.className = 'w-2 h-2 rounded-full cursor-help relative status-healthy';
        const lastRun = settings.lastRunAt ? new Date(settings.lastRunAt) : null;
        if (lastRun) {
            const timeStr = lastRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            statusText.textContent = `Live & Synced (Last: ${timeStr})`;
            pulse.title = `Last backup: ${lastRun.toLocaleString()}`;
        } else {
            statusText.textContent = 'Monitoring...';
            pulse.title = 'Waiting for first backup';
        }
    },

    initConnectivityListeners() {
        // Listen for internal backup manager events
        window.addEventListener('autoBackupStarted', () => this.updateBackupStatus());
        window.addEventListener('autoBackupComplete', () => this.updateBackupStatus());
        window.addEventListener('autoBackupNeedsFolderAuth', () => this.updateBackupStatus());

        // Basic network fallback (still useful info for backup status)
        window.addEventListener('online', () => this.updateBackupStatus());
        window.addEventListener('offline', () => {
            const statusText = document.getElementById('backup-status-text');
            if (statusText) statusText.textContent = 'Offline (Sync Paused)';
            this.updateBackupStatus();
        });
    },

    async fetchWeather() {
        const iconEl = document.getElementById('header-weather-icon');
        const tempEl = document.getElementById('header-weather-temp');
        const cityEl = document.getElementById('header-weather-city');

        // Check Cache
        const cached = localStorage.getItem(this.weatherCacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < this.weatherCacheDuration) {
                this.renderWeather(data);
                return;
            }
        }

        try {
            // 1. Get Accurate Location (Priority: Browser Geolocation -> IP-based -> Default)
            let location = this.defaultCoords;
            let city = this.defaultCity;

            const getLocation = () => {
                return new Promise((resolve) => {
                    if (!navigator.geolocation) return resolve(null);
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                        () => resolve(null),
                        { timeout: 5000 }
                    );
                });
            };

            const geoLoc = await getLocation();

            if (geoLoc) {
                location = geoLoc;
                // Fetch actual city name via reverse geocoding
                try {
                    const revRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lon}&localityLanguage=en`);
                    const revData = await revRes.json();
                    city = revData.city || revData.locality || "Rajshahi";
                } catch (e) {
                    console.warn("Reverse geocoding failed:", e);
                    city = "Rajshahi";
                }
            } else {
                // Fallback to IP-based detection
                try {
                    const locRes = await fetch('https://ipapi.co/json/');
                    const locData = await locRes.json();
                    if (locData.latitude && locData.longitude) {
                        location = { lat: locData.latitude, lon: locData.longitude };
                        city = locData.city || this.defaultCity;
                    }
                } catch (e) {
                    console.warn("IP Location detection failed:", e);
                }
            }

            // 2. Fetch Weather from Open-Meteo
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true`);
            const weatherData = await weatherRes.json();

            if (weatherData && weatherData.current_weather) {
                const weather = {
                    temp: Math.round(weatherData.current_weather.temperature),
                    code: weatherData.current_weather.weathercode,
                    city: city
                };

                // Cache it
                localStorage.setItem(this.weatherCacheKey, JSON.stringify({
                    data: weather,
                    timestamp: Date.now()
                }));

                this.renderWeather(weather);
            }
        } catch (error) {
            console.error("Weather fetch failed:", error);
            // Fallback to cached value if exists, even if expired
            if (cached) {
                const { data } = JSON.parse(cached);
                this.renderWeather(data);
            } else {
                if (tempEl) tempEl.textContent = "—°C";
                if (cityEl) cityEl.textContent = "Offline";
            }
        }
    },

    renderWeather(data) {
        const iconEl = document.getElementById('header-weather-icon');
        const tempEl = document.getElementById('header-weather-temp');
        const cityEl = document.getElementById('header-weather-city');
        const tooltip = document.querySelector('#header-weather div');

        if (tempEl) tempEl.textContent = `${data.temp}°C`;
        if (cityEl) cityEl.textContent = data.city;
        if (iconEl) iconEl.textContent = this.getWeatherIcon(data.code);
        if (tooltip) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            tooltip.textContent = `Cloudy in ${data.city} • Last updated: ${time}`;
        }
    },

    getWeatherIcon(code) {
        // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
        if (code === 0) return '☀️'; // Clear sky
        if (code <= 3) return '🌤️'; // Partly cloudy
        if (code <= 48) return '☁️'; // Fog/Cloudy
        if (code <= 67) return '🌧️'; // Rain
        if (code <= 77) return '❄️'; // Snow
        if (code <= 82) return '🌧️'; // Rain showers
        if (code <= 99) return '⛈️'; // Thunderstorm
        return '☁️';
    },

    async fetchGoal() {
        const goalNameEl = document.getElementById('header-goal-name');
        const goalCountdownEl = document.getElementById('header-goal-countdown');
        const goalDisplay = document.getElementById('header-goal-display');
        const setGoalCta = document.getElementById('header-set-goal-cta');

        try {
            const res = await fetch('api/dashboard/job_countdown.php');
            const result = await res.json();

            if (result.success && result.data) {
                const goal = result.data;
                const deadline = new Date(goal.deadline);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const diffTime = deadline - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (goalNameEl) goalNameEl.textContent = goal.job_name;
                if (goalCountdownEl) {
                    if (diffDays > 0) {
                        goalCountdownEl.textContent = `${diffDays} days left`;
                        goalCountdownEl.className = "text-[13px] font-bold text-indigo-600 tabular-nums";
                    } else if (diffDays === 0) {
                        goalCountdownEl.textContent = `Today!`;
                        goalCountdownEl.className = "text-[13px] font-black text-rose-600 animate-pulse tabular-nums";
                    } else {
                        goalCountdownEl.textContent = `Goal reached`;
                        goalCountdownEl.className = "text-[13px] font-bold text-slate-400 tabular-nums";
                    }
                }

                if (goalDisplay) goalDisplay.classList.remove('hidden');
                if (setGoalCta) setGoalCta.classList.add('hidden');
            } else {
                if (goalDisplay) goalDisplay.classList.add('hidden');
                if (setGoalCta) setGoalCta.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Goal fetch failed:", error);
        }
    },

    syncFocusTimer() {
        const focusTimerEl = document.getElementById('header-focus-timer');
        const focusContainer = document.getElementById('header-focus-container');
        if (!focusTimerEl || !focusContainer) return;

        if (window.studyMentor) {
            if (window.studyMentor.isFocusModeActive() || window.studyMentor.isBreakModeActive()) {
                const isFocus = window.studyMentor.isFocusModeActive();
                const timeRemaining = isFocus ? window.studyMentor.focusSession.timeRemaining : window.studyMentor.breakSession.timeRemaining;

                const mins = Math.floor(timeRemaining / 60);
                const secs = timeRemaining % 60;
                const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

                focusTimerEl.textContent = `${isFocus ? 'Focus' : 'Break'}: ${timeStr}`;
                focusTimerEl.className = `text-[13px] font-black uppercase tracking-tight tabular-nums ${isFocus ? 'text-emerald-600' : 'text-sky-600'}`;
                focusContainer.classList.remove('opacity-40');

                // Icon animation
                const icon = focusContainer.querySelector('.material-symbols-outlined');
                if (icon) {
                    icon.textContent = isFocus ? 'rocket_launch' : 'self_care';
                    icon.className = `material-symbols-outlined text-[14px] ${isFocus ? 'animate-rocket' : 'text-sky-500 animate-neural-glow'}`;
                }
            } else {
                // Show Idle Time from StudyMentor
                const mentor = window.studyMentor;
                const now = Math.floor(Date.now() / 1000);
                const currentServerTime = now + (mentor.serverInactivityData.serverOffset || 0);
                let seconds = mentor.serverInactivityData.idleBaseline || 0;
                seconds += Math.max(0, currentServerTime - (mentor.serverInactivityData.syncTime || now));

                const timeStr = mentor.formatInactivityTime ? mentor.formatInactivityTime(seconds) : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

                focusTimerEl.textContent = `Idle: ${timeStr}`;
                focusTimerEl.className = "text-[13px] font-black text-rose-500 uppercase tracking-tight tabular-nums";
                focusContainer.classList.remove('opacity-40');

                const icon = focusContainer.querySelector('.material-symbols-outlined');
                if (icon) {
                    icon.textContent = 'hourglass_top';
                    icon.className = "material-symbols-outlined text-[14px] text-rose-400 animate-spin-infinite";
                }
            }

            // Sync Sound Icon
            const soundBtn = document.getElementById('header-sound-toggle');
            if (soundBtn) {
                const soundIcon = soundBtn.querySelector('.material-symbols-outlined');
                if (soundIcon) {
                    const isEnabled = window.studyMentor.isSoundEnabled;
                    soundIcon.textContent = isEnabled ? 'volume_up' : 'volume_off';
                    soundIcon.className = `material-symbols-outlined text-xl ${isEnabled ? 'text-indigo-500' : 'text-slate-400'}`;
                }
            }
        } else {
            focusTimerEl.textContent = "Ready to Focus";
            focusTimerEl.className = "text-[13px] font-black text-slate-400 uppercase tracking-tight tabular-nums";
            focusContainer.classList.add('opacity-40');
            const icon = focusContainer.querySelector('.material-symbols-outlined');
            if (icon) {
                icon.textContent = 'timer';
                icon.className = "material-symbols-outlined text-[14px] text-slate-300";
            }
        }
    },

    initEventListeners() {
        const setGoalCta = document.getElementById('header-set-goal-cta');
        if (setGoalCta) {
            setGoalCta.addEventListener('click', () => {
                if (window.loadPage) window.loadPage('dashboard');
            });
        }

        const streakMini = document.getElementById('streak-counter-mini');
        if (streakMini) {
            streakMini.addEventListener('click', () => {
                if (window.loadPage) window.loadPage('analytics');
            });
        }

        const soundToggle = document.getElementById('header-sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                if (window.studyMentor && typeof window.studyMentor.toggleSound === 'function') {
                    window.studyMentor.toggleSound();
                    this.syncFocusTimer(); // Immediate UI update
                }
            });

            // Right-click shortcut: Cycle sounds
            soundToggle.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.FontPicker && typeof window.FontPicker.sounds !== 'undefined') {
                    const fp = window.FontPicker;
                    const currentIndex = fp.sounds.findIndex(s => s.file === fp._currentSound);
                    const nextIndex = (currentIndex + 1) % fp.sounds.length;
                    const nextSound = fp.sounds[nextIndex];
                    
                    fp._applySound(nextSound.file);
                    fp._updateActiveState();
                    
                    if (window.showToast) {
                        window.showToast(`Sound: ${nextSound.label}`, 'info');
                    }
                }
            });
        }
    }
};

// Auto-initialize when script loads
window.SmartHeader = SmartHeader;
