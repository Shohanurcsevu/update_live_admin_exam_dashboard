function initializeWrittenExamPrint() {
    const EB_API = 'api/written/exam_builder.php';
    const urlParams = new URLSearchParams(window.location.search);
    const examId = parseInt(urlParams.get('exam_id') || 0);

    let examData = null;
    let showMarks   = true;
    let showAnswers = false;

    document.getElementById('wep-print-btn').onclick = () => window.print();
    document.getElementById('wep-show-marks').onchange   = e => { showMarks=e.target.checked;   rebuildSheet(); };
    document.getElementById('wep-show-answers').onchange = e => { showAnswers=e.target.checked; rebuildSheet(); };

    if (!examId) {
        document.getElementById('wep-loading').innerHTML = '<p class="text-red-400">No exam_id provided.</p>';
        return;
    }

    loadExam(examId);

    async function loadExam(id) {
        const res = await fetch(`${EB_API}?action=get_exam&exam_id=${id}`).then(r=>r.json());
        document.getElementById('wep-loading').classList.add('hidden');
        if (!res.success) { document.getElementById('wep-loading').innerHTML='<p class="text-red-400">'+escHtml(res.message)+'</p>'; document.getElementById('wep-loading').classList.remove('hidden'); return; }
        examData = res.data;
        document.getElementById('wep-sheet').classList.remove('hidden');
        rebuildSheet();
    }

    function rebuildSheet() {
        if (!examData) return;
        const { exam, sections, questions } = examData;
        const sheet = document.getElementById('wep-sheet');

        let html = `<div class="wep-page">`;

        // Header
        html += `
          <div class="wep-header">
            <div class="wep-school-name">${escHtml(exam.exam_title||'Written Exam')}</div>
            <div class="wep-meta-row">
              <span>Subject: ${escHtml(exam.subject_name||'—')}</span>
              <span>Total Marks: ${exam.total_marks||'—'}</span>
              <span>Time: ${exam.duration ? exam.duration+' min' : '—'}</span>
            </div>
          </div>`;

        if (exam.instructions) {
            html += `<p style="font-style:italic;font-size:11pt;margin-bottom:12px;color:#444;">${escHtml(exam.instructions)}</p>`;
        }

        // Student info row
        html += `
          <div style="display:flex;gap:40px;margin-bottom:18px;">
            <div style="flex:2;border-bottom:1px solid #000;padding-bottom:2px;">Name: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
            <div style="flex:1;border-bottom:1px solid #000;padding-bottom:2px;">Roll: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
            <div style="flex:1;border-bottom:1px solid #000;padding-bottom:2px;">Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
          </div>`;

        // Group questions by section
        const sectionMap = {};
        const noSection   = [];
        questions.forEach(q => {
            if (q.section_id) {
                if (!sectionMap[q.section_id]) sectionMap[q.section_id] = [];
                sectionMap[q.section_id].push(q);
            } else {
                noSection.push(q);
            }
        });

        let globalQNum = 1;

        // Questions with no section
        if (noSection.length) {
            noSection.forEach(q => {
                html += renderQuestion(q, globalQNum++);
            });
        }

        // Sectioned questions
        sections.forEach(sec => {
            const qs = sectionMap[sec.id] || [];
            if (!qs.length) return;
            html += `<div class="wep-section-header">${escHtml(sec.section_title||'')}</div>`;
            if (sec.section_instructions) html += `<div class="wep-section-inst">${escHtml(sec.section_instructions)}</div>`;
            qs.forEach(q => { html += renderQuestion(q, globalQNum++); });
        });

        html += `
          <div class="wep-footer">
            <span>Question Paper — ${escHtml(exam.exam_title)}</span>
            <span>Page 1</span>
          </div>
        </div>`;

        sheet.innerHTML = html;
    }

    function renderQuestion(q, num) {
        let html = `<div class="wep-question-block">`;
        html += `<div class="wep-question-row">
          <span class="wep-q-num">${num}.</span>
          <span class="wep-q-text">${escHtml(q.question_text)}</span>
          ${showMarks && q.marks ? `<span class="wep-q-marks">[${q.marks}]</span>` : ''}
        </div>`;

        if (q.image_path) html += `<img src="${escHtml(q.image_path)}" class="wep-q-image" alt="Question image">`;

        if (showAnswers && q.model_answer) {
            html += `<div class="wep-model-answer"><strong>Model Answer:</strong> ${escHtml(q.model_answer)}</div>`;
        }

        // Sub-questions or answer lines
        if (q.sub_questions && q.sub_questions.length) {
            html += `<div class="wep-sub-list">`;
            q.sub_questions.forEach((sq, i) => {
                const label = String.fromCharCode(97+i);
                html += `<div class="wep-sub-row">
                  <span class="wep-sub-label">(${label})</span>
                  <div style="flex:1">
                    <span>${escHtml(sq.sub_question_text)}</span>
                    ${showMarks && sq.marks ? `<strong style="margin-left:8px;">[${sq.marks}]</strong>` : ''}
                    ${sq.image_path ? `<img src="${escHtml(sq.image_path)}" class="wep-q-image">` : ''}
                    ${showAnswers && sq.model_answer ? `<div class="wep-model-answer">${escHtml(sq.model_answer)}</div>` : ''}
                    ${renderAnswerLines(sq.answer_space_lines || 4)}
                  </div>
                </div>`;
            });
            html += `</div>`;
        } else {
            html += renderAnswerLines(q.answer_space_lines || 8);
        }

        html += `</div>`;
        return html;
    }

    function renderAnswerLines(count) {
        count = Math.max(1, parseInt(count)||8);
        return `<div class="wep-answer-lines">${'<div class="wep-line"></div>'.repeat(count)}</div>`;
    }

    function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
initializeWrittenExamPrint();