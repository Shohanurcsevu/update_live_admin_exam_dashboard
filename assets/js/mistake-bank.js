(function () {
    console.log("Mistake Bank: Script loaded and initializing...");
    const listContainer = document.getElementById('mistake-exams-list');
    const searchInput = document.getElementById('mistake-exam-search');
    let allExams = [];

    async function init() {
        if (!listContainer) return;
        try {
            const response = await fetch('api/mistakes/list-exams.php');
            const result = await response.json();

            if (result.success) {
                allExams = result.data;
                renderExams(allExams);
                updateCounters(allExams);
            }
        } catch (err) {
            listContainer.innerHTML = `<div class="p-12 text-center text-rose-500">Failed to load mistakes.</div>`;
        }
    }

    function updateCounters(exams) {
        const total = exams.reduce((sum, ex) => sum + ex.total_mistakes, 0);
        const totalEl = document.getElementById('total-mistakes-count');
        const affectedEl = document.getElementById('affected-exams-count');
        if (totalEl) totalEl.textContent = total;
        if (affectedEl) affectedEl.textContent = exams.length;
    }

    function renderExams(exams) {
        if (!listContainer) return;

        if (exams.length === 0) {
            listContainer.innerHTML = `
                <div class="p-12 text-center text-gray-500">
                    <span class="material-symbols-outlined text-5xl mb-4 text-emerald-400">check_circle</span>
                    <p class="font-medium text-gray-900 text-lg">Your Bank is Empty!</p>
                    <p>Great job! You don't have any unresolved mistakes.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = exams.map(ex => `
            <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                <div class="flex gap-4 items-start">
                    <div class="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                        <span class="material-symbols-outlined">library_books</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900 mb-0.5">${ex.exam_title}</h3>
                        <div class="flex items-center gap-3 text-xs text-gray-500">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">subject</span> ${ex.subject_name}
                            </span>
                            <span>•</span>
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">schedule</span> ${new Date(ex.last_activity).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center gap-6">
                    <div class="text-right">
                        <span class="block font-bold text-rose-600 text-xl">${ex.total_mistakes}</span>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mistakes</span>
                    </div>
                    <button onclick="startMasteryQuiz(${ex.exam_id})" 
                        class="whitespace-nowrap bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-600 transition-all shadow-sm hover:shadow-rose-100 transform active:scale-95">
                        Master This Exam
                    </button>
                </div>
            </div>
        `).join('');
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allExams.filter(ex =>
                ex.exam_title.toLowerCase().includes(term) ||
                ex.subject_name.toLowerCase().includes(term)
            );
            renderExams(filtered);
        });
    }

    window.startMasteryQuiz = function (examId = null) {
        console.log("Mistake Bank: Starting Mastery Quiz for exam:", examId);
        let url = `?mode=mastery_quiz`;
        if (examId !== null) url += `&exam_id=${examId}`;

        if (window.loadPage) {
            window.loadPage('take-offline-exam', url);
        }
    };

    init();
})();
