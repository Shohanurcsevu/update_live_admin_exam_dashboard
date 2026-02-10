// FILE: assets/js/dashboard-study-time.js
// Dashboard Study Time Card Module

class DashboardStudyTime {
    constructor() {
        this.data = null;
        this.init();
    }

    async init() {
        console.log('[DashboardStudyTime] Initializing...');
        try {
            await this.loadTodayData();
            this.render();
            console.log('[DashboardStudyTime] Initialization complete');
        } catch (error) {
            console.error('[DashboardStudyTime] Initialization failed:', error);
            this.renderEmpty();
        }
    }

    async loadTodayData() {
        console.log('[DashboardStudyTime] Loading today\'s data...');
        try {
            const response = await fetch('api/analytics/study-time.php?range=today');
            console.log('[DashboardStudyTime] API response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[DashboardStudyTime] API result:', result);

            if (result.success && result.data) {
                this.data = result.data;
                console.log('[DashboardStudyTime] Data loaded successfully:', this.data);
            } else {
                console.error('[DashboardStudyTime] Failed to load study time data:', result);
                this.data = null;
            }
        } catch (error) {
            console.error('[DashboardStudyTime] Error loading study time data:', error);
            this.data = null;
        }
    }

    render() {
        console.log('[DashboardStudyTime] Rendering with data:', this.data);

        if (!this.data) {
            this.renderEmpty();
            return;
        }

        // Update total time
        const totalEl = document.getElementById('study-time-total');
        if (!totalEl) {
            console.error('[DashboardStudyTime] Element #study-time-total not found!');
            return;
        }

        const hours = Math.floor(this.data.total_seconds / 3600);
        const mins = Math.floor((this.data.total_seconds % 3600) / 60);
        totalEl.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        console.log('[DashboardStudyTime] Updated total time:', totalEl.textContent);

        // Update trend indicator
        const trendEl = document.getElementById('study-time-trend');
        if (!trendEl) {
            console.error('[DashboardStudyTime] Element #study-time-trend not found!');
            return;
        }

        if (this.data.trend === 'improving') {
            trendEl.innerHTML = `<span class="text-green-300">▲ ${Math.abs(this.data.percent_change)}% vs yesterday</span>`;
        } else if (this.data.trend === 'declining') {
            trendEl.innerHTML = `<span class="text-red-300">▼ ${Math.abs(this.data.percent_change)}% vs yesterday</span>`;
        } else {
            trendEl.innerHTML = `<span class="text-white/60">• Same as yesterday</span>`;
        }
        console.log('[DashboardStudyTime] Updated trend:', this.data.trend);

        // Render subject breakdown
        this.renderSubjects();
    }

    renderSubjects() {
        console.log('[DashboardStudyTime] Rendering subjects...');
        const container = document.getElementById('study-time-subjects');

        if (!container) {
            console.error('[DashboardStudyTime] Element #study-time-subjects not found!');
            return;
        }

        if (!this.data.breakdown || this.data.breakdown.length === 0) {
            container.innerHTML = '<div class="text-center text-white/60 text-xs py-2">No study activity yet today</div>';
            return;
        }

        // Show top 3 subjects
        const topSubjects = this.data.breakdown.slice(0, 3);
        const maxSeconds = Math.max(...topSubjects.map(s => s.seconds));

        let html = '';
        topSubjects.forEach(subject => {
            const widthPct = (subject.seconds / maxSeconds) * 100;
            const h = Math.floor(subject.seconds / 3600);
            const m = Math.floor((subject.seconds % 3600) / 60);
            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

            html += `
                <div class="group">
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-white/90 font-medium truncate">${subject.subject}</span>
                        <span class="text-white font-bold">${timeStr}</span>
                    </div>
                    <div class="w-full bg-white/20 rounded-full h-1.5">
                        <div class="bg-white h-1.5 rounded-full transition-all duration-1000" style="width: ${widthPct}%"></div>
                    </div>
                </div>
            `;
        });

        // Add "more" indicator if there are more than 3 subjects
        if (this.data.breakdown.length > 3) {
            const remaining = this.data.breakdown.length - 3;
            html += `
                <div class="text-center text-white/60 text-xs pt-1">
                    +${remaining} more subject${remaining > 1 ? 's' : ''}
                </div>
            `;
        }

        container.innerHTML = html;

        // Trigger animation
        setTimeout(() => {
            container.querySelectorAll('.bg-white.h-1\\.5').forEach(bar => {
                bar.style.width = bar.style.width; // Force reflow for animation
            });
        }, 100);
    }

    renderEmpty() {
        console.log('[DashboardStudyTime] Rendering empty state');
        const totalEl = document.getElementById('study-time-total');
        const trendEl = document.getElementById('study-time-trend');
        const container = document.getElementById('study-time-subjects');

        if (totalEl) totalEl.textContent = '0m';
        if (trendEl) trendEl.innerHTML = '';
        if (container) container.innerHTML = '<div class="text-center text-white/60 text-xs py-2">No study activity yet today</div>';

        console.log('[DashboardStudyTime] Empty state rendered');
    }
}
