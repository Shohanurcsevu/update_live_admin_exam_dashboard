/**
 * Smart Universal Search (Command Palette)
 * Handles quick navigation and deep question searching.
 */

class CommandPalette {
    constructor() {
        this.isOpen = false;
        this.data = {
            pages: [],
            subjects: [],
            exams: [],
            lessons: [],
            topics: []
        };
        this.selectedIndex = -1;
        this.searchTimeout = null;

        this.init();
    }

    init() {
        this.indexStaticPages();
        this.fetchDynamicData();
        this.initEventListeners();
    }

    indexStaticPages() {
        this.data.pages = [
            // Core
            { id: 'dashboard', title: 'Dashboard', subtext: 'System Overview & Stats', type: 'page', icon: 'dashboard' },

            // Curriculum
            { id: 'subject', title: 'Subject', subtext: 'Manage Subjects & Books', type: 'page', icon: 'subject' },
            { id: 'lesson', title: 'Lesson', subtext: 'Manage Lessons & Pages', type: 'page', icon: 'menu_book' },
            { id: 'topic', title: 'Topics', subtext: 'Manage Exam Topics', type: 'page', icon: 'topic' },

            // Exam Management
            { id: 'exam', title: 'Create Exam', subtext: 'Build New Assessment Exam', type: 'page', icon: 'add_task' },
            { id: 'exams-across-subjects', title: 'Exams Across Subject', subtext: 'Multi-Subject Exams', type: 'page', icon: 'quiz' },
            { id: 'topic-wise-exams', title: 'Topic Wise Exams', subtext: 'Filter by Topics', type: 'page', icon: 'quiz' },
            { id: 'lesson-wise-exams', title: 'Lesson Wise Exams', subtext: 'Filter by Lessons', type: 'page', icon: 'quiz' },
            { id: 'timely-model-exam', title: 'Timely Model Exam', subtext: 'Scheduled Assessments', type: 'page', icon: 'timer' },

            // Student/Learning
            { id: 'take-exam-list', title: 'Take Exam', subtext: 'Active Exams & Model Tests List', type: 'page', icon: 'edit_document' },
            { id: 'check-performance', title: 'Performance Review', subtext: 'Scores & Progress Analysis', type: 'page', icon: 'fact_check' },
            { id: 'study-materials', title: 'Study Materials', subtext: 'Books & Resources', type: 'page', icon: 'book' },
            { id: 'question-analysis', title: 'Question Analysis', subtext: 'Difficulty & Patterns', type: 'page', icon: 'monitoring' },
            { id: 'revision-planner', title: 'Revision Planner', subtext: 'Schedule Study Sessions', type: 'page', icon: 'event_note' },
            { id: 'flashcards', title: 'Flashcards', subtext: 'Active Recall Training', type: 'page', icon: 'psychology' },
            { id: 'speed-trivia', title: 'Speed Trivia', subtext: 'Timed Fun Quiz', type: 'page', icon: 'timer' },
            { id: 'offline-exams', title: 'Offline Exams', subtext: 'Exam Simulation Mode', type: 'page', icon: 'offline_pin' },

            // Custom Exam
            { id: 'custom-exams', title: 'Custom Exams', subtext: 'Manage Your Created Exams', type: 'page', icon: 'construction' },
            { id: 'custom-exam-builder', title: 'Exam Builder', subtext: 'Filter from existing exams', type: 'page', icon: 'construction' },
            { id: 'custom-exam-topics', title: 'Topic Builder', subtext: 'Filter from topics', type: 'page', icon: 'construction' },
            { id: 'custom-exam-from-lessons', title: 'Lesson Builder', subtext: 'Filter from lessons', type: 'page', icon: 'construction' },
            { id: 'model-test-builder', title: 'Model Test Builder', subtext: 'Premium exam creation', type: 'page', icon: 'auto_stories' },

            // Analytics
            { id: 'analytics', title: 'Study Analytics', subtext: 'Deep Performance Insights', type: 'page', icon: 'analytics' },
            { id: 'discipline-tracker', title: 'Discipline Tracker', subtext: 'Daily Consistency Log', type: 'page', icon: 'event_available' },

            // Others
            { id: 'import-questions', title: 'Import Questions', subtext: 'Upload Excel/JSON Exam Data', type: 'page', icon: 'upload_file' },
            { id: 'question-creator', title: 'Question Creator', subtext: 'Manual Question Entry', type: 'page', icon: 'edit' },
            { id: 'backup-restore', title: 'Backup & Restore', subtext: 'Data Safety Management', type: 'page', icon: 'settings_backup_restore' },
            { id: 'mcq-generator', title: 'AI MCQ Generator', subtext: 'Smart PDF Creator', type: 'page', icon: 'psychology' }
        ];
    }

    async fetchDynamicData() {
        try {
            // Fetch Subjects (En & Bn)
            const subjectRes = await fetch('api/subject/subject.php');
            const subjects = await subjectRes.json();
            if (subjects.success && subjects.data) {
                this.data.subjects = subjects.data.map(s => ({
                    id: s.id,
                    title: s.subject_name,
                    subtext: "Subject",
                    type: 'subject',
                    icon: 'library_books'
                }));
            }

            // Fetch Recent Exams
            const examRes = await fetch('api/take-exam/exams.php');
            const exams = await examRes.json();
            if (exams.success && exams.data) {
                this.data.exams = exams.data.slice(0, 30).map(e => ({
                    id: e.id,
                    title: e.exam_title,
                    subtext: `Exam (${e.subject_name})`,
                    type: 'exam',
                    icon: 'assignment'
                }));
            }

            // Fetch Lessons (High limit for indexing)
            const lessonRes = await fetch('api/lesson/lesson.php?action=list&limit=500');
            const lessons = await lessonRes.json();
            if (lessons.success && lessons.data) {
                this.data.lessons = lessons.data.map(l => ({
                    id: l.id,
                    title: l.lesson_name,
                    subtext: `Lesson (${l.subject_name})`,
                    type: 'lesson',
                    subject_id: l.subject_id,
                    icon: 'menu_book'
                }));
            }

            // Fetch Topics (High limit for indexing)
            const topicRes = await fetch('api/topic/topic.php?action=list&limit=500');
            const topics = await topicRes.json();
            if (topics.success && topics.data) {
                this.data.topics = topics.data.map(t => ({
                    id: t.id,
                    title: t.topic_name,
                    subtext: `Topic (${t.lesson_name})`,
                    type: 'topic',
                    subject_id: t.subject_id,
                    lesson_id: t.lesson_id,
                    icon: 'topic'
                }));
            }
        } catch (error) {
            console.error("Failed to fetch dynamic search data:", error);
        }
    }

    initEventListeners() {
        const modal = document.getElementById('command-palette');
        const input = document.getElementById('command-search-input');
        const searchBtn = document.getElementById('header-search-btn');

        if (!modal || !input) return;

        // Toggle via Button (Event Delegation)
        document.addEventListener('click', (e) => {
            const searchBtn = e.target.closest('#header-search-btn');
            if (searchBtn) {
                this.toggle(true);
            }
        });

        // Toggle via Keyboard
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === '/') {
                // Only if not in an input already
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.toggle(true);
                }
            }
            if (this.isOpen) {
                if (e.key === 'Escape') this.toggle(false);
                if (e.key === 'ArrowDown') this.navigate(1);
                if (e.key === 'ArrowUp') this.navigate(-1);
                if (e.key === 'Enter') this.selectActiveMatch();
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.toggle(false);
        });

        // Input search
        input.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            const query = input.value.trim();
            if (query.length === 0) {
                this.renderInitialState();
                return;
            }
            this.search(query);
        });
    }

    toggle(forceState = null) {
        const modal = document.getElementById('command-palette');
        const content = document.getElementById('command-palette-content');
        const input = document.getElementById('command-search-input');

        this.isOpen = forceState !== null ? forceState : !this.isOpen;

        if (this.isOpen) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                content.classList.remove('scale-95');
                input.focus();
            }, 10);
            this.renderInitialState();
        } else {
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                input.value = '';
            }, 200);
        }
    }

    navigate(direction) {
        const items = document.querySelectorAll('.command-result-item');
        if (items.length === 0) return;

        this.selectedIndex += direction;
        if (this.selectedIndex >= items.length) this.selectedIndex = 0;
        if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;

        items.forEach((item, idx) => {
            item.classList.toggle('bg-slate-50', idx === this.selectedIndex);
            item.classList.toggle('border-indigo-500/20', idx === this.selectedIndex);
            if (idx === this.selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    search(query) {
        const normalizedQuery = query.toLowerCase();

        const localMatches = [
            ...this.data.pages.filter(p => (p.title + (p.subtext || '')).toLowerCase().includes(normalizedQuery)),
            ...this.data.subjects.filter(s => (s.title + (s.subtext || '')).toLowerCase().includes(normalizedQuery)),
            ...this.data.exams.filter(e => (e.title + (e.subtext || '')).toLowerCase().includes(normalizedQuery)),
            ...(this.data.lessons || []).filter(l => (l.title + (l.subtext || '')).toLowerCase().includes(normalizedQuery)),
            ...(this.data.topics || []).filter(t => (t.title + (t.subtext || '')).toLowerCase().includes(normalizedQuery))
        ].slice(0, 50); // Get more raw matches to allow ranking to surface better ones

        const rankedMatches = this.rankResults(localMatches).slice(0, 15);
        this.renderResults(rankedMatches);

        // API Deep Search for Questions (Debounced)
        if (query.length >= 2) {
            this.searchTimeout = setTimeout(async () => {
                console.log(`[CommandPalette] Deep searching for: "${query}"`);
                try {
                    const res = await fetch(`api/question/search.php?q=${encodeURIComponent(query)}`);
                    const result = await res.json();

                    if (result.success && result.data.length > 0) {
                        this.appendResults(result.data, 'Question Matches');
                    } else {
                        // Clear searching placeholder if no deep results found
                        const placeholder = document.getElementById('no-instant-matches');
                        if (placeholder) {
                            placeholder.innerHTML = `<p class="text-sm text-slate-400 italic">No additional matches found for "${query}".</p>`;
                        }
                    }
                } catch (error) {
                    console.error("Deep search failed:", error);
                    const placeholder = document.getElementById('no-instant-matches');
                    if (placeholder) placeholder.innerHTML = `<p class="text-sm text-rose-400 italic">Search failed. Please try again.</p>`;
                }
            }, 800); // Robust debounce
        }
    }

    renderInitialState() {
        const results = document.getElementById('command-results');
        results.innerHTML = `
            <div class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent & Popular</div>
            <div id="initial-matches" class="space-y-1"></div>
        `;
        const initialMatches = this.rankResults([
            ...this.data.pages,
            ...this.data.subjects
        ]).slice(0, 6);
        this.appendResults(initialMatches, '', 'initial-matches');
    }

    renderResults(matches) {
        const results = document.getElementById('command-results');
        this.selectedIndex = -1;

        results.innerHTML = `
            <div class="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Results</div>
            <div id="search-matches" class="space-y-1"></div>
        `;

        if (matches.length > 0) {
            this.appendResults(matches, '', 'search-matches');
        } else {
            const container = document.getElementById('search-matches');
            container.innerHTML = `
                <div id="no-instant-matches" class="p-8 text-center">
                    <p class="text-sm text-slate-400 italic">No instant matches. Searching deeper...</p>
                </div>
            `;
        }
    }

    appendResults(matches, categoryTitle, containerId = 'search-matches') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Remove "Searching deeper..." placeholder if it exists
        const placeholder = document.getElementById('no-instant-matches');
        if (placeholder && matches.length > 0) placeholder.remove();

        if (categoryTitle) {
            const cat = document.createElement('div');
            cat.className = "px-3 py-2 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-3";
            cat.textContent = categoryTitle;
            container.appendChild(cat);
        }

        matches.forEach(match => {
            const item = document.createElement('div');
            item.className = "command-result-item group flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all border border-transparent";
            item.innerHTML = `
                <div class="w-9 h-9 flex-shrink-0 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                    <span class="material-symbols-outlined text-xl">${match.icon || 'quiz'}</span>
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-bold text-slate-700 truncate">${match.title || match.text || 'Untitled'}</p>
                    <p class="text-[11px] font-medium text-slate-400 truncate">${match.subtext || ''}</p>
                </div>
                <div class="text-[9px] font-bold text-slate-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    Jump
                </div>
            `;
            item.addEventListener('click', () => this.handleSelection(match));
            container.appendChild(item);
        });
    }

    selectActiveMatch() {
        const items = document.querySelectorAll('.command-result-item');
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
            items[this.selectedIndex].click();
        }
    }

    handleSelection(match) {
        this.trackSelection(match);
        this.toggle(false);
        if (match.type === 'page') {
            window.loadPage(match.id);
        } else if (match.type === 'subject') {
            window.loadPage('take-exam-list', `subject_id=${match.id}`);
        } else if (match.type === 'lesson') {
            window.loadPage('take-exam-list', `lesson_id=${match.id}&subject_id=${match.subject_id}`);
        } else if (match.type === 'topic') {
            window.loadPage('take-exam-list', `topic_id=${match.id}&lesson_id=${match.lesson_id}`);
        } else if (match.type === 'exam') {
            window.loadPage('take-exam-interface', `exam_id=${match.id}`);
        } else if (match.type === 'question') {
            window.loadPage('questions-list', `exam_id=${match.exam_id}&highlight_id=${match.id}`);
        }
    }

    trackSelection(match) {
        if (!match.id || !match.type) return;
        const key = `cmd_freq_${match.type}_${match.id}`;
        const counts = JSON.parse(localStorage.getItem('cmd_palette_frequency') || '{}');
        counts[key] = (counts[key] || 0) + 1;
        localStorage.setItem('cmd_palette_frequency', JSON.stringify(counts));
    }

    rankResults(results) {
        const counts = JSON.parse(localStorage.getItem('cmd_palette_frequency') || '{}');
        return [...results].sort((a, b) => {
            const countA = counts[`cmd_freq_${a.type}_${a.id}`] || 0;
            const countB = counts[`cmd_freq_${b.type}_${b.id}`] || 0;
            return countB - countA;
        });
    }
}

// Initialize when library is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cmdPalette = new CommandPalette();
});
