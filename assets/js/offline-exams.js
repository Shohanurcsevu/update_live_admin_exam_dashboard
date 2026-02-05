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
     * Render Exams from IndexedDB
     */
    async function renderExams() {
        cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-gray-500">Loading local data...</div>';

        try {
            const subjectId = subjectFilter.value;
            const lessonId = lessonFilter.value;
            const topicId = topicFilter.value;

            let exams = await idbManager.getAll('exams');

            // Apply filters locally
            if (subjectId) exams = exams.filter(e => e.subject_id == subjectId);
            if (lessonId) exams = exams.filter(e => e.lesson_id == lessonId);
            if (topicId) exams = exams.filter(e => e.topic_id == topicId);

            if (exams.length === 0) {
                cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-gray-500 italic">No exams found offline matching these filters.</div>';
                return;
            }

            cardsContainer.innerHTML = exams.map(exam => `
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-4">
                        <span class="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded">ID: ${exam.id}</span>
                        <span class="material-symbols-outlined text-gray-400">offline_pin</span>
                    </div>
                    <h3 class="font-bold text-gray-800 text-lg mb-2 line-clamp-2">${exam.exam_title}</h3>
                    <div class="space-y-2 text-sm text-gray-600 mb-6">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-base">timer</span>
                            ${exam.duration_minutes} Minutes
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-base">summarize</span>
                            ${exam.total_marks} Marks (${exam.pass_mark} to pass)
                        </div>
                    </div>
                    <button onclick="alert('Offline exam taking capability coming soon!')" class="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-2 rounded-lg transition-colors">
                        View Details
                    </button>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error rendering exams:', error);
            cardsContainer.innerHTML = '<div class="col-span-full py-12 text-center text-red-500">Error loading local data.</div>';
        }
    }

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

    initPage();
})();
