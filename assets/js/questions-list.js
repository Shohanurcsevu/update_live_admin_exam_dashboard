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

    function invalidateExamCaches() {
        if (typeof CacheManager !== 'undefined') {
            CacheManager.clearGroup('exam');
            CacheManager.clearGroup('dashboard');
            console.log('[QuestionsList] Exam caches invalidated due to deletion.');
        }
    }

    async function handleDeleteConfirm() {
        if (!questionIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}delete.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionIdToDelete }) });
            const result = await response.json();
            if (result.success) {
                invalidateExamCaches();
                showToast(result.message, 'error');
            } else {
                showToast(result.message, 'error');
            }
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

                // Auto-trigger scan if redirected from import
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('auto_scan') === '1' && currentQuestions.length > 0) {
                    // Clean URL to avoid re-scan on refresh
                    urlParams.delete('auto_scan');
                    const cleanUrl = `${window.location.pathname}?${urlParams.toString()}`;
                    window.history.replaceState({}, '', cleanUrl);
                    // Wait for DOM to settle, then trigger scan
                    setTimeout(() => runSimilarityScan(), 800);
                }
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

    // Store all pair scores for re-filtering without re-computing (Session Persistent)
    if (!window._dedupeState) {
        window._dedupeState = {
            allPairScores: [],
            dedupeHistory: [],
            lastThreshold: 90
        };
    }

    async function ensureSimilarityEngine() {
        if (window.SimilarityEngine) return;
        return new Promise((resolve) => {
            const s = document.createElement('script');
            // Cache busting for development/debugging
            s.src = 'assets/js/similarity-engine.js?v=' + Date.now();
            s.onload = resolve;
            document.head.appendChild(s);
        });
    }

    function addToHistory(questionData, masterId) {
        window._dedupeState.dedupeHistory.unshift({
            id: questionData.id,
            question: questionData.question,
            examId: examId,
            masterId: masterId,
            timestamp: new Date(),
            restored: false
        });
        renderHistory();
    }

    function renderHistory() {
        const list = document.getElementById('dedupe-history-list');
        const count = document.getElementById('history-count');
        const badge = document.getElementById('history-badge');
        const toggleBtn = document.getElementById('toggle-history-btn');

        if (!list) return;

        const activeCount = window._dedupeState.dedupeHistory.filter(h => !h.restored).length;
        if (count) count.textContent = window._dedupeState.dedupeHistory.length;
        if (badge) badge.textContent = activeCount;
        if (toggleBtn) {
            window._dedupeState.dedupeHistory.length > 0 ? toggleBtn.classList.remove('hidden') : toggleBtn.classList.add('hidden');
        }

        if (window._dedupeState.dedupeHistory.length === 0) {
            list.innerHTML = '<p class="text-xs text-gray-400 italic">No deletions yet in this session.</p>';
            return;
        }

        list.innerHTML = window._dedupeState.dedupeHistory.map((h, idx) => `
            <div class="flex items-center gap-3 p-3 rounded-lg border ${h.restored ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100'} transition-all" id="history-entry-${idx}">
                <div class="flex-shrink-0">
                    <span class="material-symbols-outlined text-lg ${h.restored ? 'text-green-500' : 'text-red-400'}">${h.restored ? 'undo' : 'delete'}</span>
                </div>
                <div class="flex-grow min-w-0">
                    <p class="text-xs font-medium text-gray-700 truncate">${h.question}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[10px] text-gray-400">ID: ${h.id}</span>
                        <span class="text-[10px] text-gray-400">•</span>
                        <span class="text-[10px] text-gray-400">${h.timestamp.toLocaleTimeString()}</span>
                        ${h.restored ? '<span class="text-[10px] text-green-600 font-bold">✓ Restored</span>' : ''}
                    </div>
                </div>
                ${!h.restored ? `
                    <button class="btn-undo-delete flex-shrink-0 px-3 py-1.5 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 text-[10px] font-black rounded-lg transition-all border border-amber-200"
                        data-history-idx="${idx}" data-question-id="${h.id}">
                        UNDO
                    </button>
                ` : ''}
            </div>
        `).join('');

        // Wire undo buttons
        list.querySelectorAll('.btn-undo-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const qId = parseInt(btn.dataset.questionId);
                const histIdx = parseInt(btn.dataset.historyIdx);
                btn.disabled = true;
                btn.textContent = 'RESTORING...';

                try {
                    const resp = await fetch(`${API_URL}restore.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: qId })
                    });
                    const res = await resp.json();
                    if (res.success) {
                        window._dedupeState.dedupeHistory[histIdx].restored = true;
                        invalidateExamCaches();
                        renderHistory();
                        showToast(`Question #${qId} has been restored ✓`, 'success');
                    } else {
                        btn.disabled = false;
                        btn.textContent = 'RETRY';
                        showToast(`Failed to restore: ${res.message}`, 'error');
                    }
                } catch (e) {
                    btn.disabled = false;
                    btn.textContent = 'RETRY';
                    showToast('Network error during restore', 'error');
                }
            });
        });
    }

    async function runSimilarityScan(skipAnimation = false) {
        await ensureSimilarityEngine();
        const dedupeModal = document.getElementById('deduplication-modal');
        const workbench = document.getElementById('dedupe-workbench-content');
        const slider = document.getElementById('dedupe-sensitivity-slider');
        const sliderLabel = document.getElementById('dedupe-sensitivity-label');
        const footerText = document.getElementById('dedupe-footer-text');

        // Show Modal
        if (!skipAnimation) {
            dedupeModal.classList.remove('hidden');
            dedupeModal.classList.add('flex');
            setTimeout(() => {
                dedupeModal.classList.remove('scale-95', 'opacity-0');
            }, 10);
        }

        // Compute all pair scores only on first scan OR if questions changed
        if (window._dedupeState.allPairScores.length === 0) {
            workbench.innerHTML = `
                <div id="dedupe-loading" class="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
                    <p class="font-medium">Comparing ${currentQuestions.length} questions...</p>
                </div>
            `;
            await new Promise(r => setTimeout(r, 600));

            // Pre-compute ALL pair scores
            for (let i = 0; i < currentQuestions.length; i++) {
                for (let j = i + 1; j < currentQuestions.length; j++) {
                    const result = SimilarityEngine.calculateFullSimilarity(currentQuestions[i], currentQuestions[j]);
                    if (result.score >= 0.70) { // Store anything ≥ 70% for Similar tier
                        window._dedupeState.allPairScores.push({
                            i: i, j: j,
                            idI: currentQuestions[i].id, idJ: currentQuestions[j].id,
                            score: result.score
                        });
                    }
                }
            }
        }

        // Build groups using current threshold
        const threshold = parseInt(slider.value) / 100;
        sliderLabel.textContent = slider.value + '%';
        if (footerText) footerText.textContent = `Accuracy: ${slider.value}%+ Similarity (Local Scan)`;

        const duplicateGroups = buildGroups(threshold, 1.0);
        const similarGroups = buildGroups(0.70, threshold);

        renderDedupeGroups(duplicateGroups, similarGroups);

        // Wire slider for live re-scanning
        if (!slider._wired) {
            slider.addEventListener('input', () => {
                sliderLabel.textContent = slider.value + '%';
            });
            let debounceTimer;
            slider.addEventListener('change', () => {
                window._dedupeState.lastThreshold = parseInt(slider.value);
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => runSimilarityScan(true), 100);
            });
            slider._wired = true;
        }

        // Set slider to last used value
        if (slider.value != window._dedupeState.lastThreshold) {
            slider.value = window._dedupeState.lastThreshold;
            sliderLabel.textContent = slider.value + '%';
        }
    }

    async function bulkDeleteQuestions(ids, reason = 'Cleanup') {
        try {
            const resp = await fetch(`api/question/bulk_delete.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: ids, reason: reason })
            });
            return await resp.json();
        } catch (e) {
            console.error('[BulkDelete] Error:', e);
            return { success: false, message: 'Network error' };
        }
    }

    function buildGroups(minScore, maxScore) {
        const groups = [];
        const checked = new Set();

        // Sort pair scores descending for greedy grouping
        const relevantPairs = window._dedupeState.allPairScores
            .filter(p => p.score >= minScore && p.score <= maxScore)
            .sort((a, b) => b.score - a.score);

        for (const pair of relevantPairs) {
            if (checked.has(pair.idI) && checked.has(pair.idJ)) continue;

            const masterIdx = pair.i;
            const master = currentQuestions[masterIdx];

            if (!checked.has(master.id)) {
                const groupDuplicates = [];
                const groupScores = [];

                // Find all pairs where this master is involved
                for (const p of relevantPairs) {
                    if (p.idI === master.id && !checked.has(p.idJ)) {
                        const dup = currentQuestions[p.j];
                        dup.matchScore = p.score;
                        groupDuplicates.push(dup);
                        groupScores.push(p.score);
                        checked.add(p.idJ);
                    } else if (p.idJ === master.id && !checked.has(p.idI)) {
                        const dup = currentQuestions[p.i];
                        dup.matchScore = p.score;
                        groupDuplicates.push(dup);
                        groupScores.push(p.score);
                        checked.add(p.idI);
                    }
                }

                if (groupDuplicates.length > 0) {
                    const avgScore = groupScores.reduce((a, b) => a + b, 0) / groupScores.length;
                    groups.push({ master, duplicates: groupDuplicates, avgScore });
                    checked.add(master.id);
                }
            }
        }
        return groups;
    }

    function renderDedupeGroups(groups, similarGroups = []) {
        const workbench = document.getElementById('dedupe-workbench-content');
        const countBadge = document.getElementById('duplicate-count');
        const similarCountText = document.getElementById('similar-count-text');
        const resolveAllBtn = document.getElementById('resolve-all-btn');

        let scanGroups = groups;
        let scanSimilarGroups = similarGroups;

        const renderWorkbench = () => {
            countBadge.textContent = scanGroups.length;
            if (similarCountText) {
                similarCountText.innerHTML = scanSimilarGroups.length > 0
                    ? ` · <span class="font-bold text-amber-500">${scanSimilarGroups.length}</span> similar`
                    : '';
            }

            if (scanGroups.length === 0 && scanSimilarGroups.length === 0) {
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

            if (resolveAllBtn) {
                scanGroups.length > 0 ? resolveAllBtn.classList.remove('hidden') : resolveAllBtn.classList.add('hidden');
            }

            let html = '';

            // --- Duplicate Groups (Indigo) ---
            html += scanGroups.map((g, idx) => {
                const masterPriority = parseInt(g.master.priority) || 0;
                const suggestedGroupPriority = Math.max(0, masterPriority - 1);
                const dupsNeedLowering = g.duplicates.filter(d => (parseInt(d.priority) || 0) > suggestedGroupPriority).length;
                const prioLabels = ['Standard', 'P1 Low', 'P2 Medium', 'P3 High'];
                const prioColors = ['bg-gray-100 text-gray-500', 'bg-blue-100 text-blue-600', 'bg-yellow-100 text-yellow-600', 'bg-red-100 text-red-600'];
                return `
                <div class="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden group-entry" data-group-id="${idx}" id="group-${idx}">
                    <div class="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-wrap justify-between items-center gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded">DUPLICATE #${idx + 1}</span>
                            <span class="text-xs text-indigo-400 font-medium">Potential Duplicates (${g.duplicates.length + 1})</span>
                            <span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded shadow-sm border border-green-200">AVG: ${Math.round(g.avgScore * 100)}% Match</span>
                            ${dupsNeedLowering > 0 ? `<button class="btn-lower-all-priority px-3 py-1 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 text-[10px] font-black rounded-lg transition-all border border-amber-200 shadow-sm flex items-center gap-1" data-group-idx="${idx}"><span class="material-symbols-outlined text-xs">low_priority</span>LOWER ${dupsNeedLowering} DUPLICATE${dupsNeedLowering > 1 ? 'S' : ''} PRIORITY</button>` : ''}
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
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-black tracking-widest text-green-600 uppercase">Master Copy</span>
                                    <span class="px-1.5 py-0.5 ${prioColors[masterPriority]} text-[9px] font-bold rounded border">${prioLabels[masterPriority]}</span>
                                </div>
                                <span class="text-xs font-mono text-gray-400">ID: ${g.master.id}</span>
                            </div>
                            <p class="text-gray-800 font-medium leading-relaxed">${g.master.question}</p>
                            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                ${Object.entries(g.master.options).map(([key, value]) => `
                                    <div class="flex items-center gap-2 ${key === g.master.answer ? 'text-green-700 font-bold bg-green-100/50 rounded px-2 py-1' : 'text-gray-600 px-2 py-1'}">
                                        <span class="w-4 h-4 flex items-center justify-center rounded-full bg-white border border-current text-[10px]">${key}</span>
                                        <span>${value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Duplicates -->
                        ${g.duplicates.map(d => {
                    const dPriority = parseInt(d.priority) || 0;
                    const suggestedPriority = Math.max(0, masterPriority - 1);
                    const needsLower = dPriority > suggestedPriority;
                    return `
                            <div class="p-6 flex flex-col sm:flex-row gap-6 relative dedupe-row" id="dedupe-row-${d.id}" data-id="${d.id}">
                                <div class="flex-grow">
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="text-[10px] font-black tracking-widest text-orange-500 uppercase">Duplicate Match</span>
                                            <span class="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[9px] font-bold rounded border border-orange-100">${Math.round(d.matchScore * 100)}% Similarity</span>
                                            <span class="px-1.5 py-0.5 ${prioColors[dPriority]} text-[9px] font-bold rounded border">${prioLabels[dPriority]}</span>
                                            ${needsLower ? `<span class="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded border border-amber-200 flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]">warning</span>Priority ≥ Master</span>` : ''}
                                        </div>
                                        <span class="text-xs font-mono text-gray-400">ID: ${d.id}</span>
                                    </div>
                                    <p class="text-gray-600 text-sm italic mb-3">${d.question}</p>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                        ${Object.entries(d.options).map(([key, value]) => `
                                            <div class="flex items-center gap-2 ${key === d.answer ? 'text-green-700 font-bold bg-green-100/50 rounded px-2 py-1' : 'text-gray-500 px-2 py-1'}">
                                                <span class="w-4 h-4 flex items-center justify-center rounded-full bg-white border border-current text-[9px]">${key}</span>
                                                <span>${value}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                                <div class="flex-shrink-0 flex sm:flex-col justify-end gap-2 border-l sm:pl-6 border-gray-100">
                                    ${needsLower ? `<button class="btn-lower-priority px-4 py-1.5 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-600 text-xs font-bold rounded-lg transition-all border border-amber-100 flex items-center gap-1" data-id="${d.id}" data-priority="${suggestedPriority}"><span class="material-symbols-outlined text-sm">low_priority</span>LOWER TO ${prioLabels[suggestedPriority].toUpperCase()}</button>` : ''}
                                    <button class="btn-set-master px-4 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 text-xs font-bold rounded-lg transition-all border border-indigo-100" data-group-idx="${idx}" data-id="${d.id}">SET AS MASTER</button>
                                    <button class="btn-keep-master px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors" data-id="${d.id}">IGNORE</button>
                                    <button class="btn-delete-duplicate px-4 py-1.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 text-xs font-bold rounded-lg transition-all border border-red-100" data-id="${d.id}">DELETE</button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `}).join('');

            // --- Similar Groups (Amber) — Review Only ---
            if (scanSimilarGroups.length > 0) {
                html += `<div class="mt-4 pt-4 border-t-2 border-dashed border-amber-200">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="material-symbols-outlined text-amber-500">difference</span>
                        <span class="text-sm font-bold text-amber-600">Similar Questions (Review Only)</span>
                        <span class="text-xs text-gray-400">These are similar but may not be exact duplicates.</span>
                    </div>
                </div>`;

                html += scanSimilarGroups.map((g, idx) => `
                    <div class="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden group-entry similar-group" data-similar-group-id="${idx}">
                        <div class="p-4 bg-amber-50/50 border-b border-amber-200 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">SIMILAR #${idx + 1}</span>
                                <span class="text-xs text-amber-500 font-medium">Similar Questions (${g.duplicates.length + 1})</span>
                                <span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded shadow-sm border border-amber-200">AVG: ${Math.round(g.avgScore * 100)}% Match</span>
                            </div>
                        </div>
                        <div class="divide-y divide-gray-100">
                            <div class="p-4 bg-amber-50/20 border-l-4 border-l-amber-400">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-[10px] font-black tracking-widest text-amber-600 uppercase">Question A</span>
                                    <span class="text-xs font-mono text-gray-400">ID: ${g.master.id}</span>
                                </div>
                                <p class="text-gray-800 text-sm leading-relaxed">${g.master.question}</p>
                            </div>
                            ${g.duplicates.map(d => `
                                <div class="p-4">
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex items-center gap-2">
                                            <span class="text-[10px] font-black tracking-widest text-amber-500 uppercase">Question B</span>
                                            <span class="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded border border-amber-100">${Math.round(d.matchScore * 100)}% Similar</span>
                                        </div>
                                        <span class="text-xs font-mono text-gray-400">ID: ${d.id}</span>
                                    </div>
                                    <p class="text-gray-600 text-sm italic">${d.question}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('');
            }

            workbench.innerHTML = html;
            attachWorkbenchListeners();
        };

        const attachWorkbenchListeners = () => {
            // Bulk Resolve Action
            workbench.querySelectorAll('.btn-bulk-resolve').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const idx = btn.dataset.group_idx || btn.dataset.groupIdx;
                    const group = scanGroups[idx];
                    await resolveMatchGroup(group, btn, idx);
                });
            });

            // Lower individual duplicate priority
            workbench.querySelectorAll('.btn-lower-priority').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const qId = btn.dataset.id;
                    const newPriority = parseInt(btn.dataset.priority);
                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span>';
                    const success = await updateQuestionPriority(qId, newPriority);
                    if (success) {
                        // Update in dedup scan data too
                        for (const g of scanGroups) {
                            const d = g.duplicates.find(d => d.id == qId);
                            if (d) { d.priority = newPriority; break; }
                        }
                        showToast(`Priority lowered for question ID ${qId}`, 'success');
                        renderWorkbench();
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = '<span class="material-symbols-outlined text-sm">low_priority</span>RETRY';
                    }
                });
            });

            // Lower All Duplicates priority in a group
            workbench.querySelectorAll('.btn-lower-all-priority').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const groupIdx = btn.dataset.group_idx || btn.dataset.groupIdx;
                    const group = scanGroups[groupIdx];
                    const masterPriority = parseInt(group.master.priority) || 0;
                    const suggestedPriority = Math.max(0, masterPriority - 1);
                    const toUpdate = group.duplicates.filter(d => (parseInt(d.priority) || 0) > suggestedPriority);

                    btn.disabled = true;
                    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Updating...';

                    let successCount = 0;
                    for (const d of toUpdate) {
                        const ok = await updateQuestionPriority(d.id, suggestedPriority);
                        if (ok) {
                            d.priority = suggestedPriority;
                            successCount++;
                        }
                    }
                    showToast(`Lowered priority for ${successCount}/${toUpdate.length} duplicates`, 'success');
                    renderWorkbench();
                });
            });

            // Set as Master
            workbench.querySelectorAll('.btn-set-master').forEach(btn => {
                btn.addEventListener('click', () => {
                    const groupIdx = btn.dataset.group_idx || btn.dataset.groupIdx;
                    const questionId = btn.dataset.id;
                    const group = scanGroups[groupIdx];

                    const dupeIdx = group.duplicates.findIndex(d => d.id == questionId);
                    if (dupeIdx !== -1) {
                        const newMaster = group.duplicates[dupeIdx];
                        const oldMaster = group.master;

                        group.master = newMaster;
                        group.duplicates[dupeIdx] = oldMaster;

                        showToast('Master copy updated ✓', 'success');
                        renderWorkbench();
                    }
                });
            });

            // Individual Delete Action
            workbench.querySelectorAll('.btn-delete-duplicate').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const row = document.getElementById(`dedupe-row-${id}`);
                    const qText = row ? row.querySelector('.text-gray-600')?.textContent || 'Unknown' : 'Unknown';

                    const confirmed = await showResolveConfirm(`
                        <div class="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                            <span class="material-symbols-outlined text-red-500 text-3xl">delete_forever</span>
                            <div>
                                <p class="font-bold text-red-700">Delete this question?</p>
                                <p class="text-xs text-gray-500 mt-1 line-clamp-2">${qText.substring(0, 100)}</p>
                            </div>
                        </div>
                    `);
                    if (!confirmed) return;

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
                            invalidateExamCaches();
                            row.classList.add('hidden');
                            addToHistory({ id: parseInt(id), question: qText }, null);
                            showToast('Duplicate removed ✓', 'success');
                        }
                    } catch (e) {
                        showToast('Delete failed', 'error');
                        row.style.opacity = '1';
                        row.style.pointerEvents = 'auto';
                    }
                });
            });

            // Ignore Action — Mark with data attribute for reliable detection
            workbench.querySelectorAll('.btn-keep-master').forEach(btn => {
                btn.addEventListener('click', () => {
                    const row = document.getElementById(`dedupe-row-${btn.dataset.id}`);
                    row.setAttribute('data-ignored', 'true');
                    row.style.opacity = '0.3';
                    row.querySelector('.flex-shrink-0').innerHTML = '<span class="text-[10px] text-gray-400 font-black uppercase tracking-widest">✓ Ignored</span>';
                });
            });
        };

        // --- Custom Confirmation Modal ---
        function showResolveConfirm(bodyHTML) {
            return new Promise((resolve) => {
                const modal = document.getElementById('resolve-confirm-modal');
                const inner = document.getElementById('resolve-confirm-inner');
                const body = document.getElementById('resolve-confirm-body');
                const cancelBtn = document.getElementById('resolve-confirm-cancel');
                const proceedBtn = document.getElementById('resolve-confirm-proceed');

                body.innerHTML = bodyHTML;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                setTimeout(() => { inner.classList.remove('scale-95', 'opacity-0'); }, 10);

                const closeModal = () => {
                    inner.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
                };

                const onCancel = () => { closeModal(); cleanup(); resolve(false); };
                const onProceed = () => { closeModal(); cleanup(); resolve(true); };
                const cleanup = () => { cancelBtn.removeEventListener('click', onCancel); proceedBtn.removeEventListener('click', onProceed); };

                cancelBtn.addEventListener('click', onCancel);
                proceedBtn.addEventListener('click', onProceed);
            });
        }

        function countGroupStats(group) {
            let toDelete = 0, ignored = 0, alreadyDone = 0;
            for (const d of group.duplicates) {
                const row = document.getElementById(`dedupe-row-${d.id}`);
                if (!row || row.classList.contains('hidden')) { alreadyDone++; continue; }
                if (row.getAttribute('data-ignored') === 'true') { ignored++; continue; }
                toDelete++;
            }
            return { toDelete, ignored, alreadyDone };
        }

        const resolveAllListener = async () => {
            // Count totals across all groups
            let totalToDelete = 0, totalIgnored = 0, totalAlreadyDone = 0;
            for (const g of scanGroups) {
                const stats = countGroupStats(g);
                totalToDelete += stats.toDelete;
                totalIgnored += stats.ignored;
                totalAlreadyDone += stats.alreadyDone;
            }

            if (totalToDelete === 0) {
                showToast('Nothing to delete — all questions are either ignored or already resolved.', 'info');
                return;
            }

            const bodyHTML = `
                <div class="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <span class="material-symbols-outlined text-red-500 text-3xl">delete_forever</span>
                    <div>
                        <p class="font-bold text-red-700 text-lg">${totalToDelete} question${totalToDelete > 1 ? 's' : ''} will be deleted</p>
                        <p class="text-xs text-red-500">Across all ${scanGroups.length} groups</p>
                    </div>
                </div>
                ${totalIgnored > 0 ? `
                <div class="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <span class="material-symbols-outlined text-green-500 text-xl">shield</span>
                    <p class="text-green-700 font-medium">${totalIgnored} ignored question${totalIgnored > 1 ? 's' : ''} will be <strong>safely kept</strong></p>
                </div>` : ''}
                ${totalAlreadyDone > 0 ? `
                <div class="flex items-center gap-2 text-gray-400 text-xs">
                    <span class="material-symbols-outlined text-sm">task_alt</span>
                    ${totalAlreadyDone} already resolved
                </div>` : ''}
            `;

            const confirmed = await showResolveConfirm(bodyHTML);
            if (!confirmed) return;

            resolveAllBtn.disabled = true;
            resolveAllBtn.innerHTML = '<span class="animate-spin text-sm mr-2">refresh</span> Processing all...';

            // Collect all IDs to delete across all groups
            const allIdsToDelete = [];
            const historyMetadata = [];

            for (const g of scanGroups) {
                for (const d of g.duplicates) {
                    const row = document.getElementById(`dedupe-row-${d.id}`);
                    if (row && !row.classList.contains('hidden') && row.getAttribute('data-ignored') !== 'true') {
                        allIdsToDelete.push(d.id);
                        historyMetadata.push({ d: d, masterId: g.master.id });
                    }
                }
            }

            if (allIdsToDelete.length > 0) {
                const res = await bulkDeleteQuestions(allIdsToDelete);
                if (res.success) {
                    invalidateExamCaches();
                    historyMetadata.forEach(m => {
                        const row = document.getElementById(`dedupe-row-${m.d.id}`);
                        if (row) row.classList.add('hidden');
                        addToHistory(m.d, m.masterId);
                    });
                    showToast(`Master cleanup complete: ${allIdsToDelete.length} duplicates removed.`, 'success');
                } else {
                    showToast(`Bulk delete failed: ${res.message}`, 'error');
                }
            }

            resolveAllBtn.disabled = false;
            resolveAllBtn.innerHTML = `<span class="material-symbols-outlined text-sm mr-2">done_all</span> Finished (${allIdsToDelete.length} Deleted)`;
        };

        resolveAllBtn.onclick = resolveAllListener;

        async function resolveMatchGroup(group, btn, idx, isBatch = false) {
            if (!isBatch) {
                const stats = countGroupStats(group);
                if (stats.toDelete === 0) {
                    showToast('Nothing to delete — all questions are ignored.', 'info');
                    return 0;
                }
                const bodyHTML = `
                    <div class="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                        <span class="material-symbols-outlined text-red-500 text-3xl">delete_forever</span>
                        <div>
                            <p class="font-bold text-red-700 text-lg">${stats.toDelete} question${stats.toDelete > 1 ? 's' : ''} will be deleted</p>
                            <p class="text-xs text-red-500">From Group #${idx + 1}</p>
                        </div>
                    </div>
                    ${stats.ignored > 0 ? `
                    <div class="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                        <span class="material-symbols-outlined text-green-500 text-xl">shield</span>
                        <p class="text-green-700 font-medium">${stats.ignored} ignored question${stats.ignored > 1 ? 's' : ''} will be <strong>safely kept</strong></p>
                    </div>` : ''}
                `;
                const confirmed = await showResolveConfirm(bodyHTML);
                if (!confirmed) return 0;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="animate-pulse">DELETING...</span>';

            const ids = group.duplicates
                .filter(d => {
                    const row = document.getElementById(`dedupe-row-${d.id}`);
                    return row && !row.classList.contains('hidden') && row.getAttribute('data-ignored') !== 'true';
                })
                .map(d => d.id);

            if (ids.length === 0) {
                btn.disabled = false;
                btn.textContent = 'RETRY MERGE';
                return 0;
            }

            const res = await bulkDeleteQuestions(ids);
            if (res.success) {
                invalidateExamCaches();
                ids.forEach(id => {
                    const row = document.getElementById(`dedupe-row-${id}`);
                    if (row) row.classList.add('hidden');
                    const dupObj = group.duplicates.find(d => d.id == id);
                    if (dupObj) addToHistory(dupObj, group.master.id);
                });

                if (!isBatch) showToast(`Merged: Removed ${ids.length} duplicates ✓`, 'success');
                btn.parentElement.innerHTML = `<span class="text-[10px] font-bold text-green-600 flex items-center gap-1"><span class="material-symbols-outlined text-sm">task_alt</span> RESOLVED</span>`;
                const groupEl = document.getElementById(`group-${idx}`);
                if (groupEl) groupEl.classList.add('opacity-60', 'grayscale-[0.5]');
                return ids.length;
            } else {
                btn.disabled = false;
                btn.textContent = 'RETRY MERGE';
                showToast(`Merge failed: ${res.message}`, 'error');
                return 0;
            }
        }

        renderWorkbench();
    }

    // --- Cross-Exam Scan ---
    async function runCrossExamScan() {
        await ensureSimilarityEngine();
        const dedupeModal = document.getElementById('deduplication-modal');
        const workbench = document.getElementById('dedupe-workbench-content');
        const countBadge = document.getElementById('duplicate-count');
        const similarCountText = document.getElementById('similar-count-text');
        const resolveAllBtn = document.getElementById('resolve-all-btn');
        const slider = document.getElementById('dedupe-sensitivity-slider');
        const sliderLabel = document.getElementById('dedupe-sensitivity-label');
        const footerText = document.getElementById('dedupe-footer-text');

        dedupeModal.classList.remove('hidden');
        dedupeModal.classList.add('flex');
        setTimeout(() => dedupeModal.classList.remove('scale-95', 'opacity-0'), 10);

        workbench.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mb-4"></div>
                <p class="font-medium">Fetching questions from other exams in same subject...</p>
            </div>`;

        try {
            const resp = await fetch(`api/question/list_by_subject.php?exam_id=${examId}`);
            const res = await resp.json();
            if (!res.success || res.data.length === 0) {
                workbench.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                        <span class="material-symbols-outlined text-6xl mb-4 text-purple-200">search_off</span>
                        <p class="font-bold text-gray-600">No Other Exams Found</p>
                        <p class="text-sm">There are no other exams in this subject to compare against.</p>
                    </div>`;
                countBadge.textContent = '0';
                if (similarCountText) similarCountText.innerHTML = '';
                if (resolveAllBtn) resolveAllBtn.classList.add('hidden');
                return;
            }

            const extQs = res.data;
            workbench.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mb-4"></div>
                    <p class="font-medium">Comparing ${currentQuestions.length} vs ${extQs.length} external questions...</p>
                </div>`;
            await new Promise(r => setTimeout(r, 400));

            const threshold = parseInt(slider.value) / 100;
            sliderLabel.textContent = slider.value + '%';
            if (footerText) footerText.textContent = `Cross-Exam Scan: ${slider.value}%+ Similarity`;

            const crossMatches = [];
            for (const myQ of currentQuestions) {
                const matches = [];
                for (const extQ of extQs) {
                    const result = SimilarityEngine.calculateFullSimilarity(myQ, extQ);
                    if (result.score >= threshold) {
                        matches.push({ ...extQ, matchScore: result.score, sourceExam: extQ.exam_title || `Exam #${extQ.exam_id}` });
                    }
                }
                if (matches.length > 0) {
                    matches.sort((a, b) => b.matchScore - a.matchScore);
                    crossMatches.push({ local: myQ, externals: matches, avgScore: matches.reduce((a, m) => a + m.matchScore, 0) / matches.length });
                }
            }

            countBadge.textContent = crossMatches.length;
            if (similarCountText) similarCountText.innerHTML = ` <span class="text-purple-500 font-medium">(Cross-Exam)</span>`;
            if (resolveAllBtn) resolveAllBtn.classList.add('hidden');

            if (crossMatches.length === 0) {
                workbench.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                        <span class="material-symbols-outlined text-6xl mb-4 text-green-200">check_circle</span>
                        <p class="font-bold text-gray-600">No Cross-Exam Duplicates Found!</p>
                        <p class="text-sm">Your questions are unique across all exams in this subject.</p>
                    </div>`;
                return;
            }

            workbench.innerHTML = crossMatches.map((cm, idx) => `
                <div class="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden">
                    <div class="p-4 bg-purple-50/50 border-b border-purple-100 flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">CROSS-MATCH #${idx + 1}</span>
                        <span class="text-xs text-purple-400 font-medium">${cm.externals.length} match${cm.externals.length > 1 ? 'es' : ''} in other exams</span>
                        <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded shadow-sm border border-purple-200">AVG: ${Math.round(cm.avgScore * 100)}%</span>
                    </div>
                    <div class="divide-y divide-gray-100">
                        <div class="p-5 bg-blue-50/30 border-l-4 border-l-blue-500">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-[10px] font-black tracking-widest text-blue-600 uppercase">This Exam · ID: ${cm.local.id}</span>
                            </div>
                            <p class="text-gray-800 font-medium text-sm">${cm.local.question}</p>
                            <div class="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                                ${Object.entries(cm.local.options).map(([k, v]) => `
                                    <span class="${k === cm.local.answer ? 'text-green-700 font-bold' : 'text-gray-500'}">${k}: ${v}</span>
                                `).join('')}
                            </div>
                        </div>
                        ${cm.externals.map(ext => `
                            <div class="p-5">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[10px] font-black tracking-widest text-purple-500 uppercase">External</span>
                                        <span class="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold rounded border border-purple-100">${Math.round(ext.matchScore * 100)}%</span>
                                        <span class="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded">From: ${ext.sourceExam}</span>
                                    </div>
                                    <span class="text-xs font-mono text-gray-400">ID: ${ext.id}</span>
                                </div>
                                <p class="text-gray-600 text-sm italic mb-2">${ext.question}</p>
                                <div class="grid grid-cols-2 gap-1 text-[11px]">
                                    ${Object.entries(ext.options).map(([k, v]) => `
                                        <span class="${k === ext.answer ? 'text-green-700 font-bold' : 'text-gray-400'}">${k}: ${v}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            workbench.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-400">
                    <span class="material-symbols-outlined text-6xl mb-4">error</span>
                    <p class="font-bold text-red-600">Error: ${error.message}</p>
                </div>`;
        }
    }

    // Initialize Dedupe Listeners
    setTimeout(() => {
        const scanBtn = document.getElementById('scan-duplicates-btn');
        const crossExamBtn = document.getElementById('scan-cross-exam-btn');
        const closeModalBtn = document.getElementById('close-dedupe-modal-btn');
        const finishBtn = document.getElementById('finish-dedupe-btn');
        const dedupeModal = document.getElementById('deduplication-modal');
        const toggleHistoryBtn = document.getElementById('toggle-history-btn');
        const historyPanel = document.getElementById('dedupe-history-panel');

        if (scanBtn) scanBtn.addEventListener('click', () => { window._dedupeState.allPairScores = []; runSimilarityScan(); });
        if (crossExamBtn) crossExamBtn.addEventListener('click', () => { window._dedupeState.allPairScores = []; runCrossExamScan(); });
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
            dedupeModal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                dedupeModal.classList.add('hidden');
                dedupeModal.classList.remove('flex');
                if (historyPanel) historyPanel.classList.add('hidden');
                fetchAndDisplayQuestions();
            }, 300);
        });
        if (finishBtn) finishBtn.addEventListener('click', () => closeModalBtn.click());
        if (toggleHistoryBtn && historyPanel) {
            toggleHistoryBtn.addEventListener('click', () => {
                historyPanel.classList.toggle('hidden');
            });
        }
        const closeHistoryBtn = document.getElementById('close-history-btn');
        if (closeHistoryBtn && historyPanel) {
            closeHistoryBtn.addEventListener('click', () => {
                historyPanel.classList.add('hidden');
            });
        }
    }, 500);

    initialLoad();
}

initializeQuestionsListPage();
