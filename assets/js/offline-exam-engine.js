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
        const elapsedSeconds = startTime ? Math.floor((now - new Date(startTime)) / 1000) : 0;
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

        if (attempt.exam_id === 0 && examData.details) {
            attempt.exam_title = examData.details.exam_title;
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
        if (submitExamBtn) {
            submitExamBtn.disabled = true;
            submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Submitting...`;
        }

        let right = 0, wrong = 0, unanswered = 0;
        const mistakes = [];
        const correctIds = [];

        examData.questions.forEach(q => {
            if (!userAnswers[q.id]) {
                unanswered++;
            } else if (userAnswers[q.id] === q.answer) {
                right++;
                correctIds.push(q.id);
            } else {
                wrong++;
                mistakes.push({
                    question_id: q.id,
                    subject_id: q.subject_id || examData.details.subject_id,
                    lesson_id: q.lesson_id || examData.details.lesson_id,
                    topic_id: q.topic_id || examData.details.topic_id
                });
            }
        });

        const score = right * 1;
        const scoreWithNegative = score - (wrong * 0.5);

        const timerEl = document.getElementById('timer');
        const timeLeft = (timerEl && timerEl.textContent.includes(':')) ? timerEl.textContent.split(':') : ['0', '0'];
        const timeLeftSeconds = parseInt(timeLeft[0]) * 60 + parseInt(timeLeft[1]);
        const durationSeconds = (examData.details.duration || examData.details.duration_minutes || 0) * 60;
        const durationUsed = Math.max(0, durationSeconds - timeLeftSeconds);

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
            checksum: btoa(attemptUuid + (examId || 0) + JSON.stringify(userAnswers))
        };

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

            if (navigator.onLine) {
                if (submitExamBtn) submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Syncing...`;

                // 1. Sync Performance
                let syncResult = null;
                if (typeof syncManager !== 'undefined') {
                    syncResult = await syncManager.syncSingleAttempt(attempt);
                }

                // 2. Sync Mistakes
                if (mistakes.length > 0) {
                    try {
                        await fetch('api/mistakes/add.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                exam_id: examId,
                                is_custom: (examId == 0 ? 1 : 0),
                                is_offline: 1,
                                questions: mistakes
                            })
                        });
                    } catch (err) { console.error("Mistake sync failed", err); }
                }

                // 3. Sync Resolutions (NEW)
                if (correctIds.length > 0) {
                    try {
                        await fetch('api/mistakes/resolve.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                questions: correctIds
                            })
                        });
                        console.log("Resolutions synced to Mistake Bank.");
                    } catch (err) { console.error("Resolution sync failed", err); }
                }

                if (syncResult && syncResult.success) {
                    displayExamResult(performanceData, true, syncResult.data?.attempt_id);
                } else {
                    displayExamResult(performanceData, false);
                }
            } else {
                displayExamResult(performanceData, false);
            }
        } catch (e) {
            console.error("Error during submission:", e);
            displayExamResult(performanceData, false);
        } finally {
            if (submitExamBtn) {
                submitExamBtn.disabled = false;
                submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span>Submit Exam`;
            }
        }
    }

    async function loadOfflineExam() {
        const mode = params.get('mode');
        console.log("Offline Engine: Starting load...", { mode, examId, attemptUuid });

        if (mode === 'daily_15' || mode === 'daily_10' || mode === 'mastery_quiz') {
            try {
                let questions = [];
                const count = (mode === 'daily_15' || mode === 'mastery_quiz') ? 15 : 10;
                const title = mode === 'mastery_quiz' ? 'Mastery Quiz' : `Daily ${count} Challenge`;

                if (mode === 'mastery_quiz') {
                    if (!navigator.onLine) {
                        alert('You must be online to fetch questions from your Mistake Bank.');
                        if (window.loadPage) window.loadPage('dashboard');
                        return;
                    }

                    const fExamId = params.get('exam_id');
                    let apiPath = `api/mistakes/get-mastery.php?limit=${count}`;
                    if (fExamId) apiPath += `&exam_id=${fExamId}`;

                    const response = await fetch(apiPath);
                    const result = await response.json();
                    if (result.success && result.data.length > 0) {
                        questions = result.data;
                    } else {
                        alert('Your Mistake Bank is empty or could not be reached.');
                        if (window.loadPage) window.loadPage('dashboard');
                        return;
                    }
                } else if (mode === 'daily_15' && navigator.onLine) {
                    try {
                        const response = await fetch('api/take-exam/random-questions.php');
                        const result = await response.json();
                        if (result.success && result.data.length > 0) {
                            questions = result.data;
                            console.log("Offline Engine: Loaded live questions from Database");
                        } else {
                            throw new Error(result.message || "Failed to fetch from API");
                        }
                    } catch (apiError) {
                        console.warn("API Fetch Failed, falling back to local IDB:", apiError);
                        questions = await idbManager.getBalancedRandomQuestions(count);
                    }
                } else {
                    questions = await idbManager.getBalancedRandomQuestions(count);
                }

                if (questions.length === 0) {
                    const msg = 'No questions found for this mode.';
                    if (window.showToast) showToast ? showToast(msg, 'error') : alert(msg);
                    if (window.loadPage) window.loadPage('dashboard');
                    return;
                }

                const details = {
                    id: 0,
                    exam_title: title,
                    duration: count,
                    total_marks: count,
                    pass_mark: Math.ceil(count * 0.4),
                    instructions: mode === 'mastery_quiz' ? "Focus and get them right this time!" : "Practice across all subjects."
                };

                startTime = new Date().toISOString();
                renderExam(details, questions);
                return;
            } catch (e) {
                console.error("Critical error in load:", e);
                return;
            }
        }

        if (!examId) return;

        try {
            const existingAttempt = await idbManager.getAttempt(attemptUuid);
            const exams = await idbManager.getAll('exams');
            const details = exams.find(e => e.id == examId);

            if (!details) {
                if (window.showToast) showToast('Exam data not found offline.', 'error');
                return;
            }

            const questions = await idbManager.getQuestionsByExam(examId);
            if (!questions || questions.length === 0) {
                if (window.showToast) showToast('Exam questions not found offline.', 'error');
                return;
            }

            if (existingAttempt) {
                userAnswers = existingAttempt.answers || {};
                startTime = existingAttempt.start_time;
                if (existingAttempt.status === 'COMPLETED' || existingAttempt.status === 'SYNCED') {
                    window.loadPage('offline-exams');
                    return;
                }
            } else {
                startTime = new Date().toISOString();
                await autoSaveProgress();
            }

            renderExam(details, questions);

        } catch (e) {
            console.error("Failed to load offline exam:", e);
        }
    }

    const exitExamBtn = document.getElementById('exit-exam-btn');
    if (exitExamBtn) {
        exitExamBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to exit? Your progress will be saved.")) {
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
        if (confirm("Are you sure you want to submit?")) {
            await submitExam();
        }
    });

    loadOfflineExam();
}

initializeOfflineExamEngine();
