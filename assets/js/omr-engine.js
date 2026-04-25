/**
 * OmrEngine — Shared OMR Entry Modal System
 * Used by dashboard.js and take-exam-list.js
 * 
 * Features:
 * - Interactive OMR grid with A/B/C/D/E bubbles + skip
 * - Keyboard navigation: ↑/↓ = navigate questions, ←/→ = navigate options, Enter = select
 * - Mark All Practiced (bulk)
 * - Submit OMR with scoring
 * - Question text display for shuffled paper matching
 */
window.OmrEngine = (() => {
    let modalEl = null;
    let state = { examId: null, examTitle: '', questions: [], answers: {} };
    let focusedRow = 0;
    let focusedCol = 0; // 0=A, 1=B, 2=C, 3=D, 4=E, 5=SKIP (varies by options count)
    let keyHandler = null;
    let showToastFn = null;

    function init(toastFn) {
        showToastFn = toastFn || ((msg) => alert(msg));
    }

    function toast(msg, type) {
        if (showToastFn) showToastFn(msg, type);
    }

    function ensureModal() {
        if (modalEl) return;
        const div = document.createElement('div');
        div.id = 'omr-modal';
        div.className = 'fixed inset-0 bg-gray-900/60 hidden items-center justify-center z-[260] p-4 backdrop-blur-sm';
        div.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden flex flex-col" style="max-height: 90vh;">
                <!-- Header -->
                <div class="bg-gradient-to-r from-amber-500 to-orange-600 p-5 text-white flex-shrink-0">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-lg font-black flex items-center gap-2">
                                <span class="material-symbols-outlined">edit_note</span>
                                OMR Entry
                            </h2>
                            <p id="omr-exam-title" class="text-sm text-white/80 mt-1 truncate max-w-[300px]"></p>
                        </div>
                        <button id="omr-close-btn" class="text-white/80 hover:text-white transition-colors">
                            <span class="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                    <!-- Stats bar -->
                    <div class="flex gap-4 mt-3 text-xs font-bold">
                        <span id="omr-stat-total" class="bg-white/20 px-2 py-1 rounded">0 Questions</span>
                        <span id="omr-stat-answered" class="bg-white/20 px-2 py-1 rounded">0 Answered</span>
                        <span id="omr-stat-skipped" class="bg-white/20 px-2 py-1 rounded">0 Skipped</span>
                    </div>
                    <!-- Keyboard hint -->
                    <div class="mt-2 text-[10px] text-white/50 flex items-center gap-3">
                        <span>⌨ ↑↓ navigate</span>
                        <span>←→ options</span>
                        <span>Enter select</span>
                        <span>Esc close</span>
                    </div>
                </div>

                <!-- Body (scrollable) -->
                <div id="omr-body" class="flex-1 overflow-y-auto p-5 space-y-1" style="min-height: 200px;">
                    <div class="text-center py-8 text-gray-400">
                        <span class="material-symbols-outlined text-4xl animate-spin">sync</span>
                        <p class="mt-2">Loading questions...</p>
                    </div>
                </div>

                <!-- Footer -->
                <div class="border-t bg-gray-50 p-4 flex-shrink-0 flex flex-wrap gap-3 items-center justify-between">
                    <button id="omr-mark-practiced-btn" class="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg">done_all</span>
                        Mark All Practiced
                    </button>
                    <button id="omr-submit-btn" class="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-5 rounded-lg transition-colors text-sm flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg">send</span>
                        Submit OMR Answers
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        modalEl = div;

        // Event bindings
        document.getElementById('omr-close-btn').addEventListener('click', close);
        modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });

        document.getElementById('omr-mark-practiced-btn').addEventListener('click', async () => {
            if (!confirm('Mark all questions as "practiced"? Records them as attempted without specific answers.')) return;
            await submit('mark_practiced');
        });

        document.getElementById('omr-submit-btn').addEventListener('click', async () => {
            const answeredCount = Object.keys(state.answers).length;
            if (answeredCount === 0) {
                toast('Select at least one answer before submitting.', 'error');
                return;
            }
            await submit('omr_entry');
        });
    }

    async function open(examId, examTitle) {
        ensureModal();
        state = { examId, examTitle, questions: [], answers: {} };
        focusedRow = 0;
        focusedCol = 0;

        document.getElementById('omr-exam-title').textContent = examTitle || `Exam #${examId}`;
        document.getElementById('omr-body').innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <span class="material-symbols-outlined text-4xl animate-spin">sync</span>
                <p class="mt-2">Loading questions...</p>
            </div>
        `;

        // Reset footer buttons
        const markBtn = document.getElementById('omr-mark-practiced-btn');
        const submitBtn = document.getElementById('omr-submit-btn');
        markBtn.classList.remove('hidden');
        markBtn.disabled = false;
        markBtn.innerHTML = '<span class="material-symbols-outlined text-lg">done_all</span> Mark All Practiced';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined text-lg">send</span> Submit OMR Answers';
        submitBtn.onclick = null; // Clear any previous close handler

        updateStats();

        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');

        // Bind keyboard
        bindKeyboard();

        // Fetch questions
        try {
            let fetchFn = window.CacheManager
                ? () => CacheManager.fetchWithCache(`api/take-exam/start.php?exam_id=${examId}`, 0.5)
                : async () => { const r = await fetch(`api/take-exam/start.php?exam_id=${examId}`); const j = await r.json(); return j.success ? j.data : j; };

            const result = await fetchFn();
            if (!result || !result.questions || result.questions.length === 0) {
                document.getElementById('omr-body').innerHTML = `<p class="text-center py-8 text-red-500 font-medium">No questions found for this exam.</p>`;
                return;
            }

            state.questions = result.questions;
            renderGrid();
        } catch (err) {
            console.error('OMR fetch error:', err);
            document.getElementById('omr-body').innerHTML = `<p class="text-center py-8 text-red-500">Failed to load questions: ${err.message}</p>`;
        }
    }

    function close() {
        if (modalEl) {
            modalEl.classList.add('hidden');
            modalEl.classList.remove('flex');
        }
        state = { examId: null, examTitle: '', questions: [], answers: {} };
        unbindKeyboard();
    }

    function getOptionsForQuestion(q) {
        // Build options list from question data (JSON 'options' field)
        const opts = ['A', 'B', 'C', 'D'];
        if (q.options && q.options.E && q.options.E.trim() !== '') opts.push('E');
        return opts;
    }

    function renderGrid() {
        const body = document.getElementById('omr-body');

        const gridHtml = state.questions.map((q, index) => {
            const qNum = index + 1;
            const options = getOptionsForQuestion(q);
            // Strip HTML tags from question text
            const qText = (q.question || '').replace(/<[^>]*>/g, '').trim();
            const shortText = qText.length > 120 ? qText.substring(0, 120) + '…' : qText;
            return `
                <div class="py-3 px-3 rounded-xl transition-all border-2 border-transparent hover:bg-gray-50/50" data-omr-row="${index}" tabindex="-1">
                    <!-- Question Header -->
                    <div class="flex items-start gap-2 mb-2">
                        <span class="omr-q-badge text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-lg flex-shrink-0">Q${qNum}</span>
                        <p class="text-xs font-semibold text-gray-700 leading-relaxed line-clamp-2" title="${qText.replace(/"/g, '&quot;')}">${shortText}</p>
                    </div>

                    <!-- Options Text Preview -->
                    <div class="grid grid-cols-2 gap-x-6 gap-y-1 ml-9 mb-3 text-[10px] text-gray-400 font-medium leading-tight">
                        ${options.map(opt => {
                            const optText = (q.options && q.options[opt]) ? q.options[opt] : '';
                            return `
                                <div class="flex gap-1.5 items-baseline truncate">
                                    <span class="font-black text-amber-500/60 flex-shrink-0">${opt}.</span>
                                    <span class="truncate opacity-80">${optText.replace(/<[^>]*>/g, '').trim()}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Bubble Grid -->
                    <div class="flex gap-2 ml-9">
                        ${options.map((opt, oi) => `
                            <button 
                                class="omr-opt w-10 h-10 rounded-full border-2 border-gray-200 text-sm font-bold text-gray-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-all duration-150 focus:outline-none"
                                data-q-index="${index}" 
                                data-q-id="${q.id}" 
                                data-opt="${opt}"
                                data-opt-index="${oi}"
                            >${opt}</button>
                        `).join('')}
                        <button 
                            class="omr-skip ml-1 w-10 h-10 rounded-full border-2 border-gray-100 text-xs font-bold text-gray-300 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 focus:outline-none"
                            data-q-index="${index}" 
                            data-q-id="${q.id}" 
                            data-opt="SKIP"
                            data-opt-index="${options.length}"
                            title="Clear / Skip"
                        >✕</button>
                    </div>
                </div>
            `;
        }).join('');

        body.innerHTML = gridHtml;
        updateStats();
        updateFocusVisual();

        // Delegated click handler
        body.addEventListener('click', (e) => {
            const btn = e.target.closest('.omr-opt') || e.target.closest('.omr-skip');
            if (!btn) return;
            const qIndex = parseInt(btn.dataset.qIndex);
            const opt = btn.dataset.opt;
            selectOption(qIndex, opt);
            focusedRow = qIndex;
            focusedCol = parseInt(btn.dataset.optIndex);
        });
    }

    function selectOption(qIndex, opt) {
        const body = document.getElementById('omr-body');
        const row = body.querySelector(`[data-omr-row="${qIndex}"]`);
        if (!row) return;
        const q = state.questions[qIndex];
        if (!q) return;

        // Clear all selections in row
        row.querySelectorAll('.omr-opt, .omr-skip').forEach(b => {
            b.classList.remove('bg-amber-500', 'text-white', 'border-amber-500', 'bg-red-500', 'border-red-500', 'scale-110', 'ring-2', 'ring-amber-300');
            b.classList.add('border-gray-200', 'text-gray-500');
        });

        if (opt === 'SKIP') {
            delete state.answers[q.id];
            const skipBtn = row.querySelector('.omr-skip');
            if (skipBtn) {
                skipBtn.classList.remove('border-gray-100', 'text-gray-300', 'border-gray-200', 'text-gray-500');
                skipBtn.classList.add('bg-red-500', 'text-white', 'border-red-500', 'scale-110');
            }
        } else {
            state.answers[q.id] = opt;
            const optBtn = row.querySelector(`.omr-opt[data-opt="${opt}"]`);
            if (optBtn) {
                optBtn.classList.remove('border-gray-200', 'text-gray-500');
                optBtn.classList.add('bg-amber-500', 'text-white', 'border-amber-500', 'scale-110');
            }
        }

        updateStats();
    }

    function updateStats() {
        const total = state.questions.length;
        const answered = Object.keys(state.answers).length;
        const skipped = total - answered;

        const totalEl = document.getElementById('omr-stat-total');
        const answeredEl = document.getElementById('omr-stat-answered');
        const skippedEl = document.getElementById('omr-stat-skipped');

        if (totalEl) totalEl.textContent = `${total} Questions`;
        if (answeredEl) answeredEl.textContent = `${answered} Answered`;
        if (skippedEl) skippedEl.textContent = `${skipped} Skipped`;
    }

    // --- Keyboard Navigation ---
    function bindKeyboard() {
        unbindKeyboard();
        keyHandler = (e) => {
            // Only handle when modal visible
            if (!modalEl || modalEl.classList.contains('hidden')) return;
            // Don't hijack if typing in input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            const totalRows = state.questions.length;
            if (totalRows === 0) return;

            const q = state.questions[focusedRow];
            const maxCol = getOptionsForQuestion(q).length; // 0..maxCol = options, maxCol = SKIP

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    focusedRow = Math.min(focusedRow + 1, totalRows - 1);
                    focusedCol = Math.min(focusedCol, getOptionsForQuestion(state.questions[focusedRow]).length);
                    updateFocusVisual();
                    scrollToRow(focusedRow);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    focusedRow = Math.max(focusedRow - 1, 0);
                    focusedCol = Math.min(focusedCol, getOptionsForQuestion(state.questions[focusedRow]).length);
                    updateFocusVisual();
                    scrollToRow(focusedRow);
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    focusedCol = Math.min(focusedCol + 1, maxCol);
                    updateFocusVisual();
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    focusedCol = Math.max(focusedCol - 1, 0);
                    updateFocusVisual();
                    break;

                case 'Enter':
                case ' ':
                    e.preventDefault();
                    // Select currently focused option
                    const opts = getOptionsForQuestion(state.questions[focusedRow]);
                    const selectedOpt = focusedCol < opts.length ? opts[focusedCol] : 'SKIP';
                    selectOption(focusedRow, selectedOpt);
                    // Auto-advance to next row
                    if (selectedOpt !== 'SKIP' && focusedRow < totalRows - 1) {
                        focusedRow++;
                        updateFocusVisual();
                        scrollToRow(focusedRow);
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    close();
                    break;

                // Quick select by letter key
                case 'a': case 'A':
                    e.preventDefault();
                    quickSelect(focusedRow, 'A');
                    break;
                case 'b': case 'B':
                    e.preventDefault();
                    quickSelect(focusedRow, 'B');
                    break;
                case 'c': case 'C':
                    e.preventDefault();
                    quickSelect(focusedRow, 'C');
                    break;
                case 'd': case 'D':
                    e.preventDefault();
                    quickSelect(focusedRow, 'D');
                    break;
                case 'e': case 'E':
                    if (getOptionsForQuestion(state.questions[focusedRow]).includes('E')) {
                        e.preventDefault();
                        quickSelect(focusedRow, 'E');
                    }
                    break;
                case 'x': case 'X':
                case 's': case 'S':
                    e.preventDefault();
                    selectOption(focusedRow, 'SKIP');
                    updateFocusVisual();
                    break;
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    function quickSelect(rowIndex, opt) {
        selectOption(rowIndex, opt);
        const opts = getOptionsForQuestion(state.questions[rowIndex]);
        focusedCol = opts.indexOf(opt);
        if (focusedCol === -1) focusedCol = 0;
        // Auto-advance
        if (rowIndex < state.questions.length - 1) {
            focusedRow = rowIndex + 1;
        }
        updateFocusVisual();
        scrollToRow(focusedRow);
    }

    function unbindKeyboard() {
        if (keyHandler) {
            document.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
    }

    function updateFocusVisual() {
        const body = document.getElementById('omr-body');
        if (!body) return;

        // Remove focus from all rows
        body.querySelectorAll('[data-omr-row]').forEach(row => {
            row.classList.remove('border-amber-300', 'bg-amber-50/50');
            row.classList.add('border-transparent');
            row.querySelector('.omr-q-badge')?.classList.remove('bg-amber-500', 'text-white');
            row.querySelector('.omr-q-badge')?.classList.add('bg-amber-50', 'text-amber-500');
        });

        // Remove focus ring from all buttons
        body.querySelectorAll('.omr-opt, .omr-skip').forEach(b => {
            b.classList.remove('ring-2', 'ring-amber-300', 'ring-red-300');
        });

        // Focus current row
        const row = body.querySelector(`[data-omr-row="${focusedRow}"]`);
        if (!row) return;
        row.classList.remove('border-transparent');
        row.classList.add('border-amber-300', 'bg-amber-50/50');
        const badge = row.querySelector('.omr-q-badge');
        if (badge) {
            badge.classList.remove('bg-amber-50', 'text-amber-500');
            badge.classList.add('bg-amber-500', 'text-white');
        }

        // Focus current option button
        const focusBtn = row.querySelector(`[data-opt-index="${focusedCol}"]`);
        if (focusBtn) {
            const isSkip = focusBtn.classList.contains('omr-skip');
            focusBtn.classList.add('ring-2', isSkip ? 'ring-red-300' : 'ring-amber-300');
        }
    }

    function scrollToRow(index) {
        const body = document.getElementById('omr-body');
        const row = body?.querySelector(`[data-omr-row="${index}"]`);
        if (row) {
            setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
    }

    // --- Submission ---
    async function submit(mode) {
        const markBtn = document.getElementById('omr-mark-practiced-btn');
        const submitBtn = document.getElementById('omr-submit-btn');
        const origMarkHtml = markBtn.innerHTML;
        const origSubmitHtml = submitBtn.innerHTML;

        markBtn.disabled = true;
        submitBtn.disabled = true;
        const activeBtn = (mode === 'mark_practiced') ? markBtn : submitBtn;
        activeBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span> Processing...';

        try {
            const payload = {
                exam_id: parseInt(state.examId),
                mode: mode
            };

            if (mode === 'omr_entry') {
                payload.answers = state.answers;
            }

            const response = await fetch('api/take-exam/offline-submit.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.success) {
                const d = result.data;
                const body = document.getElementById('omr-body');

                if (mode === 'mark_practiced') {
                    body.innerHTML = `
                        <div class="text-center py-12 space-y-4">
                            <span class="material-symbols-outlined text-6xl text-green-500">task_alt</span>
                            <h3 class="text-xl font-black text-gray-800">Marked as Practiced!</h3>
                            <p class="text-gray-500">${d.total} questions recorded as attempted.</p>
                            <p class="text-xs text-gray-400">These will be deprioritized in future exam creation.</p>
                        </div>
                    `;
                } else {
                    const scoreColor = d.score_percent >= 80 ? 'text-green-600' : d.score_percent >= 50 ? 'text-amber-600' : 'text-red-600';
                    body.innerHTML = `
                        <div class="text-center py-8 space-y-4">
                            <span class="material-symbols-outlined text-6xl ${scoreColor}">${d.score_percent >= 80 ? 'emoji_events' : d.score_percent >= 50 ? 'thumb_up' : 'trending_down'}</span>
                            <h3 class="text-2xl font-black ${scoreColor}">${d.score_percent}%</h3>
                            <div class="flex justify-center gap-6 text-sm font-bold">
                                <span class="text-green-600">✓ ${d.correct} Correct</span>
                                <span class="text-red-600">✗ ${d.wrong} Wrong</span>
                                <span class="text-gray-400">○ ${d.skipped} Skipped</span>
                            </div>
                            <p class="text-xs text-gray-400 mt-4">Results saved. SRS and attempt data updated.</p>
                        </div>
                    `;
                }

                // Hide action buttons, show close
                markBtn.classList.add('hidden');
                submitBtn.innerHTML = '<span class="material-symbols-outlined text-lg">close</span> Close';
                submitBtn.disabled = false;
                submitBtn.onclick = close;

                toast(result.message, 'success');

                // Clear dashboard cache if available
                if (window.CacheManager && CacheManager.clearGroup) {
                    CacheManager.clearGroup('dashboard');
                }
            } else {
                toast(result.message || 'Submission failed.', 'error');
            }
        } catch (err) {
            console.error('OMR submit error:', err);
            toast('Network error: ' + err.message, 'error');
        } finally {
            markBtn.disabled = false;
            submitBtn.disabled = false;
            if (!markBtn.classList.contains('hidden')) markBtn.innerHTML = origMarkHtml;
            if (submitBtn.onclick !== close) submitBtn.innerHTML = origSubmitHtml;
        }
    }

    return { init, open, close };
})();
