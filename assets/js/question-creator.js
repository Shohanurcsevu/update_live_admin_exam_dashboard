function initializeQuestionCreator() {
    const SUBJECT_API = 'api/exam/subjects.php';
    const LESSON_API = 'api/exam/lessons.php';
    const TOPIC_API = 'api/exam/topics.php';
    const IMPORT_API = 'api/question/import.php';

    // State
    let subjects = [];
    let extractedSections = [];

    // DOM Elements
    const manualJsonInput = document.getElementById('manual-json-input');
    const manualImportBtn = document.getElementById('manual-import-btn');
    const resetBtn = document.getElementById('reset-page-btn');

    const resultsPlaceholder = document.getElementById('results-placeholder');
    const sectionsContainer = document.getElementById('sections-container');

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-rose-500' : 'bg-emerald-500';
        const icon = type === 'error' ? 'error' : 'check_circle';

        toast.className = `flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white transform transition-all duration-300 translate-y-10 opacity-0 ${bgColor} mb-3`;
        toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span> <span class="font-bold">${message}</span>`;

        const container = document.getElementById('toast-container');
        if (!container) {
            const c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'fixed bottom-5 right-5 z-[100] flex flex-col items-end pointer-events-none';
            document.body.appendChild(c);
            c.appendChild(toast);
        } else {
            container.appendChild(toast);
        }

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-[-20px]', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async function fetchSubjects() {
        try {
            const resp = await fetch(SUBJECT_API);
            const res = await resp.json();
            if (res.success) subjects = res.data;
        } catch (e) {
            console.error('Failed to fetch subjects', e);
            showToast('Failed to load subjects', 'error');
        }
    }

    // --- Logic Implementation ---

    // --- Parsing & Rendering ---

    // --- Logic Implementation ---

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

    async function processImportAll() {
        if (!extractedSections.length) return;

        const activeSections = extractedSections.filter(s => !s.isExcluded);
        const count = activeSections.length;
        const excludedCount = extractedSections.length - activeSections.length;

        if (count === 0) {
            showToast('No exams selected for import (all excluded or empty).', 'error');
            return;
        }

        let msg = `Are you sure you want to import ${count} exams?`;
        if (excludedCount > 0) msg += ` (${excludedCount} will be skipped)`;
        msg += ` Only exams with complete categorization (Subject, Lesson, Topic) will be processed.`;

        showConfirmModal('Confirm Bulk Import', msg, async () => {
            const btn = document.getElementById('import-all-btn');
            const originalBtnText = btn.innerHTML;
            btn.disabled = true;

            let successCount = 0;
            let failCount = 0;

            // We use a copy of the queue because executeImportFlow mutates extractedSections
            const queue = [...extractedSections];

            for (let i = 0; i < queue.length; i++) {
                const section = queue[i];
                if (section.isExcluded) continue;

                btn.innerHTML = `<span class="animate-spin text-sm">sync</span> ${successCount + failCount + 1}/${count}`;

                const currentIdx = extractedSections.indexOf(section);
                if (currentIdx === -1) continue;

                if (section.target.subject == 0 || section.target.lesson == 0 || section.target.topic == 0) {
                    failCount++;
                    continue;
                }

                try {
                    await executeImportFlow(currentIdx);
                    successCount++;
                } catch (e) {
                    failCount++;
                    console.error(`Import failed for ${section.title}`, e);
                }
            }

            btn.disabled = false;
            btn.innerHTML = originalBtnText;

            if (successCount > 0) {
                showToast(`Bulk Import Complete: ${successCount} Success, ${failCount} Skipped/Failed`);
            } else if (failCount > 0) {
                showToast(`Bulk Import Failed: ${failCount} exams could not be imported.`, 'error');
            }

            renderSections();
        });
    }

    async function executeImportFlow(idx) {
        const section = extractedSections[idx];
        const defaultInstructions = 'প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১ (এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ ( শূন্য দশমিক পাঁচ ) নম্বর কাটা যাবে।';
        const qCount = section.questions.length;

        const examResp = await fetch('api/exam/exam.php?action=create', {
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
        if (!examRes.success) throw new Error(examRes.message || 'Failed to create exam');

        const examId = examRes.id;
        const importResp = await fetch(IMPORT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exam_id: examId,
                questions: section.questions
            })
        });
        const importRes = await importResp.json();
        if (!importRes.success) throw new Error(importRes.message || 'Import failed');

        extractedSections.splice(idx, 1);
        return true;
    }

    async function processImport(idx, btn) {
        const section = extractedSections[idx];

        if (section.target.subject == 0 || section.target.lesson == 0 || section.target.topic == 0) {
            showToast('Please select Subject, Lesson, and Topic first.', 'error');
            return;
        }

        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin text-sm">sync</span> ...';

        try {
            await executeImportFlow(idx);
            showToast(`Successfully imported questions to ${section.title}`);
            renderSections();
        } catch (e) {
            showToast(e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }

    async function renderBulkTable() {
        const container = document.getElementById('bulk-categorization-container');
        if (!extractedSections.length) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        container.className = 'bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden mb-8';

        container.innerHTML = `
            <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 class="text-xl font-bold text-slate-800 text-center sm:text-left">Bulk Categorization</h3>
                    <p class="text-slate-400 text-sm font-medium text-center sm:text-left">Map all exams and import at once</p>
                </div>
            </div>
            
            <div class="hidden md:grid md:grid-cols-[45px_1.2fr_1.2fr_1.7fr_1.7fr_50px] gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <div class="text-center">Incl.</div>
                <div>Exam Title</div>
                <div>Subject</div>
                <div>Lesson</div>
                <div>Topic</div>
                <div class="text-center">Action</div>
            </div>

            <div class="divide-y divide-slate-100" id="bulk-table-body">
            </div>

            <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-center sm:justify-end">
                <button id="import-all-btn" class="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-sm">rocket_launch</span> Import All
                </button>
            </div>
        `;

        document.getElementById('import-all-btn').onclick = processImportAll;

        const tbody = document.getElementById('bulk-table-body');

        for (let i = 0; i < extractedSections.length; i++) {
            const section = extractedSections[i];
            const row = document.createElement('div');
            row.className = `p-6 md:px-6 md:py-4 md:grid md:grid-cols-[45px_1.2fr_1.2fr_1.7fr_1.7fr_50px] gap-4 items-center hover:bg-slate-50 transition-colors group ${section.isExcluded ? 'opacity-40 grayscale-[0.5]' : ''}`;

            row.innerHTML = `
                <!-- Mobile Incl Checkbox & Title Row -->
                <div class="flex items-center justify-between mb-4 md:mb-0 md:justify-center">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" class="exclude-check w-6 h-6 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${!section.isExcluded ? 'checked' : ''}>
                        <span class="md:hidden font-bold text-slate-800">Include</span>
                    </div>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Exam Title</span>
                    <div class="font-bold text-slate-700 text-sm leading-tight break-words flex items-center gap-2" title="${section.title}">
                        ${section.title}
                        <span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-black uppercase whitespace-nowrap shadow-sm">
                            ${section.questions.length} QS
                        </span>
                    </div>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Subject</span>
                    <select class="bulk-subject-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50/50 transition-all" ${section.isExcluded ? 'disabled' : ''}>
                        <option value="0">Select Subject</option>
                        ${subjects.map(s => `<option value="${s.id}" ${section.target.subject == s.id ? 'selected' : ''}>${s.subject_name}</option>`).join('')}
                    </select>
                </div>

                <div class="mb-3 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Lesson</span>
                    <select class="bulk-lesson-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50/50 transition-all" ${section.isExcluded || !section.target.subject ? 'disabled' : ''}>
                        <option value="0">Select Lesson</option>
                    </select>
                </div>

                <div class="mb-4 md:mb-0">
                    <span class="md:hidden block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Topic</span>
                    <select class="bulk-topic-select w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50/50 transition-all" ${section.isExcluded || !section.target.lesson ? 'disabled' : ''}>
                        <option value="0">Select Topic</option>
                    </select>
                </div>

                <div class="flex items-center gap-2 justify-center pt-4 border-t border-slate-50 md:pt-0 md:border-0 sticky right-0 bg-inherit">
                    ${i > 0 && !section.isExcluded ? `
                        <button class="check-same-btn flex-1 md:flex-none flex items-center justify-center w-10 h-10 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all font-bold" data-idx="${i}" title="Same Above">
                            <span class="material-symbols-outlined text-sm">double_arrow</span>
                        </button>
                    ` : ''}
                </div>
            `;

            tbody.appendChild(row);

            const excludeCheck = row.querySelector('.exclude-check');
            excludeCheck.onchange = () => {
                section.isExcluded = !excludeCheck.checked;
                renderBulkTable();
                // We re-render table but NOT the cards to keep it fast
                // Actually, renderSections renders both. Let's just re-render table for now.
            };

            const subSel = row.querySelector('.bulk-subject-select');
            const lesSel = row.querySelector('.bulk-lesson-select');
            const topSel = row.querySelector('.bulk-topic-select');

            // Initial load of lessons/topics if already selected
            if (section.target.subject > 0) {
                await loadLessonsForSelect(section.target.subject, lesSel, section.target.lesson);
                if (section.target.lesson > 0) {
                    await loadTopicsForSelect(section.target.lesson, topSel, section.target.topic);
                }
            }

            subSel.addEventListener('change', async () => {
                section.target.subject = subSel.value;
                section.target.lesson = 0;
                section.target.topic = 0;
                await loadLessonsForSelect(section.target.subject, lesSel);
                topSel.innerHTML = '<option value="0">Select Topic</option>';
                topSel.disabled = true;
            });

            lesSel.addEventListener('change', async () => {
                section.target.lesson = lesSel.value;
                section.target.topic = 0;
                await loadTopicsForSelect(section.target.lesson, topSel);
            });

            topSel.addEventListener('change', () => {
                section.target.topic = topSel.value;
            });

            const sameBtn = row.querySelector('.check-same-btn');
            if (sameBtn) {
                sameBtn.onclick = async () => {
                    const prevSection = extractedSections[i - 1];
                    if (prevSection.target.subject == 0) {
                        showToast('Previous exam has no subject selected!', 'error');
                        return;
                    }

                    // Copy values
                    section.target.subject = prevSection.target.subject;
                    section.target.lesson = prevSection.target.lesson;
                    section.target.topic = prevSection.target.topic;

                    // Update UI directly instead of re-rendering or syncToCard
                    subSel.value = section.target.subject;
                    await loadLessonsForSelect(section.target.subject, lesSel, section.target.lesson);
                    if (section.target.lesson > 0) {
                        await loadTopicsForSelect(section.target.lesson, topSel, section.target.topic);
                    }

                    showToast(`Copied categorization from row ${i}`);
                };
            }
        }
    }

    async function loadLessonsForSelect(subId, lesSel, selectedId = 0) {
        if (!subId || subId == 0) {
            lesSel.innerHTML = '<option value="0">Select Lesson</option>';
            lesSel.disabled = true;
            return;
        }
        lesSel.innerHTML = '<option value="0">Loading...</option>';
        lesSel.disabled = true;
        try {
            const resp = await fetch(`${LESSON_API}?subject_id=${subId}`);
            const res = await resp.json();
            if (res.success) {
                lesSel.innerHTML = '<option value="0">Select Lesson</option>' + res.data.map(l => `<option value="${l.id}" ${l.id == selectedId ? 'selected' : ''}>${l.lesson_name}</option>`).join('');
                lesSel.disabled = false;
            }
        } catch (e) { showToast('Failed to load lessons', 'error'); }
    }

    async function loadTopicsForSelect(lesId, topSel, selectedId = 0) {
        if (!lesId || lesId == 0) {
            topSel.innerHTML = '<option value="0">Select Topic</option>';
            topSel.disabled = true;
            return;
        }
        topSel.innerHTML = '<option value="0">Loading...</option>';
        topSel.disabled = true;
        try {
            const resp = await fetch(`${TOPIC_API}?lesson_id=${lesId}`);
            const res = await resp.json();
            if (res.success) {
                topSel.innerHTML = '<option value="0">Select Topic</option>' + res.data.map(t => `<option value="${t.id}" ${t.id == selectedId ? 'selected' : ''}>${t.topic_name}</option>`).join('');
                topSel.disabled = false;
            }
        } catch (e) { showToast('Failed to load topics', 'error'); }
    }

    async function renderSections() {
        if (!extractedSections.length) {
            resultsPlaceholder.classList.remove('hidden');
            sectionsContainer.classList.add('hidden');
            document.getElementById('bulk-categorization-container').classList.add('hidden');
            return;
        }

        resultsPlaceholder.classList.add('hidden');
        sectionsContainer.classList.remove('hidden');
        sectionsContainer.innerHTML = '';

        // Render Bulk Table First
        await renderBulkTable();

        for (let i = 0; i < extractedSections.length; i++) {
            const section = extractedSections[i];
            const sectionEl = document.createElement('div');
            sectionEl.className = 'exam-section-card bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in mb-6';
            sectionEl.innerHTML = `
                <div class="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                            ${i + 1}
                        </div>
                        <h3 class="text-xl font-black text-slate-800">${section.title}</h3>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <span class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 italic">
                            Categorization assigned in Bulk Table 
                        </span>
                    </div>
                </div>
                <div class="p-6 space-y-4 question-list-inner">
                    ${section.questions.map((q, qIdx) => {
                const prioColors = {
                    0: 'bg-blue-50 text-blue-600 border-blue-100', // Normal
                    1: 'bg-slate-50 text-slate-500 border-slate-200', // Low
                    2: 'bg-amber-50 text-amber-600 border-amber-100', // Medium
                    3: 'bg-rose-50 text-rose-600 border-rose-100' // High
                };
                const prioColor = prioColors[q.priority] || prioColors[0];

                return `
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative transition-all hover:bg-white hover:shadow-md">
                            <div class="flex flex-col gap-4">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="flex-1">
                                        <!-- Question Header & Priority -->
                                        <div class="flex items-center gap-2 mb-3">
                                            <span class="text-[10px] font-black text-slate-300 uppercase">#${qIdx + 1}</span>
                                            <select class="priority-select text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border transition-all ${prioColor}" data-sec-idx="${i}" data-q-idx="${qIdx}">
                                                <option value="0" ${q.priority == 0 ? 'selected' : ''}>Standard</option>
                                                <option value="1" ${q.priority == 1 ? 'selected' : ''}>🔵 Low (1-2x)</option>
                                                <option value="2" ${q.priority == 2 ? 'selected' : ''}>🟡 Medium (3-5x)</option>
                                                <option value="3" ${q.priority == 3 ? 'selected' : ''}>🔴 High (5x+)</option>
                                            </select>
                                        </div>
                                        
                                        <!-- Editable Question -->
                                        <p contenteditable="true" class="edit-field font-bold text-slate-800 text-sm mb-4 outline-none focus:text-indigo-600 transition-colors" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="question">${q.question}</p>
                                        
                                        <!-- Editable Options -->
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
                                            ${['A', 'B', 'C', 'D'].map(opt => `
                                                <div class="flex items-center gap-2 p-1 rounded-lg border border-transparent hover:border-slate-100 focus-within:border-indigo-100 transition-all">
                                                    <span class="${q.answer === opt ? 'text-emerald-600 font-black' : 'text-slate-400 font-bold'}">${opt}:</span>
                                                    <span contenteditable="true" class="edit-field flex-1 outline-none text-slate-600 ${q.answer === opt ? 'font-medium' : ''}" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="options" data-opt="${opt}">${q.options[opt]}</span>
                                                </div>
                                            `).join('')}
                                        </div>

                                        <!-- Editable Explanation -->
                                        <div class="group/exp relative">
                                            <span class="absolute -top-2 left-3 px-1 bg-white text-[9px] font-bold text-slate-300 uppercase tracking-widest opacity-0 group-hover/exp:opacity-100 transition-opacity">Explanation</span>
                                            <div contenteditable="true" class="edit-field text-[10px] bg-white p-3 rounded-xl text-slate-500 font-medium italic border border-slate-100 outline-none focus:border-indigo-200 focus:shadow-sm" data-sec-idx="${i}" data-q-idx="${qIdx}" data-field="explanation">
                                                ${q.explanation}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button class="delete-q p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100" data-sec-idx="${i}" data-q-idx="${qIdx}" title="Delete Question">
                                            <span class="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
            }).join('')}
                </div>
                <div class="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-center items-center px-8">
                    <span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                        ${section.questions.length} Questions Detected
                    </span>
                </div>
            `;
            sectionsContainer.appendChild(sectionEl);
        }

        // Bind Priority Changes
        document.querySelectorAll('.priority-select').forEach(sel => {
            sel.onchange = () => {
                const sIdx = sel.dataset.secIdx;
                const qIdx = sel.dataset.qIdx;
                extractedSections[sIdx].questions[qIdx].priority = parseInt(sel.value);
                renderSections(); // Re-render to update colors
            };
        });

        // Bind Inline Editing (Save on Blur)
        document.querySelectorAll('.edit-field').forEach(field => {
            field.onblur = () => {
                const sIdx = field.dataset.secIdx;
                const qIdx = field.dataset.qIdx;
                const fieldName = field.dataset.field;
                const newValue = field.innerText.trim();

                if (fieldName === 'options') {
                    const optKey = field.dataset.opt;
                    extractedSections[sIdx].questions[qIdx].options[optKey] = newValue;
                } else {
                    extractedSections[sIdx].questions[qIdx][fieldName] = newValue;
                }
                // No need to re-render here to avoid losing focus/state, 
                // data is already sync'd in memory.
            };
        });

        // Bind Question Deletion
        document.querySelectorAll('.delete-q').forEach(btn => {
            btn.onclick = () => {
                const sIdx = btn.dataset.secIdx;
                const qIdx = btn.dataset.qIdx;
                extractedSections[sIdx].questions.splice(qIdx, 1);
                renderSections();
            };
        });

        document.querySelectorAll('.import-section-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = btn.dataset.idx;
                processImport(idx, btn);
            };
        });
    }

    // --- Reset Logic ---
    resetBtn.onclick = () => {
        showConfirmModal(
            'Confirm Reset',
            'This will clear all pasted JSON and all exams in the current queue. Are you sure?',
            () => {
                manualJsonInput.value = '';
                extractedSections = [];
                renderSections();
            }
        );
    };

    // --- Manual JSON Import Logic ---
    manualImportBtn.onclick = () => {
        const raw = manualJsonInput.value.trim();
        if (!raw) {
            showToast('Please paste your JSON first.', 'error');
            return;
        }

        try {
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) {
                throw new Error('Root level must be an array of exam sections.');
            }

            extractedSections = [];
            data.forEach(item => {
                const title = item["Exam Title"] || "Untitled Exam";
                const questions = item.data || [];

                if (questions.length > 0) {
                    extractedSections.push({
                        title: title,
                        questions: questions.map(q => ({ ...q, priority: parseInt(q.priority) || 0 })),
                        target: { subject: 0, lesson: 0, topic: 0 },
                        isExcluded: false
                    });
                }
            });

            if (extractedSections.length > 0) {
                renderSections();
                showToast(`Parsed ${extractedSections.length} exam sections successfully!`);
                manualJsonInput.value = '';

                // Fix: Ensure the page doesn't jump to the bottom
                // Scrolling to top or the start of the results
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error('No valid exam sections or questions found in the JSON.');
            }

        } catch (e) {
            showToast('JSON Error: ' + e.message, 'error');
            console.error(e);
        }
    };

    // Start
    fetchSubjects();
}

initializeQuestionCreator();
