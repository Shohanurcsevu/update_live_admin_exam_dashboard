// Topic-wise Exams JavaScript
(function () {
    'use strict';

    // State management
    const state = {
        currentStep: 1,
        subjects: [],
        selectedTopics: new Map(), // Map<topicId, {subjectId, lessonId, topicName, questionCount, maxQuestions}>
        examDetails: {},
        // Using global CacheManager instead of local state.cache
        presets: [],
        editingPresetId: null,
        editingTopics: [], // Array of {topic_id, topic_name, question_count, lesson_name, subject_name}
        targetTopic: null, // {topic_id, topic_name, lesson_name, subject_name, qty}
        hierarchyReady: false
    };

    // === SUBJECT COLOR CONFIG ===
    const SUBJECT_COLORS = {
        emerald: { bg: 'rgba(16,185,129,0.10)', border: '#10b981', text: '#065f46', shadow: 'rgba(16,185,129,0.2)', badge: '#d1fae5' },
        indigo: { bg: 'rgba(99,102,241,0.10)', border: '#6366f1', text: '#3730a3', shadow: 'rgba(99,102,241,0.2)', badge: '#e0e7ff' },
        amber: { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', text: '#78350f', shadow: 'rgba(245,158,11,0.2)', badge: '#fef3c7' },
        cyan: { bg: 'rgba(6,182,212,0.10)', border: '#06b6d4', text: '#155e75', shadow: 'rgba(6,182,212,0.2)', badge: '#cffafe' },
        violet: { bg: 'rgba(139,92,246,0.10)', border: '#8b5cf6', text: '#5b21b6', shadow: 'rgba(139,92,246,0.2)', badge: '#ede9fe' },
        rose: { bg: 'rgba(244,63,94,0.10)', border: '#f43f5e', text: '#881337', shadow: 'rgba(244,63,94,0.2)', badge: '#ffe4e6' },
        teal: { bg: 'rgba(20,184,166,0.10)', border: '#14b8a6', text: '#115e59', shadow: 'rgba(20,184,166,0.2)', badge: '#ccfbf1' },
        orange: { bg: 'rgba(249,115,22,0.10)', border: '#f97316', text: '#7c2d12', shadow: 'rgba(249,115,22,0.2)', badge: '#ffedd5' },
        sky: { bg: 'rgba(14,165,233,0.10)', border: '#0ea5e9', text: '#0c4a6e', shadow: 'rgba(14,165,233,0.2)', badge: '#e0f2fe' },
        fuchsia: { bg: 'rgba(217,70,239,0.10)', border: '#d946ef', text: '#701a75', shadow: 'rgba(217,70,239,0.2)', badge: '#fae8ff' },
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
        reviewTopicsList: document.getElementById('review-topics-list'),

        // Preset elements
        presetsGrid: document.getElementById('presets-grid'),
        presetsLoading: document.getElementById('presets-loading'),
        presetsEmpty: document.getElementById('presets-empty'),
        savePresetBtn: document.getElementById('save-preset-btn'),
        presetModal: document.getElementById('preset-modal'),
        presetModalTitle: document.getElementById('preset-modal-title'),
        presetNameInput: document.getElementById('preset-name-input'),
        presetModalTopics: document.getElementById('preset-modal-topics'),
        presetModalCancel: document.getElementById('preset-modal-cancel'),
        presetModalSave: document.getElementById('preset-modal-save'),
        addCurrentToPresetBtn: document.getElementById('add-current-to-preset'),

        // Select Preset Modal
        selectPresetModal: document.getElementById('select-preset-modal'),
        selectPresetClose: document.getElementById('select-preset-close'),
        selectPresetCancel: document.getElementById('select-preset-cancel'),
        presetListContainer: document.getElementById('preset-list-container'),
        targetTopicInfo: document.getElementById('target-topic-info'),
        
        // Magic Fill Elements
        magicFillBtn: document.getElementById('magic-fill-btn'),
        magicFillDropdown: document.getElementById('magic-fill-dropdown'),
        clearSelectionBtn: document.getElementById('clear-selection-btn')
    };

    // Utility: Show toast notification
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500';

        toast.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg mb-2 transition-opacity duration-300`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Fetch data with caching (Topic structure is cached for 60m)
    async function fetchData(url) {
        if (typeof CacheManager !== 'undefined') {
            return await CacheManager.fetchWithCache(url, 60);
        }

        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to fetch data');
        return result.data;
    }

    // Fetch hierarchical data (subjects -> lessons initially)
    async function fetchHierarchicalData() {
        try {
            const subjectsData = await fetchData('api/custom-exam/subjects-with-details.php');
            state.subjects = subjectsData.sort((a, b) => a.subject_id - b.subject_id);
            renderHierarchy();
            state.hierarchyReady = true;
            loadPresets();
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

        const colorClass = subject.color_class || 'violet';
        const colors = SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;

        const header = document.createElement('div');
        header.className = 'hierarchy-header transition-all duration-300 rounded-lg p-2';
        header.style.color = colors.text;
        header.dataset.subjectId = subject.subject_id;
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon mr-2" style="color: ${colors.border}">chevron_right</span>
            <span class="font-black uppercase tracking-tight">${subject.subject_name}</span>
            <span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color: ${colors.border}; color: white">
                ${subject.lessons.length} LESSONS
            </span>
        `;

        const lessonsContainer = document.createElement('div');
        lessonsContainer.className = 'hierarchy-item hidden mt-2 space-y-2';

        subject.lessons.forEach(lesson => {
            const lessonDiv = createLessonElement(lesson, subject.subject_id, colorClass);
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
    function createLessonElement(lesson, subjectId, colorClass) {
        const div = document.createElement('div');
        const isComplete = parseInt(lesson.is_complete) || 0;
        const colors = SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;

        div.className = 'border rounded-xl p-2.5 transition-all duration-300';
        if (isComplete) {
            div.style.backgroundColor = colors.bg;
            div.style.borderLeft = `4px solid ${colors.border}`;
        } else {
            div.className += ' bg-white';
        }

        const header = document.createElement('div');
        header.className = 'hierarchy-header flex items-center group cursor-pointer';
        header.dataset.lessonId = lesson.lesson_id; // Added data-lesson-id
        
        const completionBadge = isComplete
            ? `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-0.5" style="background-color: ${colors.border}; color: white">
                <span class="material-symbols-outlined text-[10px]">check_circle</span> Complete
               </span>`
            : '';

        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-gray-400 mr-2 transition-transform group-hover:scale-110">chevron_right</span>
            <span class="font-extrabold text-sm ${isComplete ? '' : 'text-gray-700'}" style="color: ${isComplete ? colors.text : ''}">${lesson.lesson_name}</span>
            ${completionBadge}
            <span class="ml-auto text-[10px] font-bold text-gray-400 lessons-count">... topics</span>
        `;

        const topicsContainer = document.createElement('div');
        topicsContainer.className = 'hierarchy-item hidden mt-2 space-y-1';

        async function expandLesson() {
            if (topicsContainer.children.length > 0 && !topicsContainer.querySelector('.text-red-500')) return; // Don't re-fetch if already loaded successfully

            topicsContainer.innerHTML = '<div class="py-2 text-sm text-gray-500 flex items-center"><span class="material-symbols-outlined animate-spin mr-2 text-xs">sync</span> Loading topics...</div>';

            try {
                const topics = await fetchData(`api/custom-exam/topics.php?lesson_id=${lesson.lesson_id}`);
                lesson.topics = topics || []; // Store topics in the lesson object for later access

                header.querySelector('.lessons-count').textContent = `(${lesson.topics.length} topics)`;
                topicsContainer.innerHTML = '';

                if (lesson.topics.length === 0) {
                    topicsContainer.innerHTML = '<div class="py-2 text-sm text-gray-500">No topics available.</div>';
                    return;
                }

                lesson.topics.forEach(topic => {
                    const topicDiv = createTopicElement(topic, subjectId, lesson.lesson_id, colorClass);
                    topicsContainer.appendChild(topicDiv);
                });
            } catch (error) {
                console.error(`Error fetching topics for lesson ${lesson.lesson_id}:`, error);
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
    function createTopicElement(topic, subjectId, lessonId, colorClass) {
        const div = document.createElement('div');
        const isComplete = parseInt(topic.lesson_is_complete) || 0;
        const colors = SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;

        div.className = 'flex items-center gap-3 p-3 rounded-lg transition-all duration-300 mb-1';
        if (isComplete) {
            div.style.backgroundColor = colors.bg;
            div.style.borderLeft = `3px solid ${colors.border}`;
        } else {
            div.className += ' bg-gray-50';
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'topic-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
        checkbox.dataset.topicId = topic.id;
        checkbox.dataset.subjectId = subjectId;
        checkbox.dataset.lessonId = lessonId;
        checkbox.dataset.topicName = topic.topic_name;
        checkbox.dataset.maxQuestions = topic.total_questions;

        const label = document.createElement('label');
        label.className = 'flex-1 text-sm cursor-pointer font-bold';
        label.style.color = isComplete ? colors.text : '#4b5563';
        label.innerHTML = `
            <div class="flex items-center gap-2">
                ${topic.topic_name}
                ${isComplete ? `<span class="material-symbols-outlined text-xs" style="color: ${colors.border}">check_circle</span>` : ''}
            </div>
            <div class="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-0.5">
                ${topic.total_questions} Questions Available
            </div>
        `;

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
                input.value = Math.min(1, topic.total_questions); // Default to 1 or max available
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

        // Add to Preset button
        const addToPresetBtn = document.createElement('button');
        addToPresetBtn.className = 'add-to-preset-btn p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center justify-center';
        addToPresetBtn.title = 'Add this topic to a preset';
        addToPresetBtn.innerHTML = '<span class="material-symbols-outlined text-lg">bookmark_add</span>';
        addToPresetBtn.onclick = (e) => {
            e.stopPropagation();
            const qty = parseInt(input.value) || 1;
            openSelectPresetModal(topic.id, topic.topic_name, lessonId, subjectId, qty);
        };

        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        inputContainer.appendChild(input);
        inputContainer.appendChild(addToPresetBtn);

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
            // Show save preset button
            elements.savePresetBtn.classList.remove('hidden');
            elements.savePresetBtn.classList.add('flex');
        } else {
            elements.selectionSummary.classList.add('hidden');
            // Hide save preset button
            elements.savePresetBtn.classList.add('hidden');
            elements.savePresetBtn.classList.remove('flex');
        }

        // Enable/disable next button
        elements.nextToStep2.disabled = state.selectedTopics.size === 0 || hasError || totalQuestions === 0;
    }

    // Clear all selections
    function clearSelection() {
        if (!confirm('Are you sure you want to clear all selected topics?')) return;
        
        // Uncheck all checkboxes and clear inputs
        document.querySelectorAll('.topic-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
            const topicId = checkbox.dataset.topicId;
            const input = document.querySelector(`.topic-input[data-topic-id="${topicId}"]`);
            if (input) {
                input.value = '';
                input.disabled = true;
            }
        });

        state.selectedTopics.clear();
        updateSelectedTopics();
        showToast('Selection cleared.', 'info');
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

        const firstTopic = Array.from(state.selectedTopics.values())[0];

        function getSelectedPriorities() {
            const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.value));
        }

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
            })),
            priority_levels: getSelectedPriorities()
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

                // --- Cache Invalidation ---
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                    CacheManager.clearGroup('exam');
                    CacheManager.clearGroup('custom-exam');
                    CacheManager.clearGroup('analytics');
                }

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

    // =============================================
    // PRESET SYSTEM
    // =============================================

    // Fetch all presets from API
    async function loadPresets() {
        elements.presetsLoading.classList.remove('hidden');
        elements.presetsEmpty.classList.add('hidden');
        elements.presetsGrid.innerHTML = '';

        try {
            const response = await fetch('api/custom-exam/presets.php?type=topic');
            const result = await response.json();

            if (result.success) {
                state.presets = result.data;
                renderPresets();
            } else {
                showToast('Failed to load presets.', 'error');
            }
        } catch (error) {
            console.error('Error loading presets:', error);
        } finally {
            elements.presetsLoading.classList.add('hidden');
        }
    }

    // Render preset cards
    function renderPresets() {
        elements.presetsGrid.innerHTML = '';

        if (state.presets.length === 0) {
            elements.presetsEmpty.classList.remove('hidden');
            return;
        }

        elements.presetsEmpty.classList.add('hidden');

        state.presets.forEach(preset => {
            const card = createPresetCard(preset);
            elements.presetsGrid.appendChild(card);
        });
    }

    // Create a single preset card
    function createPresetCard(preset) {
        const topics = preset.lessons_data || []; // Note: API returns it as lessons_data even for topics
        const totalQuestions = topics.reduce((sum, t) => sum + (parseInt(t.question_count) || 0), 0);

        const card = document.createElement('div');
        card.className = 'preset-card';

        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="material-symbols-outlined text-indigo-500 text-xl flex-shrink-0">bookmark</span>
                    <h4 class="font-bold text-gray-800 text-sm truncate">${preset.preset_name}</h4>
                </div>
                <div class="preset-actions flex items-center gap-1 flex-shrink-0 ml-2">
                    <button class="preset-edit-btn p-1 rounded hover:bg-indigo-100 transition-colors" title="Edit Preset" data-id="${preset.id}">
                        <span class="material-symbols-outlined text-indigo-500 text-base">edit</span>
                    </button>
                    <button class="preset-delete-btn p-1 rounded hover:bg-red-100 transition-colors" title="Delete Preset" data-id="${preset.id}">
                        <span class="material-symbols-outlined text-red-400 text-base">delete</span>
                    </button>
                </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span class="flex items-center gap-1" title="Topics">
                    <span class="material-symbols-outlined text-sm">hub</span>
                    ${topics.length}
                </span>
                <span class="flex items-center gap-1" title="Total Selected Questions">
                    <span class="material-symbols-outlined text-sm">quiz</span>
                    ${totalQuestions}
                </span>
            </div>
            <div class="space-y-1">
                ${topics.slice(0, 3).map(t => `
                    <div class="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0"></span>
                        ${t.topic_name}: ${t.question_count}q
                    </div>
                `).join('')}
                ${topics.length > 3 ? `<div class="text-[11px] text-indigo-500 font-semibold">+${topics.length - 3} more...</div>` : ''}
            </div>
            <div class="mt-3 pt-2 border-t border-gray-100">
                <div class="text-[10px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">arrow_forward</span>
                    Click to apply & continue
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.preset-edit-btn') || e.target.closest('.preset-delete-btn')) return;
            applyPreset(preset);
        });

        card.querySelector('.preset-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditPresetModal(preset);
        });

        card.querySelector('.preset-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePreset(preset.id, preset.preset_name);
        });

        return card;
    }

    // Apply a preset
    async function applyPreset(preset) {
        const topics = preset.lessons_data || [];
        if (topics.length === 0) {
            showToast('This preset has no topics.', 'error');
            return;
        }

        if (!state.hierarchyReady) {
            showToast('Loading topics data, please wait...', 'info');
            return;
        }

        // Clear existing
        document.querySelectorAll('.topic-checkbox:checked').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });
        // For each topic in the preset, we need to:
        // 1. Expand hierarchy
        // 2. Check checkbox
        // 3. Set question count
        let appliedTopicCount = 0;
        let missedTopicCount = 0;
        let requestedTotalQuestions = 0;
        let appliedTotalQuestions = 0;

        for (const presetTopic of topics) {
            const topicId = String(presetTopic.topic_id);
            const lessonId = presetTopic.lesson_id;
            const subjectId = presetTopic.subject_id;
            const desiredQ = parseInt(presetTopic.question_count) || 1;
            requestedTotalQuestions += desiredQ;
            
            await expandToTopic(topicId, lessonId, subjectId);

            const checkbox = document.querySelector(`.topic-checkbox[data-topic-id="${topicId}"]`);
            if (checkbox) {
                checkbox.checked = true;
                const input = document.querySelector(`.topic-input[data-topic-id="${topicId}"]`);
                if (input) {
                    input.disabled = false;
                    const maxQ = parseInt(checkbox.dataset.maxQuestions) || 0;
                    const finalQ = Math.min(desiredQ, maxQ);
                    input.value = finalQ;
                    appliedTotalQuestions += finalQ;
                }
                appliedTopicCount++;
            } else {
                missedTopicCount++;
                console.warn(`Topic ${topicId} not found in DOM after expansion.`);
            }
        }

        updateSelectedTopics();

        // Informational Feedback
        if (missedTopicCount > 0) {
            showToast(`Applied ${appliedTopicCount} topics, but missed ${missedTopicCount} (not found in current hierarchy).`, 'warning');
        } else if (appliedTotalQuestions < requestedTotalQuestions) {
            const diff = requestedTotalQuestions - appliedTotalQuestions;
            showToast(`Applied with ${diff} fewer questions than preset (some topics had limited availability).`, 'warning');
        } else {
            showToast(`Preset applied successfully: ${appliedTotalQuestions} questions total.`, 'success');
        }
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        elements.examName.value = `${preset.preset_name} - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${dateStr}`;
        
        goToStep(2);
    }

    // Helper to expand hierarchy to reach a specific topic
    async function expandToTopic(topicId, lessonId = null, subjectId = null) {
        let targetSub = null;
        let targetLes = null;

        if (lessonId && subjectId) {
            // Use provided IDs if available (much faster and more reliable for presets)
            targetSub = state.subjects.find(s => String(s.subject_id) === String(subjectId));
            if (targetSub) {
                targetLes = targetSub.lessons.find(l => String(l.lesson_id) === String(lessonId));
            }
        }

        if (!targetSub || !targetLes) {
            // Fallback to searching only if topics are already loaded for a lesson
            for (const sub of state.subjects) {
                for (const les of sub.lessons) {
                    if (les.topics && les.topics.find(t => String(t.id) === String(topicId))) {
                        targetSub = sub;
                        targetLes = les;
                        break;
                    }
                }
                if (targetSub) break;
            }
        }

        if (!targetSub || !targetLes) {
            console.warn(`Topic ${topicId} not found in hierarchy state. Expansion skipped.`);
            return;
        }

        // 1. Expand Subject
        const subHeader = elements.hierarchyTree.querySelector(`.hierarchy-header[data-subject-id="${targetSub.subject_id}"]`);
        if (subHeader) {
            const lessonsContainer = subHeader.nextElementSibling;
            if (lessonsContainer.classList.contains('hidden')) {
                subHeader.click(); // Simulate click to expand subject
            }

            // 2. Expand Lesson (inside the subject's lessons container)
            const lesHeader = lessonsContainer.querySelector(`.hierarchy-header[data-lesson-id="${targetLes.lesson_id}"]`);
            if (lesHeader) {
                const topicsContainer = lesHeader.nextElementSibling;
                // If the lesson is hidden, expand it
                if (topicsContainer.classList.contains('hidden')) {
                    lesHeader.click();
                }

                // Wait for the topic specifically to be in the DOM
                if (!topicsContainer.querySelector(`.topic-checkbox[data-topic-id="${topicId}"]`)) {
                    await new Promise(resolve => {
                        const observer = new MutationObserver((mutations, obs) => {
                            if (topicsContainer.querySelector(`.topic-checkbox[data-topic-id="${topicId}"]`)) {
                                obs.disconnect();
                                resolve();
                            }
                        });
                        observer.observe(topicsContainer, { childList: true, subtree: true });
                        
                        // Timeout after 5 seconds
                        setTimeout(() => {
                            observer.disconnect();
                            resolve();
                        }, 5000);
                    });
                }
            }
        }
    }

    // Modal management functions
    function openEditPresetModal(preset) {
        state.editingPresetId = preset.id;
        elements.presetModalTitle.textContent = 'Edit Preset';
        elements.presetNameInput.value = preset.preset_name;
        state.editingTopics = [...preset.lessons_data];
        renderPresetModalTopics();
        elements.presetModal.classList.remove('hidden');
    }

    function renderPresetModalTopics() {
        elements.presetModalTopics.innerHTML = state.editingTopics.map((t, index) => `
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-black text-indigo-600 uppercase tracking-widest mb-0.5">${t.subject_name || ''}</div>
                    <div class="font-bold text-gray-800 text-sm truncate">${t.topic_name}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" value="${t.question_count}" min="1" 
                        class="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        onchange="window.updateEditTopicQty(${index}, this.value)">
                    <button onclick="window.removeTopicFromEdit(${index})" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <span class="material-symbols-outlined text-base">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.updateEditTopicQty = (index, val) => {
        state.editingTopics[index].question_count = parseInt(val) || 1;
    };

    window.removeTopicFromEdit = (index) => {
        state.editingTopics.splice(index, 1);
        renderPresetModalTopics();
    };

    async function savePreset() {
        const name = elements.presetNameInput.value.trim();
        if (!name) {
            showToast('Please enter a preset name.', 'error');
            return;
        }

        if (state.editingTopics.length === 0) {
            showToast('Preset must have at least one topic.', 'error');
            return;
        }

        const payload = {
            id: state.editingPresetId,
            preset_name: name,
            lessons_data: state.editingTopics, // API expects lessons_data
            type: 'topic'
        };

        const method = state.editingPresetId ? 'PUT' : 'POST';

        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                elements.presetModal.classList.add('hidden');
                loadPresets();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Failed to save preset.', 'error');
        }
    }

    async function deletePreset(id, name) {
        if (!confirm(`Are you sure you want to delete preset "${name}"?`)) return;

        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            const result = await response.json();

            if (result.success) {
                showToast('Preset deleted.', 'success');
                loadPresets();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Failed to delete preset.', 'error');
        }
    }

    function openSelectPresetModal(topicId, topicName, lessonId, subjectId, qty) {
        state.targetTopic = { 
            topic_id: topicId, 
            topic_name: topicName, 
            lesson_id: lessonId, 
            subject_id: subjectId, 
            question_count: qty,
            subject_name: getSubjectName(subjectId)
        };
        elements.targetTopicInfo.textContent = topicName;
        renderSelectPresetList();
        elements.selectPresetModal.classList.remove('hidden');
    }

    function getSubjectName(id) {
        const sub = state.subjects.find(s => String(s.subject_id) === String(id));
        return sub ? sub.subject_name : '';
    }

    function renderSelectPresetList() {
        if (state.presets.length === 0) {
            elements.presetListContainer.innerHTML = '<div class="text-center py-4 text-gray-500">No presets found. Create one first!</div>';
            return;
        }

        elements.presetListContainer.innerHTML = state.presets.map(p => `
            <button onclick="window.addTopicToExistingPreset(${p.id})" class="w-full text-left p-4 rounded-xl border border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-between group">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-indigo-400">bookmark</span>
                    <span class="font-bold text-gray-700">${p.preset_name}</span>
                </div>
                <span class="material-symbols-outlined text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">add_circle</span>
            </button>
        `).join('');
    }

    window.addTopicToExistingPreset = async (presetId) => {
        const preset = state.presets.find(p => p.id === presetId);
        if (!preset) return;

        const topics = [...preset.lessons_data];
        const existingIdx = topics.findIndex(t => String(t.topic_id) === String(state.targetTopic.topic_id));

        if (existingIdx > -1) {
            topics[existingIdx].question_count = state.targetTopic.question_count;
            // Also ensure IDs are updated/present
            topics[existingIdx].lesson_id = state.targetTopic.lesson_id;
            topics[existingIdx].subject_id = state.targetTopic.subject_id;
        } else {
            topics.push({
                topic_id: state.targetTopic.topic_id,
                topic_name: state.targetTopic.topic_name,
                question_count: state.targetTopic.question_count,
                lesson_id: state.targetTopic.lesson_id,
                subject_id: state.targetTopic.subject_id,
                subject_name: state.targetTopic.subject_name
            });
        }

        const payload = {
            id: presetId,
            preset_name: preset.preset_name,
            lessons_data: topics,
            type: 'topic'
        };

        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.success) {
                showToast(`Topic added to "${preset.preset_name}"`, 'success');
                elements.selectPresetModal.classList.add('hidden');
                loadPresets();
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Failed to update preset.', 'error');
        }
    };

    // Magic Fill Logic
    function handleMagicFill(source) {
        const targetTotal = parseInt(elements.examTotalQuestions.value);
        if (!targetTotal || targetTotal <= 0) {
            showToast('Please enter a target total questions.', 'error');
            return;
        }

        const selectedCount = state.selectedTopics.size;
        if (selectedCount === 0) {
            showToast('Please select at least one topic.', 'error');
            return;
        }

        if (source === 'fresh') {
            // Fill based on max questions available in each topic
            const baseQty = Math.floor(targetTotal / selectedCount);
            let remainder = targetTotal % selectedCount;

            document.querySelectorAll('.topic-checkbox:checked').forEach((cb, idx) => {
                const topicId = cb.dataset.topicId;
                const input = document.querySelector(`.topic-input[data-topic-id="${topicId}"]`);
                const maxQ = parseInt(cb.dataset.maxQuestions);
                let qty = baseQty + (idx < remainder ? 1 : 0);
                input.value = Math.min(qty, maxQ);
            });
        } else if (source === 'balanced') {
            // Keep existing ratio but scale to total
            let currentTotal = 0;
            state.selectedTopics.forEach(t => currentTotal += t.questionCount);
            
            if (currentTotal === 0) {
                handleMagicFill('fresh');
                return;
            }

            const factor = targetTotal / currentTotal;
            document.querySelectorAll('.topic-checkbox:checked').forEach(cb => {
                const topicId = cb.dataset.topicId;
                const input = document.querySelector(`.topic-input[data-topic-id="${topicId}"]`);
                const currentVal = parseInt(input.value) || 1;
                const maxQ = parseInt(cb.dataset.maxQuestions);
                input.value = Math.min(Math.round(currentVal * factor), maxQ);
            });
        }

        updateSelectedTopics();
        // Recalculate duration and marks based on new totals
        const newTotal = Array.from(state.selectedTopics.values())
            .reduce((sum, topic) => sum + topic.questionCount, 0);
        elements.examTotalQuestions.value = newTotal;
        elements.examDuration.value = newTotal;
        elements.examMarks.value = newTotal;
        showToast(`Magic Fill applied (${source})`, 'success');
        elements.magicFillDropdown.classList.add('hidden');
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

    // Preset event listeners
    elements.savePresetBtn?.addEventListener('click', () => {
        state.editingPresetId = null;
        elements.presetModalTitle.textContent = 'Save as Preset';
        elements.presetNameInput.value = '';
        state.editingTopics = Array.from(state.selectedTopics.entries()).map(([id, data]) => ({
            topic_id: id,
            topic_name: data.topicName,
            question_count: data.questionCount,
            lesson_id: data.lessonId,
            subject_id: data.subjectId,
            subject_name: getSubjectName(data.subjectId)
        }));
        renderPresetModalTopics();
        elements.presetModal.classList.remove('hidden');
    });

    elements.presetModalCancel?.addEventListener('click', () => {
        elements.presetModal.classList.add('hidden');
    });

    elements.presetModalSave?.addEventListener('click', savePreset);

    // Add current selection to preset modal
    elements.addCurrentToPresetBtn?.addEventListener('click', () => {
        if (state.selectedTopics.size === 0) {
            showToast('No topics selected in Step 1 to add.', 'warning');
            return;
        }

        let addedCount = 0;
        state.selectedTopics.forEach((data, topicIdStr) => {
            const topicId = parseInt(topicIdStr);
            const exists = state.editingTopics.find(t => String(t.topic_id) === String(topicId));

            if (!exists) {
                state.editingTopics.push({
                    topic_id: topicId,
                    topic_name: data.topicName,
                    question_count: data.questionCount,
                    lesson_id: data.lessonId,
                    subject_id: data.subjectId,
                    subject_name: getSubjectName(data.subjectId)
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            renderPresetModalTopics();
            showToast(`Added ${addedCount} new topic(s) to preset.`, 'success');
        } else {
            showToast('Selected topics are already in this preset.', 'info');
        }
    });

    elements.selectPresetClose?.addEventListener('click', () => {
        elements.selectPresetModal.classList.add('hidden');
    });

    elements.selectPresetCancel?.addEventListener('click', () => {
        elements.selectPresetModal.classList.add('hidden');
    });

    // Magic Fill event listeners
    elements.magicFillBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.magicFillDropdown.classList.toggle('hidden');
    });

    document.querySelectorAll('[data-magic-fill]').forEach(btn => {
        btn.addEventListener('click', () => {
            handleMagicFill(btn.dataset.magicFill);
        });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (elements.magicFillBtn && !elements.magicFillBtn.contains(e.target)) {
            elements.magicFillDropdown.classList.add('hidden');
        }
    });

    // Clear selection
    elements.clearSelectionBtn?.addEventListener('click', clearSelection);

    // Initialize
    fetchHierarchicalData();
})();
