function initializeImportQuestionsPage() {
    const EXAM_API_URL = 'api/exam/exam.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';
    const IMPORT_API_URL = 'api/question/import.php';

    // DOM Elements
    const tableBody = document.getElementById('exams-table-body');
    const toastContainer = document.getElementById('toast-container');
    const importModal = document.getElementById('import-modal');
    const importForm = document.getElementById('import-form');

    // Filters
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    async function populateSubjects() {
        try {
            const response = await fetch(SUBJECT_API_URL);
            const result = await response.json();
            if (result.success) {
                subjectFilter.innerHTML = '<option value="0">All Subjects</option>';
                result.data.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });
            }
        } catch (error) { showToast('Failed to load subjects.', 'error'); }
    }

    async function populateLessons(subjectId) {
        lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
        lessonFilter.disabled = true;
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;
        if (!subjectId || subjectId === "0") return;
        
        try {
            const response = await fetch(`${LESSON_API_URL}?subject_id=${subjectId}`);
            const result = await response.json();
            if (result.success) {
                result.data.forEach(lesson => {
                    lessonFilter.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                lessonFilter.disabled = false;
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    }

    async function populateTopics(lessonId) {
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;
        if (!lessonId || lessonId === "0") return;

        try {
            const response = await fetch(`${TOPIC_API_URL}?lesson_id=${lessonId}`);
            const result = await response.json();
            if (result.success) {
                result.data.forEach(topic => {
                    topicFilter.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                topicFilter.disabled = false;
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
                            <td class="py-3 px-6 text-left">${exam.subject_name}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center space-x-2">
                                    <button class="import-btn bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded-full flex items-center" data-id="${exam.id}" data-title="${exam.exam_title}">
                                        <span class="material-symbols-outlined text-sm mr-1">upload_file</span> Import
                                    </button>
                                    <button class="edit-questions-btn bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-full flex items-center" data-id="${exam.id}" data-title="${exam.exam_title}">
                                        <span class="material-symbols-outlined text-sm mr-1">edit</span> Manage
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No exams found for the selected filters.</td></tr>`;
            }
        } catch (error) { showToast('Failed to load exams.', 'error'); }
    }
    
    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleImportFormSubmit(e) {
        e.preventDefault();
        const examId = document.getElementById('import-exam-id').value;
        const jsonText = document.getElementById('questions-json').value;

        let questions;
        try {
            questions = JSON.parse(jsonText);
            if (!Array.isArray(questions)) throw new Error();
        } catch (error) {
            showToast('Invalid JSON format. Please provide an array of questions.', 'error');
            return;
        }

        const data = { exam_id: examId, questions: questions };

        try {
            const response = await fetch(IMPORT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(importModal);
                showToast(result.message, 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('A network error occurred during import.', 'error');
        }
    }

    function handleTableClick(e) {
        const importBtn = e.target.closest('.import-btn');
        const editBtn = e.target.closest('.edit-questions-btn');
        
        if (importBtn) {
            const examId = importBtn.dataset.id;
            const examTitle = importBtn.dataset.title;
            document.getElementById('import-modal-title').textContent = `Import Questions for: ${examTitle}`;
            document.getElementById('import-exam-id').value = examId;
            importForm.reset();
            openModal(importModal);
        }

        if (editBtn) {
            const examId = editBtn.dataset.id;
            const examTitle = encodeURIComponent(editBtn.dataset.title);
            // This is where we need a way to navigate. Since we don't have a router,
            // we will simulate navigation by calling the main loader function.
            // This assumes `window.loadPage` is exposed globally from main.js or passed down.
            if(window.loadPage) {
                window.loadPage('questions-list', `?exam_id=${examId}&exam_title=${examTitle}`);
            } else {
                console.error("loadPage function is not available.");
            }
        }
    }
    
    // Setup Listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value);
        fetchAndDisplayExams();
    });
    lessonFilter.addEventListener('change', () => {
        populateTopics(lessonFilter.value);
        fetchAndDisplayExams();
    });
    topicFilter.addEventListener('change', fetchAndDisplayExams);
    
    tableBody.addEventListener('click', handleTableClick);
    importForm.addEventListener('submit', handleImportFormSubmit);
    document.getElementById('close-import-modal-btn').addEventListener('click', () => closeModal(importModal));
    document.getElementById('cancel-import-modal-btn').addEventListener('click', () => closeModal(importModal));

    // Initial Load
    populateSubjects();
    fetchAndDisplayExams();
}

initializeImportQuestionsPage();

