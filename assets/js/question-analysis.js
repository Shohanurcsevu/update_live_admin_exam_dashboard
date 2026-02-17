function initializeQuestionAnalysis() {
    const ANALYSIS_API_URL = 'api/performance/question-analysis.php';
    const EXAM_CREATE_API_URL = 'api/custom-exam/create-from-performance.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // DOM Elements
    const subjectFilter = document.getElementById('filter-subject');
    const lessonFilter = document.getElementById('filter-lesson');
    const topicFilter = document.getElementById('filter-topic');
    const questionListBody = document.getElementById('question-list-body');
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

    async function populateSubjects() {
        try {
            const result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            if (result) {
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
        topicFilter.innerHTML = '<option value="">All Topics</option>';
        topicFilter.disabled = true;

        if (!subjectId) return;

        try {
            const result = await CacheManager.fetchWithCache(`${LESSON_API_URL}?subject_id=${subjectId}`, 60);
            if (result) {
                result.forEach(lesson => {
                    lessonFilter.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                lessonFilter.disabled = false;
            }
        } catch (error) { console.error('Failed to load lessons', error); }
    }

    async function populateTopics(lessonId) {
        topicFilter.innerHTML = '<option value="">All Topics</option>';
        topicFilter.disabled = true;

        if (!lessonId) return;

        try {
            const result = await CacheManager.fetchWithCache(`${TOPIC_API_URL}?lesson_id=${lessonId}`, 60);
            if (result) {
                result.forEach(topic => {
                    topicFilter.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                topicFilter.disabled = false;
            }
        } catch (error) { console.error('Failed to load topics', error); }
    }

    async function fetchAnalysis() {
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        let url = ANALYSIS_API_URL;
        const params = new URLSearchParams();
        if (subjectFilter && subjectFilter.value) params.append('subject_id', subjectFilter.value);
        if (lessonFilter && lessonFilter.value) params.append('lesson_id', lessonFilter.value);
        if (topicFilter && topicFilter.value) params.append('topic_id', topicFilter.value);

        const qs = params.toString();
        if (qs) url += '?' + qs;

        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success) {
                renderSummary(result.summary);
                renderQuestionList(result.questions);
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

    function renderQuestionList(questions) {
        if (!questionListBody) return;
        questionListBody.innerHTML = '';
        if (questions.length === 0) {
            questionListBody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-gray-500">No questions found matching the filters.</td></tr>';
            return;
        }

        const rows = questions.map(q => {
            const accuracyColor = q.accuracy >= 80 ? 'text-green-600' : (q.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600');
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="flex flex-col">
                            <span class="text-gray-900 font-medium">${q.question}</span>
                            <span class="text-xs text-gray-400 mt-1">Priority: ${q.priority}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center font-bold text-gray-700">${q.total_attempts}</td>
                    <td class="px-6 py-4 text-center font-bold text-green-600">${q.correct_count}</td>
                    <td class="px-6 py-4 text-center font-bold text-red-600">${q.wrong_count}</td>
                    <td class="px-6 py-4 text-center font-bold text-gray-400">${q.unattempted_count}</td>
                    <td class="px-6 py-4 text-right">
                        <span class="font-black ${accuracyColor}">${q.accuracy}%</span>
                    </td>
                </tr>
            `;
        });
        questionListBody.innerHTML = rows.join('');
    }

    async function handleCreateExam(mode) {
        const title = prompt("Enter a title for this exam:", `Targeted ${mode} Exam`);
        if (!title) return;

        const data = {
            mode: mode,
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
            if (result.success) {
                if (confirm("Exam created successfully! Click OK to go to the exam taking page.")) {
                    window.loadPage('take-exam-interface', `?exam_id=${result.exam_id}`);
                }
            } else {
                alert(result.message || "Failed to create exam.");
            }
        } catch (error) {
            console.error("Exam creation error", error);
            alert("A network error occurred.");
        }
    }

    // Event Listeners
    if (subjectFilter) {
        subjectFilter.addEventListener('change', () => {
            populateLessons(subjectFilter.value);
            fetchAnalysis();
        });
    }
    if (lessonFilter) {
        lessonFilter.addEventListener('change', () => {
            populateTopics(lessonFilter.value);
            fetchAnalysis();
        });
    }
    if (topicFilter) {
        topicFilter.addEventListener('change', fetchAnalysis);
    }

    if (btnWrongExam) btnWrongExam.addEventListener('click', () => handleCreateExam('wrong'));
    if (btnUnattemptedExam) btnUnattemptedExam.addEventListener('click', () => handleCreateExam('unattempted'));
    if (btnMixedExam) btnMixedExam.addEventListener('click', () => handleCreateExam('mixed'));

    // Initial Load
    populateSubjects();
    fetchAnalysis();
}

initializeQuestionAnalysis();
