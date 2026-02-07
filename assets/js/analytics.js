class AnalyticsDashboard {
    constructor() {
        this.progressChart = null;
        this.currentPeriod = 30;
        this.init();
    }

    init() {
        // Time range selector
        const timeRange = document.getElementById('time-range');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.currentPeriod = parseInt(e.target.value);
                this.loadFilteredData();
            });
        }

        // Load all data
        this.loadAllData();
    }

    async loadAllData() {
        try {
            const [heatmapRes, progressRes, studyTimeRes, peakPerfRes] = await Promise.all([
                fetch('api/analytics/activity-heatmap.php'),
                fetch(`api/analytics/subject-progress.php?days=${this.currentPeriod}`),
                fetch(`api/analytics/study-time.php?days=${this.currentPeriod}`),
                fetch(`api/analytics/peak-performance.php?days=${this.currentPeriod}`)
            ]);

            const heatmapData = await heatmapRes.json();
            const progressData = await progressRes.json();
            const studyTimeData = await studyTimeRes.json();
            const peakPerfData = await peakPerfRes.json();

            console.log('Study Time Data:', studyTimeData);

            if (heatmapData.success) this.renderHeatmap(heatmapData);
            if (progressData.success) this.renderProgressChart(progressData);
            if (studyTimeData.success) {
                this.renderStudyTimeStats(studyTimeData);
            } else {
                console.error('Study time API failed:', studyTimeData.error);
                document.getElementById('study-time-stats').innerHTML = `
                    <p class="text-red-500 text-sm">Error loading study time: ${studyTimeData.error || 'Unknown error'}</p>
                `;
            }
            if (peakPerfData.success) this.renderPeakPerformance(peakPerfData);

            this.generateWeeklyReport(studyTimeData, progressData);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    async loadFilteredData() {
        try {
            const [progressRes, studyTimeRes, peakPerfRes] = await Promise.all([
                fetch(`api/analytics/subject-progress.php?days=${this.currentPeriod}`),
                fetch(`api/analytics/study-time.php?days=${this.currentPeriod}`),
                fetch(`api/analytics/peak-performance.php?days=${this.currentPeriod}`)
            ]);

            const progressData = await progressRes.json();
            const studyTimeData = await studyTimeRes.json();
            const peakPerfData = await peakPerfRes.json();

            if (progressData.success) this.renderProgressChart(progressData);
            if (studyTimeData.success) this.renderStudyTimeStats(studyTimeData);
            if (peakPerfData.success) this.renderPeakPerformance(peakPerfData);

            this.generateWeeklyReport(studyTimeData, progressData);
        } catch (error) {
            console.error('Failed to load filtered data:', error);
        }
    }

    renderHeatmap(data) {
        const container = document.getElementById('heatmap-grid');
        if (!container || !data.data || data.data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No activity data available yet. Start studying to see your heatmap!</p>';
            return;
        }

        // Create date map for quick lookup
        const dateMap = {};
        data.data.forEach(item => {
            dateMap[item.date] = item.exam_count;
        });

        // Generate last 365 days
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setDate(today.getDate() - 364);

        // Group by weeks
        const weeks = [];
        let currentWeek = [];
        let currentDate = new Date(oneYearAgo);

        // Start from Sunday
        while (currentDate.getDay() !== 0) {
            currentDate.setDate(currentDate.getDate() - 1);
        }

        for (let i = 0; i < 371; i++) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const count = dateMap[dateStr] || 0;

            currentWeek.push({ date: dateStr, count });

            if (currentDate.getDay() === 6 || i === 370) {
                weeks.push([...currentWeek]);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Render heatmap
        let html = '<div class="flex gap-1">';

        weeks.forEach(week => {
            html += '<div class="flex flex-col gap-1">';
            week.forEach(day => {
                const color = this.getHeatmapColor(day.count);
                const title = `${day.date}: ${day.count} exam${day.count !== 1 ? 's' : ''}`;
                html += `<div class="w-3 h-3 rounded border border-gray-300" style="background-color: ${color}" title="${title}"></div>`;
            });
            html += '</div>';
        });

        html += '</div>';
        container.innerHTML = html;
    }

    getHeatmapColor(count) {
        if (count === 0) return '#e5e7eb'; // gray-200
        if (count <= 2) return '#bbf7d0'; // green-200
        if (count <= 5) return '#4ade80'; // green-400
        return '#16a34a'; // green-600
    }

    renderProgressChart(data) {
        const canvas = document.getElementById('progress-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (!data.subjects || Object.keys(data.subjects).length === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.fillText('No subject data available yet', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Destroy existing chart
        if (this.progressChart) {
            this.progressChart.destroy();
        }

        // Prepare data for Chart.js
        const colors = [
            'rgb(59, 130, 246)',   // blue
            'rgb(16, 185, 129)',   // green
            'rgb(245, 158, 11)',   // amber
            'rgb(239, 68, 68)',    // red
            'rgb(139, 92, 246)',   // purple
            'rgb(236, 72, 153)'    // pink
        ];

        const datasets = [];
        let colorIndex = 0;

        for (const [subject, weeks] of Object.entries(data.subjects)) {
            datasets.push({
                label: subject,
                data: weeks.map(w => w.accuracy),
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: colors[colorIndex % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
                tension: 0.4,
                fill: false
            });
            colorIndex++;
        }

        // Get labels from first subject
        const firstSubject = Object.values(data.subjects)[0];
        const labels = firstSubject.map((w, i) => `Week ${i + 1}`);

        this.progressChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { usePointStyle: true, padding: 15 }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderStudyTimeStats(data) {
        const container = document.getElementById('study-time-stats');
        if (!container) return;

        // Check if there's any data
        if (!data || data.total_sessions === 0) {
            container.innerHTML = `
                <p class="text-gray-500 text-sm">No study data available yet. Start taking exams to see your study time statistics!</p>
            `;
            return;
        }

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div>
                        <p class="text-sm text-gray-600">Total Study Time</p>
                        <p class="text-2xl font-bold text-purple-600">${data.total_formatted}</p>
                    </div>
                    <span class="material-symbols-outlined text-purple-600 text-4xl">schedule</span>
                </div>
                
                <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                        <p class="text-sm text-gray-600">Avg Session</p>
                        <p class="text-2xl font-bold text-blue-600">${data.avg_session_minutes} min</p>
                    </div>
                    <span class="material-symbols-outlined text-blue-600 text-4xl">timer</span>
                </div>
                
                <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                        <p class="text-sm text-gray-600">This Week</p>
                        <p class="text-2xl font-bold text-green-600">${data.week_formatted}</p>
                    </div>
                    <span class="material-symbols-outlined text-green-600 text-4xl">trending_up</span>
                </div>
                
                <div class="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                    <div>
                        <p class="text-sm text-gray-600">Today</p>
                        <p class="text-2xl font-bold text-amber-600">${data.today_formatted}</p>
                    </div>
                    <span class="material-symbols-outlined text-amber-600 text-4xl">today</span>
                </div>
            </div>
        `;
    }

    renderPeakPerformance(data) {
        const container = document.getElementById('peak-performance-stats');
        if (!container) return;

        if (!data.peak_hours || data.peak_hours.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Not enough data yet. Take more exams to see your peak performance times!</p>';
            return;
        }

        const bestHour = data.peak_hours[0];
        const worstHour = data.worst_hours[0];

        container.innerHTML = `
            <div class="space-y-4">
                <div class="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-green-600 text-2xl">emoji_events</span>
                        <div class="flex-1">
                            <p class="text-xs font-bold text-green-900 uppercase">Best Performance</p>
                            <p class="text-lg font-bold text-gray-800 mt-1">${bestHour.label}</p>
                            <p class="text-sm text-gray-600">${bestHour.accuracy}% accuracy (${bestHour.exam_count} exams)</p>
                        </div>
                    </div>
                </div>
                
                ${worstHour ? `
                <div class="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-red-600 text-2xl">trending_down</span>
                        <div class="flex-1">
                            <p class="text-xs font-bold text-red-900 uppercase">Needs Improvement</p>
                            <p class="text-lg font-bold text-gray-800 mt-1">${worstHour.label}</p>
                            <p class="text-sm text-gray-600">${worstHour.accuracy}% accuracy (${worstHour.exam_count} exams)</p>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="p-3 bg-blue-50 rounded-lg">
                    <p class="text-xs font-bold text-blue-900 mb-1">💡 Recommendation</p>
                    <p class="text-sm text-gray-700">Schedule important study sessions during ${bestHour.label} for best results!</p>
                </div>
            </div>
        `;
    }

    generateWeeklyReport(studyTimeData, progressData) {
        const container = document.getElementById('weekly-report');
        if (!container) return;

        const totalExams = studyTimeData.total_sessions || 0;
        const weekHours = studyTimeData.week_formatted || (studyTimeData.this_week_hours + 'h');

        // Calculate improvements
        let improvements = [];
        if (progressData.subjects) {
            for (const [subject, weeks] of Object.entries(progressData.subjects)) {
                if (weeks.length >= 2) {
                    const latest = weeks[weeks.length - 1].accuracy;
                    const previous = weeks[weeks.length - 2].accuracy;
                    const change = latest - previous;
                    if (change > 0) {
                        improvements.push({ subject, change: change.toFixed(1), latest });
                    }
                }
            }
        }

        improvements.sort((a, b) => b.change - a.change);
        const topImprovements = improvements.slice(0, 2);

        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-white p-4 rounded-lg">
                    <p class="text-xs font-bold text-gray-500 uppercase mb-2">This Week</p>
                    <p class="text-2xl font-bold text-purple-600">${totalExams} exams</p>
                    <p class="text-sm text-gray-600">${weekHours} study time</p>
                </div>
                
                ${topImprovements.length > 0 ? `
                <div class="bg-white p-4 rounded-lg">
                    <p class="text-xs font-bold text-gray-500 uppercase mb-2">Top Improvement</p>
                    <p class="text-lg font-bold text-green-600">${topImprovements[0].subject}</p>
                    <p class="text-sm text-gray-600">+${topImprovements[0].change}% this week</p>
                </div>
                ` : '<div class="bg-white p-4 rounded-lg"><p class="text-sm text-gray-500">Keep studying to track improvements!</p></div>'}
                
                <div class="bg-white p-4 rounded-lg">
                    <p class="text-xs font-bold text-gray-500 uppercase mb-2">Next Goal</p>
                    <p class="text-sm text-gray-700">Complete ${Math.max(0, 15 - totalExams)} more exams to reach your weekly target!</p>
                </div>
            </div>
        `;
    }
}

// Initialize dashboard when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AnalyticsDashboard());
} else {
    new AnalyticsDashboard();
}
