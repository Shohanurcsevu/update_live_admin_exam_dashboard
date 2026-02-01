function initializeTopicPage() {
    const TOPIC_API_URL = 'api/topic/topic.php';
    const SUBJECT_API_URL = 'api/topic/subjects.php';
    const LESSON_API_URL = 'api/topic/lessons.php';

    // DOM Elements
    const createBtn = document.getElementById('create-topic-btn');
    const topicModal = document.getElementById('topic-modal');
    const deleteModal = document.getElementById('delete-topic-confirm-modal');
    const topicForm = document.getElementById('topic-form');
    const tableBody = document.getElementById('topics-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const toastContainer = document.getElementById('toast-container');
    
    let topicIdToDelete = null;

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

    async function populateSubjects(selector) {
        try {
            const response = await fetch(SUBJECT_API_URL);
            const result = await response.json();
            if (result.success) {
                selector.innerHTML = selector === subjectFilter ? '<option value="0">All Subjects</option>' : '<option value="">Select Subject</option>';
                result.data.forEach(subject => {
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
            const response = await fetch(`${LESSON_API_URL}?subject_id=${subjectId}`);
            const result = await response.json();
            if (result.success) {
                selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Lesson</option>';
                result.data.forEach(lesson => {
                    selector.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                selector.disabled = false;
                if (lessonToSelect) selector.value = lessonToSelect;
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    }

    async function fetchAndDisplayTopics() {
        const subjectId = subjectFilter.value;
        const lessonId = lessonFilter.value;
        let url = `${TOPIC_API_URL}?action=list`;
        if (subjectId > 0) url += `&subject_id=${subjectId}`;
        if (lessonId > 0) url += `&lesson_id=${lessonId}`;

        try {
            const response = await fetch(url);
            const result = await response.json();
            tableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(topic => {
                    // --- NEW: Exam progress calculation ---
                    const createdExams = parseInt(topic.created_exams) || 0;
                    const expectedExams = parseInt(topic.expected_exams) || 0;
                    const examsLeft = Math.max(0, expectedExams - createdExams);
                    const progressPercent = expectedExams > 0 ? (createdExams / expectedExams) * 100 : 0;
                    const progressBarColor = progressPercent >= 100 ? 'bg-green-600' : 'bg-blue-600';

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left font-medium">${topic.topic_name}</td>
                            <td class="py-3 px-6 text-left">${topic.lesson_name}</td>
                            <td class="py-3 px-6 text-left">${topic.subject_name}</td>
                            <td class="py-3 px-6 text-center">${topic.start_page} - ${topic.end_page}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="w-full">
                                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>${createdExams} / ${expectedExams}</span>
                                        <span>${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">${examsLeft} exams left</div>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center">
                                    <button class="edit-btn w-8 h-8 rounded-full bg-green-200 text-green-700" data-id="${topic.id}"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn w-8 h-8 rounded-full bg-red-200 text-red-700 ml-2" data-id="${topic.id}"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No topics found.</td></tr>`;
            }
        } catch (error) { showToast('Failed to load topics.', 'error'); }
    }

    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(topicForm);
        const data = Object.fromEntries(formData.entries());
        const url = data.id ? `${TOPIC_API_URL}?action=update` : `${TOPIC_API_URL}?action=create`;
        
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(topicModal);
                fetchAndDisplayTopics();
                showToast(result.message, data.id ? 'update' : 'success');
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('A network error occurred.', 'error'); }
    }

    async function handleDeleteConfirm() {
        if (!topicIdToDelete) return;
        try {
            const response = await fetch(`${TOPIC_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: topicIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteModal); fetchAndDisplayTopics(); }
    }

    async function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        
        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`${TOPIC_API_URL}?action=get_single&id=${id}`);
                const result = await response.json();
                if (result.success) {
                    const topic = result.data;
                    document.getElementById('topic-modal-title').textContent = 'Edit Topic';
                    document.getElementById('topic-id').value = topic.id;
                    modalSubjectSelector.value = topic.subject_id;
                    await populateLessons(topic.subject_id, modalLessonSelector, topic.lesson_id);
                    document.getElementById('topic-name').value = topic.topic_name;
                    document.getElementById('start-page').value = topic.start_page;
                    document.getElementById('end-page').value = topic.end_page;
                    document.getElementById('expected-exams').value = topic.expected_exams;
                    openModal(topicModal);
                }
            } catch (error) { showToast('Failed to fetch topic details.', 'error'); }
        }
        
        if (deleteBtn) {
            topicIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }
    }

    // Setup Listeners
    createBtn.addEventListener('click', () => {
        document.getElementById('topic-modal-title').textContent = 'Add New Topic';
        topicForm.reset();
        modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
        modalLessonSelector.disabled = true;
        document.getElementById('topic-id').value = '';
        openModal(topicModal);
    });

    topicForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value, lessonFilter);
        fetchAndDisplayTopics();
    });
    lessonFilter.addEventListener('change', fetchAndDisplayTopics);

    // Modal dependent dropdown listener
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));

    // Modal close buttons
    document.getElementById('close-topic-modal-btn').addEventListener('click', () => closeModal(topicModal));
    document.getElementById('cancel-topic-modal-btn').addEventListener('click', () => closeModal(topicModal));
    document.getElementById('cancel-topic-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-topic-delete-btn').addEventListener('click', handleDeleteConfirm);

    // Initial Load
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
    fetchAndDisplayTopics();
}

initializeTopicPage();
