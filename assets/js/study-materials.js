(function () {
    'use strict';

    // State
    const state = {
        subjects: []
    };

    // DOM Elements
    const elements = {
        hierarchyLoading: document.getElementById('hierarchy-loading'),
        hierarchyTree: document.getElementById('hierarchy-tree'),
        toastContainer: document.getElementById('toast-container')
    };

    // Show toast
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg mb-2 transition-opacity duration-300 flex items-center gap-2`;
        toast.innerHTML = `<span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span> ${message}`;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Fetch data with caching
    async function fetchData(url) {
        if (typeof CacheManager !== 'undefined') {
            return await CacheManager.fetchWithCache(url, 60);
        }
        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to fetch data');
        return result.data;
    }

    // Initial Fetch
    async function init() {
        try {
            const subjectsData = await fetchData('api/custom-exam/subjects-with-details.php');
            state.subjects = subjectsData.sort((a, b) => a.subject_id - b.subject_id);
            renderHierarchy();
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to load subjects.', 'error');
            elements.hierarchyLoading.innerHTML = '<p class="text-red-500">Failed to load data.</p>';
        }
    }

    function renderHierarchy() {
        elements.hierarchyLoading.classList.add('hidden');
        elements.hierarchyTree.classList.remove('hidden');
        elements.hierarchyTree.innerHTML = '';

        state.subjects.forEach(subject => {
            const subjectDiv = createSubjectElement(subject);
            elements.hierarchyTree.appendChild(subjectDiv);
        });
    }

    function createSubjectElement(subject) {
        const div = document.createElement('div');
        div.className = 'border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm';

        const header = document.createElement('div');
        header.className = 'hierarchy-header py-4 px-5 bg-slate-50 border-b border-transparent';
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-slate-400 mr-3">chevron_right</span>
            <div class="flex-1">
                <span class="font-bold text-slate-800 text-lg">${subject.subject_name}</span>
                <span class="ml-2 text-sm text-slate-400">(${subject.lessons.length} lessons)</span>
            </div>
        `;

        const lessonsContainer = document.createElement('div');
        lessonsContainer.className = 'hierarchy-item hidden space-y-3 py-3';

        subject.lessons.forEach(lesson => {
            const lessonDiv = createLessonElement(lesson, subject);
            lessonsContainer.appendChild(lessonDiv);
        });

        header.addEventListener('click', () => {
            const isHidden = lessonsContainer.classList.contains('hidden');
            header.querySelector('.expand-icon').classList.toggle('expanded', isHidden);
            lessonsContainer.classList.toggle('hidden');
            header.classList.toggle('border-slate-200', !isHidden);
        });

        div.appendChild(header);
        div.appendChild(lessonsContainer);
        return div;
    }

    function createLessonElement(lesson, subject) {
        const div = document.createElement('div');
        div.className = 'border border-slate-100 rounded-lg bg-white mr-5';

        const header = document.createElement('div');
        header.className = 'hierarchy-header py-3 px-4';
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-slate-400 mr-3">chevron_right</span>
            <div class="flex-1">
                <span class="font-semibold text-slate-700">${lesson.lesson_name}</span>
                <span class="ml-2 text-xs text-slate-400 lessons-count">... topics</span>
            </div>
        `;

        const topicsContainer = document.createElement('div');
        topicsContainer.className = 'hierarchy-item hidden space-y-2 py-2';

        async function expandLesson() {
            if (topicsContainer.children.length > 0) return;
            topicsContainer.innerHTML = '<div class="py-2 text-xs text-slate-400 flex items-center px-4"><span class="material-symbols-outlined animate-spin mr-2 text-xs">sync</span> Loading topics...</div>';

            try {
                const topics = await fetchData(`api/custom-exam/topics.php?lesson_id=${lesson.lesson_id}`);
                lesson.topics = topics || [];
                header.querySelector('.lessons-count').textContent = `(${lesson.topics.length} topics)`;
                topicsContainer.innerHTML = '';

                if (lesson.topics.length === 0) {
                    topicsContainer.innerHTML = '<div class="py-2 text-xs text-slate-400 px-4">No topics available.</div>';
                    return;
                }

                lesson.topics.forEach(topic => {
                    const topicDiv = createTopicElement(topic, lesson, subject);
                    topicsContainer.appendChild(topicDiv);
                });
            } catch (error) {
                topicsContainer.innerHTML = '<div class="py-2 text-xs text-red-400 px-4">Failed to load topics.</div>';
            }
        }

        header.addEventListener('click', () => {
            const isHidden = topicsContainer.classList.contains('hidden');
            header.querySelector('.expand-icon').classList.toggle('expanded', isHidden);
            topicsContainer.classList.toggle('hidden');
            if (isHidden) expandLesson();
        });

        div.appendChild(header);
        div.appendChild(topicsContainer);
        return div;
    }

    function createTopicElement(topic, lesson, subject) {
        const div = document.createElement('div');
        div.className = 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg mr-4 ml-2 transition-colors duration-200 group';

        div.innerHTML = `
            <div class="flex-1">
                <div class="font-medium text-slate-700">${topic.topic_name}</div>
                <div class="text-xs text-slate-400 mt-0.5">${topic.total_questions} questions available</div>
            </div>
            <button class="generate-btn bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap" 
                data-id="${topic.id}">
                <span class="material-symbols-outlined text-sm">menu_book</span>
                Generate Materials
            </button>
        `;

        const btn = div.querySelector('.generate-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            generateForTopic(topic.id, btn);
        });

        return div;
    }

    async function generateForTopic(topicId, btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Generating...';

        try {
            const response = await fetch(`api/question/list-by-topic.php?topic_id=${topicId}`);
            const result = await response.json();

            if (result.success && result.data.questions.length > 0) {
                if (window.StudyMaterialEngine) {
                    StudyMaterialEngine.generate(result.data);
                    showToast('Materials generated successfully!', 'success');
                } else {
                    showToast('Study engine not found.', 'error');
                }
            } else {
                showToast(result.message || 'No questions found for this topic.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to fetch data.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    init();
})();
