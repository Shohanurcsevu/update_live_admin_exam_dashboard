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
                result.data.forEach((q, index) => {
                    const questionCard = `
                        <div class="border rounded-lg p-4 bg-gray-50">
                            <div class="flex justify-between items-start">
                                <p class="text-gray-800 font-semibold">${index + 1}. ${q.question}</p>
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
    
    async function handleDeleteConfirm() {
        if (!questionIdToDelete) return;
        try {
            const response = await fetch(`${API_URL}delete.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: questionIdToDelete }) });
            const result = await response.json();
            showToast(result.message, result.success ? 'error' : 'error');
        } catch (error) { showToast('Network error.', 'error'); }
        finally { closeModal(deleteModal); fetchAndDisplayQuestions(); }
    }
    
    function handleContainerClick(e) {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        
        if(editBtn) {
            const id = editBtn.dataset.id;
            // Find the full question data from the already fetched list to pre-fill the modal
            const questionData = Array.from(questionsContainer.children)
                .map((_, index) => currentQuestions[index])
                .find(q => q.id == id);
            
            if(questionData) {
                document.getElementById('edit-question-id').value = questionData.id;
                document.getElementById('edit-question-text').value = questionData.question;
                document.getElementById('edit-option-a').value = questionData.options.A;
                document.getElementById('edit-option-b').value = questionData.options.B;
                document.getElementById('edit-option-c').value = questionData.options.C;
                document.getElementById('edit-option-d').value = questionData.options.D;
                document.getElementById('edit-answer').value = questionData.answer;
                document.getElementById('edit-explanation').value = questionData.explanation;
                openModal(editModal);
            }
        }

        if(deleteBtn) {
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

