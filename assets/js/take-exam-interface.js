function initializeTakeExamInterface() {
    const API_URL = 'api/take-exam/';
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');

    let examData = {};
    let userAnswers = {};
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

        questionsArea.innerHTML = '';

        shuffle(data.questions).forEach((q, index) => {
            const optionsArray = Object.entries(q.options);
            const shuffledOptions = shuffle(optionsArray);

            const optionsHTML = displayOrder.map((displayKey, displayIndex) => {
                const [originalKey, value] = shuffledOptions[displayIndex];
                return `
                    <button class="option-btn p-3 text-left rounded-lg border bg-white hover:bg-blue-100 hover:border-blue-400" data-question-id="${q.id}" data-option-key="${originalKey}">
                        <strong>${optionLabels[displayKey]}.</strong> ${value}
                    </button>
                `;
            }).join('');

            const questionHTML = `
                <div class="border rounded-lg p-4 bg-gray-50">
                    <p class="text-gray-800 font-semibold">${toBengali(index + 1)}. ${q.question}</p>
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        ${optionsHTML}
                    </div>
                </div>
            `;
            questionsArea.innerHTML += questionHTML;
        });

        isExamInProgress = true;
        setupExitPrevention();
        startTimer(details.duration * 60);
    }

    function setupExitPrevention() {
        // 1. Prevent accidental closing/refreshing
        window.onbeforeunload = function () {
            if (isExamInProgress) {
                return "You have an exam in progress. Are you sure you want to leave? Your progress will be submitted.";
            }
        };

        // 2. Auto-submit on tab close or navigation away
        window.addEventListener('pagehide', () => {
            if (isExamInProgress) {
                emergencySubmit();
            }
        });

        // 3. Intercept SPA navigation
        window.loadPage = async function (page, params = '') {
            if (isExamInProgress) {
                const confirmed = confirm("An exam is in progress. If you leave, your exam will be submitted automatically. Continue?");
                if (confirmed) {
                    await submitExam(true); // Fast submit
                    isExamInProgress = false;
                    window.loadPage = originalLoadPage;
                    return originalLoadPage(page, params);
                }
                return;
            }
            return originalLoadPage(page, params);
        };

        // 4. History Trap (Back Button Blocking)
        history.pushState(null, null, window.location.href);
        const handlePopState = (e) => {
            if (isExamInProgress) {
                history.pushState(null, null, window.location.href);
                showToast('Back navigation is disabled during exam. Please use the Submit button.', 'error');
            }
        };
        window.addEventListener('popstate', handlePopState);
        setupExitPrevention._popStateCleanup = () => window.removeEventListener('popstate', handlePopState);

        // 5. Focus Loss Detection
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isExamInProgress) {
                console.warn("Exam Focus Lost: User switched tab or minimized window.");
            } else if (document.visibilityState === 'visible' && isExamInProgress) {
                showToast('Warning: Please stay on this tab until the exam is finished.', 'error');
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
                if (timerEl) timerEl.textContent = "00:00";
                showToast('Time is up! Submitting exam automatically.', 'error');
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
            b.classList.add('bg-gray-100', 'text-gray-500');
        });
        btn.classList.add('bg-blue-200', 'border-blue-500');
    }

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

        const setText = (el, text) => {
            if (el) {
                el.textContent = text;
            } else {
                console.error(`Result modal element not found for text: ${text}`);
            }
        };

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
        } else {
            console.error("The #result-modal element itself was not found in the HTML.");
        }
    }

    async function emergencySubmit() {
        if (!isExamInProgress) return;

        const performance = calculatePerformance();
        const payload = JSON.stringify({ exam_id: examId, performance: performance });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${API_URL}submit.php`, payload);
        } else {
            fetch(`${API_URL}submit.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            });
        }
        isExamInProgress = false;
    }

    function calculatePerformance() {
        let right = 0, wrong = 0, unanswered = 0;
        examData.questions.forEach(q => {
            if (!userAnswers[q.id]) { unanswered++; }
            else if (userAnswers[q.id] === q.answer) { right++; }
            else { wrong++; }
        });

        const score = right * 1;
        const scoreWithNegative = score - (wrong * 0.5);
        const timerEl = document.getElementById('timer');
        const timeLeft = timerEl ? timerEl.textContent.split(':') : ['0', '0'];
        const timeLeftSeconds = (parseInt(timeLeft[0]) || 0) * 60 + (parseInt(timeLeft[1]) || 0);

        return {
            selected_answers: userAnswers, score, score_with_negative: scoreWithNegative,
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

            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const result = await response.json();
            if (result.success && result.data && result.data.attempt_id) {
                closeResultModalBtn.dataset.attemptId = result.data.attempt_id;
                displayExamResult(result.data);
            } else {
                showToast(result.message || 'Submission failed. Please try again.', 'error');
            }
        } catch (e) {
            console.error("Error during exam submission:", e);
            showToast('A network or server error occurred. Please check the console.', 'error');
        } finally {
            submitExamBtn.disabled = false;
            submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span>Submit Exam`;
        }
    }

    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
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
    }

    if (closeResultModalBtn) {
        closeResultModalBtn.addEventListener('click', (e) => {
            if (resultModal) {
                resultModal.classList.add('hidden');
                resultModal.classList.remove('flex');
            }
            const attemptId = e.currentTarget.dataset.attemptId;
            if (window.loadPage && attemptId) {
                window.loadPage('performance-review', `?attempt_id=${attemptId}`);
            } else {
                window.loadPage('take-exam-list');
            }
        });
    }

    if (questionsArea) questionsArea.addEventListener('click', handleOptionClick);
    if (submitExamBtn) submitExamBtn.addEventListener('click', submitExam);

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
