function initializeTopicPage() {
    const TOPIC_API_URL = 'api/topic/topic.php';
    const SUBJECT_API_URL = 'api/topic/subjects.php';
    const LESSON_API_URL = 'api/topic/lessons.php';

    // DOM Elements
    const createBtn = document.getElementById('create-topic-btn');
    const topicModal = document.getElementById('topic-modal');
    const deleteModal = document.getElementById('delete-topic-confirm-modal');
    const topicForm = document.getElementById('topic-form');
    const tableBody = document.getElementById('topics-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const mainClearFiltersBtn = document.getElementById('main-clear-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const toastContainer = document.getElementById('toast-container');
    const tabManual = document.getElementById('tab-manual');
    const tabBulk = document.getElementById('tab-bulk');
    const manualModeContent = document.getElementById('manual-mode-content');
    const bulkModeContent = document.getElementById('bulk-mode-content');
    const bulkTopicsJson = document.getElementById('bulk-topics-json');
    const bulkInitBtn = document.getElementById('bulk-init-queue-btn');
    const bulkCategorizationContainer = document.getElementById('bulk-categorization-container');
    const bulkTableBody = document.getElementById('bulk-table-body');
    const importAllBtn = document.getElementById('import-all-btn');
    const importAllContainer = document.getElementById('import-all-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreContainer = document.getElementById('load-more-container');
    const totalTopicsBadge = document.getElementById('total-topics-badge');

    let topicIdToDelete = null;
    let currentMode = 'manual';
    let topicQueue = [];
    let subjectsList = [];

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            case 'update': bgColor = 'bg-yellow-500'; icon = 'notification_important'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    async function populateSubjects(selector) {
        try {
            const response = await fetch(SUBJECT_API_URL);
            const result = await response.json();
            if (result.success) {
                subjectsList = result.data; // Cache subjects
                selector.innerHTML = selector === subjectFilter ? '<option value="0">All Subjects</option>' : '<option value="">Select Subject</option>';
                result.data.forEach(subject => {
                    selector.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });

                // Restore main list filters
                if (selector === subjectFilter) {
                    const savedSubject = localStorage.getItem('filter_topic_subject');
                    if (savedSubject && savedSubject !== '0') {
                        subjectFilter.value = savedSubject;
                        populateLessons(savedSubject, lessonFilter, localStorage.getItem('filter_topic_lesson'));
                    } else {
                        fetchAndDisplayTopics();
                    }
                }
            }
        } catch (error) { showToast('Failed to load subjects.', 'error'); }
    }

    async function populateLessons(subjectId, selector, lessonToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!subjectId || subjectId === "0") {
            selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Subject First</option>';
            return;
        }

        try {
            const response = await fetch(`${LESSON_API_URL}?subject_id=${subjectId}`);
            const result = await response.json();
            if (result.success) {
                selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Lesson</option>';
                result.data.forEach(lesson => {
                    selector.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                selector.disabled = false;
                if (lessonToSelect) {
                    selector.value = lessonToSelect;
                }

                // Refresh list if this is the main filter
                if (selector === lessonFilter) {
                    fetchAndDisplayTopics();
                }
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    }

    let currentPage = 1;
    const LIMIT = 10;

    // List fetching logic

    async function fetchAndDisplayTopics(append = false) {
        if (!append) {
            currentPage = 1;
            // Only show loading if we are not appending
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="flex items-center justify-center gap-2"><span class="animate-spin material-symbols-outlined text-blue-600">progress_activity</span> Loading topics...</div></td></tr>';
        }

        const subjectId = subjectFilter.value;
        const lessonId = lessonFilter.value;
        let url = `${TOPIC_API_URL}?action=list&page=${currentPage}&limit=${LIMIT}`;
        if (subjectId > 0) url += `&subject_id=${subjectId}`;
        if (lessonId > 0) url += `&lesson_id=${lessonId}`;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!append) tableBody.innerHTML = '';

            if (result.success && result.data.length > 0) {
                // Update total topics counter
                if (totalTopicsBadge) {
                    totalTopicsBadge.textContent = result.total_count;
                    totalTopicsBadge.classList.remove('hidden');
                }

                result.data.forEach(topic => {
                    const createdExams = parseInt(topic.created_exams) || 0;
                    const expectedExams = parseInt(topic.expected_exams) || 0;
                    const examsLeft = Math.max(0, expectedExams - createdExams);
                    const progressPercent = expectedExams > 0 ? (createdExams / expectedExams) * 100 : 0;
                    const progressBarColor = progressPercent >= 100 ? 'bg-green-600' : 'bg-blue-600';

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100 transition-colors text-xs sm:text-sm">
                            <td class="py-3 px-4 sm:px-6 text-left font-medium text-gray-900">${topic.topic_name}</td>
                            <td class="py-3 px-4 sm:px-6 text-left hidden sm:table-cell">${topic.lesson_name}</td>
                            <td class="py-3 px-4 sm:px-6 text-left hidden sm:table-cell">${topic.subject_name}</td>
                            <td class="py-3 px-4 text-center whitespace-nowrap">${topic.start_page} - ${topic.end_page}</td>
                            <td class="py-3 px-4 text-center">
                                <div class="w-full min-w-[80px]">
                                    <div class="flex justify-between text-[10px] text-gray-600 mb-0.5">
                                        <span>${createdExams}/${expectedExams}</span>
                                        <span>${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-1.5">
                                        <div class="${progressBarColor} h-1.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                                    </div>
                                </div>
                            </td>
                            <td class="py-3 px-4 sm:px-6 text-center">
                                <div class="flex item-center justify-center gap-1 sm:gap-2">
                                    <button class="edit-btn p-1.5 sm:p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition" data-id="${topic.id}" title="Edit Topic"><span class="material-symbols-outlined text-base sm:text-lg">edit</span></button>
                                    <button class="delete-btn p-1.5 sm:p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" data-id="${topic.id}" title="Delete Topic"><span class="material-symbols-outlined text-base sm:text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.insertAdjacentHTML('beforeend', row);
                });

                // Show/Hide "Load More" button
                if (loadMoreContainer) {
                    if (result.page < result.total_pages) {
                        loadMoreContainer.classList.remove('hidden');
                    } else {
                        loadMoreContainer.classList.add('hidden');
                    }
                }
            } else {
                if (!append) {
                    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-500">
                        <span class="material-symbols-outlined text-5xl mb-2 block text-gray-300">topic</span>
                        No topics found matching your criteria.
                    </td></tr>`;
                    if (totalTopicsBadge) totalTopicsBadge.classList.add('hidden');
                }
                if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error fetching topics:', error);
            showToast('Failed to load topics.', 'error');
            if (!append) tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500 font-medium">Error loading topics. Please try again.</td></tr>`;
        }
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modal === topicModal) {
            bulkTopicsJson.value = '';
            bulkCategorizationContainer.classList.add('hidden');
            importAllContainer.classList.add('hidden');
            topicQueue = [];
        }
    }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    function switchTab(mode) {
        currentMode = mode;
        if (mode === 'manual') {
            tabManual.classList.add('border-blue-600', 'text-blue-600');
            tabManual.classList.remove('border-transparent', 'text-slate-400');
            tabBulk.classList.remove('border-blue-600', 'text-blue-600');
            tabBulk.classList.add('border-transparent', 'text-slate-400');
            manualModeContent.classList.remove('hidden');
            bulkModeContent.classList.add('hidden');
            bulkCategorizationContainer.classList.add('hidden');
            importAllContainer.classList.add('hidden');
            document.querySelectorAll('.manual-only').forEach(el => el.classList.remove('hidden'));
        } else {
            tabBulk.classList.add('border-blue-600', 'text-blue-600');
            tabBulk.classList.remove('border-transparent', 'text-slate-400');
            tabManual.classList.remove('border-blue-600', 'text-blue-600');
            tabManual.classList.add('border-transparent', 'text-slate-400');
            bulkModeContent.classList.remove('hidden');
            manualModeContent.classList.add('hidden');
            document.querySelectorAll('.manual-only').forEach(el => el.classList.add('hidden'));

            // Auto-paste logic
            if (!bulkTopicsJson.value.trim() && navigator.clipboard) {
                navigator.clipboard.readText().then(text => {
                    if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
                        bulkTopicsJson.value = text.trim();
                        showToast('JSON auto-pasted from clipboard!');
                    }
                }).catch(() => { });
            }
        }
    }

    function handleBulkInit() {
        const jsonText = bulkTopicsJson.value.trim();
        if (!jsonText) {
            showToast('Please provide a JSON array of topics.', 'error');
            return;
        }

        try {
            const topics = JSON.parse(jsonText);
            if (!Array.isArray(topics)) throw new Error('Input must be a JSON array.');

            topicQueue = topics.map(item => {
                const name = typeof item === 'string' ? item : (item.topic_name || '');
                const pFrom = item.page_from || item.start_page || '';
                const pTo = item.page_to || item.end_page || '';

                return {
                    name: name,
                    page_from: pFrom,
                    page_to: pTo,
                    subject_id: modalSubjectSelector.value || '',
                    lesson_id: modalLessonSelector.value || '',
                    isIncluded: !!name
                };
            });

            renderBulkTable();
            bulkCategorizationContainer.classList.remove('hidden');
            importAllContainer.classList.remove('hidden');
            showToast(`Queue initialized: ${topicQueue.length} topics detected.`);
        } catch (err) {
            showToast(`JSON Error: ${err.message}`, 'error');
        }
    }

    async function renderBulkTable() {
        bulkTableBody.innerHTML = '';
        for (let i = 0; i < topicQueue.length; i++) {
            const item = topicQueue[i];
            const row = document.createElement('tr');
            row.className = `hover:bg-slate-50 transition-all ${item.isIncluded ? '' : 'opacity-50 grayscale'}`;

            row.innerHTML = `
                <td class="py-2 px-3 text-center">
                    <input type="checkbox" class="include-check w-4 h-4 rounded border-slate-300 text-blue-600" ${item.isIncluded ? 'checked' : ''}>
                </td>
                <td class="py-2 px-3">
                    <input type="text" class="topic-name-input w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-bold" value="${item.name}">
                </td>
                <td class="py-2 px-2 w-[60px]">
                    <input type="number" class="page-from-input w-full px-1 py-1 bg-white border border-slate-200 rounded text-[11px] text-center" value="${item.page_from}" placeholder="From">
                </td>
                <td class="py-2 px-2 w-[60px]">
                    <input type="number" class="page-to-input w-full px-1 py-1 bg-white border border-slate-200 rounded text-[11px] text-center" value="${item.page_to}" placeholder="To">
                </td>
                <td class="py-2 px-3 max-w-[150px]">
                    <select class="subject-select w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] truncate">
                        <option value="">Subject</option>
                        ${subjectsList.map(s => `<option value="${s.id}" ${item.subject_id == s.id ? 'selected' : ''}>${s.subject_name}</option>`).join('')}
                    </select>
                </td>
                <td class="py-2 px-3 max-w-[150px]">
                    <select class="lesson-select w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] truncate" ${!item.subject_id ? 'disabled' : ''}>
                        <option value="">Lesson</option>
                    </select>
                </td>
                <td class="py-2 px-3 text-center">
                    ${i > 0 ? `
                        <button type="button" class="same-above-btn p-1 px-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition shadow-sm" title="Same as Above">
                            <span class="material-symbols-outlined text-sm">double_arrow</span>
                        </button>
                    ` : ''}
                </td>
            `;

            const subSel = row.querySelector('.subject-select');
            const lesSel = row.querySelector('.lesson-select');
            const nameInput = row.querySelector('.topic-name-input');
            const fromInput = row.querySelector('.page-from-input');
            const toInput = row.querySelector('.page-to-input');
            const includeCheck = row.querySelector('.include-check');
            const sameBtn = row.querySelector('.same-above-btn');

            if (item.subject_id) {
                populateLessons(item.subject_id, lesSel, item.lesson_id);
            }

            subSel.onchange = () => {
                item.subject_id = subSel.value;
                item.lesson_id = '';
                populateLessons(item.subject_id, lesSel);
            };

            lesSel.onchange = () => {
                item.lesson_id = lesSel.value;
            };

            nameInput.oninput = () => {
                item.name = nameInput.value;
            };

            fromInput.oninput = () => {
                item.page_from = fromInput.value;
            };

            toInput.oninput = () => {
                item.page_to = toInput.value;
            };

            includeCheck.onchange = () => {
                item.isIncluded = includeCheck.checked;
                row.classList.toggle('opacity-50', !item.isIncluded);
                row.classList.toggle('grayscale', !item.isIncluded);
            };

            if (sameBtn) {
                sameBtn.onclick = () => {
                    const prev = topicQueue[i - 1];
                    item.subject_id = prev.subject_id;
                    item.lesson_id = prev.lesson_id;
                    subSel.value = item.subject_id;
                    populateLessons(item.subject_id, lesSel, item.lesson_id);
                };
            }

            bulkTableBody.appendChild(row);
        }
    }

    async function processImportAll() {
        const toImport = topicQueue.filter(t => t.isIncluded && t.subject_id && t.lesson_id);
        if (!toImport.length) {
            showToast('No valid topics to import. Ensure Subject and Lesson are selected for included items.', 'error');
            return;
        }

        const originalBtnContent = importAllBtn.innerHTML;
        importAllBtn.disabled = true;
        let successCount = 0;

        for (let i = 0; i < toImport.length; i++) {
            const item = toImport[i];
            importAllBtn.innerHTML = `<span class="animate-spin material-symbols-outlined text-sm">sync</span> ${i + 1}/${toImport.length}`;

            try {
                const payload = {
                    subject_id: item.subject_id,
                    lesson_id: item.lesson_id,
                    topic_name: item.name,
                    start_page: item.page_from || 11,
                    end_page: item.page_to || 11,
                    expected_exams: 30
                };
                const response = await fetch(`${TOPIC_API_URL}?action=create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (result.success) successCount++;
            } catch (err) { console.error('Failed to import topic', item.name, err); }
        }

        importAllBtn.disabled = false;
        importAllBtn.innerHTML = originalBtnContent;

        showToast(`${successCount} topics imported successfully.`);
        closeModal(topicModal);
        if (typeof CacheManager !== 'undefined') {
            CacheManager.clearGroup('topic');
            CacheManager.clearGroup('exam');
        }
        fetchAndDisplayTopics();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        if (currentMode === 'bulk') return; // Handled by processImportAll

        const formData = new FormData(topicForm);
        const data = Object.fromEntries(formData.entries());
        const url = data.id ? `${TOPIC_API_URL}?action=update` : `${TOPIC_API_URL}?action=create`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(topicModal);
                // Cache Invalidation
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('topic');
                    CacheManager.clearGroup('exam');
                }
                fetchAndDisplayTopics();
                showToast(result.message, data.id ? 'update' : 'success');

                // Auto-fill: Save last used values for creation
                if (!data.id) {
                    localStorage.setItem('last_topic_subject_id', data.subject_id);
                    localStorage.setItem('last_topic_lesson_id', data.lesson_id);
                }
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('A network error occurred.', 'error'); }
    }

    async function handleDeleteConfirm() {
        if (!topicIdToDelete) return;
        try {
            const response = await fetch(`${TOPIC_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: topicIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally {
            closeModal(deleteModal);
            // Cache Invalidation
            if (typeof CacheManager !== 'undefined') {
                CacheManager.clearGroup('topic');
                CacheManager.clearGroup('exam');
            }
            fetchAndDisplayTopics();
        }
    }

    async function handleTableClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`${TOPIC_API_URL}?action=get_single&id=${id}`);
                const result = await response.json();
                if (result.success) {
                    const topic = result.data;
                    document.getElementById('topic-modal-title').textContent = 'Edit Topic';
                    document.getElementById('topic-id').value = topic.id;
                    modalSubjectSelector.value = topic.subject_id;
                    await populateLessons(topic.subject_id, modalLessonSelector, topic.lesson_id);
                    document.getElementById('topic-name').value = topic.topic_name;
                    document.getElementById('start-page').value = topic.start_page;
                    document.getElementById('end-page').value = topic.end_page;
                    document.getElementById('expected-exams').value = topic.expected_exams;
                    switchTab('manual');
                    tabBulk.classList.add('hidden'); // Hide bulk tab when editing
                    openModal(topicModal);
                }
            } catch (error) { showToast('Failed to fetch topic details.', 'error'); }
        }

        if (deleteBtn) {
            topicIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }
    }

    // Setup Listeners
    createBtn.addEventListener('click', () => {
        document.getElementById('topic-modal-title').textContent = 'Add New Topic';
        topicForm.reset();
        modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
        modalLessonSelector.disabled = true;
        document.getElementById('topic-id').value = '';

        // Auto-fill filters from localStorage
        const lastSubjectId = localStorage.getItem('last_topic_subject_id');
        const lastLessonId = localStorage.getItem('last_topic_lesson_id');

        if (lastSubjectId) {
            modalSubjectSelector.value = lastSubjectId;
            populateLessons(lastSubjectId, modalLessonSelector, lastLessonId);
        }

        // Prefill default values
        document.getElementById('start-page').value = 11;
        document.getElementById('end-page').value = 11;
        document.getElementById('expected-exams').value = 30;

        switchTab('manual');
        tabBulk.classList.remove('hidden');

        openModal(topicModal);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            modalSubjectSelector.value = "";
            modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
            modalLessonSelector.disabled = true;

            // Clear localStorage values
            localStorage.removeItem('last_topic_subject_id');
            localStorage.removeItem('last_topic_lesson_id');

            bulkTopicsJson.value = '';
        });
    }

    tabManual.addEventListener('click', () => switchTab('manual'));
    tabBulk.addEventListener('click', () => switchTab('bulk'));
    bulkInitBtn.addEventListener('click', handleBulkInit);
    importAllBtn.addEventListener('click', processImportAll);

    topicForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleTableClick);

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            fetchAndDisplayTopics(true);
        });
    }

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_topic_subject', subjectFilter.value);
        localStorage.removeItem('filter_topic_lesson');
        populateLessons(subjectFilter.value, lessonFilter);
        fetchAndDisplayTopics();
    });
    lessonFilter.addEventListener('change', () => {
        localStorage.setItem('filter_topic_lesson', lessonFilter.value);
        fetchAndDisplayTopics();
    });

    if (mainClearFiltersBtn) {
        mainClearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_topic_subject');
            localStorage.removeItem('filter_topic_lesson');

            subjectFilter.value = "0";
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;

            fetchAndDisplayTopics();
        });
    }

    // Modal dependent dropdown listener
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));

    // Modal close buttons
    document.getElementById('close-topic-modal-btn').addEventListener('click', () => closeModal(topicModal));
    document.getElementById('cancel-topic-modal-btn').addEventListener('click', () => closeModal(topicModal));
    document.getElementById('cancel-topic-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-topic-delete-btn').addEventListener('click', handleDeleteConfirm);

    // Initial Load
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
}

initializeTopicPage();
