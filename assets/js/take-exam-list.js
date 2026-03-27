function initializeTakeExamListPage() {
    const API_URL = 'api/take-exam/';
    const tableBody = document.getElementById('exams-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');
    const cardView = document.getElementById('exams-card-view');
    const bulkTagActions = document.getElementById('bulk-tag-actions');
    const bulkTagTodayBtn = document.getElementById('bulk-tag-today-btn');
    const bulkTagTomorrowBtn = document.getElementById('bulk-tag-tomorrow-btn');
    
    let currentExamIds = [];

    const cache = new Map();
    
    let currentPage = 1;
    const itemsPerPage = 20;
    let isFetching = false;
    
    // Helper to get local date string YYYY-MM-DD
    const getLocalDateStr = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayDateStr = getLocalDateStr();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = getLocalDateStr(tomorrow);
    let currentPriorityDistribution = { "0": 0, "1": 0, "2": 0, "3": 0 };

    // --- Toast Function ---
    function showToast(message, type = 'error') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'success': bgColor = 'bg-green-500'; icon = 'check_circle'; break;
            default: bgColor = 'bg-red-500'; icon = 'error'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    // --- Dropdown Population Logic ---
    async function populateSubjects() {
        try {
            const response = await fetch(`${API_URL}subjects.php`);
            const result = await response.json();
            if (result.success) {
                subjectFilter.innerHTML = '<option value="0">All Subjects</option>';
                result.data.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });

                // Restore from URL params first, then localStorage
                const urlParams = new URLSearchParams(window.location.search);
                const urlSubject = urlParams.get('subject_id');
                const urlLesson = urlParams.get('lesson_id');
                const savedSubject = localStorage.getItem('filter_take_exam_subject');

                if (urlSubject) {
                    subjectFilter.value = urlSubject;
                    populateLessons(urlSubject, urlLesson);
                } else if (savedSubject && savedSubject !== '0') {
                    subjectFilter.value = savedSubject;
                    populateLessons(savedSubject);
                } else {
                    fetchAndDisplayExams();
                }
            }
        } catch (error) { showToast('Failed to load subjects.'); }
    }

    async function populateLessons(subjectId, targetLessonId = null) {
        // Reset and disable lesson and topic filters
        lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
        lessonFilter.disabled = true;
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;

        if (!subjectId || subjectId === '0') {
            fetchAndDisplayExams(); // Refresh exams if "All Subjects" is selected
            return;
        }

        lessonFilter.innerHTML = '<option value="">Loading...</option>';

        try {
            const response = await fetch(`${API_URL}lessons.php?subject_id=${subjectId}`);
            const result = await response.json();
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            if (result.success && result.data.length > 0) {
                result.data.forEach(lesson => {
                    lessonFilter.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                lessonFilter.disabled = false;

                // Restore from Target (URL) or localStorage
                const savedLesson = localStorage.getItem('filter_take_exam_lesson');
                if (targetLessonId) {
                    lessonFilter.value = targetLessonId;
                    populateTopics(targetLessonId);
                } else if (savedLesson && savedLesson !== '0') {
                    lessonFilter.value = savedLesson;
                    populateTopics(savedLesson);
                }
            }
        } catch (error) { showToast('Failed to load lessons.'); }
        finally {
            currentPage = 1; // Reset to page 1 on filter change
            fetchAndDisplayExams(false);
        }
    }

    async function populateTopics(lessonId) {
        // Reset and disable topic filter
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;

        if (!lessonId || lessonId === '0') {
            fetchAndDisplayExams();
            return;
        }

        topicFilter.innerHTML = '<option value="">Loading...</option>';

        try {
            const response = await fetch(`${API_URL}topics.php?lesson_id=${lessonId}`);
            const result = await response.json();
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            if (result.success && result.data.length > 0) {
                result.data.forEach(topic => {
                    topicFilter.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                topicFilter.disabled = false;

                // Restore from localStorage
                const savedTopic = localStorage.getItem('filter_take_exam_topic');
                if (savedTopic && savedTopic !== '0') {
                    topicFilter.value = savedTopic;
                }
            }
        } catch (error) { showToast('Failed to load topics.'); }
        finally {
            currentPage = 1;
            fetchAndDisplayExams(false);
        }
    }

    // --- Exam Table Logic ---
    async function fetchAndDisplayExams(append = false) {
        if (isFetching) return;
        isFetching = true;

        if (!append) {
            currentPage = 1;
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-8"><span class="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span><p class="mt-2 text-gray-500">Loading exams...</p></td></tr>';
            cardView.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-blue-500"><span class="material-symbols-outlined animate-spin text-5xl">sync</span><p class="mt-4 text-gray-600 font-medium">Loading exams...</p></div>';
            loadMoreBtn.classList.add('hidden');
        }

        let url = `${API_URL}exams.php?page=${currentPage}&limit=${itemsPerPage}&`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        url += params.toString();

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!append) {
                tableBody.innerHTML = '';
                cardView.innerHTML = '';
                currentExamIds = [];
            }
            
            const isFiltering = subjectFilter.value > 0 || lessonFilter.value > 0 || topicFilter.value > 0;

            if (result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    // Prepare Status & Score Badges
                    const isTaken = exam.attempt_count && exam.attempt_count > 0;
                    const statusBadge = isTaken
                        ? `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Taken</span>`
                        : `<span class="bg-gray-100 text-gray-400 px-2 py-1 rounded text-[10px] font-bold uppercase">New</span>`;

                    const scoreDisplay = exam.last_score !== null
                        ? `<div class="text-xs font-bold text-indigo-600 mt-0.5">${parseFloat(exam.last_score).toFixed(1)} / ${exam.total_marks}</div>`
                        : `<div class="text-xs text-gray-400 mt-0.5">--</div>`;

                    // Desktop Table Row
                    let rowClass = 'hover:bg-indigo-50/50';
                    if (exam.last_revision_date === todayDateStr) rowClass = 'bg-indigo-50/70 hover:bg-indigo-100/70';
                    else if (exam.last_revision_date === tomorrowDateStr) rowClass = 'bg-teal-50/70 hover:bg-teal-100/70';

                    const row = `
                        <tr class="border-b border-gray-100 ${rowClass} transition-colors">
                            <td class="py-3 px-6 text-left font-semibold text-gray-800">
                                <div class="flex items-center gap-2">
                                    ${exam.exam_title}
                                    ${parseInt(exam.revision_count) > 0 ? `<span class="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-extrabold border border-purple-200" title="Revised ${exam.revision_count} times">${exam.revision_count}x</span>` : ''}
                                    ${exam.last_revision_date === todayDateStr ? '<span class="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-tighter">Revised</span>' : ''}
                                    ${exam.last_revision_date === tomorrowDateStr ? '<span class="px-1.5 py-0.5 bg-teal-600 text-white rounded text-[9px] font-black uppercase tracking-tighter">Planned</span>' : ''}
                                </div>
                            </td>
                            <td class="py-3 px-6 text-left text-gray-600">${exam.topic_name || 'N/A'}</td>
                            <td class="py-3 px-6 text-center">
                                <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">${exam.duration} min</span>
                            </td>
                            <td class="py-3 px-6 text-center">
                                <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">${exam.total_questions} Qs</span>
                            </td>
                            <td class="py-3 px-6 text-center">
                                ${statusBadge}
                                ${scoreDisplay}
                            </td>
                            <td class="py-3 px-6 text-center">
                                 <div class="flex items-center justify-center gap-2">
                                     <button class="take-exam-btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95" 
                                        data-id="${exam.id}" 
                                        data-title="${exam.exam_title}" 
                                        data-duration="${exam.duration}" 
                                        data-questions="${exam.total_questions}"
                                        data-instructions="${exam.instructions || ''}"
                                        data-last-score="${exam.last_score || 0}"
                                        data-last-percentage="${exam.last_percentage || 0}"
                                        data-attempt-count="${exam.attempt_count || 0}"
                                        data-total-marks="${exam.total_marks || 0}">Take</button>
                                     <button class="study-exam-btn border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" title="Study Materials">
                                        <span class="material-symbols-outlined text-sm">menu_book</span>
                                     </button>
                                     <button class="tag-revision-btn ${exam.last_revision_date === todayDateStr ? 'bg-indigo-600 text-white border-indigo-600' : 'border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'} text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" data-target="today" title="${exam.last_revision_date === todayDateStr ? 'Already tagged for today' : 'Add to Today\'s Revision'}">
                                         <span class="material-symbols-outlined text-sm">${exam.last_revision_date === todayDateStr ? 'event_available' : 'event_repeat'}</span>
                                     </button>
                                     <button class="tag-revision-btn ${exam.last_revision_date === tomorrowDateStr ? 'bg-teal-600 text-white border-teal-600' : 'border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white'} text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" data-target="tomorrow" title="${exam.last_revision_date === tomorrowDateStr ? 'Planned for tomorrow' : 'Plan for Tomorrow'}">
                                         <span class="material-symbols-outlined text-sm">${exam.last_revision_date === tomorrowDateStr ? 'done_all' : 'next_plan'}</span>
                                     </button>
                                     <button class="print-exam-btn border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" data-questions="${exam.total_questions}" title="Print">
                                         <span class="material-symbols-outlined text-sm">print</span>
                                     </button>
                                     <button class="delete-exam-btn bg-red-100 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" title="Delete">
                                         <span class="material-symbols-outlined text-sm">delete</span>
                                     </button>
                                 </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                    currentExamIds.push(exam.id); // Track visible IDs for bulk actions

                    // Mobile Card
                    let cardClass = 'bg-white border-gray-100';
                    if (exam.last_revision_date === todayDateStr) cardClass = 'bg-indigo-50/50 border-indigo-200';
                    else if (exam.last_revision_date === tomorrowDateStr) cardClass = 'bg-teal-50/50 border-teal-200';

                    const card = `
                        <div class="${cardClass} p-4 rounded-2xl border shadow-sm space-y-3 relative overflow-hidden">
                            ${isTaken ? `<div class="absolute top-0 right-0 px-3 py-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-tighter rounded-bl-xl shadow-sm">Taken (${exam.attempt_count})</div>` : ''}
                            <div>
                                <h3 class="font-bold text-gray-900 leading-tight pr-12 flex items-center gap-2">
                                    ${exam.exam_title}
                                    ${parseInt(exam.revision_count) > 0 ? `<span class="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-extrabold border border-purple-200" title="Revised ${exam.revision_count} times">${exam.revision_count}x</span>` : ''}
                                    ${exam.last_revision_date === todayDateStr ? '<span class="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-tighter">Revised</span>' : ''}
                                    ${exam.last_revision_date === tomorrowDateStr ? '<span class="px-1.5 py-0.5 bg-teal-600 text-white rounded text-[8px] font-black uppercase tracking-tighter">Planned</span>' : ''}
                                </h3>
                                <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">label</span>
                                    ${exam.topic_name || 'N/A'}
                                </p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">schedule</span>
                                    ${exam.duration}m
                                </span>
                                <span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">quiz</span>
                                    ${exam.total_questions}Q
                                </span>
                                ${isTaken ? `
                                <span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">grade</span>
                                    ${parseFloat(exam.last_percentage).toFixed(0)}%
                                </span>` : ''}
                            </div>
                            <div class="grid grid-cols-2 gap-2 pt-2">
                                <button class="take-exam-btn w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1 col-span-2" 
                                    data-id="${exam.id}" 
                                    data-title="${exam.exam_title}" 
                                    data-duration="${exam.duration}" 
                                    data-questions="${exam.total_questions}"
                                    data-instructions="${exam.instructions || ''}"
                                    data-last-score="${exam.last_score || 0}"
                                    data-last-percentage="${exam.last_percentage || 0}"
                                    data-attempt-count="${exam.attempt_count || 0}"
                                    data-total-marks="${exam.total_marks || 0}">
                                    <span class="material-symbols-outlined text-sm">play_arrow</span> Take Exam
                                </button>
                                <button class="study-exam-btn border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white text-[10px] font-black tracking-widest uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all" data-id="${exam.id}">
                                    <span class="material-symbols-outlined text-sm">menu_book</span> Study
                                </button>
                                <button class="print-exam-btn border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white text-[10px] font-black tracking-widest uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all" data-id="${exam.id}" data-questions="${exam.total_questions}">
                                     <span class="material-symbols-outlined text-sm">print</span> Print
                                </button>
                                <button class="tag-revision-btn ${exam.last_revision_date === todayDateStr ? 'bg-indigo-600 text-white border-indigo-600' : 'border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'} text-[10px] font-black tracking-widest uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95" data-id="${exam.id}" data-target="today">
                                    <span class="material-symbols-outlined text-sm">${exam.last_revision_date === todayDateStr ? 'event_available' : 'event_repeat'}</span>
                                    <span>${exam.last_revision_date === todayDateStr ? 'Added' : 'Today'}</span>
                                </button>
                                <button class="tag-revision-btn ${exam.last_revision_date === tomorrowDateStr ? 'bg-teal-600 text-white border-teal-600' : 'border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white'} text-[10px] font-black tracking-widest uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95" data-id="${exam.id}" data-target="tomorrow">
                                    <span class="material-symbols-outlined text-sm">${exam.last_revision_date === tomorrowDateStr ? 'done_all' : 'next_plan'}</span>
                                    <span>${exam.last_revision_date === tomorrowDateStr ? 'Planned' : 'Tomorrow'}</span>
                                </button>
                                <button class="delete-exam-btn col-span-2 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white text-[10px] font-black tracking-widest uppercase py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all mt-1" data-id="${exam.id}">
                                    <span class="material-symbols-outlined text-sm">delete</span> Delete Exam
                                </button>
                            </div>
                            <div class="flex flex-wrap gap-2 mt-2">
                            ${(exam.last_revision_date === todayDateStr) ? `
                                <div class="flex items-center bg-indigo-100 text-indigo-700 rounded border border-indigo-200 overflow-hidden">
                                    <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Revised Today</span>
                                    <button class="untag-revision-btn px-1.5 py-0.5 bg-indigo-200 hover:bg-indigo-300 text-indigo-800 border-l border-indigo-300 transition-colors" data-id="${exam.id}" data-target="today" title="Remove Tag">
                                        <span class="material-symbols-outlined text-xs leading-none">close</span>
                                    </button>
                                </div>
                            ` : ''}
                            ${(exam.last_revision_date === tomorrowDateStr) ? `
                                <div class="flex items-center bg-teal-100 text-teal-700 rounded border border-teal-200 overflow-hidden">
                                    <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Planned for Tomorrow</span>
                                    <button class="untag-revision-btn px-1.5 py-0.5 bg-teal-200 hover:bg-teal-300 text-teal-800 border-l border-teal-300 transition-colors" data-id="${exam.id}" data-target="tomorrow" title="Remove Tag">
                                        <span class="material-symbols-outlined text-xs leading-none">close</span>
                                    </button>
                                </div>
                            ` : ''}</div>
                        </div>`;
                    cardView.innerHTML += card;
                });

                // Update Pagination UI
                const totalLoaded = tableBody.querySelectorAll('tr').length;
                currentCountEl.textContent = totalLoaded;
                totalCountEl.textContent = result.pagination.total;

                if (result.pagination.has_more) {
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.classList.add('hidden');
                }

                // Show bulk tagging buttons only if filtering and we have results
                if (isFiltering && currentExamIds.length > 0) {
                    bulkTagActions.classList.remove('hidden');
                } else {
                    bulkTagActions.classList.add('hidden');
                }
            } else if (!append) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-medium">No exams found for the selected filters.</td></tr>`;
                cardView.innerHTML = `<div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-12 px-6 text-center text-gray-400 font-medium">No exams found for selection.</div>`;
                currentCountEl.textContent = 0;
                totalCountEl.textContent = 0;
            }
        } catch (error) {
            showToast('Failed to load exams.');
        } finally {
            isFetching = false;
        }
    }

    // --- Event Listeners ---
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_subject', subjectFilter.value);
        localStorage.removeItem('filter_take_exam_lesson');
        localStorage.removeItem('filter_take_exam_topic');
        populateLessons(subjectFilter.value);
    });

    lessonFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_lesson', lessonFilter.value);
        localStorage.removeItem('filter_take_exam_topic');
        populateTopics(lessonFilter.value);
    });

    topicFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_topic', topicFilter.value);
        fetchAndDisplayExams(false);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_take_exam_subject');
            localStorage.removeItem('filter_take_exam_lesson');
            localStorage.removeItem('filter_take_exam_topic');

            subjectFilter.value = '0';
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;

            fetchAndDisplayExams(false);
        });
    }

    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        fetchAndDisplayExams(true);
    });

    if (bulkTagTodayBtn) {
        bulkTagTodayBtn.addEventListener('click', () => bulkTagExams('today'));
    }
    if (bulkTagTomorrowBtn) {
        bulkTagTomorrowBtn.addEventListener('click', () => bulkTagExams('tomorrow'));
    }

    async function bulkTagExams(target) {
        if (!currentExamIds.length) return;
        
        const btn = target === 'today' ? bulkTagTodayBtn : bulkTagTomorrowBtn;
        const originalHtml = btn.innerHTML;
        const actionText = target === 'today' ? 'Today' : 'Tomorrow';
        
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span> Processing...`;
        
        try {
            const response = await fetch('api/exam/exam.php?action=bulk_mark_revised', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: currentExamIds, target: target })
            });
            const result = await response.json();
            
            if (result.success) {
                showToast(`Successfully tagged ${result.affected} exams for ${actionText}.`, 'success');
                fetchAndDisplayExams(false);
            } else {
                showToast(result.message || 'Bulk tagging failed.');
            }
        } catch (error) {
            showToast('API communication error.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    tableBody.addEventListener('click', (e) => handleListClick(e));
    cardView.addEventListener('click', (e) => handleListClick(e));

    function updateSelectionSummary() {
        const container = document.getElementById('selection-summary-container');
        const textEl = document.getElementById('selection-summary-text');
        const iconEl = document.getElementById('selection-summary-icon');
        const numInput = document.getElementById('setup-num-questions');
        const confirmBtn = document.getElementById('confirm-setup-btn');
        const userCount = parseInt(numInput.value) || 0;
        
        const selectedPriorities = Array.from(document.querySelectorAll('.priority-input:checked')).map(cb => cb.value);
        
        let availableCount = 0;
        if (selectedPriorities.length === 0) {
            availableCount = parseInt(currentExamForSetup.questions) || 0;
        } else {
            selectedPriorities.forEach(p => {
                availableCount += (currentPriorityDistribution[p] || 0);
            });
        }

        if (availableCount > 0 || userCount > 0) {
            container.classList.remove('hidden');
            
            // Check for over-limit
            const isOverLimit = userCount > availableCount;
            
            if (isOverLimit) {
                // Warning State (Amber)
                container.classList.replace('bg-indigo-50', 'bg-amber-50');
                container.classList.replace('border-indigo-100', 'border-amber-200');
                iconEl.classList.replace('text-indigo-500', 'text-amber-500');
                iconEl.textContent = 'warning';
                textEl.classList.replace('text-indigo-700', 'text-amber-700');
                
                textEl.innerHTML = `Only <span class="text-amber-900 font-extrabold">${availableCount}</span> questions found for these filters. Proceed with ${availableCount}?`;
                confirmBtn.innerHTML = `<span class="material-symbols-outlined text-sm">rocket_launch</span> Proceed with ${availableCount} Questions`;
            } else {
                // Normal State (Indigo)
                container.classList.replace('bg-amber-50', 'bg-indigo-50');
                container.classList.replace('border-amber-200', 'border-indigo-100');
                iconEl.classList.replace('text-amber-500', 'text-indigo-500');
                iconEl.textContent = 'info';
                textEl.classList.replace('text-amber-700', 'text-indigo-700');

                if (userCount > 0) {
                    textEl.innerHTML = `Selected: <span class="text-indigo-900 font-extrabold">${userCount}</span> questions (out of ${availableCount} matching filters).`;
                } else {
                    textEl.innerHTML = `Selected: <span class="text-indigo-900 font-extrabold">${availableCount}</span> questions available.`;
                }
                confirmBtn.innerHTML = '<span class="material-symbols-outlined text-sm">rocket_launch</span> Start Exam';
            }
        } else {
            container.classList.add('hidden');
            confirmBtn.innerHTML = '<span class="material-symbols-outlined text-sm">rocket_launch</span> Start Exam';
        }
    }

    async function fetchPriorityCounts(examId) {
        const counts = document.querySelectorAll('.priority-count');
        const checkboxes = document.querySelectorAll('.priority-input');
        
        counts.forEach(c => {
            c.textContent = '...';
            c.classList.remove('text-indigo-600', 'text-gray-300');
            c.classList.add('text-gray-300');
        });

        checkboxes.forEach(cb => {
            cb.disabled = true;
            cb.closest('.priority-checkbox-label').classList.add('opacity-50', 'pointer-events-none');
        });

        try {
            const response = await fetch(`api/take-exam/start.php?exam_id=${examId}&action=get_counts`);
            const result = await response.json();

            if (result.success) {
                currentPriorityDistribution = result.data;
                Object.keys(currentPriorityDistribution).forEach(priority => {
                    const countEl = document.getElementById(`count-priority-${priority}`);
                    const checkbox = document.getElementById(`priority-check-${priority}`);
                    const count = currentPriorityDistribution[priority];

                    if (countEl) {
                        countEl.textContent = `(${count})`;
                        if (count > 0) {
                            countEl.classList.remove('text-gray-300');
                            countEl.classList.add('text-indigo-600');
                            if (checkbox) {
                                checkbox.disabled = false;
                                checkbox.closest('.priority-checkbox-label').classList.remove('opacity-50', 'pointer-events-none');
                            }
                        } else {
                            countEl.classList.add('text-red-300');
                        }
                    }
                });
                updateSelectionSummary();
            }
        } catch (error) {
            console.error('Failed to fetch priority counts:', error);
            counts.forEach(c => c.textContent = '(?)');
        }
    }

    function openSetupModal() {
        if (!currentExamForSetup) return;

        document.getElementById('setup-exam-title').textContent = currentExamForSetup.title;
        document.getElementById('setup-duration').textContent = currentExamForSetup.duration;
        document.getElementById('setup-total-qs').textContent = currentExamForSetup.questions;
        
        const instructions = currentExamForSetup.instructions;
        const instEl = document.getElementById('setup-instructions');
        if (instructions && instructions.trim() !== '') {
            document.getElementById('setup-instructions-text').textContent = instructions;
            instEl.classList.remove('hidden');
        } else {
            instEl.classList.add('hidden');
        }

        // Performance Context
        const perfEl = document.getElementById('setup-performance-context');
        const attempts = parseInt(currentExamForSetup.attemptCount) || 0;
        
        if (attempts > 0) {
            const lastScore = parseFloat(currentExamForSetup.lastScore) || 0;
            const totalMarks = parseFloat(currentExamForSetup.totalMarks) || 0;
            const lastPerc = parseFloat(currentExamForSetup.lastPercentage) || 0;
            
            document.getElementById('setup-last-percentage-badge').textContent = `${Math.round(lastPerc)}%`;
            document.getElementById('setup-attempt-count-text').textContent = `${attempts} ${attempts === 1 ? 'Attempt' : 'Attempts'}`;
            document.getElementById('setup-last-score-detail').textContent = `Score: ${lastScore} / ${totalMarks}`;
            
            const motivationEl = document.getElementById('setup-motivation-text');
            if (lastPerc >= 100) {
                motivationEl.textContent = 'Perfect! Keep it up! 🏆';
                motivationEl.className = 'text-green-300 italic';
            } else {
                motivationEl.textContent = `Beat your last ${Math.round(lastPerc)}%! 🎯`;
                motivationEl.className = 'text-indigo-200 italic';
            }
            
            perfEl.classList.remove('hidden');
        } else {
            perfEl.classList.add('hidden');
        }
        
        document.getElementById('setup-num-questions').value = '';
        
        // Reset local distribution
        currentPriorityDistribution = { "0": 0, "1": 0, "2": 0, "3": 0 };

        // Reset summary
        const summaryContainer = document.getElementById('selection-summary-container');
        if (summaryContainer) summaryContainer.classList.add('hidden');

        // Reset priorities
        document.querySelectorAll('.priority-input:checked').forEach(cb => cb.checked = false);

        // Reset error message
        const errorEl = document.getElementById('setup-error-message');
        if (errorEl) errorEl.classList.add('hidden');

        // Reset button state
        const confirmBtn = document.getElementById('confirm-setup-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<span class="material-symbols-outlined text-sm">rocket_launch</span> Start Exam';
        }
        
        // Finalize modal open
        checkActiveSession();

        setupModal.classList.remove('hidden');
        setupModal.classList.add('flex');
        setTimeout(() => {
            setupContent.classList.remove('scale-95', 'opacity-0');
            setupContent.classList.add('scale-100', 'opacity-100');
        }, 10);

        // Fetch presets and counts
        loadPresets();
        fetchPriorityCounts(currentExamForSetup.id);
    }

    // --- Preset System Logic ---
    async function loadPresets() {
        const container = document.getElementById('preset-chips-container');
        if (!container) return;

        try {
            const response = await fetch('api/take-exam/presets.php');
            const result = await response.json();

            if (result.success) {
                renderPresets(result.data);
            }
        } catch (error) {
            console.error('Failed to load presets:', error);
            container.innerHTML = '<span class="text-[8px] text-gray-400 italic">Error loading presets</span>';
        }
    }

    function renderPresets(presets) {
        const container = document.getElementById('preset-chips-container');
        container.innerHTML = '';

        if (presets.length === 0) {
            container.innerHTML = '<span class="text-[8px] text-gray-400 italic">No saved presets</span>';
            return;
        }

        presets.forEach(preset => {
            const chip = document.createElement('div');
            chip.className = 'preset-chip group-preset';
            chip.dataset.id = preset.id;
            chip.dataset.config = JSON.stringify(preset);
            
            chip.innerHTML = `
                <span>${preset.name}</span>
                <button class="preset-delete-btn material-symbols-outlined text-[10px]" data-id="${preset.id}">close</button>
            `;
            
            chip.addEventListener('click', (e) => {
                if (e.target.classList.contains('preset-delete-btn')) {
                    e.stopPropagation();
                    deletePreset(preset.id, chip);
                } else {
                    applyPreset(preset, chip);
                }
            });
            
            container.appendChild(chip);
        });
    }

    function applyPreset(preset, activeChip) {
        const isCurrentlyActive = activeChip.classList.contains('active');
        
        // Remove active class from all chips first
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));

        if (isCurrentlyActive) {
            // If it was already active, we are "unselecting" it
            document.getElementById('setup-num-questions').value = '';
            document.querySelectorAll('.priority-input').forEach(cb => cb.checked = false);
            updateSelectionSummary();
            showToast('Preset deselected', 'success');
            return;
        }

        // Otherwise, apply the preset
        activeChip.classList.add('active');

        // Set inputs
        const numInput = document.getElementById('setup-num-questions');
        numInput.value = preset.num_questions || '';

        // Set priorities
        const presetPriorities = preset.priorities ? preset.priorities.split(',') : [];
        document.querySelectorAll('.priority-input').forEach(cb => {
            cb.checked = presetPriorities.includes(cb.value);
        });

        updateSelectionSummary();
        showToast(`Applied preset: ${preset.name}`, 'success');
    }

    async function savePreset() {
        const nameInput = document.getElementById('new-preset-name');
        const name = nameInput.value.trim();
        const numInput = document.getElementById('setup-num-questions');
        const num_questions = numInput.value;
        const selectedPriorities = Array.from(document.querySelectorAll('.priority-input:checked')).map(cb => cb.value).join(',');

        if (!name) {
            showToast('Please enter a name for the preset.', 'error');
            return;
        }

        const saveBtn = document.getElementById('confirm-save-preset');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const response = await fetch('api/take-exam/presets.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, num_questions, priorities: selectedPriorities })
            });
            const result = await response.json();

            if (result.success) {
                showToast('Preset saved!', 'success');
                nameInput.value = '';
                document.getElementById('save-preset-form').classList.add('hidden');
                loadPresets();
            } else {
                showToast(result.message || 'Failed to save preset.');
            }
        } catch (error) {
            showToast('Network error while saving preset.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    async function deletePreset(id, chipEl) {
        if (!confirm('Delete this preset?')) return;

        try {
            const response = await fetch('api/take-exam/presets.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const result = await response.json();

            if (result.success) {
                chipEl.style.transform = 'scale(0.8)';
                chipEl.style.opacity = '0';
                setTimeout(() => {
                    loadPresets();
                }, 200);
            } else {
                showToast(result.message || 'Failed to delete preset.');
            }
        } catch (error) {
            showToast('Network error while deleting preset.');
        }
    }

    function closeSetupModal() {
        setupContent.classList.remove('scale-100', 'opacity-100');
        setupContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            setupModal.classList.add('hidden');
            setupModal.classList.remove('flex');
            currentExamForSetup = null;
        }, 300);
    }

    document.getElementById('close-setup-modal').addEventListener('click', closeSetupModal);
    document.getElementById('cancel-setup-btn').addEventListener('click', closeSetupModal);
    document.getElementById('confirm-setup-btn').addEventListener('click', async () => {
        if (!currentExamForSetup) return;

        const confirmBtn = document.getElementById('confirm-setup-btn');
        const errorEl = document.getElementById('setup-error-message');
        const numQuestions = document.getElementById('setup-num-questions').value;
        const selectedPriorities = Array.from(document.querySelectorAll('.priority-input:checked')).map(cb => cb.value);

        // Hide old error
        if (errorEl) errorEl.classList.add('hidden');

        // Show loading state
        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Checking...';

        try {
            // Recalculate available count for safety
            let availableCount = 0;
            if (selectedPriorities.length === 0) {
                availableCount = parseInt(currentExamForSetup.questions) || 0;
            } else {
                selectedPriorities.forEach(p => {
                    availableCount += (currentPriorityDistribution[p] || 0);
                });
            }

            const finalNumQuestions = numQuestions ? Math.min(parseInt(numQuestions), availableCount) : 0;

            let queryParams = `?exam_id=${currentExamForSetup.id}`;
            if (selectedPriorities.length > 0) queryParams += `&priorities=${selectedPriorities.join(',')}`;

            // Use lightweight check action
            const response = await fetch(`api/take-exam/start.php${queryParams}&action=check`);
            const result = await response.json();

            if (result.success && result.count > 0) {
                // Success! Navigate to exam
                if (window.loadPage) {
                    closeSetupModal();
                    
                    // Full query params for the interface
                    let finalParams = `?exam_id=${currentExamForSetup.id}`;
                    if (finalNumQuestions > 0) finalParams += `&num_questions=${finalNumQuestions}`;
                    if (selectedPriorities.length > 0) finalParams += `&priorities=${selectedPriorities.join(',')}`;
                    
                    window.loadPage('take-exam-interface', finalParams);
                }
            } else {
                // No questions found
                if (errorEl) errorEl.classList.remove('hidden');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = originalHTML;
            }
        } catch (error) {
            showToast('Error verifying questions. Please try again.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalHTML;
        }
    });

    // --- Live Selection Listeners ---
    document.getElementById('setup-num-questions').addEventListener('input', updateSelectionSummary);
    document.querySelectorAll('.priority-input').forEach(cb => {
        cb.addEventListener('change', updateSelectionSummary);
    });

    // Delete Modal Logic
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    let examIdToDelete = null;

// Setup Modal Logic
    const setupModal = document.getElementById('take-exam-setup-modal');
    const setupContent = document.getElementById('setup-modal-content');
    let currentExamForSetup = null;

    function handleListClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('take-exam-btn')) {
            currentExamForSetup = {
                id: target.dataset.id,
                title: target.dataset.title,
                duration: target.dataset.duration,
                questions: target.dataset.questions,
                instructions: target.dataset.instructions,
                lastScore: target.dataset.lastScore,
                lastPercentage: target.dataset.lastPercentage,
                attemptCount: target.dataset.attemptCount,
                totalMarks: target.dataset.totalMarks
            };
            openSetupModal();
        } else if (target.classList.contains('study-exam-btn')) {
            const examId = target.dataset.id;
            handleStudyMaterials(examId, target);
        } else if (target.classList.contains('print-exam-btn')) {
            const examId = target.dataset.id;
            const totalQuestions = target.dataset.questions;
            handlePrintExam(examId, totalQuestions);
        } else if (target.classList.contains('tag-revision-btn')) {
            markAsRevised(target.dataset.id, target, target.dataset.target || 'today');
        } else if (target.classList.contains('untag-revision-btn')) {
            markAsRevised(target.dataset.id, target, target.dataset.target || 'today', true); // Pass true for untagging
        } else if (target.classList.contains('delete-exam-btn')) {
            examIdToDelete = target.dataset.id;
            deleteModal.classList.remove('hidden');
            deleteModal.classList.add('flex');
        }
    }

    async function markAsRevised(examId, btn, targetDateType, untag = false) {
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span>';

        try {
            const response = await fetch('api/exam/exam.php?action=mark_revised', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examId, target: targetDateType, untag: untag })
            });
            const result = await response.json();

            if (result.success) {
                const isTagged = (result.action === 'tagged');
                showToast(result.message, 'success');
                
                // Update ALL matching buttons (desktop + mobile) for this exam
                document.querySelectorAll(`.tag-revision-btn[data-id="${examId}"][data-target="${targetDateType}"]`).forEach(b => {
                    if (targetDateType === 'today') {
                        if (isTagged) {
                            b.className = b.className.replace(/border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white/, 'bg-indigo-600 text-white border-indigo-600');
                            b.title = 'Already tagged for today';
                            const icon = b.querySelector('.material-symbols-outlined');
                            if (icon) icon.textContent = 'event_available';
                            const span = b.querySelector('span:not(.material-symbols-outlined)');
                            if (span) span.textContent = 'Added';
                        } else {
                            b.className = b.className.replace(/bg-indigo-600 text-white border-indigo-600/, 'border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white');
                            b.title = 'Add to Today\'s Revision';
                            const icon = b.querySelector('.material-symbols-outlined');
                            if (icon) icon.textContent = 'event_repeat';
                            const span = b.querySelector('span:not(.material-symbols-outlined)');
                            if (span) span.textContent = 'Today';
                        }
                    } else if (targetDateType === 'tomorrow') {
                        if (isTagged) {
                            b.className = b.className.replace(/border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white/, 'bg-teal-600 text-white border-teal-600');
                            b.title = 'Planned for tomorrow';
                            const icon = b.querySelector('.material-symbols-outlined');
                            if (icon) icon.textContent = 'done_all';
                            const span = b.querySelector('span:not(.material-symbols-outlined)');
                            if (span) span.textContent = 'Planned';
                        } else {
                            b.className = b.className.replace(/bg-teal-600 text-white border-teal-600/, 'border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white');
                            b.title = 'Plan for Tomorrow';
                            const icon = b.querySelector('.material-symbols-outlined');
                            if (icon) icon.textContent = 'next_plan';
                            const span = b.querySelector('span:not(.material-symbols-outlined)');
                            if (span) span.textContent = 'Tomorrow';
                        }
                    }
                    b.disabled = false;
                });

                // Correctly update parent row (desktop) and card (mobile) background
                // Desktop row update
                const tr = btn.closest('tr');
                if (tr) {
                    tr.classList.remove('bg-indigo-50/70', 'hover:bg-indigo-100/70', 'bg-teal-50/70', 'hover:bg-teal-100/70');
                    if (isTagged) {
                        if (targetDateType === 'today') {
                            tr.classList.add('bg-indigo-50/70', 'hover:bg-indigo-100/70');
                        } else {
                            tr.classList.add('bg-teal-50/70', 'hover:bg-teal-100/70');
                        }
                    }
                    
                    // Update Row Badges (Revised/Planned)
                    const titleDiv = tr.querySelector('td div.flex.items-center.gap-2');
                    if (titleDiv) {
                        // Remove existing badges
                        titleDiv.querySelectorAll('span.bg-indigo-600, span.bg-teal-600').forEach(s => s.remove());
                        if (isTagged) {
                            const badge = document.createElement('span');
                            badge.className = `px-1.5 py-0.5 ${targetDateType === 'today' ? 'bg-indigo-600' : 'bg-teal-600'} text-white rounded text-[9px] font-black uppercase tracking-tighter`;
                            badge.textContent = targetDateType === 'today' ? 'Revised' : 'Planned';
                            titleDiv.appendChild(badge);
                        }
                    }
                }

                // Mobile card update
                const card = btn.closest('.rounded-2xl.border');
                if (card) {
                    card.classList.remove('bg-indigo-50/50', 'border-indigo-200', 'bg-teal-50/50', 'border-teal-200');
                    if (isTagged) {
                        if (targetDateType === 'today') {
                            card.classList.add('bg-indigo-50/50', 'border-indigo-200');
                        } else {
                            card.classList.add('bg-teal-50/50', 'border-teal-200');
                        }
                    }

                    // Update Card Badges
                    const titleHead = card.querySelector('h3');
                    if (titleHead) {
                         titleHead.querySelectorAll('span.bg-indigo-600, span.bg-teal-600').forEach(s => s.remove());
                         if (isTagged) {
                            const badge = document.createElement('span');
                            badge.className = `px-1.5 py-0.5 ${targetDateType === 'today' ? 'bg-indigo-600' : 'bg-teal-600'} text-white rounded text-[8px] font-black uppercase tracking-tighter`;
                            badge.textContent = targetDateType === 'today' ? 'Revised' : 'Planned';
                            titleHead.appendChild(badge);
                         }
                    }
                }

                // If just tagged one, un-tag the other? (Optional policy)
                // Actually, the API doesn't un-tag the other unless we explicitly want it to.
                // Standard behavior: only one date is allowed because we use a single column 'last_revision_date'. 
                // So the other button SHOULD be reset to 'Tag Today/Tomorrow' automatically if we reload.
                // To keep it simple, if tagging one succeeded, let's reset the other button visual if it was tagged.
                const otherTarget = targetDateType === 'today' ? 'tomorrow' : 'today';
                if (isTagged) {
                    document.querySelectorAll(`.tag-revision-btn[data-id="${examId}"][data-target="${otherTarget}"]`).forEach(b => {
                        if (otherTarget === 'today') {
                             b.className = b.className.replace(/bg-indigo-600 text-white border-indigo-600/, 'border-2 border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white');
                             const icon = b.querySelector('.material-symbols-outlined');
                             if (icon) icon.textContent = 'event_repeat';
                             const span = b.querySelector('span:not(.material-symbols-outlined)');
                             if (span) span.textContent = 'Today';
                        } else {
                             b.className = b.className.replace(/bg-teal-600 text-white border-teal-600/, 'border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white');
                             const icon = b.querySelector('.material-symbols-outlined');
                             if (icon) icon.textContent = 'next_plan';
                             const span = b.querySelector('span:not(.material-symbols-outlined)');
                             if (span) span.textContent = 'Tomorrow';
                        }
                    });
                }
            } else {
                showToast(result.message || 'Failed to update revision status.');
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        } catch (error) {
            showToast('Network error while updating revision status.');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }

    // Delete Modal Button Listeners
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
        examIdToDelete = null;
    });

    document.getElementById('confirm-exam-delete-btn').addEventListener('click', async () => {
        if (!examIdToDelete) return;

        const confirmBtn = document.getElementById('confirm-exam-delete-btn');
        const originalText = confirmBtn.innerText;
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Deleting...';

        try {
            // Reusing the main exam delete API
            const response = await fetch(`api/exam/exam.php?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examIdToDelete })
            });
            const result = await response.json();

            if (result.success) {
                showToast('Exam deleted successfully.', 'success');
                fetchAndDisplayExams(false); // Refresh list
            } else {
                showToast(result.message || 'Failed to delete exam.');
            }
        } catch (error) {
            showToast('Network error occurred.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerText = originalText;
            deleteModal.classList.add('hidden');
            deleteModal.classList.remove('flex');
            examIdToDelete = null;
        }
    });

    // --- Preset UI Listeners ---
    document.getElementById('toggle-save-preset').addEventListener('click', () => {
        const form = document.getElementById('save-preset-form');
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) {
            document.getElementById('new-preset-name').focus();
        }
    });

    document.getElementById('confirm-save-preset').addEventListener('click', savePreset);
    document.getElementById('new-preset-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') savePreset();
    });

    async function handlePrintExam(examId, totalQuestions = 0) {
        if (!window.PrintEngine) {
            showToast('Print engine not loaded.');
            return;
        }

        PrintEngine.openModal(examId, totalQuestions);

        PrintEngine.onGenerate = async () => {
            const generateBtn = document.getElementById('generate-pdf-btn');
            const limitInput = document.getElementById('print-limit-num');
            const numQuestions = limitInput ? parseInt(limitInput.value) : 0;
            
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Loading Questions...';

            try {
                let url = `api/take-exam/start.php?exam_id=${examId}`;
                if (numQuestions > 0) {
                    url += `&num_questions=${numQuestions}&sort=least_attempted`;
                }

                const response = await fetch(url);
                const result = await response.json();
                if (result.success) {
                    PrintEngine.generatePDF(result.data);
                    PrintEngine.closeModal();
                } else {
                    showToast(result.message || 'Failed to fetch exam data.');
                }
            } catch (error) {
                showToast('An error occurred while fetching exam data.');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = originalText;
            }
        };
    }

    async function handleStudyMaterials(examId, btn) {
        if (!window.StudyMaterialEngine) {
            showToast('Study engine not loaded.');
            return;
        }

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span>';

        try {
            const response = await fetch(`api/take-exam/start.php?exam_id=${examId}`);
            const result = await response.json();
            if (result.success) {
                const data = {
                    questions: result.data.questions,
                    details: {
                        title: result.data.details.exam_title || 'Exam Study Materials',
                        subject: result.data.details.subject_name,
                        lesson: result.data.details.lesson_name
                    }
                };
                window.StudyMaterialEngine.generate(data);
                showToast('Materials generated!', 'success');
            } else {
                showToast(result.message || 'Failed to fetch exam data.');
            }
        } catch (error) {
            showToast('An error occurred while fetching exam data.');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    async function checkActiveSession() {
        const warningContainer = document.getElementById('active-session-container');
        const optionsContainer = document.getElementById('setup-options-container');
        const titleEl = document.getElementById('running-exam-title');
        const footerBtn = document.getElementById('confirm-setup-btn');

        try {
            const response = await fetch('api/take-exam/active-session.php?action=check');
            const result = await response.json();

            if (result.success && result.session) {
                // An active session exists!
                titleEl.textContent = result.session.exam_title;
                warningContainer.classList.remove('hidden');
                optionsContainer.classList.add('hidden');
                footerBtn.disabled = true;
                footerBtn.classList.add('opacity-50');

                // Store session info for resume/cancel
                warningContainer.dataset.sessionId = result.session.id;
                warningContainer.dataset.examId = result.session.exam_id;
            } else {
                warningContainer.classList.add('hidden');
                optionsContainer.classList.remove('hidden');
                footerBtn.disabled = false;
                footerBtn.classList.remove('opacity-50');
            }
        } catch (error) {
            console.error('Failed to check active session:', error);
        }
    }

    async function cancelActiveSession() {
        const warningContainer = document.getElementById('active-session-container');
        const sessionId = warningContainer.dataset.sessionId;

        if (!confirm('Are you sure you want to terminate the running exam? Any unsaved progress will be lost.')) return;

        try {
            const response = await fetch('api/take-exam/active-session.php?action=cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const result = await response.json();

            if (result.success) {
                showToast('Running exam terminated. You can now start a new one.', 'success');
                checkActiveSession(); // Refresh modal state
            } else {
                showToast(result.message || 'Failed to cancel session.');
            }
        } catch (error) {
            showToast('Network error while cancelling session.');
        }
    }

    document.getElementById('resume-active-btn').addEventListener('click', () => {
        const warningContainer = document.getElementById('active-session-container');
        const examId = warningContainer.dataset.examId;
        if (window.loadPage && examId) {
            closeSetupModal();
            window.loadPage('take-exam-interface', `?exam_id=${examId}`);
        }
    });

    document.getElementById('cancel-active-btn').addEventListener('click', cancelActiveSession);

    // Initial Load
    populateSubjects();
}

initializeTakeExamListPage();

