// Lesson-wise Exams JavaScript
(function () {
    'use strict';

    // State management
    const state = {
        currentStep: 1,
        subjects: [],
        selectedLessons: new Map(), // Map<lessonId, {subjectId, lessonName, questionCount, maxQuestions}>
        examDetails: {},
        cache: new Map(),
        presets: [],
        editingPresetId: null,
        editingLessons: [], // Array of {lesson_id, lesson_name, question_count, subject_name}
        targetLesson: null, // {lesson_id, lesson_name, subject_name, qty}
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
        selectedLessonsList: document.getElementById('selected-lessons-list'),
        clearSelectionBtn: document.getElementById('clear-selection-btn'),

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
        reviewLessonsList: document.getElementById('review-lessons-list'),

        // Preset elements
        presetsGrid: document.getElementById('presets-grid'),
        presetsLoading: document.getElementById('presets-loading'),
        presetsEmpty: document.getElementById('presets-empty'),
        savePresetBtn: document.getElementById('save-preset-btn'),
        presetModal: document.getElementById('preset-modal'),
        presetModalTitle: document.getElementById('preset-modal-title'),
        presetNameInput: document.getElementById('preset-name-input'),
        presetModalLessons: document.getElementById('preset-modal-lessons'),
        presetModalCancel: document.getElementById('preset-modal-cancel'),
        presetModalSave: document.getElementById('preset-modal-save'),
        addCurrentToPresetBtn: document.getElementById('add-current-to-preset'),

        // Select Preset Modal
        selectPresetModal: document.getElementById('select-preset-modal'),
        selectPresetClose: document.getElementById('select-preset-close'),
        selectPresetCancel: document.getElementById('select-preset-cancel'),
        presetListContainer: document.getElementById('preset-list-container'),
        targetLessonInfo: document.getElementById('target-lesson-info'),
        
        // Magic Fill Elements
        magicFillBtn: document.getElementById('magic-fill-btn'),
        magicFillDropdown: document.getElementById('magic-fill-dropdown')
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

    // Helper: Fetch data with caching
    async function fetchData(url) {
        if (state.cache.has(url)) return state.cache.get(url);

        // Try localStorage persistence
        const cacheKey = `rethink_cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                const isExpired = Date.now() - timestamp > 3600000; // 1 hour
                if (!isExpired) {
                    state.cache.set(url, data);
                    return data;
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to fetch data');

        state.cache.set(url, result.data);
        // Persist to localStorage
        localStorage.setItem(cacheKey, JSON.stringify({
            data: result.data,
            timestamp: Date.now()
        }));

        return result.data;
    }

    // Helper: Get icon for type
    function getIcon(type) {
        const icons = {
            subject: 'subject',
            lesson: 'library_books'
        };
        return icons[type] || 'folder';
    }

    // Fetch hierarchical data (subjects -> lessons)
    async function fetchHierarchicalData() {
        try {
            // Always clear cached hierarchy data so freshness counts are up-to-date
            const hierarchyCacheKey = 'rethink_cache_api/custom-exam/subjects-with-details.php';
            localStorage.removeItem(hierarchyCacheKey);
            state.cache.delete('api/custom-exam/subjects-with-details.php');
            
            const data = await fetchData('api/custom-exam/subjects-with-details.php');
            state.subjects = data.sort((a, b) => a.subject_id - b.subject_id);
            renderHierarchy();
            state.hierarchyReady = true;
        } catch (error) {
            console.error('Error fetching hierarchical data:', error);
            showToast('Failed to load lessons. Please refresh the page.', 'error');
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
            <span class="material-symbols-outlined mr-2">${getIcon('subject')}</span>
            <span class="font-black uppercase tracking-tight">${subject.subject_name}</span>
            <span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color: ${colors.border}; color: white">
                ${subject.lessons.length} LESSONS
            </span>
        `;

        const lessonsContainer = document.createElement('div');
        lessonsContainer.className = 'hierarchy-item hidden mt-2 space-y-2';

        function expandSubject() {
            if (lessonsContainer.children.length > 0) return;
            subject.lessons.forEach(lesson => {
                const lessonDiv = createLessonElement(lesson, subject.subject_id, subject.subject_name, colorClass);
                lessonsContainer.appendChild(lessonDiv);
            });
        }

        header.addEventListener('click', () => {
            const icon = header.querySelector('.expand-icon');
            icon.classList.toggle('expanded');
            lessonsContainer.classList.toggle('hidden');
            if (!lessonsContainer.classList.contains('hidden')) {
                expandSubject();
            }
        });

        div.appendChild(header);
        div.appendChild(lessonsContainer);

        return div;
    }

    // Create lesson element (selectable)
    function createLessonElement(lesson, subjectId, subjectName, colorClass) {
        const div = document.createElement('div');
        const isComplete = parseInt(lesson.is_complete) || 0;
        const colors = SUBJECT_COLORS[colorClass] || SUBJECT_COLORS.violet;

        div.className = 'flex items-center gap-3 p-3 rounded-xl transition-all duration-300 mb-1 border';
        if (isComplete) {
            div.style.backgroundColor = colors.bg;
            div.style.borderLeft = `4px solid ${colors.border}`;
        } else {
            div.className += ' bg-white';
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'lesson-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';
        checkbox.dataset.lessonId = lesson.lesson_id;
        checkbox.dataset.subjectId = subjectId;
        checkbox.dataset.subjectName = subjectName;
        checkbox.dataset.lessonName = lesson.lesson_name;
        checkbox.dataset.maxQuestions = lesson.total_questions;

        const label = document.createElement('label');
        label.className = 'flex-1 text-sm cursor-pointer font-bold flex flex-col';
        label.style.color = isComplete ? colors.text : '#4b5563';

        const completionBadge = isComplete
            ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-0.5 border" style="background-color: white; border-color: ${colors.border}; color: ${colors.border}; width: fit-content;">
                <span class="material-symbols-outlined text-[10px]">check_circle</span> Complete
               </span>`
            : '';

        label.innerHTML = `
            <div class="flex items-center gap-2 mb-0.5">
                <span class="material-symbols-outlined text-sm" style="color: ${isComplete ? colors.border : '#3b82f6'}">${getIcon('lesson')}</span>
                <span class="font-extrabold uppercase tracking-tight">${lesson.lesson_name}</span>
                ${completionBadge}
            </div>
            <div class="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-0.5 pl-6 flex items-center gap-2">
                <span>${lesson.total_questions} Questions available</span>
                ${parseInt(lesson.unseen_questions) > 0 ? 
                    `<span class="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[10px]">auto_awesome</span>
                        ${lesson.unseen_questions} Fresh
                     </span>` : 
                    `<span class="bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[10px]">done_all</span>
                        Exhausted
                     </span>`
                }
            </div>
        `;

        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex items-center gap-2';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = lesson.total_questions;
        input.placeholder = 'Qty';
        input.className = 'lesson-input px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none';
        input.disabled = true;
        input.dataset.lessonId = lesson.lesson_id;

        // Add to Preset button
        const addToPresetBtn = document.createElement('button');
        addToPresetBtn.className = 'add-to-preset-btn p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center justify-center';
        addToPresetBtn.title = 'Add this lesson to a preset';
        addToPresetBtn.innerHTML = '<span class="material-symbols-outlined text-lg">bookmark_add</span>';
        addToPresetBtn.onclick = (e) => {
            e.stopPropagation();
            const qty = parseInt(input.value) || 1;
            openSelectPresetModal(lesson.lesson_id, lesson.lesson_name, subjectName, qty);
        };

        checkbox.addEventListener('change', (e) => {
            input.disabled = !e.target.checked;
            if (e.target.checked) {
                input.value = 1; 
                updateSelectedLessons();
            } else {
                input.value = '';
                state.selectedLessons.delete(lesson.lesson_id);
                updateSelectedLessons();
            }
        });

        input.addEventListener('input', () => {
            if (checkbox.checked) {
                updateSelectedLessons();
            }
        });

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

    // Update selected lessons state
    function updateSelectedLessons() {
        state.selectedLessons.clear();
        let totalQuestions = 0;
        let hasError = false;

        document.querySelectorAll('.lesson-checkbox:checked').forEach(checkbox => {
            const lessonId = checkbox.dataset.lessonId;
            const input = document.querySelector(`.lesson-input[data-lesson-id="${lessonId}"]`);
            const questionCount = parseInt(input.value) || 0;
            const maxQuestions = parseInt(checkbox.dataset.maxQuestions);

            if (questionCount > maxQuestions) {
                input.classList.add('border-red-500');
                hasError = true;
            } else {
                input.classList.remove('border-red-500');
            }

            if (questionCount > 0 && questionCount <= maxQuestions) {
                state.selectedLessons.set(lessonId, {
                    subjectId: checkbox.dataset.subjectId,
                    subjectName: checkbox.dataset.subjectName,
                    lessonName: checkbox.dataset.lessonName,
                    questionCount: questionCount,
                    maxQuestions: maxQuestions
                });
                totalQuestions += questionCount;
            }
        });

        // Update UI
        elements.totalSelected.textContent = totalQuestions;

        if (state.selectedLessons.size > 0) {
            elements.selectionSummary.classList.remove('hidden');
            elements.selectedLessonsList.innerHTML = Array.from(state.selectedLessons.entries())
                .map(([id, data]) => `<div>• ${data.subjectName} → ${data.lessonName}: ${data.questionCount} questions</div>`)
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
        elements.nextToStep2.disabled = state.selectedLessons.size === 0 || hasError || totalQuestions === 0;
    }

    // Clear all selections
    function clearSelection() {
        if (!confirm('Are you sure you want to clear all selected lessons?')) return;
        
        // Uncheck all checkboxes and clear inputs
        document.querySelectorAll('.lesson-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
            const lessonId = checkbox.dataset.lessonId;
            const input = document.querySelector(`.lesson-input[data-lesson-id="${lessonId}"]`);
            if (input) {
                input.value = '';
                input.disabled = true;
            }
        });

        state.selectedLessons.clear();
        updateSelectedLessons();
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
            const totalQuestions = Array.from(state.selectedLessons.values())
                .reduce((sum, lesson) => sum + lesson.questionCount, 0);
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

        elements.reviewLessonsList.innerHTML = Array.from(state.selectedLessons.entries())
            .map(([id, data]) => `<div class="p-2 bg-white rounded">• ${data.subjectName} → ${data.lessonName}: ${data.questionCount} questions</div>`)
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

        if (state.selectedLessons.size === 0) {
            showToast('Please select at least one lesson.', 'error');
            return;
        }

        // Get the first selected lesson to determine subject_id
        const firstLesson = Array.from(state.selectedLessons.values())[0];

        function getSelectedPriorities() {
            const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.value));
        }

        // Prepare payload for API
        const payload = {
            new_exam_details: {
                subject_id: parseInt(firstLesson.subjectId),
                exam_title: examName,
                duration: duration,
                instructions: 'Lesson-wise exam across subjects',
                total_marks: totalMarks,
                pass_mark: Math.floor(totalMarks * 0.4) // 40% pass mark
            },
            source_lessons: Array.from(state.selectedLessons.entries()).map(([lessonId, data]) => ({
                lesson_id: parseInt(lessonId),
                question_count: data.questionCount
            })),
            priority_levels: getSelectedPriorities()
        };

        elements.generateExamBtn.disabled = true;
        elements.generateExamBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Generating...';

        try {
            const response = await fetch('api/custom-exam/from-lessons.php', {
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

    // =============================================
    // PRESET SYSTEM
    // =============================================

    // Fetch all presets from API
    async function loadPresets() {
        elements.presetsLoading.classList.remove('hidden');
        elements.presetsEmpty.classList.add('hidden');
        elements.presetsGrid.innerHTML = '';

        try {
            const response = await fetch('api/custom-exam/presets.php');
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
        const lessons = preset.lessons_data || [];
        const totalQuestions = lessons.reduce((sum, l) => sum + (parseInt(l.question_count) || 0), 0);

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
                <span class="flex items-center gap-1" title="Lessons">
                    <span class="material-symbols-outlined text-sm">library_books</span>
                    ${lessons.length}
                </span>
                <span class="flex items-center gap-1" title="Total Selected Questions">
                    <span class="material-symbols-outlined text-sm">quiz</span>
                    ${totalQuestions}
                </span>
                ${parseInt(preset.total_unseen) > 0 ? 
                    `<span class="ml-auto bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">magic_button</span>
                        ${preset.total_unseen} Fresh
                    </span>` : 
                    `<span class="ml-auto bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px]">check_circle</span>
                        Done
                    </span>`
                }
            </div>
            <div class="space-y-1">
                ${lessons.slice(0, 3).map(l => `
                    <div class="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0"></span>
                        ${l.lesson_name}: ${l.question_count}q
                    </div>
                `).join('')}
                ${lessons.length > 3 ? `<div class="text-[11px] text-indigo-500 font-semibold">+${lessons.length - 3} more...</div>` : ''}
            </div>
            <div class="mt-3 pt-2 border-t border-gray-100">
                <div class="text-[10px] text-indigo-600 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">arrow_forward</span>
                    Click to apply & continue
                </div>
            </div>
        `;

        // Click card to apply preset (skip edit/delete buttons)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.preset-edit-btn') || e.target.closest('.preset-delete-btn')) return;
            applyPreset(preset);
        });

        // Edit button
        card.querySelector('.preset-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditPresetModal(preset);
        });

        // Delete button
        card.querySelector('.preset-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePreset(preset.id, preset.preset_name);
        });

        return card;
    }

    // Apply a preset: select lessons, fill quantities, jump to step 2
    async function applyPreset(preset) {
        console.log('Applying preset:', preset);
        const lessons = preset.lessons_data || [];
        if (lessons.length === 0) {
            showToast('This preset has no lessons.', 'error');
            return;
        }

        // Wait for hierarchy to be ready
        if (!state.hierarchyReady) {
            showToast('Loading lessons data, please wait...', 'info');
            return;
        }

        // First, clear all existing selections
        document.querySelectorAll('.lesson-checkbox:checked').forEach(cb => {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        });

        // For each lesson in the preset, we need to:
        // 1. Expand the parent subject
        // 2. Check the lesson checkbox
        // 3. Set the question count
        let appliedCount = 0;
        const notFoundLessons = [];

        for (const presetLesson of lessons) {
            const lessonId = String(presetLesson.lesson_id);

            // Find which subject this lesson belongs to
            let targetSubject = null;
            for (const subject of state.subjects) {
                const found = subject.lessons.find(l => String(l.lesson_id) === lessonId);
                if (found) {
                    targetSubject = subject;
                    break;
                }
            }

            if (!targetSubject) {
                notFoundLessons.push(presetLesson.lesson_name);
                continue;
            }

            // Expand the subject to render its lessons
            let subjectFoundInDom = false;
            const subjectHeader = elements.hierarchyTree.querySelector(`.hierarchy-header[data-subject-id="${targetSubject.subject_id}"]`);
            
            if (subjectHeader) {
                subjectFoundInDom = true;
                const subjectDiv = subjectHeader.closest('.border.rounded-lg');
                const lessonsContainer = subjectDiv.querySelector('.hierarchy-item');
                const icon = subjectHeader.querySelector('.expand-icon');

                // Expand if hidden
                if (lessonsContainer.classList.contains('hidden')) {
                    icon.classList.add('expanded');
                    lessonsContainer.classList.remove('hidden');
                }

                // ALWAYS render lessons if they are missing
                if (lessonsContainer.children.length === 0) {
                    targetSubject.lessons.forEach(lesson => {
                        const lessonDiv = createLessonElement(lesson, targetSubject.subject_id, targetSubject.subject_name, targetSubject.color_class || 'violet');
                        lessonsContainer.appendChild(lessonDiv);
                    });
                }
            }

            // Now find and check the checkbox
            const checkbox = document.querySelector(`.lesson-checkbox[data-lesson-id="${lessonId}"]`);
            if (checkbox) {
                checkbox.checked = true;
                const input = document.querySelector(`.lesson-input[data-lesson-id="${lessonId}"]`);
                if (input) {
                    input.disabled = false;
                    const maxQ = parseInt(checkbox.dataset.maxQuestions) || 999;
                    const desiredQ = parseInt(presetLesson.question_count) || 1;
                    input.value = Math.min(desiredQ, maxQ);
                }
                appliedCount++;
            } else {
                if (subjectFoundInDom) {
                    notFoundLessons.push(presetLesson.lesson_name);
                }
            }
        }

        // Update state
        updateSelectedLessons();

        // Auto-fill exam name with preset name and current date
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        elements.examName.value = `${preset.preset_name} - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ${dateStr}`;

        if (notFoundLessons.length > 0) {
            showToast(`${appliedCount} lessons applied. ${notFoundLessons.length} not found (may have been removed).`, 'info');
        } else {
            showToast(`Preset "${preset.preset_name}" applied! (${appliedCount} lessons)`, 'success');
        }

        // Jump to Step 2 if we have selections
        if (state.selectedLessons.size > 0) {
            setTimeout(() => goToStep(2), 500);
        }
    }

    // Open modal for saving a new preset
    function openSavePresetModal() {
        if (state.selectedLessons.size === 0) {
            showToast('Please select some lessons first.', 'error');
            return;
        }

        state.editingPresetId = null;
        state.editingLessons = Array.from(state.selectedLessons.entries()).map(([lessonId, data]) => ({
            lesson_id: parseInt(lessonId),
            lesson_name: data.lessonName,
            question_count: data.questionCount,
            subject_name: data.subjectName
        }));

        elements.presetModalTitle.textContent = 'Save Preset';
        elements.presetNameInput.value = '';
        elements.presetModalSave.textContent = 'Save Preset';

        renderEditingLessons();
        elements.presetModal.classList.remove('hidden');
        elements.presetNameInput.focus();
    }

    // Open modal for editing an existing preset
    function openEditPresetModal(preset) {
        state.editingPresetId = preset.id;
        
        // Ensure all lessons have subject_name by looking up if missing
        const lessons = (preset.lessons_data || []).map(l => {
            if (!l.subject_name) {
                const subject = state.subjects.find(s => s.lessons.some(ls => ls.lesson_id == l.lesson_id));
                if (subject) l.subject_name = subject.subject_name;
            }
            return l;
        });
        
        state.editingLessons = JSON.parse(JSON.stringify(lessons));

        elements.presetModalTitle.textContent = 'Edit Preset';
        elements.presetNameInput.value = preset.preset_name;
        elements.presetModalSave.textContent = 'Update Preset';

        renderEditingLessons();
        elements.presetModal.classList.remove('hidden');
        elements.presetNameInput.focus();
    }

    // Render interactive lesson rows in the modal (Grouped by Subject)
    function renderEditingLessons() {
        if (state.editingLessons.length === 0) {
            elements.presetModalLessons.innerHTML = `
                <div class="p-8 text-center text-gray-400 italic">
                    No lessons in this preset. <br>
                    Add some from Step 1 or click "Add Current Selection".
                </div>
            `;
            return;
        }

        // Grouping by subject
        const grouped = state.editingLessons.reduce((acc, lesson) => {
            const subj = lesson.subject_name || 'Other';
            if (!acc[subj]) acc[subj] = [];
            acc[subj].push(lesson);
            return acc;
        }, {});

        let html = '';
        for (const [subject, lessons] of Object.entries(grouped)) {
            html += `
                <div class="bg-gray-50/50 rounded-xl border border-gray-100 overflow-hidden">
                    <div class="bg-white px-4 py-2 border-b border-gray-50 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-gray-400">folder_open</span>
                        <span class="text-[11px] font-black uppercase tracking-wider text-gray-500">${subject}</span>
                    </div>
                    <div class="divide-y divide-gray-50">
                        ${lessons.map((l, index) => `
                            <div class="flex items-center justify-between p-3 hover:bg-white transition-colors group">
                                <div class="flex-1 min-w-0 pr-4">
                                    <p class="text-sm font-bold text-gray-700 truncate" title="${l.lesson_name}">${l.lesson_name}</p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="flex items-center gap-2">
                                        <label class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Qty:</label>
                                        <input type="number" value="${l.question_count}" min="1" max="999" 
                                            data-id="${l.lesson_id}"
                                            class="preset-lesson-qty w-14 px-2 py-1 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm">
                                    </div>
                                    <button class="remove-preset-lesson p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" 
                                        data-id="${l.lesson_id}" title="Remove from preset">
                                        <span class="material-symbols-outlined text-base">delete</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        elements.presetModalLessons.innerHTML = html;
    }

    // Add current Step 1 selection to the modal state
    function addCurrentSelectionToPreset() {
        if (state.selectedLessons.size === 0) {
            showToast('No lessons selected in Step 1 to add.', 'warning');
            return;
        }

        let addedCount = 0;
        state.selectedLessons.forEach((data, lessonIdStr) => {
            const lessonId = parseInt(lessonIdStr);
            const exists = state.editingLessons.find(l => l.lesson_id === lessonId);
            
            if (!exists) {
                state.editingLessons.push({
                    lesson_id: lessonId,
                    lesson_name: data.lessonName,
                    question_count: data.questionCount,
                    subject_name: data.subjectName
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            renderEditingLessons();
            showToast(`Added ${addedCount} new lesson(s) to preset.`, 'success');
        } else {
            showToast('Selected lessons are already in this preset.', 'info');
        }
    }

    // Remove a lesson from the modal state
    function removeLessonFromPreset(lessonId) {
        state.editingLessons = state.editingLessons.filter(l => l.lesson_id != lessonId);
        renderEditingLessons();
    }

    // Update quantity in modal state
    function updatePresetLessonQty(lessonId, newQty) {
        const lesson = state.editingLessons.find(l => l.lesson_id == lessonId);
        if (lesson) {
            lesson.question_count = Math.max(1, newQty);
        }
    }

    // Modal to select which preset to add a lesson to
    function openSelectPresetModal(lessonId, lessonName, subjectName, qty) {
        state.targetLesson = { lesson_id: lessonId, lesson_name: lessonName, subject_name: subjectName, qty: qty };
        elements.targetLessonInfo.textContent = `${lessonName} (${subjectName})`;
        
        renderTargetPresets();
        elements.selectPresetModal.classList.remove('hidden');
    }

    function closeSelectPresetModal() {
        elements.selectPresetModal.classList.add('hidden');
        state.targetLesson = null;
    }

    function renderTargetPresets() {
        if (state.presets.length === 0) {
            elements.presetListContainer.innerHTML = '<div class="text-center py-8 text-gray-400 italic">No presets found. Create one first!</div>';
            return;
        }

        const html = state.presets.map(p => `
            <button class="select-preset-item w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left mb-2 group" 
                data-id="${p.id}">
                <div>
                    <h4 class="font-bold text-gray-800 group-hover:text-indigo-700">${p.preset_name}</h4>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${p.lessons_data.length} Lessons applied</p>
                </div>
                <span class="material-symbols-outlined text-indigo-300 group-hover:text-indigo-600">add_circle</span>
            </button>
        `).join('');

        elements.presetListContainer.innerHTML = html;

        // Add event listeners to items
        elements.presetListContainer.querySelectorAll('.select-preset-item').forEach(btn => {
            btn.onclick = () => addLessonToSpecificPreset(parseInt(btn.dataset.id));
        });
    }

    async function addLessonToSpecificPreset(presetId) {
        const preset = state.presets.find(p => p.id == presetId);
        if (!preset) return;

        const lessons = [...(preset.lessons_data || [])];
        const index = lessons.findIndex(l => l.lesson_id == state.targetLesson.lesson_id);

        if (index > -1) {
            lessons[index].question_count = state.targetLesson.qty;
            lessons[index].subject_name = state.targetLesson.subject_name;
            showToast(`Updated ${state.targetLesson.lesson_name} in "${preset.preset_name}".`, 'info');
        } else {
            lessons.push({
                lesson_id: state.targetLesson.lesson_id,
                lesson_name: state.targetLesson.lesson_name,
                question_count: state.targetLesson.qty,
                subject_name: state.targetLesson.subject_name
            });
            showToast(`Added ${state.targetLesson.lesson_name} to "${preset.preset_name}".`, 'success');
        }

        // Save to DB
        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: preset.id,
                    preset_name: preset.preset_name,
                    lessons_data: lessons
                })
            });

            const result = await response.json();
            if (result.success) {
                closeSelectPresetModal();
                loadPresets();
            } else {
                showToast(result.message || 'Failed to update preset.', 'error');
            }
        } catch (error) {
            console.error('Error updating preset:', error);
            showToast('An error occurred.', 'error');
        }
    }

    // Close modal
    function closePresetModal() {
        elements.presetModal.classList.add('hidden');
        state.editingPresetId = null;
        state.editingLessons = [];
    }

    // Save or update preset
    async function saveOrUpdatePreset() {
        const name = elements.presetNameInput.value.trim();
        if (!name) {
            showToast('Please enter a preset name.', 'error');
            return;
        }

        if (state.editingLessons.length === 0) {
            showToast('Preset must have at least one lesson.', 'error');
            return;
        }

        const isEdit = state.editingPresetId !== null;
        const lessonsData = state.editingLessons;

        const payload = {
            preset_name: name,
            lessons_data: lessonsData
        };

        if (isEdit) {
            payload.id = state.editingPresetId;
        }

        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast(isEdit ? 'Preset updated!' : 'Preset saved!', 'success');
                closePresetModal();
                loadPresets();
            } else {
                showToast(result.message || 'Failed to save preset.', 'error');
            }
        } catch (error) {
            console.error('Error saving preset:', error);
            showToast('An error occurred while saving preset.', 'error');
        }
    }

    // Delete a preset
    async function deletePreset(id, name) {
        if (!confirm(`Delete preset "${name}"? This cannot be undone.`)) return;

        try {
            const response = await fetch('api/custom-exam/presets.php', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Preset deleted.', 'success');
                loadPresets();
            } else {
                showToast(result.message || 'Failed to delete preset.', 'error');
            }
        } catch (error) {
            console.error('Error deleting preset:', error);
            showToast('An error occurred while deleting preset.', 'error');
        }
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================

    // Step navigation
    elements.nextToStep2.addEventListener('click', () => goToStep(2));
    elements.backToStep1.addEventListener('click', () => goToStep(1));
    elements.nextToStep3.addEventListener('click', (e) => {
        e.preventDefault();
        const form = document.getElementById('exam-config-form');
        if (form.checkValidity() && elements.examName.value.trim()) {
            goToStep(3);
        } else {
            if (!elements.examName.value.trim()) {
                showToast('Please enter an exam name.', 'error');
            } else {
                form.reportValidity();
            }
        }
    });
    elements.backToStep2.addEventListener('click', () => goToStep(2));
    elements.generateExamBtn.addEventListener('click', generateExam);

    elements.savePresetBtn.addEventListener('click', openSavePresetModal);
    elements.presetModalCancel.addEventListener('click', closePresetModal);
    elements.presetModalSave.addEventListener('click', saveOrUpdatePreset);
    elements.addCurrentToPresetBtn.addEventListener('click', addCurrentSelectionToPreset);

    // Select Preset Modal events
    elements.selectPresetClose.addEventListener('click', closeSelectPresetModal);
    elements.selectPresetCancel.addEventListener('click', closeSelectPresetModal);
    elements.selectPresetModal.addEventListener('click', (e) => {
        if (e.target === elements.selectPresetModal) closeSelectPresetModal();
    });

    // Delegation for deleting lessons from preset modal
    elements.presetModalLessons.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.remove-preset-lesson');
        if (deleteBtn) {
            const lessonId = parseInt(deleteBtn.dataset.id);
            removeLessonFromPreset(lessonId);
        }
    });

    // Delegation for updating quantities in preset modal
    elements.presetModalLessons.addEventListener('input', (e) => {
        const input = e.target.closest('.preset-lesson-qty');
        if (input) {
            const lessonId = parseInt(input.dataset.id);
            const val = parseInt(input.value) || 0;
            updatePresetLessonQty(lessonId, val);
        }
    });

    // Magic Fill Logic
    elements.magicFillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.magicFillDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        elements.magicFillDropdown.classList.add('hidden');
    });

    document.querySelectorAll('.fill-option').forEach(btn => {
        btn.onclick = async () => {
            const source = btn.dataset.source;
            const targetTotal = parseInt(elements.examTotalQuestions.value) || 0;
            const currentTotal = Array.from(state.selectedLessons.values()).reduce((sum, l) => sum + (l.questionCount || 0), 0);

            if (targetTotal <= currentTotal) {
                showToast(`Target count (${targetTotal}) is already met by current selection (${currentTotal}).`, 'info');
                return;
            }

            const gap = targetTotal - currentTotal;
            showToast(`Filling gap of ${gap} questions from ${source}...`, 'info');

            try {
                await smartFill(gap, source);
            } catch (err) {
                console.error('Smart fill failed:', err);
                showToast('Failed to perform magic fill.', 'error');
            }
        };
    });

    async function smartFill(gap, source) {
        let potentialLessons = [];

        if (source === 'related') {
            // Find lessons in the same subjects as already selected, but not selected yet
            const selectedSubjectIds = new Set(Array.from(state.selectedLessons.values()).map(l => String(l.subjectId)));
            state.subjects.forEach(subject => {
                if (selectedSubjectIds.has(String(subject.subject_id))) {
                    subject.lessons.forEach(l => {
                        if (!state.selectedLessons.has(String(l.lesson_id)) && parseInt(l.total_questions) > 0) {
                            potentialLessons.push({
                                lesson_id: l.lesson_id,
                                lesson_name: l.lesson_name,
                                subject_id: subject.subject_id,
                                subject_name: subject.subject_name,
                                total_questions: parseInt(l.total_questions),
                                unseen_questions: parseInt(l.unseen_questions) || 0,
                                score: 0 // For related, weight is neutral or based on total questions
                            });
                        }
                    });
                }
            });
            potentialLessons.sort((a, b) => b.total_questions - a.total_questions);
        } else if (source === 'fresh') {
            // Prioritize lessons with most unseen questions
            state.subjects.forEach(subject => {
                subject.lessons.forEach(l => {
                    if (!state.selectedLessons.has(String(l.lesson_id)) && parseInt(l.unseen_questions) > 0) {
                        potentialLessons.push({
                            lesson_id: l.lesson_id,
                            lesson_name: l.lesson_name,
                            subject_id: subject.subject_id,
                            subject_name: subject.subject_name,
                            total_questions: parseInt(l.total_questions),
                            unseen_questions: parseInt(l.unseen_questions),
                            score: parseInt(l.unseen_questions)
                        });
                    }
                });
            });
            potentialLessons.sort((a, b) => b.unseen_questions - a.unseen_questions);
        } else if (source === 'weak') {
            // Fetch recommendations for weak areas
            const recommendations = await fetchData('api/performance/get-recommendations.php');
            recommendations.recommendations.forEach(rec => {
                if (rec.lesson_id && !state.selectedLessons.has(String(rec.lesson_id))) {
                    // Find actual lesson data in state
                    const subject = state.subjects.find(s => s.subject_id == rec.subject_id);
                    if (subject) {
                        const l = subject.lessons.find(ls => ls.lesson_id == rec.lesson_id);
                        if (l && parseInt(l.total_questions) > 0) {
                            potentialLessons.push({
                                lesson_id: l.lesson_id,
                                lesson_name: l.lesson_name,
                                subject_id: subject.subject_id,
                                subject_name: subject.subject_name,
                                total_questions: parseInt(l.total_questions),
                                unseen_questions: parseInt(l.unseen_questions) || 0,
                                score: rec.wrong_rate || 100
                            });
                        }
                    }
                }
            });
            potentialLessons.sort((a, b) => b.score - a.score);
        }

        if (potentialLessons.length === 0) {
            showToast('No suitable lessons found to fill the gap.', 'warning');
            return;
        }

        let remainingGap = gap;
        const addedLessons = [];

        for (const lesson of potentialLessons) {
            if (remainingGap <= 0) break;

            const lessonId = String(lesson.lesson_id);
            // Decide how many to take (capped at 20 or total available to avoid one lesson taking over)
            const take = Math.min(20, lesson.total_questions, remainingGap);
            
            // Add to selection
            state.selectedLessons.set(lessonId, {
                subjectId: lesson.subject_id,
                subjectName: lesson.subject_name,
                lessonName: lesson.lesson_name,
                questionCount: take,
                maxQuestions: lesson.total_questions
            });

            // Update DOM (expand and check)
            const subjectHeader = elements.hierarchyTree.querySelector(`.hierarchy-header[data-subject-id="${lesson.subject_id}"]`);
            if (subjectHeader) {
                const subjectDiv = subjectHeader.closest('.border.rounded-lg');
                const lessonsContainer = subjectDiv.querySelector('.hierarchy-item');
                const icon = subjectHeader.querySelector('.expand-icon');

                if (lessonsContainer.classList.contains('hidden')) {
                    icon.classList.add('expanded');
                    lessonsContainer.classList.remove('hidden');
                }

                if (lessonsContainer.children.length === 0) {
                    const subj = state.subjects.find(s => s.subject_id == lesson.subject_id);
                    subj.lessons.forEach(l => {
                        const lDiv = createLessonElement(l, subj.subject_id, subj.subject_name, subj.color_class || 'violet');
                        lessonsContainer.appendChild(lDiv);
                    });
                }
                
                const checkbox = lessonsContainer.querySelector(`.lesson-checkbox[data-lesson-id="${lessonId}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    const input = lessonsContainer.querySelector(`.lesson-input[data-lesson-id="${lessonId}"]`);
                    if (input) {
                        input.disabled = false;
                        input.value = take;
                    }
                }
            }

            remainingGap -= take;
            addedLessons.push(lesson.lesson_name);
        }

        updateSelectedLessons();
        showToast(`Magic Fill complete! Added ${addedLessons.length} lessons to fill the gap.`, 'success');
        
        // Update review step details
        const currentTotal = Array.from(state.selectedLessons.values()).reduce((sum, l) => sum + (l.questionCount || 0), 0);
        elements.examMarks.value = currentTotal;
        elements.examDuration.value = currentTotal;
        elements.examTotalQuestions.value = currentTotal;
    }

    // Close modals on backdrop click
    elements.presetModal.addEventListener('click', (e) => {
        if (e.target === elements.presetModal) closePresetModal();
    });
    
    elements.selectPresetModal.addEventListener('click', (e) => {
        if (e.target === elements.selectPresetModal) closeSelectPresetModal();
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!elements.presetModal.classList.contains('hidden')) closePresetModal();
            if (!elements.selectPresetModal.classList.contains('hidden')) closeSelectPresetModal();
        }
    });

    // Enter key on preset name input -> save
    elements.presetNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveOrUpdatePreset();
        }
    });

    // Select Preset Modal buttons
    elements.selectPresetClose.addEventListener('click', closeSelectPresetModal);
    elements.selectPresetCancel.addEventListener('click', closeSelectPresetModal);

    // Clear Selection button
    if (elements.clearSelectionBtn) {
        elements.clearSelectionBtn.addEventListener('click', clearSelection);
    }

    // =============================================
    // INITIALIZATION
    // =============================================
    fetchHierarchicalData();
    loadPresets();
})();
