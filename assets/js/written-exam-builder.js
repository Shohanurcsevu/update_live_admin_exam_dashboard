function initializeWrittenExamBuilder() {
    const EB_API   = 'api/written/exam_builder.php';
    const WQ_API   = 'api/written/questions.php';
    const SAPI     = 'api/exam/subjects.php';
    const PRINT_PAGE = 'written-exam-print';

    let currentExamId = null;
    let sections = [];
    let examQuestions = [];
    let selectedBankIds = new Set();
    let subQCounter = 0;
    let editingSectionId = null;

    // Check URL params for existing exam
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('exam_id')) {
        currentExamId = parseInt(urlParams.get('exam_id'));
        loadExistingExam(currentExamId);
    }

    loadSubjects();
    bindEvents();

    function bindEvents() {
        document.getElementById('web-create-btn').onclick    = createExam;
        document.getElementById('web-add-section-btn').onclick = () => openSectionModal();
        document.getElementById('web-add-q-btn').onclick     = () => openQModal();
        document.getElementById('web-from-bank-btn').onclick = openBankModal;
        document.getElementById('web-q-modal-close').onclick = closeQModal;
        document.getElementById('web-q-modal-cancel').onclick= closeQModal;
        document.getElementById('web-q-modal-save').onclick  = addQuestionToExam;
        document.getElementById('web-bank-close').onclick    = closeBankModal;
        document.getElementById('web-bank-search-btn').onclick = loadBankQuestions;
        document.getElementById('web-bank-search').onkeydown = e => { if(e.key==='Enter') loadBankQuestions(); };
        document.getElementById('web-bank-subj').onchange = async e => {
            const sid = e.target.value;
            const lSel = document.getElementById('web-bank-lesson');
            const tSel = document.getElementById('web-bank-topic');
            lSel.innerHTML = '<option value="">All Lessons</option>'; lSel.disabled = true;
            tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true;
            if (!sid) { loadBankQuestions(); return; }
            const res = await fetch(`api/exam/lessons.php?subject_id=${sid}`).then(r=>r.json());
            if (res.success && Array.isArray(res.data)) {
                res.data.forEach(l => lSel.innerHTML += `<option value="${l.id}">${escHtml(l.lesson_name)}</option>`);
                lSel.disabled = false;
            }
            loadBankQuestions();
        };
        document.getElementById('web-bank-lesson').onchange = async e => {
            const lid = e.target.value;
            const tSel = document.getElementById('web-bank-topic');
            tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true;
            if (!lid) { loadBankQuestions(); return; }
            const res = await fetch(`api/exam/topics.php?lesson_id=${lid}`).then(r=>r.json());
            if (res.success && Array.isArray(res.data)) {
                res.data.forEach(t => tSel.innerHTML += `<option value="${t.id}">${escHtml(t.topic_name)}</option>`);
                tSel.disabled = false;
            }
            loadBankQuestions();
        };
        document.getElementById('web-bank-topic').onchange = () => loadBankQuestions();
        document.getElementById('web-bank-type').onchange = () => loadBankQuestions();
        document.getElementById('web-bank-add-selected').onclick = addSelectedFromBank;
        document.getElementById('web-sec-modal-close').onclick = closeSectionModal;
        document.getElementById('web-sec-cancel').onclick    = closeSectionModal;
        document.getElementById('web-sec-save').onclick      = saveSection;
        document.getElementById('web-qm-has-sub').onchange  = e => {
            document.getElementById('web-qm-sub-container').classList.toggle('hidden',!e.target.checked);
        };
        document.getElementById('web-qm-add-sub').onclick   = () => addQModalSub();
        document.getElementById('web-qm-space').onchange    = e => {
            document.getElementById('web-qm-custom-lines-row').classList.toggle('hidden',e.target.value!=='custom');
        };
        document.getElementById('web-save-all-btn').onclick  = saveAllQuestions;
        document.getElementById('web-print-btn').onclick     = printExam;

        // ── Browse panel ──────────────────────────────────────────────────────
        document.getElementById('web-browse-toggle').onclick = () => {
            const body = document.getElementById('web-browse-body');
            const chevron = document.getElementById('web-browse-chevron');
            const btn = document.getElementById('web-browse-toggle');
            const isHidden = body.classList.toggle('hidden');
            chevron.textContent = isHidden ? 'expand_more' : 'expand_less';
            const lbl = document.getElementById('web-browse-toggle-lbl'); if (lbl) lbl.textContent = isHidden ? 'Show' : 'Hide';
            if (!isHidden) loadBrowseExams();
        };
        document.getElementById('web-br-subject').onchange = async e => {
            const sid = e.target.value;
            const lSel = document.getElementById('web-br-lesson');
            const tSel = document.getElementById('web-br-topic');
            lSel.innerHTML = '<option value="">All Lessons</option>'; lSel.disabled = true;
            tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true;
            if (!sid) { loadBrowseExams(); return; }
            const res = await fetch(`api/exam/lessons.php?subject_id=${sid}`).then(r=>r.json());
            if (res.success) {
                res.data.forEach(l => lSel.innerHTML += `<option value="${l.id}">${escHtml(l.lesson_name)}</option>`);
                lSel.disabled = false;
            }
            loadBrowseExams();
        };
        document.getElementById('web-br-lesson').onchange = async e => {
            const lid = e.target.value;
            const tSel = document.getElementById('web-br-topic');
            tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true;
            if (!lid) { loadBrowseExams(); return; }
            const res = await fetch(`api/exam/topics.php?lesson_id=${lid}`).then(r=>r.json());
            if (res.success) {
                res.data.forEach(t => tSel.innerHTML += `<option value="${t.id}">${escHtml(t.topic_name)}</option>`);
                tSel.disabled = false;
            }
            loadBrowseExams();
        };
        document.getElementById('web-br-topic').onchange   = () => loadBrowseExams();
        document.getElementById('web-br-type').onchange    = () => loadBrowseExams();
        document.getElementById('web-br-search-btn').onclick = () => loadBrowseExams();
        document.getElementById('web-br-search').onkeydown  = e => { if(e.key==='Enter') loadBrowseExams(); };
        document.getElementById('web-br-clear-btn').onclick = () => {
            document.getElementById('web-br-subject').value = '';
            document.getElementById('web-br-lesson').innerHTML = '<option value="">All Lessons</option>'; document.getElementById('web-br-lesson').disabled = true;
            document.getElementById('web-br-topic').innerHTML  = '<option value="">All Topics</option>';  document.getElementById('web-br-topic').disabled  = true;
            document.getElementById('web-br-type').value = '';
            document.getElementById('web-br-search').value = '';
            loadBrowseExams();
        };
    }

    async function loadSubjects() {
        try {
            const res = await fetch(SAPI).then(r=>r.json());
            ['web-subject','web-bank-subj','web-br-subject'].forEach(id => {
                const sel = document.getElementById(id);
                if (sel && res.success && Array.isArray(res.data)) {
                    res.data.forEach(s => sel.innerHTML += `<option value="${s.id}">${escHtml(s.subject_name)}</option>`);
                }
            });
        } catch(e) {
            console.error('Failed to load subjects:', e);
        }
    }

    // ── Create / Load Exam ────────────────────────────────────────────────────
    async function createExam() {
        const title = document.getElementById('web-title').value.trim();
        if (!title) { window.showToast('Exam title required.','error'); return; }

        const btn = document.getElementById('web-create-btn');
        btn.disabled = true;

        const payload = {
            exam_title:    title,
            subject_id:    document.getElementById('web-subject').value,
            exam_type:     document.getElementById('web-type').value,
            duration:      parseInt(document.getElementById('web-duration').value)||180,
            total_marks:   parseFloat(document.getElementById('web-marks').value)||0,
            instructions:  document.getElementById('web-instructions').value.trim(),
        };

        const res = await fetch(`${EB_API}?action=create_exam`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        }).then(r=>r.json());
        btn.disabled = false;

        if (res.success) {
            currentExamId = res.exam_id;
            document.getElementById('web-exam-id-val').textContent = res.exam_id;
            document.getElementById('web-exam-id-display').classList.remove('hidden');
            document.getElementById('web-create-btn').textContent = 'Update Info';
            showExamPanels();
            window.showToast('Exam created!','success');
        } else {
            window.showToast(res.message||'Create failed.','error');
        }
    }

    async function loadExistingExam(id) {
        const res = await fetch(`${EB_API}?action=get_exam&exam_id=${id}`).then(r=>r.json());
        if (!res.success) { window.showToast('Exam not found.','error'); return; }
        const { exam, sections: sec, questions: qs } = res.data;
        document.getElementById('web-title').value = exam.exam_title;
        document.getElementById('web-duration').value = exam.duration;
        document.getElementById('web-marks').value = exam.total_marks;
        document.getElementById('web-instructions').value = exam.instructions||'';
        document.getElementById('web-type').value = exam.exam_type||'written';
        document.getElementById('web-exam-id-val').textContent = id;
        document.getElementById('web-exam-id-display').classList.remove('hidden');
        showExamPanels();
        sections = sec;
        renderSections();
        examQuestions = qs;
        renderExamQuestions();
    }

    // ── Browse existing exams ─────────────────────────────────────────────────
    async function loadBrowseExams() {
        const loading = document.getElementById('web-br-loading');
        const empty   = document.getElementById('web-br-empty');
        const list    = document.getElementById('web-br-list');
        loading.classList.remove('hidden'); empty.classList.add('hidden'); list.innerHTML = '';

        const params = new URLSearchParams({
            action:     'list_exams',
            subject_id: document.getElementById('web-br-subject').value,
            lesson_id:  document.getElementById('web-br-lesson').value,
            topic_id:   document.getElementById('web-br-topic').value,
            exam_type:  document.getElementById('web-br-type').value,
            search:     document.getElementById('web-br-search').value.trim(),
        });
        const res = await fetch(`${EB_API}?${params}`).then(r=>r.json());
        loading.classList.add('hidden');

        if (!res.success || !res.data.length) { empty.classList.remove('hidden'); return; }

        const typeColors = { written:'bg-indigo-100 text-indigo-700', mcq:'bg-emerald-100 text-emerald-700', mixed:'bg-purple-100 text-purple-700' };

        res.data.forEach(exam => {
            const breadcrumb = [exam.subject_name, exam.lesson_name, exam.topic_name].filter(Boolean).join(' › ');
            const typeLabel  = exam.exam_type || 'mcq';
            const qCount     = parseInt(exam.mcq_count||0) + parseInt(exam.written_count||0);

        const div = document.createElement('div');
            div.className = 'flex items-center gap-3 bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 rounded-xl px-4 py-3 cursor-pointer transition-all group';
            div.innerHTML = `
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-700">${escHtml(exam.exam_title)}</p>
                <div class="flex flex-wrap items-center gap-2 mt-1">
                  ${breadcrumb ? `<span class="text-xs text-gray-400 truncate max-w-[200px]">${escHtml(breadcrumb)}</span>` : ''}
                  <span class="text-xs font-bold px-1.5 py-0.5 rounded-full ${typeColors[typeLabel]||'bg-gray-100 text-gray-600'}">${typeLabel}</span>
                  ${exam.duration ? `<span class="text-xs text-gray-400">${exam.duration}min</span>` : ''}
                  ${exam.total_marks ? `<span class="text-xs text-gray-400">${exam.total_marks}mk</span>` : ''}
                  ${qCount ? `<span class="text-xs text-gray-500">${qCount}q</span>` : ''}
                  ${parseInt(exam.section_count||0) ? `<span class="text-xs text-blue-500">${exam.section_count}sec</span>` : ''}
                </div>
              </div>
              <div class="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button class="web-br-open-btn flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg">
                  <span class="material-symbols-outlined text-sm">edit</span>Open
                </button>
                <button class="web-br-del-btn flex items-center gap-1 px-2 py-1.5 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white text-xs font-bold rounded-lg transition-colors" title="Delete exam">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>`;
            div.querySelector('.web-br-open-btn').onclick = e => { e.stopPropagation(); openExamInBuilder(exam.id); };
            div.querySelector('.web-br-del-btn').onclick  = e => { e.stopPropagation(); deleteExam(exam.id, exam.exam_title, div); };
            div.onclick = () => openExamInBuilder(exam.id);
            list.appendChild(div);
        });
    }

    async function deleteExam(id, title, cardEl) {
        if (!confirm(`Delete "${title}"?\n\nThis will permanently remove the exam and cannot be undone.`)) return;
        cardEl.style.opacity = '0.4';
        cardEl.style.pointerEvents = 'none';
        try {
            const res = await fetch(`${EB_API}?action=delete_exam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: id })
            }).then(r => r.json());
            if (res.success) {
                window.showToast('Exam deleted.', 'success');
                cardEl.remove();
                // Show empty state if list is now empty
                const list = document.getElementById('web-br-list');
                if (!list.children.length) document.getElementById('web-br-empty').classList.remove('hidden');
                // If the deleted exam was the one currently open, reset builder
                if (currentExamId === id) {
                    currentExamId = null;
                    window.showToast('The exam you were editing has been deleted.', 'error');
                }
            } else {
                window.showToast(res.message || 'Delete failed.', 'error');
                cardEl.style.opacity = '';
                cardEl.style.pointerEvents = '';
            }
        } catch(e) {
            window.showToast('Network error.', 'error');
            cardEl.style.opacity = '';
            cardEl.style.pointerEvents = '';
        }
    }

    async function openExamInBuilder(id) {
        window.showToast('Loading exam…','info');
        const res = await fetch(`${EB_API}?action=get_exam&exam_id=${id}`).then(r=>r.json());
        if (!res.success) { window.showToast('Failed to load exam.','error'); return; }
        const { exam, sections: sec, questions: qs } = res.data;

        currentExamId = id;
        document.getElementById('web-title').value        = exam.exam_title;
        document.getElementById('web-duration').value     = exam.duration;
        document.getElementById('web-marks').value        = exam.total_marks;
        document.getElementById('web-instructions').value = exam.instructions||'';
        document.getElementById('web-type').value         = exam.exam_type||'written';
        // Subject select — set value if matching option exists
        const subSel = document.getElementById('web-subject');
        if (exam.subject_id) subSel.value = exam.subject_id;
        document.getElementById('web-exam-id-val').textContent = id;
        document.getElementById('web-exam-id-display').classList.remove('hidden');
        document.getElementById('web-create-btn').textContent = 'Update Info';

        showExamPanels();
        sections = sec;
        renderSections();
        examQuestions = qs;
        renderExamQuestions();

        // Collapse browse panel, scroll to Step 1
        document.getElementById('web-browse-body').classList.add('hidden');
        document.getElementById('web-browse-chevron').textContent = 'expand_more';
        const lbl = document.getElementById('web-browse-toggle-lbl'); if (lbl) lbl.textContent = 'Show';
        document.getElementById('web-setup-panel').scrollTo({top:0,behavior:'smooth'});
        window.showToast('Exam loaded — edit below.','success');
    }

    function showExamPanels() {
        document.getElementById('web-sections-panel').classList.remove('hidden');
        document.getElementById('web-questions-panel').classList.remove('hidden');
        document.getElementById('web-save-bar').classList.remove('hidden');
        document.getElementById('web-print-btn').classList.remove('hidden');
        updateBankSectionSelector();
        updateQModalSectionSelector();
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    function openSectionModal(sec=null) {
        editingSectionId = sec ? sec.id : null;
        document.getElementById('web-sec-modal-title').textContent = sec ? 'Edit Section' : 'Add Section';
        document.getElementById('web-sec-id').value    = sec ? sec.id : '';
        document.getElementById('web-sec-title').value = sec ? sec.section_title||'' : '';
        document.getElementById('web-sec-inst').value  = sec ? sec.section_instructions||'' : '';
        document.getElementById('web-sec-modal').classList.remove('hidden');
    }
    function closeSectionModal() { document.getElementById('web-sec-modal').classList.add('hidden'); }

    async function saveSection() {
        const title = document.getElementById('web-sec-title').value.trim();
        const inst  = document.getElementById('web-sec-inst').value.trim();
        const id    = document.getElementById('web-sec-id').value;
        const action= id ? 'update_section' : 'add_section';
        const payload = { exam_id:currentExamId, section_title:title, section_instructions:inst, display_order: sections.length };
        if (id) payload.id = parseInt(id);
        const res = await fetch(`${EB_API}?action=${action}`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
        }).then(r=>r.json());
        if (res.success) {
            window.showToast(id?'Section updated.':'Section added.','success');
            closeSectionModal();
            await reloadSections();
        } else window.showToast(res.message||'Failed.','error');
    }

    async function reloadSections() {
        const res = await fetch(`${EB_API}?action=get_exam&exam_id=${currentExamId}`).then(r=>r.json());
        if (res.success) { sections=res.data.sections; renderSections(); updateBankSectionSelector(); updateQModalSectionSelector(); }
    }

    function renderSections() {
        const list = document.getElementById('web-sections-list');
        const empty= document.getElementById('web-sections-empty');
        if (!sections.length) { list.innerHTML=''; list.appendChild(empty); empty.classList.remove('hidden'); return; }
        empty.classList.add('hidden');
        list.innerHTML = sections.map(s => `
          <div class="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <span class="material-symbols-outlined text-gray-300 cursor-grab">drag_indicator</span>
            <div class="flex-1">
              <p class="text-sm font-bold text-gray-800">${escHtml(s.section_title||'Untitled Section')}</p>
              ${s.section_instructions?`<p class="text-xs text-gray-500 mt-0.5">${escHtml(s.section_instructions)}</p>`:''}
            </div>
            <button class="sec-edit-btn text-indigo-400 hover:text-indigo-600 p-1 rounded" data-id="${s.id}">
              <span class="material-symbols-outlined text-sm">edit</span>
            </button>
            <button class="sec-del-btn text-red-300 hover:text-red-500 p-1 rounded" data-id="${s.id}">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>`).join('');
        list.querySelectorAll('.sec-edit-btn').forEach(btn => btn.onclick = () => openSectionModal(sections.find(s=>s.id==btn.dataset.id)));
        list.querySelectorAll('.sec-del-btn').forEach(btn => btn.onclick  = async () => {
            if (!confirm('Delete this section? Questions will become unsectioned.')) return;
            const res = await fetch(`${EB_API}?action=delete_section`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:parseInt(btn.dataset.id)})}).then(r=>r.json());
            if (res.success) { window.showToast('Section deleted.','success'); await reloadSections(); renderExamQuestions(); }
        });
    }

    function updateBankSectionSelector() {
        const sel = document.getElementById('web-bank-section');
        sel.innerHTML = '<option value="">No Section</option>';
        sections.forEach(s => sel.innerHTML += `<option value="${s.id}">${escHtml(s.section_title||'Untitled')}</option>`);
    }
    function updateQModalSectionSelector() {
        const sel = document.getElementById('web-qm-section');
        sel.innerHTML = '<option value="">No Section (top level)</option>';
        sections.forEach(s => sel.innerHTML += `<option value="${s.id}">${escHtml(s.section_title||'Untitled')}</option>`);
    }

    // ── Add question modal ─────────────────────────────────────────────────────
    function openQModal() {
        subQCounter = 0;
        document.getElementById('web-qm-text').value = '';
        document.getElementById('web-qm-marks').value = '5';
        document.getElementById('web-qm-type').value = 'short_answer';
        document.getElementById('web-qm-space').value = 'medium';
        document.getElementById('web-qm-has-sub').checked = false;
        document.getElementById('web-qm-sub-container').classList.add('hidden');
        document.getElementById('web-qm-sub-list').innerHTML = '';
        document.getElementById('web-qm-custom-lines-row').classList.add('hidden');
        document.getElementById('web-q-modal').classList.remove('hidden');
    }
    function closeQModal() { document.getElementById('web-q-modal').classList.add('hidden'); }

    function addQModalSub() {
        const idx = ++subQCounter;
        const label = String.fromCharCode(96+idx);
        const div = document.createElement('div');
        div.className='flex gap-2 items-start bg-gray-50 rounded-lg p-2';
        div.innerHTML=`<span class="text-xs font-bold text-gray-500 mt-2 w-5">(${label})</span>
          <div class="flex-1 space-y-1">
            <textarea class="sqm-text w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-300" rows="2" placeholder="Sub-question..."></textarea>
            <div class="flex gap-2">
              <input type="number" class="sqm-marks w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" value="2" min="0.5" step="0.5" placeholder="Marks">
              <select class="sqm-space border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                <option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option>
              </select>
            </div>
          </div>
          <button class="sqm-del text-red-400 hover:text-red-600 mt-1 p-1"><span class="material-symbols-outlined text-sm">remove_circle</span></button>`;
        div.querySelector('.sqm-del').onclick = () => { div.remove(); };
        document.getElementById('web-qm-sub-list').appendChild(div);
    }

    async function addQuestionToExam() {
        const text = document.getElementById('web-qm-text').value.trim();
        if (!text) { window.showToast('Question text required.','error'); return; }
        const spaceEl = document.getElementById('web-qm-space');
        const spaceVal = spaceEl.value;
        const customLines = spaceVal==='custom' ? parseInt(document.getElementById('web-qm-custom-lines').value)||10 : undefined;
        const spaceLines  = {small:4,medium:8,large:16,custom:customLines}[spaceVal];

        const subs = [];
        document.querySelectorAll('#web-qm-sub-list > div').forEach((el,i) => {
            const t = el.querySelector('.sqm-text').value.trim();
            if (!t) return;
            subs.push({sub_question_text:t,marks:parseFloat(el.querySelector('.sqm-marks').value)||1,display_order:i,answer_space:el.querySelector('.sqm-space').value,answer_space_lines:{small:4,medium:8,large:16}[el.querySelector('.sqm-space').value]||4});
        });

        const payload = {
            exam_id: currentExamId,
            section_id: document.getElementById('web-qm-section').value || null,
            question_text: text,
            question_type: document.getElementById('web-qm-type').value,
            marks: parseFloat(document.getElementById('web-qm-marks').value)||1,
            display_order: examQuestions.length,
            answer_space: spaceVal,
            answer_space_lines: spaceLines,
            sub_questions: document.getElementById('web-qm-has-sub').checked ? subs : [],
        };

        const btn = document.getElementById('web-q-modal-save');
        btn.disabled=true;
        const res = await fetch(`${EB_API}?action=add_question`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json());
        btn.disabled=false;

        if (res.success) {
            window.showToast('Question added.','success');
            closeQModal();
            await reloadExamQuestions();
        } else window.showToast(res.message||'Failed.','error');
    }

    // ── Bank picker ───────────────────────────────────────────────────────────
    function openBankModal() {
        selectedBankIds.clear();
        document.getElementById('web-bank-modal').classList.remove('hidden');
        const lSel = document.getElementById('web-bank-lesson');
        if (lSel) { lSel.innerHTML = '<option value="">All Lessons</option>'; lSel.disabled = true; }
        const tSel = document.getElementById('web-bank-topic');
        if (tSel) { tSel.innerHTML = '<option value="">All Topics</option>'; tSel.disabled = true; }
        loadBankQuestions();
    }
    function closeBankModal() { document.getElementById('web-bank-modal').classList.add('hidden'); selectedBankIds.clear(); }

    async function loadBankQuestions() {
        const list = document.getElementById('web-bank-list');
        list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Loading...</p>';
        const params = new URLSearchParams({
            action:        'list', limit: 50,
            search:        document.getElementById('web-bank-search').value.trim(),
            subject_id:    document.getElementById('web-bank-subj').value,
            lesson_id:     document.getElementById('web-bank-lesson')?.value || '',
            topic_id:      document.getElementById('web-bank-topic')?.value || '',
            question_type: document.getElementById('web-bank-type').value,
        });
        const res = await fetch(`${WQ_API}?${params}`).then(r=>r.json());
        if (!res.success || !res.data.length) { list.innerHTML='<p class="text-sm text-gray-400 text-center py-4">No questions found.</p>'; return; }
        list.innerHTML = res.data.map(q => `
          <label class="flex items-start gap-3 p-3 rounded-xl hover:bg-indigo-50 cursor-pointer border border-transparent hover:border-indigo-200 transition-all">
            <input type="checkbox" class="bank-q-cb mt-0.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" value="${q.id}">
            <div class="flex-1">
              <p class="text-sm text-gray-800">${escHtml(q.question_text.substring(0,100))}${q.question_text.length>100?'…':''}</p>
              <div class="flex gap-2 mt-1">
                <span class="text-xs text-indigo-600 font-semibold">${q.question_type}</span>
                <span class="text-xs text-gray-500">${q.marks} marks</span>
                ${q.sub_count>0?`<span class="text-xs text-purple-500">${q.sub_count} sub-q</span>`:''}
                ${q.subject_name?`<span class="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">${escHtml(q.subject_name)}${q.lesson_name?' › '+escHtml(q.lesson_name):''}${q.topic_name?' › '+escHtml(q.topic_name):''}</span>`:''}
              </div>
            </div>
          </label>`).join('');
    }

    async function addSelectedFromBank() {
        const checked = document.querySelectorAll('#web-bank-list .bank-q-cb:checked');
        if (!checked.length) { window.showToast('Select at least one question.','error'); return; }
        const sectionId = document.getElementById('web-bank-section').value || null;
        const btn = document.getElementById('web-bank-add-selected');
        btn.disabled=true; btn.textContent='Adding…';
        let addedCount=0;
        for (const cb of checked) {
            const qId = parseInt(cb.value);
            // Fetch full question from bank
            const qRes = await fetch(`${WQ_API}?action=get&id=${qId}`).then(r=>r.json());
            if (!qRes.success) continue;
            const q = qRes.data;
            const spaceLines = q.marks<=2?4:q.marks<=5?8:q.marks<=10?12:16;
            const spaceSize  = q.marks<=2?'small':q.marks<=5?'medium':'large';
            const subs = (q.sub_questions||[]).map((sq,i)=>({
                sub_question_text:sq.sub_question_text, marks:sq.marks,
                model_answer:sq.model_answer||'', display_order:i,
                answer_space:sq.marks<=2?'small':'medium',
                answer_space_lines:sq.marks<=2?4:8,
            }));
            const payload = {
                exam_id:currentExamId, section_id:sectionId, source_question_id:qId,
                question_text:q.question_text, question_type:q.question_type,
                marks:q.marks, image_path:q.image_path||'', has_formula:q.has_formula||0,
                display_order:examQuestions.length+addedCount,
                answer_space:spaceSize, answer_space_lines:spaceLines,
                sub_questions:subs,
            };
            const res = await fetch(`${EB_API}?action=add_question`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json());
            if (res.success) addedCount++;
        }
        btn.disabled=false; btn.innerHTML='<span class="material-symbols-outlined text-base">add</span>Add Selected';
        window.showToast(`${addedCount} question${addedCount!==1?'s':''} added.`,'success');
        closeBankModal();
        await reloadExamQuestions();
    }

    // ── Exam questions ─────────────────────────────────────────────────────────
    async function reloadExamQuestions() {
        const res = await fetch(`${EB_API}?action=get_exam&exam_id=${currentExamId}`).then(r=>r.json());
        if (res.success) { examQuestions = res.data.questions; renderExamQuestions(); }
    }

    function renderExamQuestions() {
        const list  = document.getElementById('web-q-list');
        const empty = document.getElementById('web-q-empty');
        const count = document.getElementById('web-q-count-badge');
        count.textContent = examQuestions.length;

        if (!examQuestions.length) { list.innerHTML=''; list.appendChild(empty); empty.classList.remove('hidden'); updateTotalMarks(); return; }
        empty.classList.add('hidden');

        list.innerHTML = examQuestions.map((q,i) => {
            const label = i+1;
            const spaceLabel = {small:'4 lines',medium:'8 lines',large:'16 lines',custom:`${q.answer_space_lines} lines`}[q.answer_space]||'8 lines';
            const secName = sections.find(s=>s.id==q.section_id)?.section_title;
            return `
              <div class="weq-item flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow cursor-grab" draggable="true" data-id="${q.id}" data-order="${q.display_order}">
                <span class="material-symbols-outlined text-gray-300 mt-0.5 flex-shrink-0">drag_indicator</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="text-xs font-bold text-gray-400">Q${label}</span>
                    ${secName?`<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">${escHtml(secName)}</span>`:''}
                    <span class="text-xs text-gray-500">${q.marks} mark${q.marks!=1?'s':''}</span>
                    <span class="text-xs text-gray-400">${spaceLabel}</span>
                  </div>
                  <p class="text-sm text-gray-700 leading-relaxed">${escHtml(q.question_text.substring(0,120))}${q.question_text.length>120?'…':''}</p>
                  ${q.sub_questions&&q.sub_questions.length?`<p class="text-xs text-purple-500 mt-1">${q.sub_questions.length} sub-question${q.sub_questions.length>1?'s':''}</p>`:''}
                </div>
                <div class="flex-shrink-0 flex gap-1">
                  <select class="weq-space-sel text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none" data-id="${q.id}">
                    <option value="small" ${q.answer_space==='small'?'selected':''}>Small</option>
                    <option value="medium" ${q.answer_space==='medium'?'selected':''}>Medium</option>
                    <option value="large" ${q.answer_space==='large'?'selected':''}>Large</option>
                    <option value="custom" ${q.answer_space==='custom'?'selected':''}>Custom</option>
                  </select>
                  <button class="weq-del p-1.5 rounded-lg hover:bg-red-50 text-red-300 hover:text-red-500" data-id="${q.id}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>`;
        }).join('');

        // Bind events
        list.querySelectorAll('.weq-del').forEach(btn => btn.onclick = async () => {
            if (!confirm('Remove this question from exam?')) return;
            const res = await fetch(`${EB_API}?action=remove_question`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:parseInt(btn.dataset.id)})}).then(r=>r.json());
            if (res.success) { window.showToast('Removed.','success'); await reloadExamQuestions(); }
        });
        list.querySelectorAll('.weq-space-sel').forEach(sel => sel.onchange = async e => {
            const res = await fetch(`${EB_API}?action=update_question`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:parseInt(sel.dataset.id),answer_space:e.target.value,answer_space_lines:{small:4,medium:8,large:16,custom:10}[e.target.value]})}).then(r=>r.json());
            if (res.success) window.showToast('Space updated.','success');
        });
        initDragDrop();
        updateTotalMarks();
    }

    function updateTotalMarks() {
        const total = examQuestions.reduce((sum,q)=>sum+parseFloat(q.marks||0),0);
        document.getElementById('web-q-total-marks').textContent = total.toFixed(1)+' marks';
    }

    // ── Drag & Drop ────────────────────────────────────────────────────────────
    function initDragDrop() {
        const list = document.getElementById('web-q-list');
        let dragEl = null;
        list.querySelectorAll('.weq-item').forEach(el => {
            el.ondragstart = () => { dragEl=el; el.classList.add('opacity-50'); };
            el.ondragend   = async () => { el.classList.remove('opacity-50'); await persistOrder(); };
            el.ondragover  = e => { e.preventDefault(); const r=el.getBoundingClientRect(); const after=e.clientY>(r.top+r.height/2); if(dragEl!==el) list.insertBefore(dragEl,after?el.nextSibling:el); };
        });
    }

    async function persistOrder() {
        const items = document.querySelectorAll('#web-q-list .weq-item');
        const order = Array.from(items).map((el,i)=>({id:parseInt(el.dataset.id),display_order:i,section_id:null}));
        await fetch(`${EB_API}?action=reorder_questions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order})});
        await reloadExamQuestions();
    }

    // ── Save All & Print ──────────────────────────────────────────────────────
    async function saveAllQuestions() {
        if (!currentExamId) { window.showToast('Create exam first.','error'); return; }
        const status = document.getElementById('web-save-status');
        status.textContent = 'Saving…';
        // Update exam info
        const payload = {
            exam_id:       currentExamId,
            exam_title:    document.getElementById('web-title').value.trim(),
            subject_id:    document.getElementById('web-subject').value,
            exam_type:     document.getElementById('web-type').value,
            duration:      parseInt(document.getElementById('web-duration').value)||180,
            total_marks:   parseFloat(document.getElementById('web-marks').value)||0,
            instructions:  document.getElementById('web-instructions').value.trim(),
        };
        const res = await fetch(`${EB_API}?action=update_exam`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>r.json());
        status.textContent = res.success ? '✓ Saved' : '✗ Failed';
        if (res.success) window.showToast('Exam saved.','success');
    }

    function printExam() {
        if (!currentExamId) { window.showToast('Save exam first.','error'); return; }
        if (window.loadPage) window.loadPage(PRINT_PAGE, `?exam_id=${currentExamId}`);
    }

    function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
initializeWrittenExamBuilder();