function initializeCustomExamsPage() {
    const API_URL = 'api/custom-exams/list.php';
    const DELETE_API_URL = 'api/exam/exam.php';
    const tableBody = document.getElementById('custom-exams-table-body');
    const deleteModal = document.getElementById('custom-exam-delete-modal');
    const cancelDeleteBtn = document.getElementById('custom-exam-cancel-delete');
    const confirmDeleteBtn = document.getElementById('custom-exam-confirm-delete');
    const toastContainer = document.getElementById('toast-container');

    let examIdToDelete = null;

    // Subject color config for completion styling
    const SUBJECT_COLORS = window.SUBJECT_COLORS || {
        emerald: { bg: 'rgba(16,185,129,0.10)', border: '#10b981', text: '#065f46', badge: '#d1fae5', badgeText: '#065f46' },
        indigo: { bg: 'rgba(99,102,241,0.10)', border: '#6366f1', text: '#3730a3', badge: '#e0e7ff', badgeText: '#3730a3' },
        amber: { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', text: '#78350f', badge: '#fef3c7', badgeText: '#78350f' },
        cyan: { bg: 'rgba(6,182,212,0.10)', border: '#06b6d4', text: '#155e75', badge: '#cffafe', badgeText: '#155e75' },
        violet: { bg: 'rgba(139,92,246,0.10)', border: '#8b5cf6', text: '#5b21b6', badge: '#ede9fe', badgeText: '#5b21b6' },
        rose: { bg: 'rgba(244,63,94,0.10)', border: '#f43f5e', text: '#881337', badge: '#ffe4e6', badgeText: '#881337' },
        teal: { bg: 'rgba(20,184,166,0.10)', border: '#14b8a6', text: '#115e59', badge: '#ccfbf1', badgeText: '#115e59' },
        orange: { bg: 'rgba(249,115,22,0.10)', border: '#f97316', text: '#7c2d12', badge: '#ffedd5', badgeText: '#7c2d12' },
        sky: { bg: 'rgba(14,165,233,0.10)', border: '#0ea5e9', text: '#0c4a6e', badge: '#e0f2fe', badgeText: '#0c4a6e' },
        fuchsia: { bg: 'rgba(217,70,239,0.10)', border: '#d946ef', text: '#701a75', badge: '#fae8ff', badgeText: '#701a75' },
    };
    function getCS(c) { return SUBJECT_COLORS[c] || SUBJECT_COLORS.violet; }

    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        const icon = type === 'error' ? 'error' : 'check_circle';
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
    };

    async function fetchAndDisplayCustomExams() {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">Loading custom exams...</td></tr>`;

        try {
            const response = await fetch(API_URL + '?_=' + Date.now());
            const data = await response.json();
            const exams = data.success ? (data.data || []) : [];

            tableBody.innerHTML = '';

            if (exams.length > 0) {
                exams.forEach(exam => {
                    const isComplete = parseInt(exam.lesson_is_complete) || 0;
                    const cc = exam.color_class || 'violet';
                    const cs = getCS(cc);
                    const rowStyle = isComplete ? `style="background-color:${cs.bg};border-left:4px solid ${cs.border}"` : '';
                    const completeBadge = isComplete ? `<span class="inline-flex items-center px-1 py-0.5 rounded text-[7px] font-bold" style="background-color:${cs.badge};color:${cs.badgeText}">✓</span>` : '';

                    // Color the subject/lesson/topic names
                    const subjectNameHtml = isComplete
                        ? `<span class="font-bold" style="color:${cs.text}">${exam.subject_name || 'N/A'}</span>`
                        : (exam.subject_name || 'N/A');
                    const lessonNameHtml = isComplete
                        ? `<span class="font-medium" style="color:${cs.text}">${exam.lesson_name || 'N/A'}</span> ${completeBadge}`
                        : (exam.lesson_name || 'N/A');
                    const topicNameHtml = exam.topic_name
                        ? (isComplete ? `<span style="color:${cs.text}">${exam.topic_name}</span>` : exam.topic_name)
                        : '';

                    const basedOn = topicNameHtml
                        ? `${subjectNameHtml} > ${lessonNameHtml} > ${topicNameHtml}`
                        : `${subjectNameHtml} > ${lessonNameHtml}`;

                    const row = `
                        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors" ${rowStyle}>
                            <td class="py-3 px-6 text-left font-medium text-gray-800">${exam.exam_title}</td>
                            <td class="py-3 px-6 text-left text-xs text-gray-500">${basedOn}</td>
                            <td class="py-3 px-6 text-center text-sm">${exam.duration} min</td>
                            <td class="py-3 px-6 text-center text-sm">${exam.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button class="take-exam-btn bg-blue-500 hover:bg-blue-600 text-white text-xs px-4 py-2 rounded-full transition-colors" data-id="${exam.id}">
                                        <span class="material-symbols-outlined text-sm align-middle mr-1">play_arrow</span>Take
                                    </button>
                                    <button class="delete-exam-btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs px-3 py-2 rounded-full transition-colors" data-id="${exam.id}" data-title="${exam.exam_title}">
                                        <span class="material-symbols-outlined text-sm align-middle">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">No custom exams found. <a href="#" onclick="window.loadPage('exams-across-subjects')" class="text-blue-500 hover:underline">Create one?</a></td></tr>`;
            }
        } catch (error) {
            console.error('Fetch Custom Exams Error:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Failed to load custom exams.</td></tr>`;
        }
    }

    // Event delegation on table body
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const takeBtn = e.target.closest('.take-exam-btn');
            const deleteBtn = e.target.closest('.delete-exam-btn');

            if (takeBtn) {
                const examId = takeBtn.dataset.id;
                if (window.loadPage) window.loadPage('take-exam-interface', `?exam_id=${examId}`);
            }

            if (deleteBtn) {
                examIdToDelete = deleteBtn.dataset.id;
                const title = deleteBtn.dataset.title;
                const titleEl = document.getElementById('custom-exam-delete-title');
                if (titleEl) titleEl.textContent = `"${title}"`;
                if (deleteModal) deleteModal.classList.remove('hidden');
                if (deleteModal) deleteModal.classList.add('flex');
            }
        });
    }

    // Modal cancel
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
            deleteModal.classList.remove('flex');
            examIdToDelete = null;
        });
    }

    // Modal confirm delete
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!examIdToDelete) return;
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            try {
                const response = await fetch(DELETE_API_URL + '?action=delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: examIdToDelete })
                });
                const result = await response.json();

                if (result.success) {
                    showToast('Custom exam deleted successfully.', 'success');
                    fetchAndDisplayCustomExams();
                } else {
                    showToast(result.message || 'Failed to delete exam.', 'error');
                }
            } catch (err) {
                showToast('Network error. Please try again.', 'error');
            } finally {
                deleteModal.classList.add('hidden');
                deleteModal.classList.remove('flex');
                examIdToDelete = null;
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Delete';
            }
        });
    }

    fetchAndDisplayCustomExams();
}
initializeCustomExamsPage();
