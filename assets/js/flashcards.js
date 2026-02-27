// Flashcards Review System with Leitner Algorithm

let currentCards = [];
let currentCardIndex = 0;
let sessionStats = { correct: 0, incorrect: 0 };
let isFlipped = false;

// Initialize page
loadDecks();

// Load available decks
async function loadDecks() {
    try {
        const response = await fetch('api/flashcards/decks.php');
        const result = await response.json();

        if (result.success && result.decks) {
            renderDecks(result.decks);
        }
    } catch (error) {
        console.error('Error loading decks:', error);
    }
}

// Render deck cards
function renderDecks(decks) {
    const container = document.getElementById('decks-container');

    if (decks.length === 0) {
        container.innerHTML = `
            <div class="col-span-2 text-center py-12 text-gray-400">
                <span class="material-symbols-outlined text-6xl mb-4 opacity-20">inventory_2</span>
                <p class="text-lg mb-2">No flashcards yet!</p>
                <p class="text-sm">Click "Generate from Mistakes" to create your first deck.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = decks.map(deck => {
        // More professional color tokens
        const colors = {
            red: { bg: 'from-rose-50 to-white', border: 'border-rose-100', text: 'text-rose-600', icon: 'text-rose-400' },
            amber: { bg: 'from-amber-50 to-white', border: 'border-amber-100', text: 'text-amber-600', icon: 'text-amber-400' },
            green: { bg: 'from-emerald-50 to-white', border: 'border-emerald-100', text: 'text-emerald-600', icon: 'text-emerald-400' }
        };
        const p = deck.cards_due > 15 ? colors.red : deck.cards_due > 0 ? colors.amber : colors.green;

        return `
            <div class="bg-gradient-to-br ${p.bg} border ${p.border} rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
                 onclick="startReview(${deck.topic_id}, '${deck.topic}')">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">${deck.subject}</p>
                        <h3 class="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">${deck.topic}</h3>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center ${p.icon}">
                        <span class="material-symbols-outlined text-xl">layers</span>
                    </div>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <div class="flex items-center gap-1.5 text-gray-500 font-medium">
                        <span class="material-symbols-outlined text-sm">style</span>
                        ${deck.total_cards} cards
                    </div>
                    <div class="px-3 py-1 rounded-full bg-white/80 shadow-sm border border-inherit ${p.text} font-bold text-xs uppercase tracking-wider">
                        ${deck.cards_due} due
                    </div>
                </div>
                ${deck.accuracy !== null ? `
                    <div class="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                        <div class="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-purple-500 rounded-full" style="width: ${deck.accuracy}%"></div>
                        </div>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${deck.accuracy}%</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Generate new flashcards from mistakes
async function generateNewCards() {
    try {
        const response = await fetch('api/flashcards/generate.php', { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            // Using window.showToast if available, fallback to alert
            if (typeof window.showToast === 'function') {
                window.showToast(result.message, result.cards_created > 0 ? 'success' : 'info');
            } else {
                alert(result.message);
            }
            loadDecks(); // Reload decks
        } else {
            console.error('Generation failed:', result.error);
            if (typeof window.showToast === 'function') {
                window.showToast('Generation failed: ' + result.error, 'error');
            } else {
                alert('Generation failed: ' + result.error);
            }
        }
    } catch (error) {
        console.error('Error generating cards:', error);
    }
}

// Start review session
async function startReview(topicId, topicName) {
    try {
        const response = await fetch(`api/flashcards/review.php${topicId ? '?topic_id=' + topicId : ''}`);
        const result = await response.json();

        if (result.success && result.cards.length > 0) {
            currentCards = result.cards;
            currentCardIndex = 0;
            sessionStats = { correct: 0, incorrect: 0 };

            document.getElementById('deck-selection-view').classList.add('hidden');
            document.getElementById('review-session-view').classList.remove('hidden');

            showCard(0);
        } else {
            alert('No cards due for review in this deck!');
        }
    } catch (error) {
        console.error('Error starting review:', error);
    }
}

// Show current card
function showCard(index) {
    if (index >= currentCards.length) {
        showSessionComplete();
        return;
    }

    const card = currentCards[index];
    const question = card.question;

    // Reset flip state
    isFlipped = false;
    document.getElementById('flashcard-container').classList.remove('flipped');
    document.getElementById('action-buttons').classList.add('hidden');

    // Update question
    document.getElementById('question-text').textContent = question.text;

    // Update options with click handlers
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = Object.entries(question.options).map(([key, value]) => `
        <div class="option-item text-left px-2 py-2 bg-slate-50 hover:bg-white hover:shadow-md hover:border-purple-200 rounded-xl cursor-pointer transition-all border border-slate-100 flex items-center gap-2 group"
             onclick="selectOption(event, '${key}')">
            <span class="w-7 h-7 flex-shrink-0 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500 group-hover:text-purple-600 group-hover:border-purple-200 transition-all">${key}</span>
            <span class="flex-1 text-[10px] md:text-sm font-medium text-slate-600 group-hover:text-slate-800 line-clamp-2 leading-tight">${value}</span>
        </div>
    `).join('');

    // Update answer
    document.getElementById('correct-answer').textContent =
        `${question.correct_answer}. ${question.options[question.correct_answer]}`;
    document.getElementById('explanation-text').textContent = question.explanation || 'No explanation available.';

    // Update progress
    updateProgress();
}

// Select an option and auto-detect correctness
async function selectOption(event, selectedKey) {
    if (event) event.stopPropagation(); // Prevent container's flipCard from firing
    if (isFlipped) return; // Prevent multiple clicks

    const card = currentCards[currentCardIndex];
    const isCorrect = selectedKey === card.question.correct_answer;

    // Visual feedback on options
    const options = document.querySelectorAll('.option-item');
    options.forEach(opt => {
        const key = opt.querySelector('span').textContent;
        if (key === card.question.correct_answer) {
            opt.classList.add('bg-emerald-50', 'border-emerald-200', 'ring-1', 'ring-emerald-200');
            opt.querySelector('span').classList.add('bg-emerald-500', 'text-white', 'border-emerald-500');
            opt.querySelector('.flex-1').classList.add('text-emerald-700', 'font-bold');
        } else if (key === selectedKey && !isCorrect) {
            opt.classList.add('bg-rose-50', 'border-rose-200', 'ring-1', 'ring-rose-200');
            opt.querySelector('span').classList.add('bg-rose-500', 'text-white', 'border-rose-500');
            opt.querySelector('.flex-1').classList.add('text-rose-700', 'font-bold');
        }
        opt.style.pointerEvents = 'none'; // Disable further clicks
    });

    // longer delay for feedback before flipping
    setTimeout(() => {
        if (!isFlipped) flipCard();
        // After showing the answer for a bit, auto-advance or let user read
        // To make it truly "no button", we could auto-advance, but usually users want to read the explanation.
        // We will mark the record in the background immediately.
        submitReview(isCorrect);
    }, 1200);
}

// Background submission without reloading card immediately
async function submitReview(isCorrect) {
    const card = currentCards[currentCardIndex];
    try {
        const response = await fetch('api/flashcards/update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                card_id: card.card_id,
                is_correct: isCorrect
            })
        });
        const result = await response.json();
        if (result.success) {
            if (isCorrect) sessionStats.correct++;
            else sessionStats.incorrect++;
        }
    } catch (error) {
        console.error('Error updating card:', error);
    }
}

// Flip card
function flipCard() {
    const container = document.getElementById('flashcard-container');
    container.classList.toggle('flipped');
    isFlipped = !isFlipped;

    if (isFlipped) {
        document.getElementById('action-buttons').classList.remove('hidden');
    }
}

// Review card (manual trigger for next)
async function reviewCard(isCorrect) {
    // If we already submitted via selectOption, just advance
    currentCardIndex++;
    showCard(currentCardIndex);
}

// Update progress bar
function updateProgress() {
    const total = currentCards.length;
    const current = currentCardIndex + 1;
    const percentage = (currentCardIndex / total) * 100;

    document.getElementById('progress-text').textContent = `${current} / ${total}`;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
}

// Show session complete
function showSessionComplete() {
    document.getElementById('flashcard-container').classList.add('hidden');
    document.getElementById('action-buttons').classList.add('hidden');
    document.getElementById('session-complete').classList.remove('hidden');

    const total = sessionStats.correct + sessionStats.incorrect;
    const accuracy = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;

    document.getElementById('session-summary').textContent =
        `You reviewed ${total} cards with ${accuracy}% accuracy. Great work!`;
}
