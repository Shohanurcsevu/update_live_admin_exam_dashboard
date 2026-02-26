const StudyMaterialEngine = {
    BANGLA_DIGITS: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
    BANGLA_OPTIONS: { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' },

    toBanglaNum(numStr) {
        if (!numStr) return '';
        return numStr.toString().replace(/\d/g, d => this.BANGLA_DIGITS[d]);
    },

    createQuestionElement(q, idx) {
        const qDiv = document.createElement('div');
        qDiv.className = 'study-question-item';
        let optionsHtml = '';
        if (q.options) {
            optionsHtml = `
                <div class="study-options-grid">
                    <div class="option-row"><span class="opt-label">(ক)</span> <span class="opt-text">${q.options.A || ''}</span></div>
                    <div class="option-row"><span class="opt-label">(খ)</span> <span class="opt-text">${q.options.B || ''}</span></div>
                    <div class="option-row"><span class="opt-label">(গ)</span> <span class="opt-text">${q.options.C || ''}</span></div>
                    <div class="option-row"><span class="opt-label">(ঘ)</span> <span class="opt-text">${q.options.D || ''}</span></div>
                </div>
            `;
        }
        qDiv.innerHTML = `
            <div class="q-number-bubble">${this.toBanglaNum(idx + 1)}</div>
            <div class="q-content-wrapper">
                <div class="study-question-text">${q.question}</div>
                ${optionsHtml}
                <div class="study-answer-box">
                    <div class="answer-badge"><span class="material-symbols-outlined">check_circle</span> সঠিক উত্তর: ${this.BANGLA_OPTIONS[q.answer] || q.answer}</div>
                    ${q.explanation ? `<div class="study-explanation"><div class="explanation-title">ব্যাখ্যা:</div><div class="explanation-text">${q.explanation}</div></div>` : ''}
                </div>
            </div>
        `;
        return qDiv;
    },

    generate(data) {
        const questions = data.questions;
        const details = data.details || {};
        const container = document.getElementById('print-container');
        if (!container) return;
        container.innerHTML = '';

        this.injectStyles();

        // ── DYNAMIC MEASUREMENT ─────────────────────────────────────────────
        // We use A4 dimensions and style-normalization
        const A4_H_PX = 1122;
        const TOP_TOTAL = 110;
        const BOT_SPACE = 47; // ~12.5mm
        const MAX_CONTENT_H = A4_H_PX - TOP_TOTAL - BOT_SPACE;

        const measurer = document.createElement('div');
        measurer.className = 'study-material-base';
        // Width strictly matching content area
        measurer.style.cssText = 'position:absolute; left:-9999px; top:0; width:174mm; visibility:hidden;';
        document.body.appendChild(measurer);

        const innerMeasurer = document.createElement('div');
        innerMeasurer.className = 'study-content-section';
        measurer.appendChild(innerMeasurer);

        // Measure Hero
        const hDiv = document.createElement('div');
        hDiv.className = 'study-hero';
        hDiv.innerHTML = `<h1 class="study-main-title">${details.title || 'Study Materials'}</h1>
            <div class="study-title-details">${details.subject ? `<span>${details.subject}</span>` : ''}</div>`;
        innerMeasurer.appendChild(hDiv);
        const heroHeight = hDiv.offsetHeight + 25;

        const pages = [[]];
        let currentH = heroHeight;

        questions.forEach((q, idx) => {
            const el = this.createQuestionElement(q, idx);
            innerMeasurer.appendChild(el);
            const h = el.offsetHeight + 18; // Dense margin
            innerMeasurer.removeChild(el);

            if (currentH + h > MAX_CONTENT_H && pages[pages.length - 1].length > 0) {
                pages.push([idx]);
                currentH = h;
            } else {
                pages[pages.length - 1].push(idx);
                currentH += h;
            }
        });
        document.body.removeChild(measurer);

        // ── RENDER ──────────────────────────────────────────────────────────
        const totalPages = pages.length;
        pages.forEach((qIndices, pageIdx) => {
            const pageNum = pageIdx + 1;
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'study-material-base study-page-wrapper';
            if (pageIdx < totalPages - 1) pageWrapper.classList.add('page-break');

            const breadcrumb = [details.subject, details.lesson, details.title].filter(Boolean).join(' / ');

            pageWrapper.innerHTML = `
                <div class="study-page-header">
                    <div class="header-meta-left">
                        <span class="study-label">STUDY MATERIALS</span>
                        <span class="header-breadcrumb">${breadcrumb}</span>
                    </div>
                    <div class="header-meta-right">Page ${pageNum} of ${totalPages}</div>
                </div>
                <div class="study-content-section">
                    ${pageIdx === 0 ? `
                        <div class="study-hero">
                            <h1 class="study-main-title">${details.title || 'Study Materials'}</h1>
                            <div class="study-title-details">
                                ${details.subject ? `<span class="detail-item">${details.subject}</span>` : ''}
                                ${details.lesson ? `<span class="detail-divider">|</span><span class="detail-item">${details.lesson}</span>` : ''}
                            </div>
                            <div class="study-info-bar">
                                <div class="info-pill"><span class="material-symbols-outlined">quiz</span> ${this.toBanglaNum(questions.length)} Questions</div>
                                <div class="info-pill"><span class="material-symbols-outlined">calendar_today</span> ${new Date().toLocaleDateString('en-GB')}</div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="study-questions-list"></div>
                </div>
            `;
            const qList = pageWrapper.querySelector('.study-questions-list');
            qIndices.forEach(qIdx => qList.appendChild(this.createQuestionElement(questions[qIdx], qIdx)));
            container.appendChild(pageWrapper);
        });

        const originalTitle = document.title;
        document.title = details.title || "Study Materials";
        setTimeout(() => { window.print(); setTimeout(() => { document.title = originalTitle; }, 2000); }, 500);
    },

    injectStyles() {
        let style = document.getElementById('study-print-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'study-print-style';
            document.head.appendChild(style);
        }
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
            
            /* NORMALIZED BASE STYLES */
            .study-material-base {
                font-family: 'Outfit', 'Kalpurush', 'Nirmala UI', sans-serif;
                color: #1e293b;
                line-height: 1.5;
                font-size: 11pt;
                box-sizing: border-box;
            }
            .study-material-base * { box-sizing: border-box; }
            .study-page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 5mm; margin-bottom: 8mm; height: 65px; }
            .study-label { font-size: 8pt; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em; }
            .header-breadcrumb { font-size: 9pt; font-weight: 600; color: #64748b; margin-left: 10px; }
            .header-meta-right { font-size: 9pt; font-weight: 700; color: #94a3b8; }
            .study-hero { text-align: center; margin-bottom: 30px; padding: 10mm 0; background: #f8fafc; border-radius: 20px; border: 1px solid #f1f5f9; }
            .study-main-title { font-size: 26pt; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }
            .study-title-details { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px; color: #64748b; font-size: 11pt; font-weight: 600; }
            .study-info-bar { display: flex; justify-content: center; gap: 15px; }
            .info-pill { background: white; padding: 6px 16px; border-radius: 100px; font-size: 10pt; font-weight: 700; color: #475569; border: 1.5px solid #edf2f7; display: flex; align-items: center; gap: 8px; }
            .study-question-item { margin-bottom: 25px; display: flex; gap: 15px; break-inside: avoid; }
            .q-number-bubble { width: 32px; height: 32px; background: #6366f1; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
            .q-content-wrapper { flex: 1; }
            .study-question-text { font-size: 12.5pt; font-weight: 700; margin-bottom: 10px; text-align: justify; }
            .study-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
            .option-row { display: flex; gap: 8px; font-size: 10.5pt; color: #475569; }
            .opt-label { font-weight: 700; color: #94a3b8; min-width: 25px; }
            .study-answer-box { background: #f1f5f9; border-radius: 12px; padding: 12px 18px; margin-top: 8px; }
            .answer-badge { color: #059669; font-weight: 800; display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
            .study-explanation { border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 5px; }
            .explanation-title { font-weight: 800; font-size: 9pt; color: #64748b; text-transform: uppercase; }
            .explanation-text { font-size: 10.5pt; text-align: justify; }

            @media print {
                @page { size: A4; margin: 0; }
                body { margin: 0; padding: 0; background: white !important; }
                #print-container { display: block !important; width: 100% !important; }
                .study-page-wrapper { width: 210mm; height: 297mm; padding: 12mm 18mm 14mm 18mm; margin: 0 auto; overflow: hidden; position: relative; background: white; }
                .page-break { page-break-after: always; break-after: page; }
                -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            }
        `;
    }
};

window.StudyMaterialEngine = StudyMaterialEngine;
