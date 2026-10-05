function initializeWrittenExamPrint() {
    const EB_API = 'api/written/exam_builder.php';
    const urlParams = new URLSearchParams(window.location.search);
    const examId = parseInt(urlParams.get('exam_id') || 0);

    let examData = null;
    let showMarks        = true;
    let showAnswers      = false;
    let showQuestionsOnly = false;

    document.getElementById('wep-print-btn').onclick = () => openPrintWindow();
    document.getElementById('wep-show-marks').onchange      = e => { showMarks=e.target.checked;         rebuildSheet(); };
    document.getElementById('wep-show-answers').onchange    = e => { showAnswers=e.target.checked;       rebuildSheet(); };
    document.getElementById('wep-questions-only').onchange  = e => { showQuestionsOnly=e.target.checked; rebuildSheet(); };

    if (!examId) {
        document.getElementById('wep-loading').innerHTML = '<p class="text-red-400">No exam_id provided.</p>';
        return;
    }

    loadExam(examId);

    async function loadExam(id) {
        const loadingEl = document.getElementById('wep-loading');
        try {
            const res = await fetch(`${EB_API}?action=get_exam&exam_id=${id}`).then(r=>r.json());
            loadingEl.classList.add('hidden');
            if (!res.success) {
                loadingEl.innerHTML = `<p class="text-red-500 font-semibold">Error: ${escHtml(res.message||'Unknown error')}</p><p class="text-sm text-gray-400 mt-1">exam_id=${id}</p>`;
                loadingEl.classList.remove('hidden');
                return;
            }
            examData = res.data;
            if (!examData || !examData.exam) {
                loadingEl.innerHTML = `<p class="text-red-500 font-semibold">Error: Invalid exam data returned.</p>`;
                loadingEl.classList.remove('hidden');
                return;
            }
            if (!examData.questions || examData.questions.length === 0) {
                loadingEl.innerHTML = `<p class="text-amber-500 font-semibold">⚠️ This exam has no questions yet.</p><p class="text-sm text-gray-400 mt-1">Go back to the exam builder and add questions first.</p>`;
                loadingEl.classList.remove('hidden');
                // Still show the header even if no questions
            }
            document.getElementById('wep-sheet').classList.remove('hidden');
            rebuildSheet();
        } catch(e) {
            loadingEl.innerHTML = `<p class="text-red-500 font-semibold">Network error loading exam.</p><p class="text-sm text-gray-400 mt-1">${escHtml(String(e))}</p>`;
            loadingEl.classList.remove('hidden');
        }
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
                    ${!showQuestionsOnly ? renderAnswerLines(sq.answer_space_lines || 4) : ''}
                  </div>
                </div>`;
            });
            html += `</div>`;
        } else {
            if (!showQuestionsOnly) html += renderAnswerLines(q.answer_space_lines || 8);
        }

        html += `</div>`;
        return html;
    }

    function renderAnswerLines(count) {
        count = Math.max(1, parseInt(count)||8);
        return `<div class="wep-answer-lines">${'<div class="wep-line"></div>'.repeat(count)}</div>`;
    }

    // ── Open dedicated print window ─────────────────────────────────────────────
    function openPrintWindow() {
        if (!examData) { if(window.showToast) window.showToast('Exam not loaded yet.','error'); return; }
        const { exam } = examData;
        const modeLabel = showQuestionsOnly ? ' — Questions Only' : '';

        // Build the same HTML as rebuildSheet but self-contained
        const sheetDiv = document.getElementById('wep-sheet');
        const sheetHTML = sheetDiv ? sheetDiv.innerHTML : '';

        // Grab print CSS from the page
        const styleContent = `
            body { margin: 0; padding: 0; background: #fff; }
            #wep-sheet { font-family: 'Noto Serif Bengali','Times New Roman',Times,serif; font-size: 12pt; color: #000; line-height: 1.6; }
            .wep-page { width: 100%; min-height: 29.7cm; padding: 2cm 2.5cm; box-sizing: border-box; page-break-after: always; position: relative; }
            .wep-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .wep-school-name { font-size: 15pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .wep-exam-title { font-size: 13pt; font-weight: 700; margin-top: 4px; }
            .wep-meta-row { display: flex; justify-content: space-between; font-size: 11pt; margin-top: 6px; }
            .wep-section-header { text-align: center; font-weight: 700; font-size: 12pt; margin: 18px 0 8px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
            .wep-section-inst { font-style: italic; font-size: 11pt; color: #333; margin-bottom: 8px; }
            .wep-question-block { margin-bottom: 18px; }
            .wep-question-row { display: flex; gap: 10px; align-items: flex-start; }
            .wep-q-num { font-weight: 700; white-space: nowrap; min-width: 2em; }
            .wep-q-text { flex: 1; }
            .wep-q-marks { white-space: nowrap; font-weight: 700; font-size: 11pt; margin-left: 8px; color: #333; }
            .wep-sub-list { margin-left: 2.2em; margin-top: 4px; }
            .wep-sub-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
            .wep-sub-label { font-weight: 700; white-space: nowrap; min-width: 1.8em; }
            .wep-answer-lines { margin-left: 0; margin-top: 6px; }
            .wep-line { border-bottom: 1px solid #999; height: 22px; margin-bottom: 2px; width: 100%; }
            .wep-model-answer { background: #fffde7; border-left: 4px solid #f9a825; padding: 8px 12px; margin-top: 6px; font-size: 11pt; color: #555; border-radius: 4px; }
            .wep-q-image { max-width: 100%; max-height: 200px; margin: 8px 0; border-radius: 4px; }
            .wep-footer { position: absolute; bottom: 1.2cm; left: 2.5cm; right: 2.5cm; border-top: 1px solid #ccc; padding-top: 6px; font-size: 10pt; color: #555; display: flex; justify-content: space-between; }
            @media print { @page { margin: 0; } body { margin: 0; } .wep-page { min-height: auto; } }
        `;

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            if(window.showToast) window.showToast('Pop-up blocked! Please allow pop-ups for this site.','error');
            return;
        }
        printWin.document.write(`<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<title>${escHtml(exam.exam_title||'Written Exam')}${modeLabel}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap">
<style>${styleContent}</style>
</head>
<body>
<div id="wep-sheet">${sheetHTML}</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 400); };<\/script>
</body>
</html>`);
        printWin.document.close();
    }

    function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
}
initializeWrittenExamPrint();