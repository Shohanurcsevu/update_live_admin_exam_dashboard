(function () {
    const subjectFilter = document.getElementById('offline-subject-filter');
    const lessonFilter = document.getElementById('offline-lesson-filter');
    const topicFilter = document.getElementById('offline-topic-filter');
    const cardsContainer = document.getElementById('offline-cards-container');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    const lastSyncSpan = document.getElementById('last-sync-time');
    const statusDiv = document.getElementById('online-status');

    if (!subjectFilter || !cardsContainer) return; // Guard for non-offline-exams page

    /**
     * Update Online/Offline Status Indicator
     */
    function updateStatusIndicator() {
        if (!statusDiv) return;
        const isOnline = navigator.onLine;
        statusDiv.innerHTML = `
            <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}"></span>
            ${isOnline ? 'Online' : 'Offline'}
        `;
        statusDiv.className = `flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        if (manualSyncBtn) manualSyncBtn.disabled = !isOnline;
    }

    /**
     * Render Exams and Attempts from IndexedDB
     */
    /**
     * Render Exams and Attempts from IndexedDB
     */
    async function renderExams() {
        const attemptsSection = document.getElementById('attempts-section');
        const attemptsContainer = document.getElementById('attempts-container');

        if (cardsContainer) {
            cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-gray-500">Loading local data...</div>';
        }

        try {
            await idbManager.init();

            // 1. Fetch and Render Attempts
            const allAttempts = await idbManager.getAll('offline_attempts');
            const exams = await idbManager.getAll('exams');

            if (allAttempts.length > 0 && attemptsSection && attemptsContainer) {
                attemptsSection.classList.remove('hidden');
                // Sort by last_saved or end_time descending
                allAttempts.sort((a, b) => {
                    const timeA = new Date(a.last_saved || a.end_time || 0);
                    const timeB = new Date(b.last_saved || b.end_time || 0);
                    return timeB - timeA;
                });

                attemptsContainer.innerHTML = allAttempts.map(attempt => {
                    const exam = exams.find(e => e.id == attempt.exam_id) || { exam_title: attempt.exam_title || 'Unknown Exam' };
                    let statusColor, statusLabel, actionBtn;

                    switch (attempt.status) {
                        case 'IN_PROGRESS':
                            statusColor = 'bg-orange-100 text-orange-700';
                            statusLabel = 'In Progress';
                            actionBtn = `<button onclick="window.resumeOfflineAttempt('${attempt.id}', ${attempt.exam_id})" class="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg transition-colors">Resume</button>`;
                            break;
                        case 'COMPLETED':
                            statusColor = 'bg-blue-100 text-blue-700';
                            statusLabel = 'Completed (Pending Sync)';
                            actionBtn = `<button onclick="window.reviewOfflineAttempt('${attempt.id}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">Review</button>`;
                            break;
                        case 'SYNCED':
                            statusColor = 'bg-green-100 text-green-700';
                            statusLabel = 'Synced';
                            actionBtn = `<button onclick="window.reviewOfflineAttempt('${attempt.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors">Review</button>`;
                            break;
                        default:
                            statusColor = 'bg-gray-100 text-gray-700';
                            statusLabel = attempt.status;
                            actionBtn = '';
                    }

                    return `
                        <div class="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-400 hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-start mb-4">
                                <span class="px-2 py-1 ${statusColor} text-[10px] font-bold rounded uppercase">${statusLabel}</span>
                                <span class="text-xs text-gray-400">${new Date(attempt.last_saved || attempt.end_time).toLocaleDateString()}</span>
                            </div>
                            <h3 class="font-bold text-gray-800 text-lg mb-2 line-clamp-2">${exam.exam_title}</h3>
                            <div class="flex gap-2 mt-4">
                                ${actionBtn}
                            </div>
                        </div>
                    `;
                }).join('');
            } else if (attemptsSection) {
                attemptsSection.classList.add('hidden');
            }

            // 2. Fetch and Render Available Exams (Existing Logic with local filters)
            const subjectId = (subjectFilter) ? subjectFilter.value : "";
            const lessonId = (lessonFilter) ? lessonFilter.value : "";
            const topicId = (topicFilter) ? topicFilter.value : "";

            let filteredExams = [...exams];

            // Sort by ID descending
            filteredExams.sort((a, b) => b.id - a.id);

            // Apply filters locally
            if (topicId) filteredExams = filteredExams.filter(e => e.topic_id == topicId);

            if (!cardsContainer) return;

            if (filteredExams.length === 0) {
                cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-gray-500 italic">No exams found offline matching these filters.</div>';
                return;
            }

            // check download status for each exam
            const examCards = await Promise.all(filteredExams.map(async exam => {
                const isDownloaded = await idbManager.isExamDownloaded(exam.id);
                const statusBadge = isDownloaded
                    ? '<span class="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded uppercase">Available Offline</span>'
                    : '<span class="px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase">Online Only</span>';

                const actionBtn = isDownloaded
                    ? `<button onclick="window.takeOfflineExam(${exam.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">Take Exam</button>`
                    : `<button disabled class="flex-1 bg-gray-200 text-gray-400 font-bold py-2 rounded-lg cursor-not-allowed">Download Required</button>`;

                return `
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow ${!isDownloaded ? 'opacity-75' : ''}">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded">ID: ${exam.id}</span>
                            <div class="flex flex-col items-end gap-1">
                                ${statusBadge}
                                ${isDownloaded ? '<span class="material-symbols-outlined text-green-500 text-sm">offline_pin</span>' : ''}
                            </div>
                        </div>
                        <h3 class="font-bold text-gray-800 text-lg mb-2 line-clamp-2">${exam.exam_title}</h3>
                        <div class="space-y-2 text-sm text-gray-600 mb-6">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base">timer</span>
                                ${exam.duration || 0} Minutes
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base">summarize</span>
                                ${exam.total_marks || 0} Marks (${exam.pass_mark || 0} to pass)
                            </div>
                        </div>
                        <div class="flex gap-2">
                            ${actionBtn}
                            ${isDownloaded ? `
                            <button onclick="window.openPrintModalOffline(${exam.id})" class="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold py-2 px-3 rounded-lg transition-colors" title="Print Options">
                                <span class="material-symbols-outlined">print</span>
                            </button>` : ''}
                        </div>
                    </div>
                `;
            }));

            cardsContainer.innerHTML = examCards.join('');

        } catch (error) {
            console.error('Error rendering exams:', error);
            if (cardsContainer) {
                cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-red-500">Error loading local data.</div>';
            }
        }
    }

    /**
     * Offline PDF Generation Logic
     */
    async function processAndPrintOffline() {
        const examId = PrintEngine.selectedExamId;
        if (!examId) return;

        const generateBtn = document.getElementById('generate-pdf-btn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Preparing PDF...';
        }

        try {
            await idbManager.init();
            const exam = await idbManager.getById('exams', examId);
            if (!exam) throw new Error('Exam not found in local storage');

            const questions = await idbManager.getByIndex('questions', 'exam_id', parseInt(examId));
            if (!questions || questions.length === 0) throw new Error('Questions not found locally');

            // Map IDB question structure to what PrintEngine expects
            const formattedQuestions = questions.map(q => ({
                id: q.id,
                question: q.question,
                options: (typeof q.options === 'string') ? JSON.parse(q.options) : q.options,
                answer: q.answer
            }));

            const data = {
                details: {
                    exam_title: exam.exam_title,
                    full_marks: exam.total_marks,
                    time: (exam.duration || 0) + " মিনিট"
                },
                questions: formattedQuestions
            };

            PrintEngine.generatePDF(data);
            if (window.showToast) showToast('Offline PDF generated successfully!');
            PrintEngine.closeModal();

        } catch (error) {
            console.error('Offline PDF Error:', error);
            if (window.showToast) showToast('Failed to generate PDF: ' + error.message, 'error');
        } finally {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> Generate PDF Questions';
            }
        }
    }

    // Expose print modal opener
    window.openPrintModalOffline = (examId) => {
        PrintEngine.onGenerate = processAndPrintOffline;
        PrintEngine.openModal(examId);
    };

    /**
     * Populate Filter Options
     */
    async function populateFilters() {
        try {
            const subjects = await idbManager.getAll('subjects');
            subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
                subjects.map(s => `<option value="${s.id}">${s.subject_name}</option>`).join('');

            subjectFilter.onchange = async () => {
                const val = subjectFilter.value;
                if (val) {
                    const lessons = await idbManager.getByIndex('lessons', 'subject_id', parseInt(val));
                    lessonFilter.innerHTML = '<option value="">All Lessons</option>' +
                        lessons.map(l => `<option value="${l.id}">${l.lesson_name}</option>`).join('');
                    lessonFilter.disabled = false;
                } else {
                    lessonFilter.innerHTML = '<option value="">All Lessons</option>';
                    lessonFilter.disabled = true;
                    topicFilter.innerHTML = '<option value="">All Topics</option>';
                    topicFilter.disabled = true;
                }
                renderExams();
            };

            lessonFilter.onchange = async () => {
                const val = lessonFilter.value;
                if (val) {
                    const topics = await idbManager.getByIndex('topics', 'lesson_id', parseInt(val));
                    topicFilter.innerHTML = '<option value="">All Topics</option>' +
                        topics.map(t => `<option value="${t.id}">${t.topic_name}</option>`).join('');
                    topicFilter.disabled = false;
                } else {
                    topicFilter.innerHTML = '<option value="">All Topics</option>';
                    topicFilter.disabled = true;
                }
                renderExams();
            };

            topicFilter.onchange = renderExams;

        } catch (error) {
            console.error('Error populating filters:', error);
        }
    }

    // Initialize Page
    async function initPage() {
        await idbManager.init();
        updateStatusIndicator();

        const lastSync = await idbManager.getMetadata('last_server_sync');
        if (lastSync && lastSyncSpan) lastSyncSpan.textContent = new Date(lastSync).toLocaleString();

        populateFilters();
        renderExams();

        window.addEventListener('online', updateStatusIndicator);
        window.addEventListener('offline', updateStatusIndicator);

        if (manualSyncBtn) {
            manualSyncBtn.onclick = async () => {
                manualSyncBtn.disabled = true;
                manualSyncBtn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">sync</span> Updating...';

                await syncManager.sync();

                manualSyncBtn.disabled = false;
                manualSyncBtn.innerHTML = '<span class="material-symbols-outlined text-lg">sync</span> Update Data';
            };
        }

        /**
         * Download Subject Handler
         */
        const downloadBtn = document.getElementById('download-subject-btn');
        const progressContainer = document.getElementById('download-progress-container');
        const statusText = document.getElementById('download-status-text');
        const progressBar = document.getElementById('download-progress-bar');
        const percentText = document.getElementById('download-percent');

        if (downloadBtn) {
            subjectFilter.addEventListener('change', () => {
                downloadBtn.disabled = !subjectFilter.value || !navigator.onLine;
            });

            downloadBtn.onclick = async () => {
                const subjectId = subjectFilter.value;
                if (!subjectId) return;

                downloadBtn.disabled = true;
                progressContainer.classList.remove('hidden');

                try {
                    await syncManager.downloadSubject(subjectId, (status) => {
                        statusText.textContent = status;
                        // Simple progress simulation since bulk storage is fast but API might take time
                        if (status.includes('Fetching')) {
                            progressBar.style.width = '30%';
                            percentText.textContent = '30%';
                        } else if (status.includes('exams')) {
                            progressBar.style.width = '60%';
                            percentText.textContent = '60%';
                        } else if (status.includes('questions')) {
                            progressBar.style.width = '90%';
                            percentText.textContent = '90%';
                        }
                    });

                    progressBar.style.width = '100%';
                    percentText.textContent = '100%';
                    statusText.textContent = 'Download Complete!';
                    statusText.className = 'text-green-600 font-medium';

                    if (window.showToast) showToast('Subject downloaded for offline use!', 'success');

                    setTimeout(() => {
                        progressContainer.classList.add('hidden');
                        renderExams();
                    }, 2000);

                } catch (error) {
                    statusText.textContent = 'Download Failed: ' + error.message;
                    statusText.className = 'text-red-600 font-medium';
                    if (window.showToast) showToast('Download failed: ' + error.message, 'error');
                } finally {
                    downloadBtn.disabled = false;
                }
            };
        }

        /**
         * Download All Data Handler
         */
        const downloadAllBtn = document.getElementById('download-all-btn');
        if (downloadAllBtn) {
            downloadAllBtn.onclick = async () => {
                if (!confirm('This will download ALL available exams and questions for offline use. It may take some time. Proceed?')) return;

                downloadAllBtn.disabled = true;
                progressContainer.classList.remove('hidden');

                try {
                    await syncManager.downloadSubject('all', (status) => {
                        statusText.textContent = status;
                        if (status.includes('Fetching')) {
                            progressBar.style.width = '30%';
                            percentText.textContent = '30%';
                        } else if (status.includes('exams')) {
                            progressBar.style.width = '60%';
                            percentText.textContent = '60%';
                        } else if (status.includes('questions')) {
                            progressBar.style.width = '90%';
                            percentText.textContent = '90%';
                        }
                    });

                    progressBar.style.width = '100%';
                    percentText.textContent = '100%';
                    statusText.textContent = 'Full Download Complete!';
                    statusText.className = 'text-green-600 font-medium';

                    if (window.showToast) showToast('All data downloaded successfully!', 'success');

                    setTimeout(() => {
                        progressContainer.classList.add('hidden');
                        renderExams();
                    }, 2000);

                } catch (error) {
                    statusText.textContent = 'Full Download Failed: ' + error.message;
                    statusText.className = 'text-red-600 font-medium';
                    if (window.showToast) showToast('Full download failed: ' + error.message, 'error');
                } finally {
                    downloadAllBtn.disabled = false;
                }
            };
        }

        syncManager.onSyncComplete = (time) => {
            if (lastSyncSpan) lastSyncSpan.textContent = new Date(time).toLocaleString();
            renderExams();
            populateFilters();
            if (window.showToast) showToast('Data updated successfully!', 'success');
        };

        syncManager.onSyncError = (err) => {
            if (window.showToast) showToast('Sync failed: ' + err.message, 'error');
        };
    }

    // Expose takeOfflineExam to window
    window.takeOfflineExam = (examId) => {
        if (window.loadPage) {
            window.loadPage('take-offline-exam', `?exam_id=${examId}`);
        }
    };

    window.resumeOfflineAttempt = (attemptUuid, examId) => {
        if (window.loadPage) {
            window.loadPage('take-offline-exam', `?exam_id=${examId}&attempt_uuid=${attemptUuid}`);
        }
    };

    window.reviewOfflineAttempt = (attemptUuid) => {
        if (window.loadPage) {
            window.loadPage('performance-review', `?attempt_id=${attemptUuid}`);
        }
    };

    initPage();
})();
