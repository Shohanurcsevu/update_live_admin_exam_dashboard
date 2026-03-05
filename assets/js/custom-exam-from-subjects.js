function initializeCustomExamFromSubjectsPage() {
    const HIERARCHY_API_URL = 'api/custom-exam/subjects-with-details.php';
    const CREATE_API_URL = 'api/custom-exam/from-subjects.php';

    const tableBody = document.getElementById('source-hierarchy-table-body');
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

    if (!tableBody || !customExamForm) {
        console.error("Fatal Error: The required table or form element was not found in the HTML. Aborting script.");
        return;
    }

    function showToast(message, type = 'success') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) { case 'error': bgColor = 'bg-red-500'; icon = 'error'; break; default: bgColor = 'bg-green-500'; icon = 'check_circle'; break; }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    function renderTable(result) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            let tableHTML = '';
            result.data.forEach(subject => {
                const lessons = subject.lessons || [];
                const cc = subject.color_class || 'violet';
                const cs = getCS(cc);

                if (lessons.length === 0) {
                    tableHTML += `
                        <tr class="border-b border-gray-200 bg-gray-50">
                            <td class="py-3 px-6 align-top font-bold">${subject.subject_name}</td>
                            <td class="py-3 px-6 text-center text-gray-500" colspan="4">No lessons for this subject</td>
                        </tr>
                    `;
                } else {
                    lessons.forEach((lesson, index) => {
                        const isComplete = parseInt(lesson.is_complete) || 0;
                        const rowStyle = isComplete ? `style="background-color:${cs.bg};border-left:4px solid ${cs.border}"` : '';
                        const completeBadge = isComplete ? ` <span class="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold" style="background-color:${cs.badge};color:${cs.badgeText}">✓</span>` : '';
                        const nameStyle = isComplete ? `style="color:${cs.text}"` : '';

                        tableHTML += `
                            <tr class="border-b border-gray-200" data-lesson-id="${lesson.lesson_id}" ${rowStyle}>
                                ${index === 0 ? `<td class="py-3 px-6 align-top font-bold" rowspan="${lessons.length}" style="color:${cs.text}">${subject.subject_name}</td>` : ''}
                                <td class="py-3 px-6" ${nameStyle}>${lesson.lesson_name}${completeBadge}</td>
                                <td class="py-3 px-6 text-center">${lesson.py_bcs_ques || 0}</td>
                                <td class="py-3 px-6 text-center">${lesson.total_questions}</td>
                                <td class="py-3 px-6 text-center">
                                    <input type="number" class="question-count-input w-24 text-center border border-gray-300 rounded-md" min="0" max="${lesson.total_questions}" placeholder="0" ${lesson.total_questions == 0 ? 'disabled' : ''}>
                                </td>
                            </tr>
                        `;
                    });
                }
            });
            tableBody.innerHTML = tableHTML;
        } else {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8">No subjects found.</td></tr>`;
        }
    }

    async function fetchAndDisplayHierarchy() {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8">Loading hierarchy...</td></tr>`;

        try {
            let result;
            if (typeof CacheManager !== 'undefined') {
                result = await CacheManager.fetchWithCache(HIERARCHY_API_URL, 60);
            } else {
                const response = await fetch(HIERARCHY_API_URL);
                const data = await response.json();
                result = data.success ? data.data : null;
            }

            if (result) {
                renderTable({ success: true, data: result });
            } else {
                throw new Error("Failed to load hierarchy data.");
            }
        } catch (error) {
            console.warn('Live fetch failed, using test data fallback.', error);
            // --- Fallback TEST DATA ---
            const testData = {
                "success": true,
                "data": [
                    { "subject_id": "10", "subject_name": "কম্পিউটার ও তথ্য প্রযুক্তি - ১৫", "lessons": [{ "lesson_id": 7, "lesson_name": "Test ANopther", "py_bcs_ques": 1, "total_questions": "3" }, { "lesson_id": 4, "lesson_name": "আইটি ", "py_bcs_ques": 6, "total_questions": "15" }] },
                    { "subject_id": "8", "subject_name": "বাংলা ব্যাকরণ - ১৫", "lessons": [{ "lesson_id": 5, "lesson_name": "বাগধারা ", "py_bcs_ques": 45, "total_questions": "4" }] },
                    { "subject_id": "7", "subject_name": "বাংলা সাহিত্য - ২০", "lessons": [{ "lesson_id": 3, "lesson_name": " চর্যাপদ ", "py_bcs_ques": 45, "total_questions": "4" }] },
                    { "subject_id": "9", "subject_name": "সাধারণ বিজ্ঞান - ১৫", "lessons": [{ "lesson_id": 6, "lesson_name": "তাপবিদ্যা ", "py_bcs_ques": 6, "total_questions": "4" }] }
                ]
            };
            renderTable(testData);
        }
    }

    function getSelectedPriorities() {
        const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const source_lessons = [];
        document.querySelectorAll('#source-hierarchy-table-body tr[data-lesson-id]').forEach(row => {
            const countInput = row.querySelector('.question-count-input');
            if (countInput) {
                const count = parseInt(countInput.value, 10);
                if (!isNaN(count) && count > 0) {
                    source_lessons.push({
                        lesson_id: parseInt(row.dataset.lessonId),
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
            exam_title: document.getElementById('exam-title').value,
            duration: parseInt(document.getElementById('duration').value),
            total_marks: parseFloat(document.getElementById('total-marks').value),
            pass_mark: parseFloat(document.getElementById('pass-mark').value),
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['exam_title', 'duration', 'total_marks', 'pass_mark']) {
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

                customExamForm.reset();
                document.querySelectorAll('.question-count-input').forEach(input => input.value = '');
            } else {
                showToast(result.message || 'An unknown error occurred.', 'error');
            }
        } catch (error) { showToast('A network error occurred.', 'error'); }
        finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `<span class="material-symbols-outlined mr-2">science</span>Create Subject-Level Model Test`;
        }
    }

    customExamForm.addEventListener('submit', handleFormSubmit);
    fetchAndDisplayHierarchy();
}
initializeCustomExamFromSubjectsPage();
