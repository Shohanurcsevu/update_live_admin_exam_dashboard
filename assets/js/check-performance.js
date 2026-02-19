function initializeCheckPerformancePage() {
    // API Endpoints
    const API_URL = 'api/performance/';
    const SUBJECT_API_URL = 'api/exam/subjects.php'; // Re-using existing API for consistency
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // DOM Elements
    const container = document.getElementById('attempts-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreContainer = document.getElementById('load-more-container');
    const noAttemptsMessage = document.getElementById('no-attempts-message');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

    let offset = 0;
    const limit = 9;

    /**
     * Populates a dropdown selector with data from a given API endpoint.
     * @param {string} url - The API endpoint to fetch data from.
     * @param {HTMLElement} selector - The <select> element to populate.
     * @param {string} placeholder - The text for the default "All" option.
     * @param {boolean} isDependent - Whether this dropdown depends on a parent selection.
     */
    async function populateDropdown(url, selector, placeholder, isDependent = false) {
        selector.innerHTML = `<option value="0">${placeholder}</option>`;
        if (isDependent) selector.disabled = true;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                result.data.forEach(item => {
                    const name = item.subject_name || item.lesson_name || item.topic_name;
                    selector.innerHTML += `<option value="${item.id}">${name}</option>`;
                });
                if (isDependent) selector.disabled = false;
            }
        } catch (error) {
            console.error(`Failed to load data for ${placeholder}:`, error);
        }
    }

    /**
     * Fetches and displays exam attempts based on the current filter selections.
     * @param {boolean} append - Whether to append results to the container.
     */
    async function fetchAndDisplayAttempts(append = false) {
        if (!append) {
            offset = 0;
            container.innerHTML = '';
            noAttemptsMessage.classList.add('hidden');
        }

        let url = `${API_URL}list-attempts.php?`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);

        params.append('limit', limit);
        params.append('offset', offset);

        url += params.toString();

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                result.data.forEach(attempt => {
                    const score = parseFloat(attempt.score_with_negative).toFixed(2);
                    const totalMarks = parseFloat(attempt.total_marks).toFixed(2);
                    const date = new Date(attempt.attempt_time).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });

                    const card = `
                        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div class="flex flex-col h-full">
                                <div class="mb-4">
                                    <h3 class="text-lg font-bold text-gray-800 line-clamp-2">${attempt.exam_title}</h3>
                                    <p class="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                        <span class="material-symbols-outlined text-sm">calendar_today</span>
                                        ${date}
                                    </p>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4 mb-6">
                                    <div class="bg-blue-50 p-3 rounded-lg text-center">
                                        <p class="text-xs text-blue-600 font-semibold uppercase">Score</p>
                                        <p class="text-xl font-bold text-blue-700">${score}</p>
                                    </div>
                                    <div class="bg-gray-50 p-3 rounded-lg text-center">
                                        <p class="text-xs text-gray-500 font-semibold uppercase">Total</p>
                                        <p class="text-xl font-bold text-gray-700">${totalMarks}</p>
                                    </div>
                                </div>
                                
                                <div class="mt-auto">
                                    <button class="review-btn w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2" data-id="${attempt.id}">
                                        <span class="material-symbols-outlined text-lg">visibility</span> Review Attempt
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    container.insertAdjacentHTML('beforeend', card);
                });

                offset += result.data.length;

                if (result.data.length === limit) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            } else {
                if (!append) {
                    noAttemptsMessage.classList.remove('hidden');
                }
                loadMoreContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Fetch Attempts Error:', error);
            if (!append) {
                container.innerHTML = `<div class="col-span-full text-center py-10 text-red-500">Failed to load attempts. Please try again.</div>`;
            }
        }
    }

    // --- Event Listeners ---

    loadMoreBtn.addEventListener('click', () => fetchAndDisplayAttempts(true));

    subjectFilter.addEventListener('change', () => {
        const subjectId = subjectFilter.value;
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;

        if (subjectId > 0) {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectId}`, lessonFilter, 'All Lessons', true);
        } else {
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
        }
        fetchAndDisplayAttempts();
    });

    lessonFilter.addEventListener('change', () => {
        const lessonId = lessonFilter.value;
        if (lessonId > 0) {
            populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonId}`, topicFilter, 'All Topics', true);
        } else {
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;
        }
        fetchAndDisplayAttempts();
    });

    topicFilter.addEventListener('change', () => fetchAndDisplayAttempts());

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.review-btn');
        if (btn) {
            const attemptId = btn.dataset.id;
            if (window.loadPage) {
                window.loadPage('performance-review', `?attempt_id=${attemptId}`);
            }
        }
    });

    function initializePage() {
        populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects');
        fetchAndDisplayAttempts();
    }

    initializePage();
}

initializeCheckPerformancePage();
