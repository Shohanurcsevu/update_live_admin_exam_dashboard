function initializeQuestionsListPage() {
    const API_URL = 'api/question/';
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('exam_id');
    const examTitle = params.get('exam_title');

    // DOM Elements
    const pageTitle = document.getElementById('page-title');
    const examSubtitle = document.getElementById('exam-subtitle');
    const questionsContainer = document.getElementById('questions-container');
    const backBtn = document.getElementById('back-to-import-btn');
    const editModal = document.getElementById('edit-question-modal');
    const deleteModal = document.getElementById('delete-question-confirm-modal');
    const editForm = document.getElementById('edit-question-form');
    const toastContainer = document.getElementById('toast-container');

    let questionIdToDelete = null;

    if (!examId) {
        questionsContainer.innerHTML = '<p class="text-red-500">No exam selected. Please go back and select an exam.</p>';
        return;
    }

    pageTitle.textContent = `Questions for: ${examTitle || 'Exam'}`;

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

    async function fetchAndDisplayQuestions() {
        try {
            const response = await fetch(`${API_URL}list.php?exam_id=${examId}`);
            const result = await response.json();
            questionsContainer.innerHTML = '';
            if (result.success && result.data.length > 0) {
                currentQuestions = result.data;
                result.data.forEach((q, index) => {
                    const priorityInt = parseInt(q.priority) || 0;
                    const questionCard = `
                        <div class="border rounded-lg p-4 bg-gray-50 flex flex-col">
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex-grow">
                                    <p class="text-gray-800 font-semibold">${index + 1}. ${q.question}</p>
                                    <div class="mt-2 flex flex-wrap gap-2 priority-controls" data-question-id="${q.id}">
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 0 ? 'bg-gray-200 border-gray-400 text-gray-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}" data-priority="0">0</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 1 ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'}" data-priority="1">P1</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 2 ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-yellow-300'}" data-priority="2">P2</button>
                                        <button class="quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ${priorityInt === 3 ? 'bg-red-100 border-red-400 text-red-800 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:border-red-300'}" data-priority="3">P3</button>
                                    </div>
                                </div>
                                <div class="flex-shrink-0 ml-4">
                                    <button class="edit-btn p-1 text-green-600 hover:text-green-800" data-id="${q.id}"><span class="material-symbols-outlined">edit</span></button>
                                    <button class="delete-btn p-1 text-red-600 hover:text-red-800" data-id="${q.id}"><span class="material-symbols-outlined">delete</span></button>
                                </div>
                            </div>
                            <div class="mt-2 text-sm space-y-1 text-gray-600">
                                ${Object.entries(q.options).map(([key, value]) => `
                                    <p class="${key === q.answer ? 'font-bold text-green-700' : ''}"><strong>${key}:</strong> ${value}</p>
                                `).join('')}
                            </div>
                            <div class="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                                <strong>Explanation:</strong> ${q.explanation || 'N/A'}
                            </div>
                        </div>
                    `;
                    questionsContainer.innerHTML += questionCard;
                });
            } else {
                questionsContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No questions found for this exam.</p>`;
            }
        } catch (error) { showToast('Failed to load questions.', 'error'); }
    }

    function closeModal(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    function openModal(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }

    async function handleEditFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(editForm);
        const data = {
            id: formData.get('id'),
            question: formData.get('question'),
            options: {
                A: formData.get('options[A]'),
                B: formData.get('options[B]'),
                C: formData.get('options[C]'),
                D: formData.get('options[D]'),
            },
            answer: formData.get('answer'),
            explanation: formData.get('explanation'),
            priority: parseInt(formData.get('priority')) || 0,
        };

        try {
            const response = await fetch(`${API_URL}update.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (result.success) {
                closeModal(editModal);
                fetchAndDisplayQuestions();
                showToast(result.message, 'update');
            } else { showToast(result.message, 'error'); }
        } catch (error) { showToast('Network error.', 'error'); }
    }

    async function updateQuestionPriority(questionId, priority) {
        try {
            const response = await fetch(`api/question/set_priority.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: questionId, priority: priority })
            });
            const result = await response.json();
            if (result.success) {
                if (!result.no_change) {
                    showToast(result.message, 'success');
                    // Update the local data to keep it in sync without a full fetch
                    const qIdx = currentQuestions.findIndex(q => q.id == questionId);
                    if (qIdx !== -1) currentQuestions[qIdx].priority = priority;
                }
                return true;
            } else {
                showToast(result.message, 'error');
                return false;
            }
        } catch (error) {
            showToast('Failed to update priority.', 'error');
            return false;
        }
    }

    async function handleDeleteConfirm() {
        if (!questionIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}delete.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteModal); fetchAndDisplayQuestions(); }
    }

    async function handleContainerClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const id = editBtn.dataset.id;
            // Find the full question data from the already fetched list to pre-fill the modal
            const questionData = Array.from(questionsContainer.children)
                .map((_, index) => currentQuestions[index])
                .find(q => q.id == id);

            if (questionData) {
                document.getElementById('edit-question-id').value = questionData.id;
                document.getElementById('edit-question-text').value = questionData.question;
                document.getElementById('edit-option-a').value = questionData.options.A;
                document.getElementById('edit-option-b').value = questionData.options.B;
                document.getElementById('edit-option-c').value = questionData.options.C;
                document.getElementById('edit-option-d').value = questionData.options.D;
                document.getElementById('edit-answer').value = questionData.answer;
                document.getElementById('edit-explanation').value = questionData.explanation;

                // Set priority buttons in modal
                const priorityValue = questionData.priority || 0;
                document.getElementById('edit-priority').value = priorityValue;
                updateModalPriorityButtons(priorityValue);

                openModal(editModal);
            }
        }

        const quickPriorityBtn = e.target.closest('.quick-priority-btn');
        if (quickPriorityBtn) {
            const container = quickPriorityBtn.closest('.priority-controls');
            const questionId = container.dataset.questionId;
            const newPriority = parseInt(quickPriorityBtn.dataset.priority);

            const success = await updateQuestionPriority(questionId, newPriority);
            if (success) {
                // Update button UI immediately on the card
                const buttons = container.querySelectorAll('.quick-priority-btn');
                buttons.forEach(btn => {
                    const btnPriority = parseInt(btn.dataset.priority);
                    btn.className = getPriorityBtnClass(btnPriority, btnPriority === newPriority);
                });
            }
        }

        if (deleteBtn) {
            questionIdToDelete = deleteBtn.dataset.id;
            openModal(deleteModal);
        }
    }

    let currentQuestions = [];
    async function initialLoad() {
        try {
            const response = await fetch(`${API_URL}list.php?exam_id=${examId}`);
            const result = await response.json();
            if (result.success) {
                currentQuestions = result.data;
                fetchAndDisplayQuestions();
            } else {
                questionsContainer.innerHTML = `<p class="text-center text-red-500 py-8">${result.message}</p>`;
            }
        } catch (error) {
            showToast('Failed to load initial question data.', 'error');
        }
    }

    function getPriorityBtnClass(priority, isActive) {
        const base = "quick-priority-btn px-2 py-0.5 rounded border text-[10px] font-bold transition-all ";
        if (!isActive) return base + "bg-white border-gray-200 text-gray-400 hover:border-gray-300";

        switch (priority) {
            case 1: return base + "bg-blue-100 border-blue-400 text-blue-800 shadow-sm";
            case 2: return base + "bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm";
            case 3: return base + "bg-red-100 border-red-400 text-red-800 shadow-sm";
            default: return base + "bg-gray-200 border-gray-400 text-gray-800 shadow-sm";
        }
    }

    function updateModalPriorityButtons(activePriority) {
        const buttons = document.querySelectorAll('#edit-priority-buttons .priority-btn');
        buttons.forEach(btn => {
            const p = parseInt(btn.dataset.priority);
            if (p === activePriority) {
                btn.classList.add('ring-2', 'ring-offset-1', 'border-current');
                switch (p) {
                    case 0: btn.classList.add('ring-gray-400'); break;
                    case 1: btn.classList.add('ring-blue-400'); break;
                    case 2: btn.classList.add('ring-yellow-400'); break;
                    case 3: btn.classList.add('ring-red-400'); break;
                }
            } else {
                btn.classList.remove('ring-2', 'ring-offset-1', 'ring-gray-400', 'ring-blue-400', 'ring-yellow-400', 'ring-red-400', 'border-current');
            }
        });
    }

    // Modal Priority Button Click Handler
    document.getElementById('edit-priority-buttons').addEventListener('click', (e) => {
        const btn = e.target.closest('.priority-btn');
        if (btn) {
            const priority = parseInt(btn.dataset.priority);
            document.getElementById('edit-priority').value = priority;
            updateModalPriorityButtons(priority);
        }
    });

    // Event listeners
    backBtn.addEventListener('click', () => window.history.back()); // Simple back navigation
    editForm.addEventListener('submit', handleEditFormSubmit);
    questionsContainer.addEventListener('click', handleContainerClick);
    document.getElementById('close-edit-modal-btn').addEventListener('click', () => closeModal(editModal));
    document.getElementById('cancel-edit-modal-btn').addEventListener('click', () => closeModal(editModal));
    document.getElementById('cancel-question-delete-btn').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('confirm-question-delete-btn').addEventListener('click', handleDeleteConfirm);

    initialLoad();
}

initializeQuestionsListPage();

