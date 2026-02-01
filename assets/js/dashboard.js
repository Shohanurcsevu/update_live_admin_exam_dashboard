
function initializeDashboardPage() {
    // --- URLs ---
    const METRICS_API_URL = 'api/dashboard-metrics.php';
    const EXAMS_API_URL = 'api/dashboard-exams.php';
    const DELETE_EXAM_API_URL = 'api/exam/exam.php'; // Re-use existing exam API for delete
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // --- DOM Elements ---
    const subjectFilter = document.getElementById('exam-subject-filter');
    const lessonFilter = document.getElementById('exam-lesson-filter');
    const topicFilter = document.getElementById('exam-topic-filter');
    const examCardsContainer = document.getElementById('exam-cards-container');
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const toastContainer = document.getElementById('toast-container');

    // Print Options Elements
    const printOptionsModal = document.getElementById('print-options-modal');
    const closePrintModalBtn = document.getElementById('close-print-modal');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const modalExamIdSpan = document.getElementById('modal-exam-id');

    let examIdToDelete = null;
    let selectedExamIdForPrint = null;

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    };

    // --- Section 1: Summary Cards Logic ---
    function animateCount(element, targetValue) {
        const end = parseInt(targetValue, 10);
        if (isNaN(end)) { element.textContent = targetValue; return; }
        const duration = 1200;
        let startTime = null;
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const progress = currentTime - startTime;
            const currentNumber = Math.min(Math.floor(progress / duration * end), end);
            element.textContent = currentNumber;
            if (progress < duration) requestAnimationFrame(animation);
            else element.textContent = end;
        }
        requestAnimationFrame(animation);
    }

    async function fetchAndDisplayMetrics() {
        try {
            const response = await fetch(METRICS_API_URL);
            const result = await response.json();
            if (result.success) {
                const metrics = result.data;
                animateCount(document.getElementById('total-subjects'), metrics.subjects);
                animateCount(document.getElementById('total-lessons'), metrics.lessons);
                animateCount(document.getElementById('total-topics'), metrics.topics);
                animateCount(document.getElementById('total-exams'), metrics.exams);
                animateCount(document.getElementById('total-questions'), metrics.questions);
            }
        } catch (error) { console.error("Error fetching metrics:", error); }
    }

    // --- Section 2: Exam Selection Logic ---
    async function populateDropdown(url, selector, placeholder, isDependent = false) {
        selector.innerHTML = `<option value="0">${placeholder}</option>`;
        if (isDependent) selector.disabled = true;
        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                result.data.forEach(item => {
                    selector.innerHTML += `<option value="${item.id}">${item.subject_name || item.lesson_name || item.topic_name}</option>`;
                });
                if (isDependent) selector.disabled = false;
            }
        } catch (error) { console.error(`Dropdown Error for ${placeholder}:`, error); }
    }

    function renderChart(canvasId, history) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || !history || history.length === 0) return;
        if (Chart.getChart(canvasId)) Chart.getChart(canvasId).destroy();
        new Chart(ctx, {
            type: 'line',
            data: { labels: history.map(h => `Attempt ${h.attempt}`), datasets: [{ label: 'Score', data: history.map(h => h.score), borderColor: 'rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Score: ${context.raw}` } } } }
        });
    }

    async function fetchAndDisplayExams() {
        let url = `${EXAMS_API_URL}?`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        url += params.toString();

        examCardsContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">Loading exams...</p>';

        try {
            const response = await fetch(url);
            const result = await response.json();
            examCardsContainer.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    const breadcrumb = exam.subject_name ? `${exam.subject_name} > ${exam.lesson_name} > ${exam.topic_name}` : 'Custom Model Test';
                    const history = exam.performance_history;
                    const lastScore = history.length > 0 ? history[history.length - 1].score.toFixed(2) : 'N/A';
                    const card = `
                        <div class="bg-white p-5 rounded-lg shadow-md flex flex-col hover:shadow-lg transition-shadow">
                        <h3 
                            class="text-lg font-bold text-gray-800 truncate cursor-pointer flex items-center gap-2 copy-exam-id"
                            data-exam-id="${exam.id}"
                            title="Click to copy Exam ID"
                        >
                            Exam ID : ${exam.id}
                            <span class="material-symbols-outlined text-base text-gray-400 hover:text-blue-600">
                            content_copy
                            </span>
                        </h3>
                        <button 
                            class="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer copy-json-btn mb-3 transition-colors" 
                            data-id="${exam.id}"
                        >
                            <span class="material-symbols-outlined text-sm">content_copy</span>
                            <span>Copy JSON</span>
                        </button>

                            <h3 class="text-lg font-bold text-gray-800 truncate">${exam.exam_title}</h3>
                            <p class="text-xs text-gray-500 mb-4 truncate">${breadcrumb}</p>
                            <div class="flex-grow space-y-2 text-sm text-gray-600 mb-4">
                                <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">timer</span>${exam.duration} Minutes</p>
                                <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">help</span>${exam.total_questions} Questions</p>
                                <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">military_tech</span>${parseFloat(exam.total_marks).toFixed(0)} Marks</p>
                            </div>
                            <div class="mt-auto border-t pt-4">
                                <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-gray-500">Last Score:</span><span class="text-lg font-bold ${lastScore === 'N/A' ? 'text-gray-400' : 'text-blue-600'}">${lastScore}</span></div>
                                <div class="h-24"><canvas id="chart-exam-${exam.id}"></canvas></div>
                            </div>
                            <div class="mt-4 flex flex-wrap gap-2">
                                <button class="take-exam-btn flex-1 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors" data-id="${exam.id}">Take Exam</button>
                                <button class="print-options-btn bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" title="Print Options">
                                    <span class="material-symbols-outlined">print</span>
                                </button>
                                <button class="delete-exam-btn bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" title="Delete Exam"><span class="material-symbols-outlined">delete</span></button>
                            </div>
                        </div>`;
                    examCardsContainer.innerHTML += card;
                });
                result.data.forEach(exam => {
                    if (exam.performance_history.length > 0) renderChart(`chart-exam-${exam.id}`, exam.performance_history);
                });
            } else {
                examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found for the selected filters.</p>`;
            }
        } catch (error) {
            console.error('Fetch Exams Error:', error);
            examCardsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load exams.</p>`;
        }
    }
    document.addEventListener("click", function (e) {
        const el = e.target.closest(".copy-exam-id");
        if (el) {
            const examId = el.dataset.examId;
            navigator.clipboard.writeText(examId).then(() => {
                const icon = el.querySelector(".material-symbols-outlined");
                const original = icon.textContent;
                icon.textContent = "check";
                icon.classList.add("text-green-600");
                setTimeout(() => {
                    icon.textContent = original;
                    icon.classList.remove("text-green-600");
                }, 1200);
            });
        }

        const jsonEl = e.target.closest(".copy-json-btn");
        if (jsonEl && !jsonEl.disabled) {
            const examId = jsonEl.dataset.id;
            const icon = jsonEl.querySelector(".material-symbols-outlined");
            const btnText = jsonEl.querySelector("span:not(.material-symbols-outlined)");
            const originalIcon = icon.textContent;

            jsonEl.disabled = true;
            icon.textContent = "hourglass_empty";

            fetch(`https://bcspreli.free.nf/api/take-exam/start.php?exam_id=${examId}`)
                .then(res => res.text())
                .then(data => {
                    return navigator.clipboard.writeText(data);
                })
                .then(() => {
                    icon.textContent = "check";
                    jsonEl.classList.add("text-green-600");
                    setTimeout(() => {
                        icon.textContent = originalIcon;
                        jsonEl.classList.remove("text-green-600");
                        jsonEl.disabled = false;
                    }, 1200);
                })
                .catch(err => {
                    console.error("Copy JSON failed:", err);
                    icon.textContent = originalIcon;
                    jsonEl.disabled = false;
                });
        }
    });

    const openDeleteModal = (id) => {
        examIdToDelete = id;
        deleteModal.classList.remove('hidden');
        deleteModal.classList.add('flex');
    };
    const closeDeleteModal = () => {
        examIdToDelete = null;
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
    };
    const handleDeleteConfirm = async () => {
        if (!examIdToDelete) return;
        try {
            const response = await fetch(`${DELETE_EXAM_API_URL}?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examIdToDelete })
            });
            const result = await response.json();
            showToast(result.message, result.success ? 'success' : 'error');
            if (result.success) {
                fetchAndDisplayExams();
            }
        } catch (error) { showToast('A network error occurred.', 'error'); }
        finally {
            closeDeleteModal();
        }
    };

    // --- Print Logic Implementation ---
    const openPrintModal = (id) => {
        selectedExamIdForPrint = id;
        modalExamIdSpan.textContent = id;
        printOptionsModal.classList.remove('hidden');
        printOptionsModal.classList.add('flex');
    };

    const closePrintModal = () => {
        selectedExamIdForPrint = null;
        printOptionsModal.classList.add('hidden');
        printOptionsModal.classList.remove('flex');
    };

    window.applyExamPreset = function (type) {
        const title = document.getElementById('print-custom-title');
        const marks = document.getElementById('print-custom-marks');
        const inst = document.getElementById('print-custom-instructions');
        const time = document.getElementById('print-custom-time');
        const year = document.getElementById('print-custom-year');
        const startNum = document.getElementById('print-start-num');

        if (type === 'Clear') {
            title.value = ''; marks.value = ''; inst.value = ''; time.value = ''; year.value = ''; startNum.value = '';
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
            title.value = p.title; marks.value = p.marks; time.value = p.time; year.value = p.year; inst.value = p.inst;
        }
    };

    // Immutable Print Engine Logic
    const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const BANGLA_OPTIONS = { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' };
    const BG_COLORS = ['#FFD1DC', '#FFF9C4', '#C8E6C9', '#FFE5CC', '#E0E0E0'];
    const SET_NAMES = ['পদ্মা', 'মেঘনা', 'যমুনা', 'কর্ণফুলী', 'শাপলা', 'গোলাপ', 'জুঁই', 'রজনীগন্ধা'];

    function toBanglaNum(numStr) {
        return numStr.toString().replace(/\d/g, d => BANGLA_DIGITS[d]);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async function processAndPrint() {
        if (!selectedExamIdForPrint) return;

        generatePdfBtn.disabled = true;
        generatePdfBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Fetching Data...';

        try {
            const response = await fetch(`https://bcspreli.free.nf/api/take-exam/start.php?exam_id=${selectedExamIdForPrint}`);
            const result = await response.json();

            if (!result.success || !result.data) throw new Error('Failed to fetch exam data');

            const data = result.data;
            const bg = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
            const setNum = ['০১', '০২', '০৩', '০৪'][Math.floor(Math.random() * 4)];
            const setName = SET_NAMES[Math.floor(Math.random() * SET_NAMES.length)];
            const set = { num: setNum, name: setName };

            const shouldShuffleOptions = document.getElementById('print-shuffle-options').checked;
            let questions = [...data.questions];

            if (shouldShuffleOptions) {
                questions = questions.map(q => {
                    const correctText = q.options[q.answer];
                    const entries = Object.entries(q.options);
                    shuffleArray(entries);
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
            questions = shuffleArray(questions);

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
                    <div class="exam-year">${toBanglaNum(finalYear)}</div>
                </div>
                <div class="exam-meta">সময়: ${finalTime}<br>পূর্ণমান: ${toBanglaNum(finalMarks)}</div>
                <div class="instructions">
                    ${customInstructions ? customInstructions.split('\n').map(line => `<div>${line}</div>`).join('') :
                    `[মোট প্রশ্ন ${toBanglaNum(questions.length)} টি। প্রতিটি প্রশ্নের মান ১। প্রতিটি ভুল উত্তরের জন্য ০.৫ নম্বর কাটা যাবে।]`}
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
                return `<div class="question-item exam-text"><span class="q-text">${toBanglaNum(idx + startNum)}। ${q.question}</span>
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
            ansWrapper.innerHTML = `<div class="answer-header">উত্তরমালা</div><div class="answer-grid">${questions.map((q, idx) => `<div class="answer-item">${toBanglaNum(idx + startNum)} -> ${BANGLA_OPTIONS[q.answer] || q.answer}</div>`).join('')}</div>`;
            container.appendChild(ansWrapper);

            // OMR Sheet
            const omrWrapper = document.createElement('div');
            omrWrapper.className = 'page-content-wrapper omr-section exam-text';
            omrWrapper.innerHTML = `<div class="omr-header"><h2>OMR উত্তরপত্র</h2><div style="display:flex; justify-content:space-around; font-size:0.9rem; margin-top:5px;"><span>সেট: ${set.name} (${set.num})</span><span>মোট প্রশ্ন: ${toBanglaNum(questions.length)}</span></div><p style="font-size:0.8rem; margin:5px 0 0 0;">সঠিক বৃত্তটি কালো কালির বলপয়েন্ট কলম দ্বারা ভরাট করুন।</p></div>
            <div class="omr-grid-container">${questions.map((_, idx) => `<div class="omr-row"><span class="omr-q-num">${toBanglaNum(idx + startNum)}.</span><div class="omr-bubbles"><div class="omr-bubble">ক</div><div class="omr-bubble">খ</div><div class="omr-bubble">গ</div><div class="omr-bubble">ঘ</div></div></div>`).join('')}</div>`;
            container.appendChild(omrWrapper);

            const originalTitle = document.title;
            document.title = finalTitle;
            setTimeout(() => { window.print(); setTimeout(() => { document.title = originalTitle; }, 2000); }, 500);

            showToast('PDF generation triggered successfully!');
            closePrintModal();

        } catch (error) {
            console.error(error);
            showToast('Failed to generate PDF: ' + error.message, 'error');
        } finally {
            generatePdfBtn.disabled = false;
            generatePdfBtn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> Generate PDF Questions';
        }
    }

    // --- Event Listeners & Initial Load ---
    function setupEventListeners() {
        subjectFilter.addEventListener('change', () => {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectFilter.value}`, lessonFilter, 'All Lessons', true);
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;
            fetchAndDisplayExams();
        });

        lessonFilter.addEventListener('change', () => {
            populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonFilter.value}`, topicFilter, 'All Topics', true);
            fetchAndDisplayExams();
        });

        topicFilter.addEventListener('change', fetchAndDisplayExams);

        examCardsContainer.addEventListener('click', (e) => {
            const takeExamBtn = e.target.closest('.take-exam-btn');
            const deleteExamBtn = e.target.closest('.delete-exam-btn');
            const printOptionsBtn = e.target.closest('.print-options-btn');

            if (takeExamBtn) {
                const examId = takeExamBtn.dataset.id;
                if (window.loadPage) window.loadPage('take-exam-interface', `?exam_id=${examId}`);
            }
            if (deleteExamBtn) {
                const examId = deleteExamBtn.dataset.id;
                openDeleteModal(examId);
            }
            if (printOptionsBtn) {
                const examId = printOptionsBtn.dataset.id;
                openPrintModal(examId);
            }
        });

        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

        // Print Options Listeners
        if (closePrintModalBtn) closePrintModalBtn.addEventListener('click', closePrintModal);
        if (generatePdfBtn) generatePdfBtn.addEventListener('click', processAndPrint);

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === printOptionsModal) closePrintModal();
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    function initializePage() {
        fetchAndDisplayMetrics();
        populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects');
        fetchAndDisplayExams();
        setupEventListeners();
    }
    initializePage();
}

initializeDashboardPage();

