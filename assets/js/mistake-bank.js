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
            <div class="p-4 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 hover:bg-gray-50/50 transition-colors">
                <div class="flex gap-4 items-start flex-1 min-w-0">
                    <div class="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                        <span class="material-symbols-outlined text-xl md:text-2xl">library_books</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-gray-900 mb-1 truncate text-sm md:text-base" title="${ex.exam_title}">${ex.exam_title}</h3>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">subject</span> ${ex.subject_name}
                            </span>
                            <span class="hidden sm:inline text-gray-300">•</span>
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">schedule</span> ${new Date(ex.last_activity).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between lg:justify-end gap-4 md:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100 mt-2 lg:mt-0">
                    <div class="lg:text-right flex lg:block items-baseline gap-1 lg:gap-0">
                        <span class="block font-bold text-rose-600 text-lg md:text-xl leading-none">${ex.total_mistakes}</span>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mistakes</span>
                    </div>
                    
                    <div class="flex gap-2 flex-1 sm:flex-none justify-end">
                        <button onclick="startMasteryQuiz(${ex.exam_id})" 
                            class="flex-1 sm:flex-none whitespace-nowrap bg-gray-900 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-rose-600 transition-all shadow-sm hover:shadow-rose-100 transform active:scale-95">
                            Master Now
                        </button>
                        
                        <button onclick="deleteExamMistakes(${ex.exam_id}, '${ex.exam_title.replace(/'/g, "\\'")}')" 
                            class="p-2 md:p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Clear all mistakes for this exam">
                            <span class="material-symbols-outlined text-xl md:text-2xl">delete</span>
                        </button>
                    </div>
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

    window.deleteExamMistakes = async function (examId, examTitle) {
        if (!confirm(`Are you sure you want to clear all unresolved mistakes for "${examTitle}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch('api/mistakes/delete-exam.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId })
            });

            const result = await response.json();
            if (result.success) {
                // Refresh data
                await init();

                // Show a quick notification if possible (or just use basic alert for now)
                console.log(result.message);
            } else {
                alert('Error: ' + (result.message || 'Failed to delete mistakes'));
            }
        } catch (err) {
            console.error('Delete Error:', err);
            alert('Failed to delete mistakes. Please check your connection.');
        }
    };

    init();
})();
