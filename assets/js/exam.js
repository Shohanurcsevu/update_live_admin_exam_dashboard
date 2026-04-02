function initializeExamPage() {
    const EXAM_API_URL = 'api/exam/exam.php';
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';
    const PROMPT_API_URL = 'api/ai/ai-prompts.php';
    const TOPIC_CREATE_API_URL = 'api/topic/topic.php';
    const TOPIC_LESSON_API_URL = 'api/topic/lessons.php';

    // DOM Elements
    const createBtn = document.getElementById('create-exam-btn');
    const examModal = document.getElementById('exam-modal');
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    const examForm = document.getElementById('exam-form');
    const tableBody = document.getElementById('exams-table-body');
    const cardView = document.getElementById('exams-card-view');
    const toastContainer = document.getElementById('toast-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const currentCountEl = document.getElementById('current-count');
    const totalCountEl = document.getElementById('total-count');
    const inventoryContainer = document.getElementById('exam-inventory-main');
    const progressBar = document.getElementById('loading-progress');

    // Filters
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');
    const globalSearch = document.getElementById('global-search');
    const mainClearFiltersBtn = document.getElementById('main-clear-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Bulk Action State
    let selectedExamIds = new Set();
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const bulkSubjectTarget = document.getElementById('bulk-subject-target');
    const bulkLessonTarget = document.getElementById('bulk-lesson-target');
    const bulkTopicTarget = document.getElementById('bulk-topic-target');
    const selectAllExams = document.getElementById('select-all-exams');

    // Modal Selectors
    const modalSubjectSelector = document.getElementById('modal-subject-selector');
    const modalLessonSelector = document.getElementById('modal-lesson-selector');
    const modalTopicSelector = document.getElementById('modal-topic-selector');
    const modalQuestionsJson = document.getElementById('modal-questions-json');
    const previewQuestionsBtn = document.getElementById('preview-imported-questions-btn');
    const previewContainer = document.getElementById('imported-questions-preview');

    // Quick Look Selectors
    const quickLookModal = document.getElementById('preview-questions-modal');
    const previewExamTitle = document.getElementById('preview-exam-title');
    const previewExamSubtitle = document.getElementById('preview-exam-subtitle');
    const previewQuestionsContainer = document.getElementById('preview-questions-container');
    const previewLoading = document.getElementById('preview-loading');
    const closePreviewBtn = document.getElementById('close-preview-modal-btn');
    const closePreviewFooterBtn = document.getElementById('close-preview-footer-btn');

    // Tab Elements
    const tabManual = document.getElementById('tab-manual');
    const tabBulk = document.getElementById('tab-bulk');
    const manualModeContent = document.getElementById('manual-mode-content');
    const bulkModeContent = document.getElementById('bulk-mode-content');

    // Bulk Import Elements
    const bulkManualJsonInput = document.getElementById('bulk-manual-json-input');
    const bulkInitQueueBtn = document.getElementById('bulk-init-queue-btn');
    const bulkCategorizationContainer = document.getElementById('bulk-categorization-container');
    const sectionsContainer = document.getElementById('sections-container');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const bulkResetBtn = document.getElementById('bulk-reset-btn');

    // AI Scan Elements
    const aiDropZone = document.getElementById('ai-drop-zone');
    const aiFileInput = document.getElementById('ai-file-input');
    const aiPreviewGrid = document.getElementById('ai-preview-grid');
    const aiScanActions = document.getElementById('ai-scan-actions');
    const aiScanBtn = document.getElementById('ai-scan-btn');
    const aiScanBtnText = document.getElementById('ai-scan-btn-text');
    const aiFileCount = document.getElementById('ai-file-count');
    const aiModelSelect = document.getElementById('ai-model-select');
    const aiClearFilesBtn = document.getElementById('ai-clear-files-btn');
    const aiProgressContainer = document.getElementById('ai-progress-container');
    const aiProgressBar = document.getElementById('ai-progress-bar');
    const aiProgressText = document.getElementById('ai-progress-text');
    const aiProgressPercent = document.getElementById('ai-progress-percent');
    let aiUploadedFiles = [];

    // Prompt Preset Elements
    const promptPresetSelect = document.getElementById('ai-prompt-preset');
    const presetNewBtn = document.getElementById('preset-new-btn');
    const presetEditBtn = document.getElementById('preset-edit-btn');
    const presetDeleteBtn = document.getElementById('preset-delete-btn');
    const promptEditorModal = document.getElementById('prompt-editor-modal');
    const promptModalTitle = document.getElementById('prompt-modal-title');
    const promptNameInput = document.getElementById('prompt-name-input');
    const promptTextEditor = document.getElementById('prompt-text-editor');
    const promptSaveBtn = document.getElementById('prompt-save-btn');
    const promptCancelBtn = document.getElementById('prompt-cancel-btn');
    const promptModalCloseBtn = document.getElementById('prompt-modal-close-btn');
    let activePromptText = ''; // Loaded dynamically from DB
    let editingPresetId = null; // null = creating new

    // Topic Import Elements
    const topicImportSection = document.getElementById('topic-import-section');
    const topicImportCount = document.getElementById('topic-import-count');
    const topicImportTableBody = document.getElementById('topic-import-table-body');
    const topicImportAllBtn = document.getElementById('topic-import-all-btn');
    const topicImportBtnText = document.getElementById('topic-import-btn-text');
    const topicImportClearBtn = document.getElementById('topic-import-clear-btn');
    const topicImportSubject = document.getElementById('topic-import-subject');
    const topicImportLesson = document.getElementById('topic-import-lesson');
    const topicImportApplyAllBtn = document.getElementById('topic-import-apply-all-btn');
    const jsonValidationIndicator = document.getElementById('json-validation-indicator');
    const jsonValidationDot = document.getElementById('json-validation-dot');
    const jsonValidationText = document.getElementById('json-validation-text');
    const jsonLineNumbers = document.getElementById('json-line-numbers');
    const aiFixJsonBtn = document.getElementById('ai-fix-json-btn');
    const aiTokenTracker = document.getElementById('ai-token-tracker');
    const tokenUsageDisplay = document.getElementById('token-usage-display');
    const tokenSessionTotal = document.getElementById('token-session-total');
    const aiTokenResetBtn = document.getElementById('ai-token-reset-btn');
    let topicQueue = [];
    let lastTopicRenderId = 0; // Prevent overlapping async renders in topic table

    let currentErrorLine = -1; // Track error line for gutter highlighting

    function updateLineNumbers() {
        if (!bulkManualJsonInput || !jsonLineNumbers) return;
        const lines = bulkManualJsonInput.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) {
            if (i === currentErrorLine) {
                html += `<span class="line-number-error">${i}</span>\n`;
            } else {
                html += i + '\n';
            }
        }
        jsonLineNumbers.innerHTML = html;
        jsonLineNumbers.scrollTop = bulkManualJsonInput.scrollTop;
    }

    let examIdToDelete = null;
    let subjects = []; // Shared subjects for bulk categorization
    extractedSections = []; // Queue for bulk import

    // Sorting State
    let currentSortBy = 'id';
    let currentSortOrder = 'desc';
    let importedQuestions = [];
    const defaultInstructions = 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।';

    let currentOffset = 0;
    const itemsPerPage = 20;
    let isFetching = false;
    let initialExamMetrics = null; // Store initial values for additive updates

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

    function getCompletionStyle(colorClass) {
        return SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-rose-600'; icon = 'error'; break;
            case 'update': bgColor = 'bg-amber-500'; icon = 'notification_important'; break;
            default: bgColor = 'bg-emerald-600'; icon = 'check_circle'; break;
        }
        // Centered styling for toasts
        toast.className = `flex items-center text-white px-6 py-3 rounded-2xl shadow-2xl mb-3 transform transition-all duration-300 translate-y-[-20px] opacity-0 animate-[fade-in-down_0.3s_forwards] pointer-events-auto ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3 font-bold">${icon}</span> <span class="font-bold tracking-tight">${message}</span>`;
        toastContainer.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Modal Helpers
    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('custom-confirm-modal');
        const content = document.getElementById('modal-content');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);

        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        const close = () => {
            content.classList.add('scale-95', 'opacity-0');
            content.classList.remove('scale-100', 'opacity-100');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
        };

        cancelBtn.onclick = close;
        confirmBtn.onclick = () => {
            close();
            onConfirm();
        };
    }

    function switchTab(mode) {
        if (mode === 'manual') {
            tabManual.classList.add('border-blue-600', 'text-blue-600');
            tabManual.classList.remove('border-transparent', 'text-slate-400');
            tabBulk.classList.remove('border-blue-600', 'text-blue-600');
            tabBulk.classList.add('border-transparent', 'text-slate-400');
            manualModeContent.classList.remove('hidden');
            bulkModeContent.classList.add('hidden');
        } else {
            tabBulk.classList.add('border-blue-600', 'text-blue-600');
            tabBulk.classList.remove('border-transparent', 'text-slate-400');
            tabManual.classList.remove('border-blue-600', 'text-blue-600');
            tabManual.classList.add('border-transparent', 'text-slate-400');
            bulkModeContent.classList.remove('hidden');
            manualModeContent.classList.add('hidden');

            // Auto-paste from clipboard if empty and valid JSON found
            if (!bulkManualJsonInput.value.trim() && navigator.clipboard) {
                navigator.clipboard.readText().then(text => {
                    const trimmed = text.trim();
                    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                        try {
                            JSON.parse(trimmed);
                            bulkManualJsonInput.value = trimmed;
                            updateLineNumbers();
                            validateLiveJSON();
                            showToast('Smart-pasted JSON from clipboard!');
                        } catch (e) { }
                    }
                }).catch(err => {
                    console.log('Clipboard access denied or unavailable');
                });
            }
        }
    }

    function updateExamMetrics(count) {
        if (count > 0) {
            const durationInput = document.getElementById('duration');
            const totalMarksInput = document.getElementById('total-marks');
            const passMarkInput = document.getElementById('pass-mark');

            let newDuration = count;
            let newTotalMarks = count;

            // If editing an existing exam, add to the initial values
            if (initialExamMetrics) {
                newDuration = initialExamMetrics.duration + count;
                newTotalMarks = initialExamMetrics.totalMarks + count;
            }

            if (durationInput) durationInput.value = newDuration;
            if (totalMarksInput) totalMarksInput.value = newTotalMarks;
            if (passMarkInput) passMarkInput.value = (newTotalMarks * 0.99).toFixed(2);
        }
    }

    function validateLiveJSON() {
        const rawVal = bulkManualJsonInput.value;
        if (!rawVal.trim()) {
            jsonValidationIndicator.classList.add('opacity-0');
            if (aiFixJsonBtn) { aiFixJsonBtn.classList.add('hidden'); aiFixJsonBtn.classList.remove('flex'); }
            // Hide token tracker on clear — actually let's keep it until next valid check if we want persistent view, 
            // but the user said "Real-Time Usage Display", so let's hide only if it makes sense.
            // For now, let's keep the last usage visible until next attempt.
            currentErrorLine = -1;
            updateLineNumbers();
            return;
        }

        jsonValidationIndicator.classList.remove('opacity-0');
        
        // Reset styles first
        jsonValidationIndicator.classList.remove('bg-emerald-50', 'border-emerald-200', 'bg-rose-50', 'border-rose-200', 'bg-slate-100', 'border-slate-200');
        
        // Multi-JSON Validation Logic
        let jsonBlocks = [];
        let parseError = null;

        try {
            JSON.parse(rawVal);
            jsonBlocks = [rawVal];
        } catch (e) {
            parseError = e;
            jsonBlocks = extractJSONObjects(rawVal);
        }

        if (jsonBlocks.length > 1) {
            // Multiple objects detected, validate each
            let allValid = true;
            let lastErr = null;
            let errIdx = -1;

            jsonBlocks.forEach((block, idx) => {
                try { JSON.parse(block); }
                catch (e) { allValid = false; lastErr = e; errIdx = idx; }
            });

            if (allValid) {
                currentErrorLine = -1;
                updateLineNumbers();
                if (aiFixJsonBtn) { aiFixJsonBtn.classList.add('hidden'); aiFixJsonBtn.classList.remove('flex'); }
                jsonValidationDot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                jsonValidationText.className = 'text-[10px] font-black uppercase tracking-wider text-emerald-600';
                jsonValidationText.textContent = `${jsonBlocks.length} Valid JSON Objects`;
                jsonValidationIndicator.classList.add('bg-emerald-50', 'border-emerald-200');
                return;
            } else {
                // Show error for the specific block
                jsonValidationText.textContent = `Obj #${errIdx + 1}: ${lastErr.message}`;
                jsonValidationIndicator.classList.add('bg-rose-50', 'border-rose-200');
                // We don't easily know the line number within the textarea for the specific block error here 
                // without more complex math, so we just flag it.
                return;
            }
        }

        try {
            JSON.parse(rawVal);
            // Valid
            currentErrorLine = -1;
            updateLineNumbers();
            if (aiFixJsonBtn) { aiFixJsonBtn.classList.add('hidden'); aiFixJsonBtn.classList.remove('flex'); }
            jsonValidationDot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
            jsonValidationText.className = 'text-[10px] font-black uppercase tracking-wider text-emerald-600';
            jsonValidationText.textContent = 'Valid JSON';
            jsonValidationIndicator.classList.add('bg-emerald-50', 'border-emerald-200');
        } catch (e) {
            let errorMsg = e.message;
            let line = 1;
            let pos = -1;
            let hint = 'Check syntax';

            const posMatch = errorMsg.match(/at position (\d+)/);
            if (posMatch) {
                pos = parseInt(posMatch[1]);
                line = rawVal.substring(0, pos).split('\n').length;
                const lastNewline = rawVal.lastIndexOf('\n', pos - 1);
                const textBeforeOnLine = rawVal.substring(lastNewline + 1, pos).trim();
                if (line > 1 && textBeforeOnLine.length === 0) {
                    line--;
                }
            } else {
                const lineColMatch = errorMsg.match(/at line (\d+) column (\d+)/);
                if (lineColMatch) {
                    line = parseInt(lineColMatch[1]);
                    const col = parseInt(lineColMatch[2]);
                    if (line > 1 && col <= 2) line--;
                    pos = rawVal.split('\n').slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0) + col - 1;
                }
            }

            // Smart hint: analyze the character at the error position and surrounding context
            if (pos >= 0 && pos <= rawVal.length) {
                const charAtPos = rawVal[pos] || '';
                // Look backward for context
                let prevNonSpace = '';
                for (let k = pos - 1; k >= 0; k--) {
                    if (rawVal[k].trim()) { prevNonSpace = rawVal[k]; break; }
                }

                if (errorMsg.includes('Unexpected end')) {
                    // Count brackets to determine what's unclosed
                    let openBraces = 0, openBrackets = 0;
                    for (let k = 0; k < rawVal.length; k++) {
                        if (rawVal[k] === '{') openBraces++;
                        else if (rawVal[k] === '}') openBraces--;
                        else if (rawVal[k] === '[') openBrackets++;
                        else if (rawVal[k] === ']') openBrackets--;
                    }
                    if (openBraces > 0 && openBrackets > 0) hint = 'Missing } and ]';
                    else if (openBraces > 0) hint = 'Missing } (closing brace)';
                    else if (openBrackets > 0) hint = 'Missing ] (closing bracket)';
                    else hint = 'Incomplete — missing closing quote or value';
                } else if (charAtPos === '"' && (prevNonSpace === '"' || prevNonSpace === '}' || prevNonSpace === ']' || /[a-z0-9]/i.test(prevNonSpace))) {
                    hint = 'Missing , (comma) before this';
                } else if (charAtPos === '{' || charAtPos === '[') {
                    if (prevNonSpace === '"' || prevNonSpace === '}' || prevNonSpace === ']' || /[0-9]/.test(prevNonSpace)) {
                        hint = 'Missing , (comma) before ' + charAtPos;
                    } else {
                        hint = 'Unexpected ' + charAtPos;
                    }
                } else if (charAtPos === '}' || charAtPos === ']') {
                    if (prevNonSpace === ',') hint = 'Trailing , (comma) before ' + charAtPos;
                    else hint = 'Extra ' + charAtPos + ' or unclosed block';
                } else if (charAtPos === ':') {
                    hint = 'Unexpected : — check key quoting';
                } else if (charAtPos === ',') {
                    hint = 'Unexpected , — check previous value';
                } else if (/[a-zA-Z]/.test(charAtPos)) {
                    const wordAfter = rawVal.substring(pos, pos + 10).match(/^[a-zA-Z]+/);
                    const word = wordAfter ? wordAfter[0] : charAtPos;
                    if (['true','false','null'].includes(word)) {
                        hint = 'Missing , or : before ' + word;
                    } else {
                        hint = 'Unquoted key — wrap "' + word + '" in quotes';
                    }
                } else if (/[0-9]/.test(charAtPos)) {
                    hint = 'Missing , (comma) or : (colon)';
                } else {
                    hint = 'Invalid character: ' + JSON.stringify(charAtPos);
                }
            } else {
                // Fallback to message-based hints
                if (errorMsg.includes('Unexpected token')) hint = 'Invalid character';
                else if (errorMsg.includes('Unexpected end')) hint = 'Incomplete JSON';
                else if (errorMsg.includes('Unexpected number')) hint = 'Missing , (comma)';
                else if (errorMsg.includes('Unexpected string')) hint = 'Missing , (comma)';
            }

            currentErrorLine = line;
            updateLineNumbers();
            if (aiFixJsonBtn) { aiFixJsonBtn.classList.remove('hidden'); aiFixJsonBtn.classList.add('flex'); }
            jsonValidationDot.className = 'w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
            jsonValidationText.className = 'text-[10px] font-black uppercase tracking-wider text-rose-600';
            jsonValidationText.textContent = `L${line}: ${hint}`;
            jsonValidationIndicator.classList.add('bg-rose-50', 'border-rose-200');
        }
    }

    // AI Fix JSON handler
    if (aiFixJsonBtn) {
        aiFixJsonBtn.addEventListener('click', async () => {
            const brokenJson = bulkManualJsonInput.value;
            if (!brokenJson.trim()) return;

            const icon = document.getElementById('ai-fix-json-icon');
            const text = document.getElementById('ai-fix-json-text');
            aiFixJsonBtn.disabled = true;
            icon.textContent = 'sync';
            icon.classList.add('animate-spin');
            text.textContent = 'Fixing...';

            // Gather error context from the validator
            const errorLine = currentErrorLine > 0 ? currentErrorLine : null;
            const errorHint = jsonValidationText?.textContent || '';

            let errorContext = '';
            if (errorLine) {
                const lines = brokenJson.split('\n');
                const problemLine = lines[errorLine - 1] || '';
                errorContext = `\n\nDiagnostics:\n- Error at Line ${errorLine}: ${errorHint}\n- Line content: ${problemLine.trim()}`;
                if (errorLine > 1) errorContext += `\n- Previous line: ${(lines[errorLine - 2] || '').trim()}`;
                if (errorLine < lines.length) errorContext += `\n- Next line: ${(lines[errorLine] || '').trim()}`;
            }

            try {
                const payload = {
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `You are a JSON repair tool. Fix the following broken JSON and return ONLY the corrected JSON with no explanation, no markdown fences, no extra text. Preserve all original data, keys, values, and structure. Only fix syntax errors (missing commas, brackets, braces, quotes, colons, trailing commas, etc).${errorContext}\n\nBroken JSON:\n${brokenJson}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.0,
                        maxOutputTokens: 65536
                    }
                };

                const response = await fetch(AIService.API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const result = await response.json();
                console.log('AI Fix Response:', result);

                if (result.success === false) {
                    throw new Error(result.message || 'AI Proxy Error');
                }

                let fixedText = '';
                if (result.candidates && result.candidates[0]?.content?.parts) {
                    fixedText = result.candidates[0].content.parts.map(p => p.text || '').join('');
                }

                // Strip markdown fences if present
                fixedText = fixedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

                if (!fixedText) {
                    const finishReason = result.candidates?.[0]?.finishReason || 'UNKNOWN';
                    throw new Error(`AI returned empty response (Reason: ${finishReason})`);
                }

                // Show Token Usage
                updateTokenUsage(result.usageMetadata);

                // Validate the fixed JSON
                try {
                    JSON.parse(fixedText);
                    bulkManualJsonInput.value = fixedText;
                    updateLineNumbers();
                    validateLiveJSON();
                    showToast('JSON fixed by AI!', 'success');
                } catch (parseErr) {
                    // AI returned invalid JSON too — try to use it anyway
                    bulkManualJsonInput.value = fixedText;
                    updateLineNumbers();
                    validateLiveJSON();
                    showToast('AI attempted fix but JSON may still have issues.', 'update');
                }
            } catch (err) {
                console.error('AI Fix JSON Error:', err);
                showToast('AI Fix failed: ' + err.message, 'error');
            } finally {
                aiFixJsonBtn.disabled = false;
                icon.textContent = 'auto_fix_high';
                icon.classList.remove('animate-spin');
                text.textContent = 'AI Fix';
            }
        });
    }

    // Event Listeners
    bulkManualJsonInput.addEventListener('input', () => {
        updateLineNumbers();
        validateLiveJSON();
    });

    bulkManualJsonInput.addEventListener('scroll', () => {
        if (jsonLineNumbers) jsonLineNumbers.scrollTop = bulkManualJsonInput.scrollTop;
    });

    async function populateSubjects(selector) {
        try {
            const result = await CacheManager.fetchWithCache(SUBJECT_API_URL, 60);
            if (result) {
                subjects = result; // Store for bulk mode
                selector.innerHTML = selector === subjectFilter ? '<option value="0">All Subjects</option>' : '<option value="">Select Subject</option>';
                result.forEach(subject => {
                    selector.innerHTML += `<option value="${subject.id}">${subject.subject_name}</option>`;
                });

                // Restore main list filters
                if (selector === subjectFilter) {
                    const savedSubject = localStorage.getItem('filter_exam_subject');
                    if (savedSubject && savedSubject !== '0') {
                        subjectFilter.value = savedSubject;
                        const savedLesson = localStorage.getItem('filter_exam_lesson');
                        if (savedLesson && savedLesson !== '0') {
                            populateLessons(savedSubject, lessonFilter, savedLesson);
                        } else {
                            await populateLessons(savedSubject, lessonFilter);
                            fetchAndDisplayExams(false);
                        }
                    } else {
                        fetchAndDisplayExams(false);
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
            const result = await CacheManager.fetchWithCache(`${LESSON_API_URL}?subject_id=${subjectId}`, 60);
            if (result) {
                selector.innerHTML = selector === lessonFilter ? '<option value="0">All Lessons</option>' : '<option value="">Select Lesson</option>';
                result.forEach(lesson => {
                    selector.innerHTML += `<option value="${lesson.id}">${lesson.lesson_name}</option>`;
                });
                selector.disabled = false;
                if (lessonToSelect) {
                    selector.value = lessonToSelect;
                    if (selector === lessonFilter) {
                        populateTopics(lessonToSelect, topicFilter, localStorage.getItem('filter_exam_topic'));
                    }
                }
            }
        } catch (error) { showToast('Failed to load lessons.', 'error'); }
    }

    async function populateTopics(lessonId, selector, topicToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!lessonId || lessonId === "0") {
            selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Lesson First</option>';
            return;
        }
        try {
            const result = await CacheManager.fetchWithCache(`${TOPIC_API_URL}?lesson_id=${lessonId}`, 60);
            if (result) {
                selector.innerHTML = selector === topicFilter ? '<option value="0">All Topics</option>' : '<option value="">Select Topic</option>';
                result.forEach(topic => {
                    selector.innerHTML += `<option value="${topic.id}">${topic.topic_name}</option>`;
                });
                selector.disabled = false;
                if (topicToSelect) {
                    selector.value = topicToSelect;
                }
                // Refresh list only if this is the main filter and not modal
                if (selector === topicFilter) {
                    fetchAndDisplayExams(false);
                }
            }
        } catch (error) { showToast('Failed to load topics.', 'error'); }
    }

    function highlightText(text, term) {
        if (!term || !text) return text;
        const regex = new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="bg-yellow-100 text-yellow-900 font-bold px-0.5 rounded">$1</mark>');
    }

    function getDifficultyBadge(passRate, totalAttempts, avgScore) {
        if (!totalAttempts || totalAttempts == 0) return `<span class="bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-gray-100">No Data</span>`;

        let colorClass = "";
        let text = "";
        const rate = parseFloat(passRate);

        if (rate >= 95) { colorClass = "bg-blue-50 text-blue-600 border-blue-100"; text = "Ace"; }
        else if (rate >= 80) { colorClass = "bg-emerald-50 text-emerald-600 border-emerald-100"; text = "Easy"; }
        else if (rate >= 50) { colorClass = "bg-amber-50 text-amber-600 border-amber-100"; text = "Regular"; }
        else if (rate >= 20) { colorClass = "bg-orange-50 text-orange-600 border-orange-100"; text = "Challenge"; }
        else { colorClass = "bg-rose-50 text-rose-600 border-rose-100"; text = "Elite"; }

        const avgScoreText = avgScore !== null && avgScore !== undefined ? `Avg Score: ${parseFloat(avgScore).toFixed(1)}` : 'No score data';

        return `<span class="${colorClass} px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tight border flex items-center gap-1.5 w-fit shadow-xs cursor-help transition-all hover:brightness-95" 
                    title="Pass Rate: ${rate.toFixed(1)}% | Attempts: ${totalAttempts} | ${avgScoreText}">
                    <span class="w-1.5 h-1.5 rounded-full ${colorClass.split(' ')[1].replace('text-', 'bg-')} animate-pulse"></span>
                    <span class="flex items-center gap-1">
                        ${text} 
                        <span class="opacity-20 font-light">|</span> 
                        ${Math.round(rate)}% 
                        <span class="opacity-20 font-light">|</span> 
                        ${totalAttempts}<span class="text-[8px] opacity-60 lowercase">att</span>
                    </span>
                </span>`;
    }

    async function fetchAndDisplayExams(append = false, forceRefresh = false) {
        if (isFetching) return;
        isFetching = true;

        if (!append) {
            currentOffset = 0;
            // If we already have items, don't clear, just dim
            if (tableBody.children.length > 0 && tableBody.querySelector('tr td span.animate-spin') === null) {
                inventoryContainer.classList.add('content-dimmed');
                progressBar.classList.remove('hidden');
                progressBar.classList.add('content-loading');
            } else {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8"><span class="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span><p class="mt-2 text-gray-500 font-medium tracking-tight">Loading exams...</p></td></tr>';
                cardView.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-blue-500"><span class="material-symbols-outlined animate-spin text-5xl">sync</span><p class="mt-4 text-gray-600 font-medium">Loading exams...</p></div>';
            }
            document.getElementById('load-more-container').classList.add('hidden');
        }

        let url = `${EXAM_API_URL}?action=list&limit=${itemsPerPage}&offset=${currentOffset}&exclude_custom=true`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        if (globalSearch && globalSearch.value.trim()) params.append('search', globalSearch.value.trim());

        // Add sorting params
        params.append('sort_by', currentSortBy);
        params.append('sort_direction', currentSortOrder);

        const query = params.toString();
        if (query) url += `&${query}`;

        try {
            const result = await CacheManager.fetchWithCache(url, 2, forceRefresh, false, true);

            // Cleanup loading state
            inventoryContainer.classList.remove('content-dimmed');
            progressBar.classList.add('hidden');
            progressBar.classList.remove('content-loading');

            if (!append) {
                tableBody.innerHTML = '';
                cardView.innerHTML = '';
            }

            if (result && result.success && result.data.length > 0) {
                const todayVal = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowVal = tomorrow.toLocaleDateString('en-CA');

                const searchTerm = globalSearch ? globalSearch.value.trim() : "";
                result.data.forEach(exam => {
                    const isRevision = exam.last_revision_date === todayVal || exam.last_revision_date === tomorrowVal;
                    const isSelected = selectedExamIds.has(exam.id.toString());
                    // Search Match HTML
                    let matchHtml = "";
                    if (searchTerm && exam.match_type) {
                        const highlightedSnippet = exam.match_text ?
                            `<div class="mt-1 text-[10px] text-gray-400 italic line-clamp-1 border-l-2 border-blue-100 pl-2">
                                ...${highlightText(exam.match_text, searchTerm)}...
                             </div>` : "";

                        matchHtml = `
                            <div class="mt-2 flex flex-col gap-1">
                                <span class="inline-flex items-center w-fit px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-tight border border-blue-100">
                                    <span class="material-symbols-outlined text-[10px] mr-1">info</span>
                                    Matched in ${exam.match_type}
                                </span>
                                ${highlightedSnippet}
                            </div>`;
                    }

                    // Completion styling from parent lesson
                    const isLessonComplete = parseInt(exam.lesson_is_complete) || 0;
                    const examColorClass = exam.color_class || 'violet';
                    const completionRowStyle = isLessonComplete ? `style="background-color:${getCompletionStyle(examColorClass).bg};border-left:4px solid ${getCompletionStyle(examColorClass).border}"` : '';
                    const completeLessonBadge = isLessonComplete ? `<span class="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold" style="background-color:${getCompletionStyle(examColorClass).badge};color:${getCompletionStyle(examColorClass).badgeText}">✓</span>` : '';

                    // Desktop Table Row
                    const row = `
                        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}" ${completionRowStyle}>
                            <td class="py-4 px-6 text-left">
                                <input type="checkbox" class="exam-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" data-id="${exam.id}" ${isSelected ? 'checked' : ''}>
                            </td>
                            <td class="py-4 px-6 text-left">
                                <span class="font-bold text-gray-900 block" title="${exam.exam_title}">${searchTerm ? highlightText(exam.exam_title, searchTerm) : exam.exam_title}</span>
                                ${matchHtml}
                            </td>
                            <td class="py-4 px-6 text-left">
                                <div class="flex flex-col text-[10px] leading-tight text-gray-500 gap-1">
                                    <div class="flex items-center gap-1">
                                        <span class="bg-blue-100 text-blue-700 font-black px-1 rounded-[4px] scale-90">S</span>
                                        <span class="font-bold text-blue-800 uppercase tracking-tighter">${exam.subject_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="bg-gray-100 text-gray-600 font-black px-1 rounded-[4px] scale-90">L</span>
                                        <span class="truncate max-w-[130px]">${exam.lesson_name || 'N/A'}</span> ${completeLessonBadge}
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="bg-gray-50 text-gray-400 font-black px-1 rounded-[4px] scale-90">T</span>
                                        <span class="italic text-gray-400 truncate max-w-[130px]">${exam.topic_name || 'N/A'}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <div class="flex justify-center">${getDifficultyBadge(exam.pass_rate, exam.total_attempts, exam.avg_score)}</div>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-black tracking-tight">${exam.duration}m</span>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-black tracking-tight">${exam.total_marks}</span>
                            </td>
                            <td class="py-4 px-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button class="quick-look-btn p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" data-title="${exam.exam_title}" title="Quick Look">
                                        <span class="material-symbols-outlined text-lg">visibility</span>
                                    </button>
                                    ${isRevision ? `
                                    <button class="untag-revision-btn p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" data-title="${exam.exam_title}" title="Remove Revision">
                                        <span class="material-symbols-outlined text-lg">bookmark_remove</span>
                                    </button>` : ''}
                                    <button class="edit-btn p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" title="Edit Exam">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button class="manage-questions-btn p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" data-title="${exam.exam_title}" title="Manage Questions">
                                        <span class="material-symbols-outlined text-lg">quiz</span>
                                    </button>
                                    <button class="delete-btn p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm" data-id="${exam.id}" title="Delete Exam">
                                        <span class="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;

                    // Mobile Card
                    const completionCardStyle = isLessonComplete ? `style="background-color:${getCompletionStyle(examColorClass).bg};border-left:4px solid ${getCompletionStyle(examColorClass).border};border-color:${getCompletionStyle(examColorClass).border}"` : '';
                    const card = `
                        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}" ${completionCardStyle}>
                           <div class="absolute top-2 left-2 z-20">
                                <input type="checkbox" class="exam-checkbox w-5 h-5 rounded-full text-blue-600 focus:ring-blue-500 border-gray-300 shadow-sm" data-id="${exam.id}" ${isSelected ? 'checked' : ''}>
                           </div>
                           <div class="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-[60px] flex items-start justify-end p-2 z-0">
                                <span class="material-symbols-outlined text-blue-200/50 text-4xl">assignment</span>
                           </div>
                           <div class="relative z-10">
                                <h3 class="font-black text-gray-900 leading-tight pr-8">${searchTerm ? highlightText(exam.exam_title, searchTerm) : exam.exam_title}</h3>
                                ${matchHtml}
                                <div class="mt-2 flex flex-col gap-1 text-[10px] font-medium text-gray-500">
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-blue-50 text-blue-600 font-black px-1 rounded-sm scale-90">S</span>
                                        <span class="text-blue-600 font-bold uppercase tracking-wider">${exam.subject_name || 'N/A'}</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-gray-50 text-gray-400 font-black px-1 rounded-sm scale-90">L</span>
                                        <span class="text-gray-400">${exam.lesson_name || 'N/A'}</span> ${completeLessonBadge}
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="bg-gray-50 text-gray-300 font-black px-1 rounded-sm scale-90">T</span>
                                        <span class="text-gray-400/80 italic">${exam.topic_name || 'N/A'}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 mt-3 flex-wrap">
                                    <span class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none">
                                        <span class="material-symbols-outlined text-sm">schedule</span>
                                        ${exam.duration}m
                                    </span>
                                    <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 leading-none shadow-sm">
                                        <span class="material-symbols-outlined text-sm">military_tech</span>
                                        ${exam.total_marks}M
                                    </span>
                                    ${getDifficultyBadge(exam.pass_rate, exam.total_attempts, exam.avg_score)}
                                </div>
                                <div class="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
                                    <button class="quick-look-btn bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs" data-id="${exam.id}" data-title="${exam.exam_title}" title="Quick Look">
                                        <span class="material-symbols-outlined text-lg">visibility</span>
                                    </button>
                                    ${isRevision ? `
                                    <button class="untag-revision-btn bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs" data-id="${exam.id}" data-title="${exam.exam_title}" title="Remove Revision">
                                        <span class="material-symbols-outlined text-lg">bookmark_remove</span>
                                    </button>` : ''}
                                    <button class="edit-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs" data-id="${exam.id}" title="Edit">
                                        <span class="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button class="manage-questions-btn bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs" data-id="${exam.id}" data-title="${exam.exam_title}" title="Manage Questions">
                                        <span class="material-symbols-outlined text-lg">quiz</span>
                                    </button>
                                    <button class="delete-btn bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-2.5 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-xs" data-id="${exam.id}" title="Delete">
                                        <span class="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                           </div>
                        </div>`;
                    cardView.innerHTML += card;
                });

                // Update Pagination Info
                const totalLoaded = (currentOffset + result.data.length);
                currentCountEl.textContent = totalLoaded;
                totalCountEl.textContent = result.pagination.total;

                // Show/hide Load More button
                const loadMoreContainer = document.getElementById('load-more-container');
                if (result.pagination.hasMore) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            } else {
                if (!append) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-gray-400 font-medium">No exams found.</td></tr>`;
                    cardView.innerHTML = `<div class="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-12 px-6 text-center text-gray-400 font-medium">No exams found for selection.</div>`;
                    currentCountEl.textContent = 0;
                    totalCountEl.textContent = 0;
                    document.getElementById('load-more-container').classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Failed to load exams.', 'error');
            if (!append) tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500 font-bold">Error loading exams.</td></tr>`;
        } finally {
            isFetching = false;
            // Always cleanup loading state
            inventoryContainer.classList.remove('content-dimmed');
            progressBar.classList.add('hidden');
            progressBar.classList.remove('content-loading');
        }
    }

    async function loadMoreExams() {
        const loadMoreBtn = document.getElementById('load-more-btn');
        const originalContent = loadMoreBtn.innerHTML;
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-2">sync</span> Loading...';

        currentOffset += itemsPerPage;
        await fetchAndDisplayExams(true);

        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = originalContent;
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modal === examModal) {
            importedQuestions = [];
            if (modalQuestionsJson) modalQuestionsJson.value = '';
            if (previewContainer) {
                previewContainer.innerHTML = '';
                previewContainer.classList.add('hidden');
            }
            // Reset bulk state
            extractedSections = [];
            if (bulkManualJsonInput) bulkManualJsonInput.value = '';
            if (bulkCategorizationContainer) bulkCategorizationContainer.classList.add('hidden');
            if (sectionsContainer) sectionsContainer.classList.add('hidden');
            if (resultsPlaceholder) resultsPlaceholder.classList.remove('hidden');
        }
    }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(examForm);
        const data = Object.fromEntries(formData.entries());

        // Validating JSON array if textarea has content
        const jsonText = modalQuestionsJson?.value?.trim();
        if (jsonText) {
            const result = QuestionUtils.parseQuestionsJSON(jsonText);
            if (!result.success) {
                showToast(`JSON Error: ${result.message}`, 'error');
                modalQuestionsJson.focus();
                return; // Stop submission
            }
            data.questions = result.data;
        }

        const url = data.id ? `${EXAM_API_URL}?action=update` : `${EXAM_API_URL}?action=create`;

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(examModal);
                // Cache Invalidation
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                    CacheManager.clearGroup('exam');
                    CacheManager.clearGroup('custom-exam');
                }
                fetchAndDisplayExams(false, true); // Force refresh
                showToast(result.message, data.id ? 'update' : 'success');

                // Auto-fill: Save last used values for creation
                if (!data.id) {
                    localStorage.setItem('last_exam_subject_id', data.subject_id);
                    localStorage.setItem('last_exam_lesson_id', data.lesson_id);
                    localStorage.setItem('last_exam_topic_id', data.topic_id);
                }

                // Show scan prompt if questions were imported
                if (data.questions && data.questions.length > 0) {
                    const importedExamId = result.id || data.id;
                    const importedExamTitle = data.exam_title || 'Imported Exam';
                    if (importedExamId) {
                        setTimeout(() => showPostImportScanPrompt(importedExamId, importedExamTitle), 500);
                    }
                }
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('A network error occurred.', 'error'); }
    }

    async function handleDeleteConfirm() {
        if (!examIdToDelete) return;
        try {
            const response = await fetch(`${EXAM_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: examIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally {
            closeModal(deleteModal);
            // Cache Invalidation
            if (typeof CacheManager !== 'undefined') {
                CacheManager.clearGroup('dashboard');
                CacheManager.clearGroup('exam');
                CacheManager.clearGroup('custom-exam');
            }
            fetchAndDisplayExams(false, true); // Force refresh
        }
    }

    async function handleListClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const manageQuestionsBtn = e.target.closest('.manage-questions-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            try {
                const response = await fetch(`${EXAM_API_URL}?action=get_single&id=${id}`);
                const result = await response.json();
                if (result.success) {
                    const exam = result.data;
                    document.getElementById('exam-modal-title').textContent = 'Edit Exam';
                    document.getElementById('exam-id').value = exam.id;
                    modalSubjectSelector.value = exam.subject_id;
                    await populateLessons(exam.subject_id, modalLessonSelector, exam.lesson_id);
                    await populateTopics(exam.lesson_id, modalTopicSelector, exam.topic_id);
                    document.getElementById('exam-title').value = exam.exam_title;
                    document.getElementById('duration').value = exam.duration;
                    document.getElementById('instructions').value = exam.instructions;
                    document.getElementById('total-marks').value = exam.total_marks;
                    document.getElementById('pass-mark').value = exam.pass_mark;

                    // Set initial metrics for additive updates
                    initialExamMetrics = {
                        duration: parseInt(exam.duration) || 0,
                        totalMarks: parseInt(exam.total_marks) || 0
                    };

                    openModal(examModal);
                    switchTab('manual');
                }
            } catch (error) { showToast('Failed to fetch exam details.', 'error'); }
        }

        if (deleteBtn) {
            examIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }

        if (manageQuestionsBtn) {
            const id = manageQuestionsBtn.dataset.id;
            const title = manageQuestionsBtn.dataset.title;
            // Use the global loadPage function if available (SPA navigation), otherwise allow standard link behavior or manual redirect
            if (window.loadPage) {
                window.loadPage('questions-list', `?exam_id=${id}&exam_title=${encodeURIComponent(title)}`);
            } else {
                // Fallback for non-SPA context or if loadPage isn't globally available yet
                const url = `?page=questions-list&exam_id=${id}&exam_title=${encodeURIComponent(title)}`;
                window.location.href = url;
            }
        }

        const quickLookBtn = e.target.closest('.quick-look-btn');
        if (quickLookBtn) {
            handleQuickLook(quickLookBtn.dataset.id, quickLookBtn.dataset.title);
        }

        if (e.target.classList.contains('exam-checkbox')) {
            toggleSelected(e.target.dataset.id, e.target.checked);
        }
    }

    function toggleSelected(id, isSelected) {
        if (isSelected) {
            selectedExamIds.add(id);
        } else {
            selectedExamIds.delete(id);
        }
        updateBulkBar();
        // Update row/card visual state
        document.querySelectorAll(`.exam-checkbox[data-id="${id}"]`).forEach(cb => {
            cb.checked = isSelected;
            const container = cb.closest('tr') || cb.closest('.group');
            if (container) {
                if (isSelected) {
                    if (container.tagName === 'TR') container.classList.add('bg-blue-50/30');
                    else container.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/10');
                } else {
                    if (container.tagName === 'TR') container.classList.remove('bg-blue-50/30');
                    else container.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/10');
                }
            }
        });
    }

    function updateBulkBar() {
        if (selectedExamIds.size > 0) {
            bulkActionBar.classList.remove('hidden');
            selectedCountEl.textContent = selectedExamIds.size;
            // Lazy load subjects for bulk re-categorization dropdown
            if (bulkSubjectTarget.options.length <= 1) {
                populateSubjects(bulkSubjectTarget);
            }
        } else {
            bulkActionBar.classList.add('hidden');
            if (selectAllExams) selectAllExams.checked = false;
        }
    }

    async function handleQuickLook(id, title) {
        previewExamTitle.textContent = title;
        previewExamSubtitle.textContent = "Loading questions...";
        previewQuestionsContainer.innerHTML = '';
        previewQuestionsContainer.appendChild(previewLoading);
        previewLoading.classList.remove('hidden');
        openModal(quickLookModal);

        try {
            const response = await fetch(`api/question/list.php?exam_id=${id}`);
            const result = await response.json();

            previewLoading.classList.add('hidden');
            if (result.success && result.data.length > 0) {
                previewExamSubtitle.textContent = `Reviewing ${result.data.length} questions`;
                renderPreviewQuestions(result.data);
            } else {
                previewExamSubtitle.textContent = "No questions found";
                previewQuestionsContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                        <span class="material-symbols-outlined text-6xl mb-4">description</span>
                        <p class="font-bold text-lg text-gray-500">No questions added yet.</p>
                        <p class="text-sm">Click 'Manage Questions' to start adding content.</p>
                    </div>`;
            }
        } catch (error) {
            previewLoading.classList.add('hidden');
            previewExamSubtitle.textContent = "Error loading questions";
            showToast('Failed to fetch questions.', 'error');
        }
    }

    function renderPreviewQuestions(questions) {
        previewQuestionsContainer.innerHTML = '';
        questions.forEach((q, index) => {
            const options = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : {};
            let optionsHtml = '';

            Object.entries(options).forEach(([key, val]) => {
                const isCorrect = key === q.answer;
                optionsHtml += `
                    <div class="flex items-center gap-3 p-3 rounded-xl border ${isCorrect ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' : 'border-gray-100 bg-white text-gray-600'}">
                        <span class="w-6 h-6 flex items-center justify-center rounded-full ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'} font-bold text-xs">
                            ${key.toUpperCase()}
                        </span>
                        <span class="flex-1 font-medium">${val}</span>
                        ${isCorrect ? '<span class="material-symbols-outlined text-emerald-600">check_circle</span>' : ''}
                    </div>`;
            });

            const qCard = document.createElement('div');
            qCard.className = 'bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4';
            qCard.innerHTML = `
                <div class="flex items-start gap-4">
                    <span class="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center font-black flex-shrink-0">
                        ${index + 1}
                    </span>
                    <div class="flex-1">
                        <h4 class="text-slate-800 font-bold leading-relaxed">${q.question}</h4>
                        ${q.explanation ? `<p class="mt-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200"><span class="font-black uppercase text-[9px] block mb-1">Explanation</span>${q.explanation}</p>` : ''}
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
                    ${optionsHtml}
                </div>`;
            previewQuestionsContainer.appendChild(qCard);
        });
    }

    // --- Setup Listeners ---
    createBtn.addEventListener('click', () => {
        document.getElementById('exam-modal-title').textContent = 'Add New Exam';
        examForm.reset();
        document.getElementById('exam-id').value = '';
        document.getElementById('instructions').value = defaultInstructions;
        document.getElementById('duration').value = 10;
        document.getElementById('total-marks').value = 10;
        document.getElementById('pass-mark').value = 10;

        initialExamMetrics = null; // Reset for new exam
        extractedSections = []; // Clear bulk queue
        bulkManualJsonInput.value = '';
        renderSections();
        renderBulkTable();
        switchTab('manual'); // Default to manual for New/Edit

        modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
        modalTopicSelector.disabled = true;

        // Auto-fill filters from localStorage
        const lastSubjectId = localStorage.getItem('last_exam_subject_id');
        const lastLessonId = localStorage.getItem('last_exam_lesson_id');
        const lastTopicId = localStorage.getItem('last_exam_topic_id');

        if (lastSubjectId) {
            modalSubjectSelector.value = lastSubjectId;
            populateLessons(lastSubjectId, modalLessonSelector, lastLessonId).then(() => {
                if (lastLessonId) {
                    populateTopics(lastLessonId, modalTopicSelector, lastTopicId);
                }
            });
        }

        openModal(examModal);
    });

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            modalSubjectSelector.value = "";
            modalLessonSelector.innerHTML = '<option value="">Select Subject First</option>';
            modalLessonSelector.disabled = true;
            modalTopicSelector.innerHTML = '<option value="">Select Lesson First</option>';
            modalTopicSelector.disabled = true;

            // Clear localStorage values
            localStorage.removeItem('last_exam_subject_id');
            localStorage.removeItem('last_exam_lesson_id');
            localStorage.removeItem('last_exam_topic_id');
        });
    }

    examForm.addEventListener('submit', handleFormSubmit);
    tableBody.addEventListener('click', handleListClick);
    cardView.addEventListener('click', handleListClick);
    loadMoreBtn.addEventListener('click', loadMoreExams);

    // Filter listeners
    subjectFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_subject', subjectFilter.value);
        localStorage.removeItem('filter_exam_lesson');
        localStorage.removeItem('filter_exam_topic');
        populateLessons(subjectFilter.value, lessonFilter);
        lessonFilter.dispatchEvent(new Event('change')); // Trigger lesson filter change
    });
    lessonFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_lesson', lessonFilter.value);
        localStorage.removeItem('filter_exam_topic');
        populateTopics(lessonFilter.value, topicFilter);
        topicFilter.dispatchEvent(new Event('change')); // Trigger topic filter change
    });
    topicFilter.addEventListener('change', () => {
        localStorage.setItem('filter_exam_topic', topicFilter.value);
        fetchAndDisplayExams(false);
    });

    if (mainClearFiltersBtn) {
        mainClearFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_exam_subject');
            localStorage.removeItem('filter_exam_lesson');
            localStorage.removeItem('filter_exam_topic');

            subjectFilter.value = "0";
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;

            if (globalSearch) globalSearch.value = "";

            fetchAndDisplayExams(false);
        });
    }

    // Modal dependent dropdown listeners
    modalSubjectSelector.addEventListener('change', () => populateLessons(modalSubjectSelector.value, modalLessonSelector));
    modalLessonSelector.addEventListener('change', () => populateTopics(modalLessonSelector.value, modalTopicSelector));

    // Global Search Debouncing
    let searchTimeout;
    if (globalSearch) {
        globalSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentOffset = 0; // Reset pagination on search
                fetchAndDisplayExams(false);
            }, 500);
        });
    }

    // Bulk Action Listeners
    if (selectAllExams) {
        selectAllExams.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.exam-checkbox');
            checkboxes.forEach(cb => toggleSelected(cb.dataset.id, selectAllExams.checked));
        });
    }

    if (bulkSubjectTarget) {
        bulkSubjectTarget.addEventListener('change', () => populateLessons(bulkSubjectTarget.value, bulkLessonTarget));
        bulkLessonTarget.addEventListener('change', () => populateTopics(bulkLessonTarget.value, bulkTopicTarget));
    }

    document.getElementById('cancel-bulk-btn').addEventListener('click', () => {
        selectedExamIds.clear();
        document.querySelectorAll('.exam-checkbox').forEach(cb => toggleSelected(cb.dataset.id, false));
    });

    document.getElementById('apply-bulk-btn').addEventListener('click', async () => {
        const subjectId = bulkSubjectTarget.value;
        const lessonId = bulkLessonTarget.value;
        const topicId = bulkTopicTarget.value;

        if (!subjectId || !lessonId || !topicId) {
            showToast('Please select all target categories.', 'error');
            return;
        }

        try {
            const response = await fetch(`${EXAM_API_URL}?action=bulk_update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(selectedExamIds),
                    subject_id: subjectId,
                    lesson_id: lessonId,
                    topic_id: topicId
                })
            });

            const result = await response.json();
            if (result.success) {
                showToast(result.message);
                selectedExamIds.clear();
                updateBulkBar();
                fetchAndDisplayExams(false, true); // Refresh and bypass cache
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Bulk update failed.', 'error');
        }
    });

    // Modal close buttons
    document.getElementById('close-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-modal-btn').addEventListener('click', () => closeModal(examModal));
    document.getElementById('cancel-exam-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-exam-delete-btn').addEventListener('click', handleDeleteConfirm);

    if (closePreviewBtn) closePreviewBtn.addEventListener('click', () => closeModal(quickLookModal));
    if (closePreviewFooterBtn) closePreviewFooterBtn.addEventListener('click', () => closeModal(quickLookModal));

    tabManual.onclick = () => switchTab('manual');
    tabBulk.onclick = () => switchTab('bulk');

    // Sorting Listeners
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.dataset.sort;
            if (currentSortBy === sortBy) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortBy = sortBy;
                currentSortOrder = 'desc'; // Default to desc for new column
            }
            updateSortUI();
            fetchAndDisplayExams(false, true);
        });
    });

    const mobileSortSelector = document.getElementById('mobile-sort-selector');
    if (mobileSortSelector) {
        mobileSortSelector.addEventListener('change', (e) => {
            const [sortBy, sortOrder] = e.target.value.split('-');
            currentSortBy = sortBy;
            currentSortOrder = sortOrder;
            updateSortUI();
            fetchAndDisplayExams(false, true);
        });
    }

    const resetSortBtn = document.getElementById('reset-sort-btn');
    if (resetSortBtn) {
        resetSortBtn.addEventListener('click', () => {
            currentSortBy = 'id';
            currentSortOrder = 'desc';
            if (mobileSortSelector) mobileSortSelector.value = 'id-desc';
            updateSortUI();
            fetchAndDisplayExams(false, true);
            showToast('Sorting reset to newest first.', 'success');
        });
    }

    function updateSortUI() {
        document.querySelectorAll('th[data-sort]').forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (header.dataset.sort === currentSortBy) {
                header.classList.add('text-blue-600');
                icon.textContent = currentSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
                icon.classList.remove('opacity-20');
                icon.classList.add('opacity-100');
            } else {
                header.classList.remove('text-blue-600');
                icon.textContent = 'unfold_more';
                icon.classList.remove('opacity-100');
                icon.classList.add('opacity-20');
            }
        });
    }

    function extractJSONObjects(str) {
        const objects = [];
        let braceCount = 0;
        let startIdx = -1;
        let inString = false;
        let escape = false;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;

            if (char === '{') {
                if (braceCount === 0) startIdx = i;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIdx !== -1) {
                    objects.push(str.substring(startIdx, i + 1));
                    startIdx = -1;
                }
            }
        }
        return objects;
    }

    // Bulk Import Listeners
    function handleBulkJSON(json, skipTopicDetection = false) {
        if (!json) return;
        
        let jsonBlocks = [];
        try {
            // Try parsing as a single object/array first
            JSON.parse(json);
            jsonBlocks = [json];
        } catch (e) {
            // If it fails, try extracting multiple objects
            jsonBlocks = extractJSONObjects(json);
        }

        if (jsonBlocks.length === 0) {
            if (json.trim().startsWith('[') || json.trim().startsWith('{')) {
                showToast(`JSON Error: Invalid structure or unclosed braces.`, 'error');
            }
            return;
        }

        let allSections = [];
        let allTopics = [];
        let totalObjectsDetected = jsonBlocks.length;

        jsonBlocks.forEach((block, blockIdx) => {
            try {
                const data = JSON.parse(block);
                let arrayData;
                let isFlat = false;
                let blockTopics = [];

                // Detect {topic_summary, question_stream} wrapper format
                if (!Array.isArray(data) && (data.question_stream || data.topic_summary)) {
                    if (data.topic_summary && Array.isArray(data.topic_summary)) {
                        blockTopics = data.topic_summary;
                    }
                    arrayData = Array.isArray(data.question_stream) ? data.question_stream : [];
                } else {
                    arrayData = Array.isArray(data) ? data : [data];
                }

                // Detect flat question array
                isFlat = arrayData.length > 0 && arrayData[0].question && !arrayData[0].data && !arrayData[0]["Exam Title"];
                if (isFlat) {
                    arrayData = [{ "Exam Title": `Imported Batch ${blockIdx + 1}`, "data": arrayData }];
                }

                const blockSections = arrayData.map(item => ({
                    title: item["Exam Title"] || item["title"] || "Untitled Exam",
                    questions: (item.data || item.questions || []).map(q => ({
                        ...q,
                        priority: parseInt(q.priority) || 0
                    })),
                    target: { subject: 0, lesson: 0, topic: 0 },
                    isExcluded: false
                })).filter(s => s.questions.length > 0);

                allSections = allSections.concat(blockSections);
                allTopics = allTopics.concat(blockTopics);

                // Auto-detect topics from titles if block had no summary
                if (!skipTopicDetection && blockTopics.length === 0 && !isFlat && blockSections.length > 0) {
                    const detected = blockSections.map(s => ({
                        topic_name: s.title,
                        page_from: '',
                        page_to: ''
                    })).filter(t => t.topic_name && t.topic_name !== 'Untitled Exam');
                    allTopics = allTopics.concat(detected);
                }
            } catch (e) {
                console.error(`Error parsing JSON block ${blockIdx + 1}:`, e);
            }
        });

        if (allSections.length === 0) {
            showToast("No valid exams or questions found in the provided JSON.", "error");
            return;
        }

        extractedSections = allSections;

        // Show combined topic import if any topics were found/detected
        if (allTopics.length > 0 && topicImportSection) {
            // Unique by topic_name
            const uniqueTopics = [];
            const seen = new Set();
            allTopics.forEach(t => {
                if (!seen.has(t.topic_name)) {
                    seen.add(t.topic_name);
                    uniqueTopics.push(t);
                }
            });
            showTopicImport(uniqueTopics);
            showToast(`${uniqueTopics.length} topics detected across ${totalObjectsDetected} objects!`);
        }

        renderBulkTable();
        renderSections();
        showToast(`Queue Initialized: ${extractedSections.length} Exams from ${totalObjectsDetected} JSON objects.`);
        bulkManualJsonInput.value = ''; // Clear after successful parse
        updateLineNumbers();
        validateLiveJSON();
    }

    bulkInitQueueBtn.onclick = () => {
        handleBulkJSON(bulkManualJsonInput.value.trim());
    };

    bulkManualJsonInput.addEventListener('paste', (e) => {
        const pastedData = (e.clipboardData || window.clipboardData).getData('text');
        if (pastedData) {
            try {
                const trimmed = pastedData.trim();
                if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                    JSON.parse(trimmed); // Validate
                    showToast('Valid JSON detected! Click "Init Import Queue" to proceed.');
                }
            } catch (err) {
                // Not valid JSON or parsing error, do nothing (normal paste)
            }
        }
    });

    // ==========================================
    // AI SMART IMPORT HANDLERS
    // ==========================================

    // --- Prompt Presets CRUD ---
    async function loadPromptPresets() {
        try {
            const resp = await fetch(`${PROMPT_API_URL}?action=list`);
            const data = await resp.json();
            if (!data.success || !data.presets?.length) {
                promptPresetSelect.innerHTML = '<option value="">No presets found</option>';
                return;
            }
            promptPresetSelect.innerHTML = data.presets.map(p =>
                `<option value="${p.id}" ${p.is_default == 1 ? 'selected' : ''}>${p.name}${p.is_default == 1 ? ' ★' : ''}</option>`
            ).join('');
            // Auto-load the selected preset's text
            await loadActivePrompt();
        } catch (e) {
            console.error('Failed to load prompt presets:', e);
            promptPresetSelect.innerHTML = '<option value="">Error loading</option>';
        }
    }

    async function loadActivePrompt() {
        const id = promptPresetSelect.value;
        if (!id) { activePromptText = ''; return; }
        try {
            const resp = await fetch(`${PROMPT_API_URL}?action=get&id=${id}`);
            const data = await resp.json();
            if (data.success && data.preset) {
                activePromptText = data.preset.prompt_text;
                // Show/hide delete button (hide for defaults)
                if (presetDeleteBtn) {
                    presetDeleteBtn.classList.toggle('hidden', data.preset.is_default == 1);
                }
            }
        } catch (e) {
            console.error('Failed to load prompt:', e);
        }
    }

    function openPromptModal(mode, preset = null) {
        if (mode === 'new') {
            promptModalTitle.textContent = 'New Prompt Preset';
            promptNameInput.value = '';
            promptTextEditor.value = '';
            editingPresetId = null;
        } else {
            promptModalTitle.textContent = 'Edit Prompt Preset';
            promptNameInput.value = preset?.name || '';
            promptTextEditor.value = preset?.prompt_text || '';
            editingPresetId = preset?.id || null;
        }
        promptEditorModal.style.display = 'flex';
    }

    function closePromptModal() {
        promptEditorModal.style.display = 'none';
        editingPresetId = null;
    }

    // Event: Select change
    if (promptPresetSelect) {
        promptPresetSelect.addEventListener('change', loadActivePrompt);
    }

    // Event: New
    if (presetNewBtn) {
        presetNewBtn.addEventListener('click', () => openPromptModal('new'));
    }

    // Event: Edit
    if (presetEditBtn) {
        presetEditBtn.addEventListener('click', async () => {
            const id = promptPresetSelect.value;
            if (!id) { showToast('Select a preset first.', 'error'); return; }
            try {
                const resp = await fetch(`${PROMPT_API_URL}?action=get&id=${id}`);
                const data = await resp.json();
                if (data.success) openPromptModal('edit', data.preset);
            } catch (e) {
                showToast('Failed to load preset.', 'error');
            }
        });
    }

    // Event: Delete
    if (presetDeleteBtn) {
        presetDeleteBtn.addEventListener('click', async () => {
            const id = promptPresetSelect.value;
            if (!id) return;
            const name = promptPresetSelect.options[promptPresetSelect.selectedIndex]?.text;
            if (!confirm(`Delete preset "${name}"? This cannot be undone.`)) return;
            try {
                const resp = await fetch(`${PROMPT_API_URL}?action=delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: parseInt(id) })
                });
                const data = await resp.json();
                if (data.success) {
                    showToast('Preset deleted.');
                    await loadPromptPresets();
                } else {
                    showToast(data.message || 'Delete failed.', 'error');
                }
            } catch (e) {
                showToast('Failed to delete preset.', 'error');
            }
        });
    }

    // Event: Save (create or update)
    if (promptSaveBtn) {
        promptSaveBtn.addEventListener('click', async () => {
            const name = promptNameInput.value.trim();
            const text = promptTextEditor.value.trim();
            if (!name || !text) {
                showToast('Name and prompt text are required.', 'error');
                return;
            }
            const action = editingPresetId ? 'update' : 'create';
            const body = editingPresetId
                ? { id: editingPresetId, name, prompt_text: text }
                : { name, prompt_text: text };
            try {
                promptSaveBtn.disabled = true;
                promptSaveBtn.textContent = 'Saving...';
                const resp = await fetch(`${PROMPT_API_URL}?action=${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (data.success) {
                    showToast(editingPresetId ? 'Preset updated!' : 'Preset created!');
                    closePromptModal();
                    await loadPromptPresets();
                    // Select the newly created/updated preset
                    if (data.id) promptPresetSelect.value = data.id;
                    else if (editingPresetId) promptPresetSelect.value = editingPresetId;
                    await loadActivePrompt();
                } else {
                    showToast(data.message || 'Save failed.', 'error');
                }
            } catch (e) {
                showToast('Failed to save preset.', 'error');
            } finally {
                promptSaveBtn.disabled = false;
                promptSaveBtn.textContent = 'Save Preset';
            }
        });
    }

    // Event: Close modal
    if (promptCancelBtn) promptCancelBtn.addEventListener('click', closePromptModal);
    if (promptModalCloseBtn) promptModalCloseBtn.addEventListener('click', closePromptModal);

    // Load presets on init
    loadPromptPresets();

    // ==========================================
    // TOPIC IMPORT HANDLERS
    // ==========================================

    async function populateTopicSubjects(selector) {
        if (subjects && subjects.length > 0) {
            selector.innerHTML = '<option value="">Select Subject</option>';
            subjects.forEach(s => {
                selector.innerHTML += `<option value="${s.id}">${s.subject_name}</option>`;
            });
            return;
        }
        try {
            const resp = await fetch(SUBJECT_API_URL);
            const result = await resp.json();
            if (result.success) {
                subjects = result.data; // Sync to global cache
                selector.innerHTML = '<option value="">Select Subject</option>';
                result.data.forEach(s => {
                    selector.innerHTML += `<option value="${s.id}">${s.subject_name}</option>`;
                });
            }
        } catch (e) { console.error('Failed to load subjects for topic import', e); }
    }

    async function populateTopicLessons(subjectId, selector, lessonToSelect = null) {
        selector.innerHTML = '<option value="">Loading...</option>';
        selector.disabled = true;
        if (!subjectId) {
            selector.innerHTML = '<option value="">Select Subject First</option>';
            return;
        }
        try {
            const resp = await fetch(`${TOPIC_LESSON_API_URL}?subject_id=${subjectId}`);
            const result = await resp.json();
            if (result.success) {
                selector.innerHTML = '<option value="">Select Lesson</option>';
                result.data.forEach(l => {
                    selector.innerHTML += `<option value="${l.id}" ${lessonToSelect == l.id ? 'selected' : ''}>${l.lesson_name}</option>`;
                });
                selector.disabled = false;
            }
        } catch (e) { console.error('Failed to load lessons', e); }
    }

    function showTopicImport(topics) {
        topicQueue = topics.map(item => ({
            name: item.topic_name || item.name || '',
            page_from: item.page_from || item.start_page || '',
            page_to: item.page_to || item.end_page || '',
            subject_id: '',
            lesson_id: '',
            isIncluded: true
        }));
        topicImportCount.textContent = topicQueue.length;
        topicImportSection.classList.remove('hidden');
        populateTopicSubjects(topicImportSubject);
        renderTopicImportTable();
    }

    async function renderTopicImportTable() {
        const renderId = ++lastTopicRenderId;
        topicImportTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-400">Loading topics...</td></tr>';
        
        // Use pre-fetched subjects if available, otherwise fetch once
        let subjectsList = subjects || [];
        if (!subjectsList.length) {
            try {
                const resp = await fetch(SUBJECT_API_URL);
                const result = await resp.json();
                if (result.success) subjectsList = result.data;
            } catch (e) { console.error('Subject fetch failed in topic render', e); }
        }

        // Check if this render is still valid
        if (renderId !== lastTopicRenderId) return;

        topicImportTableBody.innerHTML = '';
        if (topicQueue.length === 0) {
            topicImportTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">No topics found</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();

        for (let i = 0; i < topicQueue.length; i++) {
            const item = topicQueue[i];
            const row = document.createElement('tr');
            row.className = `hover:bg-slate-50 transition-all border-b border-slate-50 ${item.isIncluded ? '' : 'opacity-40 grayscale'}`;
            row.innerHTML = `
                <td class="py-2 px-2 text-center">
                    <input type="checkbox" class="ti-check w-4 h-4 rounded border-slate-300 text-emerald-600" ${item.isIncluded ? 'checked' : ''}>
                </td>
                <td class="py-2 px-3">
                    <input type="text" class="ti-name w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:border-emerald-300 outline-none" value="${item.name}">
                </td>
                <td class="py-2 px-2">
                    <input type="number" class="ti-from w-full px-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-center" value="${item.page_from}" placeholder="-">
                </td>
                <td class="py-2 px-2">
                    <input type="number" class="ti-to w-full px-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] text-center" value="${item.page_to}" placeholder="-">
                </td>
                <td class="py-2 px-3">
                    <select class="ti-subject w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] truncate">
                        <option value="">Subject</option>
                        ${subjectsList.map(s => `<option value="${s.id}" ${item.subject_id == s.id ? 'selected' : ''}>${s.subject_name}</option>`).join('')}
                    </select>
                </td>
                <td class="py-2 px-3">
                    <select class="ti-lesson w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] truncate" ${!item.subject_id ? 'disabled' : ''}>
                        <option value="">Lesson</option>
                    </select>
                </td>
                <td class="py-2 px-2 text-center">
                    ${i > 0 ? `<button type="button" class="ti-same p-1 px-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold" title="Same as Above">↓</button>` : ''}
                </td>
            `;

            const subSel = row.querySelector('.ti-subject');
            const lesSel = row.querySelector('.ti-lesson');
            const nameInput = row.querySelector('.ti-name');
            const fromInput = row.querySelector('.ti-from');
            const toInput = row.querySelector('.ti-to');
            const checkBox = row.querySelector('.ti-check');
            const sameBtn = row.querySelector('.ti-same');

            if (item.subject_id) populateTopicLessons(item.subject_id, lesSel, item.lesson_id);

            subSel.onchange = () => { item.subject_id = subSel.value; item.lesson_id = ''; populateTopicLessons(item.subject_id, lesSel); };
            lesSel.onchange = () => { item.lesson_id = lesSel.value; };
            nameInput.oninput = () => { item.name = nameInput.value; };
            fromInput.oninput = () => { item.page_from = fromInput.value; };
            toInput.oninput = () => { item.page_to = toInput.value; };
            checkBox.onchange = () => {
                item.isIncluded = checkBox.checked;
                row.classList.toggle('opacity-40', !item.isIncluded);
                row.classList.toggle('grayscale', !item.isIncluded);
            };
            if (sameBtn) {
                sameBtn.onclick = () => {
                    const prev = topicQueue[i - 1];
                    item.subject_id = prev.subject_id;
                    item.lesson_id = prev.lesson_id;
                    subSel.value = item.subject_id;
                    populateTopicLessons(item.subject_id, lesSel, item.lesson_id);
                };
            }

            fragment.appendChild(row);
        }
        
        if (renderId === lastTopicRenderId) {
            topicImportTableBody.appendChild(fragment);
        }
    }

    async function processTopicImportAll() {
        const toImport = topicQueue.filter(t => t.isIncluded && t.subject_id && t.lesson_id);
        if (!toImport.length) {
            showToast('No valid topics. Ensure Subject and Lesson are selected.', 'error');
            return;
        }
        topicImportAllBtn.disabled = true;
        let successCount = 0;
        const importedMap = {}; // name -> {topic_id, subject_id, lesson_id}

        for (let i = 0; i < toImport.length; i++) {
            const item = toImport[i];
            topicImportBtnText.textContent = `Importing ${i + 1}/${toImport.length}...`;
            try {
                const resp = await fetch(`${TOPIC_CREATE_API_URL}?action=create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject_id: item.subject_id,
                        lesson_id: item.lesson_id,
                        topic_name: item.name,
                        start_page: item.page_from || 1,
                        end_page: item.page_to || 1,
                        expected_exams: 30
                    })
                });
                const result = await resp.json();
                if (result.success) {
                    successCount++;
                    // Map the topic name to its new ID and categories (normalized name)
                    const normalizedName = item.name.toLowerCase().trim();
                    importedMap[normalizedName] = {
                        topic_id: result.id || (result.data && result.data.id),
                        subject_id: item.subject_id,
                        lesson_id: item.lesson_id
                    };
                }
            } catch (e) { console.error('Topic import failed:', item.name, e); }
        }

        // Auto-link imported topics to matching exam sections
        if (successCount > 0) {
            extractedSections.forEach(section => {
                const sectionName = section.title.toLowerCase().trim();
                if (importedMap[sectionName]) {
                    const map = importedMap[sectionName];
                    section.target.subject = map.subject_id;
                    section.target.lesson = map.lesson_id;
                    section.target.topic = map.topic_id;
                }
            });
            renderBulkTable(); // Refresh the categorization dropdowns
            renderSections();  // Refresh the exam queue UI
        }

        topicImportAllBtn.disabled = false;
        topicImportBtnText.textContent = 'Import All Topics';
        showToast(`${successCount}/${toImport.length} topics imported and linked!`);
        
        if (typeof CacheManager !== 'undefined') {
            CacheManager.clearGroup('topic');
            CacheManager.clearGroup('exam');
        }
    }

    // Topic Import Event Listeners
    if (topicImportAllBtn) topicImportAllBtn.addEventListener('click', processTopicImportAll);
    if (topicImportClearBtn) topicImportClearBtn.addEventListener('click', () => {
        topicQueue = [];
        topicImportSection.classList.add('hidden');
    });
    if (topicImportSubject) {
        topicImportSubject.addEventListener('change', () => {
            populateTopicLessons(topicImportSubject.value, topicImportLesson);
        });
    }
    if (topicImportApplyAllBtn) {
        topicImportApplyAllBtn.addEventListener('click', () => {
            const subjectId = topicImportSubject.value;
            const lessonId = topicImportLesson.value;
            if (!subjectId) { showToast('Select a subject first.', 'error'); return; }
            topicQueue.forEach(item => {
                item.subject_id = subjectId;
                item.lesson_id = lessonId;
            });
            renderTopicImportTable();
            showToast('Applied to all topics.');
        });
    }

    /**
     * Smart Image Compression Utility
     * Resizes and compresses images to speed up AI processing without losing text accuracy.
     */
    const SmartImageProcessor = {
        async compress(file, maxWidth = 1600, quality = 0.8) {
            // PDF handling is separate, return null to signal skipping
            if (file.type === 'application/pdf') return null;

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        // Calculate new dimensions while maintaining aspect ratio
                        if (width > height) {
                            if (width > maxWidth) {
                                height *= maxWidth / width;
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxWidth) {
                                width *= maxWidth / height;
                                height = maxWidth;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        
                        // Use white background for JPEGs (avoids black background on transparent PNGs)
                        ctx.fillStyle = "#FFFFFF";
                        ctx.fillRect(0, 0, width, height);
                        
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Output in JPEG format with specified quality
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    };
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    };

    function handleAIFiles(files) {
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (validFiles.length === 0) {
            showToast('No valid files. Please upload images or PDFs.', 'error');
            return;
        }
        aiUploadedFiles = [];
        aiPreviewGrid.innerHTML = '';
        aiPreviewGrid.classList.remove('hidden');
        aiScanActions.classList.remove('hidden');
        aiClearFilesBtn.classList.remove('hidden');
        aiClearFilesBtn.classList.add('flex');

        validFiles.forEach(async (file, i) => {
            let base64 = '';
            const mimeType = file.type;

            try {
                if (mimeType === 'application/pdf') {
                    // PDFs cannot be compressed easily in browser without heavy libs, send as is
                    const reader = new FileReader();
                    base64 = await new Promise((resolve) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                } else {
                    // Smart Compression for Images
                    base64 = await SmartImageProcessor.compress(file);
                }

                aiUploadedFiles.push({ base64, mimeType, name: file.name });

                // Create preview thumbnail
                const thumb = document.createElement('div');
                thumb.className = 'relative w-full aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm group animate-in zoom-in-50 duration-300';
                
                if (mimeType === 'application/pdf') {
                    thumb.innerHTML = `<div class="w-full h-full bg-rose-50 flex flex-col items-center justify-center gap-1"><span class="material-symbols-outlined text-2xl text-rose-400">picture_as_pdf</span><span class="text-[9px] font-bold text-rose-400 truncate w-full text-center px-1">${file.name}</span></div>`;
                } else {
                    thumb.innerHTML = `<img src="${base64}" alt="${file.name}" class="w-full h-full object-cover">`;
                }

                // Remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs';
                removeBtn.innerHTML = '✕';
                removeBtn.onclick = () => {
                    aiUploadedFiles = aiUploadedFiles.filter(f => f.name !== file.name);
                    thumb.remove();
                    aiFileCount.textContent = `${aiUploadedFiles.length} file(s) ready`;
                    if (aiUploadedFiles.length === 0) {
                        aiPreviewGrid.classList.add('hidden');
                        aiScanActions.classList.add('hidden');
                        aiClearFilesBtn.classList.add('hidden');
                        aiClearFilesBtn.classList.remove('flex');
                    }
                };
                thumb.appendChild(removeBtn);
                aiPreviewGrid.appendChild(thumb);
                aiFileCount.textContent = `${aiUploadedFiles.length} file(s) ready`;
            } catch (err) {
                console.error("File processing error:", err);
                showToast(`Failed to process ${file.name}`, 'error');
            }
        });
    }

    // Drop Zone – click to browse
    if (aiDropZone) {
        aiDropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
                aiFileInput.click();
            }
        });

        // Drag & Drop
        ['dragenter', 'dragover'].forEach(evt => {
            aiDropZone.addEventListener(evt, (e) => { e.preventDefault(); aiDropZone.classList.add('border-violet-400', 'bg-violet-50/50'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            aiDropZone.addEventListener(evt, (e) => { e.preventDefault(); aiDropZone.classList.remove('border-violet-400', 'bg-violet-50/50'); });
        });
        aiDropZone.addEventListener('drop', (e) => {
            handleAIFiles(e.dataTransfer.files);
        });
    }

    if (aiFileInput) {
        aiFileInput.addEventListener('change', (e) => handleAIFiles(e.target.files));
    }

    // Clear Files
    if (aiClearFilesBtn) {
        aiClearFilesBtn.addEventListener('click', () => {
            aiUploadedFiles = [];
            aiPreviewGrid.innerHTML = '';
            aiPreviewGrid.classList.add('hidden');
            aiScanActions.classList.add('hidden');
            aiClearFilesBtn.classList.add('hidden');
            aiClearFilesBtn.classList.remove('flex');
            aiFileInput.value = '';
            aiProgressContainer.classList.add('hidden');
        });
    }

    // Scan with AI
    if (aiScanBtn) {
        aiScanBtn.addEventListener('click', async () => {
            if (aiUploadedFiles.length === 0) {
                showToast('Please upload files first.', 'error');
                return;
            }

            aiScanBtn.disabled = true;
            aiScanBtnText.textContent = 'Scanning...';
            aiProgressContainer.classList.remove('hidden');
            aiProgressBar.style.width = '0%';
            aiProgressText.textContent = 'Preparing files...';
            aiProgressPercent.textContent = '0%';

            try {
                // Build inline data parts from all uploaded files
                const imageParts = aiUploadedFiles.map(f => ({
                    inlineData: {
                        mimeType: f.mimeType,
                        data: f.base64.split(',')[1]
                    }
                }));

                let response;
                if (aiModelSelect.value === 'tesseract-local') {
                    // --- HYBRID FLOW: Tesseract OCR + Gemini Structuring ---
                    aiProgressText.textContent = 'Performing Local OCR (Tesseract)...';
                    aiProgressBar.style.width = '20%';
                    aiProgressPercent.textContent = '20%';

                    let combinedOcrText = '';
                    for (let i = 0; i < aiUploadedFiles.length; i++) {
                        const file = aiUploadedFiles[i];
                        aiProgressText.textContent = `OCR Processing image ${i + 1}/${aiUploadedFiles.length}...`;
                        
                        const ocrRes = await fetch('api/ai/ocr-tesseract.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image: file.base64, lang: 'eng+ben' })
                        });

                        const ocrData = await ocrRes.json();
                        if (!ocrData.success) {
                            throw new Error(`Tesseract failed on image ${i + 1}: ${ocrData.message}`);
                        }
                        combinedOcrText += `\n--- PAGE ${i + 1} START ---\n${ocrData.text}\n--- PAGE ${i + 1} END ---\n`;
                        
                        const progress = 20 + ((i + 1) / aiUploadedFiles.length) * 30;
                        aiProgressBar.style.width = `${progress}%`;
                        aiProgressPercent.textContent = `${Math.round(progress)}%`;
                    }

                    aiProgressText.textContent = 'Structuring text with Gemini...';
                    
                    const payload = {
                        model: 'gemini-1.5-flash', // Hardcode to flash for faster structuring
                        contents: [
                            {
                                role: "user",
                                parts: [
                                    { text: (activePromptText || 'Extract all questions as JSON.') + "\n\nHere is the raw OCR text harvested from the images:\n" + combinedOcrText }
                                ]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 65536,
                            responseMimeType: "application/json"
                        }
                    };

                    response = await fetch(AIService.API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                } else {
                    // --- DIRECT FLOW: Gemini Vision ---
                    aiProgressText.textContent = 'Sending to Gemini AI...';
                    aiProgressBar.style.width = '30%';
                    aiProgressPercent.textContent = '30%';

                    const payload = {
                        model: aiModelSelect.value,
                        contents: [
                            {
                                role: "user",
                                parts: [
                                    { text: activePromptText || 'Extract all questions from this image as JSON.' },
                                    ...imageParts
                                ]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 65536,
                            responseMimeType: "application/json"
                        }
                    };

                    response = await fetch(AIService.API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                aiProgressText.textContent = 'Processing AI response...';
                aiProgressBar.style.width = '70%';
                aiProgressPercent.textContent = '70%';

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `API Error: ${response.status}`);
                }

                const result = await response.json();
                console.log("AI Response Result:", result);

                if (result.success === false) {
                    throw new Error(result.message || "Proxy error occurred.");
                }

                // Extract and show Token Usage for Scan
                updateTokenUsage(result.usageMetadata);

                const candidate = result.candidates?.[0];
                const finishReason = candidate?.finishReason || 'UNKNOWN';

                // Extract text from Gemini response
                let rawText = '';
                if (candidate?.content?.parts) {
                    rawText = candidate.content.parts.map(p => p.text || '').join('');
                }

                if (!rawText) {
                    throw new Error(`Gemini returned an empty response (Reason: ${finishReason}). Try clearer images or check safety filters.`);
                }

                aiProgressText.textContent = 'Parsing extracted questions...';
                aiProgressBar.style.width = '90%';
                aiProgressPercent.textContent = '90%';

                // Clean the response — strip markdown fences and extract valid JSON array(s)
                let cleanedJson = rawText.trim();

                // Strip markdown code fences first
                cleanedJson = cleanedJson.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

                // Find ALL valid JSON arrays by bracket-matching
                let topicJsonArr = null;
                let questionJsonArr = null;
                let allArrays = [];

                for (let i = 0; i < cleanedJson.length; i++) {
                    if (cleanedJson[i] === '[') {
                        let depth = 0;
                        for (let j = i; j < cleanedJson.length; j++) {
                            if (cleanedJson[j] === '[') depth++;
                            else if (cleanedJson[j] === ']') depth--;
                            if (depth === 0) {
                                const candidate = cleanedJson.substring(i, j + 1);
                                try {
                                    const parsed = JSON.parse(candidate);
                                    if (Array.isArray(parsed) && parsed.length > 0) {
                                        // Classify: topic list vs question list
                                        const isTopicList = parsed.some(item => item.topic_name && !item.question && !item.data);
                                        const isQuestionList = parsed.some(item => item.data || item.question || item.questions || item["Exam Title"]);
                                        allArrays.push({ json: candidate, parsed, isTopicList, isQuestionList, length: candidate.length });
                                    }
                                } catch (e) { /* not valid JSON */ }
                                i = j; // Skip past this bracket pair
                                break;
                            }
                        }
                    }
                }

                // Pick the best topic array and question array
                const topicArr = allArrays.find(a => a.isTopicList);
                const questionArr = allArrays.find(a => a.isQuestionList) || allArrays.reduce((best, a) => (!a.isTopicList && a.length > (best?.length || 0)) ? a : best, null);

                // Show topic import section if topics found
                if (topicArr) {
                    showTopicImport(topicArr.parsed);
                    showToast(`${topicArr.parsed.length} topics detected!`);
                }

                // Feed questions into the bulk import pipeline
                if (questionArr) {
                    handleBulkJSON(questionArr.json, !!topicArr);
                } else {
                    showToast('No questions found in AI response.', 'error');
                }

                aiProgressText.textContent = 'Done! Questions loaded into queue.';
                aiProgressBar.style.width = '100%';
                aiProgressPercent.textContent = '100%';
                showToast('AI Scan complete! Questions extracted and loaded.', 'success');

                setTimeout(() => {
                    aiProgressContainer.classList.add('hidden');
                }, 3000);

            } catch (error) {
                console.error('AI Scan Error:', error);
                showToast(`AI Scan failed: ${error.message}`, 'error');
                aiProgressText.textContent = 'Scan failed!';
                aiProgressBar.style.width = '0%';
                aiProgressPercent.textContent = '';
            } finally {
                aiScanBtn.disabled = false;
                aiScanBtnText.textContent = 'Scan with AI';
            }
        });
    }

    // Model Persistence & Change Listener
    if (aiModelSelect) {
        // Load preference from DB
        fetch('api/profile/settings.php?key=ai_model')
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data.ai_model) {
                    aiModelSelect.value = result.data.ai_model;
                } else {
                    // Fallback to local storage if DB is empty (migration aid)
                    const lastSelectedModel = localStorage.getItem('last_ai_model');
                    if (lastSelectedModel) aiModelSelect.value = lastSelectedModel;
                }
            })
            .catch(err => console.error('Failed to load AI model setting:', err));

        aiModelSelect.addEventListener('change', () => {
            const selectedModel = aiModelSelect.value;
            // Save to DB
            fetch('api/profile/settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'ai_model', value: selectedModel })
            })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    showToast(`Model saved: ${aiModelSelect.options[aiModelSelect.selectedIndex].text}`);
                    localStorage.setItem('last_ai_model', selectedModel); // Keep LS as backup
                }
            })
            .catch(err => {
                console.error('Failed to save AI model setting:', err);
                showToast('Failed to save model to database', 'error');
            });
        });
    }

    // --- AI Usage Stats Logic ---
    const toggleAiUsageBtn = document.getElementById('toggle-ai-usage');
    const aiUsageDashboard = document.getElementById('ai-usage-dashboard');
    const aiUsageTableBody = document.getElementById('ai-usage-table-body');
    let usageInterval = null;

    function formatTokens(n) {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n;
    }

    function fetchUsageStats() {
        if (!aiUsageDashboard || aiUsageDashboard.classList.contains('hidden')) return;

        fetch('api/ai/usage_stats.php')
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    let html = '';
                    for (const [id, stats] of Object.entries(result.data)) {
                        const rpmColor = stats.rpm >= stats.rpm_limit ? 'text-red-500' : 'text-slate-600';
                        const tpmColor = stats.tpm >= stats.tpm_limit ? 'text-red-500' : 'text-slate-600';
                        const rpdColor = stats.rpd >= stats.rpd_limit ? 'text-red-500' : 'text-slate-600';

                        html += `
                            <tr class="border-t border-slate-50">
                                <td class="py-2 text-[9px] text-slate-400 font-bold">${stats.label.split('(')[0].trim()}</td>
                                <td class="py-2 text-center text-[10px] ${rpmColor}">${stats.rpm} / ${stats.rpm_limit}</td>
                                <td class="py-2 text-center text-[10px] ${tpmColor}">${formatTokens(stats.tpm)} / ${formatTokens(stats.tpm_limit)}</td>
                                <td class="py-2 text-center text-[10px] ${rpdColor}">${stats.rpd} / ${stats.rpd_limit}</td>
                            </tr>
                        `;
                    }
                    aiUsageTableBody.innerHTML = html;
                }
            })
            .catch(err => console.error('Failed to fetch usage stats:', err));
    }

    if (toggleAiUsageBtn && aiUsageDashboard) {
        toggleAiUsageBtn.addEventListener('click', () => {
            aiUsageDashboard.classList.toggle('hidden');
            if (!aiUsageDashboard.classList.contains('hidden')) {
                fetchUsageStats();
                if (!usageInterval) usageInterval = setInterval(fetchUsageStats, 10000); // 10s refresh
            } else {
                if (usageInterval) {
                    clearInterval(usageInterval);
                    usageInterval = null;
                }
            }
        });
    }

    // Reset Bulk Import
    bulkResetBtn.onclick = () => {
        showConfirmModal(
            'Confirm Reset',
            'This will clear all pasted JSON and all exams in the current queue. Are you sure?',
            () => {
                bulkManualJsonInput.value = '';
                updateLineNumbers();
                validateLiveJSON();
                extractedSections = [];
                renderSections();
                renderBulkTable();
                showToast('Bulk queue cleared.');
            }
        );
    };

    // Question Import Handlers
    if (previewQuestionsBtn) {
        previewQuestionsBtn.addEventListener('click', () => {
            const jsonText = modalQuestionsJson.value;
            const result = QuestionUtils.parseQuestionsJSON(jsonText);

            if (result.success) {
                importedQuestions = result.data;
                renderQuestionsPreview();
                updateExamMetrics(importedQuestions.length);
            } else {
                showToast(result.message, 'error');
            }
        });
    }

    if (modalQuestionsJson) {
        modalQuestionsJson.addEventListener('input', () => {
            const jsonText = modalQuestionsJson.value.trim();
            if (!jsonText) {
                importedQuestions = [];
                return;
            }

            const result = QuestionUtils.parseQuestionsJSON(jsonText);
            if (result.success) {
                importedQuestions = result.data;
                updateExamMetrics(importedQuestions.length);
            }
        });
    }

    function renderQuestionsPreview() {
        previewContainer.innerHTML = QuestionUtils.renderPreview(importedQuestions);
        previewContainer.classList.remove('hidden');

        // Add remove handlers
        previewContainer.querySelectorAll('.remove-question-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(btn.dataset.index);
                importedQuestions.splice(index, 1);
                renderQuestionsPreview();
                updateExamMetrics(importedQuestions.length);
                // Update JSON textarea to reflect removal (optional but good for sync)
                modalQuestionsJson.value = JSON.stringify(importedQuestions, null, 2);
            });
        });
    }

    /**
     * Updates the global token usage tracker at the top
     * @param {Object} usageMetadata API usage metadata
     */
    function updateTokenUsage(usageMetadata, isInit = false) {
        if (!usageMetadata || !aiTokenTracker || !tokenUsageDisplay) return;

        const limit = 1048576; // 1.05M Context Window
        const currentTotal = usageMetadata.totalTokenCount || 0;
        const percent = ((currentTotal / limit) * 100).toFixed(2);
        const remaining = (100 - parseFloat(percent)).toFixed(2);

        // Update the per-request display
        tokenUsageDisplay.innerHTML = `Used: ${percent}% | Free: ${remaining}% | ${(currentTotal / 1000).toFixed(1)}k / 1.05M`;
        
        // Handle Session Total
        let sessionTotal = parseInt(localStorage.getItem('ai_token_session_total') || '0');
        if (!isInit) {
            sessionTotal += currentTotal;
            localStorage.setItem('ai_token_session_total', sessionTotal);
        }
        
        if (tokenSessionTotal) {
            tokenSessionTotal.textContent = (sessionTotal / 1000).toFixed(1) + 'k';
        }

        // Save last metadata for persistence
        localStorage.setItem('last_ai_token_usage', JSON.stringify(usageMetadata));
        
        aiTokenTracker.classList.remove('hidden');
    }

    // Reset Session Tokens
    if (aiTokenResetBtn) {
        aiTokenResetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('ai_token_session_total', '0');
            if (tokenSessionTotal) tokenSessionTotal.textContent = '0k';
            Toast.show('Session total reset', 'info');
        });
    }

    // Initialize state on page load
    (function initAIState() {
        const lastUsage = localStorage.getItem('last_ai_token_usage');
        if (lastUsage) {
            try {
                const metadata = JSON.parse(lastUsage);
                setTimeout(() => updateTokenUsage(metadata, true), 100);
            } catch(e) { console.error("Failed to load token usage", e); }
        } else {
            // Even if no last usage, show the session total
            const sessionTotal = parseInt(localStorage.getItem('ai_token_session_total') || '0');
            if (tokenSessionTotal) tokenSessionTotal.textContent = (sessionTotal / 1000).toFixed(1) + 'k';
        }
    })();

    // --- Bulk Import Logic ---

    function renderBulkTable() {
        if (!extractedSections.length) {
            bulkCategorizationContainer.innerHTML = '';
            bulkCategorizationContainer.classList.add('hidden');
            return;
        }

        bulkCategorizationContainer.classList.remove('hidden');
        bulkCategorizationContainer.innerHTML = `
            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 class="text-xl font-bold text-slate-800">Bulk Categorization</h3>
                        <p class="text-slate-400 text-sm font-medium">Map all exams and import at once</p>
                    </div>
                </div>
                
                <div class="hidden md:grid md:grid-cols-[45px_1.5fr_1.2fr_1.5fr_1.5fr_50px] gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div class="text-center">Incl.</div>
                    <div>Exam Title</div>
                    <div>Subject</div>
                    <div>Lesson</div>
                    <div>Topic</div>
                    <div class="text-center">Same</div>
                </div>

                <div class="divide-y divide-slate-100" id="bulk-table-body">
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-center sm:justify-end">
                    <button id="import-all-btn" class="w-full sm:w-auto px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-2 transform active:scale-95">
                        <span class="material-symbols-outlined text-lg">rocket_launch</span> Import All Exams
                    </button>
                </div>
            </div>
        `;

        const body = document.getElementById('bulk-table-body');
        extractedSections.forEach((section, i) => {
            const row = document.createElement('div');
            row.className = `p-4 md:p-6 md:grid md:grid-cols-[45px_1.5fr_1.2fr_1.5fr_1.5fr_50px] gap-4 transition-all ${section.isExcluded ? 'bg-slate-50/50 grayscale opacity-60' : 'hover:bg-slate-50'}`;

            row.innerHTML = `
                <div class="flex items-center justify-between mb-4 md:mb-0 md:justify-center">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="exclude-check w-6 h-6 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer" ${!section.isExcluded ? 'checked' : ''}>
                        <span class="md:hidden text-xs font-bold text-slate-500">Include in Import</span>
                    </div>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Exam Title</span>
                    <div class="flex items-center gap-2">
                        <input type="text" class="bulk-title-input w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all shadow-sm" value="${section.title}">
                        <span class="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-[9px] font-black uppercase whitespace-nowrap shadow-sm">
                            ${section.questions.length} QS
                        </span>
                    </div>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</span>
                    <select class="bulk-subject-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded ? 'disabled' : ''}>
                        <option value="0">Select Subject</option>
                        ${subjects.map(s => `<option value="${s.id}" ${section.target.subject == s.id ? 'selected' : ''}>${s.subject_name}</option>`).join('')}
                    </select>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lesson</span>
                    <select class="bulk-lesson-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded || !section.target.subject ? 'disabled' : ''}>
                        <option value="0">Select Lesson</option>
                    </select>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Topic</span>
                    <select class="bulk-topic-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-300 transition-all" ${section.isExcluded || !section.target.lesson ? 'disabled' : ''}>
                        <option value="0">Select Topic</option>
                    </select>
                </div>

                <div class="flex items-center justify-center md:pb-0 pb-2">
                    ${i > 0 && !section.isExcluded ? `
                        <button class="check-same-btn w-full md:w-10 h-11 md:h-10 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all flex items-center justify-center gap-2" data-idx="${i}" title="Same Above">
                            <span class="material-symbols-outlined text-sm">double_arrow</span>
                            <span class="md:hidden text-xs font-bold">Same as Above</span>
                        </button>
                    ` : ''}
                </div>
            `;

            // Listeners for this row
            const excludeCheck = row.querySelector('.exclude-check');
            excludeCheck.onchange = () => {
                section.isExcluded = !excludeCheck.checked;
                renderBulkTable();
                renderSections();
            };

            const subSel = row.querySelector('.bulk-subject-select');
            const lesSel = row.querySelector('.bulk-lesson-select');
            const topSel = row.querySelector('.bulk-topic-select');

            const titleInput = row.querySelector('.bulk-title-input');

            if (section.target.subject > 0) {
                populateLessons(section.target.subject, lesSel, section.target.lesson || 0).then(() => {
                    if (section.target.lesson > 0) {
                        populateTopics(section.target.lesson, topSel, section.target.topic || 0);
                    }
                });
            }

            titleInput.oninput = () => {
                section.title = titleInput.value;
                // Sync the detail section title without full re-render
                const detailTitle = document.querySelector(`.detail-exam-title[data-idx="${i}"]`);
                if (detailTitle) detailTitle.textContent = titleInput.value;
            };

            subSel.onchange = () => {
                section.target.subject = subSel.value;
                section.target.lesson = 0;
                section.target.topic = 0;
                renderBulkTable();
            };
            lesSel.onchange = () => {
                section.target.lesson = lesSel.value;
                section.target.topic = 0;
                renderBulkTable();
            };
            topSel.onchange = () => {
                section.target.topic = topSel.value;
            };

            if (i > 0) {
                const sameBtn = row.querySelector('.check-same-btn');
                if (sameBtn) {
                    sameBtn.onclick = () => {
                        const prev = extractedSections[i - 1];
                        section.target = { ...prev.target };
                        renderBulkTable();
                    };
                }
            }

            body.appendChild(row);
        });

        document.getElementById('import-all-btn').onclick = processImportAll;
    }

    function renderSections() {
        sectionsContainer.innerHTML = '';
        if (!extractedSections.length) {
            sectionsContainer.classList.add('hidden');
            resultsPlaceholder.classList.remove('hidden');
            return;
        }

        sectionsContainer.classList.remove('hidden');
        resultsPlaceholder.classList.add('hidden');

        extractedSections.forEach((section, i) => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden mb-8';
            sectionEl.innerHTML = `
                <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">
                            ${i + 1}
                        </div>
                        <h3 class="detail-exam-title text-xl font-black text-slate-800 outline-none focus:text-blue-600 transition-colors" contenteditable="true" data-idx="${i}">${section.title}</h3>
                    </div>
                </div>
                <div class="p-6 space-y-4">
                    ${section.questions.map((q, qIdx) => {
                const prioColors = {
                    0: 'bg-blue-50 text-blue-600 border-blue-100',
                    1: 'bg-slate-50 text-slate-500 border-slate-200',
                    2: 'bg-amber-50 text-amber-600 border-amber-100',
                    3: 'bg-rose-50 text-rose-600 border-rose-100'
                };
                const prioColor = prioColors[q.priority] || prioColors[0];
                return `
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative transition-all hover:bg-white hover:shadow-md">
                            <div class="flex flex-col gap-4">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-3">
                                            <span class="text-[10px] font-black text-slate-300 uppercase">#${qIdx + 1}</span>
                                            <select class="priority-select text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all ${prioColor}" data-sec-idx="${i}" data-q-idx="${qIdx}">
                                                <option value="0" ${q.priority == 0 ? 'selected' : ''}>Standard</option>
                                                <option value="1" ${q.priority == 1 ? 'selected' : ''}>🔵 Low</option>
                                                <option value="2" ${q.priority == 2 ? 'selected' : ''}>🟡 Medium</option>
                                                <option value="3" ${q.priority == 3 ? 'selected' : ''}>🔴 High</option>
                                            </select>
                                        </div>
                                        <p contenteditable="true" class="edit-field font-bold text-slate-800 text-sm mb-4 outline-none focus:text-blue-600 transition-colors" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="question">${q.question}</p>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                                            ${['A', 'B', 'C', 'D'].map(opt => `
                                                <div class="flex items-center gap-3 p-1 rounded-lg border ${q.answer === opt ? 'bg-emerald-50 border-emerald-100' : 'border-transparent'} hover:border-slate-100 focus-within:border-blue-100 transition-all">
                                                    <span class="answer-toggle cursor-pointer hover:underline ${q.answer === opt ? 'text-emerald-600 font-black' : 'text-slate-400 font-bold'}" data-sec-idx="${i}" data-q-idx="${qIdx}" data-opt="${opt}" title="Set as correct answer">${opt}:</span>
                                                    <span contenteditable="true" class="edit-field flex-1 outline-none text-slate-600 ${q.answer === opt ? 'font-medium' : ''}" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="options" data-opt="${opt}">${q.options[opt]}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="group/exp relative">
                                            <div contenteditable="true" class="edit-field text-[10px] bg-white p-3 rounded-xl text-slate-500 font-medium italic border border-slate-100 outline-none focus:border-blue-200" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="explanation">
                                                ${q.explanation || 'No explanation provided.'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-2 md:opacity-0 group-hover:opacity-100 transition-all">
                                        <button class="delete-q p-3 md:p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" data-sec-idx="${i}" data-q-idx="${qIdx}">
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('')}
                </div>
            `;

            const detailTitle = sectionEl.querySelector('.detail-exam-title');
            detailTitle.onblur = () => {
                section.title = detailTitle.textContent.trim();
                // Sync the table input without full re-render
                const tableInput = document.querySelectorAll('.bulk-title-input')[i];
                if (tableInput) tableInput.value = detailTitle.textContent.trim();
            };

            sectionsContainer.appendChild(sectionEl);
        });

        // Event Listeners for editing
        document.querySelectorAll('.edit-field').forEach(field => {
            field.onblur = () => {
                const { secIdx, qIdx, field: fieldName, opt } = field.dataset;
                const value = field.innerText.trim();
                if (fieldName === 'options') extractedSections[secIdx].questions[qIdx].options[opt] = value;
                else extractedSections[secIdx].questions[qIdx][fieldName] = value;
            };
        });

        document.querySelectorAll('.priority-select').forEach(sel => {
            sel.onchange = () => {
                extractedSections[sel.dataset.secIdx].questions[sel.dataset.qIdx].priority = parseInt(sel.value);
                renderSections();
            };
        });

        document.querySelectorAll('.delete-q').forEach(btn => {
            btn.onclick = () => {
                extractedSections[btn.dataset.secIdx].questions.splice(btn.dataset.qIdx, 1);
                renderSections();
                renderBulkTable();
            };
        });

        document.querySelectorAll('.answer-toggle').forEach(btn => {
            btn.onclick = () => {
                const { secIdx, qIdx, opt } = btn.dataset;
                extractedSections[secIdx].questions[qIdx].answer = opt;
                renderSections();
            };
        });
    }

    async function processImportAll() {
        const activeSections = extractedSections.filter(s => !s.isExcluded && s.target.subject > 0 && s.target.lesson > 0 && s.target.topic > 0);

        if (!activeSections.length) {
            showToast('No fully categorized exams to import.', 'error');
            return;
        }

        const skippedCount = extractedSections.length - activeSections.length;
        const skipText = skippedCount > 0 ? ` (${skippedCount} will be skipped)` : '';

        showConfirmModal('Confirm Bulk Import', `Are you sure you want to import ${activeSections.length} exams?${skipText} Only exams with complete categorization (Subject, Lesson, Topic) will be processed.`, async () => {
            const btn = document.getElementById('import-all-btn');
            const original = btn.innerHTML;
            btn.disabled = true;

            let success = 0, fail = 0;
            // Iterate over a copy of sections that are ready to import
            const toImport = [...activeSections];

            for (const section of toImport) {
                const currentIdx = extractedSections.indexOf(section);
                if (currentIdx === -1) continue;

                btn.innerHTML = `<span class="animate-spin text-sm">sync</span> ${success + fail + 1}/${activeSections.length}`;

                try {
                    await executeImportFlow(currentIdx);
                    success++;
                } catch (e) {
                    fail++;
                    console.error('Bulk item failed', e);
                }
            }

            btn.disabled = false;
            btn.innerHTML = original;
            showToast(`Import Complete: ${success} Success, ${fail} Failed`);

            if (success > 0) {
                fetchAndDisplayExams(false, true);
                if (typeof CacheManager !== 'undefined') CacheManager.clearGroup('exam');
            }

            // Close if we had successes and no errors during this batch
            if (success > 0 && fail === 0) {
                closeModal(examModal);
                // Show scan prompt for the last imported exam
                if (lastBulkExamId) {
                    setTimeout(() => showPostImportScanPrompt(lastBulkExamId, lastBulkExamTitle), 500);
                }
            } else {
                renderSections();
                renderBulkTable();
                if (fail > 0) showToast(`${fail} items failed to import. Check console for details.`, 'error');
            }
        });
    }

    async function executeImportFlow(idx) {
        const section = extractedSections[idx];
        const qCount = section.questions.length;
        const examResp = await fetch(`${EXAM_API_URL}?action=create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_title: section.title,
                subject_id: section.target.subject,
                lesson_id: section.target.lesson,
                topic_id: section.target.topic,
                duration: qCount,
                instructions: defaultInstructions,
                total_marks: qCount,
                pass_mark: (qCount * 0.99).toFixed(2)
            })
        });
        const examRes = await examResp.json();
        if (!examRes.success) throw new Error(examRes.message);

        const importResp = await fetch('api/question/import.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_id: examRes.id,
                questions: section.questions
            })
        });
        const importRes = await importResp.json();
        if (!importRes.success) throw new Error(importRes.message);

        // Track last imported for scan prompt
        lastBulkExamId = examRes.id;
        lastBulkExamTitle = section.title;

        extractedSections.splice(idx, 1);
        return true;
    }

    // Post-import scan prompt
    let lastBulkExamId = null, lastBulkExamTitle = '';
    function showPostImportScanPrompt(eId, eTitle) {
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

    // --- Initial Load ---
    if (jsonValidationIndicator) {
        updateLineNumbers();
        validateLiveJSON();
    }
    populateSubjects(subjectFilter);
    populateSubjects(modalSubjectSelector);
}

initializeExamPage();
