/**
 * Shared Print Engine for Exam PDF Generation
 * Used by both Dashboard (Online) and Offline Exams
 */

const PrintEngine = {
    BANGLA_DIGITS: ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
    BANGLA_OPTIONS: { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' },
    BG_COLORS: ['#FFD1DC', '#FFF9C4', '#C8E6C9', '#FFE5CC', '#E0E0E0'],
    SET_NAMES: ['পদ্মা', 'মেঘনা', 'যমুনা', 'কর্ণফুলী', 'শাপলা', 'গোলাপ', 'জুঁই', 'রজনীগন্ধা'],

    selectedExamId: null,

    init() {
        const modal = document.getElementById('print-options-modal');
        const closeBtn = document.getElementById('close-print-modal');

        if (closeBtn) {
            closeBtn.onclick = () => this.closeModal();
        }

        const generateBtn = document.getElementById('generate-pdf-btn');
        if (generateBtn) {
            generateBtn.onclick = () => {
                if (this.onGenerate) this.onGenerate();
            };
        }

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Expose preset applier to window for onclick attributes
        window.applyExamPreset = (type) => this.applyPreset(type);
    },

    openModal(examId) {
        this.selectedExamId = examId;
        const modal = document.getElementById('print-options-modal');
        const idSpan = document.getElementById('modal-exam-id');

        if (idSpan) idSpan.textContent = examId;
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal() {
        this.selectedExamId = null;
        const modal = document.getElementById('print-options-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    toBanglaNum(numStr) {
        if (!numStr) return '';
        return numStr.toString().replace(/\d/g, d => this.BANGLA_DIGITS[d]);
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    applyPreset(type) {
        const title = document.getElementById('print-custom-title');
        const marks = document.getElementById('print-custom-marks');
        const inst = document.getElementById('print-custom-instructions');
        const time = document.getElementById('print-custom-time');
        const year = document.getElementById('print-custom-year');
        const startNum = document.getElementById('print-start-num');

        if (type === 'Clear') {
            if (title) title.value = '';
            if (marks) marks.value = '';
            if (inst) inst.value = '';
            if (time) time.value = '';
            if (year) year.value = '';
            if (startNum) startNum.value = '';
            return;
        }

        const presets = {
            'BCS': {
                title: 'বিসিএস প্রিলিমিনারি মডেল টেস্ট',
                marks: '২০০',
                time: '২ ঘণ্টা',
                year: '২০২৭',
                inst: '[মোট প্রশ্ন ২০০(দুইশত) টি। প্রতিটি প্রশ্নের ৪ (চার) টি উত্তরের মধ্যে ১ (এক) টি সঠিক উত্তর রয়েছে। প্রতিটি শুদ্ধ উত্তরের জন্য প্রার্থী ১(এক) নম্বর পাবেন। প্রতিটি ভুল উত্তরের জন্য ০.৫ (শূন্য দশমিক পাঁচ) নম্বর কাটা যাবে।]\nউত্তরপত্রের প্রথম অংশে রেজিস্ট্রেশন নম্বর যথাযথভাবে না লিখলে উত্তরপত্র বাতিল হবে। '
            },
            'Primary': {
                title: 'প্রাথমিক প্রধান শিক্ষক নিয়োগ প্রস্তুতি',
                marks: '৯০',
                time: '৯০ মিনিট',
                year: '২০২৬',
                inst: '[মোট প্রশ্ন ৯০ টি। প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য ০.২৫ নম্বর কাটা যাবে।]\nপরীক্ষার্থীকে অবশ্যই কালো কালির বলপয়েন্ট কলম ব্যবহার করতে হবে।'
            },
            'Bank': {
                title: 'Bank Recruitment Preliminary Test',
                marks: '১০০',
                time: '১ ঘণ্টা',
                year: '২০২৬',
                inst: '[Total Questions: 100. Each question carries 1 mark. 0.25 mark will be deducted for each wrong answer.]\nCalculators and other electronic devices are strictly prohibited.'
            }
        };

        const p = presets[type];
        if (p) {
            if (title) title.value = p.title;
            if (marks) marks.value = p.marks;
            if (time) time.value = p.time;
            if (year) year.value = p.year;
            if (inst) inst.value = p.inst;
        }
    },

    /**
     * Core Generation Logic
     * @param {Object} data - Exam data (details + questions)
     */
    generatePDF(data) {
        const bg = this.BG_COLORS[Math.floor(Math.random() * this.BG_COLORS.length)];
        const setNum = ['০১', '০২', '০৩', '০৪'][Math.floor(Math.random() * 4)];
        const setName = this.SET_NAMES[Math.floor(Math.random() * this.SET_NAMES.length)];
        const set = { num: setNum, name: setName };

        const shouldShuffleOptions = document.getElementById('print-shuffle-options').checked;
        let questions = [...data.questions];

        if (shouldShuffleOptions) {
            questions = questions.map(q => {
                const correctText = q.options[q.answer];
                const entries = Object.entries(q.options);
                this.shuffleArray(entries);
                const newOptions = {};
                let newAnswer = 'A';
                entries.forEach(([oldKey, text], idx) => {
                    const newKey = String.fromCharCode(65 + idx);
                    newOptions[newKey] = text;
                    if (text === correctText) newAnswer = newKey;
                });
                return { ...q, options: newOptions, answer: newAnswer };
            });
        }
        questions = this.shuffleArray(questions);

        const details = data.details || {};
        const customTitle = document.getElementById('print-custom-title').value.trim();
        const customYear = document.getElementById('print-custom-year').value.trim();
        const customTime = document.getElementById('print-custom-time').value.trim();
        const customMarks = document.getElementById('print-custom-marks').value.trim();
        const customInstructions = document.getElementById('print-custom-instructions').value.trim();
        const startNumInput = document.getElementById('print-start-num').value.trim();
        const startNum = (startNumInput && parseInt(startNumInput) > 0) ? parseInt(startNumInput) : 1;

        const finalTitle = customTitle || details.exam_title || details.title || "প্রিলিমিনারি টেস্ট";
        const finalYear = customYear || details.year || "2026";
        const finalTime = customTime || details.time || (data.duration ? data.duration + " মিনিট" : "২ ঘণ্টা");
        const finalMarks = customMarks || details.full_marks || (data.total_marks ? parseFloat(data.total_marks).toFixed(0) : "200");

        // Apply dynamic styles
        let bgStyle = document.getElementById('dynamic-bg-style');
        if (!bgStyle) {
            bgStyle = document.createElement('style');
            bgStyle.id = 'dynamic-bg-style';
            document.head.appendChild(bgStyle);
        }
        bgStyle.innerHTML = `
            @media print {
                html, body, #print-container { 
                    background-color: ${bg} !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @page { 
                    background-color: ${bg};
                }
            }
        `;

        const container = document.getElementById('print-container');
        container.innerHTML = '';

        // Cover Page
        const coverDiv = document.createElement('div');
        coverDiv.className = 'cover-page exam-text';
        coverDiv.innerHTML = `
            <div class="set-info-top">
                <span class="set-number">সেট নম্বর <br> <span style="font-size:1.5rem">${set.num}</span></span>
                <span class="code-name">কোড নাম <br> ${set.name}</span>
            </div>
            <div class="exam-title-block">
                <h1>${finalTitle}</h1>
                <div class="exam-year">${this.toBanglaNum(finalYear)}</div>
            </div>
            <div class="exam-meta">সময়: ${finalTime}<br>পূর্ণমান: ${this.toBanglaNum(finalMarks)}</div>
            <div class="instructions">
                ${customInstructions ? customInstructions.split('\n').map(line => `<div>${line}</div>`).join('') :
                `[মোট প্রশ্ন ${this.toBanglaNum(questions.length)} টি। প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য ০.৫ নম্বর কাটা যাবে।]`}
            </div>
            <div class="instructions-divider"></div>
            <div class="instruction-note">উত্তরপত্রের প্রথম অংশে রেজিস্ট্রেশন নম্বর যথাযথভাবে না লিখলে , সঠিকভাবে বৃত্ত ভরাট না করলে অথবা বৃত্ত ভরাটের ক্ষেত্রে কাটাকাটি করলে উত্তরপত্র বাতিল হবে।</div>
        `;
        container.appendChild(coverDiv);

        // Question Pages
        const table = document.createElement('table');
        table.style.width = '100%'; table.style.borderCollapse = 'collapse';
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr><th style="font-weight:normal; text-align:left; padding-bottom: 0.5rem;">
            <div class="questions-header exam-text" style="display:flex; justify-content:space-between; border-bottom:1px solid #000; padding-bottom:0.5rem; margin-bottom:1rem; margin-top:1.5rem;">
                <span>${set.name}</span><span>সেট-${set.num}</span>
            </div></th></tr>`;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        const td = document.createElement('td');
        td.innerHTML = `<div class="question-columns">${questions.map((q, idx) => {
            const MAX_W = 260;
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.font = "0.95rem 'Kalpurush', 'Nirmala UI', sans-serif";
            let totalW = 0, mode = 'horizontal';
            for (let v of [q.options.A, q.options.B, q.options.C, q.options.D]) {
                const w = ctx.measureText("(ক) " + v).width;
                if (w > MAX_W) { mode = 'vertical'; break; }
                totalW += w + 20;
            }
            if (totalW > MAX_W) mode = 'vertical';
            return `<div class="question-item exam-text"><span class="q-text">${this.toBanglaNum(idx + startNum)}। ${q.question}</span>
            <div class="q-options ${mode}"><div class="q-opt"><span>(ক)</span><span>${q.options.A}</span></div><div class="q-opt"><span>(খ)</span><span>${q.options.B}</span></div><div class="q-opt"><span>(গ)</span><span>${q.options.C}</span></div><div class="q-opt"><span>(ঘ)</span><span>${q.options.D}</span></div></div></div>`;
        }).join('')}</div>`;
        tbody.appendChild(document.createElement('tr')).appendChild(td);
        table.appendChild(tbody);
        const qPageWrapper = document.createElement('div');
        qPageWrapper.className = 'page-content-wrapper';
        qPageWrapper.appendChild(table);
        container.appendChild(qPageWrapper);

        // Answer Key
        const ansWrapper = document.createElement('div');
        ansWrapper.className = 'page-content-wrapper answer-key-section exam-text';
        ansWrapper.innerHTML = `<div class="answer-header">উত্তরমালা</div><div class="answer-grid">${questions.map((q, idx) => `<div class="answer-item">${this.toBanglaNum(idx + startNum)} -> ${this.BANGLA_OPTIONS[q.answer] || q.answer}</div>`).join('')}</div>`;
        container.appendChild(ansWrapper);

        // OMR Sheet
        const omrWrapper = document.createElement('div');
        omrWrapper.className = 'page-content-wrapper omr-section exam-text';
        omrWrapper.innerHTML = `<div class="omr-header"><h2>OMR উত্তরপত্র</h2><div style="display:flex; justify-content:space-around; font-size:0.9rem; margin-top:5px;"><span>সেট: ${set.name} (${set.num})</span><span>মোট প্রশ্ন: ${this.toBanglaNum(questions.length)}</span></div><p style="font-size:0.8rem; margin:5px 0 0 0;">সঠিক বৃত্তটি কালো কালির বলপয়েন্ট কলম দ্বারা ভরাট করুন।</p></div>
        <div class="omr-grid-container">${questions.map((_, idx) => `<div class="omr-row"><span class="omr-q-num">${this.toBanglaNum(idx + startNum)}.</span><div class="omr-bubbles"><div class="omr-bubble">ক</div><div class="omr-bubble">খ</div><div class="omr-bubble">গ</div><div class="omr-bubble">ঘ</div></div></div>`).join('')}</div>`;
        container.appendChild(omrWrapper);

        const originalTitle = document.title;
        document.title = finalTitle;
        setTimeout(() => { window.print(); setTimeout(() => { document.title = originalTitle; }, 2000); }, 500);
    }
};

// Initialize on load
PrintEngine.init();
