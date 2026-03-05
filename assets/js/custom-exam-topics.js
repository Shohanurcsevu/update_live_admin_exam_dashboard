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

    // Subject color config for completion styling
    const SUBJECT_COLORS = window.SUBJECT_COLORS || {
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
    function getCS(c) { return SUBJECT_COLORS[c] || SUBJECT_COLORS.violet; }

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
            let result;
            const url = `${TOPIC_API_URL}?lesson_id=${lessonId}`;
            if (typeof CacheManager !== 'undefined') {
                result = await CacheManager.fetchWithCache(url, 30);
            } else {
                const response = await fetch(url);
                const data = await response.json();
                result = data.success ? data.data : null;
            }

            sourceTopicsTableBody.innerHTML = '';
            if (result && result.length > 0) {
                result.forEach(topic => {
                    const isComplete = parseInt(topic.lesson_is_complete) || 0;
                    // Get color from the subject filter's selected option
                    const selectedSubjectOpt = subjectFilter.options[subjectFilter.selectedIndex];
                    const cc = selectedSubjectOpt?.dataset?.color || 'violet';
                    const cs = getCS(cc);
                    const rowStyle = isComplete ? `style="background-color:${cs.bg};border-left:4px solid ${cs.border}"` : '';
                    const completeBadge = isComplete ? ` <span class="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold" style="background-color:${cs.badge};color:${cs.badgeText}">✓</span>` : '';
                    const nameStyle = isComplete ? `style="color:${cs.text}"` : '';

                    const row = `
                        <tr class="border-b border-gray-200" data-topic-id="${topic.id}" ${rowStyle}>
                            <td class="py-3 px-6 text-left font-medium" ${nameStyle}>${topic.topic_name}${completeBadge}</td>
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

    function getSelectedPriorities() {
        const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
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
                        topic_id: parseInt(row.dataset.topicId),
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
            subject_id: parseInt(subjectFilter.value),
            lesson_id: parseInt(lessonFilter.value),
            exam_title: document.getElementById('exam-title').value,
            duration: parseInt(document.getElementById('duration').value),
            total_marks: parseFloat(document.getElementById('total-marks').value),
            pass_mark: parseFloat(document.getElementById('pass-mark').value),
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['subject_id', 'lesson_id', 'exam_title', 'duration', 'total_marks', 'pass_mark']) {
            if (!new_exam_details[key] && new_exam_details[key] !== 0) {
                showToast(`${key.replace(/_/g, ' ')} is required.`, 'error');
                return;
            }
        }

        const submitButton = customExamForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Creating...`;

        try {
            const payload = {
                new_exam_details,
                source_topics,
                priority_levels: getSelectedPriorities()
            };
            const response = await fetch(CREATE_API_URL, {
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
