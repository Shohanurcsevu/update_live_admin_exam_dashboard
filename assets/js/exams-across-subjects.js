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

    // State
    let hierarchyData = {};
    let selectedExams = {}; // { examId: { examTitle, maxQuestions, selectedCount } }
    let currentStep = 1;

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

    // Helper: Fetch data
    async function fetchData(url) {
        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to fetch data');
        return result.data;
    }

    // Build hierarchy tree
    async function buildHierarchy() {
        try {
            hierarchyLoading.classList.remove('hidden');
            hierarchyTree.classList.add('hidden');

            const subjectsData = await fetchData(API_SUBJECTS);
            const subjects = subjectsData.sort((a, b) => a.id - b.id);

            for (const subject of subjects) {
                const lessons = await fetchData(`${API_LESSONS}?subject_id=${subject.id}`);
                hierarchyData[subject.id] = {
                    ...subject,
                    lessons: {}
                };

                for (const lesson of lessons) {
                    const topics = await fetchData(`${API_TOPICS}?lesson_id=${lesson.id}`);
                    hierarchyData[subject.id].lessons[lesson.id] = {
                        ...lesson,
                        topics: {}
                    };

                    for (const topic of topics) {
                        const exams = await fetchData(`${API_EXAMS}&topic_id=${topic.id}`);
                        hierarchyData[subject.id].lessons[lesson.id].topics[topic.id] = {
                            ...topic,
                            exams: exams
                        };
                    }
                }
            }

            renderHierarchy();
            hierarchyLoading.classList.add('hidden');
            hierarchyTree.classList.remove('hidden');
        } catch (error) {
            console.error('Error building hierarchy:', error);
            showToast('Failed to load exam hierarchy', 'error');
            hierarchyLoading.innerHTML = '<p class="text-red-500 text-center">Failed to load data. Please refresh the page.</p>';
        }
    }

    // Render hierarchy tree
    function renderHierarchy() {
        hierarchyTree.innerHTML = '';

        Object.values(hierarchyData).forEach(subject => {
            const subjectDiv = createHierarchyItem(
                subject.subject_name,
                'subject',
                `subject-${subject.id}`,
                () => renderLessons(subject, subjectDiv)
            );
            hierarchyTree.appendChild(subjectDiv);
        });
    }

    function renderLessons(subject, parentDiv) {
        const container = parentDiv.querySelector('.children-container');
        if (container.children.length > 0) {
            container.innerHTML = '';
            return;
        }

        Object.values(subject.lessons).forEach(lesson => {
            const lessonDiv = createHierarchyItem(
                lesson.lesson_name,
                'lesson',
                `lesson-${lesson.id}`,
                () => renderTopics(lesson, lessonDiv)
            );
            container.appendChild(lessonDiv);
        });
    }

    function renderTopics(lesson, parentDiv) {
        const container = parentDiv.querySelector('.children-container');
        if (container.children.length > 0) {
            container.innerHTML = '';
            return;
        }

        Object.values(lesson.topics).forEach(topic => {
            const topicDiv = createHierarchyItem(
                topic.topic_name,
                'topic',
                `topic-${topic.id}`,
                () => renderExams(topic, topicDiv)
            );
            container.appendChild(topicDiv);
        });
    }

    function renderExams(topic, parentDiv) {
        const container = parentDiv.querySelector('.children-container');
        if (container.children.length > 0) {
            container.innerHTML = '';
            return;
        }

        topic.exams.forEach(exam => {
            const examDiv = createExamItem(exam);
            container.appendChild(examDiv);
        });
    }

    function createHierarchyItem(name, type, id, onExpand) {
        const div = document.createElement('div');
        div.className = 'hierarchy-item';
        div.innerHTML = `
            <div class="hierarchy-header" data-id="${id}">
                <span class="material-symbols-outlined expand-icon text-gray-600 mr-2">chevron_right</span>
                <span class="material-symbols-outlined mr-2 text-blue-600">${getIcon(type)}</span>
                <span class="font-semibold text-gray-800">${name}</span>
            </div>
            <div class="children-container ml-6 hidden"></div>
        `;

        const header = div.querySelector('.hierarchy-header');
        const icon = div.querySelector('.expand-icon');
        const childrenContainer = div.querySelector('.children-container');

        header.addEventListener('click', () => {
            icon.classList.toggle('expanded');
            childrenContainer.classList.toggle('hidden');
            if (!childrenContainer.classList.contains('hidden')) {
                onExpand();
            }
        });

        return div;
    }

    function createExamItem(exam) {
        const isChecked = !!selectedExams[exam.id];
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2';
        div.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <input type="checkbox" 
                       class="exam-checkbox w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
                       data-exam-id="${exam.id}"
                       ${isChecked ? 'checked' : ''}>
                <div class="flex-1 cursor-pointer" onclick="this.previousElementSibling.click()">
                    <div class="font-semibold text-gray-800">${exam.exam_title}</div>
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
                       value="${selectedExams[exam.id]?.selectedCount || ''}">
                <span class="text-sm text-gray-600">questions</span>
            </div>
        `;

        const checkbox = div.querySelector('.exam-checkbox');
        const input = div.querySelector('.exam-input');

        checkbox.addEventListener('change', (e) => {
            input.disabled = !e.target.checked;
            if (e.target.checked) {
                if (!input.value) {
                    input.value = Math.min(5, exam.total_questions);
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
                source_exams: sourceExams
            };

            const response = await fetch(API_CREATE_EXAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Exam created successfully!');
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

    // Event listeners
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

    // Initialize
    buildHierarchy();
})();
