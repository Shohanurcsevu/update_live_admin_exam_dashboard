/**
 * Study Material PDF Generation Engine
 * Specifically designed for study and practice
 */

const StudyMaterialEngine = {
    BANGLA_DIGITS: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
    BANGLA_OPTIONS: { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' },

    toBanglaNum(numStr) {
        if (!numStr) return '';
        return numStr.toString().replace(/\d/g, d => this.BANGLA_DIGITS[d]);
    },

    /**
     * Generate Study Material PDF
     * @param {Object} data - { questions: [], details: { title, subject, lesson } }
     */
    generate(data) {
        const questions = data.questions;
        const details = data.details || {};

        const container = document.getElementById('print-container');
        if (!container) return;
        container.innerHTML = '';

        // Create Page Wrapper
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'study-page-wrapper exam-text';

        // Main Table for layout (thead repeats on every page)
        const table = document.createElement('table');
        table.className = 'study-layout-table';

        // table header (Repeats on every page)
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <td>
                    <div class="study-page-header">
                        <div class="header-meta-left">
                            <span class="study-label">STUDY MATERIALS</span>
                            <span class="header-breadcrumb">
                                ${details.subject || ''} ${details.lesson ? `/ ${details.lesson}` : ''} ${details.title && details.title !== details.topic ? `/ ${details.title}` : ''}
                            </span>
                        </div>
                        <div class="header-meta-right">
                            <span class="page-num-placeholder"></span>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        table.appendChild(thead);

        // table body (Content)
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        const td = document.createElement('td');

        // Questions Section
        const contentDiv = document.createElement('div');
        contentDiv.className = 'study-content-section';

        // Hero Header (Only on the first page, part of the content)
        const heroDiv = document.createElement('div');
        heroDiv.className = 'study-hero';
        heroDiv.innerHTML = `
            <h1 class="study-main-title">${details.title || 'Study Materials'}</h1>
            <div class="study-title-details">
                ${details.subject ? `<span class="detail-item">${details.subject}</span>` : ''}
                ${details.lesson ? `<span class="detail-divider">|</span><span class="detail-item">${details.lesson}</span>` : ''}
            </div>
            <div class="study-info-bar">
                <div class="info-pill"><span class="material-symbols-outlined">quiz</span> ${this.toBanglaNum(questions.length)} Questions</div>
                <div class="info-pill"><span class="material-symbols-outlined">calendar_today</span> ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
        `;
        contentDiv.appendChild(heroDiv);

        const questionsList = document.createElement('div');
        questionsList.className = 'study-questions-list';

        questions.forEach((q, idx) => {
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
                    <div class="study-question-text">
                        ${q.question}
                    </div>
                    ${optionsHtml}
                    <div class="study-answer-box">
                        <div class="answer-badge">
                            <span class="material-symbols-outlined">check_circle</span> 
                            সঠিক উত্তর: ${this.BANGLA_OPTIONS[q.answer] || q.answer}
                        </div>
                        ${q.explanation ? `
                        <div class="study-explanation">
                            <div class="explanation-title">ব্যাখ্যা:</div>
                            <div class="explanation-text">${q.explanation}</div>
                        </div>` : ''}
                    </div>
                </div>
            `;
            questionsList.appendChild(qDiv);
        });

        contentDiv.appendChild(questionsList);
        td.appendChild(contentDiv);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        pageWrapper.appendChild(table);
        container.appendChild(pageWrapper);

        // Inject styles for print
        let style = document.getElementById('study-print-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'study-print-style';
            document.head.appendChild(style);
        }
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
            
            @media print {
                @page {
                    size: A4;
                    margin: 0;
                }
                
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body { 
                    background-color: white !important; 
                    margin: 0;
                    padding: 0;
                    color: #1e293b;
                    font-family: 'Outfit', 'Kalpurush', 'Nirmala UI', sans-serif;
                    width: 100%;
                    counter-reset: page;
                }
                
                #print-container {
                    display: block !important;
                    width: 100% !important;
                }

                .study-page-wrapper {
                    padding: 15mm 20mm 15mm 20mm;
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                }

                .exam-text { font-family: 'Outfit', 'Kalpurush', sans-serif; }

                /* Layout Table */
                .study-layout-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                /* Repeating Header */
                .study-page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 5mm;
                    margin-bottom: 8mm;
                    width: 100%;
                }

                .header-meta-left {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .study-label {
                    font-size: 8pt;
                    font-weight: 800;
                    letter-spacing: 0.15em;
                    color: #6366f1;
                    text-transform: uppercase;
                }

                .header-breadcrumb {
                    font-size: 9pt;
                    font-weight: 600;
                    color: #64748b;
                }

                .page-num-placeholder::after {
                    content: "Page " counter(page);
                }

                .header-meta-right {
                    font-size: 9pt;
                    font-weight: 700;
                    color: #94a3b8;
                }

                /* Hero Header (First Page) */
                .study-hero {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 10mm 0;
                    background: #f8fafc;
                    border-radius: 20px;
                    border: 1px solid #f1f5f9;
                }

                .study-main-title {
                    font-size: 26pt;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 10px 0;
                }

                .study-title-details {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 15px;
                    color: #64748b;
                    font-size: 11pt;
                    font-weight: 600;
                }

                .detail-divider { color: #cbd5e1; }

                .study-info-bar {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                }

                .info-pill {
                    background: white;
                    padding: 6px 16px;
                    border-radius: 100px;
                    font-size: 10pt;
                    font-weight: 700;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: 1.5px solid #edf2f7;
                }

                /* Questions Styling */
                .study-question-item {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 25px;
                    display: flex;
                    gap: 15px;
                    position: relative;
                }

                .q-number-bubble {
                    width: 32px;
                    height: 32px;
                    background: #6366f1;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 11pt;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .q-content-wrapper { flex: 1; }

                .study-question-text {
                    font-size: 12.5pt;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 10px;
                    line-height: 1.5;
                    text-align: justify;
                }

                .study-options-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .option-row {
                    display: flex;
                    gap: 8px;
                    font-size: 10.5pt;
                    color: #475569;
                    align-items: baseline;
                }

                .opt-label {
                    font-weight: 700;
                    color: #94a3b8;
                    min-width: 25px;
                }

                .opt-text { font-weight: 500; }

                /* Answer Box */
                .study-answer-box {
                    background: #f1f5f9;
                    border-radius: 12px;
                    padding: 12px 18px;
                    margin-top: 8px;
                }

                .answer-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 800;
                    font-size: 11pt;
                    color: #059669;
                    margin-bottom: 5px;
                }

                .answer-badge .material-symbols-outlined { font-size: 14pt; }

                .study-explanation {
                    border-top: 1px solid #cbd5e1;
                    padding-top: 6px;
                    margin-top: 5px;
                }

                .explanation-title {
                    font-weight: 800;
                    font-size: 9pt;
                    color: #64748b;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .explanation-text {
                    font-size: 10.5pt;
                    color: #334155;
                    line-height: 1.5;
                    text-align: justify;
                }

                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    display: inline-block;
                    font-size: 24px;
                    line-height: 1;
                }
            }
        `;

        // Trigger Print
        const originalTitle = document.title;
        document.title = details.title || "Study Materials";
        setTimeout(() => {
            window.print();
            setTimeout(() => { document.title = originalTitle; }, 2000);
        }, 500);
    }
};

window.StudyMaterialEngine = StudyMaterialEngine;
