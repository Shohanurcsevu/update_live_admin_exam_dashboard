function initializeCustomExamsPage() {
    const API_URL = 'api/custom-exams/list.php';
    const tableBody = document.getElementById('custom-exams-table-body');

    async function fetchAndDisplayCustomExams() {
        if (!tableBody) {
            console.error("Custom exams table body not found.");
            return;
        }
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading custom exams...</td></tr>`;

        try {
            const response = await fetch(API_URL);
            const result = await response.json();
            tableBody.innerHTML = '';
            if (result.success && result.data.length > 0) {
                result.data.forEach(exam => {
                    const basedOn = `${exam.subject_name || 'N/A'} > ${exam.lesson_name || 'N/A'}`;
                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left font-medium">${exam.exam_title}</td>
                            <td class="py-3 px-6 text-left text-xs">${basedOn}</td>
                            <td class="py-3 px-6 text-center">${exam.duration} min</td>
                            <td class="py-3 px-6 text-center">${exam.total_questions}</td>
                            <td class="py-3 px-6 text-center">
                                <button class="take-exam-btn bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-full" data-id="${exam.id}">Take Exam</button>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No custom exams found.</td></tr>`;
            }
        } catch (error) {
            console.error('Fetch Custom Exams Error:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load custom exams.</td></tr>`;
        }
    }
    
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('take-exam-btn')) {
                const examId = e.target.dataset.id;
                if (window.loadPage) {
                    window.loadPage('take-exam-interface', `?exam_id=${examId}`);
                }
            }
        });
    }

    fetchAndDisplayCustomExams();
}
initializeCustomExamsPage();
