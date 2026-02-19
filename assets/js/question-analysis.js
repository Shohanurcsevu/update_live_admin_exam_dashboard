function initializeQuestionAnalysis() {
    const ANALYSIS_API_URL = 'api/performance/question-analysis.php';
    const EXAM_CREATE_API_URL = 'api/custom-exam/create-from-performance.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // DOM Elements
    // DOM Elements
    const subjectFilter = document.getElementById('filter-subject');
    const lessonFilter = document.getElementById('filter-lesson');
    const topicFilter = document.getElementById('filter-topic');
    const questionCardsContainer = document.getElementById('question-cards-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreContainer = document.getElementById('load-more-container');
    const noQuestionsMessage = document.getElementById('no-questions-message');
    const clearAnalysisFiltersBtn = document.getElementById('clear-analysis-filters');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Stats Elements
    const statTotalQuestions = document.getElementById('stat-total-questions');
    const statCorrect = document.getElementById('stat-correct');
    const statWrong = document.getElementById('stat-wrong');
    const statAccuracy = document.getElementById('stat-accuracy');

    // Buttons
    const btnWrongExam = document.getElementById('btn-wrong-exam');
    const btnUnattemptedExam = document.getElementById('btn-unattempted-exam');
    const btnMixedExam = document.getElementById('btn-mixed-exam');

    let offset = 0;
    const limit = 12;

    async function populateSubjects() {
        try {
            const result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            if (result) {
                subjectFilter.innerHTML = '<option value="">All Subjects</option>';
                result.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });

                const savedSubject = localStorage.getItem('filter_analysis_subject');
                if (savedSubject) {
                    subjectFilter.value = savedSubject;
                    populateLessons(savedSubject);
                } else {
                    fetchAnalysis();
                }
            }
        } catch (error) { console.error('Failed to load subjects', error); }
    }

    async function populateLessons(subjectId) {
        lessonFilter.innerHTML = '<option value="">All Lessons</option>';
        lessonFilter.disabled = true;
        topicFilter.innerHTML = '<option value="">All Topics</option>';
        topicFilter.disabled = true;

        if (!subjectId) {
            fetchAnalysis();
            return;
        }

        try {
            const result = await CacheManager.fetchWithCache(`${LESSON_API_URL}?subject_id=${subjectId}`, 60);
            if (result) {
                result.forEach(lesson => {
                    lessonFilter.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                lessonFilter.disabled = false;

                const savedLesson = localStorage.getItem('filter_analysis_lesson');
                if (savedLesson) {
                    lessonFilter.value = savedLesson;
                    populateTopics(savedLesson);
                } else {
                    fetchAnalysis();
                }
            }
        } catch (error) { console.error('Failed to load lessons', error); }
    }

    async function populateTopics(lessonId) {
        topicFilter.innerHTML = '<option value="">All Topics</option>';
        topicFilter.disabled = true;

        if (!lessonId) {
            fetchAnalysis();
            return;
        }

        try {
            const result = await CacheManager.fetchWithCache(`${TOPIC_API_URL}?lesson_id=${lessonId}`, 60);
            if (result) {
                result.forEach(topic => {
                    topicFilter.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                topicFilter.disabled = false;

                const savedTopic = localStorage.getItem('filter_analysis_topic');
                if (savedTopic) {
                    topicFilter.value = savedTopic;
                }
                fetchAnalysis();
            }
        } catch (error) { console.error('Failed to load topics', error); }
    }

    async function fetchAnalysis(append = false) {
        if (!append) {
            offset = 0;
            questionCardsContainer.innerHTML = '';
            noQuestionsMessage.classList.add('hidden');
            loadMoreContainer.classList.add('hidden');
        }

        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        let url = ANALYSIS_API_URL;
        const params = new URLSearchParams();
        if (subjectFilter && subjectFilter.value) params.append('subject_id', subjectFilter.value);
        if (lessonFilter && lessonFilter.value) params.append('lesson_id', lessonFilter.value);
        if (topicFilter && topicFilter.value) params.append('topic_id', topicFilter.value);

        params.append('limit', limit);
        params.append('offset', offset);

        const qs = params.toString();
        if (qs) url += '?' + qs;

        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                if (!append) renderSummary(result.summary);
                renderQuestionCards(result.questions, append);

                offset += result.questions.length;
                if (offset < result.total_count) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to fetch analysis', error);
        } finally {
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
        }
    }

    function renderSummary(summary) {
        if (statTotalQuestions) statTotalQuestions.textContent = summary.total_questions;
        if (statCorrect) statCorrect.textContent = summary.total_correct;
        if (statWrong) statWrong.textContent = summary.total_wrong;
        if (statAccuracy) statAccuracy.textContent = summary.accuracy + '%';
    }

    function renderQuestionCards(questions, append) {
        if (!questionCardsContainer) return;

        if (questions.length === 0 && !append) {
            noQuestionsMessage.classList.remove('hidden');
            return;
        }

        questions.forEach(q => {
            const accuracyColor = q.accuracy >= 80 ? 'text-green-600' : (q.accuracy >= 50 ? 'text-amber-600' : 'text-red-600');
            const accuracyBg = q.accuracy >= 80 ? 'bg-green-50' : (q.accuracy >= 50 ? 'bg-amber-50' : 'bg-red-50');

            const card = `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                    <div class="p-5 flex-grow">
                        <div class="flex items-start justify-between gap-4 mb-3">
                            <span class="px-2 py-1 ${accuracyBg} ${accuracyColor} text-xs font-bold rounded-md">
                                ${q.accuracy}% Accuracy
                            </span>
                            <span class="text-xs text-gray-400 font-medium">Ref: #${q.ref_id}</span>
                        </div>
                        
                        <h4 class="text-gray-800 font-semibold line-clamp-3 mb-4 leading-relaxed">
                            ${q.question}
                        </h4>

                        <div class="grid grid-cols-3 gap-2 mt-4 text-center">
                            <div class="p-2 bg-gray-50 rounded-lg">
                                <p class="text-[10px] text-gray-500 uppercase font-bold">Attempts</p>
                                <p class="text-sm font-black text-gray-700">${q.total_attempts}</p>
                            </div>
                            <div class="p-2 bg-green-50 rounded-lg">
                                <p class="text-[10px] text-green-600 uppercase font-bold">Correct</p>
                                <p class="text-sm font-black text-green-700">${q.correct_count}</p>
                            </div>
                            <div class="p-2 bg-red-50 rounded-lg">
                                <p class="text-[10px] text-red-600 uppercase font-bold">Wrong</p>
                                <p class="text-sm font-black text-red-700">${q.wrong_count}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <span class="text-xs font-bold text-gray-400">Priority: ${q.priority}</span>
                        <div class="flex items-center gap-1 text-gray-400">
                             <span class="material-symbols-outlined text-sm">event_repeat</span>
                             <span class="text-xs font-bold">${q.unattempted_count} Skipped</span>
                        </div>
                    </div>
                </div>
            `;
            questionCardsContainer.insertAdjacentHTML('beforeend', card);
        });
    }

    // Modal Elements
    const examModal = document.getElementById('exam-modal');
    const examModalContent = document.getElementById('exam-modal-content');
    const modalStepInput = document.getElementById('modal-step-input');
    const modalStepSuccess = document.getElementById('modal-step-success');
    const modalLoading = document.getElementById('modal-loading');
    const newExamTitleInput = document.getElementById('new-exam-title');
    const confirmCreateBtn = document.getElementById('confirm-exam-creation');
    const cancelCreateBtn = document.getElementById('cancel-exam-creation');
    const closeModalBtn = document.getElementById('close-exam-modal');
    const goToExamBtn = document.getElementById('go-to-exam');
    const stayOnPageBtn = document.getElementById('stay-on-page');
    const examModalTitle = document.getElementById('exam-modal-title');

    let currentCreateMode = '';
    let lastCreatedExamId = null;

    function openExamModal(mode) {
        currentCreateMode = mode;
        const displayMode = mode.charAt(0).toUpperCase() + mode.slice(1);
        examModalTitle.textContent = `Create ${displayMode} Exam`;
        newExamTitleInput.value = `Targeted ${displayMode} Exam`;

        // Reset states
        modalStepInput.classList.remove('hidden');
        modalStepSuccess.classList.add('hidden');
        modalLoading.classList.add('hidden');

        examModal.classList.remove('hidden');
        examModal.classList.add('flex');

        setTimeout(() => {
            examModalContent.classList.remove('scale-95', 'opacity-0');
            examModalContent.classList.add('scale-100', 'opacity-100');
            newExamTitleInput.focus();
        }, 10);
    }

    function closeExamModalFunc() {
        examModalContent.classList.remove('scale-100', 'opacity-100');
        examModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            examModal.classList.add('hidden');
            examModal.classList.remove('flex');
        }, 300);
    }

    async function submitExamCreation() {
        const title = newExamTitleInput.value.trim();
        if (!title) {
            alert("Please enter an exam title.");
            return;
        }

        modalLoading.classList.remove('hidden');
        modalLoading.classList.add('flex');

        const data = {
            mode: currentCreateMode,
            exam_title: title,
            subject_id: subjectFilter.value || null,
            lesson_id: lessonFilter.value || null,
            topic_id: topicFilter.value || null,
            limit: 15
        };

        try {
            const response = await fetch(EXAM_CREATE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            modalLoading.classList.add('hidden');
            modalLoading.classList.remove('flex');

            if (result.success) {
                lastCreatedExamId = result.exam_id;
                modalStepInput.classList.add('hidden');
                modalStepSuccess.classList.remove('hidden');
            } else {
                alert(result.message || "Failed to create exam.");
            }
        } catch (error) {
            console.error("Exam creation error", error);
            modalLoading.classList.add('hidden');
            alert("A network error occurred.");
        }
    }

    // Modal Event Listeners
    closeModalBtn.addEventListener('click', closeExamModalFunc);
    cancelCreateBtn.addEventListener('click', closeExamModalFunc);
    stayOnPageBtn.addEventListener('click', closeExamModalFunc);
    confirmCreateBtn.addEventListener('click', submitExamCreation);

    goToExamBtn.addEventListener('click', () => {
        if (lastCreatedExamId && window.loadPage) {
            window.loadPage('take-exam-interface', `?exam_id=${lastCreatedExamId}`);
        }
        closeExamModalFunc();
    });

    examModal.addEventListener('click', (e) => {
        if (e.target === examModal) closeExamModalFunc();
    });

    // Event Listeners
    loadMoreBtn.addEventListener('click', () => fetchAnalysis(true));

    if (subjectFilter) {
        subjectFilter.addEventListener('change', () => {
            localStorage.setItem('filter_analysis_subject', subjectFilter.value);
            localStorage.removeItem('filter_analysis_lesson');
            localStorage.removeItem('filter_analysis_topic');
            populateLessons(subjectFilter.value);
            fetchAnalysis();
        });
    }
    if (lessonFilter) {
        lessonFilter.addEventListener('change', () => {
            localStorage.setItem('filter_analysis_lesson', lessonFilter.value);
            localStorage.removeItem('filter_analysis_topic');
            populateTopics(lessonFilter.value);
            fetchAnalysis();
        });
    }
    if (topicFilter) {
        topicFilter.addEventListener('change', () => {
            localStorage.setItem('filter_analysis_topic', topicFilter.value);
            fetchAnalysis();
        });
    }

    if (clearAnalysisFiltersBtn) {
        clearAnalysisFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_analysis_subject');
            localStorage.removeItem('filter_analysis_lesson');
            localStorage.removeItem('filter_analysis_topic');

            subjectFilter.value = '';
            lessonFilter.innerHTML = '<option value="">All Lessons</option>';
            lessonFilter.disabled = true;
            topicFilter.innerHTML = '<option value="">All Topics</option>';
            topicFilter.disabled = true;

            fetchAnalysis();
        });
    }

    // --- Original Event Listeners Updated ---
    if (btnWrongExam) btnWrongExam.addEventListener('click', () => openExamModal('wrong'));
    if (btnUnattemptedExam) btnUnattemptedExam.addEventListener('click', () => openExamModal('unattempted'));
    if (btnMixedExam) btnMixedExam.addEventListener('click', () => openExamModal('mixed'));

    populateSubjects();
}

initializeQuestionAnalysis();
