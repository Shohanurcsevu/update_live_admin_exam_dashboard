function initializeImportQuestionsPage() {
    const EXAM_API_URL = 'api/exam/exam.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';
    const IMPORT_API_URL = 'api/question/import.php';

    // Post-import scan prompt
    function showPostImportScanPrompt(eId, eTitle) {
        eTitle = eTitle || 'Imported Exam';
        const existing = document.getElementById('post-import-scan-prompt');
        if (existing) existing.remove();
        const el = document.createElement('div');
        el.id = 'post-import-scan-prompt';
        el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-white rounded-2xl shadow-2xl border border-indigo-200 p-5 max-w-lg w-[90vw]';
        el.innerHTML = `<div class="flex items-start gap-4"><div class="p-3 bg-indigo-100 rounded-xl flex-shrink-0"><span class="material-symbols-outlined text-indigo-600 text-2xl">search_check</span></div><div class="flex-grow"><p class="font-bold text-gray-800 mb-1">Import Successful!</p><p class="text-sm text-gray-500 mb-3">Run a duplicate scan on <strong>${eTitle}</strong> to catch repeated questions?</p><div class="flex flex-wrap gap-2"><button class="scan-dedup-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2"><span class="material-symbols-outlined text-sm">search_check</span>Scan for Duplicates</button><button class="view-q-btn px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition-colors">View Questions</button><button class="dismiss-btn px-3 py-2 text-gray-400 hover:text-gray-600 text-xs font-bold rounded-xl transition-colors">Dismiss</button></div></div></div>`;
        document.body.appendChild(el);
        el.querySelector('.scan-dedup-btn').onclick = () => { el.remove(); if (window.loadPage) window.loadPage('questions-list', `?exam_id=${eId}&exam_title=${encodeURIComponent(eTitle)}&auto_scan=1`); };
        el.querySelector('.view-q-btn').onclick = () => { el.remove(); if (window.loadPage) window.loadPage('questions-list', `?exam_id=${eId}&exam_title=${encodeURIComponent(eTitle)}`); };
        el.querySelector('.dismiss-btn').onclick = () => el.remove();
        setTimeout(() => { if (el.parentNode) el.remove(); }, 15000);
    }

    // DOM Elements
    const tableBody = document.getElementById('exams-table-body');
    const toastContainer = document.getElementById('toast-container');

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

    let currentOffset = 0;
    const PAGE_SIZE = 10;

    async function fetchAndDisplayExams(isLoadMore = false) {
        const loadingMore = isLoadMore === true;
        const loadMoreContainer = document.getElementById('load-more-container');
        const loadMoreBtn = document.getElementById('load-more-btn');

        if (!loadingMore) {
            currentOffset = 0;
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">Loading exams...</td></tr>';
            if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
        }

        let url = `${EXAM_API_URL}?action=list&limit=${PAGE_SIZE}&offset=${currentOffset}`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        const query = params.toString();
        if (query) url += `&${query}`;

        console.log(`[Import Questions] Fetching: offset=${currentOffset}, limit=${PAGE_SIZE}, isLoadMore=${loadingMore}`);
        console.log(`[Import Questions] URL: ${url}`);

        // 1. Try to load from Cache (IndexedDB) first (only for initial load)
        if (!loadingMore && currentOffset === 0) {
            try {
                if (typeof idbManager !== 'undefined') {
                    const cachedExams = await idbManager.getAll('exams');
                    if (cachedExams && cachedExams.length > 0) {
                        let filteredExams = cachedExams;
                        if (subjectFilter.value > 0) filteredExams = filteredExams.filter(e => e.subject_id == subjectFilter.value);
                        if (lessonFilter.value > 0) filteredExams = filteredExams.filter(e => e.lesson_id == lessonFilter.value);
                        if (topicFilter.value > 0) filteredExams = filteredExams.filter(e => e.topic_id == topicFilter.value);

                        if (filteredExams.length > 0) {
                            displayExams(filteredExams.slice(0, PAGE_SIZE), false);
                        }
                    }
                }
            } catch (cacheError) {
                console.warn("Cache load failed:", cacheError);
            }
        }

        // 2. Fetch from API (Revalidate)
        try {
            if (loadingMore && loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Loading...';
            }

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                displayExams(result.data, loadingMore);

                // Update Cache (only for the initial/main list to keep it fast)
                if (typeof idbManager !== 'undefined' && currentOffset === 0) {
                    const changes = { exams: result.data };
                    await idbManager.performSyncTransaction(changes);
                }

                // Handle Pagination UI
                if (result.pagination) {
                    console.log("[Import Questions] Pagination info:", result.pagination);
                    if (result.pagination.hasMore) {
                        if (loadMoreContainer) loadMoreContainer.classList.remove('hidden');
                        currentOffset = result.pagination.offset + result.pagination.limit;
                        console.log("[Import Questions] Next Offset will be:", currentOffset);
                    } else {
                        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
                    }
                }
            } else if (result.success && result.data.length === 0 && !loadingMore) {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">No exams found for the selected filters.</td></tr>`;
                if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Fetch Exams Error:', error);
            if (!loadingMore && (tableBody.innerHTML === '' || tableBody.innerHTML.includes('Loading exams...'))) {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load exams.</td></tr>`;
            }
        } finally {
            if (loadingMore && loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.innerHTML = '<span class="material-symbols-outlined">expand_more</span> Load More Exams';
            }
        }
    }

    function displayExams(exams, append = false) {
        if (!append) tableBody.innerHTML = '';

        if (exams.length === 0 && !append) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500">No exams found.</td></tr>`;
            return;
        }

        exams.forEach(exam => {
            const rowId = `exam-row-import-${exam.id}`;
            if (document.getElementById(rowId)) return;

            const row = `
                <tr id="${rowId}" class="border-b border-gray-200 hover:bg-gray-100">
                    <td class="py-3 px-6 text-left font-medium">${exam.exam_title}</td>
                    <td class="py-3 px-6 text-left">${exam.topic_name || 'N/A'}</td>
                    <td class="py-3 px-6 text-left">${exam.subject_name || 'N/A'}</td>
                    <td class="py-3 px-6 text-center">
                        <div class="flex item-center justify-center space-x-2">
                            <button class="edit-questions-btn bg-green-500 hover:bg-green-600 text-white text-xs px-4 py-1.5 rounded-full flex items-center shadow-sm transition-all" data-id="${exam.id}" data-title="${exam.exam_title}">
                                <span class="material-symbols-outlined text-sm mr-1">edit</span> Manage Questions
                            </button>
                        </div>
                    </td>
                </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
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

                // Show scan prompt for the imported exam
                setTimeout(() => {
                    showPostImportScanPrompt(examId);
                }, 500);
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('A network error occurred during import.', 'error');
        }
    }

    function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-questions-btn');

        if (editBtn) {
            const examId = editBtn.dataset.id;
            const examTitle = encodeURIComponent(editBtn.dataset.title);
            if (window.loadPage) {
                window.loadPage('questions-list', `?exam_id=${examId}&exam_title=${examTitle}`);
            } else {
                console.error("loadPage function is not available.");
            }
        }
    }

    // Setup Listeners
    subjectFilter.addEventListener('change', () => {
        populateLessons(subjectFilter.value);
        fetchAndDisplayExams(false);
    });
    lessonFilter.addEventListener('change', () => {
        populateTopics(lessonFilter.value);
        fetchAndDisplayExams(false);
    });
    topicFilter.addEventListener('change', () => fetchAndDisplayExams(false));

    tableBody.addEventListener('click', handleTableClick);

    // Delegation for Load More button
    const pageContainer = document.getElementById('import-questions-container');
    if (pageContainer) {
        pageContainer.addEventListener('click', (e) => {
            const loadMoreBtn = e.target.closest('#load-more-btn');
            if (loadMoreBtn && !loadMoreBtn.disabled) {
                console.log("[Import Questions] Load More button clicked, current offset:", currentOffset);
                fetchAndDisplayExams(true);
            }
        });
    }

    // Initial Load
    populateSubjects();
    fetchAndDisplayExams();
}

initializeImportQuestionsPage();

