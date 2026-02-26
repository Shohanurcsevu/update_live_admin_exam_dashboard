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
    const periodButtons = document.querySelectorAll('.period-btn');
    const scopeButtons = document.querySelectorAll('.scope-btn');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Revision Confirmation Modal
    const startRevisionModal = document.getElementById('start-revision-modal');
    const revisionModalContent = document.getElementById('revision-modal-content');
    const revisionModalText = document.getElementById('revision-modal-text');
    const confirmRevisionBtn = document.getElementById('confirm-revision-btn');
    const cancelRevisionBtn = document.getElementById('cancel-revision-btn');

    let pendingRevisionData = null;

    // Stats
    const statWeakestTopic = document.getElementById('stat-weakest-topic');
    const statWeakestReason = document.getElementById('stat-weakest-reason');
    const statOverdueCount = document.getElementById('stat-overdue-count');
    const statAvgAccuracy = document.getElementById('stat-avg-accuracy');

    let isWeakOnly = true;
    let selectedPeriod = 'all';
    let selectedScope = 'topic';

    // Pagination State
    let currentPage = 0;
    const itemsPerPage = 10;
    let hasMore = false;

    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    function saveFilters() {
        const filters = {
            subjectId: subjectFilter.value,
            lessonId: lessonFilter.value,
            topicId: topicFilter.value,
            examId: examFilter.value,
            isWeakOnly: isWeakOnly,
            selectedPeriod: selectedPeriod,
            selectedScope: selectedScope
        };
        localStorage.setItem('revision_planner_filters', JSON.stringify(filters));
    }

    async function loadFilters() {
        const saved = localStorage.getItem('revision_planner_filters');
        if (!saved) return null;
        try {
            const filters = JSON.parse(saved);

            // Restore Scope & Period (simple variables)
            if (filters.selectedScope) {
                selectedScope = filters.selectedScope;
                scopeButtons.forEach(btn => {
                    if (btn.dataset.scope === selectedScope) {
                        btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                        btn.classList.remove('text-gray-500');
                    } else {
                        btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                        btn.classList.add('text-gray-500');
                    }
                });
            }

            if (filters.selectedPeriod) {
                selectedPeriod = filters.selectedPeriod;
                periodButtons.forEach(btn => {
                    if (btn.dataset.period === selectedPeriod) {
                        btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                        btn.classList.remove('text-gray-500');
                    } else {
                        btn.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                        btn.classList.add('text-gray-500');
                    }
                });
            }

            if (filters.isWeakOnly !== undefined) {
                isWeakOnly = filters.isWeakOnly;
                if (isWeakOnly) {
                    btnWeakOnly.classList.add('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
                    btnWeakOnly.classList.remove('text-gray-500');
                    btnShowAll.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                    btnShowAll.classList.add('text-gray-500');
                } else {
                    btnWeakOnly.classList.remove('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
                    btnWeakOnly.classList.add('text-gray-500');
                    btnShowAll.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                    btnShowAll.classList.remove('text-gray-500');
                }
            }

            // Cascading selects restoration
            if (filters.subjectId) {
                subjectFilter.value = filters.subjectId;
                await populateLessons(filters.subjectId);
                if (filters.lessonId) {
                    lessonFilter.value = filters.lessonId;
                    await populateTopics(filters.lessonId);
                    if (filters.topicId) {
                        topicFilter.value = filters.topicId;
                        await populateExams(filters.topicId);
                        if (filters.examId) {
                            examFilter.value = filters.examId;
                        }
                    }
                }
            }
            return true;
        } catch (e) {
            console.error("Failed to load filters", e);
            return null;
        }
    }

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

    async function fetchRecommendations(append = false) {
        if (!append) {
            currentPage = 0;
            if (recommendationList) {
                recommendationList.innerHTML = `
                    <div class="p-12 text-center text-gray-400">
                        <span class="material-symbols-outlined text-4xl mb-2 animate-pulse">analytics</span>
                        <p>Analyzing your performance...</p>
                    </div>
                `;
            }
        }

        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        const offset = currentPage * itemsPerPage;
        let url = RECOMMENDATIONS_API + `?scope=${selectedScope}&weak_only=${isWeakOnly}&period=${selectedPeriod}&limit=${itemsPerPage}&offset=${offset}`;

        if (subjectFilter.value) url += `&subject_id=${subjectFilter.value}`;
        if (lessonFilter.value) url += `&lesson_id=${lessonFilter.value}`;
        if (topicFilter && topicFilter.value) url += `&topic_id=${topicFilter.value}`;
        if (examFilter && examFilter.value) url += `&exam_id=${examFilter.value}`;

        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                if (!append) renderSummaryData(result.summary);

                hasMore = result.has_more;
                renderRecommendations(result.data || [], append);

                if (loadMoreContainer) {
                    if (hasMore) loadMoreContainer.classList.remove('hidden');
                    else loadMoreContainer.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to load recommendations', error);
            if (!append) renderRecommendations([]);
        } finally {
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }

    function renderSummaryData(summary) {
        if (!summary) return;
        statWeakestTopic.textContent = summary.weakest_topic || 'None';
        statWeakestReason.textContent = summary.weakest_reason || 'No data';
        statOverdueCount.textContent = summary.overdue_count || '0';
        statAvgAccuracy.textContent = summary.avg_accuracy || '0%';
    }

    function renderRecommendations(data, append = false) {
        if (!recommendationList) return;

        if (!append && (!data || data.length === 0)) {
            recommendationList.innerHTML = `
                <div class="p-12 text-center text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2 text-gray-300">search_off</span>
                    <p class="font-bold text-gray-600">No results found</p>
                    <p class="text-sm">Try changing your filters or choosing a different period.</p>
                </div>
            `;
            return;
        }

        let html = '';
        data.forEach(item => {
            const priorityClass = item.priority_score > 60 ? 'bg-red-50 text-red-700' : (item.priority_score > 30 ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700');
            const accuracyColor = item.accuracy < 50 ? 'text-red-600' : (item.accuracy < 80 ? 'text-orange-600' : 'text-emerald-600');

            html += `
                <div class="group hover:bg-gray-50/50 transition-all duration-300">
                    <div class="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityClass}">Score: ${Math.round(item.priority_score)}</span>
                                <span class="text-xs text-gray-400 font-medium">${item.subject_name} • ${item.lesson_name}</span>
                            </div>
                            <h4 class="text-lg font-bold text-gray-800 truncate group-hover:text-blue-600 transition-colors">${item.topic_name || item.exam_title}</h4>
                            <div class="flex items-center gap-4 mt-2">
                                <div class="flex items-center gap-1.5">
                                    <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                                    <span class="text-xs font-bold text-gray-600"><span class="${accuracyColor}">${item.accuracy}%</span> Accuracy</span>
                                </div>
                                <div class="text-xs text-gray-400 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-sm">schedule</span>
                                    Reason: <span class="text-gray-600 font-medium italic">${item.reason}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-3 self-end md:self-center">
                            <button onclick="window.handleQuickStudy(${item.topic_id}, '${(item.topic_name || item.exam_title).replace(/'/g, "\\'")}')" class="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Study Material">
                                <span class="material-symbols-outlined">library_books</span>
                            </button>
                            <button onclick="window.handleStartRevision(${item.topic_id}, '${(item.topic_name || item.exam_title).replace(/'/g, "\\'")}', ${item.exam_id || 'null'})" 
                                class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95 whitespace-nowrap">
                                <span class="material-symbols-outlined text-lg">play_arrow</span>
                                Revise Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        if (append) {
            recommendationList.innerHTML += html;
        } else {
            recommendationList.innerHTML = html;
        }
    }

    function openRevisionModal(topicId, topicName, examId = null) {
        pendingRevisionData = { topicId, topicName, examId };
        if (revisionModalText) revisionModalText.textContent = `You are about to start a revision session for "${topicName}". Ready?`;

        if (startRevisionModal) {
            startRevisionModal.classList.remove('hidden');
            startRevisionModal.classList.add('flex');
            setTimeout(() => {
                if (revisionModalContent) {
                    revisionModalContent.classList.remove('scale-95', 'opacity-0');
                    revisionModalContent.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
        }
    }

    function closeRevisionModal() {
        if (revisionModalContent) {
            revisionModalContent.classList.remove('scale-100', 'opacity-100');
            revisionModalContent.classList.add('scale-95', 'opacity-0');
        }
        setTimeout(() => {
            if (startRevisionModal) {
                startRevisionModal.classList.add('hidden');
                startRevisionModal.classList.remove('flex');
            }
            pendingRevisionData = null;
        }, 300);
    }

    async function handleStartRevision(topicId, topicName, examId = null) {
        openRevisionModal(topicId, topicName, examId);
    }
    window.handleStartRevision = handleStartRevision;

    async function handleQuickStudy(topicId, topicName) {
        openQuickStudyModal(topicId, topicName);
    }
    window.handleQuickStudy = handleQuickStudy;

    function openQuickStudyModal(topicId, topicName) {
        const modal = document.getElementById('quick-study-modal');
        const content = document.getElementById('quick-study-modal-content');
        const title = document.getElementById('quick-study-title');
        const container = document.getElementById('quick-study-content');

        if (!modal || !content) return;

        title.textContent = topicName;
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                <span class="material-symbols-outlined text-5xl animate-spin mb-4">sync</span>
                <p class="font-bold text-gray-600">Preparing your materials...</p>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        setTimeout(() => {
            content.classList.remove('translate-y-full', 'sm:scale-95', 'opacity-0');
            content.classList.add('translate-y-0', 'sm:scale-100', 'opacity-100');
        }, 10);

        fetchQuickStudyContent(topicId, topicName);
    }

    async function fetchQuickStudyContent(topicId, topicName) {
        const container = document.getElementById('quick-study-content');
        const startBtn = document.getElementById('quick-study-start-exam-btn');
        const printBtn = document.getElementById('quick-study-print-btn');

        try {
            const response = await fetch(`api/question/list-by-topic.php?topic_id=${topicId}`);
            const result = await response.json();

            if (result.success && result.data.questions.length > 0) {
                let html = '';
                result.data.questions.forEach((q, idx) => {
                    html += `
                        <div class="question-card-study">
                            <div class="flex items-start gap-4 mb-4">
                                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">${idx + 1}</div>
                                <div class="text-lg font-bold text-gray-800 leading-relaxed">${q.question}</div>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                <div class="p-3 rounded-xl border border-gray-100 text-sm flex gap-2"><span class="font-bold text-gray-400">ক)</span> ${q.options.A}</div>
                                <div class="p-3 rounded-xl border border-gray-100 text-sm flex gap-2"><span class="font-bold text-gray-400">খ)</span> ${q.options.B}</div>
                                <div class="p-3 rounded-xl border border-gray-100 text-sm flex gap-2"><span class="font-bold text-gray-400">গ)</span> ${q.options.C}</div>
                                <div class="p-3 rounded-xl border border-gray-100 text-sm flex gap-2"><span class="font-bold text-gray-400">ঘ)</span> ${q.options.D}</div>
                            </div>

                            <div class="answer-reveal-box">
                                <div class="flex items-center gap-2 text-emerald-600 font-bold mb-2">
                                    <span class="material-symbols-outlined text-lg">check_circle</span> Correct Answer: ${q.answer === 'A' ? 'ক' : q.answer === 'B' ? 'খ' : q.answer === 'C' ? 'গ' : 'ঘ'}
                                </div>
                                ${q.explanation ? `<div class="text-sm text-gray-600 bg-white/50 p-4 rounded-xl border border-gray-100 mt-2 italic leading-relaxed"><span class="font-black text-[10px] uppercase text-gray-400 block mb-1">Explanation</span>${q.explanation}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = html;

                startBtn.onclick = () => {
                    closeQuickStudyModal();
                    handleStartRevision(topicId, topicName);
                };

                printBtn.onclick = () => {
                    if (window.StudyMaterialEngine) {
                        window.StudyMaterialEngine.generate(result.data);
                    }
                };

            } else {
                container.innerHTML = `<div class="p-10 text-center text-gray-500">${result.message || 'No questions found.'}</div>`;
            }
        } catch (error) {
            console.error("Quick study error", error);
            container.innerHTML = `<div class="p-10 text-center text-red-500">Failed to load content.</div>`;
        }
    }

    function closeQuickStudyModal() {
        const modal = document.getElementById('quick-study-modal');
        const content = document.getElementById('quick-study-modal-content');
        if (!modal || !content) return;

        content.classList.remove('translate-y-0', 'sm:scale-100', 'opacity-100');
        content.classList.add('translate-y-full', 'sm:scale-95', 'opacity-0');

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }

    async function executeStartRevision() {
        if (!pendingRevisionData) return;
        const { topicId, topicName, examId } = pendingRevisionData;

        closeRevisionModal();

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
    window.handleMarkRevised = handleMarkRevised;

    // Event Listeners
    subjectFilter.addEventListener('change', async () => {
        await populateLessons(subjectFilter.value);
        if (topicFilter) {
            topicFilter.innerHTML = '<option value="">All Topics</option>';
            topicFilter.disabled = true;
        }
        if (examFilter) {
            examFilter.innerHTML = '<option value="">All Exams</option>';
            examFilter.disabled = true;
        }
        saveFilters();
        fetchRecommendations();
    });

    lessonFilter.addEventListener('change', async () => {
        await populateTopics(lessonFilter.value);
        if (examFilter) {
            examFilter.innerHTML = '<option value="">All Exams</option>';
            examFilter.disabled = true;
        }
        saveFilters();
        fetchRecommendations();
    });

    if (topicFilter) topicFilter.addEventListener('change', async () => {
        await populateExams(topicFilter.value);
        saveFilters();
        fetchRecommendations();
    });

    if (examFilter) examFilter.addEventListener('change', () => {
        saveFilters();
        fetchRecommendations();
    });

    scopeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            scopeButtons.forEach(b => {
                b.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            btn.classList.remove('text-gray-500');
            selectedScope = btn.dataset.scope;

            const examSelect = document.getElementById('filter-exam');
            if (selectedScope === 'topic') {
                if (examSelect) examSelect.closest('div')?.classList.add('hidden'); // Optional: hide if needed
                if (examSelect) examSelect.disabled = true;
            } else {
                if (examSelect) examSelect.closest('div')?.classList.remove('hidden');
                // Don't enable yet, wait for topic selection
            }
            saveFilters();
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
            saveFilters();
            fetchRecommendations();
        });
    });

    btnWeakOnly.addEventListener('click', () => {
        isWeakOnly = true;
        btnWeakOnly.classList.add('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnWeakOnly.classList.remove('text-gray-500');
        btnShowAll.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
        btnShowAll.classList.add('text-gray-500');
        saveFilters();
        fetchRecommendations();
    });

    btnShowAll.addEventListener('click', () => {
        isWeakOnly = false;
        btnWeakOnly.classList.remove('bg-white', 'text-red-600', 'shadow-sm', 'border-red-50');
        btnWeakOnly.classList.add('text-gray-500');
        btnShowAll.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
        btnShowAll.classList.remove('text-gray-500');
        saveFilters();
        fetchRecommendations();
    });

    btnRefresh.addEventListener('click', fetchRecommendations);

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            fetchRecommendations(true);
        });
    }

    if (confirmRevisionBtn) confirmRevisionBtn.addEventListener('click', executeStartRevision);
    if (cancelRevisionBtn) cancelRevisionBtn.addEventListener('click', closeRevisionModal);

    // Quick Study Modal Listeners
    const closeQuickStudyBtn = document.getElementById('close-quick-study');
    const dismissQuickStudyBtn = document.getElementById('quick-study-dismiss-btn');
    const quickStudyModal = document.getElementById('quick-study-modal');

    if (closeQuickStudyBtn) closeQuickStudyBtn.addEventListener('click', closeQuickStudyModal);
    if (dismissQuickStudyBtn) dismissQuickStudyBtn.addEventListener('click', closeQuickStudyModal);
    if (quickStudyModal) {
        quickStudyModal.addEventListener('click', (e) => {
            if (e.target === quickStudyModal) closeQuickStudyModal();
        });
    }

    if (startRevisionModal) {
        startRevisionModal.addEventListener('click', (e) => {
            if (e.target === startRevisionModal) closeRevisionModal();
        });
    }

    // Initial Load
    async function init() {
        await populateSubjects();
        const loaded = await loadFilters();
        fetchRecommendations();
    }
    init();
}

initializeRevisionPlanner();
