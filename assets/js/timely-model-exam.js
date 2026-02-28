(function () {
    'use strict';

    // API URLs
    const API_SUBJECTS = 'api/exam/subjects.php';
    const API_LESSONS = 'api/exam/lessons.php';
    const API_TOPICS = 'api/exam/topics.php';
    const API_EXAMS = 'api/exam/exam.php?action=list';
    const API_CREATE_EXAM = 'api/custom-exam/create.php';

    // DOM Elements
    const hierarchyLoading = document.getElementById('hierarchy-loading');
    const hierarchyTree = document.getElementById('hierarchy-tree');
    const selectionSummary = document.getElementById('selection-summary');
    const totalSelected = document.getElementById('total-selected');
    const selectedExamsList = document.getElementById('selected-exams-list');
    const toastContainer = document.getElementById('toast-container');

    // Date filter elements
    const fromDateInput = document.getElementById('from-date');
    const toDateInput = document.getElementById('to-date');
    const applyFilterBtn = document.getElementById('apply-date-filter');
    const resetDateFiltersBtn = document.getElementById('reset-date-filters');
    const presetButtons = document.querySelectorAll('.preset-btn');

    // Step containers
    const step1Content = document.getElementById('step-1-content');
    const step2Content = document.getElementById('step-2-content');
    const step3Content = document.getElementById('step-3-content');

    // Step indicators
    const step1Indicator = document.getElementById('step-1-indicator');
    const step2Indicator = document.getElementById('step-2-indicator');
    const step3Indicator = document.getElementById('step-3-indicator');

    // Buttons
    const nextToStep2Btn = document.getElementById('next-to-step-2');
    const backToStep1Btn = document.getElementById('back-to-step-1');
    const nextToStep3Btn = document.getElementById('next-to-step-3');
    const backToStep2Btn = document.getElementById('back-to-step-2');
    const generateExamBtn = document.getElementById('generate-exam-btn');

    // Form inputs
    const examNameInput = document.getElementById('exam-name');
    const examDurationInput = document.getElementById('exam-duration');
    const examMarksInput = document.getElementById('exam-marks');
    const examNegativeInput = document.getElementById('exam-negative');
    const examTotalQuestionsInput = document.getElementById('exam-total-questions');
    const bulkQuestionCountSelect = document.getElementById('bulk-question-count');

    // State
    let hierarchyData = {};
    let selectedExams = {}; // { examId: { examTitle, maxQuestions, selectedCount } }
    let currentStep = 1;
    let currentDateFilter = { from: '', to: '' };

    // Helper: Format date to YYYY-MM-DD
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper: Set date range
    function setDateRange(daysAgo) {
        const today = new Date();
        let toDate = formatDate(today);
        let fromDate;

        if (daysAgo === 0) {
            // Today only
            fromDate = toDate;
        } else if (daysAgo === 1) {
            // Yesterday only
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            fromDate = formatDate(yesterday);
            toDate = formatDate(yesterday);
        } else {
            // Calculate past date
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - daysAgo + 1);
            fromDate = formatDate(pastDate);
        }

        fromDateInput.value = fromDate;
        toDateInput.value = toDate;

        currentDateFilter = { from: fromDate, to: toDate };

        // Update button styles
        presetButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        });

        return { from: fromDate, to: toDate };
    }

    // Helper: Show toast
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        const icon = type === 'error' ? 'error' : 'check_circle';
        toast.className = `flex items-center text-white p-4 rounded-lg shadow-lg mb-2 ${bgColor}`;
        toast.innerHTML = `<span class="material-symbols-outlined mr-3">${icon}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // Helper: Fetch data with caching (cache key includes date filter)
    async function fetchData(url, skipCache = false) {
        // Use central CacheManager with a 10-minute TTL
        return await CacheManager.fetchWithCache(url, 10, skipCache);
    }

    // Build hierarchy tree - SIMPLIFIED: Load exams directly
    async function buildHierarchy() {
        try {
            hierarchyLoading.classList.remove('hidden');
            hierarchyTree.classList.add('hidden');

            // Load exams directly without hierarchy
            await loadAllExams();

            hierarchyLoading.classList.add('hidden');
            hierarchyTree.classList.remove('hidden');
        } catch (error) {
            console.error('Error loading exams:', error);
            showToast('Failed to load exams', 'error');
            hierarchyLoading.innerHTML = '<p class="text-red-500 text-center">Failed to load data. Please refresh the page.</p>';
        }
    }

    // Load all exams directly with date filter
    async function loadAllExams() {
        try {
            console.log('Current date filter:', currentDateFilter);

            // Build URL with date filter - increased limit to 100
            let url = `${API_EXAMS}&limit=100&exclude_custom=true`;
            if (currentDateFilter.from && currentDateFilter.to) {
                url += `&from=${currentDateFilter.from}&to=${currentDateFilter.to}`;
            }

            console.log('Fetching all exams from:', url);
            console.log('Date range:', currentDateFilter.from, 'to', currentDateFilter.to);

            // Use fetchData helper to enable caching and reduce server hits
            const exams = await fetchData(url);

            console.log('📊 Total exams received:', exams.length);

            hierarchyTree.innerHTML = '';

            if (exams.length === 0) {
                hierarchyTree.innerHTML = '<div class="p-4 text-center text-gray-500">No exams found for selected date range.</div>';
            } else {
                // Group exams by subject
                const groupedBySubject = {};
                exams.forEach(exam => {
                    const subjectName = exam.subject_name || 'Unknown Subject';
                    if (!groupedBySubject[subjectName]) {
                        groupedBySubject[subjectName] = [];
                    }
                    groupedBySubject[subjectName].push(exam);
                });

                console.log('📁 Grouped by subject:', groupedBySubject);
                console.log('📁 Number of subjects:', Object.keys(groupedBySubject).length);

                // Create expandable sections for each subject
                Object.entries(groupedBySubject).forEach(([subjectName, subjectExams]) => {
                    console.log(`  Creating section for "${subjectName}" with ${subjectExams.length} exams`);
                    const subjectDiv = createExpandableSection(subjectName, subjectExams, 'subject');
                    hierarchyTree.appendChild(subjectDiv);
                });

                console.log('✅ All sections created and appended');

                // If "Select All" is active, we need to refresh the summary as new exams were added to state
                if (selectAllQuestionsCheckbox && selectAllQuestionsCheckbox.checked) {
                    updateSelectionSummary();
                }
            }
        } catch (error) {
            console.error('Error loading exams:', error);
            hierarchyTree.innerHTML = `<div class="p-4 text-center text-red-500">Failed to load exams: ${error.message}</div>`;
        }
    }

    // Create expandable section for grouped exams
    function createExpandableSection(title, exams, type) {
        const div = document.createElement('div');
        div.className = 'mb-3';

        const header = document.createElement('div');
        header.className = 'flex items-center p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition';
        header.innerHTML = `
            <span class="material-symbols-outlined expand-icon text-gray-600 mr-2 transition-transform">chevron_right</span>
            <span class="material-symbols-outlined mr-2 text-blue-600">${getIcon(type)}</span>
            <span class="font-bold text-gray-800">${title}</span>
            <span class="ml-auto text-sm text-gray-600">${exams.length} exam${exams.length !== 1 ? 's' : ''}</span>
        `;

        const content = document.createElement('div');
        content.className = 'hidden ml-6 mt-2 space-y-2';

        exams.forEach(exam => {
            const examDiv = createExamItem(exam);
            content.appendChild(examDiv);
        });

        header.addEventListener('click', () => {
            const icon = header.querySelector('.expand-icon');
            const isExpanded = content.classList.contains('hidden');

            if (isExpanded) {
                content.classList.remove('hidden');
                icon.style.transform = 'rotate(90deg)';
            } else {
                content.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
            }
        });

        div.appendChild(header);
        div.appendChild(content);

        return div;
    }

    // Reload exams with new date filter
    async function reloadExamsWithDateFilter() {
        hierarchyLoading.classList.remove('hidden');
        hierarchyTree.classList.add('hidden');

        await loadAllExams();

        hierarchyLoading.classList.add('hidden');
        hierarchyTree.classList.remove('hidden');

        showToast('Exam list updated with new date filter');
    }

    // Remove unused hierarchy functions
    function renderHierarchy() { }
    async function renderLessons() { }
    async function renderTopics() { }
    async function renderExams() { }
    function createHierarchyItem() { }

    function createExamItem(exam) {
        const selectAllChecked = selectAllQuestionsCheckbox && selectAllQuestionsCheckbox.checked;
        const isChecked = !!selectedExams[exam.id] || selectAllChecked;

        let initialValue = '';
        if (selectedExams[exam.id]) {
            initialValue = selectedExams[exam.id].selectedCount;
        } else if (selectAllChecked) {
            initialValue = exam.total_questions;
        }

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2';

        // Build breadcrumb path
        const breadcrumb = [exam.subject_name, exam.lesson_name, exam.topic_name]
            .filter(Boolean)
            .join(' → ');

        div.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <input type="checkbox" 
                       class="exam-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
                       data-exam-id="${exam.id}"
                       ${isChecked ? 'checked' : ''}>
                <div class="flex-1 cursor-pointer" onclick="this.previousElementSibling.click()">
                    <div class="font-semibold text-gray-800">${exam.exam_title}</div>
                    ${breadcrumb ? `<div class="text-xs text-gray-500 mt-1">${breadcrumb}</div>` : ''}
                    <div class="text-xs text-blue-600 mt-0.5 font-medium">Date: ${exam.updated_at ? exam.updated_at.split(' ')[0] : 'N/A'}</div>
                    <div class="text-sm text-gray-600">Available Questions: ${exam.total_questions}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" 
                       class="exam-input px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                       data-exam-id="${exam.id}"
                       data-exam-title="${exam.exam_title}"
                       data-max-questions="${exam.total_questions}"
                       min="1" 
                       max="${exam.total_questions}" 
                       placeholder="Qty"
                       ${isChecked ? '' : 'disabled'}
                       value="${initialValue}">
                <span class="text-sm text-gray-600">questions</span>
            </div>
        `;

        const checkbox = div.querySelector('.exam-checkbox');
        const input = div.querySelector('.exam-input');

        // If it was auto-selected via "Select All", we need to update the state
        if (selectAllChecked && !selectedExams[exam.id]) {
            // We can't call handleExamSelection directly here because it updates summary which might be slow in loop
            // But for a few exams it's fine. 
            // Better: update state manually if needed, or let the caller handle it.
            // Actually, handleExamSelection is fine for now as it's async-friendly.

            // Delay slightly to ensure DOM is ready if needed, or just update state
            selectedExams[exam.id] = {
                examTitle: exam.exam_title,
                maxQuestions: exam.total_questions,
                selectedCount: exam.total_questions
            };
            // Note: We'll call updateSelectionSummary once after the loop in loadAllExams
        }

        checkbox.addEventListener('change', (e) => {
            input.disabled = !e.target.checked;
            if (e.target.checked) {
                if (!input.value) {
                    // Use bulk dropdown value if set, otherwise default to min(5, total)
                    const bulkCount = parseInt(bulkQuestionCountSelect?.value) || 0;
                    const defaultCount = bulkCount > 0 ? bulkCount : Math.min(5, exam.total_questions);
                    input.value = Math.min(defaultCount, exam.total_questions);
                }
                handleExamSelection(input);
            } else {
                input.value = '';
                handleExamSelection(input);
            }
        });

        input.addEventListener('input', (e) => {
            if (checkbox.checked) {
                handleExamSelection(e.target);
            }
        });

        return div;
    }

    function getIcon(type) {
        const icons = {
            subject: 'subject',
            lesson: 'library_books',
            topic: 'topic',
            exam: 'quiz'
        };
        return icons[type] || 'folder';
    }

    function handleExamSelection(input) {
        const examId = input.dataset.examId;
        const examTitle = input.dataset.examTitle;
        const maxQuestions = parseInt(input.dataset.maxQuestions);
        const selectedCount = parseInt(input.value) || 0;

        if (selectedCount > maxQuestions) {
            input.value = maxQuestions;
            showToast(`Maximum ${maxQuestions} questions available for this exam`, 'error');
            return;
        }

        if (selectedCount > 0) {
            selectedExams[examId] = { examTitle, maxQuestions, selectedCount };
        } else {
            delete selectedExams[examId];
        }

        updateSelectionSummary();
    }

    function updateSelectionSummary() {
        const totalQuestions = Object.values(selectedExams).reduce((sum, exam) => sum + exam.selectedCount, 0);
        const examCount = Object.keys(selectedExams).length;

        totalSelected.textContent = totalQuestions;

        if (examCount > 0) {
            selectionSummary.classList.remove('hidden');
            selectedExamsList.innerHTML = Object.entries(selectedExams)
                .map(([id, exam]) => `<div>• ${exam.examTitle}: ${exam.selectedCount} questions</div>`)
                .join('');
            nextToStep2Btn.disabled = false;
        } else {
            selectionSummary.classList.add('hidden');
            nextToStep2Btn.disabled = true;
        }
    }


    // Step navigation
    function showStep(step) {
        // Hide all steps
        step1Content.classList.add('hidden');
        step2Content.classList.add('hidden');
        step3Content.classList.add('hidden');

        // Reset indicators
        [step1Indicator, step2Indicator, step3Indicator].forEach(ind => {
            ind.classList.add('opacity-50');
            ind.querySelector('div').className = 'w-10 h-10 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold';
            ind.querySelector('span').className = 'ml-2 font-semibold text-gray-500';
        });

        // Show current step
        currentStep = step;
        if (step === 1) {
            step1Content.classList.remove('hidden');
            step1Indicator.classList.remove('opacity-50');
            step1Indicator.querySelector('div').className = 'w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold';
            step1Indicator.querySelector('span').className = 'ml-2 font-semibold text-gray-800';
        } else if (step === 2) {
            step2Content.classList.remove('hidden');
            step2Indicator.classList.remove('opacity-50');
            step2Indicator.querySelector('div').className = 'w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold';
            step2Indicator.querySelector('span').className = 'ml-2 font-semibold text-gray-800';

            // Pre-fill total questions and auto-calculate duration/marks
            const totalQuestions = Object.values(selectedExams).reduce((sum, exam) => sum + exam.selectedCount, 0);
            examTotalQuestionsInput.value = totalQuestions;
            examDurationInput.value = totalQuestions;
            examMarksInput.value = totalQuestions;

            // Pre-fill exam name based on date filter
            if (currentDateFilter.from && currentDateFilter.to) {
                if (currentDateFilter.from === currentDateFilter.to) {
                    examNameInput.value = `Exams from ${currentDateFilter.from}`;
                } else {
                    examNameInput.value = `Exams from ${currentDateFilter.from} to ${currentDateFilter.to}`;
                }
            }
        } else if (step === 3) {
            step3Content.classList.remove('hidden');
            step3Indicator.classList.remove('opacity-50');
            step3Indicator.querySelector('div').className = 'w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold';
            step3Indicator.querySelector('span').className = 'ml-2 font-semibold text-gray-800';

            // Populate review
            populateReview();
        }
    }

    function populateReview() {
        document.getElementById('review-name').textContent = examNameInput.value;
        document.getElementById('review-duration').textContent = examDurationInput.value;
        document.getElementById('review-marks').textContent = examMarksInput.value;
        document.getElementById('review-questions').textContent = examTotalQuestionsInput.value;
        document.getElementById('review-negative').textContent = examNegativeInput.value;

        const reviewExamsList = document.getElementById('review-exams-list');
        reviewExamsList.innerHTML = Object.entries(selectedExams)
            .map(([id, exam]) => `<div class="text-gray-700">• ${exam.examTitle}: ${exam.selectedCount} questions</div>`)
            .join('');
    }

    // Generate exam
    async function generateExam() {
        try {
            generateExamBtn.disabled = true;
            generateExamBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Generating...';

            const sourceExams = Object.entries(selectedExams).map(([examId, exam]) => ({
                exam_id: parseInt(examId),
                question_count: exam.selectedCount
            }));

            function getSelectedPriorities() {
                const checkboxes = document.querySelectorAll('input[name="priority_level"]:checked');
                return Array.from(checkboxes).map(cb => parseInt(cb.value));
            }

            const payload = {
                new_exam_details: {
                    subject_id: null,
                    lesson_id: null,
                    topic_id: null,
                    exam_title: examNameInput.value,
                    duration: parseInt(examDurationInput.value),
                    instructions: 'Combined exam from multiple sources',
                    total_marks: parseFloat(examMarksInput.value),
                    pass_mark: Math.floor(parseFloat(examMarksInput.value) * 0.4)
                },
                source_exams: sourceExams,
                priority_levels: getSelectedPriorities()
            };

            const response = await fetch(API_CREATE_EXAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Exam created successfully!');

                // --- Cache Invalidation ---
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clearGroup('dashboard');
                    CacheManager.clearGroup('custom-exam');
                }

                setTimeout(() => {
                    if (window.loadPage) window.loadPage('custom-exams');
                }, 1500);
            } else {
                throw new Error(result.message || 'Failed to create exam');
            }
        } catch (error) {
            console.error('Error generating exam:', error);
            showToast(error.message || 'Failed to generate exam', 'error');
            generateExamBtn.disabled = false;
            generateExamBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Generate Exam';
        }
    }

    const selectAllQuestionsCheckbox = document.getElementById('select-all-questions');

    // Bulk question count dropdown listener
    if (bulkQuestionCountSelect) {
        bulkQuestionCountSelect.addEventListener('change', () => {
            const count = parseInt(bulkQuestionCountSelect.value);
            if (!count) return;

            // If "Select All" is checked, we don't want the bulk dropdown to override everything in a confusing way
            // But if it's not checked, we proceed as normal
            if (selectAllQuestionsCheckbox && selectAllQuestionsCheckbox.checked) {
                showToast('Turn off "Select All Questions" to manual set a fixed number of questions', 'error');
                bulkQuestionCountSelect.value = "";
                return;
            }

            const allExamInputs = document.querySelectorAll('.exam-input');
            if (allExamInputs.length === 0) {
                showToast('No exams loaded yet. Please wait or apply a date filter first.', 'error');
                return;
            }

            const allCheckboxes = document.querySelectorAll('.exam-checkbox');

            allCheckboxes.forEach(checkbox => {
                const examId = checkbox.dataset.examId;
                const input = document.querySelector(`.exam-input[data-exam-id="${examId}"]`);
                if (!input) return;

                if (!checkbox.checked) {
                    checkbox.checked = true;
                    input.disabled = false;
                }

                const maxQ = parseInt(input.dataset.maxQuestions) || count;
                input.value = Math.min(count, maxQ);

                handleExamSelection(input);
            });

            showToast(`Set ${count} question(s) for all exams`);
        });
    }

    // "Select All Questions" listener
    if (selectAllQuestionsCheckbox) {
        selectAllQuestionsCheckbox.addEventListener('change', () => {
            const isChecked = selectAllQuestionsCheckbox.checked;

            if (isChecked) {
                // Disable bulk dropdown as they conflict
                if (bulkQuestionCountSelect) {
                    bulkQuestionCountSelect.disabled = true;
                    bulkQuestionCountSelect.value = "";
                }

                // Select all available questions for all exams
                const allCheckboxes = document.querySelectorAll('.exam-checkbox');
                allCheckboxes.forEach(checkbox => {
                    const examId = checkbox.dataset.examId;
                    const input = document.querySelector(`.exam-input[data-exam-id="${examId}"]`);
                    if (!input) return;

                    checkbox.checked = true;
                    input.disabled = false;

                    const maxQ = parseInt(input.dataset.maxQuestions) || 0;
                    input.value = maxQ;

                    handleExamSelection(input);
                });

                showToast('All available questions selected from all filtered exams');
            } else {
                // Enable bulk dropdown
                if (bulkQuestionCountSelect) {
                    bulkQuestionCountSelect.disabled = false;
                }

                // Clear all selections when "Select All" is turned off
                selectedExams = {};

                const allCheckboxes = document.querySelectorAll('.exam-checkbox');
                allCheckboxes.forEach(checkbox => {
                    checkbox.checked = false;
                    const examId = checkbox.dataset.examId;
                    const input = document.querySelector(`.exam-input[data-exam-id="${examId}"]`);
                    if (input) {
                        input.disabled = true;
                        input.value = "";
                    }
                });

                updateSelectionSummary();
                showToast('Selection cleared');
            }
        });
    }

    // Date filter event listeners
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const days = parseInt(btn.dataset.days);
            console.log('📅 Preset button clicked:', days, 'days');

            setDateRange(days);

            // Update active button style
            presetButtons.forEach(b => {
                b.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                b.classList.add('bg-gray-600', 'hover:bg-gray-700');
            });
            btn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            btn.classList.add('bg-blue-600', 'hover:bg-blue-700');

            // Auto-apply filter
            localStorage.setItem('filter_timely_from', fromDateInput.value);
            localStorage.setItem('filter_timely_to', toDateInput.value);
            reloadExamsWithDateFilter();
        });
    });

    applyFilterBtn.addEventListener('click', () => {
        const from = fromDateInput.value;
        const to = toDateInput.value;

        if (!from || !to) {
            showToast('Please select both From and To dates', 'error');
            return;
        }

        if (new Date(from) > new Date(to)) {
            showToast('From date cannot be after To date', 'error');
            return;
        }

        currentDateFilter = { from, to };
        localStorage.setItem('filter_timely_from', from);
        localStorage.setItem('filter_timely_to', to);

        // Reset preset button styles
        presetButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        });

        reloadExamsWithDateFilter();
    });

    if (resetDateFiltersBtn) {
        resetDateFiltersBtn.addEventListener('click', () => {
            localStorage.removeItem('filter_timely_from');
            localStorage.removeItem('filter_timely_to');

            setDateRange(0); // Reset to today

            // Set first preset button as active
            if (presetButtons.length > 0) {
                presetButtons.forEach(b => {
                    b.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    b.classList.add('bg-gray-600', 'hover:bg-gray-700');
                });
                presetButtons[0].classList.remove('bg-gray-600', 'hover:bg-gray-700');
                presetButtons[0].classList.add('bg-blue-600', 'hover:bg-blue-700');
            }

            reloadExamsWithDateFilter();
        });
    }

    // Step navigation event listeners
    nextToStep2Btn.addEventListener('click', () => showStep(2));
    backToStep1Btn.addEventListener('click', () => showStep(1));
    nextToStep3Btn.addEventListener('click', (e) => {
        e.preventDefault();
        const form = document.getElementById('exam-config-form');
        if (form.checkValidity()) {
            showStep(3);
        } else {
            form.reportValidity();
        }
    });
    backToStep2Btn.addEventListener('click', () => showStep(2));
    generateExamBtn.addEventListener('click', generateExam);

    // Initialize - Restore from localStorage or set default to "Today"
    const savedFromDate = localStorage.getItem('filter_timely_from');
    const savedToDate = localStorage.getItem('filter_timely_to');

    if (savedFromDate && savedToDate) {
        fromDateInput.value = savedFromDate;
        toDateInput.value = savedToDate;
        currentDateFilter = { from: savedFromDate, to: savedToDate };

        // Reset preset button styles as none might be specifically active from range
        presetButtons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            btn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        });
    } else {
        const todayFilter = setDateRange(0);
        currentDateFilter = todayFilter;

        // Set first preset button as active
        if (presetButtons.length > 0) {
            presetButtons[0].classList.remove('bg-gray-600', 'hover:bg-gray-700');
            presetButtons[0].classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }

    buildHierarchy();
})();
