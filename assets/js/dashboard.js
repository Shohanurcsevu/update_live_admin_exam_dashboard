
function initializeDashboardPage() {
    // --- URLs ---
    const METRICS_API_URL = 'api/dashboard-metrics.php';
    const EXAMS_API_URL = 'api/dashboard-exams.php';
    const DELETE_EXAM_API_URL = 'api/exam/exam.php'; // Re-use existing exam API for delete
    const SUBJECT_API_URL = 'api/exam/subjects.php';
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // --- DOM Elements ---
    const subjectFilter = document.getElementById('exam-subject-filter');
    const lessonFilter = document.getElementById('exam-lesson-filter');
    const topicFilter = document.getElementById('exam-topic-filter');
    const examCardsContainer = document.getElementById('exam-cards-container');
    const deleteModal = document.getElementById('delete-exam-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const toastContainer = document.getElementById('toast-container');

    // Print Options Elements
    const printOptionsModal = document.getElementById('print-options-modal');
    const closePrintModalBtn = document.getElementById('close-print-modal');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const modalExamIdSpan = document.getElementById('modal-exam-id');

    let examIdToDelete = null;
    let selectedExamIdForPrint = null;

    // --- Helper Functions ---
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor, icon;
        switch (type) {
            case 'error': bgColor = 'bg-red-500'; icon = 'error'; break;
            default: bgColor = 'bg-green-500'; icon = 'check_circle'; break;
        }
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s ease'; setTimeout(() => toast.remove(), 500); }, 3000);
    };

    // --- Section 1: Summary Cards Logic ---
    function animateCount(element, targetValue) {
        const end = parseInt(targetValue, 10);
        if (isNaN(end)) { element.textContent = targetValue; return; }
        const duration = 1200;
        let startTime = null;
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const progress = currentTime - startTime;
            const currentNumber = Math.min(Math.floor(progress / duration * end), end);
            element.textContent = currentNumber;
            if (progress < duration) requestAnimationFrame(animation);
            else element.textContent = end;
        }
        requestAnimationFrame(animation);
    }

    async function fetchAndDisplayMetrics() {
        try {
            const response = await fetch(METRICS_API_URL);
            const result = await response.json();
            if (result.success) {
                const metrics = result.data;
                animateCount(document.getElementById('total-subjects'), metrics.subjects);
                animateCount(document.getElementById('total-lessons'), metrics.lessons);
                animateCount(document.getElementById('total-topics'), metrics.topics);
                animateCount(document.getElementById('total-exams'), metrics.exams);
                animateCount(document.getElementById('total-questions'), metrics.questions);
            }
        } catch (error) { console.error("Error fetching metrics:", error); }
    }

    // --- Section 2: Exam Selection Logic ---
    async function populateDropdown(url, selector, placeholder, isDependent = false) {
        selector.innerHTML = `<option value="0">${placeholder}</option>`;
        if (isDependent) selector.disabled = true;
        try {
            const response = await fetch(url);
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                result.data.forEach(item => {
                    selector.innerHTML += `<option value="${item.id}">${item.subject_name || item.lesson_name || item.topic_name}</option>`;
                });
                if (isDependent) selector.disabled = false;
            }
        } catch (error) { console.error(`Dropdown Error for ${placeholder}:`, error); }
    }

    function renderChart(canvasId, history) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || !history || history.length === 0) return;
        if (Chart.getChart(canvasId)) Chart.getChart(canvasId).destroy();
        new Chart(ctx, {
            type: 'line',
            data: { labels: history.map(h => `Attempt ${h.attempt}`), datasets: [{ label: 'Score', data: history.map(h => h.score), borderColor: 'rgba(59, 130, 246, 0.5)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Score: ${context.raw}` } } } }
        });
    }

    let currentOffset = 0;
    const PAGE_SIZE = 6;

    async function fetchAndDisplayExams(isLoadMore = false) {
        // Ensure isLoadMore is strictly boolean
        const loadingMore = isLoadMore === true;
        const container = document.getElementById('load-more-container');
        const btn = document.getElementById('load-more-btn');

        if (!loadingMore) {
            currentOffset = 0;
            examCardsContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">Loading exams...</p>';
            if (container) container.classList.add('hidden');
        }

        let url = `${EXAMS_API_URL}?limit=${PAGE_SIZE}&offset=${currentOffset}`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);

        const filterStr = params.toString();
        if (filterStr) url += '&' + filterStr;

        // 1. Try to load from Cache (IndexedDB) first (only for initial load)
        if (!isLoadMore && currentOffset === 0) {
            try {
                if (typeof idbManager !== 'undefined') {
                    const cachedExams = await idbManager.getAll('exams');
                    if (cachedExams && cachedExams.length > 0) {
                        let filteredExams = cachedExams;
                        if (subjectFilter.value > 0) filteredExams = filteredExams.filter(e => e.subject_id == subjectFilter.value);
                        if (lessonFilter.value > 0) filteredExams = filteredExams.filter(e => e.lesson_id == lessonFilter.value);
                        if (topicFilter.value > 0) filteredExams = filteredExams.filter(e => e.topic_id == topicFilter.value);

                        if (filteredExams.length > 0) {
                            // Slice to PAGE_SIZE for initial cache display to keep it snappy
                            displayExams(filteredExams.slice(0, PAGE_SIZE), false);
                        }
                    }
                }
            } catch (cacheError) {
                console.warn("Cache load failed:", cacheError);
            }
        }

        console.log(`Fetching exams: offset=${currentOffset}, limit=${PAGE_SIZE}, isLoadMore=${loadingMore}`);

        // 2. Fetch from API (Revalidate)
        try {
            if (loadingMore && btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Loading...';
            }

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                displayExams(result.data, loadingMore);

                // Update Cache (only for the initial/main list to keep it fast)
                if (typeof idbManager !== 'undefined' && currentOffset === 0) {
                    const changes = { exams: result.data };
                    await idbManager.performSyncTransaction(changes);
                }

                // Handle Pagination UI
                if (result.pagination) {
                    console.log('Pagination info:', result.pagination);
                    if (result.pagination.hasMore) {
                        if (container) container.classList.remove('hidden');
                        currentOffset += PAGE_SIZE;
                    } else {
                        if (container) container.classList.add('hidden');
                    }
                }
            } else if (result.success && result.data.length === 0 && !loadingMore) {
                examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found for the selected filters.</p>`;
                if (container) container.classList.add('hidden');
            }
        } catch (error) {
            console.error('Fetch Exams Error:', error);
            if (!loadingMore && (examCardsContainer.innerHTML === '' || examCardsContainer.innerHTML.includes('Loading exams...'))) {
                examCardsContainer.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Failed to load exams.</p>`;
            }
        } finally {
            if (loadingMore && btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined">expand_more</span> Load More Exams';
            }
        }
    }

    function displayExams(exams, append = false) {
        if (!append) examCardsContainer.innerHTML = '';

        if (exams.length === 0 && !append) {
            examCardsContainer.innerHTML = `<p class="text-gray-500 col-span-full text-center py-8">No exams found.</p>`;
            return;
        }

        exams.forEach(exam => {
            const breadcrumb = exam.subject_name ? `${exam.subject_name} > ${exam.lesson_name} > ${exam.topic_name}` : 'Custom Model Test';
            const history = exam.performance_history || [];
            const lastScore = history.length > 0 ? history[history.length - 1].score.toFixed(2) : 'N/A';
            const cardId = `exam-card-dashboard-${exam.id}`;

            // Avoid duplicate cards if cache and API both return same items
            if (document.getElementById(cardId)) return;

            const card = `
                <div id="${cardId}" class="bg-white p-5 rounded-lg shadow-md flex flex-col hover:shadow-lg transition-shadow">
                <h3 
                    class="text-lg font-bold text-gray-800 truncate cursor-pointer flex items-center gap-2 copy-exam-id"
                    data-exam-id="${exam.id}"
                    title="Click to copy Exam ID"
                >
                    Exam ID : ${exam.id}
                    <span class="material-symbols-outlined text-base text-gray-400 hover:text-blue-600">
                    content_copy
                    </span>
                </h3>
                <button 
                    class="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer copy-json-btn mb-3 transition-colors" 
                    data-id="${exam.id}"
                >
                    <span class="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copy JSON</span>
                </button>

                    <h3 class="text-lg font-bold text-gray-800 truncate">${exam.exam_title}</h3>
                    <p class="text-xs text-gray-500 mb-4 truncate">${breadcrumb}</p>
                    <div class="flex-grow space-y-2 text-sm text-gray-600 mb-4">
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">timer</span>${exam.duration} Minutes</p>
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">help</span>${exam.total_questions || 0} Questions</p>
                        <p class="flex items-center"><span class="material-symbols-outlined text-base mr-2">military_tech</span>${parseFloat(exam.total_marks || 0).toFixed(0)} Marks</p>
                    </div>
                    <div class="mt-auto border-t pt-4">
                        <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-gray-500">Last Score:</span><span class="text-lg font-bold ${lastScore === 'N/A' ? 'text-gray-400' : 'text-blue-600'}">${lastScore}</span></div>
                        <div class="h-24"><canvas id="chart-exam-${exam.id}"></canvas></div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button class="take-exam-btn flex-1 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors" data-id="${exam.id}">Take Exam</button>
                        <button class="print-options-btn bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" title="Print Options">
                            <span class="material-symbols-outlined">print</span>
                        </button>
                        <button class="delete-exam-btn bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-2 px-3 rounded-lg transition-colors" data-id="${exam.id}" title="Delete Exam"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>`;
            examCardsContainer.insertAdjacentHTML('beforeend', card);
        });

        exams.forEach(exam => {
            const history = exam.performance_history || [];
            if (history.length > 0) renderChart(`chart-exam-${exam.id}`, history);
        });
    }
    document.addEventListener("click", function (e) {
        const el = e.target.closest(".copy-exam-id");
        if (el) {
            const examId = el.dataset.examId;
            navigator.clipboard.writeText(examId).then(() => {
                const icon = el.querySelector(".material-symbols-outlined");
                const original = icon.textContent;
                icon.textContent = "check";
                icon.classList.add("text-green-600");
                setTimeout(() => {
                    icon.textContent = original;
                    icon.classList.remove("text-green-600");
                }, 1200);
            });
        }

        const jsonEl = e.target.closest(".copy-json-btn");
        if (jsonEl && !jsonEl.disabled) {
            const examId = jsonEl.dataset.id;
            const icon = jsonEl.querySelector(".material-symbols-outlined");
            const btnText = jsonEl.querySelector("span:not(.material-symbols-outlined)");
            const originalIcon = icon.textContent;

            jsonEl.disabled = true;
            icon.textContent = "hourglass_empty";

            fetch(`https://bcspreli.free.nf/api/take-exam/start.php?exam_id=${examId}`)
                .then(res => res.text())
                .then(data => {
                    return navigator.clipboard.writeText(data);
                })
                .then(() => {
                    icon.textContent = "check";
                    jsonEl.classList.add("text-green-600");
                    setTimeout(() => {
                        icon.textContent = originalIcon;
                        jsonEl.classList.remove("text-green-600");
                        jsonEl.disabled = false;
                    }, 1200);
                })
                .catch(err => {
                    console.error("Copy JSON failed:", err);
                    icon.textContent = originalIcon;
                    jsonEl.disabled = false;
                });
        }

    });

    const dashContainer = document.getElementById('dashboard-container');
    if (dashContainer) {
        dashContainer.addEventListener('click', (e) => {
            const loadMoreEl = e.target.closest("#load-more-btn");
            if (loadMoreEl && !loadMoreEl.disabled) {
                console.log("Dashboard Load More clicked, current offset:", currentOffset);
                fetchAndDisplayExams(true);
            }
        });
    }

    const openDeleteModal = (id) => {
        examIdToDelete = id;
        deleteModal.classList.remove('hidden');
        deleteModal.classList.add('flex');
    };
    const closeDeleteModal = () => {
        examIdToDelete = null;
        deleteModal.classList.add('hidden');
        deleteModal.classList.remove('flex');
    };
    const handleDeleteConfirm = async () => {
        if (!examIdToDelete) return;
        try {
            const response = await fetch(`${DELETE_EXAM_API_URL}?action=delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: examIdToDelete })
            });
            const result = await response.json();
            showToast(result.message, result.success ? 'success' : 'error');
            if (result.success) {
                fetchAndDisplayExams();
            }
        } catch (error) { showToast('A network error occurred.', 'error'); }
        finally {
            closeDeleteModal();
        }
    };

    // --- Print Logic Implementation ---
    const openPrintModal = (id) => {
        PrintEngine.onGenerate = processAndPrint;
        PrintEngine.openModal(id);
    };

    async function processAndPrint() {
        const examId = PrintEngine.selectedExamId;
        if (!examId) return;

        generatePdfBtn.disabled = true;
        generatePdfBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Fetching Data...';

        try {
            const response = await fetch(`https://bcspreli.free.nf/api/take-exam/start.php?exam_id=${examId}`);
            const result = await response.json();

            if (!result.success || !result.data) throw new Error('Failed to fetch exam data');

            PrintEngine.generatePDF(result.data);
            showToast('PDF generation triggered successfully!');
            PrintEngine.closeModal();

        } catch (error) {
            console.error(error);
            showToast('Failed to generate PDF: ' + error.message, 'error');
        } finally {
            generatePdfBtn.disabled = false;
            generatePdfBtn.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span> Generate PDF Questions';
        }
    }

    // --- Event Listeners & Initial Load ---
    function setupEventListeners() {
        subjectFilter.addEventListener('change', () => {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectFilter.value}`, lessonFilter, 'All Lessons', true);
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;
            fetchAndDisplayExams(false);
        });

        lessonFilter.addEventListener('change', () => {
            populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonFilter.value}`, topicFilter, 'All Topics', true);
            fetchAndDisplayExams(false);
        });

        topicFilter.addEventListener('change', () => fetchAndDisplayExams(false));

        examCardsContainer.addEventListener('click', (e) => {
            const takeExamBtn = e.target.closest('.take-exam-btn');
            const deleteExamBtn = e.target.closest('.delete-exam-btn');
            const printOptionsBtn = e.target.closest('.print-options-btn');

            if (takeExamBtn) {
                const examId = takeExamBtn.dataset.id;
                if (window.loadPage) window.loadPage('take-exam-interface', `?exam_id=${examId}`);
            }
            if (deleteExamBtn) {
                const examId = deleteExamBtn.dataset.id;
                openDeleteModal(examId);
            }
            if (printOptionsBtn) {
                const examId = printOptionsBtn.dataset.id;
                openPrintModal(examId);
            }
        });

        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

        // Print Options Listeners
        if (closePrintModalBtn) closePrintModalBtn.addEventListener('click', closePrintModal);

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === printOptionsModal) closePrintModal();
            if (e.target === deleteModal) closeDeleteModal();
        });
    }

    // --- Action Hub Logic ---
    async function checkRecentAttempt() {
        if (typeof idbManager === 'undefined') return;

        try {
            const attempt = await idbManager.getLatestInProgressAttempt();
            const resumeCard = document.getElementById('resume-card');
            const resumeTitle = document.getElementById('resume-exam-title');
            const resumeProgress = document.getElementById('resume-progress');
            const resumeBtn = document.getElementById('resume-btn');

            if (attempt) {
                // Get exam title
                const exam = await idbManager.getById('exams', attempt.exam_id);
                resumeTitle.textContent = exam ? exam.exam_title : 'Unknown Exam';

                const answeredCount = Object.keys(attempt.answers || {}).length;
                resumeProgress.textContent = `${answeredCount} questions answered`;

                resumeBtn.onclick = () => {
                    console.log("Resuming exam:", attempt.exam_id);
                    if (window.loadPage) window.loadPage('take-offline-exam', `?exam_id=${attempt.exam_id}&attempt_uuid=${attempt.id}`);
                };

                resumeCard.classList.remove('hidden');
            } else {
                resumeCard.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error checking recent attempt:", error);
        }
    }

    function setupActionHub() {
        const daily10Btn = document.getElementById('daily-10-btn');
        if (daily10Btn) {
            daily10Btn.addEventListener('click', () => {
                console.log("Dashboard: Starting Daily 15 Quiz...");

                // Visual feedback
                const originalContent = daily10Btn.innerHTML;
                daily10Btn.disabled = true;
                daily10Btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">sync</span> Preparing...`;

                if (window.loadPage) {
                    window.loadPage('take-offline-exam', `?mode=daily_15`);
                } else {
                    console.error("loadPage not found");
                    daily10Btn.disabled = false;
                    daily10Btn.innerHTML = originalContent;
                }
            });
        }
        checkRecentAttempt();
    }

    function initializePage() {
        fetchAndDisplayMetrics();
        populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects');
        fetchAndDisplayExams();
        setupEventListeners();
        setupActionHub();
    }
    initializePage();
}

initializeDashboardPage();

