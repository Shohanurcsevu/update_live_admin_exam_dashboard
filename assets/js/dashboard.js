
function initializeDashboardPage() {
    // --- URLs ---
    const METRICS_API_URL = 'api/dashboard-metrics.php';
    const EXAMS_API_URL = 'api/dashboard-exams.php';
    const DELETE_EXAM_API_URL = 'api/exam/exam.php'; // Re-use existing exam API for delete
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // Global Error Tracker for debugging
    if (!window.dashboardErrorTracked) {
        window.addEventListener('error', function (event) {
            if (event.filename && event.filename.includes('dashboard.js')) {
                console.error("[Dashboard Internal Error]", event.message, event.error);
                if (typeof showToast === 'function') showToast(`Error: ${event.message}`, 'error');
            }
        });
        window.dashboardErrorTracked = true;
    }

    // --- DOM Elements ---
    const subjectFilter = document.getElementById('exam-subject-filter');
    const lessonFilter = document.getElementById('exam-lesson-filter');
    const topicFilter = document.getElementById('exam-topic-filter');
    const clearFiltersBtn = document.getElementById('clear-dashboard-filters');
    const examCardsContainer = document.getElementById('exam-cards-container');
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const toastContainer = document.getElementById('toast-container');

    console.log("[Dashboard] Elements check:", {
        subjectFilter: !!subjectFilter,
        lessonFilter: !!lessonFilter,
        topicFilter: !!topicFilter,
        clearFiltersBtn: !!clearFiltersBtn,
        examCardsContainer: !!examCardsContainer
    });

    // Print Options: generatePdfBtn is used by processAndPrint() for loading state.
    // The print modal itself (open/close) is managed by PrintEngine.
    const generatePdfBtn = document.getElementById('generate-pdf-btn');

    let examIdToDelete = null;

    // --- Helper Functions ---
    window.showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    };
    const showToast = window.showToast;

    // --- Section 1: Summary Cards Logic ---
    function animateCount(element, targetValue) {
        if (!element) return;
        const end = parseInt(targetValue, 10);
        if (isNaN(end)) { element.textContent = targetValue; return; }
        const duration = 1200;
        let startTime = null;
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const progress = currentTime - startTime;
            const currentNumber = Math.min(Math.floor(progress / duration * end), end);
            element.textContent = currentNumber;
            if (progress < duration) requestAnimationFrame(animation);
            else element.textContent = end;
        }
        requestAnimationFrame(animation);
    }

    async function fetchAndDisplayMetrics(skipRevalidate = false) {
        try {
            const result = await CacheManager.fetchWithCache(METRICS_API_URL, 0.5, false, skipRevalidate);
            const metrics = result;
            animateCount(document.getElementById('total-subjects'), metrics.subjects);
            animateCount(document.getElementById('total-lessons'), metrics.lessons);
            animateCount(document.getElementById('total-topics'), metrics.topics);
            animateCount(document.getElementById('total-exams'), metrics.exams);
            animateCount(document.getElementById('total-questions'), metrics.questions);

            // Mistake Bank Stats
            fetchMistakeStats();
            fetchStudyTimeStats(); // NEW: Study Time Stats
            fetchAndRenderHeatmap();
            fetchAndRenderDisciplineTracker();
            fetchAndRenderBadges();
            fetchAndRenderMasteryTrends(); // NEW: Mastery Trends
            fetchAndDisplayRecommendations(); // NEW: Smart Recommendations
            fetchSRSStats(); // NEW: SRS Stats
        } catch (error) {
            console.error("[Dashboard] Error fetching metrics:", error);
            showToast('Failed to load some dashboard metrics.', 'error');
        }
    }

    async function fetchSRSStats() {
        const countEl = document.getElementById('srs-due-count');
        const btn = document.getElementById('start-srs-review-btn');
        if (!countEl || !btn) return;

        try {
            const response = await fetch('api/performance/srs-stats.php');
            const result = await response.json();

            if (result.success) {
                animateCount(countEl, result.due_count);
                if (result.due_count === 0) {
                    btn.disabled = true;
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    btn.innerHTML = 'Queue Empty <span class="material-symbols-outlined text-sm">done_all</span>';
                } else {
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    btn.innerHTML = `Review ${result.due_count} Items <span class="material-symbols-outlined text-sm">auto_fix_high</span>`;
                }
            }
        } catch (error) {
            console.error("[Dashboard] SRS Fetch Error:", error);
        }

        // Setup button click
        btn.onclick = async () => {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Loading Queue...';

            try {
                const createResponse = await fetch('api/custom-exam/create-from-performance.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mode: 'srs_review',
                        exam_title: 'Daily SRS Review',
                        limit: 20
                    })
                });
                const createResult = await createResponse.json();

                if (createResult.success) {
                    if (confirm("Your revision queue is ready. Start now?")) {
                        window.loadPage('take-exam-interface', `?exam_id=${createResult.exam_id}`);
                    }
                } else {
                    alert(createResult.message || "No items due for review right now.");
                }
            } catch (err) {
                console.error("SRS Creation failed", err);
                alert("A network error occurred.");
            } finally {
                btn.disabled = false;
                fetchSRSStats(); // Refresh count
            }
        };
    }

    async function fetchAndDisplayRecommendations(skipRevalidate = false) {
        const container = document.getElementById('recommendations-container');
        const list = document.getElementById('ai-recommendation-list');
        if (!container || !list) return;

        try {
            const result = await CacheManager.fetchWithCache('api/performance/get-recommendations.php', 0.5, false, skipRevalidate);

            if (result && result.success && result.recommendations && result.recommendations.length > 0) {
                list.innerHTML = result.recommendations.map(rec => {
                    const icon = rec.type === 'critical' ? 'priority_high' : (rec.type === 'revision' ? 'history' : 'explore');
                    const bgColor = rec.type === 'critical' ? 'bg-red-600' : (rec.type === 'revision' ? 'bg-amber-600' : 'bg-blue-600');
                    const textAccent = rec.type === 'critical' ? 'text-red-700' : (rec.type === 'revision' ? 'text-amber-700' : 'text-blue-700');
                    const bgAccent = rec.type === 'critical' ? 'bg-red-100' : (rec.type === 'revision' ? 'bg-amber-100' : 'bg-blue-100');

                    return `
                        <div class="bg-white border-2 border-transparent hover:border-indigo-100 p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-all hover:shadow-md group">
                            <div class="flex items-start gap-4 mb-4">
                                <div class="w-12 h-12 rounded-xl ${bgAccent} ${textAccent} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <span class="material-symbols-outlined text-2xl">${icon}</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h4 class="text-[10px] font-black uppercase tracking-widest ${textAccent} mb-1">${rec.title}</h4>
                                    <p class="text-sm font-bold text-gray-900 leading-snug">${rec.message}</p>
                                </div>
                            </div>
                            <button class="start-practice-btn w-full py-3 ${bgColor} text-white text-xs font-black rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/50 hover:opacity-90 active:scale-95 transition-all"
                                data-subject-id="${rec.subject_id}" 
                                data-lesson-id="${rec.lesson_id}" 
                                data-mode="${rec.type === 'critical' ? 'wrong' : 'mixed'}">
                                Start Session <span class="material-symbols-outlined text-sm">rocket_launch</span>
                            </button>
                        </div>
                    `;
                }).join('');

                // Add event listeners to buttons
                list.querySelectorAll('.start-practice-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const target = e.currentTarget;
                        const subjectId = target.dataset.subjectId;
                        const lessonId = target.dataset.lessonId;
                        const mode = target.dataset.mode;

                        target.disabled = true;
                        target.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Creating...';

                        try {
                            const createResponse = await fetch('api/custom-exam/create-from-performance.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    mode: mode,
                                    exam_title: `Recommended Practice: ${mode.toUpperCase()}`,
                                    subject_id: subjectId,
                                    lesson_id: lessonId
                                })
                            });
                            const createResult = await createResponse.json();

                            if (createResult.success) {
                                if (confirm("Recommended exam created successfully! Go to exam taking page?")) {
                                    window.loadPage('take-exam-interface', `?exam_id=${createResult.exam_id}`);
                                }
                            } else {
                                alert(createResult.message || "Failed to create exam.");
                            }
                        } catch (err) {
                            console.error("Practice creation failed", err);
                            alert("A network error occurred.");
                        } finally {
                            target.disabled = false;
                            target.innerHTML = 'Start Practice <span class="material-symbols-outlined text-sm">arrow_forward</span>';
                        }
                    });
                });
            } else {
                list.innerHTML = `<div class="col-span-full bg-white p-8 rounded-2xl border-2 border-dashed border-gray-100 text-center">
                    <span class="material-symbols-outlined text-4xl text-gray-200 mb-2">auto_awesome</span>
                    <p class="text-gray-400 font-bold text-sm">You're doing great! Keep studying to unlock more personalized analysis.</p>
                </div>`;
            }
        } catch (error) {
            console.error("Recommendations Error:", error);
            if (list) {
                list.innerHTML = `<div class="text-xs text-red-500 font-bold p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">error</span>
                    Failed to load recommendations. Please check console.
                </div>`;
            }
        }
    }

    let masteryChart = null;
    async function fetchAndRenderMasteryTrends(skipRevalidate = false) {
        const insightsContainer = document.getElementById('mastery-insights-container');
        if (!insightsContainer) return;

        try {
            const result = await CacheManager.fetchWithCache('api/performance/mastery-trends.php', 0.5, false, skipRevalidate);
            if (!result) return;

            const { subjects, insights } = result;
            const ctx = document.getElementById('mastery-radar-chart');

            // Name mapping for chart labels
            const shortSubjectMap = {
                'বাংলা সাহিত্য': 'সাহিত্য',
                'বাংলা ব্যাকরণ': 'ব্যাকরণ',
                'English Literature': 'Literature',
                'English Grammar': 'Grammar',
                'বাংলাদেশ বিষয়াবলী': 'বাংলাদেশ',
                'আন্তর্জাতিক বিষয়াবলী': 'আন্তর্জাতিক',
                'ভূগোল ( বাংলাদেশ ও বিশ্ব ) , পরিবেশ ও দুর্যোগ ব্যাবস্থাপনা': 'ভূগোল',
                'সাধারণ বিজ্ঞান': 'বিজ্ঞান',
                'কম্পিউটার ও তথ্য প্রযুক্তি': 'কম্পিউটার',
                'গাণিতিক যুক্তি': 'গণিত',
                'মানসিক দক্ষতা': 'দক্ষতা',
                'নৈতিকতা , মূল্যবোধ ও সুশাসন': 'নৈতিকতা'
            };

            const getShortName = (name) => {
                // Try exact match or clean match (ignoring extra spaces)
                const cleanName = name.trim();
                if (shortSubjectMap[cleanName]) return shortSubjectMap[cleanName];

                // Fallback for cases with slightly different formatting
                for (let [long, short] of Object.entries(shortSubjectMap)) {
                    if (cleanName.includes(long)) return short;
                }
                return cleanName;
            };

            // 1. Radar Chart
            if (ctx && typeof Chart !== 'undefined') {
                if (masteryChart) {
                    try { masteryChart.destroy(); } catch (e) { console.warn("Chart destroy failed", e); }
                }

                if (subjects.length === 0) {
                    ctx.parentElement.innerHTML = '<div class="text-center text-gray-400 py-20">Not enough data to calculate trends yet.</div>';
                } else {
                    try {
                        masteryChart = new Chart(ctx, {
                            type: 'radar',
                            data: {
                                labels: subjects.map(s => getShortName(s.name)),
                                datasets: [
                                    {
                                        label: 'This Week',
                                        data: subjects.map(s => s.this_week || 0),
                                        fill: true,
                                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                        borderColor: 'rgb(59, 130, 246)',
                                        pointBackgroundColor: 'rgb(59, 130, 246)',
                                        borderWidth: 2
                                    },
                                    {
                                        label: 'Last Week',
                                        data: subjects.map(s => s.last_week || 0),
                                        fill: true,
                                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                                        borderColor: 'rgb(156, 163, 175)',
                                        borderWidth: 1,
                                        borderDash: [5, 5]
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    r: {
                                        suggestedMin: 0,
                                        suggestedMax: 100,
                                        ticks: { display: false },
                                        pointLabels: {
                                            centerPointLabels: true, // Help keep labels centered
                                            font: {
                                                size: window.innerWidth < 640 ? 9 : 11,
                                                weight: '600'
                                            },
                                            padding: 10
                                        }
                                    }
                                },
                                plugins: {
                                    legend: { display: false }
                                },
                                layout: {
                                    padding: 35 // Uniform symmetrical padding
                                }
                            }
                        });
                    } catch (err) {
                        console.error("Chart creation failed:", err);
                    }
                }
            }

            // 2. Insights
            if (insights.length > 0) {
                insightsContainer.innerHTML = insights.map(i => `
                    <div class="${i.type === 'warning' ? 'bg-amber-50' : 'bg-emerald-50'} border p-4 rounded-xl flex items-start gap-3">
                        <span class="material-symbols-outlined ${i.type === 'warning' ? 'text-amber-500' : 'text-emerald-500'}">${i.type === 'warning' ? 'trending_down' : 'trending_up'}</span>
                        <p class="text-sm leading-relaxed">${i.message}</p>
                    </div>
                `).join('');
            } else {
                insightsContainer.innerHTML = '<div class="text-center py-10 text-gray-400">Performance is stable.</div>';
            }
        } catch (error) {
            console.error("Mastery Trends Error:", error);
        }
    }

    async function fetchAndRenderDisciplineTracker(skipRevalidate = false) {
        const trackerList = document.getElementById('discipline-tracker-list');
        if (!trackerList) return;

        try {
            const result = await CacheManager.fetchWithCache('api/mistakes/discipline-stats.php', 0.5, false, skipRevalidate);

            if (result) {
                trackerList.innerHTML = result.map(subject => {
                    const isNeglected = subject.status === 'Neglected';
                    const isConsistent = subject.status === 'Consistent';
                    const icon = isConsistent ? 'verified' : (isNeglected ? 'error' : 'schedule');
                    const color = subject.status_color;

                    return `
                        <div class="bg-white border-2 border-gray-50 p-4 rounded-xl flex items-center justify-between hover:border-${color}-100 transition-all group">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-full bg-${color}-50 flex items-center justify-center text-${color}-600">
                                    <span class="material-symbols-outlined">${icon}</span>
                                </div>
                                <div>
                                    <h3 class="font-bold text-gray-900">${subject.subject_name}</h3>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-${color}-100 text-${color}-700 uppercase">${subject.status}</span>
                                        <span class="text-gray-400 text-xs">${subject.days_since_last_study === 999 ? 'Never studied' : (subject.days_since_last_study === 0 ? 'Studied today' : subject.days_since_last_study + ' days gap')}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="flex items-center gap-1 justify-end">
                                    <span class="material-symbols-outlined text-sm text-orange-500 fill-current">local_fire_department</span>
                                    <span class="font-black text-gray-900">${subject.study_streak}</span>
                                </div>
                                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Day Streak</p>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error("Error fetching discipline stats:", error);
            trackerList.innerHTML = '<p class="col-span-full text-center text-gray-400">Failed to load tracker.</p>';
        }
    }

    async function fetchAndRenderHeatmap(skipRevalidate = false) {
        const heatmapGrid = document.getElementById('subject-heatmap-grid');
        if (!heatmapGrid) return;

        try {
            const result = await CacheManager.fetchWithCache('api/mistakes/subject-stats.php', 0.5, false, skipRevalidate);

            if (result) {
                heatmapGrid.innerHTML = result.map(subject => {
                    let bgColor = 'bg-white';
                    let borderColor = 'border-gray-100';
                    let textColor = 'text-gray-900';
                    let labelColor = 'text-gray-500';
                    let glowClass = '';

                    if (subject.mistake_count === 0) {
                        bgColor = 'bg-emerald-50';
                        borderColor = 'border-emerald-200';
                        textColor = 'text-emerald-900';
                        labelColor = 'text-emerald-600';
                    } else if (subject.mistake_count <= 5) {
                        bgColor = 'bg-amber-50';
                        borderColor = 'border-amber-200';
                        textColor = 'text-amber-900';
                        labelColor = 'text-amber-600';
                    } else {
                        bgColor = 'bg-rose-50';
                        borderColor = 'border-rose-200';
                        textColor = 'text-rose-900';
                        labelColor = 'text-rose-600';
                        glowClass = 'shadow-[0_0_15px_rgba(244,63,94,0.1)]';
                    }

                    return `
                        <div class="${bgColor} ${borderColor} ${glowClass} border p-4 rounded-xl transition-all hover:scale-[1.02] hover:shadow-md group cursor-default">
                            <div class="flex justify-between items-start mb-2">
                                <span class="material-symbols-outlined text-xl ${labelColor}">
                                    ${subject.mistake_count === 0 ? 'verified' : (subject.mistake_count <= 5 ? 'warning' : 'dangerous')}
                                </span>
                                <span class="text-2xl font-black ${textColor}">${subject.mistake_count}</span>
                            </div>
                            <h3 class="font-bold text-sm ${textColor} truncate">${subject.subject_name}</h3>
                            <p class="${labelColor} text-[10px] font-bold uppercase tracking-widest mt-0.5">Mistakes</p>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error("Error fetching heatmap stats:", error);
            heatmapGrid.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10">Failed to load heatmap.</p>';
        }
    }


    async function fetchAndRenderBadges(skipRevalidate = false) {
        const badgeGrid = document.getElementById('badge-grid');
        const badgeCountPill = document.getElementById('badge-count-pill');
        const summaryBadgeText = document.getElementById('earned-badge-text');
        const summaryBadgeEl = document.getElementById('dashboard-badge-summary');

        if (!badgeGrid) return;

        try {
            const result = await CacheManager.fetchWithCache('api/performance/badges.php', 0.5, false, skipRevalidate);

            if (result && result.badges) {
                badgeGrid.innerHTML = result.badges.map(badge => {
                    const earnedClass = badge.earned ? `bg-${badge.color}-50 border-${badge.color}-200 text-${badge.color}-700` : 'bg-gray-50 border-gray-100 text-gray-400 grayscale opacity-60';
                    const iconEarnedClass = badge.earned ? `text-${badge.color}-600` : 'text-gray-300';
                    const progressPercent = Math.min(100, Math.round((badge.current / badge.target) * 100));

                    return `
                        <div class="flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all hover:scale-105 group ${earnedClass}" title="${badge.description}">
                            <div class="w-12 h-12 flex items-center justify-center mb-2">
                                <span class="material-symbols-outlined text-3xl ${iconEarnedClass}">${badge.icon}</span>
                            </div>
                            <h4 class="text-xs font-bold uppercase tracking-tighter">${badge.title}</h4>
                            <div class="mt-2 w-full flex flex-col items-center">
                                ${badge.earned ?
                            '<span class="text-[10px] font-black opacity-60">UNLOCKED</span>' :
                            `
                                    <div class="w-16 h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                                        <div class="h-full bg-gray-400" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <span class="text-[10px] font-bold opacity-60">${badge.current}/${badge.target}</span>
                                    `
                        }
                            </div>
                        </div>
                    `;
                }).join('');

                if (badgeCountPill) badgeCountPill.textContent = `${result.earned_count} Badges`;
                if (summaryBadgeText) summaryBadgeText.textContent = `${result.earned_count} Badges Earned`;
                if (summaryBadgeEl) summaryBadgeEl.classList.remove('opacity-0');
            }
        } catch (error) {
            console.error("Error fetching badges:", error);
            badgeGrid.innerHTML = '<p class="col-span-full text-center text-gray-400">Failed to load badges.</p>';
        }
    }

    async function fetchMistakeStats(skipRevalidate = false) {
        try {
            const result = await CacheManager.fetchWithCache('api/mistakes/stats.php', 0.5, false, skipRevalidate);
            const count = result.count;
            const countEl = document.getElementById('mistake-count');
            if (countEl) animateCount(countEl, count);

            const masteryBtn = document.getElementById('mastery-quiz-btn');
            if (masteryBtn) {
                masteryBtn.disabled = (count === 0);
                if (count === 0) {
                    masteryBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    masteryBtn.title = "No mistakes found yet! Complete some exams first.";
                } else {
                    masteryBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    masteryBtn.title = "";
                }
            }
        } catch (error) { console.error("Error fetching mistake stats:", error); }
    }

    async function fetchStudyTimeStats(skipRevalidate = false) {
        try {
            const result = await CacheManager.fetchWithCache('api/analytics/daily-study-time.php', 0.5, false, skipRevalidate);

            if (result) {
                const totalEl = document.getElementById('study-today-total');
                const improvementBadge = document.getElementById('study-improvement-badge');
                const subjectsContainer = document.getElementById('study-subjects-container');

                // Update total time
                if (totalEl) {
                    totalEl.textContent = result.total_today_formatted || '0h 0m';
                }

                // Update improvement badge
                if (improvementBadge && result.improvement_type !== 'neutral') {
                    improvementBadge.classList.remove('hidden');
                    const percent = Math.abs(result.improvement_percent);
                    const arrow = result.improvement_type === 'positive' ? '↑' : '↓';
                    const bgColor = result.improvement_type === 'positive' ? 'bg-green-400' : 'bg-orange-400';

                    improvementBadge.className = `text-xs font-bold px-2 py-0.5 rounded-full ${bgColor} text-white`;
                    improvementBadge.textContent = `${arrow} ${percent}%`;
                    improvementBadge.title = `vs yesterday (${result.yesterday_formatted})`;
                } else if (improvementBadge) {
                    improvementBadge.classList.add('hidden');
                }

                // Render per-subject bars
                if (subjectsContainer && result.subjects && result.subjects.length > 0) {
                    const maxSeconds = Math.max(...result.subjects.map(s => s.seconds));

                    subjectsContainer.innerHTML = result.subjects.map(subject => {
                        const widthPercent = maxSeconds > 0 ? (subject.seconds / maxSeconds) * 100 : 0;

                        return `
                            <div class="bg-white/10 rounded-lg p-2.5 hover:bg-white/15 transition-colors">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-bold text-white truncate flex-1">${subject.subject_name}</span>
                                    <span class="text-xs font-black text-violet-100 ml-2">${subject.formatted}</span>
                                </div>
                                <div class="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-white h-full rounded-full transition-all duration-500" style="width: ${widthPercent}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else if (subjectsContainer) {
                    subjectsContainer.innerHTML = `
                        <div class="text-center py-4 text-violet-100 text-sm opacity-70">
                            <span class="material-symbols-outlined text-2xl mb-1 opacity-50">hourglass_empty</span>
                            <p>No study sessions today yet</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error("Error fetching daily study time stats:", error);
        }
    }

    // --- Section 2: Exam Selection Logic ---
    async function populateDropdown(url, selector, placeholder, isDependent = false, valueToSelect = null) {
        if (!selector) {
            console.error(`[Dashboard] Selector for ${placeholder} not found!`);
            return;
        }
        console.log(`[Dashboard] Populating ${placeholder} from ${url}`);
        selector.innerHTML = `<option value="0">${placeholder}</option>`;
        if (isDependent) selector.disabled = true;
        try {
            const result = await CacheManager.fetchWithCache(url, 0.5, false, false);
            if (result && result.length > 0) {
                result.forEach(item => {
                    selector.innerHTML += `<option value="${item.id}">${item.subject_name || item.lesson_name || item.topic_name}</option>`;
                });

                // If a value was requested, select it
                if (valueToSelect && valueToSelect !== '0') {
                    selector.value = valueToSelect;
                }

                if (isDependent) selector.disabled = false;

                // Cascade: If we just populated a dropdown and it has a selected value, populate the NEXT one
                if (selector === subjectFilter && selector.value !== '0') {
                    const savedLesson = localStorage.getItem('filter_dashboard_lesson');
                    await populateDropdown(`${LESSON_API_URL}?subject_id=${selector.value}`, lessonFilter, 'All Lessons', true, savedLesson);
                } else if (selector === lessonFilter && selector.value !== '0') {
                    const savedTopic = localStorage.getItem('filter_dashboard_topic');
                    await populateDropdown(`${TOPIC_API_URL}?lesson_id=${selector.value}`, topicFilter, 'All Topics', true, savedTopic);
                }
            } else {
                if (isDependent) selector.disabled = true;
            }
        } catch (error) {
            console.error(`Dropdown Error for ${placeholder}:`, error);
            if (isDependent) selector.disabled = true;
        }
    }

    function renderChart(canvasId, history) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || !history || history.length === 0) return;
        if (typeof Chart === 'undefined') {
            console.warn("[Dashboard] Chart.js not loaded yet for", canvasId);
            return;
        }
        try {
            if (Chart.getChart(canvasId)) Chart.getChart(canvasId).destroy();
            new Chart(ctx, {
                type: 'line',
                data: { labels: history.map(h => `Attempt ${h.attempt}`), datasets: [{ label: 'Score', data: history.map(h => h.score), borderColor: 'rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Score: ${context.raw}` } } } }
            });
        } catch (err) {
            console.error("Error rendering chart:", err);
        }
    }

    let currentOffset = 0;
    const PAGE_SIZE = 6;

    async function fetchAndDisplayExams(isLoadMore = false, skipRevalidate = false) {
        if (!examCardsContainer) {
            console.error("[Dashboard] examCardsContainer not found!");
            return;
        }
        // Ensure isLoadMore is strictly boolean
        const loadingMore = isLoadMore === true;
        const container = document.getElementById('load-more-container');
        const btn = document.getElementById('load-more-btn');

        if (!loadingMore) {
            currentOffset = 0;
            examCardsContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">Loading exams...</p>';
            if (container) container.classList.add('hidden');
        }

        let url = `${EXAMS_API_URL}?limit=${PAGE_SIZE}&offset=${currentOffset}`;
        const params = new URLSearchParams();
        if (subjectFilter && subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter && lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter && topicFilter.value > 0) params.append('topic_id', topicFilter.value);

        const filterStr = params.toString();
        if (filterStr) url += '&' + filterStr;

        // 1. Try to load from Cache (IndexedDB) first (only for initial load)
        if (!isLoadMore && currentOffset === 0) {
            try {
                if (typeof idbManager !== 'undefined') {
                    const cachedExams = await idbManager.getAll('exams');
                    if (cachedExams && cachedExams.length > 0) {
                        let filteredExams = cachedExams;
                        if (subjectFilter && subjectFilter.value > 0) filteredExams = filteredExams.filter(e => e.subject_id == subjectFilter.value);
                        if (lessonFilter && lessonFilter.value > 0) filteredExams = filteredExams.filter(e => e.lesson_id == lessonFilter.value);
                        if (topicFilter && topicFilter.value > 0) filteredExams = filteredExams.filter(e => e.topic_id == topicFilter.value);

                        if (filteredExams.length > 0) {
                            // Slice to PAGE_SIZE for initial cache display to keep it snappy
                            displayExams(filteredExams.slice(0, PAGE_SIZE), false);
                        }
                    }
                }
            } catch (cacheError) {
                console.warn("Cache load failed:", cacheError);
            }
        }

        console.log(`Fetching exams: offset=${currentOffset}, limit=${PAGE_SIZE}, isLoadMore=${loadingMore}`);

        // 2. Fetch from API (Revalidate)
        try {
            if (loadingMore && btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Loading...';
            }

            // --- Cache integration for Exam List ---
            const result = await CacheManager.fetchWithCache(url, 0.5, false, skipRevalidate, true);

            if (result && result.success) {
                const exams = result.data || [];

                if (exams.length > 0) {
                    displayExams(exams, loadingMore);
                } else if (!loadingMore) {
                    examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found for the selected filters.</p>`;
                }

                // Update Cache (only for the initial/main list to keep it fast)
                if (typeof idbManager !== 'undefined' && currentOffset === 0 && exams.length > 0) {
                    const changes = { exams: exams };
                    await idbManager.performSyncTransaction(changes);
                }

                // Handle Pagination UI
                if (result.pagination) {
                    console.log('Pagination info:', result.pagination);
                    if (result.pagination.hasMore) {
                        if (container) container.classList.remove('hidden');
                        currentOffset += PAGE_SIZE;
                    } else {
                        if (container) container.classList.add('hidden');
                    }
                }
            } else if (result && !loadingMore) {
                examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found for the selected filters.</p>`;
                if (container) container.classList.add('hidden');
            }
        } catch (error) {
            console.error('Fetch Exams Error:', error);
            if (!loadingMore && (examCardsContainer.innerHTML === '' || examCardsContainer.innerHTML.includes('Loading exams...'))) {
                examCardsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load exams.</p>`;
            }
        } finally {
            if (loadingMore && btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined">expand_more</span> Load More Exams';
            }
        }
    }

    function displayExams(exams, append = false) {
        if (!exams || !Array.isArray(exams)) return;
        if (!append) examCardsContainer.innerHTML = '';

        if (exams.length === 0 && !append) {
            examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found.</p>`;
            return;
        }

        exams.forEach(exam => {
            const breadcrumb = exam.subject_name ? `${exam.subject_name} > ${exam.lesson_name} > ${exam.topic_name}` : 'Custom Model Test';
            const history = exam.performance_history || [];
            const lastScore = history.length > 0 ? history[history.length - 1].score.toFixed(2) : 'N/A';
            const cardId = `exam-card-dashboard-${exam.id}`;

            // Avoid duplicate cards if cache and API both return same items
            if (document.getElementById(cardId)) return;

            const card = `
                <div id="${cardId}" class="bg-white p-5 rounded-lg shadow-md flex flex-col hover:shadow-lg transition-shadow">
                <h3 
                    class="text-lg font-bold text-gray-800 truncate cursor-pointer flex items-center gap-2 copy-exam-id"
                    data-exam-id="${exam.id}"
                    title="Click to copy Exam ID"
                >
                    Exam ID : ${exam.id}
                    <span class="material-symbols-outlined text-base text-gray-400 hover:text-blue-600">
                    content_copy
                    </span>
                </h3>
                <button 
                    class="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer copy-json-btn mb-3 transition-colors" 
                    data-id="${exam.id}"
                >
                    <span class="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copy JSON</span>
                </button>

                    <h3 class="text-lg font-bold text-gray-800 truncate">${exam.exam_title}</h3>
                    <p class="text-xs text-gray-500 mb-4 truncate">${breadcrumb}</p>
                    <div class="flex-grow space-y-2 text-sm text-gray-600 mb-4">
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">timer</span>${exam.duration} Minutes</p>
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">help</span>${exam.total_questions || 0} Questions</p>
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">military_tech</span>${parseFloat(exam.total_marks || 0).toFixed(0)} Marks</p>
                    </div>
                    <div class="mt-auto border-t pt-4">
                        <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-gray-500">Last Score:</span><span class="text-lg font-bold ${lastScore === 'N/A' ? 'text-gray-400' : 'text-blue-600'}">${lastScore}</span></div>
                        <div class="h-24"><canvas id="chart-exam-${exam.id}"></canvas></div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button class="take-exam-btn flex-1 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors" data-id="${exam.id}">Take Exam</button>
                        <button class="omr-entry-btn bg-amber-100 text-amber-700 hover:bg-amber-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" data-title="${exam.exam_title}" data-total="${exam.total_questions || 0}" title="OMR Entry / Mark Practiced">
                            <span class="material-symbols-outlined">edit_note</span>
                        </button>
                        <button class="print-options-btn bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" data-total-questions="${exam.total_questions || 0}" title="Print Options">
                            <span class="material-symbols-outlined">print</span>
                        </button>
                        <button class="delete-exam-btn bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" title="Delete Exam"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>`;
            examCardsContainer.insertAdjacentHTML('beforeend', card);
        });

        exams.forEach(exam => {
            const history = exam.performance_history || [];
            if (history.length > 0) renderChart(`chart-exam-${exam.id}`, history);
        });
    }
    document.addEventListener("click", function (e) {
        const el = e.target.closest(".copy-exam-id");
        if (el) {
            const examId = el.dataset.examId;
            navigator.clipboard.writeText(examId).then(() => {
                const icon = el.querySelector(".material-symbols-outlined");
                const original = icon.textContent;
                icon.textContent = "check";
                icon.classList.add("text-green-600");
                setTimeout(() => {
                    icon.textContent = original;
                    icon.classList.remove("text-green-600");
                }, 1200);
            });
        }

        const jsonEl = e.target.closest(".copy-json-btn");
        if (jsonEl && !jsonEl.disabled) {
            const examId = jsonEl.dataset.id;
            const icon = jsonEl.querySelector(".material-symbols-outlined");
            const btnText = jsonEl.querySelector("span:not(.material-symbols-outlined)");
            const originalIcon = icon.textContent;

            jsonEl.disabled = true;
            icon.textContent = "hourglass_empty";

            // Use CacheManager to prevent rapid double-hits
            CacheManager.fetchWithCache(`api/take-exam/start.php?exam_id=${examId}`, 1)
                .then(data => {
                    // CacheManager returns parsed data
                    const text = typeof data === 'string' ? data : JSON.stringify(data);
                    return navigator.clipboard.writeText(text);
                })
                .then(() => {
                    icon.textContent = "check";
                    jsonEl.classList.add("text-green-600");
                    setTimeout(() => {
                        icon.textContent = originalIcon;
                        jsonEl.classList.remove("text-green-600");
                        jsonEl.disabled = false;
                    }, 1200);
                })
                .catch(err => {
                    console.error("Copy JSON failed:", err);
                    icon.textContent = originalIcon;
                    jsonEl.disabled = false;
                });
        }

    });

    const dashContainer = document.getElementById('dashboard-container');
    if (dashContainer) {
        dashContainer.addEventListener('click', (e) => {
            const loadMoreEl = e.target.closest("#load-more-btn");
            if (loadMoreEl && !loadMoreEl.disabled) {
                console.log("Dashboard Load More clicked, current offset:", currentOffset);
                fetchAndDisplayExams(true);
            }
        });
    }

    const openDeleteModal = (id) => {
        examIdToDelete = id;
        deleteModal.classList.remove('hidden');
        deleteModal.classList.add('flex');
    };
    const closeDeleteModal = () => {
        examIdToDelete = null;
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
    };
    const handleDeleteConfirm = async () => {
        if (!examIdToDelete) return;
        try {
            const response = await fetch(`${DELETE_EXAM_API_URL}?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examIdToDelete })
            });
            const result = await response.json();
            showToast(result.message, result.success ? 'success' : 'error');
            if (result.success) {
                fetchAndDisplayExams();
            }
        } catch (error) { showToast('A network error occurred.', 'error'); }
        finally {
            closeDeleteModal();
            CacheManager.clearGroup('dashboard'); // Cache invalidation
        }
    };

    // --- Print Logic Implementation ---
    const openPrintModal = (id, totalQuestions = 0) => {
        PrintEngine.onGenerate = processAndPrint;
        PrintEngine.openModal(id, totalQuestions);
    };

    async function processAndPrint() {
        const examId = PrintEngine.selectedExamId;
        if (!examId) return;

        // Read limit from the modal input
        const limitInput = document.getElementById('print-limit-num');
        const numQuestions = limitInput ? parseInt(limitInput.value) : 0;

        generatePdfBtn.disabled = true;
        generatePdfBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Fetching Data...';

        try {
            // Build the URL with limit and sorting (least attempted first)
            let url = `api/take-exam/start.php?exam_id=${examId}`;
            if (numQuestions > 0) {
                url += `&num_questions=${numQuestions}&sort=least_attempted`;
            }

            const result = await CacheManager.fetchWithCache(url, 1);

            if (!result) throw new Error('Failed to fetch exam data');

            PrintEngine.generatePDF(result);
            showToast('PDF generation triggered successfully!');
            PrintEngine.closeModal();

        } catch (error) {
            console.error(error);
            showToast('Failed to generate PDF: ' + error.message, 'error');
        } finally {
            generatePdfBtn.disabled = false;
            generatePdfBtn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> Generate PDF Questions';
        }
    }

    // --- OMR Entry (Delegated to OmrEngine) ---
    if (window.OmrEngine) OmrEngine.init(showToast);
    function openOmrModal(examId, examTitle) {
        if (window.OmrEngine) OmrEngine.open(examId, examTitle);
        else showToast('OMR Engine not loaded.', 'error');
    }
    // --- Event Listeners & Initial Load ---
    function setupEventListeners() {
        if (subjectFilter) {
            subjectFilter.addEventListener('change', async () => {
                console.log("Subject filter changed:", subjectFilter.value);
                localStorage.setItem('filter_dashboard_subject', subjectFilter.value);
                localStorage.removeItem('filter_dashboard_lesson');
                localStorage.removeItem('filter_dashboard_topic');

                if (lessonFilter) {
                    lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
                    lessonFilter.disabled = true;
                }
                if (topicFilter) {
                    topicFilter.innerHTML = '<option value="0">All Topics</option>';
                    topicFilter.disabled = true;
                }

                if (subjectFilter.value !== '0' && lessonFilter) {
                    await populateDropdown(`${LESSON_API_URL}?subject_id=${subjectFilter.value}`, lessonFilter, 'All Lessons', true);
                }
                fetchAndDisplayExams(false);
            });
        }

        if (lessonFilter) {
            lessonFilter.addEventListener('change', async () => {
                console.log("Lesson filter changed:", lessonFilter.value);
                localStorage.setItem('filter_dashboard_lesson', lessonFilter.value);
                localStorage.removeItem('filter_dashboard_topic');

                if (topicFilter) {
                    topicFilter.innerHTML = '<option value="0">All Topics</option>';
                    topicFilter.disabled = true;
                }

                if (lessonFilter.value !== '0' && topicFilter) {
                    await populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonFilter.value}`, topicFilter, 'All Topics', true);
                }
                fetchAndDisplayExams(false);
            });
        }

        if (topicFilter) {
            topicFilter.addEventListener('change', () => {
                console.log("Topic filter changed:", topicFilter.value);
                localStorage.setItem('filter_dashboard_topic', topicFilter.value);
                fetchAndDisplayExams(false);
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                console.log("Clearing filters...");
                localStorage.removeItem('filter_dashboard_subject');
                localStorage.removeItem('filter_dashboard_lesson');
                localStorage.removeItem('filter_dashboard_topic');

                if (subjectFilter) subjectFilter.value = '0';
                if (lessonFilter) {
                    lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
                    lessonFilter.disabled = true;
                }
                if (topicFilter) {
                    topicFilter.innerHTML = '<option value="0">All Topics</option>';
                    topicFilter.disabled = true;
                }

                fetchAndDisplayExams(false);
            });
        }

        if (examCardsContainer) {
            examCardsContainer.addEventListener('click', (e) => {
                const takeExamBtn = e.target.closest('.take-exam-btn');
                const deleteExamBtn = e.target.closest('.delete-exam-btn');
                const printOptionsBtn = e.target.closest('.print-options-btn');
                const omrEntryBtn = e.target.closest('.omr-entry-btn');

                if (takeExamBtn) {
                    const examId = takeExamBtn.dataset.id;
                    if (window.loadPage) window.loadPage('take-exam-interface', `?exam_id=${examId}`);
                }
                if (deleteExamBtn) {
                    const examId = deleteExamBtn.dataset.id;
                    openDeleteModal(examId);
                }
                if (printOptionsBtn) {
                    const examId = printOptionsBtn.dataset.id;
                    const totalQuestions = printOptionsBtn.dataset.totalQuestions || 0;
                    openPrintModal(examId, totalQuestions);
                }
                if (omrEntryBtn) {
                    const examId = omrEntryBtn.dataset.id;
                    const examTitle = omrEntryBtn.dataset.title;
                    openOmrModal(examId, examTitle);
                }
            });
        }

        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

        // Print Options Listeners — use PrintEngine.closeModal() since PrintEngine owns the modal
        // Note: PrintEngine.init() already binds close-print-modal and outside-click handlers,
        // so we only need to ensure the delete modal outside-click is handled here.
        window.addEventListener('click', (e) => {
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    // --- Action Hub Logic ---
    async function checkRecentAttempt() {
        if (typeof idbManager === 'undefined') return;

        try {
            const attempt = await idbManager.getLatestInProgressAttempt();
            const resumeCard = document.getElementById('resume-card');
            const resumeTitle = document.getElementById('resume-exam-title');
            const resumeProgress = document.getElementById('resume-progress');
            const resumeBtn = document.getElementById('resume-btn');

            if (attempt) {
                // Get exam title
                const exam = await idbManager.getById('exams', attempt.exam_id);
                resumeTitle.textContent = exam ? exam.exam_title : 'Unknown Exam';

                const answeredCount = Object.keys(attempt.answers || {}).length;
                resumeProgress.textContent = `${answeredCount} questions answered`;

                resumeBtn.onclick = () => {
                    console.log("Resuming exam:", attempt.exam_id);
                    if (window.loadPage) window.loadPage('take-offline-exam', `?exam_id=${attempt.exam_id}&attempt_uuid=${attempt.id}`);
                };

                resumeCard.classList.remove('hidden');
            } else {
                resumeCard.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error checking recent attempt:", error);
        }
    }

    function setupActionHub() {
        const daily10Btn = document.getElementById('daily-10-btn');
        if (daily10Btn) {
            daily10Btn.addEventListener('click', () => {
                console.log("Dashboard: Starting Daily 15 Quiz...");

                // Visual feedback
                const originalContent = daily10Btn.innerHTML;
                daily10Btn.disabled = true;
                daily10Btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">sync</span> Preparing...`;

                if (window.loadPage) {
                    window.loadPage('take-offline-exam', `?mode=daily_15`);
                } else {
                    console.error("loadPage not found");
                    daily10Btn.disabled = false;
                    daily10Btn.innerHTML = originalContent;
                }
            });
        }

        checkRecentAttempt();
    }

    // --- Section: Countdown Timers ---
    let targetJobDeadline = '2026-04-30';
    let targetJobName = 'Target Job Countdown';
    let targetJobDate = new Date(`${targetJobDeadline}T23:59:59`).getTime();

    async function fetchJobCountdown() {
        try {
            const response = await fetch('api/dashboard/job_countdown.php');
            const result = await response.json();
            if (result.success && result.data) {
                targetJobDeadline = result.data.deadline.split(' ')[0]; // Get only date part
                targetJobName = result.data.job_name;
                targetJobDate = new Date(`${targetJobDeadline}T23:59:59`).getTime();

                updateJobUI();
            }
        } catch (error) {
            console.error("Error fetching job countdown:", error);
        }
    }

    function updateJobUI() {
        const titleEl = document.getElementById('job-countdown-title');
        const deadlineDateSpan = document.getElementById('job-deadline-date');

        if (titleEl) titleEl.textContent = targetJobName;
        if (deadlineDateSpan) {
            const dateObj = new Date(targetJobDeadline);
            deadlineDateSpan.textContent = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }

    function setupJobCountdownModal() {
        const card = document.getElementById('job-countdown-card');
        const modal = document.getElementById('job-countdown-modal');
        const form = document.getElementById('job-countdown-form');
        const closeBtn = document.getElementById('close-job-modal');
        const nameInput = document.getElementById('modal-job-name');
        const dateInput = document.getElementById('modal-job-deadline');

        console.log("[Dashboard] Setting up countdown modal...", { card, modal, form });

        if (!card || !modal || !form) {
            console.error("[Dashboard] Missing modal elements:", { card, modal, form });
            return;
        }

        card.addEventListener('click', (e) => {
            console.log("[Dashboard] Countdown card clicked");
            nameInput.value = targetJobName;
            dateInput.value = targetJobDeadline;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });

        const closeModal = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnContent = submitBtn.innerHTML;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Saving...';

            try {
                const response = await fetch('api/dashboard/job_countdown.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_name: nameInput.value,
                        deadline: dateInput.value
                    })
                });
                const result = await response.json();

                if (result.success) {
                    targetJobName = nameInput.value;
                    targetJobDeadline = dateInput.value;
                    targetJobDate = new Date(`${targetJobDeadline}T23:59:59`).getTime();
                    updateJobUI();
                    closeModal();
                    if (typeof showToast === 'function') showToast('Mission Objective Updated!', 'success');
                } else {
                    alert('Failed to save: ' + result.message);
                }
            } catch (error) {
                console.error("Error saving job countdown:", error);
                alert('A network error occurred.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }
        });
    }

    function startCountdownTimers() {
        const dailyTimerEl = document.getElementById('daily-timer');
        const dailyProgressEl = document.getElementById('daily-progress');
        const jobTimerEl = document.getElementById('job-timer');
        const yearTimerEl = document.getElementById('year-timer');
        const yearProgressTextEl = document.getElementById('year-progress-text');

        if (!dailyTimerEl || !jobTimerEl || !yearTimerEl) {
            console.warn("Countdown timer elements not found. Retrying in 100ms...");
            setTimeout(startCountdownTimers, 100);
            return;
        }

        // Fetch initial data
        fetchJobCountdown();
        setupJobCountdownModal();

        const updateTimers = () => {
            const now = new Date();
            const nowTime = now.getTime();

            // 1. Daily Study Countdown (Logical Day: 5 AM to 5 AM)
            const TIMELINE_START_HOUR = 5;
            const startOfLogicalDay = new Date(now);
            if (now.getHours() < TIMELINE_START_HOUR) {
                startOfLogicalDay.setDate(now.getDate() - 1);
            }
            startOfLogicalDay.setHours(TIMELINE_START_HOUR, 0, 0, 0);

            const endOfLogicalDay = new Date(startOfLogicalDay);
            endOfLogicalDay.setDate(endOfLogicalDay.getDate() + 1);

            const dailyDiff = endOfLogicalDay.getTime() - nowTime;

            if (dailyDiff > 0) {
                const hours = Math.floor((dailyDiff / (1000 * 60 * 60)));
                const minutes = Math.floor((dailyDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((dailyDiff % (1000 * 60)) / 1000);
                dailyTimerEl.textContent = `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`;

                // Daily progress (position within the 24h 5 AM - 5 AM window)
                const totalWindow = endOfLogicalDay.getTime() - startOfLogicalDay.getTime();
                const dailyProgress = Math.min(100, ((nowTime - startOfLogicalDay.getTime()) / totalWindow) * 100);
                if (dailyProgressEl) dailyProgressEl.style.width = `${dailyProgress}%`;
            }

            // 2. Target Job Countdown
            const jobDiff = targetJobDate - nowTime;
            if (jobDiff > 0) {
                const days = Math.floor(jobDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((jobDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((jobDiff % (1000 * 60 * 60)) / (1000 * 60));
                jobTimerEl.textContent = `${days} Days : ${hours.toString().padStart(2, '0')} Hours : ${mins.toString().padStart(2, '0')} Mins`;
            } else {
                jobTimerEl.textContent = "Target date reached";
            }

            // 3. Year Remaining Countdown
            const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59).getTime();
            const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0).getTime();
            const yearDiff = endOfYear - nowTime;

            if (yearDiff > 0) {
                const days = Math.floor(yearDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((yearDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((yearDiff % (1000 * 60 * 60)) / (1000 * 60));
                yearTimerEl.textContent = `${days} Days : ${hours.toString().padStart(2, '0')} Hours : ${mins.toString().padStart(2, '0')} Mins`;

                const yearProgress = Math.min(100, ((nowTime - startOfYear) / (endOfYear - startOfYear)) * 100);
                if (yearProgressTextEl) yearProgressTextEl.textContent = `${now.getFullYear()} is ${yearProgress.toFixed(1)}% complete`;
            }
        };

        updateTimers();
        const timerInterval = setInterval(updateTimers, 1000);

        // Cleanup interval on page unload/navigation
        const cleanup = () => clearInterval(timerInterval);
        window.addEventListener('popstate', cleanup);
        // Custom event for internal navigation if exists
        document.addEventListener('pageBeforeChange', cleanup);
    }

    // --- SWR Support: Listen for revalidation events ---
    function setupSWRListeners() {
        if (window.dashboardSWRHandlersSet) return;

        const revalidateHandler = (e) => {
            const { url } = e.detail;
            console.log(`%c[Dashboard] Refreshing UI for revalidated URL: ${url}`, 'color: #8b5cf6;');

            if (url.includes(METRICS_API_URL)) fetchAndDisplayMetrics(true);
            if (url.includes('api/mistakes/stats.php')) fetchMistakeStats(true);
            if (url.includes('api/analytics/daily-study-time.php')) fetchStudyTimeStats(true);
            if (url.includes('api/dashboard-exams.php')) fetchAndDisplayExams(false, true);
            if (url.includes('mastery-trends.php')) fetchAndRenderMasteryTrends(true);
            if (url.includes('discipline-stats.php')) fetchAndRenderDisciplineTracker(true);
            if (url.includes('subject-stats.php')) fetchAndRenderHeatmap(true);
            if (url.includes('badges.php')) fetchAndRenderBadges(true);
        };

        const visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                console.log('%c[Dashboard] Tab focused - revalidating key metrics', 'color: #0d9488;');
                fetchAndDisplayMetrics(); // This will trigger SWR checks for all metrics
            }
        };

        document.addEventListener('cache-revalidated', revalidateHandler);
        document.addEventListener('visibilitychange', visibilityHandler);
        window.dashboardSWRHandlersSet = true;

        // Cleanup on navigation
        const cleanupHandlers = () => {
            document.removeEventListener('cache-revalidated', revalidateHandler);
            document.removeEventListener('visibilitychange', visibilityHandler);
            window.dashboardSWRHandlersSet = false;
            document.removeEventListener('pageBeforeChange', cleanupHandlers);
        };
        document.addEventListener('pageBeforeChange', cleanupHandlers);
    }

    async function initializePage() {
        console.log("[Dashboard] Initializing page...");
        startCountdownTimers();
        setupSWRListeners();
        fetchAndDisplayMetrics();

        setupEventListeners();
        setupActionHub();

        // Restore filters from localStorage
        const savedSubject = localStorage.getItem('filter_dashboard_subject');

        try {
            if (savedSubject && savedSubject !== '0' && subjectFilter) {
                console.log("[Dashboard] Restoring saved subject:", savedSubject);
                await populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects', false, savedSubject);
            } else if (subjectFilter) {
                console.log("[Dashboard] No saved subject, populating default");
                await populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects');
            }
        } catch (error) {
            console.error("[Dashboard] Initial population failed:", error);
        } finally {
            console.log("[Dashboard] Initial fetch and display exams");
            fetchAndDisplayExams();
        }
    }
    initializePage();
}

initializeDashboardPage();

