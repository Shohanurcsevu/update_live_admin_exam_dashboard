
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
            subjectList.innerHTML = `
                <div class="col-span-full text-center py-20">
                    <i data-lucide="loader-2" class="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4"></i>
                    <p class="text-slate-400 font-medium">Updating metrics...</p>
                </div>
            `;
            lucide.createIcons();
        }

        try {
            const response = await fetch(`api/analytics/study-time.php?range=${range}`);
            const result = await response.json();

            if (result.success && result.data) {
                renderData(result.data);
            } else {
                if (subjectList) {
                    subjectList.innerHTML = `<div class="text-rose-500 text-center font-bold">Failed to load: ${result.error || 'Unknown error'}</div>`;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            if (subjectList) {
                subjectList.innerHTML = '<div class="text-rose-500 text-center font-bold">Error connecting to server.</div>';
            }
        }
    };

    function renderData(data) {
        // 1. Total Time
        const totalSec = data.total_seconds;
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);

        let timeStr = "";
        if (hours > 0) timeStr += `${hours}<span class="text-2xl font-bold text-indigo-200/80 ml-1">h</span> `;
        timeStr += `${mins}<span class="text-2xl font-bold text-indigo-200/80 ml-1">m</span>`;

        const totalEl = document.getElementById('total-time-display');
        if (totalEl) totalEl.innerHTML = totalSec > 0 ? timeStr : "0<span class='text-2xl font-bold text-indigo-200/80 ml-1'>m</span>";

        // 2. Trend
        const trendEl = document.getElementById('trend-indicator');
        const trendText = document.getElementById('trend-text');
        if (trendEl && trendText) {
            const pct = Math.abs(data.percent_change);
            let trendColor = 'bg-white/10 text-white';
            let icon = '•';

            if (data.trend === 'improving') {
                trendColor = 'bg-emerald-400 text-slate-900 font-bold';
                icon = '▲';
                trendText.textContent = `${pct}% better than last period`;
            } else if (data.trend === 'declining') {
                trendColor = 'bg-rose-400 text-white';
                icon = '▼';
                trendText.textContent = `${pct}% decrease in focus`;
            } else {
                trendText.textContent = "Stable learning pace";
            }

            trendEl.className = `flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${trendColor} border border-white/20`;
            trendEl.innerHTML = `<span class="text-[8px]">${icon}</span> ${pct}%`;
        }

        // 2.5. Activity Breakdown
        const breakdownContainer = document.getElementById('total-breakdown');
        if (breakdownContainer) {
            if (data.activity_stats) {
                const stats = data.activity_stats;
                breakdownContainer.innerHTML = `
                    <div class="space-y-4">
                        <div class="bg-rose-50 p-4 rounded-2xl flex items-center justify-between border border-rose-100 hover:scale-[1.02] transition-transform">
                            <div>
                                <p class="text-[10px] uppercase tracking-widest text-rose-600 font-black mb-1">Knowledge Checks</p>
                                <p class="text-2xl font-black text-slate-900">${stats.exam_count || 0}</p>
                            </div>
                            <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                                <i data-lucide="book-open" class="w-6 h-6 text-rose-500"></i>
                            </div>
                        </div>
                        <div class="bg-indigo-50 p-4 rounded-2xl flex items-center justify-between border border-indigo-100 hover:scale-[1.02] transition-transform">
                            <div>
                                <p class="text-[10px] uppercase tracking-widest text-indigo-600 font-black mb-1">Deep Sessions</p>
                                <p class="text-2xl font-black text-slate-900">${stats.session_count || 0}</p>
                            </div>
                            <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                                <i data-lucide="timer" class="w-6 h-6 text-indigo-500"></i>
                            </div>
                        </div>
                        <div class="bg-emerald-50 p-4 rounded-2xl flex items-center justify-between border border-emerald-100 hover:scale-[1.02] transition-transform">
                            <div>
                                <p class="text-[10px] uppercase tracking-widest text-emerald-600 font-black mb-1">Average Focus</p>
                                <p class="text-2xl font-black text-slate-900">${stats.avg_session_mins || 0}m</p>
                            </div>
                            <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                                <i data-lucide="zap" class="w-6 h-6 text-emerald-500"></i>
                            </div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
            } else {
                breakdownContainer.innerHTML = `<div class="text-center text-slate-400 text-xs font-bold py-6 italic">No metrics recorded yet</div>`;
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
                    <div class="space-y-6">
                        <div class="group">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Exam Prep</span>
                                <span class="text-sm font-black text-slate-900">${formatTime(examTime)}</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div class="bg-rose-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${examPct}%"></div>
                            </div>
                        </div>
                        <div class="group">
                            <div class="flex justify-between items-end mb-2">
                                <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Deep Work</span>
                                <span class="text-sm font-black text-slate-900">${formatTime(sessionTime)}</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div class="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style="width: ${sessionPct}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                sourcesContainer.innerHTML = `<div class="text-center text-slate-400 text-xs font-bold py-6 italic">No source data</div>`;
            }
        }

        // 3. Subject Breakdown
        const listContainer = document.getElementById('subject-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            if (!data.breakdown || data.breakdown.length === 0) {
                listContainer.innerHTML = `
                    <div class="col-span-full text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div class="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="coffee" class="w-8 h-8 text-slate-300"></i>
                        </div>
                        <p class="text-slate-500 font-black uppercase tracking-widest text-xs">No Data Recorded</p>
                        <p class="text-slate-400 text-sm mt-2">Pick a subject to start your progress!</p>
                    </div>
                `;
                lucide.createIcons();
                return;
            }

            const maxSeconds = Math.max(...data.breakdown.map(item => item.seconds));
            const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-cyan-500'];

            data.breakdown.forEach((item, index) => {
                const widthPct = (item.seconds / maxSeconds) * 100;
                const h = Math.floor(item.seconds / 3600);
                const m = Math.floor((item.seconds % 3600) / 60);
                const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                const accentColor = colors[index % colors.length];

                let trendHtml = '';
                if (item.percent_change > 0 && item.trend !== 'same') {
                    const colorClasses = item.trend === 'improving' ? 'text-emerald-600 bg-emerald-100' : 'text-rose-600 bg-rose-100';
                    const icon = item.trend === 'improving' ? '▲' : '▼';
                    trendHtml = `<span class="flex items-center gap-1 px-2 py-0.5 rounded-md ${colorClasses} text-[10px] font-black tracking-tighter">${icon} ${Math.abs(item.percent_change)}%</span>`;
                }

                const div = document.createElement('div');
                div.className = 'stat-card p-6 md:p-8 flex flex-col justify-between group cursor-pointer hover:border-indigo-300 transition-all hover:shadow-lg hover:-translate-y-1';
                div.onclick = () => window.openSubjectDetails(item.subject_id, item.subject);
                const safeId = item.subject.replace(/[^a-zA-Z0-9]/g, '');

                div.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start mb-6">
                            <div class="space-y-1">
                                <h4 class="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">${item.subject}</h4>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-black text-slate-500 uppercase tracking-widest">${durStr}</span>
                                    ${trendHtml}
                                </div>
                            </div>
                            <div class="w-10 h-10 rounded-xl ${accentColor}/10 flex items-center justify-center">
                                <span class="text-xs font-black ${accentColor.replace('bg-', 'text-')}">${index + 1}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <div class="flex justify-between text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">
                            <span>Subject Mastery</span>
                            <span class="text-slate-900">${Math.round(widthPct)}%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="${accentColor} h-full transition-all duration-1000 ease-out shadow-sm" style="width: 0%" id="bar-${safeId}"></div>
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

    // Modal Logic
    window.openSubjectDetails = async function (subjectId, subjectName) {
        const modal = document.getElementById('subject-modal');
        const titleEl = document.getElementById('modal-subject-title');
        const listEl = document.getElementById('modal-activity-list');

        // Get current range
        const activeBtn = document.querySelector('.range-btn.active');
        const range = activeBtn ? (activeBtn.id.replace('btn-', '') || 'today') : 'today';

        if (modal) modal.classList.remove('hidden');
        if (titleEl) titleEl.textContent = `${subjectName} Breakdown`;

        if (listEl) {
            listEl.innerHTML = `
                <div class="animate-pulse space-y-3">
                    <div class="h-16 bg-slate-50 rounded-xl"></div>
                    <div class="h-16 bg-slate-50 rounded-xl"></div>
                    <div class="h-16 bg-slate-50 rounded-xl"></div>
                </div>
            `;
        }

        try {
            const response = await fetch(`api/analytics/get-subject-details.php?subject_id=${subjectId}&range=${range}`);
            const result = await response.json();

            if (result.success) {
                if (result.data.length === 0) {
                    listEl.innerHTML = `<div class="text-center text-slate-400 py-8 italic font-medium">No sessions recorded for this period.</div>`;
                    return;
                }

                listEl.innerHTML = result.data.map(item => `
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-colors">
                        <div>
                            <p class="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">${item.title}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">${item.timestamp.split(' ')[0]} • ${item.formatted_time}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-black text-slate-900">${Math.floor(item.seconds / 60)}<span class="text-xs text-slate-400 ml-0.5 font-bold">m</span></p>
                            ${item.score !== null ? `<p class="text-[10px] font-black uppercase tracking-wider ${item.score >= 80 ? 'text-emerald-500' : 'text-slate-400'}">Score: ${item.score}%</p>` : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                listEl.innerHTML = `<div class="text-rose-500 text-center py-4 font-bold text-sm">Error: ${result.error}</div>`;
            }
        } catch (e) {
            console.error(e);
            if (listEl) listEl.innerHTML = `<div class="text-rose-500 text-center py-4 font-bold text-sm">Failed to load details.</div>`;
        }
    }

    window.closeSubjectModal = function () {
        const modal = document.getElementById('subject-modal');
        if (modal) modal.classList.add('hidden');
    }
}

// Global invocation
initializeTimesPage();
