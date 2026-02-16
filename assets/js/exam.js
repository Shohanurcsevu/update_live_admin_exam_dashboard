function initializeExamPage() {
    const EXAM_API_URL = 'api/exam/exam.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // DOM Elements
    const createBtn = document.getElementById('create-exam-btn');
    const examModal = document.getElementById('exam-modal');
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    const examForm = document.getElementById('exam-form');
    const tableBody = document.getElementById('exams-table-body');
    const cardView = document.getElementById('exams-card-view');
    const toastContainer = document.getElementById('toast-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');

    // Filters
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

    // Modal Selectors
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const modalTopicSelector = document.getElementById('modal-topic-selector');
    const modalQuestionsJson = document.getElementById('modal-questions-json');
    const previewQuestionsBtn = document.getElementById('preview-imported-questions-btn');
    const previewContainer = document.getElementById('imported-questions-preview');

    let examIdToDelete = null;
    let importedQuestions = [];
    const defaultInstructions = 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।';

    let currentOffset = 0;
    const itemsPerPage = 20;
    let isFetching = false;
    let initialExamMetrics = null; // Store initial values for additive updates

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            case 'update': bgColor = 'bg-yellow-500'; icon = 'notification_important'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    function updateExamMetrics(count) {
        if (count > 0) {
            const durationInput = document.getElementById('duration');
            const totalMarksInput = document.getElementById('total-marks');
            const passMarkInput = document.getElementById('pass-mark');

            let newDuration = count;
            let newTotalMarks = count;

            // If editing an existing exam, add to the initial values
            if (initialExamMetrics) {
                newDuration = initialExamMetrics.duration + count;
                newTotalMarks = initialExamMetrics.totalMarks + count;
            }

            if (durationInput) durationInput.value = newDuration;
            if (totalMarksInput) totalMarksInput.value = newTotalMarks;
            if (passMarkInput) passMarkInput.value = (newTotalMarks * 0.99).toFixed(2);
        }
    }

    async function populateSubjects(selector) {
        try {
            const result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            if (result) {
                selector.innerHTML = selector === subjectFilter ? '<option value="0">All Subjects</option>' : '<option value="">Select Subject</option>';
                result.forEach(subject => {
                    selector.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });
            }
        } catch (error) { showToast('Failed to load subjects.', 'error'); }
    }

    async function populateLessons(subjectId, selector, lessonToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!subjectId || subjectId === "0") {
            selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Subject First</option>';
            return;
        }
        try {
            const result = await CacheManager.fetchWithCache(`${LESSON_API_URL}?subject_id=${subjectId}`, 60);
            if (result) {
                selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Lesson</option>';
                result.forEach(lesson => {
                    selector.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                selector.disabled = false;
                if (lessonToSelect) selector.value = lessonToSelect;
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    }

    async function populateTopics(lessonId, selector, topicToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!lessonId || lessonId === "0") {
            selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Lesson First</option>';
            return;
        }
        try {
            const result = await CacheManager.fetchWithCache(`${TOPIC_API_URL}?lesson_id=${lessonId}`, 60);
            if (result) {
                selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Topic</option>';
                result.forEach(topic => {
                    selector.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                selector.disabled = false;
                if (topicToSelect) selector.value = topicToSelect;
            }
        } catch (error) { showToast('Failed to load topics.', 'error'); }
    }

    async function fetchAndDisplayExams(append = false, forceRefresh = false) {
        if (isFetching) return;
        isFetching = true;

        if (!append) {
            currentOffset = 0;
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-8"><span class="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span><p class="mt-2 text-gray-500 font-medium tracking-tight">Loading exams...</p></td></tr>';
            cardView.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-blue-500"><span class="material-symbols-outlined animate-spin text-5xl">sync</span><p class="mt-4 text-gray-600 font-medium">Loading exams...</p></div>';
            document.getElementById('load-more-container').classList.add('hidden');
        }

        let url = `${EXAM_API_URL}?action=list&limit=${itemsPerPage}&offset=${currentOffset}`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        const query = params.toString();
        if (query) url += `&${query}`;

        try {
            const result = await CacheManager.fetchWithCache(url, 2, forceRefresh, false, true);

            if (!append) {
                tableBody.innerHTML = '';
                cardView.innerHTML = '';
            }

            if (result && result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    // Desktop Table Row
                    const row = `
                        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td class="py-4 px-6 text-left">
                                <span class="font-bold text-gray-900 block truncate max-w-xs" title="${exam.exam_title}">${exam.exam_title}</span>
                            </td>
                            <td class="py-4 px-6 text-left">
                                <div class="flex flex-col text-[11px] leading-tight text-gray-500">
                                    <span class="font-bold text-blue-600 uppercase tracking-tighter">${exam.subject_name || 'N/A'}</span>
                                    <span class="truncate max-w-[150px]">${exam.lesson_name || 'N/A'}</span>
                                    <span class="italic text-gray-400 truncate max-w-[150px]">${exam.topic_name || 'N/A'}</span>
                                </div>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-black tracking-tight">${exam.duration}m</span>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-black tracking-tight">${exam.total_marks}</span>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button class="edit-btn p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" title="Edit Exam">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button class="manage-questions-btn p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" data-title="${exam.exam_title}" title="Manage Questions">
                                        <span class="material-symbols-outlined text-lg">quiz</span>
                                    </button>
                                    <button class="delete-btn p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" title="Delete Exam">
                                        <span class="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;

                    // Mobile Card
                    const card = `
                        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden group">
                           <div class="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-[60px] flex items-start justify-end p-2 z-0">
                                <span class="material-symbols-outlined text-blue-200/50 text-4xl">assignment</span>
                           </div>
                           <div class="relative z-10">
                                <h3 class="font-black text-gray-900 leading-tight pr-8">${exam.exam_title}</h3>
                                <div class="mt-2 flex flex-col gap-0.5 text-[11px] font-medium text-gray-500">
                                    <span class="text-blue-600 font-black uppercase tracking-widest">${exam.subject_name || 'N/A'}</span>
                                    <span class="text-gray-400 italic">${exam.lesson_name || 'N/A'} / ${exam.topic_name || 'N/A'}</span>
                                </div>
                                <div class="flex items-center gap-3 mt-3">
                                    <span class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none">
                                        <span class="material-symbols-outlined text-sm">schedule</span>
                                        ${exam.duration}m
                                    </span>
                                    <span class="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none">
                                        <span class="material-symbols-outlined text-sm">military_tech</span>
                                        ${exam.total_marks}M
                                    </span>
                                </div>
                                <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-50">
                                    <button class="edit-btn w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all" data-id="${exam.id}">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                        Edit
                                    </button>
                                    <button class="manage-questions-btn w-full bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all" data-id="${exam.id}" data-title="${exam.exam_title}">
                                        <span class="material-symbols-outlined text-lg">quiz</span>
                                        Questions
                                    </button>
                                    <button class="delete-btn w-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-[11px] font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all" data-id="${exam.id}">
                                        <span class="material-symbols-outlined text-lg">delete</span>
                                        Delete
                                    </button>
                                </div>
                           </div>
                        </div>`;
                    cardView.innerHTML += card;
                });

                // Update Pagination Info
                const totalLoaded = (currentOffset + result.data.length);
                currentCountEl.textContent = totalLoaded;
                totalCountEl.textContent = result.pagination.total;

                // Show/hide Load More button
                const loadMoreContainer = document.getElementById('load-more-container');
                if (result.pagination.hasMore) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            } else {
                if (!append) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-medium">No exams found.</td></tr>`;
                    cardView.innerHTML = `<div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-12 px-6 text-center text-gray-400 font-medium">No exams found for selection.</div>`;
                    currentCountEl.textContent = 0;
                    totalCountEl.textContent = 0;
                    document.getElementById('load-more-container').classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Failed to load exams.', 'error');
            if (!append) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500 font-bold">Error loading exams.</td></tr>`;
        } finally {
            isFetching = false;
        }
    }

    async function loadMoreExams() {
        const loadMoreBtn = document.getElementById('load-more-btn');
        const originalContent = loadMoreBtn.innerHTML;
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">sync</span> Loading...';

        currentOffset += itemsPerPage;
        await fetchAndDisplayExams(true);

        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = originalContent;
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modal === examModal) {
            importedQuestions = [];
            if (modalQuestionsJson) modalQuestionsJson.value = '';
            if (previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.classList.add('hidden');
            }
        }
    }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(examForm);
        const data = Object.fromEntries(formData.entries());

        // Enforce default instructions and include imported questions if any
        data.instructions = defaultInstructions;
        if (importedQuestions.length > 0) {
            data.questions = importedQuestions;
        }

        const url = data.id ? `${EXAM_API_URL}?action=update` : `${EXAM_API_URL}?action=create`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(examModal);
                // Cache Invalidation
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                    CacheManager.clearGroup('exam');
                    CacheManager.clearGroup('custom-exam');
                }
                fetchAndDisplayExams(false, true); // Force refresh
                showToast(result.message, data.id ? 'update' : 'success');
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('A network error occurred.', 'error'); }
    }

    async function handleDeleteConfirm() {
        if (!examIdToDelete) return;
        try {
            const response = await fetch(`${EXAM_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: examIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally {
            closeModal(deleteModal);
            // Cache Invalidation
            if (typeof CacheManager !== 'undefined') {
                CacheManager.clearGroup('dashboard');
                CacheManager.clearGroup('exam');
                CacheManager.clearGroup('custom-exam');
            }
            fetchAndDisplayExams(false, true); // Force refresh
        }
    }

    async function handleListClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const manageQuestionsBtn = e.target.closest('.manage-questions-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`${EXAM_API_URL}?action=get_single&id=${id}`);
                const result = await response.json();
                if (result.success) {
                    const exam = result.data;
                    document.getElementById('exam-modal-title').textContent = 'Edit Exam';
                    document.getElementById('exam-id').value = exam.id;
                    modalSubjectSelector.value = exam.subject_id;
                    await populateLessons(exam.subject_id, modalLessonSelector, exam.lesson_id);
                    await populateTopics(exam.lesson_id, modalTopicSelector, exam.topic_id);
                    document.getElementById('exam-title').value = exam.exam_title;
                    document.getElementById('duration').value = exam.duration;
                    document.getElementById('instructions').value = exam.instructions;
                    document.getElementById('total-marks').value = exam.total_marks;
                    document.getElementById('pass-mark').value = exam.pass_mark;

                    // Set initial metrics for additive updates
                    initialExamMetrics = {
                        duration: parseInt(exam.duration) || 0,
                        totalMarks: parseInt(exam.total_marks) || 0
                    };

                    openModal(examModal);
                }
            } catch (error) { showToast('Failed to fetch exam details.', 'error'); }
        }

        if (deleteBtn) {
            examIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }

        if (manageQuestionsBtn) {
            const id = manageQuestionsBtn.dataset.id;
            const title = manageQuestionsBtn.dataset.title;
            // Use the global loadPage function if available (SPA navigation), otherwise allow standard link behavior or manual redirect
            if (window.loadPage) {
                window.loadPage('questions-list', `?exam_id=${id}&exam_title=${encodeURIComponent(title)}`);
            } else {
                // Fallback for non-SPA context or if loadPage isn't globally available yet
                const url = `?page=questions-list&exam_id=${id}&exam_title=${encodeURIComponent(title)}`;
                window.location.href = url;
            }
        }
    }

    // --- Setup Listeners ---
    createBtn.addEventListener('click', () => {
        document.getElementById('exam-modal-title').textContent = 'Add New Exam';
        examForm.reset();
        document.getElementById('exam-id').value = '';
        document.getElementById('instructions').value = defaultInstructions;
        document.getElementById('duration').value = 10;
        document.getElementById('total-marks').value = 10;
        document.getElementById('pass-mark').value = 10;

        initialExamMetrics = null; // Reset for new exam

        modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
        modalLessonSelector.disabled = true;
        modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
        modalTopicSelector.disabled = true;
        openModal(examModal);
    });

    examForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleListClick);
    cardView.addEventListener('click', handleListClick);
    loadMoreBtn.addEventListener('click', loadMoreExams);

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value, lessonFilter);
        lessonFilter.dispatchEvent(new Event('change')); // Trigger lesson filter change
    });
    lessonFilter.addEventListener('change', () => {
        populateTopics(lessonFilter.value, topicFilter);
        topicFilter.dispatchEvent(new Event('change')); // Trigger topic filter change
    });
    topicFilter.addEventListener('change', () => fetchAndDisplayExams(false));

    // Modal dependent dropdown listeners
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));
    modalLessonSelector.addEventListener('change', () => populateTopics(modalLessonSelector.value, modalTopicSelector));

    // Modal close buttons
    document.getElementById('close-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-exam-delete-btn').addEventListener('click', handleDeleteConfirm);

    // Question Import Handlers
    if (previewQuestionsBtn) {
        previewQuestionsBtn.addEventListener('click', () => {
            const jsonText = modalQuestionsJson.value;
            const result = QuestionUtils.parseQuestionsJSON(jsonText);

            if (result.success) {
                importedQuestions = result.data;
                renderQuestionsPreview();
                updateExamMetrics(importedQuestions.length);
            } else {
                showToast(result.message, 'error');
            }
        });
    }

    if (modalQuestionsJson) {
        modalQuestionsJson.addEventListener('input', () => {
            const jsonText = modalQuestionsJson.value.trim();
            if (!jsonText) {
                importedQuestions = [];
                return;
            }

            const result = QuestionUtils.parseQuestionsJSON(jsonText);
            if (result.success) {
                importedQuestions = result.data;
                updateExamMetrics(importedQuestions.length);
            }
        });
    }

    function renderQuestionsPreview() {
        previewContainer.innerHTML = QuestionUtils.renderPreview(importedQuestions);
        previewContainer.classList.remove('hidden');

        // Add remove handlers
        previewContainer.querySelectorAll('.remove-question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index);
                importedQuestions.splice(index, 1);
                renderQuestionsPreview();
                updateExamMetrics(importedQuestions.length);
                // Update JSON textarea to reflect removal (optional but good for sync)
                modalQuestionsJson.value = JSON.stringify(importedQuestions, null, 2);
            });
        });
    }

    // --- Initial Load ---
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
    fetchAndDisplayExams(false);
}

initializeExamPage();
