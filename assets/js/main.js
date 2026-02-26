let loadPage;

document.addEventListener('DOMContentLoaded', async () => {
    const mainContent = document.getElementById('main-content');
    const headerContainer = document.getElementById('header-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    // --- Notification Logic ---
    function initializeNotifications() {
        const notificationBtn = document.getElementById('notification-btn');
        const notificationPanel = document.getElementById('notification-panel');
        const notificationList = document.getElementById('notification-list');
        const notificationDot = document.getElementById('notification-dot');

        if (!notificationBtn || !notificationPanel || !notificationList) return;

        let lastSeenId = 0;
        let isPanelOpen = false;

        const initializeLastSeenId = async () => {
            try {
                const response = await fetch('api/recent-activity.php');
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    lastSeenId = result.data[0].id;
                }
            } catch (error) {
                console.error("Failed to initialize last seen notification ID:", error);
            }
        };

        const fetchAndRenderList = async () => {
            try {
                const response = await fetch('api/recent-activity.php');
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    lastSeenId = result.data[0].id;
                    notificationList.innerHTML = '';
                    result.data.forEach(activity => {
                        const iconMap = {
                            'Subject Created': 'subject', 'Exam Taken': 'quiz', 'Lesson Updated': 'library_books',
                            'Topic Created': 'topic', 'Exam Created': 'add_task', 'Questions Imported': 'upload_file',
                            'Model Test Created': 'auto_stories'
                        };
                        const icon = iconMap[activity.activity_type] || 'notifications_active';
                        const item = `
                            <a href="#" class="block px-4 py-3 text-sm text-gray-600 hover:bg-gray-100">
                                <p class="font-semibold text-gray-800 flex items-center"><span class="material-symbols-outlined text-base mr-2">${icon}</span>${activity.activity_type}</p>
                                <p class="pl-6 break-words">${activity.activity_message}</p>
                                <p class="text-xs text-gray-400 mt-1 pl-6">${activity.time_ago}</p>
                            </a>`;
                        notificationList.innerHTML += item;
                    });
                } else {
                    notificationList.innerHTML = '<p class="p-4 text-sm text-gray-500">No recent activity.</p>';
                }
            } catch (error) { console.error("Failed to fetch notification list:", error); }
        };

        const checkForNewNotifications = async () => {
            if (isPanelOpen) return;
            try {
                const response = await fetch(`api/recent-activity.php?check_since=${lastSeenId}`);
                const result = await response.json();
                if (result.success && result.new_count > 0) {
                    if (notificationDot) notificationDot.classList.remove('hidden');
                }
            } catch (error) { console.error("Failed to check for new notifications:", error); }
        };

        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentlyHidden = notificationPanel.classList.contains('hidden');
            if (currentlyHidden) {
                notificationPanel.classList.remove('hidden');
                isPanelOpen = true;
                if (notificationDot) notificationDot.classList.add('hidden');
                fetchAndRenderList();
            } else {
                notificationPanel.classList.add('hidden');
                isPanelOpen = false;
            }
        });

        document.addEventListener('click', (e) => {
            if (notificationPanel && !notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationPanel.classList.add('hidden');
                isPanelOpen = false;
            }
        });

        initializeLastSeenId().then(() => {
            setInterval(checkForNewNotifications, 1800000); // Increased to 30 minutes (1800000ms)
        });
    }

    // --- Page Loading Logic ---
    const loadComponent = async (url, element) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            element.innerHTML = await response.text();
        } catch (error) {
            console.error(error);
            element.innerHTML = `<p class="text-red-500 text-center">Error loading component.</p>`;
            throw error;
        }
    };

    const loadPageScript = async (page) => {
        const existingScript = document.getElementById('page-specific-script');
        if (existingScript) existingScript.remove();

        const pageScripts = {
            'dashboard': 'assets/js/dashboard.js', 'subject': 'assets/js/subject.js', 'lesson': 'assets/js/lesson.js',
            'topic': 'assets/js/topic.js', 'exam': 'assets/js/exam.js', 'import-questions': 'assets/js/import-questions.js',
            'questions-list': 'assets/js/questions-list.js', 'take-exam-list': 'assets/js/take-exam-list.js',
            'take-exam-interface': 'assets/js/take-exam-interface.js', 'check-performance': 'assets/js/check-performance.js',
            'performance-review': 'assets/js/performance-review.js', 'custom-exam-builder': 'assets/js/custom-exam-builder.js',
            'custom-exam-topics': 'assets/js/custom-exam-topics.js', 'custom-exams': 'assets/js/custom-exams.js',
            'custom-exam-from-lessons': 'assets/js/custom-exam-from-lessons.js', 'model-test-builder': 'assets/js/model-test-builder.js',
            'exams-across-subjects': 'assets/js/exams-across-subjects.js', 'timely-model-exam': 'assets/js/timely-model-exam.js',
            'topic-wise-exams': 'assets/js/topic-wise-exams.js',
            'lesson-wise-exams': 'assets/js/lesson-wise-exams.js', 'offline-exams': 'assets/js/offline-exams.js',
            'take-offline-exam': 'assets/js/offline-exam-engine.js', 'mistake-bank': 'assets/js/mistake-bank.js',
            'discipline-tracker': 'assets/js/discipline-tracker.js', 'flashcards': 'assets/js/flashcards.js',
            'analytics': 'assets/js/analytics.js', 'times': 'assets/js/times.js',
            'question-analysis': 'assets/js/question-analysis.js',
            'revision-planner': 'assets/js/revision-planner.js',
            'study-materials': 'assets/js/study-materials.js',
            'question-creator': 'assets/js/question-creator.js',
            'backup-restore': 'assets/js/backup-restore.js',
            'speed-trivia': 'assets/js/speed-trivia.js'
        };


        if (pageScripts[page]) {
            try {
                const response = await fetch(pageScripts[page]);
                if (!response.ok) throw new Error(`Could not load script: ${pageScripts[page]}`);
                const scriptContent = await response.text();

                const script = document.createElement('script');
                script.id = 'page-specific-script';
                script.textContent = scriptContent;
                document.body.appendChild(script);
            } catch (error) {
                console.error(`Failed to execute page script for '${page}':`, error);
            }
        }
    };

    loadPage = async (page, params = '') => {
        mainContent.innerHTML = '<div class="text-center p-10">Loading...</div>';
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        for (let key of Array.from(url.searchParams.keys())) { if (key !== 'page') url.searchParams.delete(key); }
        if (params) {
            const searchParams = new URLSearchParams(params.startsWith('?') ? params.substring(1) : params);
            searchParams.forEach((value, key) => url.searchParams.set(key, value));
        }
        window.history.pushState({ page, params }, '', url);

        if (page === 'mcq-generator') {
            const headerTitleElement = document.querySelector('#header-container h1');
            if (headerTitleElement) headerTitleElement.textContent = "MCQ Generator";
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('bg-gray-700', link.dataset.page === page);
            });
            mainContent.innerHTML = `<iframe src="https://shohanurcsevu.github.io/ai_mcq/" class="w-full h-full border-0"></iframe>`;
            return;
        }

        try {
            await loadComponent(`pages/${page}.html`, mainContent);
            const headerTitleElement = document.querySelector('#header-container h1');
            if (headerTitleElement) {
                headerTitleElement.textContent = page.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
            document.querySelectorAll('.nav-link').forEach(link => {
                const navLinkPage = link.dataset.page;
                const parentPages = { 'take-exam-interface': 'take-exam-list', 'performance-review': 'check-performance', 'questions-list': 'import-questions' };
                const parentPage = parentPages[page];
                link.classList.toggle('bg-gray-700', !!navLinkPage && (navLinkPage === page || navLinkPage === parentPage));
            });
            await loadPageScript(page);
        } catch (e) {
            mainContent.innerHTML = `<p class="text-red-500 p-6 text-center"><b>404 Not Found:</b><br>Could not load page content for <b>'${page}'</b>.</p>`;
        }
    };

    window.loadPage = loadPage;

    // --- Global Toast Notification System ---
    window.showToast = function (message, type = 'info') {
        const toastContainer = document.getElementById('toast-container')
            || (() => {
                const el = document.createElement('div');
                el.id = 'toast-container';
                el.className = 'fixed bottom-5 right-5 z-[500] pointer-events-none space-y-2';
                document.body.appendChild(el);
                return el;
            })();

        const colors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-red-600 text-white',
            warning: 'bg-amber-500 text-white',
            info: 'bg-gray-800 text-white',
        };
        const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };

        const toast = document.createElement('div');
        toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-bold pointer-events-auto max-w-xs transition-all duration-300 opacity-0 translate-y-2 ${colors[type] || colors.info}`;
        toast.innerHTML = `<span class="material-symbols-outlined text-base">${icons[type] || 'info'}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    // Listen for background auto-backup events globally
    window.addEventListener('autoBackupComplete', (e) => {
        const result = e.detail;
        if (result.success && !result.folderRestored) { // Don't show toast for silent folder restoration
            window.showToast(result.usedFallback ? 'Auto-backup downloaded ✓' : 'Auto-backup saved to cloud ✓', 'success');
        } else if (!result.success && result.message) {
            window.showToast('Backup failed: ' + result.message, 'error');
        }
    });

    // --- Global: one-click re-auth if folder permission needs a user gesture ---
    window.addEventListener('autoBackupNeedsFolderAuth', (e) => {
        const { handle, folderName } = e.detail;
        // Show a small sticky toast button anywhere in the app
        const existing = document.getElementById('ab-reauth-toast');
        if (existing) return; // already shown

        const toast = document.createElement('div');
        toast.id = 'ab-reauth-toast';
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;' +
            'background:#4f46e5;color:#fff;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:600;' +
            'display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.25);cursor:pointer;';
        toast.innerHTML = '<span style="font-size:18px">📁</span> Tap to re-authorize backup folder: <b>' + folderName + '</b>';
        toast.addEventListener('click', async () => {
            try {
                const perm = await handle.requestPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    window.autoBackupManager._restoreHandleFromEvent(handle);
                    toast.innerHTML = '✅ Backup folder re-authorized!';
                    setTimeout(() => toast.remove(), 2000);
                }
            } catch (_) { toast.remove(); }
        });
        document.body.appendChild(toast);
    });

    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        });
    }

    // --- Load Auto-Backup Manager (await so it's guaranteed ready) ---
    const loadGlobalScript = (src) => new Promise((resolve) => {
        if (document.querySelector(`script[data-global-src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.dataset.globalSrc = src;
        s.onload = resolve;
        s.onerror = resolve; // fail silently
        document.head.appendChild(s);
    });

    await loadGlobalScript('assets/js/auto-backup-manager.js');

    // Initialize Auto-Backup Manager (script is guaranteed loaded now)
    if (typeof window.autoBackupManager !== 'undefined') {
        window.autoBackupManager.initAutoBackup();
    }

    await Promise.all([
        loadComponent('components/header.html', headerContainer),
        loadComponent('components/sidebar.html', sidebarContainer)
    ]);
    if (typeof initSidebarToggle === 'function') initSidebarToggle();

    // Start notification polling
    initializeNotifications();

    // Initialize Streak Manager
    if (typeof streakManager !== 'undefined') {
        streakManager.init();
    }

    // Initialize Auto-Sync
    if (typeof syncManager !== 'undefined') {
        syncManager.initAutoSync();
    }

    const initialParams = new URLSearchParams(window.location.search);
    const initialPage = initialParams.get('page') || 'dashboard';
    initialParams.delete('page');
    await loadPage(initialPage, '?' + initialParams.toString());

    sidebarContainer.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            loadPage(navLink.dataset.page);
        }
    });

    window.onpopstate = (event) => {
        if (event.state) {
            loadPage(event.state.page, event.state.params);
        } else {
            const fallbackParams = new URLSearchParams(window.location.search);
            const fallbackPage = fallbackParams.get('page') || 'dashboard';
            fallbackParams.delete('page');
            loadPage(fallbackPage, '?' + fallbackParams.toString());
        }
    };
});
