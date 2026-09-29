function initializeWrittenQuestionBank() {
    const API  = 'api/written/questions.php';
    const SAPI = 'api/exam/subjects.php';
    const LAPI = 'api/exam/lessons.php';
    const TAPI = 'api/exam/topics.php';
    const IAPI = 'api/written/upload_image.php';

    let currentPage = 1, totalPages = 1;
    let editingId = null;
    let subQCounter = 0;

    // ── Init ──────────────────────────────────────────────────────────────────
    loadSubjectOptions();
    loadBankSubjectOptions();
    loadQuestions();
    bindEvents();

    function bindEvents() {
        document.getElementById('wqb-add-btn').onclick     = () => openModal();
        document.getElementById('wqb-bulk-btn').onclick    = () => openBulkModal();
        document.getElementById('wqb-modal-close').onclick = closeModal;
        document.getElementById('wqb-modal-cancel').onclick= closeModal;
        document.getElementById('wqb-modal-save').onclick  = saveQuestion;
        document.getElementById('wqb-search-btn').onclick  = () => { currentPage=1; loadQuestions(); };
        document.getElementById('wqb-clear-btn').onclick   = clearFilters;
        document.getElementById('wqb-prev').onclick        = () => { if(currentPage>1){currentPage--;loadQuestions();} };
        document.getElementById('wqb-next').onclick        = () => { if(currentPage<totalPages){currentPage++;loadQuestions();} };
        document.getElementById('wqb-search').addEventListener('keydown', e => { if(e.key==='Enter'){ currentPage=1; loadQuestions(); }});

        // Filter dropdown cascades
        document.getElementById('wqb-filter-subject').onchange = e => {
            loadLessons(e.target.value, 'wqb-filter-lesson', 'wqb-filter-topic', 'All Lessons', 'All Topics');
            currentPage = 1; loadQuestions();
        };
        document.getElementById('wqb-filter-lesson').onchange = e => {
            loadTopics(e.target.value, 'wqb-filter-topic', 'All Topics');
            currentPage = 1; loadQuestions();
        };
        document.getElementById('wqb-filter-topic').onchange = () => { currentPage = 1; loadQuestions(); };
        document.getElementById('wqb-filter-type').onchange = () => { currentPage = 1; loadQuestions(); };
        document.getElementById('wqb-filter-diff').onchange = () => { currentPage = 1; loadQuestions(); };

        // Single add modal cascades
        document.getElementById('wqb-m-subject').onchange  = e => loadLessons(e.target.value,'wqb-m-lesson','wqb-m-topic');
        document.getElementById('wqb-m-lesson').onchange   = e => loadTopics(e.target.value,'wqb-m-topic');
        document.getElementById('wqb-m-has-sub').onchange  = e => {
            document.getElementById('wqb-sub-container').classList.toggle('hidden', !e.target.checked);
        };
        document.getElementById('wqb-add-sub-btn').onclick = () => addSubQuestion();
        document.getElementById('wqb-m-image-file').onchange = handleImageUpload;
        document.getElementById('wqb-m-image-remove').onclick = removeImage;

        // Bulk modal cascades
        document.getElementById('wqb-bulk-close').onclick   = closeBulkModal;
        document.getElementById('wqb-bulk-parse-btn').onclick= parseBulkQuestions;
        document.getElementById('wqb-bulk-back-btn').onclick = () => {
            document.getElementById('wqb-bulk-step1').classList.remove('hidden');
            document.getElementById('wqb-bulk-step2').classList.add('hidden');
        };
        document.getElementById('wqb-bulk-save-btn').onclick = saveBulkQuestions;
        document.getElementById('wqb-bulk-subject').onchange = e => {
            loadLessons(e.target.value, 'wqb-bulk-lesson', 'wqb-bulk-topic', '-- Lesson (Optional) --', '-- Topic (Optional) --');
        };
        document.getElementById('wqb-bulk-lesson').onchange = e => {
            loadTopics(e.target.value, 'wqb-bulk-topic', '-- Topic (Optional) --');
        };

        // Close on backdrop
        document.getElementById('wqb-modal').onclick = e => { if(e.target===document.getElementById('wqb-modal')) closeModal(); };
        document.getElementById('wqb-bulk-modal').onclick = e => { if(e.target===document.getElementById('wqb-bulk-modal')) closeBulkModal(); };
    }

    // ── Subjects & Cascades ──────────────────────────────────────────────────
    async function loadSubjectOptions() {
        try {
            const res = await fetch(SAPI).then(r=>r.json());
            if (res.success && Array.isArray(res.data)) {
                ['wqb-filter-subject', 'wqb-m-subject', 'wqb-bulk-subject'].forEach(id => {
                    const sel = document.getElementById(id);
                    if (sel) {
                        res.data.forEach(s => {
                            sel.innerHTML += `<option value="${s.id}">${escHtml(s.subject_name)}</option>`;
                        });
                    }
                });
            }
        } catch(e) {
            console.error('Failed to load subjects:', e);
        }
    }

    async function loadBankSubjectOptions() {
        // Handled in loadSubjectOptions
    }

    async function loadLessons(subjectId, lessonSelId, topicSelId, lessonPlaceholder = '-- Lesson --', topicPlaceholder = '-- Topic --') {
        const lSel = document.getElementById(lessonSelId);
        const tSel = document.getElementById(topicSelId);
        if (!lSel) return;
        lSel.innerHTML = `<option value="">${lessonPlaceholder}</option>`;
        lSel.disabled = true;
        if (tSel) {
            tSel.innerHTML = `<option value="">${topicPlaceholder}</option>`;
            tSel.disabled = true;
        }
        if (!subjectId) return;
        try {
            const res = await fetch(`${LAPI}?subject_id=${subjectId}`).then(r=>r.json());
            if (res.success && Array.isArray(res.data)) {
                res.data.forEach(l => lSel.innerHTML += `<option value="${l.id}">${escHtml(l.lesson_name)}</option>`);
                lSel.disabled = false;
            }
        } catch(e) {
            console.error('Failed to load lessons:', e);
        }
    }

    async function loadTopics(lessonId, topicSelId, topicPlaceholder = '-- Topic --') {
        const tSel = document.getElementById(topicSelId);
        if (!tSel) return;
        tSel.innerHTML = `<option value="">${topicPlaceholder}</option>`;
        tSel.disabled = true;
        if (!lessonId) return;
        try {
            const res = await fetch(`${TAPI}?lesson_id=${lessonId}`).then(r=>r.json());
            if (res.success && Array.isArray(res.data)) {
                res.data.forEach(t => tSel.innerHTML += `<option value="${t.id}">${escHtml(t.topic_name)}</option>`);
                tSel.disabled = false;
            }
        } catch(e) {
            console.error('Failed to load topics:', e);
        }
    }

    // ── Load questions ────────────────────────────────────────────────────────
    async function loadQuestions() {
        document.getElementById('wqb-loading').classList.remove('hidden');
        document.getElementById('wqb-list').classList.add('hidden');
        document.getElementById('wqb-empty').classList.add('hidden');

        const params = new URLSearchParams({
            action: 'list', page: currentPage, limit: 15,
            search:        document.getElementById('wqb-search').value.trim(),
            subject_id:    document.getElementById('wqb-filter-subject').value,
            lesson_id:     document.getElementById('wqb-filter-lesson')?.value || '',
            topic_id:      document.getElementById('wqb-filter-topic')?.value || '',
            question_type: document.getElementById('wqb-filter-type').value,
            difficulty:    document.getElementById('wqb-filter-diff').value,
        });
        const res = await fetch(`${API}?${params}`).then(r=>r.json());
        document.getElementById('wqb-loading').classList.add('hidden');

        if (!res.success || !res.data.length) {
            document.getElementById('wqb-empty').classList.remove('hidden');
            document.getElementById('wqb-total-badge').textContent = '0 questions';
            document.getElementById('wqb-pagination').classList.add('hidden');
            return;
        }

        totalPages = res.pages;
        document.getElementById('wqb-total-badge').textContent = `${res.total} question${res.total!==1?'s':''}`;
        renderQuestions(res.data);
        updatePagination(res.page, res.pages);
    }

    function renderQuestions(questions) {
        const list = document.getElementById('wqb-list');
        list.innerHTML = '';
        const typeLabels = {short_answer:'Short Answer',broad:'Broad',essay:'Essay',creative_cq:'Creative/CQ',fill_blank:'Fill Blank',math:'Math',calculation:'Calculation',definition:'Definition',diagram:'Diagram',image_based:'Image-based',passage:'Passage',other:'Other'};
        const diffColor  = {easy:'bg-emerald-100 text-emerald-700',medium:'bg-amber-100 text-amber-700',hard:'bg-red-100 text-red-700'};

        questions.forEach(q => {
            const preview = q.question_text.length > 120 ? q.question_text.substring(0,120)+'…' : q.question_text;
            const div = document.createElement('div');
            div.className = 'bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow group';
            div.innerHTML = `
              <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-800 font-medium leading-relaxed">${escHtml(preview)}</p>
                  <div class="flex flex-wrap gap-2 mt-2 items-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${typeLabels[q.question_type]||q.question_type}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${diffColor[q.difficulty]||''}">${q.difficulty}</span>
                    <span class="text-xs text-gray-500 font-semibold">${q.marks} mark${q.marks!=1?'s':''}</span>
                    ${q.sub_count>0?`<span class="text-xs text-purple-500 font-semibold">${q.sub_count} sub-q</span>`:''}
                    ${q.subject_name ? `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">${escHtml(q.subject_name)}${q.lesson_name ? ' › ' + escHtml(q.lesson_name) : ''}${q.topic_name ? ' › ' + escHtml(q.topic_name) : ''}</span>` : ''}
                    ${q.has_formula?'<span class="text-xs text-orange-500">∑ formula</span>':''}
                  </div>
                </div>
                <div class="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="wqb-edit-btn p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500" data-id="${q.id}" title="Edit">
                    <span class="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button class="wqb-del-btn p-1.5 rounded-lg hover:bg-red-50 text-red-400" data-id="${q.id}" title="Delete">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>`;
            div.querySelector('.wqb-edit-btn').onclick = () => editQuestion(q.id);
            div.querySelector('.wqb-del-btn').onclick  = () => deleteQuestion(q.id);
            list.appendChild(div);
        });
        list.classList.remove('hidden');
    }

    function updatePagination(page, pages) {
        const pag = document.getElementById('wqb-pagination');
        pag.classList.toggle('hidden', pages<=1);
        document.getElementById('wqb-page-info').textContent = `Page ${page} of ${pages}`;
        document.getElementById('wqb-prev').disabled = page<=1;
        document.getElementById('wqb-next').disabled = page>=pages;
    }

    // ── Modal ─────────────────────────────────────────────────────────────────
    function openModal(data=null) {
        editingId = null;
        document.getElementById('wqb-modal-title').textContent = data ? 'Edit Question' : 'Add Written Question';
        document.getElementById('wqb-edit-id').value = '';
        document.getElementById('wqb-m-text').value   = '';
        document.getElementById('wqb-m-answer').value = '';
        document.getElementById('wqb-m-marks').value  = 1;
        document.getElementById('wqb-m-diff').value   = 'medium';
        document.getElementById('wqb-m-type').value   = 'short_answer';
        document.getElementById('wqb-m-lang').value   = 'mixed';
        document.getElementById('wqb-m-formula').checked = false;
        document.getElementById('wqb-m-has-sub').checked = false;
        document.getElementById('wqb-sub-container').classList.add('hidden');
        document.getElementById('wqb-sub-list').innerHTML = '';
        document.getElementById('wqb-m-image-preview').classList.add('hidden');
        document.getElementById('wqb-m-image-remove').classList.add('hidden');
        document.getElementById('wqb-m-image-path').value = '';
        document.getElementById('wqb-m-subject').value = '';
        document.getElementById('wqb-m-lesson').value = '';
        document.getElementById('wqb-m-lesson').disabled = true;
        document.getElementById('wqb-m-topic').value = '';
        document.getElementById('wqb-m-topic').disabled = true;

        if (data) {
            editingId = data.id;
            document.getElementById('wqb-edit-id').value   = data.id;
            document.getElementById('wqb-m-text').value    = data.question_text;
            document.getElementById('wqb-m-answer').value  = data.model_answer||'';
            document.getElementById('wqb-m-marks').value   = data.marks;
            document.getElementById('wqb-m-diff').value    = data.difficulty;
            document.getElementById('wqb-m-type').value    = data.question_type;
            document.getElementById('wqb-m-lang').value    = data.language;
            document.getElementById('wqb-m-formula').checked = !!parseInt(data.has_formula);
            document.getElementById('wqb-m-subject').value = data.subject_id||'';
            if (data.subject_id) loadLessons(data.subject_id,'wqb-m-lesson','wqb-m-topic').then(()=>{
                setTimeout(()=>{ document.getElementById('wqb-m-lesson').value=data.lesson_id||''; if(data.lesson_id) loadTopics(data.lesson_id,'wqb-m-topic').then(()=>{ setTimeout(()=>{document.getElementById('wqb-m-topic').value=data.topic_id||'';},100); }); },100);
            });
            if (data.image_path) {
                document.getElementById('wqb-m-image-path').value = data.image_path;
                document.getElementById('wqb-m-image-preview').src = data.image_path;
                document.getElementById('wqb-m-image-preview').classList.remove('hidden');
                document.getElementById('wqb-m-image-remove').classList.remove('hidden');
            }
            if (data.sub_questions && data.sub_questions.length) {
                document.getElementById('wqb-m-has-sub').checked = true;
                document.getElementById('wqb-sub-container').classList.remove('hidden');
                data.sub_questions.forEach(sq => addSubQuestion(sq));
            }
        }
        document.getElementById('wqb-modal').classList.remove('hidden');
    }

    function closeModal() { document.getElementById('wqb-modal').classList.add('hidden'); }

    async function editQuestion(id) {
        const res = await fetch(`${API}?action=get&id=${id}`).then(r=>r.json());
        if (res.success) openModal(res.data);
        else window.showToast('Failed to load question.','error');
    }

    async function saveQuestion() {
        const btn = document.getElementById('wqb-modal-save');
        const text = document.getElementById('wqb-m-text').value.trim();
        if (!text) { window.showToast('Question text required.','error'); return; }

        btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Saving…';

        const subs = collectSubQuestions();
        const payload = {
            id:             editingId||undefined,
            subject_id:     document.getElementById('wqb-m-subject').value,
            lesson_id:      document.getElementById('wqb-m-lesson').value,
            topic_id:       document.getElementById('wqb-m-topic').value,
            question_text:  text,
            question_type:  document.getElementById('wqb-m-type').value,
            difficulty:     document.getElementById('wqb-m-diff').value,
            marks:          parseFloat(document.getElementById('wqb-m-marks').value),
            model_answer:   document.getElementById('wqb-m-answer').value.trim(),
            image_path:     document.getElementById('wqb-m-image-path').value,
            has_formula:    document.getElementById('wqb-m-formula').checked ? 1 : 0,
            language:       document.getElementById('wqb-m-lang').value,
            sub_questions:  document.getElementById('wqb-m-has-sub').checked ? subs : [],
        };

        const action = editingId ? 'update' : 'create';
        const res = await fetch(`${API}?action=${action}`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        }).then(r=>r.json());

        btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-base">save</span> Save Question';

        if (res.success) {
            window.showToast(editingId ? 'Question updated.' : 'Question created.', 'success');
            closeModal(); loadQuestions();
        } else {
            window.showToast(res.message||'Save failed.','error');
        }
    }

    async function deleteQuestion(id) {
        if (!confirm('Delete this question? This cannot be undone.')) return;
        const res = await fetch(`${API}?action=delete`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id})
        }).then(r=>r.json());
        if (res.success) { window.showToast('Deleted.','success'); loadQuestions(); }
        else window.showToast(res.message||'Delete failed.','error');
    }

    // ── Sub-questions ─────────────────────────────────────────────────────────
    function addSubQuestion(data=null) {
        const idx = ++subQCounter;
        const label = String.fromCharCode(96+idx); // a, b, c...
        const div = document.createElement('div');
        div.className = 'sub-q-item bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2';
        div.dataset.idx = idx;
        div.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-500 w-6">(${label})</span>
            <textarea class="sq-text flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-y" rows="2" placeholder="Sub-question text...">${escHtml(data?.sub_question_text||'')}</textarea>
            <button class="sq-del p-1 text-red-400 hover:text-red-600 flex-shrink-0" title="Remove">
              <span class="material-symbols-outlined text-base">remove_circle</span>
            </button>
          </div>
          <div class="flex gap-3 ml-8">
            <div class="flex-1">
              <input type="number" class="sq-marks w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" placeholder="Marks" value="${data?.marks||1}" min="0.5" step="0.5">
            </div>
            <div class="flex-1">
              <textarea class="sq-ans w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-y bg-amber-50/40 focus:outline-none" rows="2" placeholder="Model answer (optional)">${escHtml(data?.model_answer||'')}</textarea>
            </div>
          </div>`;
        div.querySelector('.sq-del').onclick = () => { div.remove(); renumberSubQ(); };
        document.getElementById('wqb-sub-list').appendChild(div);
    }

    function renumberSubQ() {
        document.querySelectorAll('#wqb-sub-list .sub-q-item').forEach((el,i) => {
            const label = String.fromCharCode(97+i);
            el.querySelector('span.text-xs.font-bold').textContent = `(${label})`;
        });
    }

    function collectSubQuestions() {
        const items = document.querySelectorAll('#wqb-sub-list .sub-q-item');
        const subs = [];
        items.forEach((el,i) => {
            const text = el.querySelector('.sq-text').value.trim();
            if (!text) return;
            subs.push({
                sub_question_text: text,
                marks:             parseFloat(el.querySelector('.sq-marks').value)||1,
                model_answer:      el.querySelector('.sq-ans').value.trim(),
                display_order:     i,
            });
        });
        return subs;
    }

    // ── Image upload ──────────────────────────────────────────────────────────
    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData(); fd.append('image', file);
        window.showToast('Uploading image…','info');
        const res = await fetch(IAPI, {method:'POST', body:fd}).then(r=>r.json());
        if (res.success) {
            document.getElementById('wqb-m-image-path').value = res.path;
            document.getElementById('wqb-m-image-preview').src = res.path;
            document.getElementById('wqb-m-image-preview').classList.remove('hidden');
            document.getElementById('wqb-m-image-remove').classList.remove('hidden');
            window.showToast('Image uploaded.','success');
        } else {
            window.showToast(res.message||'Upload failed.','error');
        }
    }

    function removeImage() {
        document.getElementById('wqb-m-image-path').value = '';
        document.getElementById('wqb-m-image-preview').src = '';
        document.getElementById('wqb-m-image-preview').classList.add('hidden');
        document.getElementById('wqb-m-image-remove').classList.add('hidden');
        document.getElementById('wqb-m-image-file').value = '';
    }

    // ── Bulk add ──────────────────────────────────────────────────────────────
    function openBulkModal() {
        document.getElementById('wqb-bulk-modal').classList.remove('hidden');
        document.getElementById('wqb-bulk-step1').classList.remove('hidden');
        document.getElementById('wqb-bulk-step2').classList.add('hidden');
        document.getElementById('wqb-bulk-text').value = '';
        document.getElementById('wqb-bulk-subject').value = '';
        const lSel = document.getElementById('wqb-bulk-lesson');
        if (lSel) { lSel.innerHTML = '<option value="">-- Lesson (Optional) --</option>'; lSel.disabled = true; }
        const tSel = document.getElementById('wqb-bulk-topic');
        if (tSel) { tSel.innerHTML = '<option value="">-- Topic (Optional) --</option>'; tSel.disabled = true; }
    }
    function closeBulkModal() { document.getElementById('wqb-bulk-modal').classList.add('hidden'); }

    function parseBulkQuestions() {
        const inputEl = document.getElementById('wqb-bulk-text');
        const raw = inputEl.value.trim();
        if (!raw) {
            if (typeof window.showToast === 'function') {
                window.showToast('Please paste or type some questions first.', 'warning');
            } else {
                alert('Please paste or type some questions first.');
            }
            inputEl.focus();
            return;
        }

        const defType = document.getElementById('wqb-bulk-type').value || 'short_answer';
        const defMarks = parseFloat(document.getElementById('wqb-bulk-marks').value) || 2;

        const lines = raw.split(/\r?\n/);
        const pattern = /^(?:(?:\d+|[০-৯]+|[ivxlcdm]+|\([a-z0-9০-৯ivxlcdm]+\)|Q\d*|Question\s*\d*)[.):\s-]+)\s*(.*)/i;
        const bulletPattern = /^[-*•–—]\s*(.*)/;

        let questions = [];
        let current = null;
        let hasDelim = false;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const matchNum = line.match(pattern);
            const matchBullet = line.match(bulletPattern);

            if (matchNum) {
                hasDelim = true;
                if (current && current.question_text.trim()) {
                    questions.push(current);
                }
                current = {
                    question_text: matchNum[1].trim() !== '' ? matchNum[1].trim() : line,
                    question_type: defType,
                    marks: defMarks,
                    model_answer: '',
                    difficulty: 'medium'
                };
            } else if (matchBullet) {
                hasDelim = true;
                if (current && current.question_text.trim()) {
                    questions.push(current);
                }
                current = {
                    question_text: matchBullet[1].trim(),
                    question_type: defType,
                    marks: defMarks,
                    model_answer: '',
                    difficulty: 'medium'
                };
            } else if (current) {
                current.question_text += '\n' + line;
            }
        }
        if (current && current.question_text.trim()) {
            questions.push(current);
        }

        // Fallback: If no numbering or bullets found, split by empty lines (paragraphs)
        if (!hasDelim || questions.length === 0) {
            questions = [];
            const paragraphs = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
            if (paragraphs.length > 1) {
                paragraphs.forEach(p => {
                    questions.push({
                        question_text: p,
                        question_type: defType,
                        marks: defMarks,
                        model_answer: '',
                        difficulty: 'medium'
                    });
                });
            } else {
                // Fallback: treat each non-empty line as a question
                lines.map(l => l.trim()).filter(Boolean).forEach(l => {
                    questions.push({
                        question_text: l,
                        question_type: defType,
                        marks: defMarks,
                        model_answer: '',
                        difficulty: 'medium'
                    });
                });
            }
        }

        if (!questions.length) {
            if (typeof window.showToast === 'function') window.showToast('No questions could be parsed.', 'error');
            return;
        }

        renderBulkPreview(questions);
        document.getElementById('wqb-bulk-step1').classList.add('hidden');
        document.getElementById('wqb-bulk-step2').classList.remove('hidden');
        if (typeof window.showToast === 'function') {
            window.showToast(`Parsed ${questions.length} question${questions.length !== 1 ? 's' : ''}! Review below.`, 'success');
        }
    }

    function renderBulkPreview(questions) {
        const preview = document.getElementById('wqb-bulk-preview');
        preview.innerHTML = '';
        questions.forEach((q,i) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2';
            div.dataset.idx = i;
            div.innerHTML = `
              <div class="flex gap-2 items-start">
                <span class="text-sm font-bold text-gray-400 mt-1">${i+1}.</span>
                <div class="flex-1 space-y-2">
                  <textarea class="bp-text w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-y" rows="2">${escHtml(q.question_text)}</textarea>
                  <div class="flex gap-2">
                    <select class="bp-type border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                      <option value="short_answer" ${q.question_type==='short_answer'?'selected':''}>Short Answer</option>
                      <option value="broad"        ${q.question_type==='broad'?'selected':''}>Broad</option>
                      <option value="math"         ${q.question_type==='math'?'selected':''}>Math</option>
                      <option value="other"        ${q.question_type==='other'?'selected':''}>Other</option>
                    </select>
                    <input type="number" class="bp-marks w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value="${q.marks}" min="0.5" step="0.5">
                    <select class="bp-diff border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                      <option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option>
                    </select>
                    <button class="bp-del ml-auto text-red-400 hover:text-red-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-50">Remove</button>
                  </div>
                  <textarea class="bp-ans w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-y bg-amber-50/40 focus:outline-none" rows="1" placeholder="Model answer (optional)"></textarea>
                </div>
              </div>`;
            div.querySelector('.bp-del').onclick = () => div.remove();
            preview.appendChild(div);
        });
    }

    async function saveBulkQuestions() {
        const rows = document.querySelectorAll('#wqb-bulk-preview [data-idx]');
        const questions = [];
        rows.forEach(div => {
            const text = div.querySelector('.bp-text').value.trim();
            if (!text) return;
            questions.push({
                question_text:  text,
                question_type:  div.querySelector('.bp-type').value,
                marks:          parseFloat(div.querySelector('.bp-marks').value)||1,
                difficulty:     div.querySelector('.bp-diff').value,
                model_answer:   div.querySelector('.bp-ans').value.trim(),
            });
        });
        if (!questions.length) { window.showToast('No questions to save.','error'); return; }

        const btn = document.getElementById('wqb-bulk-save-btn');
        btn.disabled=true; btn.textContent='Saving…';
        const payload = {
            questions,
            subject_id: document.getElementById('wqb-bulk-subject').value || null,
            lesson_id:  document.getElementById('wqb-bulk-lesson')?.value || null,
            topic_id:   document.getElementById('wqb-bulk-topic')?.value || null,
        };
        const res = await fetch(`${API}?action=bulk_create`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        }).then(r=>r.json());
        btn.disabled=false; btn.innerHTML='<span class="material-symbols-outlined text-base">save</span> Save All Questions';

        if (res.success) {
            window.showToast(`${res.count} questions saved!`,'success');
            closeBulkModal(); loadQuestions();
        } else {
            window.showToast(res.message||'Save failed.','error');
        }
    }

    function clearFilters() {
        document.getElementById('wqb-search').value = '';
        document.getElementById('wqb-filter-subject').value = '';
        const lSel = document.getElementById('wqb-filter-lesson');
        if (lSel) { lSel.innerHTML = '<option value="">All Lessons</option>'; lSel.disabled = true; }
        const tSel = document.getElementById('wqb-filter-topic');
        if (tSel) { tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true; }
        document.getElementById('wqb-filter-type').value = '';
        document.getElementById('wqb-filter-diff').value = '';
        currentPage = 1; loadQuestions();
    }

    function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}

initializeWrittenQuestionBank();