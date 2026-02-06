function initializeTakeExamInterface() {
    const API_URL = 'api/take-exam/';
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');

    let examData = {};
    let userAnswers = {};
    let flaggedQuestions = new Set();
    let timerInterval;
    let isExamInProgress = false;
    const originalLoadPage = window.loadPage;

    const resultModal = document.getElementById('result-modal');
    const closeResultModalBtn = document.getElementById('close-result-modal-btn');
    const submitExamBtn = document.getElementById('submit-exam-btn');
    const questionsArea = document.getElementById('questions-area');

    const shuffle = (array) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    };

    const bengaliNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBengali = (num) => num.toString().split('').map(digit => bengaliNumbers[digit]).join('');
    const optionLabels = { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' };
    const displayOrder = ['A', 'B', 'C', 'D'];

    function renderExam(data) {
        examData = data;
        const details = data.details;
        document.getElementById('exam-title').textContent = details.exam_title;
        document.getElementById('exam-breadcrumb').textContent = `${details.subject_name || ''} > ${details.lesson_name || ''} > ${details.topic_name || ''}`.replace(/ > $/, '').replace(/^ > | > $/, '');
        document.getElementById('exam-duration').textContent = `${details.duration} mins`;
        document.getElementById('exam-total-questions').textContent = data.questions.length;
        document.getElementById('exam-total-marks').textContent = details.total_marks;
        document.getElementById('exam-pass-mark').textContent = details.pass_mark;
        document.getElementById('exam-instructions').textContent = details.instructions;

        let fullHTML = '';
        shuffle(data.questions).forEach((q, index) => {
            const optionsArray = Object.entries(q.options);
            const shuffledOptions = shuffle(optionsArray);

            const optionsHTML = displayOrder.map((displayKey, displayIndex) => {
                const [originalKey, value] = shuffledOptions[displayIndex];
                const isSelected = userAnswers[q.id] === originalKey;
                return `
                    <button class="option-btn p-4 text-left rounded-xl border-2 transition-all flex items-start gap-3 active:scale-[0.98] ${isSelected ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-100'}" 
                        data-question-id="${q.id}" data-option-key="${originalKey}">
                        <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full border border-gray-300 text-[10px] font-black ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400'}">
                            ${optionLabels[displayKey]}
                        </span>
                        <span class="text-sm font-medium leading-tight text-gray-700">${value}</span>
                    </button>
                `;
            }).join('');

            const questionHTML = `
                <div class="border rounded-lg p-4 bg-gray-50 relative group scroll-mt-24 sm:scroll-mt-32" id="question-${q.id}">
                    <button class="flag-btn absolute top-4 right-4 text-gray-400 hover:text-yellow-500 transition-colors" data-question-id="${q.id}" title="Flag for Review">
                         <span class="material-symbols-outlined text-xl">flag</span>
                    </button>
                    <p class="text-gray-800 font-semibold pr-8">${toBengali(index + 1)}. ${q.question}</p>
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        ${optionsHTML}
                    </div>
                </div>
            `;
            fullHTML += questionHTML;
        });
        questionsArea.innerHTML = fullHTML;

        isExamInProgress = true;
        setupExitPrevention();
        startTimer(details.duration * 60);
        updateNavigator();
    }

    function setupExitPrevention() {
        window.onbeforeunload = function () {
            if (isExamInProgress) {
                return "You have an exam in progress. Your progress will be submitted.";
            }
        };

        window.addEventListener('pagehide', () => {
            if (isExamInProgress) emergencySubmit();
        });

        window.loadPage = async function (page, params = '') {
            if (isExamInProgress) {
                const confirmed = confirm("An exam is in progress. Exit and submit?");
                if (confirmed) {
                    await submitExam(true);
                    isExamInProgress = false;
                    window.loadPage = originalLoadPage;
                    return originalLoadPage(page, params);
                }
                return;
            }
            return originalLoadPage(page, params);
        };

        history.pushState(null, null, window.location.href);
        const handlePopState = () => {
            if (isExamInProgress) {
                history.pushState(null, null, window.location.href);
                showToast('Back navigation is disabled.', 'error');
            }
        };
        window.addEventListener('popstate', handlePopState);
        setupExitPrevention._popStateCleanup = () => window.removeEventListener('popstate', handlePopState);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isExamInProgress) {
                showToast('Warning: Please stay on this tab.', 'error');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        setupExitPrevention._visibilityCleanup = () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    function startTimer(duration) {
        let timer = duration;
        const timerEl = document.getElementById('timer');
        timerInterval = setInterval(() => {
            const minutes = Math.floor(timer / 60);
            const seconds = timer % 60;
            if (timerEl) timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (--timer < 0) {
                clearInterval(timerInterval);
                submitExam();
            }
        }, 1000);
    }

    function handleOptionClick(e) {
        const btn = e.target.closest('.option-btn');
        if (!btn || btn.disabled) return;

        const questionId = btn.dataset.questionId;
        const optionKey = btn.dataset.optionKey;
        userAnswers[questionId] = optionKey;

        const parent = btn.parentElement;
        parent.querySelectorAll('.option-btn').forEach(b => {
            b.disabled = true;
            b.classList.remove('bg-blue-50', 'border-blue-500', 'shadow-sm');
            b.classList.add('bg-gray-50', 'text-gray-400', 'opacity-60', 'border-gray-100');
            b.querySelector('span').classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            b.querySelector('span').classList.add('bg-gray-100', 'text-gray-300', 'border-gray-200');
        });

        btn.classList.remove('bg-gray-50', 'text-gray-400', 'opacity-60', 'border-gray-100');
        btn.classList.add('bg-blue-50', 'border-blue-500', 'shadow-sm');
        btn.querySelector('span').classList.remove('bg-gray-100', 'text-gray-300', 'border-gray-200');
        btn.querySelector('span').classList.add('bg-blue-600', 'text-white', 'border-blue-600');

        updateNavigator();
    }

    function toggleFlag(e) {
        const btn = e.target.closest('.flag-btn');
        if (!btn) return;
        const qId = btn.dataset.questionId;
        if (flaggedQuestions.has(qId)) {
            flaggedQuestions.delete(qId);
            btn.classList.remove('text-yellow-500');
            btn.classList.add('text-gray-400');
        } else {
            flaggedQuestions.add(qId);
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-yellow-500');
        }
        updateNavigator();
    }

    function updateNavigator() {
        const navContainer = document.getElementById('question-navigator-grid');
        if (!navContainer || !examData.questions) return;

        navContainer.innerHTML = '';
        examData.questions.forEach((q, idx) => {
            let bgColor = 'bg-white border-gray-300 text-gray-600';
            if (userAnswers[q.id]) bgColor = 'bg-green-500 border-green-600 text-white';
            if (flaggedQuestions.has(q.id)) bgColor = 'bg-yellow-500 border-yellow-600 text-white';

            const btn = document.createElement('button');
            btn.className = `w-full aspect-square flex items-center justify-center rounded-xl border-2 text-sm font-bold transition-all hover:scale-105 active:scale-95 ${bgColor}`;
            btn.title = `Question ${idx + 1}`;
            btn.innerText = idx + 1;
            btn.addEventListener('click', () => {
                console.log('Navigator click for question ID:', q.id);
                scrollToQuestion(q.id);
            });
            navContainer.appendChild(btn);
        });
    }

    function scrollToQuestion(id) {
        if (!id) return;
        const el = document.getElementById(`question-${id}`);
        if (!el) return;

        const navSidebar = document.getElementById('navigator-sidebar');
        if (navSidebar && window.innerWidth < 1024) {
            navSidebar.classList.add('translate-x-full', 'pointer-events-none');
            navSidebar.classList.remove('pointer-events-auto');
        }

        const delay = window.innerWidth < 1024 ? 300 : 0;
        setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, delay);
    }
    window.scrollToQuestion = scrollToQuestion;

    function displayExamResult(performanceData) {
        const elements = {
            title: document.getElementById('result-exam-title'),
            time: document.getElementById('result-attempt-time'),
            total: document.getElementById('result-total-questions'),
            correct: document.getElementById('result-correct'),
            wrong: document.getElementById('result-wrong'),
            unanswered: document.getElementById('result-unanswered'),
            score: document.getElementById('result-score'),
            finalScore: document.getElementById('result-final-score'),
            timeUsed: document.getElementById('result-time-used'),
            timeLeft: document.getElementById('result-time-left')
        };

        const setText = (el, text) => { if (el) el.textContent = text; };

        setText(elements.title, examData.details.exam_title);
        setText(elements.time, new Date(performanceData.attempt_time).toLocaleString());
        setText(elements.total, examData.questions.length);
        setText(elements.correct, performanceData.right_answers);
        setText(elements.wrong, performanceData.wrong_answers);
        setText(elements.unanswered, performanceData.unanswered);
        setText(elements.score, performanceData.score.toFixed(2));
        setText(elements.finalScore, performanceData.score_with_negative.toFixed(2));

        const timeUsedStr = new Date(performanceData.time_used_seconds * 1000).toISOString().substr(14, 5);
        const timeLeftStr = new Date(performanceData.time_left_seconds * 1000).toISOString().substr(14, 5);
        setText(elements.timeUsed, `${timeUsedStr} minutes`);
        setText(elements.timeLeft, `${timeLeftStr} minutes`);

        if (resultModal) {
            resultModal.classList.remove('hidden');
            resultModal.classList.add('flex');
        }
    }

    async function emergencySubmit() {
        if (!isExamInProgress) return;
        const performance = calculatePerformance();
        const payload = JSON.stringify({ exam_id: examId, performance: performance });
        if (navigator.sendBeacon) navigator.sendBeacon(`${API_URL}submit.php`, payload);
        else fetch(`${API_URL}submit.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
        isExamInProgress = false;
    }

    function calculatePerformance() {
        let right = 0, wrong = 0, unanswered = 0;
        examData.questions.forEach(q => {
            if (!userAnswers[q.id]) unanswered++;
            else if (userAnswers[q.id] === q.answer) right++;
            else wrong++;
        });
        const score = right * 1;
        const timerEl = document.getElementById('timer');
        const timeLeft = timerEl ? timerEl.textContent.split(':') : ['0', '0'];
        const timeLeftSeconds = (parseInt(timeLeft[0]) || 0) * 60 + (parseInt(timeLeft[1]) || 0);

        return {
            selected_answers: userAnswers, score, score_with_negative: score - (wrong * 0.5),
            right_answers: right, wrong_answers: wrong, unanswered,
            time_used_seconds: (examData.details.duration * 60) - timeLeftSeconds,
            time_left_seconds: timeLeftSeconds
        };
    }

    async function submitExam(isAutoSubmit = false) {
        if (!isExamInProgress && !isAutoSubmit) return;
        clearInterval(timerInterval);
        isExamInProgress = false;
        window.onbeforeunload = null;
        window.loadPage = originalLoadPage;
        if (setupExitPrevention._popStateCleanup) setupExitPrevention._popStateCleanup();
        if (setupExitPrevention._visibilityCleanup) setupExitPrevention._visibilityCleanup();

        submitExamBtn.disabled = true;
        submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Submitting...`;

        const performance = calculatePerformance();
        try {
            const response = await fetch(`${API_URL}submit.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId, performance: performance })
            });
            const result = await response.json();
            if (result.success && result.data && result.data.attempt_id) {
                closeResultModalBtn.dataset.attemptId = result.data.attempt_id;
                displayExamResult(result.data);
            } else showToast(result.message || 'Submission failed.', 'error');
        } catch (e) { showToast('A network error occurred.', 'error'); }
        finally {
            submitExamBtn.disabled = false;
            submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span>Submit Exam`;
        }
    }

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        const icon = type === 'error' ? 'error' : 'check_circle';
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    if (closeResultModalBtn) {
        closeResultModalBtn.addEventListener('click', (e) => {
            if (resultModal) {
                resultModal.classList.add('hidden');
                resultModal.classList.remove('flex');
            }
            const attemptId = e.currentTarget.dataset.attemptId;
            if (window.loadPage && attemptId) window.loadPage('performance-review', `?attempt_id=${attemptId}`);
            else window.loadPage('take-exam-list');
        });
    }

    if (questionsArea) {
        questionsArea.addEventListener('click', (e) => {
            if (e.target.closest('.option-btn')) handleOptionClick(e);
            if (e.target.closest('.flag-btn')) toggleFlag(e);
        });
    }
    if (submitExamBtn) submitExamBtn.addEventListener('click', submitExam);

    const openNavBtn = document.getElementById('open-nav-btn');
    const closeNavBtn = document.getElementById('close-nav-btn');
    const navOverlay = document.getElementById('nav-overlay');
    const navSidebar = document.getElementById('navigator-sidebar');

    if (openNavBtn && navSidebar) {
        openNavBtn.addEventListener('click', () => {
            navSidebar.classList.remove('translate-x-full', 'pointer-events-none');
            navSidebar.classList.add('pointer-events-auto');
        });
    }
    if (closeNavBtn && navSidebar) {
        closeNavBtn.addEventListener('click', () => {
            navSidebar.classList.add('translate-x-full', 'pointer-events-none');
            navSidebar.classList.remove('pointer-events-auto');
        });
    }
    if (navOverlay && navSidebar) {
        navOverlay.addEventListener('click', () => {
            navSidebar.classList.add('translate-x-full', 'pointer-events-none');
            navSidebar.classList.remove('pointer-events-auto');
        });
    }

    async function loadExam() {
        if (!examId) return;
        try {
            const response = await fetch(`${API_URL}start.php?exam_id=${examId}`);
            const result = await response.json();
            if (result.success) renderExam(result.data);
            else showToast(result.message, 'error');
        } catch (e) { showToast('Failed to load exam details.', 'error'); }
    }

    loadExam();
}

initializeTakeExamInterface();
