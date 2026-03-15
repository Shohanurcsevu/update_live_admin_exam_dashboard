function initializeTakeExamInterface() {
    const API_URL = 'api/take-exam/';
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');
    const ATTEMPT_IDB_KEY = `take-exam-${examId}`;

    let examData = {};
    let userAnswers = {};
    let flaggedQuestions = new Set();
    let timerInterval;
    let isExamInProgress = false;
    let lastSyncedState = null;
    let hasUnsavedChanges = false;
    let currentNavFilter = 'all'; // 'all', 'unanswered', 'flagged'
    let timeSpentPerQuestion = {}; // Tracks seconds spent per question ID
    let activeQuestionId = null;  // Tracks the current question in view
    const originalLoadPage = window.loadPage;


    const resultModal = document.getElementById('result-modal');
    const closeResultModalBtn = document.getElementById('close-result-modal-btn');
    const submitExamBtn = document.getElementById('submit-exam-btn');
    const submitExamBtnMobile = document.getElementById('submit-exam-btn-mobile');
    const questionsArea = document.getElementById('questions-area');

    let questionObserver;

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
            // Priority-based background logic
            const priorityColors = {
                1: 'bg-emerald-50/50 border-emerald-100', // Low
                2: 'bg-amber-50/50 border-amber-100',   // Medium
                3: 'bg-rose-50/50 border-rose-100'      // High
            };
            const priorityClass = priorityColors[q.priority] || 'bg-gray-50 border-gray-100';

            // Question Insights Calculation
            const takenCount = parseInt(q.taken_count) || 0;
            const correctCount = parseInt(q.correct_count) || 0;
            const wrongCount = parseInt(q.wrong_count) || 0;

            const takenStatus = takenCount > 0 
                ? `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">Taken ${takenCount} times</span>` 
                : `<span class="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Never Taken</span>`;

            let insightsHTML = `<div id="insights-${q.id}" class="hidden flex flex-wrap gap-2 mt-2">` + takenStatus;
            if (takenCount > 0) {
                const correctRate = Math.round((correctCount / takenCount) * 100);
                const wrongRate = Math.round((wrongCount / takenCount) * 100);
                insightsHTML += `
                    <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">Correct: ${correctRate}%</span>
                    <span class="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">Wrong: ${wrongRate}%</span>
                `;
            }
            insightsHTML += `</div>`;

            const optionsArray = Object.entries(q.options);
            const shuffledOptions = shuffle(optionsArray);

            const optionsHTML = displayOrder.map((displayKey, displayIndex) => {
                const [originalKey, value] = shuffledOptions[displayIndex];
                const isSelected = userAnswers[q.id] === originalKey;
                const isAnswered = !!userAnswers[q.id];
                const selectedClass = isSelected ? 'bg-blue-50 border-blue-500 shadow-sm' : (isAnswered ? 'bg-white border-gray-100 opacity-60' : 'bg-white border-gray-100');
                const selectedIconClass = isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-400';
                return `
                    <button class="option-btn p-4 text-left rounded-xl border-2 transition-all flex items-start gap-3 active:scale-[0.98] ${selectedClass}" 
                        data-question-id="${q.id}" data-option-key="${originalKey}" ${isAnswered ? 'disabled' : ''}
                        role="radio" aria-checked="${isSelected}" aria-label="Option ${optionLabels[displayKey]}: ${value}">
                        <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full border border-gray-300 text-[10px] font-black ${selectedIconClass}">
                            ${optionLabels[displayKey]}
                        </span>
                        <span class="text-sm font-medium leading-tight text-gray-700">${value}</span>
                    </button>
                `;
            }).join('');

            const questionHTML = `
                <div class="border rounded-lg p-4 ${priorityClass} relative group scroll-mt-24 sm:scroll-mt-32" id="question-${q.id}">
                    <div class="absolute top-4 right-4 flex items-center gap-1.5">
                         <button class="toggle-insights-btn w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors" data-question-id="${q.id}" title="View Question Stats">
                            <span class="material-symbols-outlined text-xl">bar_chart</span>
                         </button>
                         <button class="flag-btn w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 transition-colors" data-question-id="${q.id}" title="Flag for Review">
                              <span class="material-symbols-outlined text-xl">flag</span>
                         </button>
                    </div>
                    <p class="text-gray-800 font-semibold pr-24 sm:pr-28">${toBengali(index + 1)}. ${q.question}</p>
                    ${insightsHTML}
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        ${optionsHTML}
                    </div>
                </div>
            `;

            fullHTML += questionHTML;
        });
        questionsArea.innerHTML = fullHTML;

        isExamInProgress = true;

        // Track IN_PROGRESS in IndexedDB so the mentor panel can offer a Resume button
        if (typeof idbManager !== 'undefined' && examId) {
            idbManager.saveAttempt({
                id: ATTEMPT_IDB_KEY,
                exam_id: parseInt(examId),
                answers: userAnswers,  // save current answers (important for resume)
                status: 'IN_PROGRESS',
                last_saved: new Date().toISOString()
            }).catch(() => { });
        }

        // Notify Server about ACTIVE session (Cross-Device)
        fetch(`${API_URL}active-session.php?action=start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exam_id: examId, exam_title: details.exam_title })
        })
        .then(res => res.json())
        .then(result => {
            if (result.success && result.session_id) {
                window.serverSessionId = result.session_id;
                startSyncMonitoring();
                startStateSync();
            }
        })
        .catch(() => { });

        // Hide Mentor Icon
        if (window.studyMentor) window.studyMentor.closePanel();
        const mentorWidget = document.getElementById('study-mentor-widget');
        if (mentorWidget) mentorWidget.classList.add('hidden');

        setupExitPrevention();
        startTimer(details.duration * 60);
        setupNavigatorFilters();
        updateNavigator();
        setupProgressTracking();
    }

    function setupProgressTracking() {
        if (questionObserver) questionObserver.disconnect();

        const progressText = document.getElementById('mobile-progress-text');
        if (!progressText) return;

        questionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const qId = entry.target.id.replace('question-', '');
                    const qIndex = examData.questions.findIndex(q => q.id == qId);
                    if (qIndex !== -1) {
                        progressText.innerHTML = `Q ${qIndex + 1} / ${examData.questions.length}`;
                        activeQuestionId = qId;
                    }

                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '-20% 0px -60% 0px'
        });

        document.querySelectorAll('[id^="question-"]').forEach(el => {
            questionObserver.observe(el);
        });
    }

    function setupExitPrevention() {
        window.onbeforeunload = function () {
            if (isExamInProgress) {
                return "You have an exam in progress. Your progress will be submitted.";
            }
        };

        window.addEventListener('pagehide', () => {
            // Removed emergencySubmit() to allow pausing. IDB already has latest answers.
        });

        window.loadPage = async function (page, params = '') {
            // If already in an exam and trying to 'navigate' back to the SAME exam (e.g. via Resume button),
            // just ignore the navigation prevention.
            const targetParams = new URLSearchParams(params.startsWith('?') ? params.substring(1) : params);
            const targetExamId = targetParams.get('exam_id');
            const isNavigatingToSameExam = (page === 'take-exam-interface' && targetExamId == examId);

            if (isExamInProgress && !isNavigatingToSameExam) {
                const action = await new Promise(resolve => {
                    let modal = document.getElementById('exit-confirm-modal');

                    if (!modal) {
                        // Dynamically inject modal to bypass HTML caching issues
                        const modalHTML = `
                            <div id="exit-confirm-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 hidden items-center justify-center z-[200] p-4 backdrop-blur-sm opacity-0 transition-opacity duration-300">
                                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden transform scale-95 transition-transform duration-300">
                                    <div class="bg-indigo-600 p-5 text-center relative overflow-hidden">
                                        <div class="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-white opacity-10"></div>
                                        <div class="absolute bottom-0 left-0 -ml-8 -mb-8 w-16 h-16 rounded-full bg-white opacity-10"></div>
                                        <span class="material-symbols-outlined text-5xl text-white mb-2 relative z-10">pause_circle</span>
                                        <h3 class="text-xl font-bold text-white relative z-10">Exam in Progress</h3>
                                    </div>
                                    <div class="p-6 text-center">
                                        <p class="text-gray-600 mb-6 font-medium">Do you want to pause your exam and resume it later, or stay here?</p>
                                        <div class="flex flex-col gap-3">
                                            <button id="exit-pause-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                                                <span class="material-symbols-outlined">save</span> Pause & Exit
                                            </button>
                                            <button id="exit-cancel-btn" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition-all active:scale-95">
                                                Stay Here
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                        document.body.insertAdjacentHTML('beforeend', modalHTML);
                        modal = document.getElementById('exit-confirm-modal');
                    }

                    const pauseBtn = document.getElementById('exit-pause-btn');
                    const cancelBtn = document.getElementById('exit-cancel-btn');

                    if (!modal || !pauseBtn || !cancelBtn) {
                        resolve(confirm("You have an exam in progress.\n\n[OK] to Pause & Exit (Resume later)\n[Cancel] to stay here."));
                        return;
                    }

                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                    setTimeout(() => {
                        modal.classList.remove('opacity-0');
                        modal.children[0].classList.remove('scale-95');
                    }, 10);

                    const hideModal = () => {
                        modal.classList.add('opacity-0');
                        modal.children[0].classList.add('scale-95');
                        setTimeout(() => {
                            modal.classList.add('hidden');
                            modal.classList.remove('flex');
                        }, 300);
                    };

                    const onPause = () => { hideModal(); cleanup(); resolve(true); };
                    const onCancel = () => { hideModal(); cleanup(); resolve(false); };

                    const cleanup = () => {
                        pauseBtn.removeEventListener('click', onPause);
                        cancelBtn.removeEventListener('click', onCancel);
                    };

                    pauseBtn.addEventListener('click', onPause);
                    cancelBtn.addEventListener('click', onCancel);
                });

                if (action) {
                    // User wants to pause and exit.
                    // IDB already has the latest answers and IN_PROGRESS status from handleOptionClick.
                    isExamInProgress = false;

                    // Show Mentor Icon
                    const mentorWidget = document.getElementById('study-mentor-widget');
                    if (mentorWidget) mentorWidget.classList.remove('hidden');

                    window.loadPage = originalLoadPage;
                    if (setupExitPrevention._popStateCleanup) setupExitPrevention._popStateCleanup();
                    if (setupExitPrevention._visibilityCleanup) setupExitPrevention._visibilityCleanup();
                    return originalLoadPage(page, params);
                }
                // User cancelled navigation.
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
        const timerMobileEl = document.getElementById('timer-mobile');

        timerInterval = setInterval(() => {
            const minutes = Math.floor(timer / 60);
            const seconds = timer % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timerEl) timerEl.textContent = timeStr;
            if (timerMobileEl) timerMobileEl.textContent = timeStr;

            // Increment time for active question
            if (activeQuestionId) {
                timeSpentPerQuestion[activeQuestionId] = (timeSpentPerQuestion[activeQuestionId] || 0) + 1;
            }

            if (--timer < 0) {

                clearInterval(timerInterval);
                submitExam(true); // Explicitly pass true for auto-submit
            }
        }, 1000);
    }

    function handleOptionClick(e) {
        const btn = e.target.closest('.option-btn');
        if (!btn || btn.disabled) return;

        const questionId = btn.dataset.questionId;
        const optionKey = btn.dataset.optionKey;
        userAnswers[questionId] = optionKey;

        // Auto-save answers to IDB for resume support
        if (typeof idbManager !== 'undefined' && examId) {
            console.log('[ExamInterface] Saving attempt to IDB:', {
                id: ATTEMPT_IDB_KEY, exam_id: examId, answers: userAnswers
            });
            idbManager.saveAttempt({
                id: ATTEMPT_IDB_KEY,
                exam_id: parseInt(examId),
                answers: { ...userAnswers },
                status: 'IN_PROGRESS',
                last_saved: new Date().toISOString()
            }).then(() => console.log('[ExamInterface] Saved successfully'))
                .catch(err => console.error('[ExamInterface] Save failed:', err));
        }

        const parent = btn.parentElement;
        parent.querySelectorAll('.option-btn').forEach(b => {
            b.disabled = true;
            b.classList.remove('bg-blue-50', 'border-blue-500', 'shadow-sm');
            b.classList.add('bg-gray-50', 'text-gray-400', 'opacity-60', 'border-gray-100');
            b.setAttribute('aria-checked', 'false');
            b.querySelector('span').classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            b.querySelector('span').classList.add('bg-gray-100', 'text-gray-300', 'border-gray-200');
        });

        btn.classList.remove('bg-gray-50', 'text-gray-400', 'opacity-60', 'border-gray-100');
        btn.classList.add('bg-blue-50', 'border-blue-500', 'shadow-sm');
        btn.setAttribute('aria-checked', 'true');
        btn.querySelector('span').classList.remove('bg-gray-100', 'text-gray-300', 'border-gray-200');
        btn.querySelector('span').classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        
        saveStateToServer(); // Trigger sync
        updateNavigator();
    }

    function toggleFlag(e) {
        const btn = e.target.closest('.flag-btn');
        if (!btn) return;
        const qId = String(btn.dataset.questionId);
        if (flaggedQuestions.has(qId)) {
            flaggedQuestions.delete(qId);
            btn.classList.remove('text-yellow-500');
            btn.classList.add('text-gray-400');
        } else {
            flaggedQuestions.add(qId);
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-yellow-500');
        }
        saveStateToServer(); // Trigger sync
        updateNavigator();
    }

    function updateNavigator() {
        const navContainer = document.getElementById('question-navigator-grid');
        if (!navContainer || !examData.questions) return;

        navContainer.innerHTML = '';
        examData.questions.forEach((q, idx) => {
            const qId = String(q.id);
            const isAnswered = !!userAnswers[qId];
            const isFlagged = flaggedQuestions.has(qId);

            // Apply filters
            if (currentNavFilter === 'unanswered' && isAnswered) return;
            if (currentNavFilter === 'flagged' && !isFlagged) return;

            let bgColor = 'bg-white border-gray-300 text-gray-600';
            if (isAnswered) bgColor = 'bg-green-500 border-green-600 text-white';
            if (isFlagged) bgColor = 'bg-yellow-500 border-yellow-600 text-white';

            const btn = document.createElement('button');
            btn.className = `w-full aspect-square flex items-center justify-center rounded-lg md:rounded-xl border-2 text-[10px] md:text-sm font-black transition-all hover:scale-105 active:scale-95 animate-in zoom-in duration-300 ${bgColor}`;
            btn.title = `Question ${idx + 1}`;
            btn.innerText = idx + 1;
            btn.addEventListener('click', () => {
                scrollToQuestion(q.id);
                // Auto-close on mobile
                if (window.innerWidth < 768) {
                    toggleNavigator(false);
                }
            });
            navContainer.appendChild(btn);
        });

        // If no questions match the filter, show a message
        if (navContainer.children.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'col-span-full py-8 text-center text-gray-400 text-[10px] font-medium animate-in fade-in duration-500';
            msg.innerHTML = `No questions match this filter`;
            navContainer.appendChild(msg);
        }
    }

    function setupNavigatorFilters() {
        const filterBtns = document.querySelectorAll('.nav-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentNavFilter = btn.dataset.filter;
                
                // Update button styles
                filterBtns.forEach(b => {
                    b.classList.remove('bg-white', 'shadow-sm', 'text-indigo-600', 'border', 'border-indigo-100');
                    b.classList.add('text-gray-500', 'hover:bg-white/50');
                });
                
                btn.classList.add('bg-white', 'shadow-sm', 'text-indigo-600', 'border', 'border-indigo-100');
                btn.classList.remove('text-gray-500', 'hover:bg-white/50');
                
                updateNavigator();
            });
        });
    }

    function toggleNavigator(show) {
        const navSidebar = document.getElementById('navigator-sidebar');
        const navOverlay = document.getElementById('nav-overlay');
        if (!navSidebar) return;

        if (show) {
            navSidebar.classList.remove('-translate-y-full');
            navSidebar.classList.add('translate-y-0');
            if (navOverlay) navOverlay.classList.remove('hidden');
        } else {
            navSidebar.classList.add('-translate-y-full');
            navSidebar.classList.remove('translate-y-0');
            if (navOverlay) navOverlay.classList.add('hidden');
        }
    }

    function scrollToQuestion(id) {
        if (!id) return;
        const el = document.getElementById(`question-${id}`);
        const mainContent = document.getElementById('main-content');
        if (!el || !mainContent) return;

        const navSidebar = document.getElementById('navigator-sidebar');
        if (navSidebar && window.innerWidth < 768) {
            toggleNavigator(false);
        }

        const delay = window.innerWidth < 768 ? 200 : 0;
        setTimeout(() => {
            // Manual calculation of scroll position relative to the scroll container
            const containerRect = mainContent.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Calculate where el is relative to mainContent's current scroll
            const scrollTarget = (elRect.top - containerRect.top) + mainContent.scrollTop - 20;

            mainContent.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
            });
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

            // Hide mobile bottom bar to prevent overlap
            const mobileBottomBar = document.getElementById('mobile-bottom-bar');
            if (mobileBottomBar) mobileBottomBar.classList.add('hidden');
        }
    }

    // Removed emergencySubmit as it forces auto-submission on tab close, breaking the pause/resume flow.

    function calculatePerformance() {
        let right = 0, wrong = 0, unanswered = 0;
        let mistakes = [];
        let correct_ids = [];

        examData.questions.forEach(q => {
            if (!userAnswers[q.id]) {
                unanswered++;
            } else if (userAnswers[q.id] === q.answer) {
                right++;
                correct_ids.push(q.id);
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
        const timerEl = document.getElementById('timer') || document.getElementById('timer-mobile');
        const timeLeft = timerEl ? timerEl.textContent.split(':') : ['0', '0'];
        const timeLeftSeconds = (parseInt(timeLeft[0]) || 0) * 60 + (parseInt(timeLeft[1]) || 0);

        return {
            selected_answers: userAnswers,
            score,
            score_with_negative: score - (wrong * 0.5),
            right_answers: right,
            wrong_answers: wrong,
            unanswered,
            mistakes,
            correct_ids,
            time_per_question: timeSpentPerQuestion,
            time_used_seconds: (examData.details.duration * 60) - timeLeftSeconds,
            time_left_seconds: timeLeftSeconds
        };

    }

    function showSubmissionConfirmation(unansweredCount) {
        let modal = document.getElementById('submission-confirm-modal');
        if (!modal) {
            const modalHTML = `
                <div id="submission-confirm-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 hidden items-center justify-center z-[200] p-4 backdrop-blur-sm opacity-0 transition-opacity duration-300">
                    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden transform scale-95 transition-transform duration-300">
                        <div id="sub-modal-header" class="p-6 text-center relative overflow-hidden">
                            <div class="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-white opacity-10"></div>
                            <div class="absolute bottom-0 left-0 -ml-8 -mb-8 w-16 h-16 rounded-full bg-white opacity-10"></div>
                            <span id="sub-modal-icon" class="material-symbols-outlined text-6xl text-white mb-2 relative z-10 animate-bounce-slow">help</span>
                            <h3 class="text-2xl font-black text-white relative z-10 tracking-tight">Finish Exam?</h3>
                        </div>
                        <div class="p-8 text-center">
                            <p id="sub-modal-message" class="text-gray-600 mb-8 font-medium leading-relaxed"></p>
                            <div class="flex flex-col gap-4">
                                <button id="sub-confirm-btn" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-3">
                                    <span class="material-symbols-outlined">check_circle</span> Yes, Submit Now
                                </button>
                                <button id="sub-cancel-btn" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-2xl transition-all active:scale-95">
                                    Wait, Let me check
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('submission-confirm-modal');
        }

        const header = document.getElementById('sub-modal-header');
        const icon = document.getElementById('sub-modal-icon');
        const message = document.getElementById('sub-modal-message');
        const confirmBtn = document.getElementById('sub-confirm-btn');
        const cancelBtn = document.getElementById('sub-cancel-btn');

        if (unansweredCount > 0) {
            header.className = 'bg-gradient-to-br from-amber-400 to-orange-500 p-8 text-center relative overflow-hidden';
            icon.textContent = 'warning';
            message.innerHTML = `You still have <span class="text-orange-600 font-black text-xl">${unansweredCount}</span> questions <span class="text-orange-600 underline decoration-2 underline-offset-4">unanswered</span>.<br><span class="text-sm text-gray-400 mt-2 block">Are you sure you want to finish?</span>`;
        } else {
            header.className = 'bg-gradient-to-br from-indigo-500 to-blue-600 p-8 text-center relative overflow-hidden';
            icon.textContent = 'verified';
            message.innerHTML = `All set! You've answered all questions.<br><span class="text-sm text-gray-400 mt-2 block">Ready to see your results?</span>`;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.children[0].classList.remove('scale-95');
        }, 10);

        const hideModal = () => {
            modal.classList.add('opacity-0');
            modal.children[0].classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
        };

        // Important: Use named functions to allow clean removal
        const onConfirm = () => { hideModal(); cleanup(); submitExam(false, true); };
        const onCancel = () => { hideModal(); cleanup(); };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };

        confirmBtn.onclick = onConfirm; // Using onclick to ensure single listener
        cancelBtn.onclick = onCancel;
    }

    async function submitExam(isAutoSubmit = false, isConfirmed = false) {
        // Handle event objects or explicit booleans
        const auto = isAutoSubmit === true;
        
        if (!isExamInProgress && !auto) return;

        // Show confirmation for manual clicks that aren't already confirmed
        if (!auto && !isConfirmed) {
            const performance = calculatePerformance();
            showSubmissionConfirmation(performance.unanswered);
            return;
        }

        clearInterval(timerInterval);
        isExamInProgress = false;
        window.onbeforeunload = null;
        window.loadPage = originalLoadPage;
        if (setupExitPrevention._popStateCleanup) setupExitPrevention._popStateCleanup();
        if (setupExitPrevention._visibilityCleanup) setupExitPrevention._visibilityCleanup();

        if (submitExamBtn) {
            submitExamBtn.disabled = true;
            submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2 animate-spin">autorenew</span>Submitting...`;
        }
        if (submitExamBtnMobile) {
            submitExamBtnMobile.disabled = true;
            submitExamBtnMobile.textContent = `Submitting...`;
        }

        const performance = calculatePerformance();

        // Restore Mentor Icon
        const mentorWidget = document.getElementById('study-mentor-widget');
        if (mentorWidget) mentorWidget.classList.remove('hidden');

        // Clear IN_PROGRESS marker from IndexedDB
        if (typeof idbManager !== 'undefined' && examId) {
            idbManager.saveAttempt({
                id: ATTEMPT_IDB_KEY,
                exam_id: parseInt(examId),
                answers: userAnswers,
                status: 'COMPLETED',
                last_saved: new Date().toISOString()
            }).catch(() => { });
        }

        // Notify Server about COMPLETED session (Cross-Device)
        fetch(`${API_URL}active-session.php?action=complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exam_id: examId })
        }).catch(() => { });

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

                // Clear dashboard cache to ensure updated stats
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                }

                // --- NEW: Record activity for Streak ---
                if (typeof streakManager !== 'undefined') {
                    streakManager.recordActivity();
                }

                // --- NEW: Sync mistakes to Mistake Bank ---
                if (performance.mistakes && performance.mistakes.length > 0) {
                    try {
                        await fetch('api/mistakes/add.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                exam_id: examId,
                                is_custom: 0,
                                is_offline: 0,
                                questions: performance.mistakes
                            })
                        });
                        console.log("Mistakes recorded in bank.");
                    } catch (mistakeErr) {
                        console.error("Failed to sync mistakes:", mistakeErr);
                    }
                }

                // --- NEW: Resolve mistakes from Bank ---
                if (performance.correct_ids && performance.correct_ids.length > 0) {
                    try {
                        await fetch('api/mistakes/resolve.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                questions: performance.correct_ids
                            })
                        });
                        console.log("Correct answers resolved in bank.");
                    } catch (resolveErr) {
                        console.error("Failed to resolve mistakes:", resolveErr);
                    }
                }
            } else showToast(result.message || 'Submission failed.', 'error');
        } catch (e) { showToast('A network error occurred.', 'error'); }
        finally {
            if (submitExamBtn) {
                submitExamBtn.disabled = false;
                submitExamBtn.innerHTML = `<span class="material-symbols-outlined mr-2">check_circle</span>Submit Exam`;
            }
            if (submitExamBtnMobile) {
                submitExamBtnMobile.disabled = false;
                submitExamBtnMobile.textContent = `Submit`;
            }
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
            
            const toggleBtn = e.target.closest('.toggle-insights-btn');
            if (toggleBtn) {
                const qId = toggleBtn.dataset.questionId;
                const insightsDiv = document.getElementById(`insights-${qId}`);
                if (insightsDiv) {
                    const isHidden = insightsDiv.classList.toggle('hidden');
                    toggleBtn.classList.toggle('bg-indigo-50', isHidden);
                    toggleBtn.classList.toggle('bg-indigo-600', !isHidden);
                    toggleBtn.classList.toggle('text-indigo-500', isHidden);
                    toggleBtn.classList.toggle('text-white', !isHidden);
                }
            }

        });

    }
    if (submitExamBtn) submitExamBtn.addEventListener('click', () => submitExam(false));
    if (submitExamBtnMobile) submitExamBtnMobile.addEventListener('click', () => submitExam(false));
    const mobileNavTrigger = document.getElementById('mobile-nav-trigger');
    const closeNavBtn = document.getElementById('close-nav-btn');
    const navOverlay = document.getElementById('nav-overlay');
    const navSidebar = document.getElementById('navigator-sidebar');

    if (mobileNavTrigger) {
        mobileNavTrigger.addEventListener('click', () => toggleNavigator(true));
    }
    if (closeNavBtn) {
        closeNavBtn.addEventListener('click', () => toggleNavigator(false));
    }
    if (navOverlay) {
        navOverlay.addEventListener('click', () => toggleNavigator(false));
    }

    async function loadExam() {
        if (!examId) return;
        try {
            console.log(`[ExamInterface] Starting load for exam ${examId}, IDB key: ${ATTEMPT_IDB_KEY}`);
            // Restore saved answers if resuming
            if (typeof idbManager !== 'undefined') {
                const saved = await idbManager.getAttempt(ATTEMPT_IDB_KEY);
                console.log('[ExamInterface] Found IDB record:', saved);
                if (saved && saved.status === 'IN_PROGRESS' && saved.answers) {
                    userAnswers = { ...saved.answers };
                    console.log('[ExamInterface] Restored userAnswers:', userAnswers);
                }
            } else {
                console.warn('[ExamInterface] idbManager is undefined!');
            }

            const response = await fetch(`${API_URL}start.php${window.location.search}`);
            const result = await response.json();
            
            if (result.success) {
                // Check Server for active session state
                const sessionRes = await fetch(`${API_URL}active-session.php?action=check`);
                const sessionData = await sessionRes.json();
                
                if (sessionData.success && sessionData.session && sessionData.session.exam_id == examId) {
                    window.serverSessionId = sessionData.session.id;
                    const serverState = sessionData.session.current_state;
                    
                    if (serverState) {
                        console.log('[ExamInterface] Found server state:', serverState);
                        // Merge server state with local state (Server is source of truth for cross-device)
                        if (serverState.answers) {
                            // Ensure all answer keys are strings
                            Object.keys(serverState.answers).forEach(k => {
                                userAnswers[String(k)] = serverState.answers[k];
                            });
                        }
                        if (serverState.flagged) {
                            // Ensure all flagged items are strings
                            flaggedQuestions = new Set(serverState.flagged.map(id => String(id)));
                        }
                        // Note: We don't necessarily sync the timer back yet to avoid confusion, 
                        // but we could if we wanted total parity.
                    }
                }
                
                renderExam(result.data);
            }
            else showToast(result.message, 'error');
        } catch (e) { showToast('Failed to load exam details.', 'error'); }
    }

    async function verifySessionStatus() {
        if (!window.serverSessionId || !isExamInProgress) return;

        try {
            const response = await fetch(`${API_URL}active-session.php?action=check`);
            const result = await response.json();

            // If no active session found or the ID doesn't match ours, then we are synced out
            if (!result.session || result.session.id != window.serverSessionId) {
                handleSessionSyncConflict();
            }
        } catch (error) {
            console.error('Session sync check failed:', error);
        }
    }

    function handleSessionSyncConflict() {
        isExamInProgress = false;
        clearInterval(timerInterval);
        if (window.syncInterval) clearInterval(window.syncInterval);

        // Show overlay
        const overlay = document.createElement('div');
        overlay.id = 'session-sync-overlay';
        overlay.className = 'fixed inset-0 bg-gray-900/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300';
        overlay.innerHTML = `
            <div class="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-100">
                <div class="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span class="material-symbols-outlined text-amber-500 text-4xl">sync_disabled</span>
                </div>
                <h3 class="text-2xl font-bold text-gray-900 mb-2">Session Terminated</h3>
                <p class="text-gray-600 mb-8 leading-relaxed">
                    This exam has been submitted, cancelled, or resumed on another device. This session is no longer active.
                </p>
                <button id="sync-go-back-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-200">
                    Go Back to Exam List
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('sync-go-back-btn').addEventListener('click', () => {
            window.onbeforeunload = null;
            overlay.remove();
            if (window.loadPage) window.loadPage('take-exam-list');
            else window.location.reload();
        });
    }

    function startSyncMonitoring() {
        // Check periodically
        if (window.syncInterval) clearInterval(window.syncInterval);
        window.syncInterval = setInterval(verifySessionStatus, 20000); // Every 20 seconds

        // Check on visibility change (when tab becomes active)
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isExamInProgress) {
                verifySessionStatus();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
    }

    async function saveStateToServer() {
        if (!isExamInProgress || !window.serverSessionId) return;

        const currentState = {
            answers: userAnswers,
            flagged: Array.from(flaggedQuestions),
            timestamp: Date.now()
        };

        // Don't save if nothing changed
        const stateStr = JSON.stringify(currentState);
        if (stateStr === lastSyncedState) return;

        setSyncIndicator('saving');

        try {
            const response = await fetch(`${API_URL}active-session.php?action=save_state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: examId,
                    state: currentState
                })
            });
            const result = await response.json();
            if (result.success) {
                lastSyncedState = stateStr;
                setSyncIndicator('synced');
            } else {
                setSyncIndicator('error');
            }
        } catch (error) {
            setSyncIndicator('error');
        }
    }

    function startStateSync() {
        // Initial state
        lastSyncedState = JSON.stringify({
            answers: userAnswers,
            flagged: Array.from(flaggedQuestions),
            timestamp: Date.now()
        });

        // Periodic sync every 25 seconds
        if (window.stateSyncInterval) clearInterval(window.stateSyncInterval);
        window.stateSyncInterval = setInterval(saveStateToServer, 25000);

        // Also save on answering
        const originalHandleOptionClick = window.handleOptionClick; // Wait, handleOptionClick is not global
    }

    function setSyncIndicator(status) {
        const indicators = [
            document.getElementById('cloud-sync-indicator'),
            document.getElementById('cloud-sync-indicator-mobile')
        ];

        indicators.forEach(el => {
            if (!el) return;
            const icon = el.querySelector('.material-symbols-outlined');
            const text = el.querySelector('span:not(.material-symbols-outlined)');

            el.classList.remove('text-indigo-600', 'text-gray-300', 'text-amber-500', 'text-red-500', 'animate-pulse');
            
            switch(status) {
                case 'saving':
                    el.classList.add('text-amber-500', 'animate-pulse');
                    icon.textContent = 'cloud_upload';
                    if (text) text.textContent = 'Syncing...';
                    break;
                case 'synced':
                    el.classList.add('text-indigo-600');
                    el.style.opacity = '1';
                    icon.textContent = 'cloud_done';
                    if (text) text.textContent = 'Synced';
                    setTimeout(() => { if (el) el.style.opacity = '0.5'; }, 2000);
                    break;
                case 'error':
                    el.classList.add('text-red-500');
                    icon.textContent = 'cloud_off';
                    if (text) text.textContent = 'Sync Error';
                    break;
                default:
                    el.classList.add('text-gray-300');
                    icon.textContent = 'cloud_queue';
                    if (text) text.textContent = 'Idle';
            }
        });
    }

    loadExam();
}

initializeTakeExamInterface();
