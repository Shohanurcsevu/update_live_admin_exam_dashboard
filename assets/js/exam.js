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
    const toastContainer = document.getElementById('toast-container');

    // Filters
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

    // Modal Selectors
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const modalTopicSelector = document.getElementById('modal-topic-selector');

    let examIdToDelete = null;
    const defaultInstructions = 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।';

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

    async function populateTopics(lessonId, selector, topicToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!lessonId || lessonId === "0") {
            selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Lesson First</option>';
            return;
        }
        try {
            const response = await fetch(`${TOPIC_API_URL}?lesson_id=${lessonId}`);
            const result = await response.json();
            if (result.success) {
                selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Topic</option>';
                result.data.forEach(topic => {
                    selector.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                selector.disabled = false;
                if (topicToSelect) selector.value = topicToSelect;
            }
        } catch (error) { showToast('Failed to load topics.', 'error'); }
    }

    async function fetchAndDisplayExams() {
        let url = `${EXAM_API_URL}?action=list`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        const query = params.toString();
        if (query) url += `&${query}`;

        try {
            const response = await fetch(url);
            const result = await response.json();
            tableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left font-medium">${exam.exam_title}</td>
                            <td class="py-3 px-6 text-left">${exam.topic_name}</td>
                            <td class="py-3 px-6 text-left">${exam.lesson_name}</td>
                            <td class="py-3 px-6 text-left">${exam.subject_name}</td>
                            <td class="py-3 px-6 text-center">${exam.duration} min</td>
                            <td class="py-3 px-6 text-center">${exam.total_marks}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center">
                                    <button class="edit-btn w-8 h-8 rounded-full bg-green-200 text-green-700" data-id="${exam.id}"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn w-8 h-8 rounded-full bg-red-200 text-red-700 ml-2" data-id="${exam.id}"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No exams found.</td></tr>`;
            }
        } catch (error) { showToast('Failed to load exams.', 'error'); }
    }

    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(examForm);
        const data = Object.fromEntries(formData.entries());
        const url = data.id ? `${EXAM_API_URL}?action=update` : `${EXAM_API_URL}?action=create`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(examModal);
                fetchAndDisplayExams();
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
        finally { closeModal(deleteModal); fetchAndDisplayExams(); }
    }

    async function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

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
                    openModal(examModal);
                }
            } catch (error) { showToast('Failed to fetch exam details.', 'error'); }
        }

        if (deleteBtn) {
            examIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
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
        modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
        modalLessonSelector.disabled = true;
        modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
        modalTopicSelector.disabled = true;
        openModal(examModal);
    });

    examForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value, lessonFilter);
        lessonFilter.dispatchEvent(new Event('change')); // Trigger lesson filter change
    });
    lessonFilter.addEventListener('change', () => {
        populateTopics(lessonFilter.value, topicFilter);
        topicFilter.dispatchEvent(new Event('change')); // Trigger topic filter change
    });
    topicFilter.addEventListener('change', fetchAndDisplayExams);

    // Modal dependent dropdown listeners
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));
    modalLessonSelector.addEventListener('change', () => populateTopics(modalLessonSelector.value, modalTopicSelector));

    // Modal close buttons
    document.getElementById('close-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-exam-delete-btn').addEventListener('click', handleDeleteConfirm);

    // --- Initial Load ---
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
    fetchAndDisplayExams();
}

initializeExamPage();
