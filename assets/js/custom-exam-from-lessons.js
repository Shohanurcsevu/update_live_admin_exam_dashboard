/**
 * Main initialization function for the Custom Exam from Lessons page.
 * The main.js script ensures this entire file runs only after the page's HTML is fully loaded.
 */
function initializePage() {

    // --- API URLs ---
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/custom-exam/lessons.php';
    const CREATE_API_URL = 'api/custom-exam/from-lessons.php';

    // --- DOM Elements ---
    const subjectFilter = document.getElementById('subject-filter');
    const sourceLessonsSection = document.getElementById('source-lessons-section');
    const sourceLessonsTableBody = document.getElementById('source-lessons-table-body');
    const customExamFormSection = document.getElementById('custom-exam-form-section');
    const customExamForm = document.getElementById('custom-exam-form');
    const toastContainer = document.getElementById('toast-container');

    // --- Guard Clause: Stop if essential elements are missing ---
    if (!subjectFilter || !sourceLessonsSection || !customExamForm || !sourceLessonsTableBody) {
        console.error("Fatal Error: A required element for this page was not found. Script will not run.");
        return;
    }

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
    let currentColorClass = 'violet'; // Will be set when subject is selected
    function getCS(c) { return SUBJECT_COLORS[c] || SUBJECT_COLORS.violet; }

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
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
    };

    const populateSubjects = async () => {
        try {
            let result;
            if (typeof CacheManager !== 'undefined') {
                result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            } else {
                const response = await fetch(SUBJECT_API_URL);
                const data = await response.json();
                result = data.success ? data.data : null;
            }

            if (result) {
                subjectFilter.innerHTML = '<option value="0">Select Subject</option>';
                result.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}" data-color="${subject.color_class || 'violet'}">${subject.subject_name}</option>`;
                });
            } else {
                showToast('Failed to load subjects.', 'error');
            }
        } catch (error) { showToast('Network error fetching subjects.', 'error'); }
    };

    const fetchAndDisplaySourceLessons = async () => {
        const subjectId = subjectFilter.value;
        if (!subjectId || subjectId === '0') {
            sourceLessonsSection.classList.add('hidden');
            customExamFormSection.classList.add('hidden');
            return;
        }

        sourceLessonsSection.classList.remove('hidden');
        sourceLessonsTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">Loading lessons...</td></tr>`;

        try {
            let result;
            const url = `${LESSON_API_URL}?subject_id=${subjectId}`;
            if (typeof CacheManager !== 'undefined') {
                result = await CacheManager.fetchWithCache(url, 30);
            } else {
                const response = await fetch(url);
                const data = await response.json();
                result = data.success ? data.data : null;
            }

            sourceLessonsTableBody.innerHTML = '';
            if (result && result.length > 0) {
                // Get the color_class from current subject selection
                const selectedOption = subjectFilter.options[subjectFilter.selectedIndex];
                currentColorClass = selectedOption?.dataset?.color || 'violet';

                result.forEach(lesson => {
                    const isComplete = parseInt(lesson.is_complete) || 0;
                    const cs = getCS(currentColorClass);
                    const rowStyle = isComplete ? `style="background-color:${cs.bg};border-left:4px solid ${cs.border}"` : '';
                    const completeBadge = isComplete ? ` <span class="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold" style="background-color:${cs.badge};color:${cs.badgeText}">✓</span>` : '';
                    const nameStyle = isComplete ? `style="color:${cs.text}"` : '';

                    const row = `
                        <tr class="border-b" data-lesson-id="${lesson.id}" ${rowStyle}>
                            <td class="py-3 px-6 text-left font-medium" ${nameStyle}>${lesson.lesson_name}${completeBadge}</td>
                            <td class="py-3 px-6 text-center">${lesson.py_bcs_ques || 0}</td>
                            <td class="py-3 px-6 text-center">${lesson.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <input type="number" class="question-count-input w-24 text-center border border-gray-300 rounded-md" min="0" max="${lesson.total_questions}" placeholder="0" ${lesson.total_questions == 0 ? 'disabled' : ''}>
                            </td>
                        </tr>`;
                    sourceLessonsTableBody.innerHTML += row;
                });
                customExamFormSection.classList.remove('hidden');
            } else {
                sourceLessonsTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No lessons with questions found for this subject.</td></tr>`;
                customExamFormSection.classList.add('hidden');
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    };

    const getSelectedPriorities = () => {
        const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        const source_lessons = [];
        document.querySelectorAll('#source-lessons-table-body tr[data-lesson-id]').forEach(row => {
            const countInput = row.querySelector('.question-count-input');
            if (countInput) {
                const count = parseInt(countInput.value, 10);
                if (!isNaN(count) && count > 0) {
                    source_lessons.push({
                        lesson_id: parseInt(row.getAttribute('data-lesson-id')),
                        question_count: count
                    });
                }
            }
        });

        if (source_lessons.length === 0) {
            showToast('Please select questions from at least one lesson.', 'error');
            return;
        }

        const new_exam_details = {
            subject_id: parseInt(subjectFilter.value),
            exam_title: document.getElementById('exam-title').value,
            duration: parseInt(document.getElementById('duration').value),
            total_marks: parseFloat(document.getElementById('total-marks').value),
            pass_mark: parseFloat(document.getElementById('pass-mark').value),
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['subject_id', 'exam_title', 'duration', 'total_marks', 'pass_mark']) {
            if (!new_exam_details[key] && new_exam_details[key] !== 0) {
                showToast(`${key.replace(/_/g, ' ')} is required.`, 'error');
                return;
            }
        }

        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Creating...`;

        try {
            const payload = {
                new_exam_details,
                source_lessons,
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

                e.target.reset();
                document.querySelectorAll('.question-count-input').forEach(input => input.value = '');
            } else {
                showToast(result.message || 'An unknown error occurred.', 'error');
            }
        } catch (error) { showToast('A network error occurred.', 'error'); }
        finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<span class="material-symbols-outlined mr-2">layers</span>Create Exam from Lessons`;
        }
    };

    // --- Setup event listeners ---
    subjectFilter.addEventListener('change', fetchAndDisplaySourceLessons);
    customExamForm.addEventListener('submit', handleFormSubmit);

    // --- Initial page load ---
    populateSubjects();

}

// Call the main function to start the page logic
initializePage();
