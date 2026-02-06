// Topic-wise Exams JavaScript
(function () {
    'use strict';

    // State management
    const state = {
        currentStep: 1,
        subjects: [],
        selectedTopics: new Map(), // Map<topicId, {subjectId, lessonId, topicName, questionCount, maxQuestions}>
        examDetails: {},
        cache: new Map()
    };

    // DOM Elements
    const elements = {
        hierarchyLoading: document.getElementById('hierarchy-loading'),
        hierarchyTree: document.getElementById('hierarchy-tree'),
        selectionSummary: document.getElementById('selection-summary'),
        totalSelected: document.getElementById('total-selected'),
        selectedTopicsList: document.getElementById('selected-topics-list'),

        // Step containers
        step1Content: document.getElementById('step-1-content'),
        step2Content: document.getElementById('step-2-content'),
        step3Content: document.getElementById('step-3-content'),

        // Step indicators
        step1Indicator: document.getElementById('step-1-indicator'),
        step2Indicator: document.getElementById('step-2-indicator'),
        step3Indicator: document.getElementById('step-3-indicator'),
        step1IndicatorMobile: document.getElementById('step-1-indicator-mobile'),
        step2IndicatorMobile: document.getElementById('step-2-indicator-mobile'),
        step3IndicatorMobile: document.getElementById('step-3-indicator-mobile'),

        // Navigation buttons
        nextToStep2: document.getElementById('next-to-step-2'),
        backToStep1: document.getElementById('back-to-step-1'),
        nextToStep3: document.getElementById('next-to-step-3'),
        backToStep2: document.getElementById('back-to-step-2'),
        generateExamBtn: document.getElementById('generate-exam-btn'),

        // Form fields
        examName: document.getElementById('exam-name'),
        examDuration: document.getElementById('exam-duration'),
        examMarks: document.getElementById('exam-marks'),
        examNegative: document.getElementById('exam-negative'),
        examTotalQuestions: document.getElementById('exam-total-questions'),

        // Review fields
        reviewName: document.getElementById('review-name'),
        reviewDuration: document.getElementById('review-duration'),
        reviewMarks: document.getElementById('review-marks'),
        reviewQuestions: document.getElementById('review-questions'),
        reviewNegative: document.getElementById('review-negative'),
        reviewTopicsList: document.getElementById('review-topics-list')
    };

    // Utility: Show toast notification
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

        toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg mb-2 transition-opacity duration-300`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Fetch data with caching
    async function fetchData(url) {
        if (state.cache.has(url)) return state.cache.get(url);

        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to fetch data');

        state.cache.set(url, result.data);
        return result.data;
    }

    // Fetch hierarchical data (subjects -> lessons initially)
    async function fetchHierarchicalData() {
        try {
            const subjectsData = await fetchData('api/custom-exam/subjects-with-details.php');
            state.subjects = subjectsData.sort((a, b) => a.subject_id - b.subject_id);
            renderHierarchy();
        } catch (error) {
            console.error('Error fetching hierarchical data:', error);
            showToast('Failed to load subjects. Please refresh the page.', 'error');
            elements.hierarchyLoading.innerHTML = '<p class="text-red-500 text-center">Failed to load data.</p>';
        }
    }

    // Render hierarchical tree
    function renderHierarchy() {
        elements.hierarchyLoading.classList.add('hidden');
        elements.hierarchyTree.classList.remove('hidden');
        elements.hierarchyTree.innerHTML = '';

        state.subjects.forEach(subject => {
            const subjectDiv = createSubjectElement(subject);
            elements.hierarchyTree.appendChild(subjectDiv);
        });
    }

    // Create subject element
    function createSubjectElement(subject) {
        const div = document.createElement('div');
        div.className = 'border rounded-lg p-3 bg-gray-50';

        const header = document.createElement('div');
        header.className = 'hierarchy-header';
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-gray-600 mr-2">chevron_right</span>
            <span class="font-bold text-gray-800">${subject.subject_name}</span>
            <span class="ml-2 text-sm text-gray-500">(${subject.lessons.length} lessons)</span>
        `;

        const lessonsContainer = document.createElement('div');
        lessonsContainer.className = 'hierarchy-item hidden mt-2 space-y-2';

        subject.lessons.forEach(lesson => {
            const lessonDiv = createLessonElement(lesson, subject.subject_id);
            lessonsContainer.appendChild(lessonDiv);
        });

        header.addEventListener('click', () => {
            const icon = header.querySelector('.expand-icon');
            icon.classList.toggle('expanded');
            lessonsContainer.classList.toggle('hidden');
        });

        div.appendChild(header);
        div.appendChild(lessonsContainer);

        return div;
    }

    // Create lesson element
    function createLessonElement(lesson, subjectId) {
        const div = document.createElement('div');
        div.className = 'border rounded-lg p-2 bg-white';

        const header = document.createElement('div');
        header.className = 'hierarchy-header';
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-gray-600 mr-2">chevron_right</span>
            <span class="font-semibold text-gray-700">${lesson.lesson_name}</span>
            <span class="ml-2 text-sm text-gray-500 lessons-count">... topics</span>
        `;

        const topicsContainer = document.createElement('div');
        topicsContainer.className = 'hierarchy-item hidden mt-2 space-y-1';

        async function expandLesson() {
            if (topicsContainer.children.length > 0) return;

            topicsContainer.innerHTML = '<div class="py-2 text-sm text-gray-500 flex items-center"><span class="material-symbols-outlined animate-spin mr-2 text-xs">sync</span> Loading topics...</div>';

            try {
                const topics = await fetchData(`api/custom-exam/topics.php?lesson_id=${lesson.lesson_id}`);
                lesson.topics = topics || [];

                header.querySelector('.lessons-count').textContent = `(${lesson.topics.length} topics)`;
                topicsContainer.innerHTML = '';

                if (lesson.topics.length === 0) {
                    topicsContainer.innerHTML = '<div class="py-2 text-sm text-gray-500">No topics available.</div>';
                    return;
                }

                lesson.topics.forEach(topic => {
                    const topicDiv = createTopicElement(topic, subjectId, lesson.lesson_id);
                    topicsContainer.appendChild(topicDiv);
                });
            } catch (error) {
                topicsContainer.innerHTML = '<div class="py-2 text-sm text-red-500">Failed to load topics.</div>';
            }
        }

        header.addEventListener('click', () => {
            const icon = header.querySelector('.expand-icon');
            icon.classList.toggle('expanded');
            topicsContainer.classList.toggle('hidden');
            if (!topicsContainer.classList.contains('hidden')) {
                expandLesson();
            }
        });

        div.appendChild(header);
        div.appendChild(topicsContainer);

        return div;
    }

    // Create topic element (selectable)
    function createTopicElement(topic, subjectId, lessonId) {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3 p-2 bg-gray-50 rounded';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'topic-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
        checkbox.dataset.topicId = topic.id;
        checkbox.dataset.subjectId = subjectId;
        checkbox.dataset.lessonId = lessonId;
        checkbox.dataset.topicName = topic.topic_name;
        checkbox.dataset.maxQuestions = topic.total_questions;

        const label = document.createElement('label');
        label.className = 'flex-1 text-sm text-gray-700 cursor-pointer';
        label.innerHTML = `${topic.topic_name} <span class="text-gray-500">(${topic.total_questions} questions available)</span>`;

        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex items-center gap-2';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = topic.total_questions;
        input.placeholder = 'Qty';
        input.className = 'topic-input px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none';
        input.disabled = true;
        input.dataset.topicId = topic.id;

        checkbox.addEventListener('change', (e) => {
            input.disabled = !e.target.checked;
            if (e.target.checked) {
                input.value = Math.min(1, topic.total_questions); // Default to 5 or max available
                updateSelectedTopics();
            } else {
                input.value = '';
                state.selectedTopics.delete(topic.id);
                updateSelectedTopics();
            }
        });

        input.addEventListener('input', () => {
            if (checkbox.checked) {
                updateSelectedTopics();
            }
        });

        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        inputContainer.appendChild(input);

        div.appendChild(checkbox);
        div.appendChild(label);
        div.appendChild(inputContainer);

        return div;
    }

    // Update selected topics state
    function updateSelectedTopics() {
        state.selectedTopics.clear();
        let totalQuestions = 0;
        let hasError = false;

        document.querySelectorAll('.topic-checkbox:checked').forEach(checkbox => {
            const topicId = checkbox.dataset.topicId;
            const input = document.querySelector(`.topic-input[data-topic-id="${topicId}"]`);
            const questionCount = parseInt(input.value) || 0;
            const maxQuestions = parseInt(checkbox.dataset.maxQuestions);

            if (questionCount > maxQuestions) {
                input.classList.add('border-red-500');
                hasError = true;
            } else {
                input.classList.remove('border-red-500');
            }

            if (questionCount > 0 && questionCount <= maxQuestions) {
                state.selectedTopics.set(topicId, {
                    subjectId: checkbox.dataset.subjectId,
                    lessonId: checkbox.dataset.lessonId,
                    topicName: checkbox.dataset.topicName,
                    questionCount: questionCount,
                    maxQuestions: maxQuestions
                });
                totalQuestions += questionCount;
            }
        });

        // Update UI
        elements.totalSelected.textContent = totalQuestions;

        if (state.selectedTopics.size > 0) {
            elements.selectionSummary.classList.remove('hidden');
            elements.selectedTopicsList.innerHTML = Array.from(state.selectedTopics.entries())
                .map(([id, data]) => `<div>• ${data.topicName}: ${data.questionCount} questions</div>`)
                .join('');
        } else {
            elements.selectionSummary.classList.add('hidden');
        }

        // Enable/disable next button
        elements.nextToStep2.disabled = state.selectedTopics.size === 0 || hasError || totalQuestions === 0;
    }

    // Step navigation
    function goToStep(step) {
        // Hide all steps
        elements.step1Content.classList.add('hidden');
        elements.step2Content.classList.add('hidden');
        elements.step3Content.classList.add('hidden');

        // Update indicators
        updateStepIndicators(step);

        // Show current step
        if (step === 1) {
            elements.step1Content.classList.remove('hidden');
        } else if (step === 2) {
            elements.step2Content.classList.remove('hidden');
            // Pre-fill total questions and auto-calculate duration/marks
            const totalQuestions = Array.from(state.selectedTopics.values())
                .reduce((sum, topic) => sum + topic.questionCount, 0);
            elements.examTotalQuestions.value = totalQuestions;
            elements.examDuration.value = totalQuestions; // Duration = number of questions
            elements.examMarks.value = totalQuestions; // Marks = number of questions
        } else if (step === 3) {
            elements.step3Content.classList.remove('hidden');
            populateReviewSection();
        }

        state.currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update step indicators
    function updateStepIndicators(activeStep) {
        const indicators = [
            { desktop: elements.step1Indicator, mobile: elements.step1IndicatorMobile, step: 1 },
            { desktop: elements.step2Indicator, mobile: elements.step2IndicatorMobile, step: 2 },
            { desktop: elements.step3Indicator, mobile: elements.step3IndicatorMobile, step: 3 }
        ];

        indicators.forEach(({ desktop, mobile, step }) => {
            const isActive = step <= activeStep;
            const circle = desktop.querySelector('div');
            const circleMobile = mobile.querySelector('div');
            const text = desktop.querySelector('span:last-child');
            const textMobile = mobile.querySelector('span:last-child');

            if (step === activeStep) {
                circle.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm md:text-base';
                circleMobile.className = 'w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold';
                text.className = 'ml-2 font-semibold text-gray-800 text-sm md:text-base';
                textMobile.className = 'mt-1 text-xs font-semibold text-gray-800';
                desktop.classList.remove('opacity-50');
                mobile.classList.remove('opacity-50');
            } else if (step < activeStep) {
                circle.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm md:text-base';
                circleMobile.className = 'w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold';
                text.className = 'ml-2 font-semibold text-gray-800 text-sm md:text-base';
                textMobile.className = 'mt-1 text-xs font-semibold text-gray-800';
                desktop.classList.remove('opacity-50');
                mobile.classList.remove('opacity-50');
            } else {
                circle.className = 'w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-sm md:text-base';
                circleMobile.className = 'w-10 h-10 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold';
                text.className = 'ml-2 font-semibold text-gray-500 text-sm md:text-base';
                textMobile.className = 'mt-1 text-xs font-semibold text-gray-500';
                desktop.classList.add('opacity-50');
                mobile.classList.add('opacity-50');
            }
        });
    }

    // Populate review section
    function populateReviewSection() {
        elements.reviewName.textContent = elements.examName.value;
        elements.reviewDuration.textContent = elements.examDuration.value;
        elements.reviewMarks.textContent = elements.examMarks.value;
        elements.reviewQuestions.textContent = elements.examTotalQuestions.value;
        elements.reviewNegative.textContent = elements.examNegative.value;

        elements.reviewTopicsList.innerHTML = Array.from(state.selectedTopics.entries())
            .map(([id, data]) => `<div class="p-2 bg-white rounded">• ${data.topicName}: ${data.questionCount} questions</div>`)
            .join('');
    }

    // Generate exam
    async function generateExam() {
        const examName = elements.examName.value.trim();
        const duration = parseInt(elements.examDuration.value);
        const totalMarks = parseInt(elements.examMarks.value);
        const negativeMark = parseFloat(elements.examNegative.value);

        if (!examName || !duration || !totalMarks) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        if (state.selectedTopics.size === 0) {
            showToast('Please select at least one topic.', 'error');
            return;
        }

        // Get the first selected topic to determine subject_id and lesson_id
        const firstTopic = Array.from(state.selectedTopics.values())[0];

        // Prepare payload for API
        const payload = {
            new_exam_details: {
                subject_id: parseInt(firstTopic.subjectId),
                lesson_id: parseInt(firstTopic.lessonId),
                exam_title: examName,
                duration: duration,
                instructions: 'Topic-wise exam',
                total_marks: totalMarks,
                pass_mark: Math.floor(totalMarks * 0.4) // 40% pass mark
            },
            source_topics: Array.from(state.selectedTopics.entries()).map(([topicId, data]) => ({
                topic_id: parseInt(topicId),
                question_count: data.questionCount
            }))
        };

        elements.generateExamBtn.disabled = true;
        elements.generateExamBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Generating...';

        try {
            const response = await fetch('api/custom-exam/from-topics.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Exam created successfully!', 'success');
                setTimeout(() => {
                    window.loadPage('custom-exams');
                }, 1500);
            } else {
                showToast(result.message || 'Failed to create exam.', 'error');
                elements.generateExamBtn.disabled = false;
                elements.generateExamBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Generate Exam';
            }
        } catch (error) {
            console.error('Error generating exam:', error);
            showToast('An error occurred while creating the exam.', 'error');
            elements.generateExamBtn.disabled = false;
            elements.generateExamBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Generate Exam';
        }
    }

    // Event listeners
    elements.nextToStep2.addEventListener('click', () => goToStep(2));
    elements.backToStep1.addEventListener('click', () => goToStep(1));
    elements.nextToStep3.addEventListener('click', (e) => {
        e.preventDefault();
        const form = document.getElementById('exam-config-form');
        if (form.checkValidity()) {
            goToStep(3);
        } else {
            form.reportValidity();
        }
    });
    elements.backToStep2.addEventListener('click', () => goToStep(2));
    elements.generateExamBtn.addEventListener('click', generateExam);

    // Initialize
    fetchHierarchicalData();
})();
