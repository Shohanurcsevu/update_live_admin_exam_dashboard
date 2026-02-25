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
    const globalSearch = document.getElementById('global-search');
    const mainClearFiltersBtn = document.getElementById('main-clear-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Bulk Action State
    let selectedExamIds = new Set();
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const bulkSubjectTarget = document.getElementById('bulk-subject-target');
    const bulkLessonTarget = document.getElementById('bulk-lesson-target');
    const bulkTopicTarget = document.getElementById('bulk-topic-target');
    const selectAllExams = document.getElementById('select-all-exams');

    // Modal Selectors
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const modalTopicSelector = document.getElementById('modal-topic-selector');
    const modalQuestionsJson = document.getElementById('modal-questions-json');
    const previewQuestionsBtn = document.getElementById('preview-imported-questions-btn');
    const previewContainer = document.getElementById('imported-questions-preview');

    // Tab Elements
    const tabManual = document.getElementById('tab-manual');
    const tabBulk = document.getElementById('tab-bulk');
    const manualModeContent = document.getElementById('manual-mode-content');
    const bulkModeContent = document.getElementById('bulk-mode-content');

    // Bulk Import Elements
    const bulkManualJsonInput = document.getElementById('bulk-manual-json-input');
    const bulkInitQueueBtn = document.getElementById('bulk-init-queue-btn');
    const bulkCategorizationContainer = document.getElementById('bulk-categorization-container');
    const sectionsContainer = document.getElementById('sections-container');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const bulkResetBtn = document.getElementById('bulk-reset-btn');

    let examIdToDelete = null;
    let subjects = []; // Shared subjects for bulk categorization
    let extractedSections = []; // Queue for bulk import
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
            case 'error': bgColor = 'bg-rose-600'; icon = 'error'; break;
            case 'update': bgColor = 'bg-amber-500'; icon = 'notification_important'; break;
            default: bgColor = 'bg-emerald-600'; icon = 'check_circle'; break;
        }
        // Centered styling for toasts
        toast.className = `flex items-center text-white px-6 py-3 rounded-2xl shadow-2xl mb-3 transform transition-all duration-300 translate-y-[-20px] opacity-0 animate-[fade-in-down_0.3s_forwards] pointer-events-auto ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3 font-bold">${icon}</span> <span class="font-bold tracking-tight">${message}</span>`;
        toastContainer.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Modal Helpers
    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('custom-confirm-modal');
        const content = document.getElementById('modal-content');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);

        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        const close = () => {
            content.classList.add('scale-95', 'opacity-0');
            content.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
        };

        cancelBtn.onclick = close;
        confirmBtn.onclick = () => {
            close();
            onConfirm();
        };
    }

    function switchTab(mode) {
        if (mode === 'manual') {
            tabManual.classList.add('border-blue-600', 'text-blue-600');
            tabManual.classList.remove('border-transparent', 'text-slate-400');
            tabBulk.classList.remove('border-blue-600', 'text-blue-600');
            tabBulk.classList.add('border-transparent', 'text-slate-400');
            manualModeContent.classList.remove('hidden');
            bulkModeContent.classList.add('hidden');
        } else {
            tabBulk.classList.add('border-blue-600', 'text-blue-600');
            tabBulk.classList.remove('border-transparent', 'text-slate-400');
            tabManual.classList.remove('border-blue-600', 'text-blue-600');
            tabManual.classList.add('border-transparent', 'text-slate-400');
            bulkModeContent.classList.remove('hidden');
            manualModeContent.classList.add('hidden');

            // Auto-paste from clipboard if empty and valid JSON found
            if (!bulkManualJsonInput.value.trim() && navigator.clipboard) {
                navigator.clipboard.readText().then(text => {
                    const trimmed = text.trim();
                    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                        try {
                            JSON.parse(trimmed);
                            bulkManualJsonInput.value = trimmed;
                            showToast('Smart-pasted JSON from clipboard!');
                        } catch (e) { }
                    }
                }).catch(err => {
                    console.log('Clipboard access denied or unavailable');
                });
            }
        }
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
                subjects = result; // Store for bulk mode
                selector.innerHTML = selector === subjectFilter ? '<option value="0">All Subjects</option>' : '<option value="">Select Subject</option>';
                result.forEach(subject => {
                    selector.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });

                // Restore main list filters
                if (selector === subjectFilter) {
                    const savedSubject = localStorage.getItem('filter_exam_subject');
                    if (savedSubject && savedSubject !== '0') {
                        subjectFilter.value = savedSubject;
                        const savedLesson = localStorage.getItem('filter_exam_lesson');
                        if (savedLesson && savedLesson !== '0') {
                            populateLessons(savedSubject, lessonFilter, savedLesson);
                        } else {
                            await populateLessons(savedSubject, lessonFilter);
                            fetchAndDisplayExams(false);
                        }
                    } else {
                        fetchAndDisplayExams(false);
                    }
                }
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
                if (lessonToSelect) {
                    selector.value = lessonToSelect;
                    if (selector === lessonFilter) {
                        populateTopics(lessonToSelect, topicFilter, localStorage.getItem('filter_exam_topic'));
                    }
                }
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
                if (topicToSelect) {
                    selector.value = topicToSelect;
                }
                // Refresh list only if this is the main filter and not modal
                if (selector === topicFilter) {
                    fetchAndDisplayExams(false);
                }
            }
        } catch (error) { showToast('Failed to load topics.', 'error'); }
    }

    function highlightText(text, term) {
        if (!term || !text) return text;
        const regex = new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-100 text-yellow-900 font-bold px-0.5 rounded">$1</mark>');
    }

    function getDifficultyBadge(passRate, totalAttempts) {
        if (!totalAttempts || totalAttempts == 0) return `<span class="bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-gray-100">No Data</span>`;

        let colorClass = "";
        let text = "";
        if (passRate >= 80) { colorClass = "bg-emerald-50 text-emerald-600 border-emerald-100"; text = "Easy"; }
        else if (passRate >= 50) { colorClass = "bg-amber-50 text-amber-600 border-amber-100"; text = "Medium"; }
        else { colorClass = "bg-rose-50 text-rose-600 border-rose-100"; text = "Hard"; }

        return `<span class="${colorClass} px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1 w-fit shadow-xs cursor-help" 
                    title="Pass Rate: ${parseFloat(passRate).toFixed(1)}% (${totalAttempts} attempts)">
                    <span class="w-1.5 h-1.5 rounded-full ${colorClass.replace('bg-', 'bg-').split(' ')[1]}"></span>
                    ${text}
                </span>`;
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
        if (globalSearch && globalSearch.value.trim()) params.append('search', globalSearch.value.trim());
        const query = params.toString();
        if (query) url += `&${query}`;

        try {
            const result = await CacheManager.fetchWithCache(url, 2, forceRefresh, false, true);

            if (!append) {
                tableBody.innerHTML = '';
                cardView.innerHTML = '';
            }

            if (result && result.success && result.data.length > 0) {
                const searchTerm = globalSearch ? globalSearch.value.trim() : "";
                result.data.forEach(exam => {
                    const isSelected = selectedExamIds.has(exam.id.toString());
                    // Search Match HTML
                    let matchHtml = "";
                    if (searchTerm && exam.match_type) {
                        const highlightedSnippet = exam.match_text ?
                            `<div class="mt-1 text-[10px] text-gray-400 italic line-clamp-1 border-l-2 border-blue-100 pl-2">
                                ...${highlightText(exam.match_text, searchTerm)}...
                             </div>` : "";

                        matchHtml = `
                            <div class="mt-2 flex flex-col gap-1">
                                <span class="inline-flex items-center w-fit px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-tight border border-blue-100">
                                    <span class="material-symbols-outlined text-[10px] mr-1">info</span>
                                    Matched in ${exam.match_type}
                                </span>
                                ${highlightedSnippet}
                            </div>`;
                    }

                    // Desktop Table Row
                    const row = `
                        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}">
                            <td class="py-4 px-6 text-left">
                                <input type="checkbox" class="exam-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" data-id="${exam.id}" ${isSelected ? 'checked' : ''}>
                            </td>
                            <td class="py-4 px-6 text-left">
                                <span class="font-bold text-gray-900 block" title="${exam.exam_title}">${searchTerm ? highlightText(exam.exam_title, searchTerm) : exam.exam_title}</span>
                                ${matchHtml}
                            </td>
                            <td class="py-4 px-6 text-left">
                                <div class="flex flex-col text-[10px] leading-tight text-gray-500 gap-1">
                                    <div class="flex items-center gap-1">
                                        <span class="bg-blue-100 text-blue-700 font-black px-1 rounded-[4px] scale-90">S</span>
                                        <span class="font-bold text-blue-800 uppercase tracking-tighter">${exam.subject_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="bg-gray-100 text-gray-600 font-black px-1 rounded-[4px] scale-90">L</span>
                                        <span class="truncate max-w-[130px]">${exam.lesson_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="bg-gray-50 text-gray-400 font-black px-1 rounded-[4px] scale-90">T</span>
                                        <span class="italic text-gray-400 truncate max-w-[130px]">${exam.topic_name || 'N/A'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <div class="flex justify-center">${getDifficultyBadge(exam.pass_rate, exam.total_attempts)}</div>
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
                        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}">
                           <div class="absolute top-2 left-2 z-20">
                                <input type="checkbox" class="exam-checkbox w-5 h-5 rounded-full text-blue-600 focus:ring-blue-500 border-gray-300 shadow-sm" data-id="${exam.id}" ${isSelected ? 'checked' : ''}>
                           </div>
                           <div class="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-[60px] flex items-start justify-end p-2 z-0">
                                <span class="material-symbols-outlined text-blue-200/50 text-4xl">assignment</span>
                           </div>
                           <div class="relative z-10">
                                <h3 class="font-black text-gray-900 leading-tight pr-8">${searchTerm ? highlightText(exam.exam_title, searchTerm) : exam.exam_title}</h3>
                                ${matchHtml}
                                <div class="mt-2 flex flex-col gap-1 text-[10px] font-medium text-gray-500">
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-blue-50 text-blue-600 font-black px-1 rounded-sm scale-90">S</span>
                                        <span class="text-blue-600 font-bold uppercase tracking-wider">${exam.subject_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-gray-50 text-gray-400 font-black px-1 rounded-sm scale-90">L</span>
                                        <span class="text-gray-400">${exam.lesson_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-gray-50 text-gray-300 font-black px-1 rounded-sm scale-90">T</span>
                                        <span class="text-gray-400/80 italic">${exam.topic_name || 'N/A'}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 mt-3 flex-wrap">
                                    <span class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none">
                                        <span class="material-symbols-outlined text-sm">schedule</span>
                                        ${exam.duration}m
                                    </span>
                                    <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none shadow-sm">
                                        <span class="material-symbols-outlined text-sm">military_tech</span>
                                        ${exam.total_marks}M
                                    </span>
                                    ${getDifficultyBadge(exam.pass_rate, exam.total_attempts)}
                                </div>
                                <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-50">
                                    <button class="edit-btn w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-all" data-id="${exam.id}" title="Edit">
                                        <span class="material-symbols-outlined text-xl">edit</span>
                                    </button>
                                    <button class="manage-questions-btn w-full bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white py-3 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all" data-id="${exam.id}" data-title="${exam.exam_title}" title="Manage Questions">
                                        <span class="material-symbols-outlined text-xl">quiz</span>
                                    </button>
                                    <button class="delete-btn w-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white py-3 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all" data-id="${exam.id}" title="Delete">
                                        <span class="material-symbols-outlined text-xl">delete</span>
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
            // Reset bulk state
            extractedSections = [];
            if (bulkManualJsonInput) bulkManualJsonInput.value = '';
            if (bulkCategorizationContainer) bulkCategorizationContainer.classList.add('hidden');
            if (sectionsContainer) sectionsContainer.classList.add('hidden');
            if (resultsPlaceholder) resultsPlaceholder.classList.remove('hidden');
        }
    }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(examForm);
        const data = Object.fromEntries(formData.entries());

        // Validating JSON array if textarea has content
        const jsonText = modalQuestionsJson?.value?.trim();
        if (jsonText) {
            const result = QuestionUtils.parseQuestionsJSON(jsonText);
            if (!result.success) {
                showToast(`JSON Error: ${result.message}`, 'error');
                modalQuestionsJson.focus();
                return; // Stop submission
            }
            data.questions = result.data;
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

                // Auto-fill: Save last used values for creation
                if (!data.id) {
                    localStorage.setItem('last_exam_subject_id', data.subject_id);
                    localStorage.setItem('last_exam_lesson_id', data.lesson_id);
                    localStorage.setItem('last_exam_topic_id', data.topic_id);
                }
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
                    switchTab('manual');
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

        if (e.target.classList.contains('exam-checkbox')) {
            toggleSelected(e.target.dataset.id, e.target.checked);
        }
    }

    function toggleSelected(id, isSelected) {
        if (isSelected) {
            selectedExamIds.add(id);
        } else {
            selectedExamIds.delete(id);
        }
        updateBulkBar();
        // Update row/card visual state
        document.querySelectorAll(`.exam-checkbox[data-id="${id}"]`).forEach(cb => {
            cb.checked = isSelected;
            const container = cb.closest('tr') || cb.closest('.group');
            if (container) {
                if (isSelected) {
                    if (container.tagName === 'TR') container.classList.add('bg-blue-50/30');
                    else container.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/10');
                } else {
                    if (container.tagName === 'TR') container.classList.remove('bg-blue-50/30');
                    else container.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/10');
                }
            }
        });
    }

    function updateBulkBar() {
        if (selectedExamIds.size > 0) {
            bulkActionBar.classList.remove('hidden');
            selectedCountEl.textContent = selectedExamIds.size;
            // Lazy load subjects for bulk re-categorization dropdown
            if (bulkSubjectTarget.options.length <= 1) {
                populateSubjects(bulkSubjectTarget);
            }
        } else {
            bulkActionBar.classList.add('hidden');
            if (selectAllExams) selectAllExams.checked = false;
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
        extractedSections = []; // Clear bulk queue
        bulkManualJsonInput.value = '';
        renderSections();
        renderBulkTable();
        switchTab('manual'); // Default to manual for New/Edit

        modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
        modalTopicSelector.disabled = true;

        // Auto-fill filters from localStorage
        const lastSubjectId = localStorage.getItem('last_exam_subject_id');
        const lastLessonId = localStorage.getItem('last_exam_lesson_id');
        const lastTopicId = localStorage.getItem('last_exam_topic_id');

        if (lastSubjectId) {
            modalSubjectSelector.value = lastSubjectId;
            populateLessons(lastSubjectId, modalLessonSelector, lastLessonId).then(() => {
                if (lastLessonId) {
                    populateTopics(lastLessonId, modalTopicSelector, lastTopicId);
                }
            });
        }

        openModal(examModal);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            modalSubjectSelector.value = "";
            modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
            modalLessonSelector.disabled = true;
            modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
            modalTopicSelector.disabled = true;

            // Clear localStorage values
            localStorage.removeItem('last_exam_subject_id');
            localStorage.removeItem('last_exam_lesson_id');
            localStorage.removeItem('last_exam_topic_id');
        });
    }

    examForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleListClick);
    cardView.addEventListener('click', handleListClick);
    loadMoreBtn.addEventListener('click', loadMoreExams);

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_subject', subjectFilter.value);
        localStorage.removeItem('filter_exam_lesson');
        localStorage.removeItem('filter_exam_topic');
        populateLessons(subjectFilter.value, lessonFilter);
        lessonFilter.dispatchEvent(new Event('change')); // Trigger lesson filter change
    });
    lessonFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_lesson', lessonFilter.value);
        localStorage.removeItem('filter_exam_topic');
        populateTopics(lessonFilter.value, topicFilter);
        topicFilter.dispatchEvent(new Event('change')); // Trigger topic filter change
    });
    topicFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_topic', topicFilter.value);
        fetchAndDisplayExams(false);
    });

    if (mainClearFiltersBtn) {
        mainClearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_exam_subject');
            localStorage.removeItem('filter_exam_lesson');
            localStorage.removeItem('filter_exam_topic');

            subjectFilter.value = "0";
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;

            if (globalSearch) globalSearch.value = "";

            fetchAndDisplayExams(false);
        });
    }

    // Modal dependent dropdown listeners
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));
    modalLessonSelector.addEventListener('change', () => populateTopics(modalLessonSelector.value, modalTopicSelector));

    // Global Search Debouncing
    let searchTimeout;
    if (globalSearch) {
        globalSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentOffset = 0; // Reset pagination on search
                fetchAndDisplayExams(false);
            }, 500);
        });
    }

    // Bulk Action Listeners
    if (selectAllExams) {
        selectAllExams.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.exam-checkbox');
            checkboxes.forEach(cb => toggleSelected(cb.dataset.id, selectAllExams.checked));
        });
    }

    if (bulkSubjectTarget) {
        bulkSubjectTarget.addEventListener('change', () => populateLessons(bulkSubjectTarget.value, bulkLessonTarget));
        bulkLessonTarget.addEventListener('change', () => populateTopics(bulkLessonTarget.value, bulkTopicTarget));
    }

    document.getElementById('cancel-bulk-btn').addEventListener('click', () => {
        selectedExamIds.clear();
        document.querySelectorAll('.exam-checkbox').forEach(cb => toggleSelected(cb.dataset.id, false));
    });

    document.getElementById('apply-bulk-btn').addEventListener('click', async () => {
        const subjectId = bulkSubjectTarget.value;
        const lessonId = bulkLessonTarget.value;
        const topicId = bulkTopicTarget.value;

        if (!subjectId || !lessonId || !topicId) {
            showToast('Please select all target categories.', 'error');
            return;
        }

        try {
            const response = await fetch(`${EXAM_API_URL}?action=bulk_update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedExamIds),
                    subject_id: subjectId,
                    lesson_id: lessonId,
                    topic_id: topicId
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast(result.message);
                selectedExamIds.clear();
                updateBulkBar();
                fetchAndDisplayExams(false, true); // Refresh and bypass cache
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Bulk update failed.', 'error');
        }
    });

    // Modal close buttons
    document.getElementById('close-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-exam-delete-btn').addEventListener('click', handleDeleteConfirm);

    // Tab Listeners
    tabManual.onclick = () => switchTab('manual');
    tabBulk.onclick = () => switchTab('bulk');

    // Bulk Import Listeners
    function handleBulkJSON(json) {
        if (!json) return;
        try {
            const data = JSON.parse(json);
            const arrayData = Array.isArray(data) ? data : [data];

            extractedSections = arrayData.map(item => ({
                title: item["Exam Title"] || item["title"] || "Untitled Exam",
                questions: (item.data || item.questions || []).map(q => ({
                    ...q,
                    priority: parseInt(q.priority) || 0
                })),
                target: { subject: 0, lesson: 0, topic: 0 },
                isExcluded: false
            })).filter(s => s.questions.length > 0);

            if (!extractedSections.length) throw new Error("No valid exams/questions found.");

            renderBulkTable();
            renderSections();
            showToast(`Queue Initialized: ${extractedSections.length} Exams detected.`);
            bulkManualJsonInput.value = ''; // Clear after successful parse
        } catch (e) {
            // Only show toast if it was a manual button click OR if the paste was clearly intended to be JSON
            if (json.trim().startsWith('[') || json.trim().startsWith('{')) {
                showToast(`JSON Error: ${e.message}`, 'error');
            }
        }
    }

    bulkInitQueueBtn.onclick = () => {
        handleBulkJSON(bulkManualJsonInput.value.trim());
    };

    bulkManualJsonInput.addEventListener('paste', (e) => {
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        if (pastedData) {
            try {
                const trimmed = pastedData.trim();
                if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                    JSON.parse(trimmed); // Validate
                    showToast('Valid JSON detected! Click "Init Import Queue" to proceed.');
                }
            } catch (err) {
                // Not valid JSON or parsing error, do nothing (normal paste)
            }
        }
    });

    // Reset Bulk Import
    bulkResetBtn.onclick = () => {
        showConfirmModal(
            'Confirm Reset',
            'This will clear all pasted JSON and all exams in the current queue. Are you sure?',
            () => {
                bulkManualJsonInput.value = '';
                extractedSections = [];
                renderSections();
                renderBulkTable();
                showToast('Bulk queue cleared.');
            }
        );
    };

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

    // --- Bulk Import Logic ---

    function renderBulkTable() {
        if (!extractedSections.length) {
            bulkCategorizationContainer.innerHTML = '';
            bulkCategorizationContainer.classList.add('hidden');
            return;
        }

        bulkCategorizationContainer.classList.remove('hidden');
        bulkCategorizationContainer.innerHTML = `
            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-slate-800">Bulk Categorization</h3>
                        <p class="text-slate-400 text-sm font-medium">Map all exams and import at once</p>
                    </div>
                </div>
                
                <div class="hidden md:grid md:grid-cols-[45px_1.5fr_1.2fr_1.5fr_1.5fr_50px] gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div class="text-center">Incl.</div>
                    <div>Exam Title</div>
                    <div>Subject</div>
                    <div>Lesson</div>
                    <div>Topic</div>
                    <div class="text-center">Same</div>
                </div>

                <div class="divide-y divide-slate-100" id="bulk-table-body">
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-center sm:justify-end">
                    <button id="import-all-btn" class="w-full sm:w-auto px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 transform active:scale-95">
                        <span class="material-symbols-outlined text-lg">rocket_launch</span> Import All Exams
                    </button>
                </div>
            </div>
        `;

        const body = document.getElementById('bulk-table-body');
        extractedSections.forEach((section, i) => {
            const row = document.createElement('div');
            row.className = `p-4 md:p-6 md:grid md:grid-cols-[45px_1.5fr_1.2fr_1.5fr_1.5fr_50px] gap-4 transition-all ${section.isExcluded ? 'bg-slate-50/50 grayscale opacity-60' : 'hover:bg-slate-50'}`;

            row.innerHTML = `
                <div class="flex items-center justify-between mb-4 md:mb-0 md:justify-center">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="exclude-check w-6 h-6 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer" ${!section.isExcluded ? 'checked' : ''}>
                        <span class="md:hidden text-xs font-bold text-slate-500">Include in Import</span>
                    </div>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Exam Title</span>
                    <div class="flex items-center gap-2">
                        <input type="text" class="bulk-title-input w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm" value="${section.title}">
                        <span class="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-[9px] font-black uppercase whitespace-nowrap shadow-sm">
                            ${section.questions.length} QS
                        </span>
                    </div>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</span>
                    <select class="bulk-subject-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded ? 'disabled' : ''}>
                        <option value="0">Select Subject</option>
                        ${subjects.map(s => `<option value="${s.id}" ${section.target.subject == s.id ? 'selected' : ''}>${s.subject_name}</option>`).join('')}
                    </select>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lesson</span>
                    <select class="bulk-lesson-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded || !section.target.subject ? 'disabled' : ''}>
                        <option value="0">Select Lesson</option>
                    </select>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Topic</span>
                    <select class="bulk-topic-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded || !section.target.lesson ? 'disabled' : ''}>
                        <option value="0">Select Topic</option>
                    </select>
                </div>

                <div class="flex items-center justify-center md:pb-0 pb-2">
                    ${i > 0 && !section.isExcluded ? `
                        <button class="check-same-btn w-full md:w-10 h-11 md:h-10 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all flex items-center justify-center gap-2" data-idx="${i}" title="Same Above">
                            <span class="material-symbols-outlined text-sm">double_arrow</span>
                            <span class="md:hidden text-xs font-bold">Same as Above</span>
                        </button>
                    ` : ''}
                </div>
            `;

            // Listeners for this row
            const excludeCheck = row.querySelector('.exclude-check');
            excludeCheck.onchange = () => {
                section.isExcluded = !excludeCheck.checked;
                renderBulkTable();
                renderSections();
            };

            const subSel = row.querySelector('.bulk-subject-select');
            const lesSel = row.querySelector('.bulk-lesson-select');
            const topSel = row.querySelector('.bulk-topic-select');

            const titleInput = row.querySelector('.bulk-title-input');

            if (section.target.subject > 0) {
                populateLessons(section.target.subject, lesSel, section.target.lesson || 0).then(() => {
                    if (section.target.lesson > 0) {
                        populateTopics(section.target.lesson, topSel, section.target.topic || 0);
                    }
                });
            }

            titleInput.oninput = () => {
                section.title = titleInput.value;
                // Sync the detail section title without full re-render
                const detailTitle = document.querySelector(`.detail-exam-title[data-idx="${i}"]`);
                if (detailTitle) detailTitle.textContent = titleInput.value;
            };

            subSel.onchange = () => {
                section.target.subject = subSel.value;
                section.target.lesson = 0;
                section.target.topic = 0;
                renderBulkTable();
            };
            lesSel.onchange = () => {
                section.target.lesson = lesSel.value;
                section.target.topic = 0;
                renderBulkTable();
            };
            topSel.onchange = () => {
                section.target.topic = topSel.value;
            };

            if (i > 0) {
                const sameBtn = row.querySelector('.check-same-btn');
                if (sameBtn) {
                    sameBtn.onclick = () => {
                        const prev = extractedSections[i - 1];
                        section.target = { ...prev.target };
                        renderBulkTable();
                    };
                }
            }

            body.appendChild(row);
        });

        document.getElementById('import-all-btn').onclick = processImportAll;
    }

    function renderSections() {
        sectionsContainer.innerHTML = '';
        if (!extractedSections.length) {
            sectionsContainer.classList.add('hidden');
            resultsPlaceholder.classList.remove('hidden');
            return;
        }

        sectionsContainer.classList.remove('hidden');
        resultsPlaceholder.classList.add('hidden');

        extractedSections.forEach((section, i) => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden mb-8';
            sectionEl.innerHTML = `
                <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">
                            ${i + 1}
                        </div>
                        <h3 class="detail-exam-title text-xl font-black text-slate-800 outline-none focus:text-blue-600 transition-colors" contenteditable="true" data-idx="${i}">${section.title}</h3>
                    </div>
                </div>
                <div class="p-6 space-y-4">
                    ${section.questions.map((q, qIdx) => {
                const prioColors = {
                    0: 'bg-blue-50 text-blue-600 border-blue-100',
                    1: 'bg-slate-50 text-slate-500 border-slate-200',
                    2: 'bg-amber-50 text-amber-600 border-amber-100',
                    3: 'bg-rose-50 text-rose-600 border-rose-100'
                };
                const prioColor = prioColors[q.priority] || prioColors[0];
                return `
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative transition-all hover:bg-white hover:shadow-md">
                            <div class="flex flex-col gap-4">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-3">
                                            <span class="text-[10px] font-black text-slate-300 uppercase">#${qIdx + 1}</span>
                                            <select class="priority-select text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all ${prioColor}" data-sec-idx="${i}" data-q-idx="${qIdx}">
                                                <option value="0" ${q.priority == 0 ? 'selected' : ''}>Standard</option>
                                                <option value="1" ${q.priority == 1 ? 'selected' : ''}>🔵 Low</option>
                                                <option value="2" ${q.priority == 2 ? 'selected' : ''}>🟡 Medium</option>
                                                <option value="3" ${q.priority == 3 ? 'selected' : ''}>🔴 High</option>
                                            </select>
                                        </div>
                                        <p contenteditable="true" class="edit-field font-bold text-slate-800 text-sm mb-4 outline-none focus:text-blue-600 transition-colors" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="question">${q.question}</p>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                                            ${['A', 'B', 'C', 'D'].map(opt => `
                                                <div class="flex items-center gap-3 p-1 rounded-lg border ${q.answer === opt ? 'bg-emerald-50 border-emerald-100' : 'border-transparent'} hover:border-slate-100 focus-within:border-blue-100 transition-all">
                                                    <span class="answer-toggle cursor-pointer hover:underline ${q.answer === opt ? 'text-emerald-600 font-black' : 'text-slate-400 font-bold'}" data-sec-idx="${i}" data-q-idx="${qIdx}" data-opt="${opt}" title="Set as correct answer">${opt}:</span>
                                                    <span contenteditable="true" class="edit-field flex-1 outline-none text-slate-600 ${q.answer === opt ? 'font-medium' : ''}" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="options" data-opt="${opt}">${q.options[opt]}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="group/exp relative">
                                            <div contenteditable="true" class="edit-field text-[10px] bg-white p-3 rounded-xl text-slate-500 font-medium italic border border-slate-100 outline-none focus:border-blue-200" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="explanation">
                                                ${q.explanation || 'No explanation provided.'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-2 md:opacity-0 group-hover:opacity-100 transition-all">
                                        <button class="delete-q p-3 md:p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" data-sec-idx="${i}" data-q-idx="${qIdx}">
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('')}
                </div>
            `;

            const detailTitle = sectionEl.querySelector('.detail-exam-title');
            detailTitle.onblur = () => {
                section.title = detailTitle.textContent.trim();
                // Sync the table input without full re-render
                const tableInput = document.querySelectorAll('.bulk-title-input')[i];
                if (tableInput) tableInput.value = detailTitle.textContent.trim();
            };

            sectionsContainer.appendChild(sectionEl);
        });

        // Event Listeners for editing
        document.querySelectorAll('.edit-field').forEach(field => {
            field.onblur = () => {
                const { secIdx, qIdx, field: fieldName, opt } = field.dataset;
                const value = field.innerText.trim();
                if (fieldName === 'options') extractedSections[secIdx].questions[qIdx].options[opt] = value;
                else extractedSections[secIdx].questions[qIdx][fieldName] = value;
            };
        });

        document.querySelectorAll('.priority-select').forEach(sel => {
            sel.onchange = () => {
                extractedSections[sel.dataset.secIdx].questions[sel.dataset.qIdx].priority = parseInt(sel.value);
                renderSections();
            };
        });

        document.querySelectorAll('.delete-q').forEach(btn => {
            btn.onclick = () => {
                extractedSections[btn.dataset.secIdx].questions.splice(btn.dataset.qIdx, 1);
                renderSections();
                renderBulkTable();
            };
        });

        document.querySelectorAll('.answer-toggle').forEach(btn => {
            btn.onclick = () => {
                const { secIdx, qIdx, opt } = btn.dataset;
                extractedSections[secIdx].questions[qIdx].answer = opt;
                renderSections();
            };
        });
    }

    async function processImportAll() {
        const activeSections = extractedSections.filter(s => !s.isExcluded && s.target.subject > 0 && s.target.lesson > 0 && s.target.topic > 0);

        if (!activeSections.length) {
            showToast('No fully categorized exams to import.', 'error');
            return;
        }

        const skippedCount = extractedSections.length - activeSections.length;
        const skipText = skippedCount > 0 ? ` (${skippedCount} will be skipped)` : '';

        showConfirmModal('Confirm Bulk Import', `Are you sure you want to import ${activeSections.length} exams?${skipText} Only exams with complete categorization (Subject, Lesson, Topic) will be processed.`, async () => {
            const btn = document.getElementById('import-all-btn');
            const original = btn.innerHTML;
            btn.disabled = true;

            let success = 0, fail = 0;
            // Iterate over a copy of sections that are ready to import
            const toImport = [...activeSections];

            for (const section of toImport) {
                const currentIdx = extractedSections.indexOf(section);
                if (currentIdx === -1) continue;

                btn.innerHTML = `<span class="animate-spin text-sm">sync</span> ${success + fail + 1}/${activeSections.length}`;

                try {
                    await executeImportFlow(currentIdx);
                    success++;
                } catch (e) {
                    fail++;
                    console.error('Bulk item failed', e);
                }
            }

            btn.disabled = false;
            btn.innerHTML = original;
            showToast(`Import Complete: ${success} Success, ${fail} Failed`);

            if (success > 0) {
                fetchAndDisplayExams(false, true);
                if (typeof CacheManager !== 'undefined') CacheManager.clearGroup('exam');
            }

            // Close if we had successes and no errors during this batch
            if (success > 0 && fail === 0) {
                closeModal(examModal);
            } else {
                renderSections();
                renderBulkTable();
                if (fail > 0) showToast(`${fail} items failed to import. Check console for details.`, 'error');
            }
        });
    }

    async function executeImportFlow(idx) {
        const section = extractedSections[idx];
        const qCount = section.questions.length;
        const examResp = await fetch(`${EXAM_API_URL}?action=create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_title: section.title,
                subject_id: section.target.subject,
                lesson_id: section.target.lesson,
                topic_id: section.target.topic,
                duration: qCount,
                instructions: defaultInstructions,
                total_marks: qCount,
                pass_mark: (qCount * 0.99).toFixed(2)
            })
        });
        const examRes = await examResp.json();
        if (!examRes.success) throw new Error(examRes.message);

        const importResp = await fetch('api/question/import.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_id: examRes.id,
                questions: section.questions
            })
        });
        const importRes = await importResp.json();
        if (!importRes.success) throw new Error(importRes.message);

        extractedSections.splice(idx, 1);
        return true;
    }

    // --- Initial Load ---
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
}

initializeExamPage();
