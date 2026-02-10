
function initializeTimesPage() {
    lucide.createIcons();

    // UI Range Buttons
    window.loadAnalytics = async function (range = 'today') {
        // UI State
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.getElementById(`btn-${range}`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        const subjectList = document.getElementById('subject-list');
        if (subjectList) {
            subjectList.innerHTML = '<div class="text-center text-gray-500 py-10">Loading data...</div>';
        }

        try {
            // Correct path relative to root index.html where this script runs
            const response = await fetch(`api/analytics/study-time.php?range=${range}`);
            const result = await response.json();

            if (result.success && result.data) {
                renderData(result.data);
            } else {
                if (subjectList) {
                    subjectList.innerHTML = `<div class="text-red-400 text-center">Failed to load data: ${result.error || 'Unknown error'}</div>`;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            if (subjectList) {
                subjectList.innerHTML = '<div class="text-red-400 text-center">Error connecting to server.</div>';
            }
        }
    };

    function renderData(data) {
        // 1. Total Time
        const totalSec = data.total_seconds;
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);

        let timeStr = "";
        if (hours > 0) timeStr += `${hours}<span class="text-lg font-normal text-gray-400">h</span> `;
        timeStr += `${mins}<span class="text-lg font-normal text-gray-400">m</span>`;

        const totalEl = document.getElementById('total-time-display');
        if (totalEl) totalEl.innerHTML = timeStr || "0m";

        // 2. Trend
        const trendEl = document.getElementById('trend-indicator');
        const trendText = document.getElementById('trend-text');
        if (trendEl && trendText) {
            const pct = Math.abs(data.percent_change);
            let trendColor = 'bg-gray-700 text-gray-300';
            let icon = '•';

            if (data.trend === 'improving') {
                trendColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                icon = '▲';
                trendText.textContent = `${pct}% more than previous period`;
            } else if (data.trend === 'declining') {
                trendColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                icon = '▼';
                trendText.textContent = `${pct}% less than previous period`;
            } else {
                trendText.textContent = "Consistent with previous period";
            }

            trendEl.className = `text-sm font-medium px-2 py-0.5 rounded-full ${trendColor}`;
            trendEl.innerHTML = `${icon} ${pct}%`;
        }

        // 2.5. Activity Breakdown
        const breakdownContainer = document.getElementById('total-breakdown');
        if (breakdownContainer) {
            if (data.activity_stats) {
                const stats = data.activity_stats;
                breakdownContainer.innerHTML = `
                    <div class="space-y-4">
                        <div class="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                            <div>
                                <p class="text-[10px] uppercase tracking-wider text-indigo-300/50 font-bold mb-1">Exams Taken</p>
                                <p class="text-xl font-black text-white">${stats.exam_count || 0}</p>
                            </div>
                            <div class="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                                <i data-lucide="book-open" class="w-5 h-5 text-red-400/80"></i>
                            </div>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                            <div>
                                <p class="text-[10px] uppercase tracking-wider text-indigo-300/50 font-bold mb-1">Focus Sessions</p>
                                <p class="text-xl font-black text-white">${stats.session_count || 0}</p>
                            </div>
                            <div class="w-10 h-10 rounded-full bg-indigo-400/10 flex items-center justify-center">
                                <i data-lucide="timer" class="w-5 h-5 text-indigo-400/80"></i>
                            </div>
                        </div>
                        <div class="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors">
                            <div>
                                <p class="text-[10px] uppercase tracking-wider text-indigo-300/50 font-bold mb-1">Avg Session</p>
                                <p class="text-xl font-black text-white">${stats.avg_session_mins || 0}m</p>
                            </div>
                            <div class="w-10 h-10 rounded-full bg-emerald-400/10 flex items-center justify-center">
                                <i data-lucide="zap" class="w-5 h-5 text-emerald-400/80"></i>
                            </div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
            } else {
                breakdownContainer.innerHTML = `<div class="text-center text-gray-500 text-xs py-2">No activity data available</div>`;
            }
        }

        // 2.6. Study Sources
        const sourcesContainer = document.getElementById('study-sources');
        if (sourcesContainer) {
            if (data.source_breakdown) {
                const examTime = data.source_breakdown.exam_seconds || 0;
                const sessionTime = data.source_breakdown.session_seconds || 0;
                const total = examTime + sessionTime;
                const examPct = total > 0 ? Math.round((examTime / total) * 100) : 0;
                const sessionPct = total > 0 ? Math.round((sessionTime / total) * 100) : 0;

                const formatTime = (sec) => {
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                };

                sourcesContainer.innerHTML = `
                    <div class="space-y-5">
                        <div class="p-1">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xs font-bold text-gray-400">Exam Performance</span>
                                <span class="text-xs font-black text-white">${formatTime(examTime)}</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-red-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${examPct}%"></div>
                            </div>
                        </div>
                        <div class="p-1">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xs font-bold text-gray-400">Deep Work</span>
                                <span class="text-xs font-black text-white">${formatTime(sessionTime)}</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${sessionPct}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                sourcesContainer.innerHTML = `<div class="text-center text-gray-500 text-xs py-2">No source data available</div>`;
            }
        }

        // 3. Subject Breakdown
        const listContainer = document.getElementById('subject-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            if (!data.breakdown || data.breakdown.length === 0) {
                listContainer.innerHTML = `
                    <div class="col-span-full text-center py-20 flex flex-col items-center">
                        <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <i data-lucide="coffee" class="w-8 h-8 text-gray-600"></i>
                        </div>
                        <p class="text-gray-500 font-medium">No study activity recorded for this period.</p>
                        <p class="text-xs text-gray-600 mt-1">Time to start a new mission!</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            const maxSeconds = Math.max(...data.breakdown.map(item => item.seconds));

            data.breakdown.forEach((item, index) => {
                const widthPct = (item.seconds / maxSeconds) * 100;
                const h = Math.floor(item.seconds / 3600);
                const m = Math.floor((item.seconds % 3600) / 60);
                const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

                let trendHtml = '';
                if (item.percent_change > 0 && item.trend !== 'same') {
                    const color = item.trend === 'improving' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10';
                    const arr = item.trend === 'improving' ? '▲' : '▼';
                    trendHtml = `<span class="flex items-center gap-1 px-2 py-0.5 rounded-md ${color} text-[9px] font-black tracking-tighter ml-2">${arr} ${Math.abs(item.percent_change)}%</span>`;
                }

                const div = document.createElement('div');
                div.className = 'glass-card p-6 rounded-3xl group border-l-4 border-l-transparent hover:border-l-indigo-500 transition-all';
                const safeId = item.subject.replace(/[^a-zA-Z0-9]/g, '');
                div.innerHTML = `
                    <div class="flex flex-col h-full">
                        <div class="flex justify-between items-start mb-6">
                            <div class="flex items-center gap-1">
                                <h4 class="text-lg font-black text-white group-hover:text-indigo-300 transition-colors">${item.subject}</h4>
                                ${trendHtml}
                            </div>
                            <span class="text-sm font-black text-white/90 font-display">${durStr}</span>
                        </div>
                        
                        <div class="mt-auto">
                            <div class="w-full bg-white/5 rounded-full h-2 overflow-hidden mb-2">
                                <div class="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: 0%" id="bar-${safeId}"></div>
                            </div>
                            <div class="flex justify-between text-[10px] uppercase tracking-widest font-bold text-gray-600">
                                <span>Mastery Level</span>
                                <span>${Math.round(widthPct)}%</span>
                            </div>
                        </div>
                    </div>
                `;
                listContainer.appendChild(div);

                setTimeout(() => {
                    const bar = div.querySelector(`#bar-${safeId}`);
                    if (bar) {
                        bar.style.width = `${widthPct}%`;
                        if (widthPct > 80) bar.classList.add('progress-glow');
                    }
                }, 100 + (index * 50));
            });
        }

    }

    // Initialize with default range
    loadAnalytics('today');
}

// Global invocation - main.js executes this immediately
initializeTimesPage();
