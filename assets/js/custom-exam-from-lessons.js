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
            const response = await fetch(SUBJECT_API_URL);
            const result = await response.json();
            if (result.success) {
                subjectFilter.innerHTML = '<option value="0">Select Subject</option>';
                result.data.forEach(subject => {
                    subjectFilter.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
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
            const response = await fetch(`${LESSON_API_URL}?subject_id=${subjectId}`);
            const result = await response.json();
            sourceLessonsTableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(lesson => {
                    const row = `
                        <tr class="border-b" data-lesson-id="${lesson.id}">
                            <td class="py-3 px-6 text-left font-medium">${lesson.lesson_name}</td>
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

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        const source_lessons = [];
        document.querySelectorAll('#source-lessons-table-body tr[data-lesson-id]').forEach(row => {
            const countInput = row.querySelector('.question-count-input');
            if (countInput) {
                const count = parseInt(countInput.value, 10);
                if (!isNaN(count) && count > 0) {
                    source_lessons.push({
                        lesson_id: row.getAttribute('data-lesson-id'),
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
            subject_id: subjectFilter.value,
            exam_title: document.getElementById('exam-title').value,
            duration: document.getElementById('duration').value,
            total_marks: document.getElementById('total-marks').value,
            pass_mark: document.getElementById('pass-mark').value,
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['subject_id', 'exam_title', 'duration', 'total_marks', 'pass_mark']) {
             if (!new_exam_details[key] || new_exam_details[key] === '0') {
                showToast(`${key.replace(/_/g, ' ')} is required.`, 'error');
                return;
            }
        }
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Creating...`;

        try {
            const response = await fetch(CREATE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_exam_details, source_lessons })
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, 'success');
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
