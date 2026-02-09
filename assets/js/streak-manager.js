/**
 * StreakManager
 * 
 * Handles daily streaks, fetching from API, local caching, and UI updates.
 */

class StreakManager {
    constructor() {
        this.currentStreak = 0;
        this.lastActivityDate = null;
        this.streakElement = null;
        this.flameIcon = null;
    }

    /**
     * Initialize the streak manager
     */
    async init() {
        this.streakElement = document.getElementById('streak-count');
        this.flameIcon = document.getElementById('streak-flame');

        await this.fetchStreak();
        this.updateUI();
    }

    /**
     * Fetch streak data from the API
     */
    async fetchStreak() {
        try {
            const response = await fetch('api/streak/get-streak.php');
            const result = await response.json();

            if (result.success) {
                this.currentStreak = result.data.current_streak;
                this.lastActivityDate = result.data.last_activity_date;

                // Save to IndexedDB for offline access
                if (typeof idbManager !== 'undefined') {
                    await idbManager.setMetadata('user_streak', this.currentStreak);
                    await idbManager.setMetadata('last_activity_date', this.lastActivityDate);
                }
            } else {
                // Fallback to IndexedDB
                await this.loadFromOffline();
            }
        } catch (error) {
            console.error("StreakManager: Failed to fetch streak:", error);
            await this.loadFromOffline();
        }
    }

    /**
     * Load streak data from IndexedDB fallback
     */
    async loadFromOffline() {
        if (typeof idbManager !== 'undefined') {
            this.currentStreak = await idbManager.getMetadata('user_streak') || 0;
            this.lastActivityDate = await idbManager.getMetadata('last_activity_date') || null;
        }
    }

    /**
     * Record activity and increment streak if it's a new day
     */
    async recordActivity() {
        try {
            const response = await fetch('api/streak/record-activity.php', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                const oldStreak = this.currentStreak;
                this.currentStreak = result.data.current_streak;
                this.updateUI();

                if (result.data.is_new_day) {
                    this.showSuccessEffects(oldStreak, this.currentStreak);
                }
            }
        } catch (error) {
            console.error("StreakManager: Failed to record activity:", error);
        }
    }

    /**
     * Update the header UI with current streak
     */
    updateUI() {
        if (this.streakElement) {
            this.streakElement.textContent = this.currentStreak;
        }

        if (this.flameIcon) {
            const color = this.getFlameColor(this.currentStreak);
            this.flameIcon.style.color = color;

            // Add subtle glow effect for high streaks
            if (this.currentStreak >= 30) {
                this.flameIcon.classList.add('animate-pulse');
                this.flameIcon.style.textShadow = `0 0 10px ${color}`;
            } else {
                this.flameIcon.classList.remove('animate-pulse');
                this.flameIcon.style.textShadow = 'none';
            }
        }
    }

    /**
     * Get flame color based on streak count
     */
    getFlameColor(streak) {
        if (streak === 0) return '#94a3b8'; // gray-400
        if (streak < 4) return '#facc15';  // yellow-400
        if (streak < 8) return '#fb923c';  // orange-400
        if (streak < 15) return '#f87171'; // red-400
        if (streak < 30) return '#c084fc'; // purple-400
        return '#60a5fa'; // blue-400 (Diamond/Legendary)
    }

    /**
     * Show celebration effects when streak increases
     */
    showSuccessEffects(oldStreak, newStreak) {
        // Only show confetti for milestones (every 7 days or first day)
        if (newStreak % 7 === 0 || newStreak === 1) {
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: [this.getFlameColor(newStreak), '#ffffff']
                });
            }
        }

        // Pulse animation on the counter
        if (this.streakElement) {
            this.streakElement.parentElement.classList.add('scale-125');
            setTimeout(() => {
                this.streakElement.parentElement.classList.remove('scale-125');
            }, 500);
        }
    }
}

const streakManager = new StreakManager();
window.streakManager = streakManager;
