function initializeLessonPage() {
    // API URLs
    const LESSON_API_URL = 'api/lesson/lesson.php';
    const SUBJECT_API_URL = 'api/lesson/subjects.php';
    const TOGGLE_COMPLETE_URL = 'api/lesson/toggle-complete.php';

    // === SUBJECT COLOR CONFIG (Central Definition) ===
    const SUBJECT_COLORS = {
        emerald: { bg: 'rgba(16,185,129,0.10)', border: '#10b981', text: '#065f46', badge: '#d1fae5', badgeText: '#065f46' },
        indigo: { bg: 'rgba(99,102,241,0.10)', border: '#6366f1', text: '#3730a3', badge: '#e0e7ff', badgeText: '#3730a3' },
        amber: { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', text: '#78350f', badge: '#fef3c7', badgeText: '#78350f' },
        cyan: { bg: 'rgba(6,182,212,0.10)', border: '#06b6d4', text: '#155e75', badge: '#cffafe', badgeText: '#155e75' },
        violet: { bg: 'rgba(139,92,246,0.10)', border: '#8b5cf6', text: '#5b21b6', badge: '#ede9fe', badgeText: '#5b21b6' },
        rose: { bg: 'rgba(244,63,94,0.10)', border: '#f43f5e', text: '#881337', badge: '#ffe4e6', badgeText: '#881337' },
        teal: { bg: 'rgba(20,184,166,0.10)', border: '#14b8a6', text: '#115e59', badge: '#ccfbf1', badgeText: '#115e59' },
        orange: { bg: 'rgba(249,115,22,0.10)', border: '#f97316', text: '#7c2d12', badge: '#ffedd5', badgeText: '#7c2d12' },
        sky: { bg: 'rgba(14,165,233,0.10)', border: '#0ea5e9', text: '#0c4a6e', badge: '#e0f2fe', badgeText: '#0c4a6e' },
        fuchsia: { bg: 'rgba(217,70,239,0.10)', border: '#d946ef', text: '#701a75', badge: '#fae8ff', badgeText: '#701a75' },
    };
    // Make it globally available for other modules
    window.SUBJECT_COLORS = SUBJECT_COLORS;

    // DOM Elements
    const createLessonBtn = document.getElementById('create-lesson-btn');
    const lessonModal = document.getElementById('lesson-modal');
    const deleteModal = document.getElementById('delete-lesson-confirm-modal');
    const lessonForm = document.getElementById('lesson-form');
    const lessonsTableBody = document.getElementById('lessons-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const mainClearFiltersBtn = document.getElementById('main-clear-filters-btn');
    const subjectIdSelector = document.getElementById('subject-id-selector');
    const toastContainer = document.getElementById('toast-container');

    // Completion Confirmation Modal Elements
    const completeConfirmModal = document.getElementById('complete-confirm-modal');
    const confirmCompleteBtn = document.getElementById('confirm-complete-btn');
    const cancelConfirmBtn = document.getElementById('cancel-confirm-btn');
    const modalTopicCount = document.getElementById('modal-topic-count');
    const modalTopicProgress = document.getElementById('modal-topic-progress');
    const modalExamCount = document.getElementById('modal-exam-count');
    const modalStatusIcon = document.getElementById('modal-status-icon');

    let lessonIdToDelete = null;
    let lessonIdToComplete = null;
    let colorClassToComplete = null;

    // --- Toast Function ---
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

    // --- Completion Styling Helpers ---
    function getCompletionStyles(colorClass) {
        return SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;
    }

    function applyCompletionToRow(rowEl, colorClass) {
        const colors = getCompletionStyles(colorClass);
        rowEl.style.backgroundColor = colors.bg;
        rowEl.style.borderLeft = `4px solid ${colors.border}`;
        rowEl.style.transition = 'all 0.3s ease';
    }

    function removeCompletionFromRow(rowEl) {
        rowEl.style.backgroundColor = '';
        rowEl.style.borderLeft = '';
    }

    function applyCompletionToCard(cardEl, colorClass) {
        const colors = getCompletionStyles(colorClass);
        cardEl.style.backgroundColor = colors.bg;
        cardEl.style.borderLeft = `4px solid ${colors.border}`;
        cardEl.style.borderColor = colors.border;
        cardEl.style.transition = 'all 0.3s ease';
    }

    function removeCompletionFromCard(cardEl) {
        cardEl.style.backgroundColor = '';
        cardEl.style.borderLeft = '';
        cardEl.style.borderColor = '';
    }

    // --- Toggle Completion ---
    async function toggleComplete(lessonId, newStatus) {
        // If marking complete, show confirmation modal first
        if (newStatus === 1) {
            await showCompletionModal(lessonId);
            return;
        }

        // For uncompleting, just do it directly
        await performToggle(lessonId, 0);
    }

    async function showCompletionModal(lessonId) {
        try {
            // Fetch stats first
            const response = await fetch(TOGGLE_COMPLETE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lessonId, check_only: true })
            });
            const result = await response.json();

            if (result.success) {
                const stats = result.stats;
                const colorClass = result.color_class || 'violet';
                const colors = getCompletionStyles(colorClass);

                // Populate Modal
                lessonIdToComplete = lessonId;
                colorClassToComplete = colorClass;

                const progress = stats.expected_topics > 0 ? (stats.created_topics / stats.expected_topics) * 100 : 0;
                modalTopicCount.textContent = `${stats.created_topics}/${stats.expected_topics}`;
                modalTopicProgress.style.width = `${progress}%`;
                modalTopicProgress.style.backgroundColor = colors.border;
                modalExamCount.textContent = `${stats.topics_with_exams} Topics`;
                modalExamCount.style.color = colors.text;
                modalStatusIcon.style.backgroundColor = colors.badge;
                modalStatusIcon.querySelector('span').style.color = colors.border;

                openModal(completeConfirmModal);
            } else {
                showToast(result.message || 'Failed to fetch lesson status', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    }

    async function performToggle(lessonId, newStatus) {
        try {
            const response = await fetch(TOGGLE_COMPLETE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lessonId, is_complete: newStatus })
            });
            const result = await response.json();

            if (result.success) {
                // Update the row/card reactively
                updateLessonUI(lessonId, result.data.is_complete, result.data.color_class);
                showToast(result.message, newStatus === 1 ? 'success' : 'update');
            } else {
                showToast(result.message || 'Failed to update.', 'error');
            }
        } catch (error) {
            console.error('Toggle complete error:', error);
            showToast('Network error while updating status.', 'error');
        }
    }

    function updateLessonUI(lessonId, isComplete, colorClass) {
        // Update table row
        const row = lessonsTableBody.querySelector(`tr[data-lesson-id="${lessonId}"]`);
        if (row) {
            const toggleBtn = row.querySelector('.complete-toggle-btn');
            if (toggleBtn) {
                updateToggleButton(toggleBtn, isComplete, colorClass);
            }
            if (isComplete) {
                applyCompletionToRow(row, colorClass);
            } else {
                removeCompletionFromRow(row);
            }
        }

        // Update card
        const lessonsCardsContainer = document.getElementById('lessons-cards-container');
        if (lessonsCardsContainer) {
            const card = lessonsCardsContainer.querySelector(`[data-lesson-id="${lessonId}"]`);
            if (card) {
                const toggleBtn = card.querySelector('.complete-toggle-btn');
                if (toggleBtn) {
                    updateToggleButton(toggleBtn, isComplete, colorClass);
                }
                if (isComplete) {
                    applyCompletionToCard(card, colorClass);
                } else {
                    removeCompletionFromCard(card);
                }
            }
        }
    }

    function updateToggleButton(btn, isComplete, colorClass) {
        const colors = getCompletionStyles(colorClass);
        if (isComplete) {
            btn.innerHTML = `<span class="material-symbols-outlined text-lg" style="color:${colors.border}">check_circle</span>`;
            btn.title = 'Mark Incomplete';
            btn.dataset.isComplete = '1';
            btn.style.backgroundColor = colors.badge;
            btn.style.borderColor = colors.border;
        } else {
            btn.innerHTML = `<span class="material-symbols-outlined text-lg text-gray-400">radio_button_unchecked</span>`;
            btn.title = 'Mark Complete';
            btn.dataset.isComplete = '0';
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
        }
    }

    function renderToggleButton(lesson) {
        const isComplete = parseInt(lesson.is_complete) || 0;
        const colorClass = lesson.color_class || 'violet';
        const colors = getCompletionStyles(colorClass);

        if (isComplete) {
            return `<button class="complete-toggle-btn p-2 rounded-lg border transition-all shadow-sm" 
                        data-id="${lesson.id}" data-is-complete="1" data-color="${colorClass}" 
                        title="Mark Incomplete"
                        style="background-color:${colors.badge};border-color:${colors.border}">
                        <span class="material-symbols-outlined text-lg" style="color:${colors.border}">check_circle</span>
                    </button>`;
        } else {
            return `<button class="complete-toggle-btn p-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all shadow-sm" 
                        data-id="${lesson.id}" data-is-complete="0" data-color="${colorClass}" 
                        title="Mark Complete">
                        <span class="material-symbols-outlined text-lg text-gray-400">radio_button_unchecked</span>
                    </button>`;
        }
    }

    // --- Data Fetching & Rendering ---
    async function populateSubjectDropdowns() {
        try {
            const response = await fetch(SUBJECT_API_URL);
            const result = await response.json();
            if (result.success) {
                subjectFilter.innerHTML = '<option value="0">All Subjects</option>';
                subjectIdSelector.innerHTML = '<option value="">Select a Subject</option>';
                result.data.forEach(subject => {
                    const option = `<option value="${subject.id}">${subject.subject_name}</option>`;
                    subjectFilter.innerHTML += option;
                    subjectIdSelector.innerHTML += option;
                });

                // Restore from URL params first, then localStorage
                const urlParams = new URLSearchParams(window.location.search);
                const urlSubject = urlParams.get('subject_id');
                const savedSubject = localStorage.getItem('filter_lesson_subject');

                if (urlSubject) {
                    subjectFilter.value = urlSubject;
                } else if (savedSubject && savedSubject !== '0') {
                    subjectFilter.value = savedSubject;
                }
                fetchAndDisplayLessons(subjectFilter.value);
            }
        } catch (error) {
            showToast('Failed to load subjects.', 'error');
        }
    }

    let currentPage = 1;
    const LIMIT = 10;

    // DOM Elements updates
    const totalLessonsBadge = document.getElementById('total-lessons-badge');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    async function fetchAndDisplayLessons(subjectId = 0, append = false) {
        const lessonsCardsContainer = document.getElementById('lessons-cards-container');
        if (!append) {
            currentPage = 1;
            lessonsTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="flex items-center justify-center gap-2"><span class="animate-spin material-symbols-outlined text-blue-600">progress_activity</span> Loading lessons...</div></td></tr>';
            if (lessonsCardsContainer) lessonsCardsContainer.innerHTML = '<div class="text-center py-10 text-gray-400">Loading lessons...</div>';
        }

        const url = `${LESSON_API_URL}?action=list&page=${currentPage}&limit=${LIMIT}` + (subjectId > 0 ? `&subject_id=${subjectId}` : '');

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!append) {
                lessonsTableBody.innerHTML = '';
                if (lessonsCardsContainer) lessonsCardsContainer.innerHTML = '';
            }

            if (result.success && result.data.length > 0) {
                if (totalLessonsBadge) {
                    totalLessonsBadge.textContent = result.total_count;
                    totalLessonsBadge.classList.remove('hidden');
                }

                result.data.forEach(lesson => {
                    const createdTopics = parseInt(lesson.created_topics) || 0;
                    const expectedTopics = parseInt(lesson.expected_topics) || 0;
                    const topicsLeft = Math.max(0, expectedTopics - createdTopics);
                    const progressPercent = expectedTopics > 0 ? (createdTopics / expectedTopics) * 100 : 0;
                    const progressBarColor = progressPercent >= 100 ? 'bg-green-600' : 'bg-blue-600';
                    const isComplete = parseInt(lesson.is_complete) || 0;
                    const colorClass = lesson.color_class || 'violet';

                    // Table Row (Desktop)
                    const rowStyle = isComplete ? `style="background-color:${getCompletionStyles(colorClass).bg};border-left:4px solid ${getCompletionStyles(colorClass).border}"` : '';
                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors" data-lesson-id="${lesson.id}" ${rowStyle}>
                            <td class="py-3 px-6 text-left whitespace-nowrap font-medium text-gray-900">${lesson.lesson_name}</td>
                            <td class="py-3 px-6 text-left">${lesson.subject_name}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="w-full min-w-[120px]">
                                    <div class="flex justify-between text-[10px] text-gray-600 mb-1">
                                        <span>${createdTopics}/${expectedTopics} Topics</span>
                                        <span class="font-bold">${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                                        <div class="${progressBarColor} h-1.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                                    </div>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center text-gray-700 font-medium">${lesson.start_page} - ${lesson.end_page}</td>
                            <td class="py-3 px-6 text-center text-gray-700">${lesson.py_bcs_ques}</td>
                            <td class="py-3 px-4 text-center">
                                ${renderToggleButton(lesson)}
                            </td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center gap-2">
                                    <button class="edit-btn p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition shadow-sm" data-id="${lesson.id}" title="Edit Lesson"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition shadow-sm" data-id="${lesson.id}" title="Delete Lesson"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    lessonsTableBody.insertAdjacentHTML('beforeend', row);

                    // Card View (Mobile)
                    if (lessonsCardsContainer) {
                        const cardStyle = isComplete ? `style="background-color:${getCompletionStyles(colorClass).bg};border-left:4px solid ${getCompletionStyles(colorClass).border};border-color:${getCompletionStyles(colorClass).border}"` : '';
                        const completeBadge = isComplete
                            ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold" style="background-color:${getCompletionStyles(colorClass).badge};color:${getCompletionStyles(colorClass).badgeText}">✓ Complete</span>`
                            : '';
                        const card = `
                            <div class="bg-gray-50 border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300" data-lesson-id="${lesson.id}" ${cardStyle}>
                                <div class="flex justify-between items-start mb-3">
                                    <div class="flex-1">
                                        <h3 class="text-base font-bold text-gray-800 leading-tight">${lesson.lesson_name}</h3>
                                        <p class="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
                                            <span class="material-symbols-outlined text-xs">book</span> ${lesson.subject_name}
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        ${completeBadge}
                                        <div class="bg-white px-2 py-1 rounded-lg border text-[9px] font-bold text-gray-400">ID: ${lesson.id}</div>
                                    </div>
                                </div>
                                <div class="mb-4">
                                    <div class="flex justify-between text-xs font-bold text-gray-600 mb-2">
                                        <span>Topics (${createdTopics}/${expectedTopics})</span>
                                        <span class="text-blue-600">${progressPercent.toFixed(1)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div class="${progressBarColor} h-2 rounded-full transition-all duration-700" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="flex justify-between mt-2 text-[10px] font-medium text-gray-400">
                                        <span>${topicsLeft} topics left</span>
                                        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">auto_stories</span> Pages: ${lesson.start_page}-${lesson.end_page}</span>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between border-t pt-3">
                                    <div class="flex flex-col">
                                        <span class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">BCS Ques</span>
                                        <span class="text-sm font-bold text-gray-700">${lesson.py_bcs_ques || 0}</span>
                                    </div>
                                    <div class="flex gap-2">
                                        ${renderToggleButton(lesson)}
                                        <button class="edit-btn h-10 w-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition active:scale-95" data-id="${lesson.id}">
                                            <span class="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button class="delete-btn h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition active:scale-95" data-id="${lesson.id}">
                                            <span class="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>`;
                        lessonsCardsContainer.insertAdjacentHTML('beforeend', card);
                    }
                });

                if (loadMoreContainer) {
                    if (result.page < result.total_pages) {
                        loadMoreContainer.classList.remove('hidden');
                    } else {
                        loadMoreContainer.classList.add('hidden');
                    }
                }
            } else {
                if (!append) {
                    lessonsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-500">No lessons found.</td></tr>`;
                    if (lessonsCardsContainer) lessonsCardsContainer.innerHTML = '<div class="text-center py-10 text-gray-400">No lessons found.</div>';
                    if (totalLessonsBadge) totalLessonsBadge.classList.add('hidden');
                }
                if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error fetching lessons:', error);
            showToast('Failed to load lessons.', 'error');
            if (!append) lessonsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-500 font-medium">Error loading lessons.</td></tr>`;
        }
    }

    // --- Modal Control ---
    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    // --- Event Handlers ---
    function handleCreateClick() {
        document.getElementById('lesson-modal-title').textContent = 'Add New Lesson';
        lessonForm.reset();
        document.getElementById('lesson-id').value = '';
        openModal(lessonModal);
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(lessonForm);
        const data = Object.fromEntries(formData.entries());
        const url = data.id ? `${LESSON_API_URL}?action=update` : `${LESSON_API_URL}?action=create`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(lessonModal);
                fetchAndDisplayLessons(subjectFilter.value);
                showToast(result.message, data.id ? 'update' : 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('A network error occurred.', 'error');
        }
    }

    async function handleDeleteConfirm() {
        if (!lessonIdToDelete) return;
        try {
            const response = await fetch(`${LESSON_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lessonIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteModal); fetchAndDisplayLessons(subjectFilter.value); }
    }

    async function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const toggleBtn = e.target.closest('.complete-toggle-btn');

        if (toggleBtn) {
            const id = parseInt(toggleBtn.dataset.id);
            const currentStatus = parseInt(toggleBtn.dataset.isComplete);
            const newStatus = currentStatus === 1 ? 0 : 1;
            toggleComplete(id, newStatus);
            return;
        }

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`${LESSON_API_URL}?action=get_single&id=${id}`);
                const result = await response.json();
                if (result.success) {
                    const lesson = result.data;
                    document.getElementById('lesson-modal-title').textContent = 'Edit Lesson';
                    document.getElementById('lesson-id').value = lesson.id;
                    document.getElementById('subject-id-selector').value = lesson.subject_id;
                    document.getElementById('lesson-name').value = lesson.lesson_name;
                    document.getElementById('expected-topics').value = lesson.expected_topics;
                    document.getElementById('start-page').value = lesson.start_page;
                    document.getElementById('end-page').value = lesson.end_page;
                    document.getElementById('py-bcs-ques').value = lesson.py_bcs_ques;
                    openModal(lessonModal);
                }
            } catch (error) { showToast('Failed to fetch lesson details.', 'error'); }
        }

        if (deleteBtn) {
            lessonIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }
    }

    // --- Setup Listeners ---
    createLessonBtn.addEventListener('click', handleCreateClick);
    lessonForm.addEventListener('submit', handleFormSubmit);
    lessonsTableBody.addEventListener('click', handleTableClick);
    if (document.getElementById('lessons-cards-container')) {
        document.getElementById('lessons-cards-container').addEventListener('click', handleTableClick);
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            fetchAndDisplayLessons(subjectFilter.value, true);
        });
    }
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_lesson_subject', subjectFilter.value);
        fetchAndDisplayLessons(subjectFilter.value);
    });

    if (mainClearFiltersBtn) {
        mainClearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_lesson_subject');
            subjectFilter.value = '0';
            fetchAndDisplayLessons(0);
        });
    }

    // Modal close buttons
    const closeLessonBtn = document.getElementById('close-lesson-modal-btn');
    const cancelLessonBtn = document.getElementById('cancel-lesson-modal-btn');
    if (closeLessonBtn) closeLessonBtn.addEventListener('click', () => closeModal(lessonModal));
    if (cancelLessonBtn) cancelLessonBtn.addEventListener('click', () => closeModal(lessonModal));

    document.getElementById('cancel-lesson-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-lesson-delete-btn').addEventListener('click', handleDeleteConfirm);

    // Completion Confirmation Modal Listeners
    if (confirmCompleteBtn) {
        confirmCompleteBtn.addEventListener('click', async () => {
            if (lessonIdToComplete) {
                await performToggle(lessonIdToComplete, 1);
                closeModal(completeConfirmModal);
                lessonIdToComplete = null;
            }
        });
    }

    if (cancelConfirmBtn) {
        cancelConfirmBtn.addEventListener('click', () => {
            closeModal(completeConfirmModal);
            lessonIdToComplete = null;
        });
    }

    // --- Initial Load ---
    populateSubjectDropdowns();
    // fetchAndDisplayLessons() is now called inside populateSubjectDropdowns after restoration
}

initializeLessonPage();
