function initializeQuestionsListPage() {
    const API_URL = 'api/question/';
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');
    const examTitle = params.get('exam_title');

    // DOM Elements
    const pageTitle = document.getElementById('page-title');
    const examSubtitle = document.getElementById('exam-subtitle');
    const questionsContainer = document.getElementById('questions-container');
    const backBtn = document.getElementById('back-to-import-btn');
    const editModal = document.getElementById('edit-question-modal');
    const deleteModal = document.getElementById('delete-question-confirm-modal');
    const editForm = document.getElementById('edit-question-form');
    const toastContainer = document.getElementById('toast-container');

    let questionIdToDelete = null;

    if (!examId) {
        questionsContainer.innerHTML = '<p class="text-red-500">No exam selected. Please go back and select an exam.</p>';
        return;
    }

    pageTitle.textContent = `Questions for: ${examTitle || 'Exam'}`;

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

    async function fetchAndDisplayQuestions() {
        try {
            const response = await fetch(`${API_URL}list.php?exam_id=${examId}`);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                currentQuestions = result.data;
                let html = '';
                result.data.forEach((q, index) => {
                    const priorityInt = parseInt(q.priority) || 0;
                    html += `
                        <div id="question-${q.id}" class="border rounded-lg p-4 bg-gray-50 flex flex-col highlight-target">
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-grow">
                                    <p class="text-gray-800 font-semibold">${index + 1}. ${q.question}</p>
                                    <div class="mt-2 flex flex-wrap gap-2 priority-controls" data-question-id="${q.id}">
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 0 ? 'bg-gray-200 border-gray-400 text-gray-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}" data-priority="0">0</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 1 ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'}" data-priority="1">P1</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 2 ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-yellow-300'}" data-priority="2">P2</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 3 ? 'bg-red-100 border-red-400 text-red-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-red-300'}" data-priority="3">P3</button>
                                    </div>
                                </div>
                                <div class="flex-shrink-0 ml-4">
                                    <button class="edit-btn p-1 text-green-600 hover:text-green-800" data-id="${q.id}"><span class="material-symbols-outlined">edit</span></button>
                                    <button class="delete-btn p-1 text-red-600 hover:text-red-800" data-id="${q.id}"><span class="material-symbols-outlined">delete</span></button>
                                </div>
                            </div>
                            <div class="mt-2 text-sm space-y-1 text-gray-600">
                                ${Object.entries(q.options).map(([key, value]) => `
                                    <p class="${key === q.answer ? 'font-bold text-green-700' : ''}"><strong>${key}:</strong> ${value}</p>
                                `).join('')}
                            </div>
                            <div class="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                                <strong>Explanation:</strong> ${q.explanation || 'N/A'}
                            </div>
                        </div>
                    `;
                });
                questionsContainer.innerHTML = html;
            } else {
                questionsContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No questions found for this exam.</p>`;
            }
        } catch (error) { showToast('Failed to load questions.', 'error'); }
    }

    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleEditFormSubmit() {
        const formData = new FormData(editForm);
        const data = {
            id: formData.get('id'),
            question: formData.get('question'),
            options: {
                A: formData.get('options[A]'),
                B: formData.get('options[B]'),
                C: formData.get('options[C]'),
                D: formData.get('options[D]'),
            },
            answer: formData.get('answer'),
            explanation: formData.get('explanation'),
            priority: parseInt(formData.get('priority')) || 0,
        };

        try {
            const response = await fetch(`${API_URL}update.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(editModal);
                fetchAndDisplayQuestions();
                showToast(result.message, 'update');
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('Network error.', 'error'); }
    }

    async function updateQuestionPriority(questionId, priority) {
        try {
            const response = await fetch(`api/question/set_priority.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId, priority: priority })
            });
            const result = await response.json();
            if (result.success) {
                if (!result.no_change) {
                    showToast(result.message, 'success');
                    // Update the local data to keep it in sync without a full fetch
                    const qIdx = currentQuestions.findIndex(q => q.id == questionId);
                    if (qIdx !== -1) currentQuestions[qIdx].priority = priority;
                }
                return true;
            } else {
                showToast(result.message, 'error');
                return false;
            }
        } catch (error) {
            showToast('Failed to update priority.', 'error');
            return false;
        }
    }

    async function handleDeleteConfirm() {
        if (!questionIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}delete.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteModal); fetchAndDisplayQuestions(); }
    }

    async function handleContainerClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            // Find the full question data from the already fetched list to pre-fill the modal
            const questionData = Array.from(questionsContainer.children)
                .map((_, index) => currentQuestions[index])
                .find(q => q.id == id);

            if (questionData) {
                document.getElementById('edit-question-id').value = questionData.id;
                document.getElementById('edit-question-text').value = questionData.question;
                document.getElementById('edit-option-a').value = questionData.options.A;
                document.getElementById('edit-option-b').value = questionData.options.B;
                document.getElementById('edit-option-c').value = questionData.options.C;
                document.getElementById('edit-option-d').value = questionData.options.D;
                document.getElementById('edit-answer').value = questionData.answer;
                document.getElementById('edit-explanation').value = questionData.explanation;

                // Set priority buttons in modal
                const priorityValue = questionData.priority || 0;
                document.getElementById('edit-priority').value = priorityValue;
                updateModalPriorityButtons(priorityValue);

                openModal(editModal);
            }
        }

        const quickPriorityBtn = e.target.closest('.quick-priority-btn');
        if (quickPriorityBtn) {
            const container = quickPriorityBtn.closest('.priority-controls');
            const questionId = container.dataset.questionId;
            const newPriority = parseInt(quickPriorityBtn.dataset.priority);

            const success = await updateQuestionPriority(questionId, newPriority);
            if (success) {
                // Update button UI immediately on the card
                const buttons = container.querySelectorAll('.quick-priority-btn');
                buttons.forEach(btn => {
                    const btnPriority = parseInt(btn.dataset.priority);
                    btn.className = getPriorityBtnClass(btnPriority, btnPriority === newPriority);
                });
            }
        }

        if (deleteBtn) {
            questionIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }
    }

    let currentQuestions = [];
    async function initialLoad() {
        try {
            const response = await fetch(`${API_URL}list.php?exam_id=${examId}`);
            const result = await response.json();
            if (result.success) {
                currentQuestions = result.data;
                await fetchAndDisplayQuestions();
                highlightTargetQuestion();
            } else {
                questionsContainer.innerHTML = `<p class="text-center text-red-500 py-8">${result.message}</p>`;
            }
        } catch (error) {
            showToast('Failed to load initial question data.', 'error');
        }
    }

    function highlightTargetQuestion() {
        const highlightId = params.get('highlight_id');
        if (!highlightId) return;

        // Use an interval to find the element if it's not immediately available
        let attempts = 0;
        const findAndHighlight = setInterval(() => {
            attempts++;
            const target = document.getElementById(`question-${highlightId}`);
            if (target) {
                clearInterval(findAndHighlight);
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.add('highlight-pulse');

                // Remove class after animation to allow re-highlighting
                setTimeout(() => {
                    target.classList.remove('highlight-pulse');
                }, 3000);
            }
            if (attempts > 20) clearInterval(findAndHighlight); // Stop after 4 seconds
        }, 200);
    }

    function getPriorityBtnClass(priority, isActive) {
        const base = "quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ";
        if (!isActive) return base + "bg-white border-gray-200 text-gray-400 hover:border-gray-300";

        switch (priority) {
            case 1: return base + "bg-blue-100 border-blue-400 text-blue-800 shadow-sm";
            case 2: return base + "bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm";
            case 3: return base + "bg-red-100 border-red-400 text-red-800 shadow-sm";
            default: return base + "bg-gray-200 border-gray-400 text-gray-800 shadow-sm";
        }
    }

    function updateModalPriorityButtons(activePriority) {
        const buttons = document.querySelectorAll('#edit-priority-buttons .priority-btn');
        buttons.forEach(btn => {
            const p = parseInt(btn.dataset.priority);
            if (p === activePriority) {
                btn.classList.add('ring-2', 'ring-offset-1', 'border-current');
                switch (p) {
                    case 0: btn.classList.add('ring-gray-400'); break;
                    case 1: btn.classList.add('ring-blue-400'); break;
                    case 2: btn.classList.add('ring-yellow-400'); break;
                    case 3: btn.classList.add('ring-red-400'); break;
                }
            } else {
                btn.classList.remove('ring-2', 'ring-offset-1', 'ring-gray-400', 'ring-blue-400', 'ring-yellow-400', 'ring-red-400', 'border-current');
            }
        });
    }

    // Modal Priority Button Click Handler
    document.getElementById('edit-priority-buttons').addEventListener('click', (e) => {
        const btn = e.target.closest('.priority-btn');
        if (btn) {
            const priority = parseInt(btn.dataset.priority);
            document.getElementById('edit-priority').value = priority;
            updateModalPriorityButtons(priority);
        }
    });

    // Event listeners
    backBtn.addEventListener('click', () => window.history.back()); // Simple back navigation
    document.getElementById('save-edit-btn').addEventListener('click', handleEditFormSubmit);
    questionsContainer.addEventListener('click', handleContainerClick);
    document.getElementById('close-edit-modal-btn').addEventListener('click', () => closeModal(editModal));
    document.getElementById('cancel-edit-modal-btn').addEventListener('click', () => closeModal(editModal));
    document.getElementById('cancel-question-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-question-delete-btn').addEventListener('click', handleDeleteConfirm);

    // --- Deduplication Feature ---

    async function ensureSimilarityEngine() {
        if (window.SimilarityEngine) return;
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'assets/js/similarity-engine.js';
            s.onload = resolve;
            document.head.appendChild(s);
        });
    }

    async function runSimilarityScan() {
        await ensureSimilarityEngine();
        const dedupeModal = document.getElementById('deduplication-modal');
        const workbench = document.getElementById('dedupe-workbench-content');
        const countBadge = document.getElementById('duplicate-count');

        // Show Modal
        dedupeModal.classList.remove('hidden');
        dedupeModal.classList.add('flex');
        setTimeout(() => {
            dedupeModal.classList.remove('scale-95', 'opacity-0');
        }, 10);

        // Reset UI
        workbench.innerHTML = `
            <div id="dedupe-loading" class="flex flex-col items-center justify-center h-64 text-gray-400">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
                <p class="font-medium">Comparing ${currentQuestions.length} questions...</p>
            </div>
        `;

        // Small delay for UI smoothness
        await new Promise(r => setTimeout(r, 800));

        const groups = [];
        const checked = new Set();
        const similarityThreshold = 0.90; // 90% commonality

        for (let i = 0; i < currentQuestions.length; i++) {
            if (checked.has(currentQuestions[i].id)) continue;

            const currentGroup = [currentQuestions[i]];
            for (let j = i + 1; j < currentQuestions.length; j++) {
                if (checked.has(currentQuestions[j].id)) continue;

                const score = SimilarityEngine.calculateSimilarity(currentQuestions[i].question, currentQuestions[j].question);
                if (score >= similarityThreshold) {
                    currentGroup.push(currentQuestions[j]);
                    checked.add(currentQuestions[j].id);
                }
            }

            if (currentGroup.length > 1) {
                groups.push({
                    master: currentGroup[0],
                    duplicates: currentGroup.slice(1),
                    avgScore: similarityThreshold // Placeholder
                });
                checked.add(currentQuestions[i].id);
            }
        }

        renderDedupeGroups(groups);
    }

    function renderDedupeGroups(groups) {
        const workbench = document.getElementById('dedupe-workbench-content');
        const countBadge = document.getElementById('duplicate-count');
        const resolveAllBtn = document.getElementById('resolve-all-btn');

        countBadge.textContent = groups.length;

        if (groups.length === 0) {
            if (resolveAllBtn) resolveAllBtn.classList.add('hidden');
            workbench.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                    <span class="material-symbols-outlined text-6xl mb-4 text-green-200">check_circle</span>
                    <p class="font-bold text-gray-600">Zero Duplicates Found!</p>
                    <p class="text-sm">Your question pool is unique and healthy.</p>
                </div>
            `;
            return;
        }

        if (resolveAllBtn) resolveAllBtn.classList.remove('hidden');

        workbench.innerHTML = groups.map((g, idx) => `
            <div class="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden group-entry" data-group-id="${idx}" id="group-${idx}">
                <div class="p-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded">MATCH GROUP #${idx + 1}</span>
                        <span class="text-xs text-indigo-400 font-medium">Potential Duplicates (${g.duplicates.length + 1})</span>
                    </div>
                    <button class="btn-bulk-resolve px-3 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 text-[10px] font-black rounded-lg transition-all border border-indigo-200 shadow-sm" 
                        data-group-idx="${idx}">
                        KEEP MASTER & DELETE OTHERS
                    </button>
                </div>
                <div class="divide-y divide-gray-100">
                    <!-- Master -->
                    <div class="p-6 bg-green-50/30 border-l-4 border-l-green-500">
                        <div class="flex justify-between items-start mb-4">
                            <span class="text-[10px] font-black tracking-widest text-green-600 uppercase">Master Copy</span>
                            <span class="text-xs font-mono text-gray-400">ID: ${g.master.id}</span>
                        </div>
                        <p class="text-gray-800 font-medium leading-relaxed">${g.master.question}</p>
                    </div>

                    <!-- Duplicates -->
                    ${g.duplicates.map(d => `
                        <div class="p-6 flex flex-col sm:flex-row gap-6 relative dedupe-row" id="dedupe-row-${d.id}" data-id="${d.id}">
                            <div class="flex-grow">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] font-black tracking-widest text-orange-500 uppercase">Duplicate Match</span>
                                    <span class="text-xs font-mono text-gray-400">ID: ${d.id}</span>
                                </div>
                                <p class="text-gray-600 text-sm italic line-clamp-3">${d.question}</p>
                            </div>
                            <div class="flex-shrink-0 flex sm:flex-col justify-end gap-2 border-l sm:pl-6 border-gray-100">
                                <button class="btn-keep-master px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors" data-id="${d.id}">IGNORE</button>
                                <button class="btn-delete-duplicate px-4 py-1.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 text-xs font-bold rounded-lg transition-all border border-red-100" data-id="${d.id}">DELETE</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Bulk Resolve Action
        workbench.querySelectorAll('.btn-bulk-resolve').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = btn.dataset.groupIdx;
                const group = groups[idx];
                await resolveMatchGroup(group, btn, idx);
            });
        });

        // Resolve All Groups logic
        const resolveAllListener = async () => {
            const totalDuplicates = groups.reduce((acc, g) => acc + g.duplicates.length, 0);
            if (!confirm(`CAUTION: This will permanently DELETE all ${totalDuplicates} identified duplicate questions across all groups. Proceed?`)) return;

            resolveAllBtn.disabled = true;
            resolveAllBtn.innerHTML = '<span class="animate-spin text-sm mr-2">refresh</span> Processing all...';

            let grandTotalDeleted = 0;
            for (let i = 0; i < groups.length; i++) {
                const groupBtn = workbench.querySelector(`.btn-bulk-resolve[data-group-idx="${i}"]`);
                if (groupBtn && !groupBtn.disabled) {
                    const deleted = await resolveMatchGroup(groups[i], groupBtn, i, true);
                    grandTotalDeleted += deleted;
                }
            }

            resolveAllBtn.innerHTML = `<span class="material-symbols-outlined text-sm mr-2">done_all</span> Finished (${grandTotalDeleted} Deleted)`;
            showToast(`Master cleanup complete: ${grandTotalDeleted} duplicates removed.`, 'success');
        };

        resolveAllBtn.onclick = resolveAllListener;

        async function resolveMatchGroup(group, btn, idx, isBatch = false) {
            if (!isBatch) {
                if (!confirm(`This will permanently DELETE ${group.duplicates.length} duplicate questions. Continue?`)) return 0;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="animate-pulse">DELETING...</span>';

            let successCount = 0;
            for (const d of group.duplicates) {
                const row = document.getElementById(`dedupe-row-${d.id}`);
                if (!row || row.classList.contains('hidden')) continue;

                try {
                    const response = await fetch(`${API_URL}delete.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: d.id })
                    });
                    const res = await response.json();
                    if (res.success) {
                        row.classList.add('hidden');
                        successCount++;
                    }
                } catch (e) { console.error(e); }
            }

            if (successCount > 0) {
                if (!isBatch) showToast(`Merged: Removed ${successCount} duplicates ✓`, 'success');
                btn.parentElement.innerHTML = `<span class="text-[10px] font-bold text-green-600 flex items-center gap-1"><span class="material-symbols-outlined text-sm">task_alt</span> RESOLVED</span>`;
                const groupEl = document.getElementById(`group-${idx}`);
                if (groupEl) groupEl.classList.add('opacity-60', 'grayscale-[0.5]');
                return successCount;
            } else {
                btn.disabled = false;
                btn.textContent = 'RETRY MERGE';
                return 0;
            }
        }

        // Individual Delete Action
        workbench.querySelectorAll('.btn-delete-duplicate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Delete this duplicate permanently?')) return;

                const row = document.getElementById(`dedupe-row-${id}`);
                row.style.opacity = '0.5';
                row.style.pointerEvents = 'none';

                try {
                    const response = await fetch(`${API_URL}delete.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id })
                    });
                    const res = await response.json();
                    if (res.success) {
                        row.classList.add('hidden');
                        showToast('Duplicate removed ✓', 'success');
                    }
                } catch (e) {
                    showToast('Delete failed', 'error');
                    row.style.opacity = '1';
                    row.style.pointerEvents = 'auto';
                }
            });
        });

        workbench.querySelectorAll('.btn-keep-master').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = document.getElementById(`dedupe-row-${btn.dataset.id}`);
                row.style.opacity = '0.3';
                row.querySelector('.flex-shrink-0').innerHTML = '<span class="text-[10px] text-gray-400 font-black uppercase">Ignored</span>';
            });
        });
    }

    // Initialize Dedupe Listeners
    setTimeout(() => {
        const scanBtn = document.getElementById('scan-duplicates-btn');
        const closeModalBtn = document.getElementById('close-dedupe-modal-btn');
        const finishBtn = document.getElementById('finish-dedupe-btn');
        const dedupeModal = document.getElementById('deduplication-modal');

        if (scanBtn) scanBtn.addEventListener('click', runSimilarityScan);
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
            dedupeModal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                dedupeModal.classList.add('hidden');
                dedupeModal.classList.remove('flex');
                fetchAndDisplayQuestions(); // Refresh main list
            }, 300);
        });
        if (finishBtn) finishBtn.addEventListener('click', () => closeModalBtn.click());
    }, 500);

    initialLoad();
}

initializeQuestionsListPage();
