function initializeRevisionPlanner() {
    const RECOMMENDATIONS_API = 'api/performance/revision-recommendations.php';
    const MARK_REVISED_API = 'api/performance/mark-revised.php';
    const CREATE_REVISION_EXAM_API = 'api/custom-exam/create-revision-exam.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';
    const EXAM_API_URL = 'api/exam/exam.php';

    // DOM Elements
    const subjectFilter = document.getElementById('filter-subject');
    const lessonFilter = document.getElementById('filter-lesson');
    const topicFilter = document.getElementById('filter-topic');
    const examFilter = document.getElementById('filter-exam');
    const btnWeakOnly = document.getElementById('filter-weak-only');
    const btnShowAll = document.getElementById('filter-all');
    const btnRefresh = document.getElementById('refresh-recommendations');
    const recommendationList = document.getElementById('recommendation-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const periodButtons = document.querySelectorAll('.period-btn');
    const scopeButtons = document.querySelectorAll('.scope-btn');

    // Stats
    const statWeakestTopic = document.getElementById('stat-weakest-topic');
    const statWeakestReason = document.getElementById('stat-weakest-reason');
    const statOverdueCount = document.getElementById('stat-overdue-count');
    const statAvgAccuracy = document.getElementById('stat-avg-accuracy');

    let isWeakOnly = true;
    let selectedPeriod = 'all';
    let selectedScope = 'topic';

    async function populateSubjects() {
        try {
            const result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            if (result && Array.isArray(result)) {
                subjectFilter.innerHTML = '<option value="">All Subjects</option>';
                result.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });
            }
        } catch (error) { console.error('Failed to load subjects', error); }
    }

    async function populateLessons(subjectId) {
        lessonFilter.innerHTML = '<option value="">All Lessons</option>';
        lessonFilter.disabled = true;
        if (!subjectId) return;

        try {
            const result = await CacheManager.fetchWithCache(`${LESSON_API_URL}?subject_id=${subjectId}`, 60);
            if (result && Array.isArray(result)) {
                result.forEach(lesson => {
                    lessonFilter.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                lessonFilter.disabled = false;
            }
        } catch (error) { console.error('Failed to load lessons', error); }
    }

    async function populateTopics(lessonId) {
        if (!topicFilter) return;
        topicFilter.innerHTML = '<option value="">All Topics</option>';
        topicFilter.disabled = true;
        if (!lessonId) return;

        try {
            const result = await CacheManager.fetchWithCache(`${TOPIC_API_URL}?lesson_id=${lessonId}`, 60);
            if (result && Array.isArray(result)) {
                result.forEach(topic => {
                    topicFilter.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                topicFilter.disabled = false;
            }
        } catch (error) { console.error('Failed to load topics', error); }
    }

    async function populateExams(topicId) {
        if (!examFilter) return;
        examFilter.innerHTML = '<option value="">All Exams</option>';
        examFilter.disabled = true;
        if (!topicId) return;

        try {
            const result = await CacheManager.fetchWithCache(`${EXAM_API_URL}?topic_id=${topicId}&exclude_revision=true`, 60);
            if (result && result.success && Array.isArray(result.data)) {
                result.data.forEach(exam => {
                    examFilter.innerHTML += `<option value="${exam.id}">${exam.exam_title}</option>`;
                });
                examFilter.disabled = false;
            }
        } catch (error) { console.error('Failed to load exams', error); }
    }

    async function fetchRecommendations() {
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        let url = RECOMMENDATIONS_API + `?scope=${selectedScope}&weak_only=${isWeakOnly}&period=${selectedPeriod}`;
        if (subjectFilter.value) url += `&subject_id=${subjectFilter.value}`;
        if (lessonFilter.value) url += `&lesson_id=${lessonFilter.value}`;
        if (topicFilter && topicFilter.value) url += `&topic_id=${topicFilter.value}`;
        if (examFilter && examFilter.value) url += `&exam_id=${examFilter.value}`;

        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                renderSummary(result.data || []);
                renderRecommendations(result.data || []);
            }
        } catch (error) {
            console.error('Failed to load recommendations', error);
            renderRecommendations([]);
        } finally {
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }

    function renderSummary(data) {
        if (!data || data.length === 0) {
            statWeakestTopic.textContent = 'None';
            statWeakestReason.textContent = 'No data matching filters';
            statOverdueCount.textContent = '0';
            statAvgAccuracy.textContent = '0%';
            return;
        }

        const weakest = data[0];
        statWeakestTopic.textContent = weakest.topic_name || 'N/A';
        statWeakestReason.textContent = weakest.reason || 'N/A';

        const overdue = data.filter(r => (r.reason && r.reason.includes('days')) || r.last_revised === 'Never').length;
        statOverdueCount.textContent = overdue;

        const avgAcc = data.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / data.length;
        statAvgAccuracy.textContent = Math.round(avgAcc) + '%';
    }

    function renderRecommendations(data) {
        if (!recommendationList) return;

        if (!data || data.length === 0) {
            recommendationList.innerHTML = `
                <div class="p-12 text-center text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2 text-gray-300">search_off</span>
                    <p class="font-bold text-gray-600">No results found</p>
                    <p class="text-sm">Try changing your filters or choosing a different period.</p>
                </div>
            `;
            return;
        }

        const items = data.map(item => {
            const accuracy = item.accuracy || 0;
            const accuracyColor = accuracy >= 80 ? 'bg-green-100 text-green-700' : (accuracy >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700');
            return `
                <div class="p-6 hover:bg-gray-50 transition-colors group border-l-4 border-transparent hover:border-blue-500">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div class="space-y-1 flex-grow">
                            <div class="flex items-center gap-2">
                                <span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">${item.subject_name}</span>
                                <span class="text-gray-400 text-xs">/</span>
                                <span class="text-gray-500 text-xs font-medium">${item.lesson_name}</span>
                            </div>
                            <h4 class="text-lg font-bold text-gray-800">
                                ${selectedScope === 'exam' ? item.exam_title : item.topic_name}
                                ${selectedScope === 'exam' ? `<span class="text-xs font-normal text-gray-400 ml-2">(${item.topic_name})</span>` : ''}
                            </h4>
                            <div class="flex flex-wrap items-center gap-4 text-xs">
                                <span class="flex items-center gap-1 text-gray-500">
                                    <span class="material-symbols-outlined text-sm">event</span> ${item.last_revised === 'Never' ? 'Never Revised' : 'Last: ' + item.last_revised}
                                </span>
                                <span class="flex items-center gap-1 px-2 py-0.5 rounded-full ${accuracyColor} font-bold">
                                    <span class="material-symbols-outlined text-sm">analytics</span> ${accuracy}% Accuracy
                                </span>
                                <span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm">tips_and_updates</span> ${item.reason}
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="start-revision-btn flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all" 
                                data-id="${item.topic_id}" 
                                data-exam-id="${item.exam_id || ''}"
                                data-name="${selectedScope === 'exam' ? item.exam_title : item.topic_name}">
                                <span class="material-symbols-outlined text-lg">play_arrow</span> Start Revision
                            </button>
                            <button class="mark-revised-btn p-2.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-500 rounded-xl transition-all" data-id="${item.topic_id}" title="Mark as Revised">
                                <span class="material-symbols-outlined text-lg">check</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        recommendationList.innerHTML = items.join('');

        // Add Event Listeners to Buttons
        recommendationList.querySelectorAll('.start-revision-btn').forEach(btn => {
            btn.addEventListener('click', () => handleStartRevision(btn.dataset.id, btn.dataset.name, btn.dataset.examId));
        });
        recommendationList.querySelectorAll('.mark-revised-btn').forEach(btn => {
            btn.addEventListener('click', () => handleMarkRevised(btn.dataset.id));
        });
    }

    async function handleStartRevision(topicId, topicName, examId = null) {
        if (!confirm(`Start revision for "${topicName}"?`)) return;

        try {
            const body = {
                topic_id: topicId,
                exam_title: `Revision: ${topicName}`
            };
            if (examId) body.exam_id = examId;

            const response = await fetch(CREATE_REVISION_EXAM_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (result.success) {
                window.loadPage('take-exam-interface', `?exam_id=${result.exam_id}`);
            } else {
                alert(result.message || "Failed to create revision exam.");
            }
        } catch (error) {
            console.error("Revision error", error);
            alert("A network error occurred.");
        }
    }

    async function handleMarkRevised(topicId) {
        try {
            const response = await fetch(MARK_REVISED_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic_id: topicId })
            });
            const result = await response.json();
            if (result.success) {
                fetchRecommendations(); // Refresh list
            }
        } catch (error) {
            console.error("Error marking as revised", error);
        }
    }

    // Event Listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value);
        if (topicFilter) {
            topicFilter.innerHTML = '<option value="">All Topics</option>';
            topicFilter.disabled = true;
        }
        if (examFilter) {
            examFilter.innerHTML = '<option value="">All Exams</option>';
            examFilter.disabled = true;
        }
        fetchRecommendations();
    });
    lessonFilter.addEventListener('change', () => {
        populateTopics(lessonFilter.value);
        if (examFilter) {
            examFilter.innerHTML = '<option value="">All Exams</option>';
            examFilter.disabled = true;
        }
        fetchRecommendations();
    });
    if (topicFilter) topicFilter.addEventListener('change', () => {
        populateExams(topicFilter.value);
        fetchRecommendations();
    });
    if (examFilter) examFilter.addEventListener('change', fetchRecommendations);

    scopeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            scopeButtons.forEach(b => {
                b.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            btn.classList.remove('text-gray-500');
            selectedScope = btn.dataset.scope;
            fetchRecommendations();
        });
    });

    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            periodButtons.forEach(b => {
                b.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            btn.classList.remove('text-gray-500');
            selectedPeriod = btn.dataset.period;
            fetchRecommendations();
        });
    });

    btnWeakOnly.addEventListener('click', () => {
        isWeakOnly = true;
        btnWeakOnly.classList.add('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnWeakOnly.classList.remove('text-gray-500');
        btnShowAll.classList.remove('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnShowAll.classList.add('text-gray-500');
        fetchRecommendations();
    });

    btnShowAll.addEventListener('click', () => {
        isWeakOnly = false;
        btnShowAll.classList.add('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnShowAll.classList.remove('text-gray-500');
        btnWeakOnly.classList.remove('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnWeakOnly.classList.add('text-gray-500');
        fetchRecommendations();
    });

    btnRefresh.addEventListener('click', fetchRecommendations);

    // Initial Load
    populateSubjects();
    fetchRecommendations();
}

initializeRevisionPlanner();
