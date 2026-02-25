function initializeLessonPage() {
    // API URLs
    const LESSON_API_URL = 'api/lesson/lesson.php';
    const SUBJECT_API_URL = 'api/lesson/subjects.php';

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

    let lessonIdToDelete = null;

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
        if (!append) {
            currentPage = 1;
            // Only show loading if we are not appending
            lessonsTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="flex items-center justify-center gap-2"><span class="animate-spin material-symbols-outlined text-blue-600">progress_activity</span> Loading lessons...</div></td></tr>';
        }

        const url = `${LESSON_API_URL}?action=list&page=${currentPage}&limit=${LIMIT}` + (subjectId > 0 ? `&subject_id=${subjectId}` : '');

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!append) lessonsTableBody.innerHTML = '';

            if (result.success && result.data.length > 0) {
                // Update total lessons counter
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

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td class="py-3 px-6 text-left whitespace-nowrap font-medium text-gray-900">${lesson.lesson_name}</td>
                            <td class="py-3 px-6 text-left">${lesson.subject_name}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="w-full">
                                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>${createdTopics} / ${expectedTopics}</span>
                                        <span>${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2">
                                        <div class="${progressBarColor} h-2 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="text-[10px] text-gray-500 mt-1 uppercase font-semibold tracking-wider">${topicsLeft} topics left</div>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center text-gray-700 font-medium">${lesson.start_page} - ${lesson.end_page}</td>
                            <td class="py-3 px-6 text-center text-gray-700">${lesson.py_bcs_ques}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center gap-2">
                                    <button class="edit-btn p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition" data-id="${lesson.id}" title="Edit Lesson"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" data-id="${lesson.id}" title="Delete Lesson"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    lessonsTableBody.insertAdjacentHTML('beforeend', row);
                });

                // Show/Hide "Load More" button
                if (loadMoreContainer) {
                    if (result.page < result.total_pages) {
                        loadMoreContainer.classList.remove('hidden');
                    } else {
                        loadMoreContainer.classList.add('hidden');
                    }
                }
            } else {
                if (!append) {
                    lessonsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-500">
                        <span class="material-symbols-outlined text-5xl mb-2 block text-gray-300">book</span>
                        No lessons found matching your criteria.
                    </td></tr>`;
                    if (totalLessonsBadge) totalLessonsBadge.classList.add('hidden');
                }
                if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error fetching lessons:', error);
            showToast('Failed to load lessons.', 'error');
            if (!append) lessonsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500 font-medium">Error loading lessons. Please try again.</td></tr>`;
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
    document.getElementById('close-lesson-modal-btn').addEventListener('click', () => closeModal(lessonModal));
    document.getElementById('cancel-lesson-modal-btn').addEventListener('click', () => closeModal(lessonModal));
    document.getElementById('cancel-lesson-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-lesson-delete-btn').addEventListener('click', handleDeleteConfirm);

    // --- Initial Load ---
    populateSubjectDropdowns();
    // fetchAndDisplayLessons() is now called inside populateSubjectDropdowns after restoration
}

initializeLessonPage();
