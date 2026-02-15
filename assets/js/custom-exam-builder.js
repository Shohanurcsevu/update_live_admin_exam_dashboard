function initializeCustomExamBuilderPage() {
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';
    const EXAM_LIST_API_URL = 'api/exam/exam.php';
    const CREATE_CUSTOM_EXAM_API_URL = 'api/custom-exam/create.php';

    // DOM Elements are selected inside setupEventListeners to ensure they exist.

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
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
            if (typeof CacheManager !== 'undefined') {
                const result = await CacheManager.fetchWithCache(url, 60);
                if (result && result.length > 0) {
                    result.forEach(item => {
                        selector.innerHTML += `<option value="${item.id}">${item.subject_name || item.lesson_name || item.topic_name}</option>`;
                    });
                    if (isDependent) selector.disabled = false;
                }
                return;
            }

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

    async function fetchAndDisplaySourceExams(topicFilter, sourceExamsSection, customExamFormSection) {
        const topicId = topicFilter.value;
        if (!topicId || topicId === '0') {
            sourceExamsSection.classList.add('hidden');
            customExamFormSection.classList.add('hidden');
            document.getElementById('priority-filters-section')?.classList.add('hidden');
            return;
        }

        sourceExamsSection.classList.remove('hidden');
        const sourceExamsTableBody = document.getElementById('source-exams-table-body');
        sourceExamsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4">Loading source exams...</td></tr>`;

        try {
            let result;
            if (typeof CacheManager !== 'undefined') {
                result = await CacheManager.fetchWithCache(`${EXAM_LIST_API_URL}?action=list&topic_id=${topicId}`, 15);
            } else {
                const response = await fetch(`${EXAM_LIST_API_URL}?action=list&topic_id=${topicId}`);
                const data = await response.json();
                result = data.success ? data.data : null;
            }

            sourceExamsTableBody.innerHTML = '';
            if (result && result.length > 0) {
                result.forEach(exam => {
                    const row = `
                        <tr class="border-b border-gray-200" data-exam-id="${exam.id}">
                            <td class="py-3 px-6 text-left font-medium">${exam.exam_title}</td>
                            <td class="py-3 px-6 text-center">${exam.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <input type="number" class="question-count-input w-24 text-center border border-gray-300 rounded-md" min="0" max="${exam.total_questions}" placeholder="0">
                            </td>
                        </tr>`;
                    sourceExamsTableBody.innerHTML += row;
                });
                customExamFormSection.classList.remove('hidden');
                document.getElementById('priority-filters-section')?.classList.remove('hidden');
            } else {
                sourceExamsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4">No source exams found for this topic.</td></tr>`;
                customExamFormSection.classList.add('hidden');
                document.getElementById('priority-filters-section')?.classList.add('hidden');
            }
        } catch (error) { showToast('Failed to load source exams.', 'error'); }
    }

    function getSelectedPriorities() {
        const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const sourceExams = [];
        document.querySelectorAll('#source-exams-table-body tr[data-exam-id]').forEach(row => {
            const countInput = row.querySelector('.question-count-input');
            if (countInput) {
                const count = parseInt(countInput.value, 10);
                if (!isNaN(count) && count > 0) {
                    sourceExams.push({
                        exam_id: parseInt(row.dataset.examId),
                        question_count: count
                    });
                }
            }
        });

        if (sourceExams.length === 0) {
            showToast('Please select at least one question from a source exam.', 'error');
            return;
        }

        const custom_exam_form_el = document.getElementById('custom-exam-form');
        const new_exam_details = {
            subject_id: parseInt(document.getElementById('subject-filter').value),
            lesson_id: parseInt(document.getElementById('lesson-filter').value),
            topic_id: parseInt(document.getElementById('topic-filter').value),
            exam_title: document.getElementById('exam-title').value,
            duration: parseInt(document.getElementById('duration').value),
            total_marks: parseFloat(document.getElementById('total-marks').value),
            pass_mark: parseFloat(document.getElementById('pass-mark').value),
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key in new_exam_details) {
            if (!new_exam_details[key] && new_exam_details[key] !== 0) {
                const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                showToast(`${fieldName} is required.`, 'error');
                return;
            }
        }

        const submitButton = custom_exam_form_el.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Creating...`;

        try {
            const payload = {
                new_exam_details,
                source_exams: sourceExams,
                priority_levels: getSelectedPriorities()
            };
            const response = await fetch(CREATE_CUSTOM_EXAM_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, 'success');

                // --- Cache Invalidation ---
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                    CacheManager.clearGroup('exam');
                    CacheManager.clearGroup('custom-exam');
                }

                custom_exam_form_el.reset();
                fetchAndDisplaySourceExams(document.getElementById('topic-filter'), document.getElementById('source-exams-section'), document.getElementById('custom-exam-form-section'));
            } else {
                showToast(result.message || 'An unknown error occurred.', 'error');
            }
        } catch (error) {
            showToast('A network error occurred. Please check the console.', 'error');
            console.error("Fetch Error:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<span class="material-symbols-outlined mr-2">construction</span>Create Custom Exam`;
        }
    }

    function setupEventListeners() {
        const subjectFilter = document.getElementById('subject-filter');
        const lessonFilter = document.getElementById('lesson-filter');
        const topicFilter = document.getElementById('topic-filter');
        const sourceExamsSection = document.getElementById('source-exams-section');
        const customExamFormSection = document.getElementById('custom-exam-form-section');
        const customExamForm = document.getElementById('custom-exam-form');

        if (!subjectFilter || !lessonFilter || !topicFilter || !customExamForm) {
            console.error("Required filter or form elements are missing from the DOM.");
            return;
        }

        subjectFilter.addEventListener('change', () => {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectFilter.value}`, lessonFilter, 'Select Lesson', true);
            topicFilter.innerHTML = '<option value="0">Select Lesson First</option>'; topicFilter.disabled = true;
            sourceExamsSection.classList.add('hidden'); customExamFormSection.classList.add('hidden');
        });
        lessonFilter.addEventListener('change', () => {
            populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonFilter.value}`, topicFilter, 'Select Topic', true);
            sourceExamsSection.classList.add('hidden'); customExamFormSection.classList.add('hidden');
        });
        topicFilter.addEventListener('change', () => fetchAndDisplaySourceExams(topicFilter, sourceExamsSection, customExamFormSection));

        customExamForm.addEventListener('submit', handleFormSubmit);
    }

    const subjectFilter = document.getElementById('subject-filter');
    if (subjectFilter) {
        populateDropdown(SUBJECT_API_URL, subjectFilter, 'Select Subject');
        setupEventListeners();
    } else {
        console.error("Could not find the initial subject filter to start the page logic.");
    }
}

initializeCustomExamBuilderPage();
