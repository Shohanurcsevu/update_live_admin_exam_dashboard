function initializeTakeExamListPage() {
    const API_URL = 'api/take-exam/';
    const tableBody = document.getElementById('exams-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

    // --- Toast Function ---
    function showToast(message, type = 'error') {
        const toastContainer = document.getElementById('toast-container');
        if(!toastContainer) return;
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
            }
        } catch (error) { showToast('Failed to load subjects.'); }
    }

    async function populateLessons(subjectId) {
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
            }
        } catch (error) { showToast('Failed to load lessons.'); }
        finally {
            fetchAndDisplayExams(); // Fetch exams after populating lessons
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
            }
        } catch (error) { showToast('Failed to load topics.'); }
        finally {
            fetchAndDisplayExams();
        }
    }

    // --- Exam Table Logic ---
    async function fetchAndDisplayExams() {
        let url = `${API_URL}exams.php?`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        url += params.toString();

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
                            <td class="py-3 px-6 text-center">${exam.duration} min</td>
                            <td class="py-3 px-6 text-center">${exam.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <button class="take-exam-btn bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-full" data-id="${exam.id}">Take Exam</button>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No exams found for the selected filters.</td></tr>`;
            }
        } catch (error) { showToast('Failed to load exams.'); }
    }
    
    // --- Event Listeners ---
    subjectFilter.addEventListener('change', () => populateLessons(subjectFilter.value));
    lessonFilter.addEventListener('change', () => populateTopics(lessonFilter.value));
    topicFilter.addEventListener('change', fetchAndDisplayExams);

    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('take-exam-btn')) {
            const examId = e.target.dataset.id;
            if (window.loadPage) {
                window.loadPage('take-exam-interface', `?exam_id=${examId}`);
            }
        }
    });

    // --- Initial Load ---
    populateSubjects();
    fetchAndDisplayExams();
}
initializeTakeExamListPage();

