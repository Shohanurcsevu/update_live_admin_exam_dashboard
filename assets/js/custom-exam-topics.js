function initializeCustomExamTopicsPage() {
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/custom-exam/topics.php'; // Use the new API
    const CREATE_API_URL = 'api/custom-exam/from-topics.php';

    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const sourceTopicsSection = document.getElementById('source-topics-section');
    const sourceTopicsTableBody = document.getElementById('source-topics-table-body');
    const customExamFormSection = document.getElementById('custom-exam-form-section');
    const customExamForm = document.getElementById('custom-exam-form');
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'success') {
        if (!toastContainer) return;
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

    async function populateDropdown(url, selector, placeholder, isDependent = false) {
        selector.innerHTML = `<option value="0">${placeholder}</option>`;
        if (isDependent) selector.disabled = true;
        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                result.data.forEach(item => {
                    selector.innerHTML += `<option value="${item.id}">${item.subject_name || item.lesson_name || item.topic_name}</option>`;
                });
                if (isDependent) selector.disabled = false;
            }
        } catch (error) { console.error('Dropdown Error:', error); }
    }

    async function fetchAndDisplaySourceTopics() {
        const lessonId = lessonFilter.value;
        if (!lessonId || lessonId === '0') {
            sourceTopicsSection.classList.add('hidden');
            customExamFormSection.classList.add('hidden');
            return;
        }

        sourceTopicsSection.classList.remove('hidden');
        sourceTopicsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4">Loading topics...</td></tr>`;

        try {
            const response = await fetch(`${TOPIC_API_URL}?lesson_id=${lessonId}`);
            const result = await response.json();
            sourceTopicsTableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(topic => {
                    const row = `
                        <tr class="border-b border-gray-200" data-topic-id="${topic.id}">
                            <td class="py-3 px-6 text-left font-medium">${topic.topic_name}</td>
                            <td class="py-3 px-6 text-center">${topic.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <input type="number" class="question-count-input w-24 text-center border border-gray-300 rounded-md" min="0" max="${topic.total_questions}" placeholder="0">
                            </td>
                        </tr>`;
                    sourceTopicsTableBody.innerHTML += row;
                });
                customExamFormSection.classList.remove('hidden');
            } else {
                sourceTopicsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4">No topics with questions found for this lesson.</td></tr>`;
                customExamFormSection.classList.add('hidden');
            }
        } catch (error) { showToast('Failed to load source topics.', 'error'); }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const source_topics = [];
        document.querySelectorAll('#source-topics-table-body tr[data-topic-id]').forEach(row => {
            const countInput = row.querySelector('.question-count-input');
            if (countInput) {
                const count = parseInt(countInput.value, 10);
                if (!isNaN(count) && count > 0) {
                    source_topics.push({
                        topic_id: row.dataset.topicId,
                        question_count: count
                    });
                }
            }
        });

        if (source_topics.length === 0) {
            showToast('Please select at least one question to include.', 'error');
            return;
        }
        
        const new_exam_details = {
            subject_id: subjectFilter.value,
            lesson_id: lessonFilter.value,
            exam_title: document.getElementById('exam-title').value,
            duration: document.getElementById('duration').value,
            total_marks: document.getElementById('total-marks').value,
            pass_mark: document.getElementById('pass-mark').value,
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['subject_id', 'lesson_id', 'exam_title', 'duration', 'total_marks', 'pass_mark']) {
             if (!new_exam_details[key] || new_exam_details[key] === '0') {
                showToast(`${key.replace(/_/g, ' ')} is required.`, 'error');
                return;
            }
        }
        
        const submitButton = customExamForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Creating...`;

        try {
            const response = await fetch(CREATE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_exam_details, source_topics })
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, 'success');
                customExamForm.reset();
                fetchAndDisplaySourceTopics();
            } else {
                showToast(result.message || 'An unknown error occurred.', 'error');
            }
        } catch (error) { showToast('A network error occurred.', 'error'); } 
        finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<span class="material-symbols-outlined mr-2">ballot</span>Create Exam from Topics`;
        }
    }
    
    function setupEventListeners() {
        subjectFilter.addEventListener('change', () => {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectFilter.value}`, lessonFilter, 'Select Lesson', true);
            sourceTopicsSection.classList.add('hidden');
            customExamFormSection.classList.add('hidden');
        });
        lessonFilter.addEventListener('change', fetchAndDisplaySourceTopics);
        customExamForm.addEventListener('submit', handleFormSubmit);
    }

    populateDropdown(SUBJECT_API_URL, subjectFilter, 'Select Subject');
    setupEventListeners();
}
initializeCustomExamTopicsPage();
