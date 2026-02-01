function initializeCustomExamFromSubjectsPage() {
    const HIERARCHY_API_URL = 'api/custom-exam/subjects-with-details.php';
    const CREATE_API_URL = 'api/custom-exam/from-subjects.php';

    const tableBody = document.getElementById('source-hierarchy-table-body');
    const customExamForm = document.getElementById('custom-exam-form');
    const toastContainer = document.getElementById('toast-container');

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

    // --- MODIFIED: Moved renderTable outside to the main scope ---
    function renderTable(result) {
        if (!tableBody) return;
        tableBody.innerHTML = ''; // Clear previous content

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            let tableHTML = '';
            result.data.forEach(subject => {
                const lessons = subject.lessons || [];
                if (lessons.length === 0) {
                    tableHTML += `
                        <tr class="border-b border-gray-200 bg-gray-50">
                            <td class="py-3 px-6 align-top font-bold">${subject.subject_name}</td>
                            <td class="py-3 px-6 text-center text-gray-500" colspan="4">No lessons for this subject</td>
                        </tr>
                    `;
                } else {
                    lessons.forEach((lesson, index) => {
                        tableHTML += `
                            <tr class="border-b border-gray-200" data-lesson-id="${lesson.lesson_id}">
                                ${index === 0 ? `<td class="py-3 px-6 align-top font-bold" rowspan="${lessons.length}">${subject.subject_name}</td>` : ''}
                                <td class="py-3 px-6">${lesson.lesson_name}</td>
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
        
        // --- Using the TEST DATA ---
        const testData = {
          "success": true,
          "data": [
            { "subject_id": "10", "subject_name": "কম্পিউটার ও তথ্য প্রযুক্তি - ১৫", "lessons": [ { "lesson_id": 7, "lesson_name": "Test ANopther", "py_bcs_ques": 1, "total_questions": "3" }, { "lesson_id": 4, "lesson_name": "আইটি ", "py_bcs_ques": 6, "total_questions": "15" } ] },
            { "subject_id": "8", "subject_name": "বাংলা ব্যাকরণ - ১৫", "lessons": [ { "lesson_id": 5, "lesson_name": "বাগধারা ", "py_bcs_ques": 45, "total_questions": "4" } ] },
            { "subject_id": "7", "subject_name": "বাংলা সাহিত্য - ২০", "lessons": [ { "lesson_id": 3, "lesson_name": " চর্যাপদ ", "py_bcs_ques": 45, "total_questions": "4" } ] },
            { "subject_id": "9", "subject_name": "সাধারণ বিজ্ঞান - ১৫", "lessons": [ { "lesson_id": 6, "lesson_name": "তাপবিদ্যা ", "py_bcs_ques": 6, "total_questions": "4" } ] }
          ]
        };
        
        // Call the render function with the test data
        renderTable(testData);

        // NOTE: To switch back to live data, comment out the two lines above (`renderTable(testData);`)
        // and uncomment the `try...catch` block below.
        /*
        try {
            const response = await fetch(HIERARCHY_API_URL);
            const result = await response.json();
            renderTable(result);
        } catch (error) {
            showToast('Failed to load subject hierarchy.', 'error');
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">Error loading data.</td></tr>`;
        }
        */
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
                        lesson_id: row.dataset.lessonId,
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
            duration: document.getElementById('duration').value,
            total_marks: document.getElementById('total-marks').value,
            pass_mark: document.getElementById('pass-mark').value,
            instructions: 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।'
        };

        for (const key of ['exam_title', 'duration', 'total_marks', 'pass_mark']) {
             if (!new_exam_details[key]) {
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
                body: JSON.stringify({ new_exam_details, source_lessons })
            });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, 'success');
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
