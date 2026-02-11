/**
 * Shared utilities for question management.
 */

const QuestionUtils = {
    /**
     * Parses and validates a JSON string into an array of questions.
     * @param {string} jsonText - The JSON string to parse.
     * @returns {Object} - { success: boolean, data: Array|null, message: string|null }
     */
    parseQuestionsJSON: function (jsonText) {
        if (!jsonText.trim()) {
            return { success: false, data: null, message: 'Please provide question JSON.' };
        }

        let questions;
        try {
            questions = JSON.parse(jsonText);
            // If it's a single object, wrap it in an array
            if (questions && typeof questions === 'object' && !Array.isArray(questions)) {
                questions = [questions];
            }

            if (!Array.isArray(questions)) {
                return { success: false, data: null, message: 'Invalid format. Please provide a question object or an array of questions.' };
            }
        } catch (error) {
            return { success: false, data: null, message: 'Invalid JSON format. Please check your syntax.' };
        }

        // Basic structural validation
        for (let i = 0; i < questions.length; i++) {
            const validation = this.validateQuestion(questions[i], i + 1);
            if (!validation.success) {
                return validation;
            }
        }

        return { success: true, data: questions, message: null };
    },

    /**
     * Validates a single question object.
     * @param {Object} q - The question object.
     * @param {number} index - The index for error reporting.
     * @returns {Object} - { success: boolean, message: string|null }
     */
    validateQuestion: function (q, index) {
        if (!q.question || !q.question.trim()) {
            return { success: false, message: `Question #${index} is missing the "question" text.` };
        }
        if (!q.options || typeof q.options !== 'object' || Array.isArray(q.options)) {
            return { success: false, message: `Question #${index} must have an "options" object.` };
        }
        if (!q.answer || !q.answer.trim()) {
            return { success: false, message: `Question #${index} is missing the "answer".` };
        }

        // Check if answer matches one of the options keys
        const optionKeys = Object.keys(q.options);
        if (optionKeys.length === 0) {
            return { success: false, message: `Question #${index} must have at least one option.` };
        }
        if (!optionKeys.includes(q.answer)) {
            return { success: false, message: `Question #${index} answer "${q.answer}" does not match any of the provided options: ${optionKeys.join(', ')}.` };
        }

        return { success: true };
    },

    /**
     * Renders a preview list of questions.
     * @param {Array} questions - Array of question objects.
     * @param {Function} onRemove - Callback function when a question is removed.
     * @returns {string} - HTML string for the preview.
     */
    renderPreview: function (questions, onRemove) {
        if (questions.length === 0) {
            return '<p class="text-gray-500 italic">No questions imported yet.</p>';
        }

        return `
            <div class="space-y-4">
                <p class="font-bold text-blue-600">Total Questions: ${questions.length}</p>
                <div class="max-h-64 overflow-y-auto space-y-2 pr-2">
                    ${questions.map((q, index) => `
                        <div class="p-3 border rounded-lg bg-gray-50 relative group">
                            <button type="button" class="remove-question-btn absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-index="${index}">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                            <p class="text-sm font-semibold pr-6">#${index + 1}: ${q.question}</p>
                            <div class="grid grid-cols-2 gap-1 mt-1">
                                ${Object.entries(q.options).map(([key, val]) => `
                                    <div class="text-xs ${key === q.answer ? 'text-green-600 font-bold' : 'text-gray-600'}">
                                        ${key}: ${val}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

if (typeof window !== 'undefined') {
    window.QuestionUtils = QuestionUtils;
}
