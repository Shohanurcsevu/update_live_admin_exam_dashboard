// Flashcards Review System with Leitner Algorithm

let currentCards = [];
let currentCardIndex = 0;
let sessionStats = { correct: 0, incorrect: 0 };
let isFlipped = false;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadDecks();
});

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
        const priorityColor = deck.cards_due > 10 ? 'red' : deck.cards_due > 0 ? 'amber' : 'green';

        return `
            <div class="bg-gradient-to-br from-${priorityColor}-50 to-white border border-${priorityColor}-200 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer"
                 onclick="startReview('${deck.topic}')">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">${deck.subject}</p>
                        <h3 class="text-lg font-bold text-gray-800">${deck.topic}</h3>
                    </div>
                    <span class="material-symbols-outlined text-${priorityColor}-500">style</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600">${deck.total_cards} cards</span>
                    <span class="font-bold text-${priorityColor}-600">${deck.cards_due} due</span>
                </div>
                ${deck.accuracy !== null ? `
                    <div class="mt-2 pt-2 border-t border-${priorityColor}-200">
                        <span class="text-xs text-gray-500">Accuracy: ${deck.accuracy}%</span>
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
            alert(result.message);
            loadDecks(); // Reload decks
        }
    } catch (error) {
        console.error('Error generating cards:', error);
    }
}

// Start review session
async function startReview(topicName) {
    try {
        // For now, fetch all due cards (we'd need topic_id for filtering)
        const response = await fetch('api/flashcards/review.php');
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

    // Update options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = Object.entries(question.options).map(([key, value]) => `
        <div class="text-left px-4 py-2 bg-white/20 rounded-lg">
            <span class="font-bold">${key}.</span> ${value}
        </div>
    `).join('');

    // Update answer
    document.getElementById('correct-answer').textContent =
        `${question.correct_answer}. ${question.options[question.correct_answer]}`;
    document.getElementById('explanation-text').textContent = question.explanation || 'No explanation available.';

    // Update progress
    updateProgress();
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

// Review card (mark as correct/incorrect)
async function reviewCard(isCorrect) {
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
            // Update stats
            if (isCorrect) sessionStats.correct++;
            else sessionStats.incorrect++;

            // Move to next card
            currentCardIndex++;
            showCard(currentCardIndex);
        }
    } catch (error) {
        console.error('Error updating card:', error);
    }
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
