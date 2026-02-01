function initializeCheckPerformancePage() {
    // API Endpoints
    const API_URL = 'api/performance/';
    const SUBJECT_API_URL = 'api/exam/subjects.php'; // Re-using existing API for consistency
    const LESSON_API_URL = 'api/exam/lessons.php';
    const TOPIC_API_URL = 'api/exam/topics.php';

    // DOM Elements
    const tableBody = document.getElementById('attempts-table-body');
    const subjectFilter = document.getElementById('subject-filter');
    const lessonFilter = document.getElementById('lesson-filter');
    const topicFilter = document.getElementById('topic-filter');

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
                    // Use a generic way to get the name property
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
     */
    async function fetchAndDisplayAttempts() {
        let url = `${API_URL}list-attempts.php?`;
        const params = new URLSearchParams();
        if (subjectFilter.value > 0) params.append('subject_id', subjectFilter.value);
        if (lessonFilter.value > 0) params.append('lesson_id', lessonFilter.value);
        if (topicFilter.value > 0) params.append('topic_id', topicFilter.value);
        url += params.toString();

        try {
            const response = await fetch(url);
            const result = await response.json();
            tableBody.innerHTML = ''; // Clear previous results
            if (result.success && result.data.length > 0) {
                result.data.forEach(attempt => {
                    const row = `
                        <tr class="border-b border-gray-200 hover:bg-gray-100">
                            <td class="py-3 px-6 text-left font-medium">${attempt.exam_title}</td>
                            <td class="py-3 px-6 text-left">${new Date(attempt.attempt_time).toLocaleString()}</td>
                            <td class="py-3 px-6 text-center font-semibold">${parseFloat(attempt.score_with_negative).toFixed(2)}</td>
                            <td class="py-3 px-6 text-center">${parseFloat(attempt.total_marks).toFixed(2)}</td>
                            <td class="py-3 px-6 text-center">
                                <button class="review-btn bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-full" data-id="${attempt.id}">Review</button>
                            </td>
                        </tr>`;
                    tableBody.innerHTML += row;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No attempts found for the selected filters.</td></tr>`;
            }
        } catch (error) {
            console.error('Fetch Attempts Error:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load attempts.</td></tr>`;
        }
    }

    // --- Event Listeners for Cascading Logic ---

    // 1. When Subject changes
    subjectFilter.addEventListener('change', () => {
        const subjectId = subjectFilter.value;
        // Reset topic filter
        topicFilter.innerHTML = '<option value="0">All Topics</option>';
        topicFilter.disabled = true;
        
        if (subjectId > 0) {
            populateDropdown(`${LESSON_API_URL}?subject_id=${subjectId}`, lessonFilter, 'All Lessons', true);
        } else {
            // Reset lesson filter if "All Subjects" is chosen
            lessonFilter.innerHTML = '<option value="0">All Lessons</option>';
            lessonFilter.disabled = true;
        }
        // Fetch attempts with the new subject (and reset lesson/topic)
        fetchAndDisplayAttempts();
    });

    // 2. When Lesson changes
    lessonFilter.addEventListener('change', () => {
        const lessonId = lessonFilter.value;
        if (lessonId > 0) {
            populateDropdown(`${TOPIC_API_URL}?lesson_id=${lessonId}`, topicFilter, 'All Topics', true);
        } else {
            // Reset topic filter if "All Lessons" is chosen
            topicFilter.innerHTML = '<option value="0">All Topics</option>';
            topicFilter.disabled = true;
        }
        // Fetch attempts with the new lesson filter
        fetchAndDisplayAttempts();
    });

    // 3. When Topic changes, just refetch attempts
    topicFilter.addEventListener('change', fetchAndDisplayAttempts);

    // Event listener for review buttons
    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('review-btn')) {
            const attemptId = e.target.dataset.id;
            if (window.loadPage) {
                window.loadPage('performance-review', `?attempt_id=${attemptId}`);
            }
        }
    });

    // --- Initial Page Load ---
    function initializePage() {
        populateDropdown(SUBJECT_API_URL, subjectFilter, 'All Subjects');
        fetchAndDisplayAttempts();
    }

    initializePage();
}

initializeCheckPerformancePage();
