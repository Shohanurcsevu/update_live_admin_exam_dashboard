// function initializePerformanceReviewPage() {
//     const API_URL = 'api/performance/attempt-details.php';
//     const params = new URLSearchParams(window.location.search);
//     const attemptId = params.get('attempt_id');

//     const bengaliNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
//     const toBengali = (num) => num.toString().split('').map(digit => bengaliNumbers[digit]).join('');
//     const optionLabels = { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' };

//     function renderReview(data) {
//         const { performance, exam, questions } = data;

//         // Populate Header
//         document.getElementById('review-exam-title').textContent = exam.exam_title;
//         document.getElementById('review-breadcrumb').textContent = `${exam.subject_name || 'N/A'} > ${exam.lesson_name || 'N/A'} > ${exam.topic_name || 'N/A'}`.replace(/ > N\/A/g, '');

//         // Populate Summary Cards
//         document.getElementById('review-final-score').textContent = parseFloat(performance.score_with_negative).toFixed(2);
//         document.getElementById('review-correct').textContent = performance.right_answers;
//         document.getElementById('review-wrong').textContent = performance.wrong_answers;
//         document.getElementById('review-unanswered').textContent = performance.unanswered;
//         document.getElementById('review-time-used').textContent = new Date(performance.time_used_seconds * 1000).toISOString().substr(14, 5);

//         // Populate Questions
//         const container = document.getElementById('review-questions-container');
//         container.innerHTML = '';
//         const userAnswers = JSON.parse(performance.selected_answers);

//         questions.forEach((q, index) => {
//             const userAnswer = userAnswers[q.id] || null;
//             const isCorrect = userAnswer === q.answer;
//             const isWrong = userAnswer !== null && !isCorrect;
//             const correctOptionKey = q.answer;

//             let statusBadgeHTML = '';
//             if (isCorrect) {
//                 statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-green-800 bg-green-100 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">check_circle</span> Correct Answer</div>`;
//             } else if (isWrong) {
//                 statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-red-800 bg-red-100 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">cancel</span> Wrong Answer</div>`;
//             } else {
//                 statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">help</span> Unanswered</div>`;
//             }

//             // --- MODIFIED: Added explanationHTML block ---
//             let explanationHTML = '';
//             if (q.explanation) {
//                 explanationHTML = `
//                     <div class="mt-4 pt-3 border-t border-gray-200">
//                         <p class="text-sm font-semibold text-gray-700">Explanation:</p>
//                         <p class="text-sm text-gray-600">${q.explanation}</p>
//                     </div>
//                 `;
//             }

//             let questionCardHTML = `
//                 <div class="border rounded-lg p-4 bg-gray-50">
//                     <div class="flex justify-between items-start mb-4">
//                         <p class="text-gray-800 font-semibold pr-4">${toBengali(index + 1)}. ${q.question}</p>
//                         <div class="flex-shrink-0">
//                             ${statusBadgeHTML}
//                         </div>
//                     </div>
//                     <div class="space-y-2 text-sm">
//             `;

//             const sortedOptions = Object.entries(JSON.parse(q.options)).sort((a, b) => a[0].localeCompare(b[0]));

//             sortedOptions.forEach(([key, value]) => {
//                 let classes = 'flex items-center p-3 rounded-lg border';
//                 let icon = '';

//                 if (key === userAnswer) {
//                     if(isCorrect) {
//                         classes += ' bg-green-100 border-green-400 font-bold';
//                         icon = '<span class="material-symbols-outlined text-green-600 mr-2">check_circle</span>';
//                     } else { 
//                         classes += ' bg-red-100 border-red-400 font-bold';
//                         icon = '<span class="material-symbols-outlined text-red-600 mr-2">cancel</span>';
//                     }
//                 } 
//                 else if (key === correctOptionKey) {
//                     classes += ' bg-green-50 border-green-300';
//                     icon = '<span class="material-symbols-outlined text-green-600 mr-2">check_circle</span>';
//                 } 
//                 else {
//                     classes += ' bg-white';
//                 }

//                 questionCardHTML += `<div class="${classes}">${icon}<strong>${optionLabels[key]}.</strong><span class="ml-2">${value}</span></div>`;
//             });

//             // --- MODIFIED: Appended the explanation HTML ---
//             questionCardHTML += `</div>${explanationHTML}</div>`;
//             container.innerHTML += questionCardHTML;
//         });
//     }

//     async function loadAttemptDetails() {
//         if (!attemptId) return;
//         try {
//             const response = await fetch(`${API_URL}?attempt_id=${attemptId}`);
//             const result = await response.json();
//             if (result.success) {
//                 renderReview(result.data);
//             } else {
//                 document.getElementById('review-questions-container').innerHTML = `<p class="text-red-500 text-center">${result.message}</p>`;
//             }
//         } catch (error) { console.error('Fetch Details Error:', error); }
//     }

//     document.getElementById('back-to-performance-btn').addEventListener('click', () => {
//         if(window.loadPage) window.loadPage('check-performance');
//     });

//     loadAttemptDetails();
// }
// initializePerformanceReviewPage();
function initializePerformanceReviewPage() {
    const API_URL = 'api/performance/attempt-details.php';
    const params = new URLSearchParams(window.location.search);
    const attemptId = params.get('attempt_id');

    // --- NEW: Get reference to the filter buttons container ---
    const reviewFilterButtons = document.getElementById('review-filter-buttons');

    const bengaliNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const toBengali = (num) => num.toString().split('').map(digit => bengaliNumbers[digit]).join('');
    const optionLabels = { 'A': 'ক', 'B': 'খ', 'C': 'গ', 'D': 'ঘ' };

    // --- NEW: Function to apply filters to the question cards ---
    function applyFilter(filter) {
        const questionCards = document.querySelectorAll('.question-card');
        let visibleCount = 0;

        questionCards.forEach(card => {
            const status = card.dataset.status;
            let show = false;
            switch (filter) {
                case 'all':
                    show = true;
                    break;
                case 'correct':
                    show = status === 'correct';
                    break;
                case 'wrong':
                    show = status === 'wrong';
                    break;
                case 'unanswered':
                    show = status === 'unanswered';
                    break;
                case 'attempted':
                    show = status === 'correct' || status === 'wrong';
                    break;
            }
            card.style.display = show ? 'block' : 'none';
            if (show) visibleCount++;
        });

        // Optional: Show a message if no questions match the filter
        const noResultsMessage = document.getElementById('no-results-message');
        if (visibleCount === 0) {
            if (!noResultsMessage) {
                const messageDiv = document.createElement('div');
                messageDiv.id = 'no-results-message';
                messageDiv.className = 'text-center text-gray-500 py-8';
                messageDiv.textContent = 'No questions match the selected filter.';
                document.getElementById('review-questions-container').appendChild(messageDiv);
            }
        } else {
            if (noResultsMessage) noResultsMessage.remove();
        }
    }

    function renderReview(data) {
        const { performance, exam, questions } = data;

        document.getElementById('review-exam-title').textContent = exam.exam_title;
        document.getElementById('review-breadcrumb').textContent = `${exam.subject_name || 'N/A'} > ${exam.lesson_name || 'N/A'} > ${exam.topic_name || 'N/A'}`.replace(/ > N\/A/g, '');
        document.getElementById('review-final-score').textContent = parseFloat(performance.score_with_negative).toFixed(2);
        document.getElementById('review-correct').textContent = performance.right_answers;
        document.getElementById('review-wrong').textContent = performance.wrong_answers;
        document.getElementById('review-unanswered').textContent = performance.unanswered;

        const timeUsed = performance.time_used_seconds || performance.duration_used || 0;
        document.getElementById('review-time-used').textContent = new Date(timeUsed * 1000).toISOString().substr(14, 5);

        const container = document.getElementById('review-questions-container');
        container.innerHTML = '';
        const userAnswers = (typeof performance.selected_answers === 'string') ? JSON.parse(performance.selected_answers) : (performance.selected_answers || {});

        questions.forEach((q, index) => {
            const userAnswer = userAnswers[q.id] || null;
            const isCorrect = userAnswer === q.answer;
            const isWrong = userAnswer !== null && !isCorrect;
            const correctOptionKey = q.answer;
            const status = isCorrect ? 'correct' : (isWrong ? 'wrong' : 'unanswered');

            let statusBadgeHTML = '';
            if (isCorrect) {
                statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-green-800 bg-green-100 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">check_circle</span> Correct Answer</div>`;
            } else if (isWrong) {
                statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-red-800 bg-red-100 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">cancel</span> Wrong Answer</div>`;
            } else {
                statusBadgeHTML = `<div class="flex items-center text-xs font-bold text-gray-700 bg-gray-200 px-3 py-1 rounded-full"><span class="material-symbols-outlined text-base mr-1">help</span> Unanswered</div>`;
            }

            let explanationHTML = '';
            if (q.explanation) {
                explanationHTML = `<div class="mt-4 pt-3 border-t border-gray-200"><p class="text-sm font-semibold text-gray-700">Explanation:</p><p class="text-sm text-gray-600">${q.explanation}</p></div>`;
            }

            // --- MODIFIED: Added data-status attribute to the card ---
            let questionCardHTML = `
                <div class="border rounded-lg p-4 bg-gray-50 question-card" data-status="${status}">
                    <div class="flex justify-between items-start mb-4">
                        <p class="text-gray-800 font-semibold pr-4">${toBengali(index + 1)}. ${q.question}</p>
                        <div class="flex-shrink-0">${statusBadgeHTML}</div>
                    </div>
                    <div class="space-y-2 text-sm">
            `;
            const optionsObj = (typeof q.options === 'string') ? JSON.parse(q.options) : (q.options || {});
            const sortedOptions = Object.entries(optionsObj).sort((a, b) => a[0].localeCompare(b[0]));

            sortedOptions.forEach(([key, value]) => {
                let classes = 'flex items-center p-3 rounded-lg border';
                let icon = '';
                if (key === userAnswer) {
                    if (isCorrect) { classes += ' bg-green-100 border-green-400 font-bold'; icon = '<span class="material-symbols-outlined text-green-600 mr-2">check_circle</span>'; }
                    else { classes += ' bg-red-100 border-red-400 font-bold'; icon = '<span class="material-symbols-outlined text-red-600 mr-2">cancel</span>'; }
                }
                else if (key === correctOptionKey) { classes += ' bg-green-50 border-green-300'; icon = '<span class="material-symbols-outlined text-green-600 mr-2">check_circle</span>'; }
                else { classes += ' bg-white'; }
                questionCardHTML += `<div class="${classes}">${icon}<strong>${optionLabels[key]}.</strong><span class="ml-2">${value}</span></div>`;
            });

            questionCardHTML += `</div>${explanationHTML}</div>`;
            container.innerHTML += questionCardHTML;
        });
    }

    async function loadAttemptDetails() {
        if (!attemptId) return;

        // Check if it's a local attempt (UUID v4 format usually has hyphens)
        const isLocalAttempt = attemptId.includes('-');

        if (isLocalAttempt) {
            try {
                await idbManager.init();
                const attempt = await idbManager.getAttempt(attemptId);
                const exams = await idbManager.getAll('exams');
                const exam = exams.find(e => e.id == attempt.exam_id);
                const questions = await idbManager.getQuestionsByExam(attempt.exam_id);

                if (attempt && exam && questions) {
                    // Fetch nested names for breadcrumb
                    const subject = await idbManager.getById('subjects', exam.subject_id);
                    const lesson = await idbManager.getById('lessons', exam.lesson_id);
                    const topic = await idbManager.getById('topics', exam.topic_id);

                    renderReview({
                        performance: {
                            ...attempt,
                            time_used_seconds: attempt.duration_used || 0,
                            right_answers: attempt.right_answers || 0,
                            wrong_answers: attempt.wrong_answers || 0,
                            unanswered: attempt.unanswered || 0,
                            selected_answers: JSON.stringify(attempt.answers)
                        },
                        exam: {
                            ...exam,
                            subject_name: subject?.subject_name,
                            lesson_name: lesson?.lesson_name,
                            topic_name: topic?.topic_name
                        },
                        questions: questions
                    });
                } else {
                    throw new Error('Local attempt data incomplete');
                }
            } catch (error) {
                console.error('Offline Fetch Error:', error);
                document.getElementById('review-questions-container').innerHTML = `<p class="text-red-500 text-center">Failed to load local attempt data.</p>`;
            }
            return;
        }

        try {
            const response = await fetch(`${API_URL}?attempt_id=${attemptId}`);
            const result = await response.json();
            if (result.success) {
                renderReview(result.data);
            } else {
                document.getElementById('review-questions-container').innerHTML = `<p class="text-red-500 text-center">${result.message}</p>`;
            }
        } catch (error) {
            console.error('Fetch Details Error:', error);
            // Fallback to local if fetch fails (maybe it was synced but we're offline now)
            try {
                await idbManager.init();
                const attempt = await idbManager.getAttempt(attemptId);
                if (attempt) {
                    const exams = await idbManager.getAll('exams');
                    const exam = exams.find(e => e.id == attempt.exam_id);
                    const questions = await idbManager.getQuestionsByExam(attempt.exam_id);
                    renderReview({
                        performance: { ...attempt, selected_answers: JSON.stringify(attempt.answers) },
                        exam, questions
                    });
                }
            } catch (e) { }
        }
    }

    document.getElementById('back-to-performance-btn').addEventListener('click', () => {
        if (window.loadPage) window.loadPage('check-performance');
    });

    // --- NEW: Event listener for the filter buttons ---
    if (reviewFilterButtons) {
        reviewFilterButtons.addEventListener('click', (e) => {
            const button = e.target.closest('.filter-btn');
            if (!button) return;

            // Update active button style
            reviewFilterButtons.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100');
            });
            button.classList.add('bg-blue-600', 'text-white', 'shadow');
            button.classList.remove('bg-white', 'text-gray-700', 'hover:bg-gray-100');

            const filter = button.dataset.filter;
            applyFilter(filter);
        });
    }

    loadAttemptDetails();
}

initializePerformanceReviewPage();
