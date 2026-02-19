function initializeTakeExamListPage() {
    const API_URL = 'api/take-exam/';
    const tableBody = document.getElementById('exams-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');
    const cardView = document.getElementById('exams-card-view');

    let currentPage = 1;
    const itemsPerPage = 20;
    let isFetching = false;

    // --- Toast Function ---
    function showToast(message, type = 'error') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
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

                // Restore from localStorage
                const savedSubject = localStorage.getItem('filter_take_exam_subject');
                if (savedSubject && savedSubject !== '0') {
                    subjectFilter.value = savedSubject;
                    populateLessons(savedSubject);
                } else {
                    fetchAndDisplayExams();
                }
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

                // Restore from localStorage
                const savedLesson = localStorage.getItem('filter_take_exam_lesson');
                if (savedLesson && savedLesson !== '0') {
                    lessonFilter.value = savedLesson;
                    populateTopics(savedLesson);
                }
            }
        } catch (error) { showToast('Failed to load lessons.'); }
        finally {
            currentPage = 1; // Reset to page 1 on filter change
            fetchAndDisplayExams(false);
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

                // Restore from localStorage
                const savedTopic = localStorage.getItem('filter_take_exam_topic');
                if (savedTopic && savedTopic !== '0') {
                    topicFilter.value = savedTopic;
                }
            }
        } catch (error) { showToast('Failed to load topics.'); }
        finally {
            currentPage = 1;
            fetchAndDisplayExams(false);
        }
    }

    // --- Exam Table Logic ---
    async function fetchAndDisplayExams(append = false) {
        if (isFetching) return;
        isFetching = true;

        if (!append) {
            currentPage = 1;
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-8"><span class="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span><p class="mt-2 text-gray-500">Loading exams...</p></td></tr>';
            cardView.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-blue-500"><span class="material-symbols-outlined animate-spin text-5xl">sync</span><p class="mt-4 text-gray-600 font-medium">Loading exams...</p></div>';
            loadMoreBtn.classList.add('hidden');
        }

        let url = `${API_URL}exams.php?page=${currentPage}&limit=${itemsPerPage}&`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        url += params.toString();

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!append) {
                tableBody.innerHTML = '';
                cardView.innerHTML = '';
            }

            if (result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    // Prepare Status & Score Badges
                    const isTaken = exam.attempt_count && exam.attempt_count > 0;
                    const statusBadge = isTaken
                        ? `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Taken</span>`
                        : `<span class="bg-gray-100 text-gray-400 px-2 py-1 rounded text-[10px] font-bold uppercase">New</span>`;

                    const scoreDisplay = exam.last_score !== null
                        ? `<div class="text-xs font-bold text-indigo-600 mt-0.5">${parseFloat(exam.last_score).toFixed(1)} / ${exam.total_marks}</div>`
                        : `<div class="text-xs text-gray-400 mt-0.5">--</div>`;

                    // Desktop Table Row
                    const row = `
                        <tr class="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors">
                            <td class="py-3 px-6 text-left font-semibold text-gray-800">${exam.exam_title}</td>
                            <td class="py-3 px-6 text-left text-gray-600">${exam.topic_name || 'N/A'}</td>
                            <td class="py-3 px-6 text-center">
                                <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">${exam.duration} min</span>
                            </td>
                            <td class="py-3 px-6 text-center">
                                <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">${exam.total_questions} Qs</span>
                            </td>
                            <td class="py-3 px-6 text-center">
                                ${statusBadge}
                                ${scoreDisplay}
                            </td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button class="take-exam-btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95" data-id="${exam.id}">Take</button>
                                    <button class="print-exam-btn border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" title="Print">
                                        <span class="material-symbols-outlined text-sm">print</span>
                                    </button>
                                    <button class="delete-exam-btn bg-red-100 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all" data-id="${exam.id}" title="Delete">
                                        <span class="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;

                    // Mobile Card
                    const card = `
                        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden">
                            ${isTaken ? `<div class="absolute top-0 right-0 px-3 py-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-tighter rounded-bl-xl shadow-sm">Taken (${exam.attempt_count})</div>` : ''}
                            <div>
                                <h3 class="font-bold text-gray-900 leading-tight pr-12">${exam.exam_title}</h3>
                                <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">label</span>
                                    ${exam.topic_name || 'N/A'}
                                </p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">schedule</span>
                                    ${exam.duration}m
                                </span>
                                <span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">quiz</span>
                                    ${exam.total_questions}Q
                                </span>
                                ${isTaken ? `
                                <span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1">
                                    <span class="material-symbols-outlined text-xs">grade</span>
                                    ${parseFloat(exam.last_percentage).toFixed(0)}%
                                </span>` : ''}
                            </div>
                            <div class="grid grid-cols-3 gap-2 pt-2">
                                <button class="take-exam-btn w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center" data-id="${exam.id}">Take</button>
                                <button class="print-exam-btn w-full border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1 transition-all" data-id="${exam.id}">
                                    <span class="material-symbols-outlined text-sm">print</span> Print
                                </button>
                                <button class="delete-exam-btn w-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1 transition-all" data-id="${exam.id}">
                                    <span class="material-symbols-outlined text-sm">delete</span> Del
                                </button>
                            </div>
                        </div>`;
                    cardView.innerHTML += card;
                });

                // Update Pagination UI
                const totalLoaded = tableBody.querySelectorAll('tr').length;
                currentCountEl.textContent = totalLoaded;
                totalCountEl.textContent = result.pagination.total;

                if (result.pagination.has_more) {
                    loadMoreBtn.classList.remove('hidden');
                } else {
                    loadMoreBtn.classList.add('hidden');
                }
            } else if (!append) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-medium">No exams found for the selected filters.</td></tr>`;
                cardView.innerHTML = `<div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-12 px-6 text-center text-gray-400 font-medium">No exams found for selection.</div>`;
                currentCountEl.textContent = 0;
                totalCountEl.textContent = 0;
            }
        } catch (error) {
            showToast('Failed to load exams.');
        } finally {
            isFetching = false;
        }
    }

    // --- Event Listeners ---
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_subject', subjectFilter.value);
        localStorage.removeItem('filter_take_exam_lesson');
        localStorage.removeItem('filter_take_exam_topic');
        populateLessons(subjectFilter.value);
    });

    lessonFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_lesson', lessonFilter.value);
        localStorage.removeItem('filter_take_exam_topic');
        populateTopics(lessonFilter.value);
    });

    topicFilter.addEventListener('change', () => {
        localStorage.setItem('filter_take_exam_topic', topicFilter.value);
        fetchAndDisplayExams(false);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_take_exam_subject');
            localStorage.removeItem('filter_take_exam_lesson');
            localStorage.removeItem('filter_take_exam_topic');

            subjectFilter.value = '0';
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;

            fetchAndDisplayExams(false);
        });
    }

    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        fetchAndDisplayExams(true);
    });

    tableBody.addEventListener('click', (e) => handleListClick(e));
    cardView.addEventListener('click', (e) => handleListClick(e));

    // Delete Modal Logic
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    let examIdToDelete = null;

    function handleListClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('take-exam-btn')) {
            const examId = target.dataset.id;
            if (window.loadPage) {
                window.loadPage('take-exam-interface', `?exam_id=${examId}`);
            }
        } else if (target.classList.contains('print-exam-btn')) {
            const examId = target.dataset.id;
            handlePrintExam(examId);
        } else if (target.classList.contains('delete-exam-btn')) {
            examIdToDelete = target.dataset.id;
            deleteModal.classList.remove('hidden');
            deleteModal.classList.add('flex');
        }
    }

    // Delete Modal Button Listeners
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
        examIdToDelete = null;
    });

    document.getElementById('confirm-exam-delete-btn').addEventListener('click', async () => {
        if (!examIdToDelete) return;

        const confirmBtn = document.getElementById('confirm-exam-delete-btn');
        const originalText = confirmBtn.innerText;
        confirmBtn.disabled = true;
        confirmBtn.innerText = 'Deleting...';

        try {
            // Reusing the main exam delete API
            const response = await fetch(`api/exam/exam.php?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examIdToDelete })
            });
            const result = await response.json();

            if (result.success) {
                showToast('Exam deleted successfully.', 'success');
                fetchAndDisplayExams(false); // Refresh list
            } else {
                showToast(result.message || 'Failed to delete exam.');
            }
        } catch (error) {
            showToast('Network error occurred.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerText = originalText;
            deleteModal.classList.add('hidden');
            deleteModal.classList.remove('flex');
            examIdToDelete = null;
        }
    });

    async function handlePrintExam(examId) {
        if (!window.PrintEngine) {
            showToast('Print engine not loaded.');
            return;
        }

        PrintEngine.openModal(examId);

        PrintEngine.onGenerate = async () => {
            const generateBtn = document.getElementById('generate-pdf-btn');
            const originalText = generateBtn.innerHTML;
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Loading Questions...';

            try {
                const response = await fetch(`api/take-exam/start.php?exam_id=${examId}`);
                const result = await response.json();
                if (result.success) {
                    PrintEngine.generatePDF(result.data);
                    PrintEngine.closeModal();
                } else {
                    showToast(result.message || 'Failed to fetch exam data.');
                }
            } catch (error) {
                showToast('An error occurred while fetching exam data.');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = originalText;
            }
        };
    }

    // --- Initial Load ---
    populateSubjects();
}
initializeTakeExamListPage();

