/**
 * RE-THINK: Daily Study Pact Controller
 * Manages daily commitments, progress tracking, and report cards.
 */

class StudyPactManager {
    constructor() {
        this.pactData = null;
        this.yesterdayPact = null;
        this.allSubjects = [];
        this.selectedCommitments = []; // Array of {type, id, name}
        this.currentStep = 'report'; // 'report' or 'select'
    }

    async init() {
        try {
            const response = await fetch('api/pact/get-status.php');
            const data = await response.json();
            console.log('StudyPact Status:', data);
            
            if (data.success) {
                this.pactData = data.today;
                this.yesterdayPact = data.yesterday;
                
                // Render HUD if pact exists
                if (data.hasPact) {
                    this.renderHUD();
                }

                // Trigger Flow logic
                if (this.yesterdayPact && this.yesterdayPact.status !== 'skipped' && !this.yesterdayPact.is_acknowledged) {
                    this.showReportCard();
                } else if (!data.hasPact && !data.isShown) {
                    this.showPactCreation();
                }
            }
        } catch (error) {
            console.error('Failed to initialize Study Pact:', error);
        }
    }

    // --- UI Triggers ---

    showReportCard() {
        this.currentStep = 'report';
        this.renderModal();
    }

    async showPactCreation() {
        this.currentStep = 'select';
        await this.fetchSubjects();
        this.renderModal();
    }

    // --- HUD & Celebrations ---

    renderHUD() {
        console.log('Attempting to render StudyPact HUD. Has Data:', !!this.pactData);
        if (!this.pactData) return;

        const container = document.getElementById('header-pact-container');
        console.log('Header Pact Container found:', !!container);
        
        if (!container) {
            // If header isn't ready, use both MutationObserver and a timed retry as fallback
            if (!this._observer) {
                this._observer = new MutationObserver((mutations, obs) => {
                    const target = document.getElementById('header-pact-container');
                    if (target) {
                        this.renderHUD();
                        obs.disconnect();
                        this._observer = null;
                    }
                });
                this._observer.observe(document.body, { childList: true, subtree: true });
                
                // Fallback: Check every second for 5 seconds
                let retries = 0;
                const interval = setInterval(() => {
                    if (document.getElementById('header-pact-container')) {
                        this.renderHUD();
                        clearInterval(interval);
                    } else if (++retries > 10) {
                        clearInterval(interval);
                    }
                }, 500);
            }
            return;
        }

        // Cleanup legacy HUD
        const oldHud = document.getElementById('study-pact-hud');
        if (oldHud) oldHud.remove();

        const actualHours = (this.pactData.actual_seconds / 3600).toFixed(1);
        const progress = Math.min(100, Math.round((actualHours / this.pactData.target_hours) * 100));
        
        container.innerHTML = `
            <div class="flex items-center gap-2 px-2 py-1 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl transition-all cursor-pointer group border border-indigo-100" onclick="pactManager.showStatus()">
                <div class="relative w-8 h-8 flex-shrink-0">
                    <svg class="w-full h-full transform -rotate-90">
                        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="3" fill="transparent" class="text-slate-200" />
                        <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="3" fill="transparent" stroke-dasharray="88" stroke-dashoffset="${88 * (1 - progress/100)}" class="text-indigo-500 transition-all duration-700" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="material-symbols-outlined text-indigo-500 text-[14px] ${progress < 100 ? 'animate-pulse' : ''}">bolt</span>
                    </div>
                </div>
                <div class="hidden lg:block">
                    <div class="text-[9px] font-black text-indigo-500 p-0 m-0 leading-none uppercase tracking-tighter">Pact Status</div>
                    <div class="text-[11px] font-black text-slate-700 p-0 m-0 leading-tight">${progress}% Done</div>
                </div>
            </div>
            <!-- Vertical Divider to match header theme -->
            <div class="text-slate-200 hidden sm:block mx-1">•</div>
        `;

        if (progress >= 100 && this.pactData.status !== 'kept') {
            this.celebrate();
        }
    }

    showStatus() {
        if (!this.pactData) return;
        
        // Let's show a special "In-Progress" view of the modal or just the regular one
        this.currentStep = 'select'; // Or a new 'status' step if we had one
        this.renderModal();
        
        const actualHours = (this.pactData.actual_seconds / 3600).toFixed(1);
        showToast(`Current Focus: ${actualHours}h / ${this.pactData.target_hours}h`, 'info');
    }

    celebrate() {
        if (window.confetti) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#4f46e5', '#10b981', '#f59e0b']
            });
        }
    }

    // --- Data Fetching ---

    async fetchSubjects() {
        const resp = await fetch('api/take-exam/subjects.php');
        const data = await resp.json();
        this.allSubjects = data.data || [];
    }

    async fetchLessons(subjectId) {
        const resp = await fetch(`api/take-exam/lessons.php?subject_id=${subjectId}`);
        const data = await resp.json();
        return data.data || [];
    }

    async fetchTopics(lessonId) {
        const resp = await fetch(`api/take-exam/topics.php?lesson_id=${lessonId}`);
        const data = await resp.json();
        return data.data || [];
    }

    // --- Core Logic ---

    toggleCommitment(type, id, name) {
        const index = this.selectedCommitments.findIndex(c => c.type === type && c.id === id);
        if (index > -1) {
            this.selectedCommitments.splice(index, 1);
        } else {
            this.selectedCommitments.push({ type, id, name });
        }
        this.updateSelectionUI();
    }

    async savePact() {
        const targetHours = document.getElementById('pact-hours-range')?.value || 2;
        const miniGoal = document.getElementById('pact-mini-goal')?.value || '';

        try {
            const response = await fetch('api/pact/save.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commitments: this.selectedCommitments,
                    target_hours: targetHours,
                    mini_goal: miniGoal
                })
            });
            const result = await response.json();
            if (result.success) {
                // Update local pact data for HUD
                this.pactData = {
                    target_hours: targetHours,
                    actual_seconds: 0,
                    mini_goal: miniGoal,
                    status: 'active'
                };
                
                this.renderHUD();
                this.closeModal();
                if (window.showToast) showToast('Pact committed! 🔥 Good luck today.', 'success');
            }
        } catch (error) {
            console.error('Save failed:', error);
        }
    }

    async skipPact() {
        await fetch('api/pact/mark-shown.php');
        this.closeModal();
    }

    // --- Rendering ---

    renderModal() {
        let modal = document.getElementById('study-pact-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'study-pact-modal';
            modal.className = 'fixed inset-0 z-[1000] pact-modal-overlay flex items-center justify-center p-4';
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');

        modal.innerHTML = `
            <div class="pact-card w-full max-w-2xl overflow-hidden animate-pact-entry">
                ${this.currentStep === 'report' ? this.getReportHTML() : this.getSelectionHTML()}
            </div>
        `;

        this.attachEventListeners();
    }

    getReportHTML() {
        const p = this.yesterdayPact;
        const actualHours = (p.actual_seconds / 3600).toFixed(1);
        const progress = Math.min(100, Math.round((actualHours / p.target_hours) * 100));
        const topicsCount = JSON.parse(p.completed_topic_ids || '[]').length;
        const committedTopics = p.commitments ? JSON.parse(p.commitments).filter(c => c.type === 'topic').length : 0;

        return `
            <div class="p-8 text-center">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-3xl text-indigo-600 mb-6">
                    <span class="material-symbols-outlined text-4xl">analytics</span>
                </div>
                <h2 class="text-3xl font-black text-slate-800 mb-2">Yesterday's Roundup</h2>
                <p class="text-slate-500 mb-8 font-medium">How did you perform against your goals?</p>

                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="glass-section p-6">
                        <div class="text-3xl font-black text-indigo-600 mb-1">${actualHours}h</div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest">Studied / ${p.target_hours}h</div>
                    </div>
                    <div class="glass-section p-6">
                        <div class="text-3xl font-black text-emerald-600 mb-1">${topicsCount}</div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest">Topics Mastered</div>
                    </div>
                </div>

                <div class="flex flex-col gap-3">
                    <button id="pact-next-btn" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95">
                        Set Today's Pact
                    </button>
                    <button onclick="pactManager.skipPact()" class="text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors py-2">
                        Dismiss for now
                    </button>
                </div>
            </div>
        `;
    }

    async handleSubjectClick(id, name) {
        if (this.isCommitted('subject', id)) {
            // Remove subject and its children
            this.selectedCommitments = this.selectedCommitments.filter(c => c.type !== 'subject' || c.id !== id);
            this.currentLessons = [];
            this.currentTopics = [];
        } else {
            this.selectedCommitments.push({ type: 'subject', id, name });
            // Fetch lessons for this subject
            this.currentLessons = await this.fetchLessons(id);
            this.currentTopics = [];
        }
        this.renderModal();
    }

    async handleLessonClick(id, name) {
        if (this.isCommitted('lesson', id)) {
            this.selectedCommitments = this.selectedCommitments.filter(c => c.type !== 'lesson' || c.id !== id);
            this.currentTopics = [];
        } else {
            this.selectedCommitments.push({ type: 'lesson', id, name });
            this.currentTopics = await this.fetchTopics(id);
        }
        this.renderModal();
    }

    handleTopicClick(id, name) {
        this.toggleCommitment('topic', id, name);
        this.renderModal();
    }

    isCommitted(type, id) {
        return this.selectedCommitments.some(c => c.type === type && c.id === id);
    }

    getSelectionHTML() {
        return `
            <div class="flex flex-col h-[85vh] max-h-[800px]">
                <!-- Header -->
                <div class="p-8 pb-4">
                    <h2 class="text-3xl font-black text-slate-800 mb-2">Daily Study Pact</h2>
                    <p class="text-slate-500 font-medium">Commit to your focus goals for today.</p>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto p-8 pt-0 space-y-8">
                    
                    <!-- Hierarchical Selection -->
                    <div class="space-y-6">
                        <!-- Subjects -->
                        <section>
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">1. Select Subjects</h3>
                            <div class="flex flex-wrap gap-2">
                                ${this.allSubjects.map(s => `
                                    <div class="subject-chip ${this.isCommitted('subject', s.id) ? 'active' : ''}" 
                                         onclick="pactManager.handleSubjectClick(${s.id}, '${s.subject_name.replace(/'/g, "\\'")}')">
                                        ${s.subject_name}
                                    </div>
                                `).join('')}
                            </div>
                        </section>

                        <!-- Lessons (Contextual) -->
                        ${this.currentLessons && this.currentLessons.length > 0 ? `
                        <section class="animate-pact-entry">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">2. Pick Specific Lessons</h3>
                            <div class="flex flex-wrap gap-2">
                                ${this.currentLessons.map(l => `
                                    <div class="subject-chip bg-indigo-50 text-indigo-700 ${this.isCommitted('lesson', l.id) ? 'active !bg-indigo-600 !text-white' : ''}" 
                                         onclick="pactManager.handleLessonClick(${l.id}, '${l.lesson_name.replace(/'/g, "\\'")}')">
                                        ${l.lesson_name}
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                        ` : ''}

                        <!-- Topics (Contextual) -->
                        ${this.currentTopics && this.currentTopics.length > 0 ? `
                        <section class="animate-pact-entry">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">3. Target Topics</h3>
                            <div class="flex flex-wrap gap-2">
                                ${this.currentTopics.map(t => `
                                    <div class="subject-chip bg-emerald-50 text-emerald-700 ${this.isCommitted('topic', t.id) ? 'active !bg-emerald-600 !text-white' : ''}" 
                                         onclick="pactManager.handleTopicClick(${t.id}, '${t.topic_name.replace(/'/g, "\\'")}')">
                                        ${t.topic_name}
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                        ` : ''}
                    </div>

                    <div class="h-px bg-slate-100 my-8"></div>

                    <!-- Target Hours -->
                    <section>
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">4. Daily Time Target</h3>
                            <span class="text-lg font-black text-indigo-600" id="hours-display">2 Hours</span>
                        </div>
                        <input type="range" id="pact-hours-range" min="0.5" max="12" step="0.5" value="2" 
                               class="pact-range" oninput="document.getElementById('hours-display').innerText = this.value + ' Hours'">
                    </section>

                    <!-- Mini Goal -->
                    <section>
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">5. Personal Mantra / Mission</h3>
                        <input type="text" id="pact-mini-goal" placeholder="e.g. Conquer Physics Chapter 5 mechanics..." 
                               class="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all">
                    </section>
                </div>

                <!-- Footer -->
                <div class="p-8 bg-white border-t border-slate-100 flex gap-4">
                    <button onclick="pactManager.skipPact()" class="flex-1 bg-slate-100 text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all">
                        Skip Today
                    </button>
                    <button onclick="pactManager.savePact()" class="flex-[2] bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined">verified</span>
                        🔥 Sign the Pact
                    </button>
                </div>
            </div>
        `;
    }

    updateSelectionUI() {
        // Handled by full re-render for consistency
    }

    attachEventListeners() {
        const nextBtn = document.getElementById('pact-next-btn');
        if (nextBtn) {
            nextBtn.onclick = () => this.showPactCreation();
        }
    }

    closeModal() {
        const modal = document.getElementById('study-pact-modal');
        if (modal) modal.classList.add('hidden');
    }
}

// Initialize Global Instance
const pactManager = new StudyPactManager();
window.pactManager = pactManager;
