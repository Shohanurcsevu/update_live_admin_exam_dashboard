function initializeSubjectPage() {
    // --- API URLs ---
    const SUBJECT_API_URL = 'api/subject/subject.php';
    const READING_API_URL = 'api/reading/';

    // --- DOM Elements ---
    const subjectsTableBody = document.getElementById('subjects-table-body');
    const toastContainer = document.getElementById('toast-container');
    const createSubjectBtn = document.getElementById('create-subject-btn');
    const subjectModal = document.getElementById('subject-modal');
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const analyticsModal = document.getElementById('analytics-modal');

    // --- State Variables ---
    let subjectIdToDelete = null;
    let currentAnalyticsData = {};
    let calendarDate;

    // --- Element Check ---
    if (!createSubjectBtn || !subjectModal || !deleteConfirmModal || !analyticsModal) {
        console.error("One or more modal elements not found. Aborting script initialization.");
        return;
    }
    
    // --- Toast Function ---
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            case 'update': bgColor = 'bg-yellow-500'; icon = 'notification_important'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    }

    // --- Main Data Fetching ---
    async function fetchAndDisplaySubjects() {
        try {
            const response = await fetch(`${SUBJECT_API_URL}?action=list`);
            const result = await response.json();
            subjectsTableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(subject => {
                    // --- NEW: Lesson progress calculation ---
                    const createdLessons = parseInt(subject.created_lessons) || 0;
                    const totalLessons = parseInt(subject.total_lessons) || 0;
                    const lessonsLeft = Math.max(0, totalLessons - createdLessons);
                    const progressPercent = totalLessons > 0 ? (createdLessons / totalLessons) * 100 : 0;
                    const progressBarColor = progressPercent >= 100 ? 'bg-green-600' : 'bg-blue-600';

                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left font-semibold">${subject.id}</td>
                            <td class="py-3 px-6 text-left">${subject.subject_name}</td>
                            <td class="py-3 px-6 text-left">${subject.book_name}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="w-full">
                                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>${createdLessons} / ${totalLessons}</span>
                                        <span>${progressPercent.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                                        <div class="${progressBarColor} h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">${lessonsLeft} lessons left</div>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center">${subject.total_pages}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex item-center justify-center">
                                    <button class="analytics-btn w-8 h-8 rounded-full bg-blue-200 text-blue-700 hover:bg-blue-300 mr-2" data-id="${subject.id}"><span class="material-symbols-outlined text-lg">analytics</span></button>
                                    <button class="edit-btn w-8 h-8 rounded-full bg-green-200 text-green-700 hover:bg-green-300 mr-2" data-id="${subject.id}"><span class="material-symbols-outlined text-lg">edit</span></button>
                                    <button class="delete-btn w-8 h-8 rounded-full bg-red-200 text-red-700 hover:bg-red-300" data-id="${subject.id}"><span class="material-symbols-outlined text-lg">delete</span></button>
                                </div>
                            </td>
                        </tr>`;
                    subjectsTableBody.innerHTML += row;
                });
            } else {
                 subjectsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No subjects found.</td></tr>`;
            }
        } catch (error) { showToast('An error occurred while fetching subjects.', 'error'); }
    }

    // --- Modal Control ---
    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    // --- Analytics & Calendar Logic ---
    function generateCalendar() {
        const calendarGrid = document.getElementById('calendar-grid');
        const monthYearLabel = document.getElementById('month-year-label');
        if (!currentAnalyticsData || !currentAnalyticsData.data) return; 
        const { subject_details, reading_logs } = currentAnalyticsData.data;
        
        const startDate = new Date(subject_details.start_date + 'T00:00:00');
        const endDate = new Date(subject_details.end_date + 'T00:00:00');

        monthYearLabel.textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        calendarGrid.innerHTML = '';
        
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
            calendarGrid.innerHTML += `<div class="font-bold text-gray-500">${day}</div>`;
        });
        
        const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
        const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();

        for (let i = 0; i < firstDayOfMonth; i++) { calendarGrid.innerHTML += `<div></div>`; }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
            const dateString = date.toISOString().split('T')[0];
            const pagesRead = reading_logs[dateString] || 0;
            let classes = "p-2 rounded-full cursor-pointer transition-colors";
            let isDisabled = date < startDate || date > endDate;

            if (isDisabled) {
                classes += " text-gray-300 cursor-not-allowed";
            } else {
                if (pagesRead > 0) classes += " bg-blue-100 text-blue-800 hover:bg-blue-200";
                else classes += " hover:bg-gray-100";
            }
            if (date.toDateString() === new Date().toDateString()) classes += " border-2 border-blue-500";
            
            calendarGrid.innerHTML += `<div class="${classes}" data-date="${dateString}" ${isDisabled ? 'disabled' : ''}>${day}</div>`;
        }
    }

    function updateAnalyticsDisplay() {
        if (!currentAnalyticsData || !currentAnalyticsData.data) return;
        const { calculations } = currentAnalyticsData.data;
        document.getElementById('progress-percent').textContent = `${calculations.pageProgressPercent.toFixed(1)}%`;
        document.getElementById('progress-bar').style.width = `${calculations.pageProgressPercent}%`;
        document.getElementById('pages-left').textContent = calculations.totalPagesLeft;
        document.getElementById('days-left').textContent = calculations.daysLeft;
        document.getElementById('required-pace').textContent = calculations.needToReadPagePerDay;
        document.getElementById('current-avg').textContent = calculations.averageReading;
        
        const statusIcon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'flex items-center p-3 rounded-lg mt-1';
        
        if (calculations.readingBehindPages <= 0) {
            statusIndicator.classList.add('bg-green-100', 'text-green-800');
            statusIcon.textContent = 'check_circle';
            statusText.textContent = 'You are on track or ahead!';
        } else if (calculations.readingBehindPages < calculations.requiredReadingPace * 3) {
            statusIndicator.classList.add('bg-yellow-100', 'text-yellow-800');
            statusIcon.textContent = 'warning';
            statusText.textContent = `Slightly behind by ${calculations.readingBehindPages} pages.`;
        } else {
            statusIndicator.classList.add('bg-red-100', 'text-red-800');
            statusIcon.textContent = 'dangerous';
            statusText.textContent = `Falling behind by ${calculations.readingBehindPages} pages.`;
        }
    }

    async function refreshAnalytics(subjectId) {
        try {
            const response = await fetch(`${READING_API_URL}analytics.php?subject_id=${subjectId}`);
            const analyticsResponse = await response.json();
            if (analyticsResponse.success) {
                currentAnalyticsData.data = analyticsResponse.data; 
                generateCalendar();
                updateAnalyticsDisplay();
            } else {
                showToast(analyticsResponse.message || 'Could not load analytics.', 'error');
            }
        } catch (error) { showToast('Error fetching analytics.', 'error'); }
    }

    function setupEventListeners() {
        createSubjectBtn.addEventListener('click', () => { document.getElementById('subject-form').reset(); document.getElementById('modal-title').textContent = "Add New Subject"; openModal(subjectModal); });
        document.getElementById('close-modal-btn').addEventListener('click', () => closeModal(subjectModal));
        document.getElementById('cancel-modal-btn').addEventListener('click', () => closeModal(subjectModal));
        document.getElementById('subject-form').addEventListener('submit', handleSubjectFormSubmit);
        document.getElementById('cancel-delete-btn').addEventListener('click', () => closeModal(deleteConfirmModal));
        document.getElementById('confirm-delete-btn').addEventListener('click', handleDeleteConfirm);
        document.getElementById('close-analytics-modal-btn').addEventListener('click', () => closeModal(analyticsModal));
        document.getElementById('prev-month-btn').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); generateCalendar(); });
        document.getElementById('next-month-btn').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); generateCalendar(); });
        document.getElementById('calendar-grid').addEventListener('click', handleCalendarDayClick);
        document.getElementById('log-entry-form').addEventListener('submit', handleLogEntrySubmit);
        subjectsTableBody.addEventListener('click', handleTableActions);
    }
    
    async function handleTableActions(e) {
        const targetBtn = e.target.closest('button');
        if (!targetBtn) return;
        const id = targetBtn.dataset.id;

        if (targetBtn.classList.contains('analytics-btn')) {
            document.getElementById('analytics-modal-title').textContent = 'Loading Analytics...';
            openModal(analyticsModal);
            const response = await fetch(`${SUBJECT_API_URL}?action=get_single&id=${id}`);
            const result = await response.json();
            if(result.success) {
                 document.getElementById('analytics-modal-title').textContent = `Analytics for: ${result.data.subject_name}`;
                 calendarDate = new Date(result.data.start_date + 'T00:00:00');
                 currentAnalyticsData = { subjectId: id };
                 refreshAnalytics(id);
            }
        } else if (targetBtn.classList.contains('edit-btn')) {
            const response = await fetch(`${SUBJECT_API_URL}?action=get_single&id=${id}`);
            const result = await response.json();
            if (result.success) {
                const subject = result.data;
                document.getElementById('modal-title').textContent = 'Edit Subject';
                document.getElementById('subject-id').value = subject.id;
                document.getElementById('subject-name').value = subject.subject_name;
                document.getElementById('book-name').value = subject.book_name;
                document.getElementById('total-lessons').value = subject.total_lessons;
                document.getElementById('total-pages').value = subject.total_pages;
                document.getElementById('start-date').value = subject.start_date;
                document.getElementById('end-date').value = subject.end_date;
                document.getElementById('category').value = subject.category;
                openModal(subjectModal);
            }
        } else if (targetBtn.classList.contains('delete-btn')) {
            subjectIdToDelete = id;
            openModal(deleteConfirmModal);
        }
    }

    async function handleSubjectFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const url = data.id ? `${SUBJECT_API_URL}?action=update` : `${SUBJECT_API_URL}?action=create`;
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(subjectModal);
                fetchAndDisplaySubjects();
                showToast(result.message, data.id ? 'update' : 'success');
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('Network error.', 'error'); }
    }

    async function handleDeleteConfirm() {
        if (!subjectIdToDelete) return;
        try {
            const response = await fetch(`${SUBJECT_API_URL}?action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: subjectIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteConfirmModal); fetchAndDisplaySubjects(); }
    }
    
    function handleCalendarDayClick(e) {
        const dayEl = e.target.closest('div[data-date]');
        if (!dayEl || dayEl.hasAttribute('disabled')) return;
        const date = dayEl.dataset.date;
        const pagesRead = currentAnalyticsData.data?.reading_logs?.[date] || '';
        document.querySelectorAll('#calendar-grid > div').forEach(d => d.classList.remove('bg-blue-500', 'text-white'));
        dayEl.classList.add('bg-blue-500', 'text-white');
        const logDateLabel = document.getElementById('log-date-label');
        const pagesReadInput = document.getElementById('pages-read-input');
        const selectedDateInput = document.getElementById('selected-date-input');
        const saveBtn = document.querySelector('#log-entry-form button[type="submit"]');
        logDateLabel.textContent = `Pages read on: ${new Date(date + 'T00:00:00').toLocaleDateString()}`;
        pagesReadInput.value = pagesRead;
        pagesReadInput.disabled = false;
        selectedDateInput.value = date;
        saveBtn.disabled = false;
    }

    async function handleLogEntrySubmit(e) {
        e.preventDefault();
        const date = document.getElementById('selected-date-input').value;
        const pages = document.getElementById('pages-read-input').value;
        if (!date) { showToast('Please select a date from the calendar.', 'error'); return; }
        const data = { subject_id: currentAnalyticsData.subjectId, read_date: date, pages_read: pages };
        try {
            const response = await fetch(`${READING_API_URL}add.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                showToast(result.message, 'success');
                refreshAnalytics(currentAnalyticsData.subjectId);
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('Network error while saving log.', 'error'); }
    }

    // --- Initial Execution ---
    setupEventListeners();
    fetchAndDisplaySubjects();
}

initializeSubjectPage();
