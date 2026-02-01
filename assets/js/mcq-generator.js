// This function is called by main.js after the page's HTML is loaded.
function initializeMCQGenerator() {
    // Get references to all DOM elements
    const imageUploadInput = document.getElementById('imageUploadInput');
    if (!imageUploadInput) return; // Exit if not on the AI Generator version of the page

    const imagePreviewsContainer = document.getElementById('imagePreviewsContainer');
    const noImageText = document.getElementById('noImageText');
    const scanButton = document.getElementById('scanButton');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const outputText = document.getElementById('outputText');
    const copyTextButton = document.getElementById('copyTextButton');
    const clearImageButton = document.getElementById('clearImageButton');
    const errorMessage = document.getElementById('errorMessage');

    const generateQuestionsButton = document.getElementById('generateQuestionsButton');
    const generateButtonText = document.getElementById('generateButtonText');
    const questionSpinner = document.getElementById('questionSpinner');
    const questionsOutput = document.getElementById('questionsOutput');
    const copyQuestionsButton = document.getElementById('copyQuestionsButton');
    const mcqCountDisplay = document.getElementById('mcqCountDisplay');
    const mcqReviewContainer = document.getElementById('mcqReviewContainer');
    const noQuestionsText = document.getElementById('noQuestionsText');
    const difficultySelect = document.getElementById('difficultySelect');
    const keywordsInput = document.getElementById('keywordsInput');
    const questionLanguageSelect = document.getElementById('questionLanguageSelect');
    const questionSampleInput = document.getElementById('questionSampleInput');
    const numQuestionsInput = document.getElementById('numQuestionsInput');

    const scanProgressBarContainer = document.getElementById('scanProgressBarContainer');
    const scanProgressText = document.getElementById('scanProgressText');
    const scanProgressBar = document.getElementById('scanProgressBar');
    const genProgressBarContainer = document.getElementById('genProgressBarContainer');
    const genProgressText = document.getElementById('genProgressText');
    const genProgressBar = document.getElementById('genProgressBar');

    const dropZone = document.getElementById('dropZone');
    const exportCsvButton = document.getElementById('exportCsvButton');
    const croppingModal = document.getElementById('croppingModal');
    const imageToCrop = document.getElementById('imageToCrop');
    const applyCropButton = document.getElementById('applyCropButton');
    const cancelCropButton = document.getElementById('cancelCropButton');

    // Navigation elements for the page
    const navTextExtractor = document.getElementById('nav-text-extractor');
    const navQuestionGenerator = document.getElementById('nav-question-generator');
    const textExtractionSection = document.getElementById('text-extraction-section');
    const mcqGenerationSection = document.getElementById('mcq-generation-section');

    let uploadedImages = [];
    let cropperInstance = null;
    let currentCroppingImageIndex = -1;
    let lastScannedText = '';
    let currentMCQs = [];

    function containsBengali(text) {
        const bengaliRegex = /[\u0980-\u09FF]/;
        return bengaliRegex.test(text);
    }

    function resetProgressBar(container, bar, text) {
        if (container) container.classList.add('hidden');
        if (bar) bar.style.width = '0%';
        if (text) text.textContent = '';
    }

    function updateProgressBar(container, bar, text, percentage, message) {
        if (container) container.classList.remove('hidden');
        if (bar) bar.style.width = `${percentage}%`;
        if (text) text.textContent = message;
    }

    function processFiles(files) {
        if (files.length > 0) {
            uploadedImages = [];
            imagePreviewsContainer.innerHTML = '';
            noImageText.classList.add('hidden');
            imagePreviewsContainer.classList.remove('hidden');
            resetProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText);
            resetProgressBar(genProgressBarContainer, genProgressBar, genProgressText);

            Array.from(files).forEach((file, index) => {
                if (!file.type.startsWith('image/')) {
                    displayError(`Skipping non-image file: ${file.name}.`);
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64Data = e.target.result;
                    const mimeType = base64Data.split(',')[0].split(':')[1].split(';')[0];
                    const imgWrapper = document.createElement('div');
                    imgWrapper.className = 'relative w-28 h-28 rounded-md overflow-hidden shadow-md group';
                    const img = document.createElement('img');
                    img.src = base64Data;
                    img.alt = `Preview of ${file.name}`;
                    img.className = 'w-full h-full object-cover';
                    imgWrapper.appendChild(img);
                    const cropButton = document.createElement('button');
                    cropButton.className = 'absolute bottom-1 right-1 bg-gray-800 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity';
                    cropButton.textContent = 'Crop';
                    cropButton.addEventListener('click', () => handleCropButtonClick(index));
                    imgWrapper.appendChild(cropButton);
                    imagePreviewsContainer.appendChild(imgWrapper);
                    uploadedImages.push({ base64: base64Data, mimeType: mimeType, name: file.name, previewElement: img });
                    if (uploadedImages.length === files.length) {
                        scanButton.disabled = false;
                        clearImageButton.disabled = false;
                        clearError();
                        outputText.innerHTML = '';
                        copyTextButton.disabled = true;
                        generateQuestionsButton.disabled = true;
                    }
                };
                reader.onerror = () => displayError(`Failed to read file: ${file.name}.`);
                reader.readAsDataURL(file);
            });
        } else { resetUI(); }
    }

    function resetUI() {
        uploadedImages = [];
        imageUploadInput.value = '';
        imagePreviewsContainer.innerHTML = '';
        noImageText.classList.remove('hidden');
        imagePreviewsContainer.classList.add('hidden');
        scanButton.disabled = true;
        clearImageButton.disabled = true;
        outputText.innerHTML = '';
        copyTextButton.disabled = true;
        generateQuestionsButton.disabled = true;
        questionsOutput.innerHTML = '';
        copyQuestionsButton.disabled = true;
        exportCsvButton.disabled = true;
        mcqCountDisplay.textContent = '';
        mcqReviewContainer.innerHTML = '<p id="noQuestionsText" class="text-gray-500 text-center">No questions generated yet.</p>';
        noQuestionsText.classList.remove('hidden');
        clearError();
        buttonText.textContent = 'Scan Images Text';
        loadingSpinner.classList.add('hidden');
        generateButtonText.textContent = 'Generate Questions';
        questionSpinner.classList.add('hidden');
        lastScannedText = '';
        currentMCQs = [];
        resetProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText);
        resetProgressBar(genProgressBarContainer, genProgressBar, genProgressText);
    }

    function displayError(message, color = 'red') {
        errorMessage.textContent = message;
        errorMessage.className = `mt-4 text-${color}-600 text-sm`;
        errorMessage.classList.remove('hidden');
    }

    function clearError() {
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
    }

    scanButton.addEventListener('click', async function () {
        if (uploadedImages.length === 0) { displayError('Please upload images first.'); return; }
        scanButton.disabled = true; clearImageButton.disabled = true;
        buttonText.textContent = 'Scanning...';
        updateProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText, 0, 'Starting scan...');
        let allExtractedRawText = '';
        outputText.innerHTML = '';

        try {
            for (let i = 0; i < uploadedImages.length; i++) {
                const image = uploadedImages[i];
                const progress = Math.round(((i + 1) / uploadedImages.length) * 100);
                updateProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText, progress, `Scanning image ${i + 1} of ${uploadedImages.length}...`);
                const prompt = `Extract all text from this image. If tables are present, format them as Markdown tables. Preserve original line breaks, paragraphs, and structure for all other text.`;
                const base64ImageData = image.base64.split(',')[1];
                const chatHistory = [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: base64ImageData } }] }];
                const payload = { contents: chatHistory };
                const apiKey = "AIzaSyB2vbs90bLsfqu2xMiD3v-kaFjELCyWIl8";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) { const errorDetail = await response.json(); throw new Error(`API error: ${response.status} - ${errorDetail.error.message}`); }
                const result = await response.json();
                let extractedText = (result.candidates?.[0]?.content?.parts?.[0]?.text) || `No text found in ${image.name}.`;
                allExtractedRawText += extractedText + '\n\n';
                outputText.innerHTML += `<h3>--- Image ${i + 1} (${image.name}) ---</h3>\n${extractedText}\n\n`;
            }
            updateProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText, 100, 'Scan Complete!');
            lastScannedText = outputText.innerHTML;
            copyTextButton.disabled = false;
            generateQuestionsButton.disabled = false;
        } catch (error) {
            displayError(`Error scanning images: ${error.message}.`);
            updateProgressBar(scanProgressBarContainer, scanProgressBar, scanProgressText, 0, 'Scan Failed!');
        } finally {
            scanButton.disabled = false; clearImageButton.disabled = false;
            buttonText.textContent = 'Scan Images Text';
        }
    });

    generateQuestionsButton.addEventListener('click', async function () {
        const currentText = outputText.innerHTML;
        if (!currentText.trim()) { displayError('No text available to generate questions from.'); return; }
        generateQuestionsButton.disabled = true; generateButtonText.textContent = 'Generating...';
        questionSpinner.classList.remove('hidden');
        updateProgressBar(genProgressBarContainer, genProgressBar, genProgressText, 0, 'Starting generation...');
        try {
            const selectedLanguage = questionLanguageSelect.value;
            let languageInstruction = selectedLanguage === 'auto' ? (containsBengali(currentText) ? " in Bengali" : " in English") : ` in ${selectedLanguage}`;
            let prompt = `Analyze the following text and generate multiple-choice questions. For each question, provide 4 options (A, B, C, D), a correct answer key, and a brief explanation. Focus on key information, facts, and concepts from the text. The difficulty level should be ${difficultySelect.value}. Generate questions and options ${languageInstruction}. Text: \`\`\`${currentText}\`\`\``;
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, options: { type: "OBJECT", properties: { A: { type: "STRING" }, B: { type: "STRING" }, C: { type: "STRING" }, D: { type: "STRING" } } }, answer: { type: "STRING" }, explanation: { type: "STRING" } } } } } };
            const apiKey = "AIzaSyB2vbs90bLsfqu2xMiD3v-kaFjELCyWIl8";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { const errorDetail = await response.json(); throw new Error(`API error: ${response.status} - ${errorDetail.error.message}`); }
            const result = await response.json();
            const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonString) throw new Error("No questions generated or response was empty.");
            currentMCQs = JSON.parse(jsonString);
            renderMCQsForEditing(currentMCQs);
            mcqCountDisplay.textContent = `Total MCQs: ${currentMCQs.length}`;
            updateProgressBar(genProgressBarContainer, genProgressBar, genProgressText, 100, 'Generation Complete!');
        } catch (error) {
            displayError(`Error generating questions: ${error.message}.`);
            updateProgressBar(genProgressBarContainer, genProgressBar, genProgressText, 0, 'Generation Failed!');
        } finally {
            generateQuestionsButton.disabled = false; generateButtonText.textContent = 'Generate Questions';
            questionSpinner.classList.add('hidden');
        }
    });

    function renderMCQsForEditing(mcqs) { /* ... (rest of the functions remain the same) ... */ }
    function updateQuestionsOutputJson() { /* ... */ }

    // --- Navigation Logic ---
    function setupNavigation() {
        const navTextExtractor = document.getElementById('nav-text-extractor');
        const navQuestionGenerator = document.getElementById('nav-question-generator');
        const textExtractionSection = document.getElementById('text-extraction-section');
        const mcqGenerationSection = document.getElementById('mcq-generation-section');
        if (!navTextExtractor || !navQuestionGenerator) return;

        function showSection(sectionToShow, activeNav) {
            [textExtractionSection, mcqGenerationSection].forEach(s => s.classList.add('hidden'));
            [navTextExtractor, navQuestionGenerator].forEach(n => {
                n.classList.remove('text-blue-600', 'border-blue-500');
                n.classList.add('text-gray-500', 'hover:text-blue-500');
            });
            sectionToShow.classList.remove('hidden');
            activeNav.classList.add('text-blue-600', 'border-blue-500');
            activeNav.classList.remove('text-gray-500', 'hover:text-blue-500');
        }

        navTextExtractor.addEventListener('click', () => showSection(textExtractionSection, navTextExtractor));
        navQuestionGenerator.addEventListener('click', () => showSection(mcqGenerationSection, navQuestionGenerator));

        showSection(textExtractionSection, navTextExtractor);
    }

    // --- Initialize all parts of the app ---
    setupNavigation();
    imageUploadInput.addEventListener('change', (e) => processFiles(e.target.files));
    clearImageButton.addEventListener('click', resetUI);
    // ... all other event listeners ...
}

// Ensure this script runs after the specific page's HTML is loaded by main.js
initializeMCQGenerator();
