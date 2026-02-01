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
            }
        } catch (error) {
            showToast('Failed to load subjects.', 'error');
        }
    }

    async function fetchAndDisplayLessons(subjectId = 0) {
        const url = subjectId > 0 ? `${LESSON_API_URL}?action=list&subject_id=${subjectId}` : `${LESSON_API_URL}?action=list`;
        try {
            const response = await fetch(url);
            const result = await response.json();
            lessonsTableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(lesson => {
                    // --- NEW: Topic progress calculation ---
                    const createdTopics = parseInt(lesson.created_topics) || 0;
                    const expectedTopics = parseInt(lesson.expected_topics) || 0;
                    const topicsLeft = Math.max(0, expectedTopics - createdTopics);
                    const progressPercent = expectedTopics > 0 ? (createdTopics / expectedTopics) * 100 : 0;
                    const progressBarColor = progressPercent >= 100 ? 'bg-green-600' : 'bg-blue-600';

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left whitespace-nowrap font-medium">${lesson.lesson_name}</td>
                            <td class="py-3 px-6 text-left">${lesson.subject_name}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="w-full">
                                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>${createdTopics} / ${expectedTopics}</span>
                                        <span>${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">${topicsLeft} topics left</div>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center">${lesson.start_page} - ${lesson.end_page}</td>
                            <td class="py-3 px-6 text-center">${lesson.py_bcs_ques}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center">
                                    <button class="edit-btn w-8 h-8 rounded-full bg-green-200 text-green-700 hover:bg-green-300 mr-2" data-id="${lesson.id}"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn w-8 h-8 rounded-full bg-red-200 text-red-700 hover:bg-red-300" data-id="${lesson.id}"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    lessonsTableBody.innerHTML += row;
                });
            } else {
                lessonsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No lessons found.</td></tr>`;
            }
        } catch (error) {
            showToast('Failed to load lessons.', 'error');
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
    subjectFilter.addEventListener('change', () => fetchAndDisplayLessons(subjectFilter.value));
    
    // Modal close buttons
    document.getElementById('close-lesson-modal-btn').addEventListener('click', () => closeModal(lessonModal));
    document.getElementById('cancel-lesson-modal-btn').addEventListener('click', () => closeModal(lessonModal));
    document.getElementById('cancel-lesson-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-lesson-delete-btn').addEventListener('click', handleDeleteConfirm);

    // --- Initial Load ---
    populateSubjectDropdowns();
    fetchAndDisplayLessons();
}

initializeLessonPage();
