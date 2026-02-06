function initializeOfflineExamEngine() {
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');

    // Robust UUID Fallback
    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const attemptUuid = params.get('attempt_uuid') || generateUUID();

    let examData = {};
    let userAnswers = {};
    let timerInterval;
    let startTime;

    const resultModal = document.getElementById('result-modal');
    const closeResultModalBtn = document.getElementById('close-result-modal-btn');
    const submitExamBtn = document.getElementById('submit-exam-btn');
    const questionsArea = document.getElementById('questions-area');

    const bengaliNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBengali = (num) => num.toString().split('').map(digit => bengaliNumbers[digit]).join('');
    const optionLabels = { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' };
    const displayOrder = ['A', 'B', 'C', 'D'];

    /**
     * Render Exam from IndexedDB
     */
    async function renderExam(data, questions) {
        examData = { details: data, questions: questions };
        const details = data;

        const duration = details.duration || details.duration_minutes || 0;

        document.getElementById('exam-title').textContent = details.exam_title + " (Offline Mode)";
        document.getElementById('exam-duration').textContent = `${duration} mins`;
        document.getElementById('exam-total-questions').textContent = questions.length;
        document.getElementById('exam-total-marks').textContent = details.total_marks;
        document.getElementById('exam-pass-mark').textContent = details.pass_mark;
        document.getElementById('exam-instructions').textContent = details.instructions || "No specific instructions.";

        questionsArea.innerHTML = '';

        questions.forEach((q, index) => {
            // Defensive decoding if still string
            const options = (typeof q.options === 'string') ? JSON.parse(q.options) : (q.options || {});
            const optionsArray = Object.entries(options);

            const optionsHTML = displayOrder.map((displayKey, displayIndex) => {
                const [originalKey, value] = optionsArray[displayIndex] || [];
                if (!originalKey) return '';

                const isSelected = userAnswers[q.id] === originalKey;
                const disabledAttr = userAnswers[q.id] ? 'disabled' : '';
                const selectedClass = isSelected ? 'bg-blue-200 border-blue-500' : (userAnswers[q.id] ? 'bg-gray-100 text-gray-500' : '');

                return `
                    <button class="option-btn p-3 text-left rounded-lg border bg-white hover:bg-blue-100 hover:border-blue-400 ${selectedClass}" 
                        data-question-id="${q.id}" data-option-key="${originalKey}" ${disabledAttr}>
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

        // Calculate remaining time if resuming
        const now = new Date();
        const elapsedSeconds = Math.floor((now - new Date(startTime)) / 1000);
        const remainingSeconds = (duration * 60) - elapsedSeconds;

        startTimer(remainingSeconds > 0 ? remainingSeconds : 0);
    }

    function startTimer(duration) {
        let timer = duration;
        const timerEl = document.getElementById('timer');
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            const minutes = Math.floor(timer / 60);
            const seconds = timer % 60;
            if (timerEl) timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (--timer < 0) {
                clearInterval(timerInterval);
                if (timerEl) timerEl.textContent = "00:00";
                if (window.showToast) showToast('Time is up! Submitting exam automatically.', 'error');
                submitExam();
            }
        }, 1000);
    }

    async function handleOptionClick(e) {
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

        // Auto-save progress
        await autoSaveProgress();
    }

    async function autoSaveProgress() {
        const attempt = {
            id: attemptUuid,
            exam_id: parseInt(examId) || 0,
            answers: userAnswers,
            start_time: startTime,
            status: 'IN_PROGRESS',
            last_saved: new Date().toISOString()
        };

        // NEW: Persist metadata for virtual exams (like Daily 10)
        if (attempt.exam_id === 0 && examData.details) {
            attempt.exam_title = examData.details.exam_title;
            // Store a snapshot of questions for review mapping
            attempt.questions_snapshot = examData.questions;
        }

        await idbManager.saveAttempt(attempt);
    }

    function displayExamResult(performanceData, isSynced = false, serverAttemptId = null) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('result-exam-title', examData.details.exam_title);
        setText('result-attempt-time', performanceData.attempt_time ? new Date(performanceData.attempt_time).toLocaleString() : new Date().toLocaleString());
        setText('result-total-questions', examData.questions.length);
        setText('result-correct', performanceData.right_answers);
        setText('result-wrong', performanceData.wrong_answers);
        setText('result-unanswered', performanceData.unanswered);
        setText('result-score', performanceData.score.toFixed(2));
        setText('result-final-score', performanceData.score_with_negative.toFixed(2));

        const timeUsedStr = new Date(performanceData.time_used_seconds * 1000).toISOString().substr(14, 5);
        setText('result-time-used', `${timeUsedStr} minutes`);

        const durationSeconds = (examData.details.duration || examData.details.duration_minutes || 0) * 60;
        const timeLeftSeconds = durationSeconds - performanceData.time_used_seconds;
        const timeLeftStr = new Date(Math.max(0, timeLeftSeconds) * 1000).toISOString().substr(14, 5);
        setText('result-time-left', `${timeLeftStr} minutes`);

        if (resultModal) {
            resultModal.classList.remove('hidden');
            resultModal.classList.add('flex');

            const titleEl = document.getElementById('result-modal-title');
            const descEl = document.getElementById('result-modal-desc');
            const closeBtn = document.getElementById('close-result-modal-btn');

            if (isSynced && serverAttemptId) {
                if (titleEl) titleEl.textContent = "Exam Submitted!";
                if (descEl) descEl.textContent = "Your attempt has been synced with the server.";
                if (closeBtn) {
                    closeBtn.textContent = "View Performance Review";
                    closeBtn.dataset.serverAttemptId = serverAttemptId;
                }
            } else {
                if (titleEl) titleEl.textContent = "Exam Saved Offline!";
                if (descEl) descEl.textContent = "Your attempt is saved locally and will sync later.";
                if (closeBtn) closeBtn.textContent = "Back to Offline List";
            }
        }
    }

    async function submitExam() {
        clearInterval(timerInterval);
        submitExamBtn.disabled = true;
        submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Submitting...`;

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
        const timeLeftSeconds = parseInt(timeLeft[0]) * 60 + parseInt(timeLeft[1]);
        const durationSeconds = (examData.details.duration || examData.details.duration_minutes || 0) * 60;
        const durationUsed = durationSeconds - timeLeftSeconds;

        const attempt = {
            id: attemptUuid,
            exam_id: parseInt(examId) || 0,
            answers: userAnswers,
            start_time: startTime,
            end_time: new Date().toISOString(),
            duration_used: durationUsed,
            right_answers: right,
            wrong_answers: wrong,
            unanswered: unanswered,
            score: score,
            score_with_negative: scoreWithNegative,
            status: 'COMPLETED',
            checksum: btoa(attemptUuid + examId + JSON.stringify(userAnswers))
        };

        // NEW: Persist metadata for virtual exams
        if (attempt.exam_id === 0 && examData.details) {
            attempt.exam_title = examData.details.exam_title;
            attempt.questions_snapshot = examData.questions;
        }

        const performanceData = {
            right_answers: right,
            wrong_answers: wrong,
            unanswered,
            score,
            score_with_negative: scoreWithNegative,
            time_used_seconds: durationUsed,
            attempt_time: attempt.end_time
        };

        try {
            await idbManager.saveAttempt(attempt);

            // Immediate Sync Attempt
            if (navigator.onLine && typeof syncManager !== 'undefined') {
                submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Syncing with Server...`;
                const syncResult = await syncManager.syncSingleAttempt(attempt);

                if (syncResult && syncResult.success) {
                    displayExamResult(performanceData, true, syncResult.data?.attempt_id);
                } else {
                    displayExamResult(performanceData, false);
                }
            } else {
                displayExamResult(performanceData, false);
            }

        } catch (e) {
            console.error("Error during offline submission:", e);
            if (window.showToast) showToast('Failed to save attempt.', 'error');
            displayExamResult(performanceData, false);
        } finally {
            submitExamBtn.disabled = false;
            submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span>Submit Exam`;
        }
    }

    async function loadOfflineExam() {
        const mode = params.get('mode');
        console.log("Offline Engine: Starting load...", { mode, examId, attemptUuid });

        if (mode === 'daily_15' || mode === 'daily_10') {
            console.log(`Daily ${mode === 'daily_15' ? '15' : '10'} mode active`);
            try {
                const count = mode === 'daily_15' ? 15 : 10;
                const questions = await idbManager.getBalancedRandomQuestions(count);
                console.log(`Daily ${count}: Questions found:`, questions.length);

                if (questions.length === 0) {
                    const msg = 'Your offline question bank is empty. Please download at least one subject from the "Offline Exams" page first.';
                    if (window.showToast) showToast(msg, 'error');
                    else alert(msg);
                    if (window.loadPage) window.loadPage('dashboard');
                    return;
                }

                const details = {
                    id: 0,
                    exam_title: `Daily ${count} Challenge`,
                    duration: count,
                    total_marks: count,
                    pass_mark: Math.ceil(count * 0.4),
                    instructions: `${count} random questions from all your downloaded subjects. You have ${count} minutes!`
                };

                startTime = new Date().toISOString();
                renderExam(details, questions);
                return;
            } catch (e) {
                console.error("Critical error in Daily quiz load:", e);
                return;
            }
        }

        if (!examId) return;

        try {
            // 1. Check for existing attempt (resume support)
            const existingAttempt = await idbManager.getAttempt(attemptUuid);

            // 2. Load exam details and questions
            const exams = await idbManager.getAll('exams');
            const details = exams.find(e => e.id == examId);

            if (!details) {
                if (window.showToast) showToast('Exam data not found offline. Please sync while online.', 'error');
                return;
            }

            const questions = await idbManager.getQuestionsByExam(examId);
            if (!questions || questions.length === 0) {
                if (window.showToast) showToast('Exam questions not found offline. Please sync while online.', 'error');
                return;
            }

            if (existingAttempt) {
                userAnswers = existingAttempt.answers || {};
                startTime = existingAttempt.start_time;
                if (existingAttempt.status === 'COMPLETED' || existingAttempt.status === 'SYNCED') {
                    if (window.showToast) showToast('This exam has already been completed.', 'warning');
                    window.loadPage('offline-exams');
                    return;
                }
            } else {
                startTime = new Date().toISOString();
                // Create initial record
                await autoSaveProgress();
            }

            renderExam(details, questions);

        } catch (e) {
            console.error("Failed to load offline exam:", e);
            if (window.showToast) showToast('Error loading offline exam.', 'error');
        }
    }

    const exitExamBtn = document.getElementById('exit-exam-btn');
    if (exitExamBtn) {
        exitExamBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to exit? Your progress will be saved, and you can resume this exam later from the 'My Attempts' section.")) {
                await autoSaveProgress();
                if (window.loadPage) window.loadPage('offline-exams');
            }
        });
    }

    if (closeResultModalBtn) {
        closeResultModalBtn.addEventListener('click', (e) => {
            const serverAttemptId = e.target.dataset.serverAttemptId;
            if (serverAttemptId && window.loadPage) {
                window.loadPage('performance-review', `?attempt_id=${serverAttemptId}`);
            } else if (window.loadPage) {
                window.loadPage('offline-exams');
            }
        });
    }

    if (questionsArea) questionsArea.addEventListener('click', handleOptionClick);
    if (submitExamBtn) submitExamBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to submit? You cannot change your answers after submission.")) {
            await submitExam();
        }
    });

    loadOfflineExam();
}

initializeOfflineExamEngine();
