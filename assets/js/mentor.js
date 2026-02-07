// FILE: assets/js/mentor.js
// AI Study Mentor - Contextual Study Guide

class StudyMentor {
    constructor() {
        this.isOpen = false;
        this.mentorData = null;
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.fetchMentorData();
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.id = 'study-mentor-widget';
        widget.className = 'fixed bottom-6 right-6 z-50';
        widget.innerHTML = `
            <!-- Floating Action Button -->
            <button id="mentor-fab" 
                class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full w-14 h-14 shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-110 flex items-center justify-center group">
                <span class="material-symbols-outlined text-2xl">psychology</span>
            </button>

            <!-- Mentor Panel -->
            <div id="mentor-panel" 
                class="hidden absolute bottom-20 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
                
                <!-- Header -->
                <div class="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined">psychology</span>
                            <h3 class="font-bold">AI Study Mentor</h3>
                        </div>
                        <button id="mentor-close" class="hover:bg-white/20 rounded-full p-1 transition-colors">
                            <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                    <p class="text-xs text-purple-100 mt-1">Your personalized study guide</p>
                </div>

                <!-- Content -->
                <div class="p-4 max-h-96 overflow-y-auto">
                    <div id="mentor-greeting" class="mb-4">
                        <div class="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                            <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
                            <div>
                                <p class="text-sm font-semibold text-gray-800">Hey there!</p>
                                <p class="text-xs text-gray-600 mt-1">Let me analyze your performance...</p>
                            </div>
                        </div>
                    </div>

                    <div id="mentor-recommendations" class="space-y-3">
                        <!-- Recommendations will be injected here -->
                    </div>

                    <!-- Quick Actions -->
                    <div class="mt-4 pt-4 border-t border-gray-100">
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</p>
                        <div class="space-y-2">
                            <button onclick="window.loadPage('mistake-bank')" 
                                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                                <span class="material-symbols-outlined text-rose-500 text-lg">psychology</span>
                                <span>Review Mistake Bank</span>
                            </button>
                            <button onclick="window.loadPage('discipline-tracker')" 
                                class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                                <span class="material-symbols-outlined text-blue-500 text-lg">analytics</span>
                                <span>View Full Analytics</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    attachEventListeners() {
        const fab = document.getElementById('mentor-fab');
        const closeBtn = document.getElementById('mentor-close');
        const panel = document.getElementById('mentor-panel');

        fab?.addEventListener('click', () => this.togglePanel());
        closeBtn?.addEventListener('click', () => this.closePanel());

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            const widget = document.getElementById('study-mentor-widget');
            if (this.isOpen && widget && !widget.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    togglePanel() {
        const panel = document.getElementById('mentor-panel');
        if (this.isOpen) {
            this.closePanel();
        } else {
            panel?.classList.remove('hidden');
            this.isOpen = true;
            if (!this.mentorData) this.fetchMentorData();
        }
    }

    closePanel() {
        const panel = document.getElementById('mentor-panel');
        panel?.classList.add('hidden');
        this.isOpen = false;
    }

    async fetchMentorData() {
        try {
            const response = await fetch('api/performance/mastery-trends.php');
            const result = await response.json();

            if (result.success && result.data) {
                this.mentorData = result.data;
                this.renderRecommendations();
            }
        } catch (error) {
            console.error('Mentor data fetch error:', error);
        }
    }

    renderRecommendations() {
        const container = document.getElementById('mentor-recommendations');
        const greeting = document.getElementById('mentor-greeting');

        if (!this.mentorData || !container) return;

        const { mentor_advice, insights, subjects } = this.mentorData;

        // Update greeting based on overall performance
        const avgAccuracy = subjects.reduce((sum, s) => sum + (s.this_week || 0), 0) / subjects.length;
        let greetingMsg = '';

        if (avgAccuracy >= 80) {
            greetingMsg = "You're doing amazing! 🎉 Keep up the excellent work.";
        } else if (avgAccuracy >= 60) {
            greetingMsg = "Good progress! Let's focus on a few areas to boost your scores.";
        } else {
            greetingMsg = "Let's work together to improve your performance!";
        }

        greeting.innerHTML = `
            <div class="flex items-start gap-3 bg-purple-50 p-3 rounded-xl">
                <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
                <div>
                    <p class="text-sm font-semibold text-gray-800">Hey there!</p>
                    <p class="text-xs text-gray-600 mt-1">${greetingMsg}</p>
                </div>
            </div>
        `;

        // Render specific recommendations
        if (mentor_advice && mentor_advice.length > 0) {
            container.innerHTML = mentor_advice.map(advice => {
                const priorityColor = advice.priority === 'high' ? 'red' : 'amber';
                const priorityIcon = advice.priority === 'high' ? 'priority_high' : 'flag';

                return `
                    <div class="bg-${priorityColor}-50 border border-${priorityColor}-200 p-3 rounded-xl">
                        <div class="flex items-start gap-2">
                            <span class="material-symbols-outlined text-${priorityColor}-600 text-lg">${priorityIcon}</span>
                            <div class="flex-1">
                                <p class="text-xs font-bold text-${priorityColor}-900 uppercase tracking-wider">${advice.subject}</p>
                                <p class="text-sm text-gray-700 mt-1">
                                    Focus on <strong>${advice.weak_topic}</strong> 
                                    <span class="text-xs text-gray-500">(${advice.topic_accuracy}% accuracy)</span>
                                </p>
                                <p class="text-xs text-gray-600 mt-2">
                                    💡 I recommend doing 15-20 questions from this topic today.
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else if (insights && insights.length > 0) {
            // Fallback to general insights if no specific topic advice
            container.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                    <p class="text-sm text-gray-700">${insights[0].message}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="text-center py-6 text-gray-400">
                    <span class="material-symbols-outlined text-3xl mb-2 opacity-20">verified</span>
                    <p class="text-sm">You're performing well across all subjects!</p>
                </div>
            `;
        }
    }
}

// Initialize mentor when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new StudyMentor());
} else {
    new StudyMentor();
}
