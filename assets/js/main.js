let loadPage;
window.needsBackup = false; // Global flag


document.addEventListener('DOMContentLoaded', async () => {
    // --- Pre-Exit Backup Confirmation Logic ---
    window.needsBackup = localStorage.getItem('needsBackup') === 'true';

    // Visibility indicator for unsaved changes (amber dot in header)
    window.updateUnsavedIndicator = function () {
        if (typeof SmartHeader !== 'undefined' && typeof SmartHeader.updateBackupStatus === 'function') {
            SmartHeader.updateBackupStatus();
            return;
        }

        // Fallback for basic functionality if SmartHeader isn't ready
        const dot = document.getElementById('unsaved-indicator');
        if (!dot) return;
        if (window.needsBackup) {
            dot.classList.remove('hidden');
        } else {
            dot.classList.add('hidden');
        }
    };

    // Global fetch hook to track data modifications
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const options = args[1] || (args[0] instanceof Request ? args[0] : {});
        const method = options.method ? options.method.toUpperCase() : 'GET';

        // If it's a POST request to our API (excluding status/ping/backup itself)
        if (method === 'POST' && url.includes('api/') &&
            !url.includes('api/backup/') && !url.includes('api/pomodoro/status.php')) {
            console.log(`[BackupProtection] Data modification detected: ${url}. Flagging needsBackup.`);
            window.needsBackup = true;
            window._lastDataChangeTime = Date.now();
            localStorage.setItem('needsBackup', 'true');
            window.updateUnsavedIndicator();

            // Trigger immediate notification check if possible
            if (typeof window.refreshNotifications === 'function') {
                setTimeout(() => window.refreshNotifications(), 500);
            }
        }
        return response;
    };

    // --- Auto-Clear needsBackup on Idle + Successful Backup ---
    // If 5+ minutes have passed since the last data change and a backup succeeds, clear the flag.
    window._lastDataChangeTime = Date.now();

    window.addEventListener('autoBackupComplete', (e) => {
        const result = e.detail;
        if (result.success && window.needsBackup) {
            const idleMs = Date.now() - (window._lastDataChangeTime || 0);
            if (idleMs >= 5 * 60 * 1000) { // 5 minutes idle
                console.log('[BackupProtection] Idle 5+ min + backup success → auto-clearing needsBackup.');
                window.needsBackup = false;
                localStorage.setItem('needsBackup', 'false');
                window.updateUnsavedIndicator();
            }
        }
    });

    // Clear stale needsBackup from a previous session after a short grace period
    if (window.needsBackup) {
        setTimeout(() => {
            // If no new data changes happened since page load, it's stale
            const timeSinceLoad = Date.now() - window._lastDataChangeTime;
            if (timeSinceLoad >= 25000 && window.needsBackup) {
                console.log('[BackupProtection] Stale needsBackup from previous session — clearing.');
                window.needsBackup = false;
                localStorage.setItem('needsBackup', 'false');
                window.updateUnsavedIndicator();
            }
        }, 30000); // 30 seconds after page load
    }

    // --- Exit Intent Detection (Custom Modal) ---
    // Shows a custom modal when the user moves their mouse toward the top of the
    // browser (near the URL bar / close button), indicating they might leave.
    let exitIntentShown = false;
    let exitIntentCooldown = false;

    document.addEventListener('mouseleave', async (e) => {
        // Only trigger when mouse leaves from the TOP of the viewport
        if (e.clientY > 0) return;

        // Only show if there's unsaved data
        if (!window.needsBackup) return;

        // Don't show if already visible or in cooldown
        if (exitIntentShown || exitIntentCooldown) return;

        exitIntentShown = true;

        const userChoice = await showExitIntentModal();

        if (userChoice === 'backup') {
            if (window.autoBackupManager) {
                window.showToast('Starting backup...', 'info');
                const res = await window.autoBackupManager.runBackupNow();
                if (res.success) {
                    window.needsBackup = false;
                    localStorage.setItem('needsBackup', 'false');
                    window.updateUnsavedIndicator();
                    window.showToast('Backup complete! Safe to close.', 'success');
                } else {
                    window.showToast('Backup failed: ' + res.message, 'error');
                }
            }
        }
        // 'dismiss' — user acknowledged, don't pester again for 60 seconds
        exitIntentShown = false;
        exitIntentCooldown = true;
        setTimeout(() => { exitIntentCooldown = false; }, 60000);
    });

    // --- Ctrl+S Quick Backup Shortcut ---
    document.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault(); // Block browser's "Save Page As" dialog

            if (!window.needsBackup) {
                window.showToast('Nothing to backup — all synced ✓', 'success');
                return;
            }

            if (window.autoBackupManager) {
                window.showToast('Quick backup starting...', 'info');
                const res = await window.autoBackupManager.runBackupNow();
                if (res.success) {
                    window.needsBackup = false;
                    localStorage.setItem('needsBackup', 'false');
                    window.updateUnsavedIndicator();
                    window.showToast('Backup saved ✓', 'success');
                } else {
                    window.showToast('Backup failed: ' + res.message, 'error');
                }
            } else {
                window.showToast('Auto-backup not configured. Go to Backup & Restore to set up.', 'warning');
            }
        }
    });

    function showExitIntentModal() {
        return new Promise(resolve => {
            let modal = document.getElementById('backup-protection-modal');
            if (!modal) {
                console.error("Backup protection modal not found in DOM.");
                resolve('dismiss');
                return;
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.children[0].classList.remove('scale-95');
            }, 10);

            const hide = (choice) => {
                modal.classList.add('opacity-0');
                modal.children[0].classList.add('scale-95');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                    resolve(choice);
                }, 300);
            };

            const backupBtn = document.getElementById('backup-now-btn');
            const reviewBtn = document.getElementById('review-changes-btn');
            const exitBtn = document.getElementById('continue-anyway-btn');
            const cancelBtn = document.getElementById('cancel-navigation-btn');

            const onBackup = () => { cleanup(); hide('backup'); };
            const onReview = () => { cleanup(); hide('dismiss'); window.loadPage('review-changes'); };
            const onDismiss = () => { cleanup(); hide('dismiss'); };

            const cleanup = () => {
                if (backupBtn) backupBtn.removeEventListener('click', onBackup);
                if (reviewBtn) reviewBtn.removeEventListener('click', onReview);
                if (exitBtn) exitBtn.removeEventListener('click', onDismiss);
                if (cancelBtn) cancelBtn.removeEventListener('click', onDismiss);
            };

            if (backupBtn) backupBtn.addEventListener('click', onBackup);
            if (reviewBtn) reviewBtn.addEventListener('click', onReview);
            if (exitBtn) exitBtn.addEventListener('click', onDismiss);
            if (cancelBtn) cancelBtn.addEventListener('click', onDismiss);
        });
    }

    const mainContent = document.getElementById('main-content');
    const headerContainer = document.getElementById('header-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    // --- Notification Logic ---
    function initializeNotifications() {
        const notificationBtn = document.getElementById('notification-btn');
        const notificationPanel = document.getElementById('notification-panel');
        const notificationList = document.getElementById('notification-list');
        const notificationCount = document.getElementById('notification-count');

        if (!notificationBtn || !notificationPanel || !notificationList) return;

        let isNotificationInitialized = false;
        let isPanelOpen = false;

        const initializeLastSeenId = async () => {
            try {
                const response = await fetch('api/recent-activity.php');
                const result = await response.json();
                if (result.success && result.data.length > 0) {
                    lastSeenId = result.data[0].id;
                }
                isNotificationInitialized = true;
            } catch (error) {
                console.error("Failed to initialize last seen notification ID:", error);
                // Still mark as initialized to allow fallback behavior
                isNotificationInitialized = true;
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
            if (isPanelOpen || !isNotificationInitialized) return;
            try {
                const response = await fetch(`api/recent-activity.php?check_since=${lastSeenId}`);
                const result = await response.json();
                if (result.success) {
                    if (result.new_count > 0) {
                        if (notificationCount) {
                            notificationCount.textContent = result.new_count;
                            notificationCount.classList.remove('hidden');
                        }
                    } else if (notificationCount) {
                        notificationCount.classList.add('hidden');
                        notificationCount.textContent = '0';
                    }
                }
            } catch (error) { console.error("Failed to check for new notifications:", error); }
        };

        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentlyHidden = notificationPanel.classList.contains('hidden');
            if (currentlyHidden) {
                notificationPanel.classList.remove('hidden');
                isPanelOpen = true;
                if (notificationCount) {
                    notificationCount.classList.add('hidden');
                    notificationCount.textContent = '0';
                }
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

        window.refreshNotifications = checkForNewNotifications;

        initializeLastSeenId().then(() => {
            // Once initialized, start polling for new ones
            setInterval(checkForNewNotifications, 30000); // 30 seconds
            // Also run once immediately to catch anything that happened during load
            checkForNewNotifications();
        });
    }

    // --- Page Loading Logic ---
    const loadComponent = async (url, element) => {
        try {
            const response = await fetch(`${url}?v=${new Date().getTime()}`);
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
            'speed-trivia': 'assets/js/speed-trivia.js',
            'review-changes': 'assets/js/review-changes.js'
        };


        if (pageScripts[page]) {
            try {
                const response = await fetch(`${pageScripts[page]}?v=${new Date().getTime()}`);
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

    // --- SPA Navigation Prevention (Custom Modal) ---
    // --- SPA Navigation (Direct) ---
    window.loadPage = async (page, params = '') => {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

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
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.toggle('bg-gray-700', link.dataset.page === page);
            });
            mainContent.innerHTML = `<iframe src="https://shohanurcsevu.github.io/ai_mcq/" class="w-full h-full border-0"></iframe>`;
            return;
        }

        try {
            await loadComponent(`pages/${page}.html`, mainContent);

            // Update Navigation Highlighting
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

    // Assign to internal variable for compatibility
    loadPage = window.loadPage;




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
    window.addEventListener('autoBackupStarted', () => {
        window.showToast('Auto-backup in progress...', 'info');
        // Signal any open Backup UI to show loading state
        if (typeof window.refreshBackupUI === 'function') window.refreshBackupUI({ status: 'running' });
    });

    window.addEventListener('autoBackupComplete', (e) => {
        const result = e.detail;
        if (result.success && !result.folderRestored) {
            window.showToast(result.usedFallback ? 'Auto-backup downloaded ✓' : 'Auto-backup saved to cloud ✓', 'success');
        } else if (!result.success && result.message) {
            window.showToast('Backup failed: ' + result.message, 'error');
        }
        // Signal any open Backup UI to refresh data
        if (typeof window.refreshBackupUI === 'function') window.refreshBackupUI({ status: 'idle' });
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

    // Start Smart Header Engine
    if (typeof SmartHeader !== 'undefined') {
        SmartHeader.init();
    }

    // Initialize Font Picker (dropdown on profile image)
    if (typeof FontPicker !== 'undefined') {
        FontPicker.init();
    }

    // Initialize Profile Manager (Avatar sync)
    if (typeof ProfileManager !== 'undefined') {
        ProfileManager.init();
    }

    // Update unsaved indicator after header is loaded
    window.updateUnsavedIndicator();

    // --- Cross-Device Backup Awareness ---
    // Server compares last DB change vs last backup time — works across all devices
    async function syncBackupStatus() {
        try {
            const resp = await fetch('api/backup/last-change.php');
            const data = await resp.json();
            if (data.success && data.needs_backup && !window.needsBackup) {
                console.log(`[CrossDevice] Server says backup needed (last change: ${data.last_change}, last backup: ${data.last_backup || 'never'}).`);
                window.needsBackup = true;
                localStorage.setItem('needsBackup', 'true');
                window.updateUnsavedIndicator();
            } else if (data.success && !data.needs_backup && window.needsBackup) {
                console.log('[CrossDevice] Server says backup is up-to-date. Clearing local flag.');
                window.needsBackup = false;
                localStorage.setItem('needsBackup', 'false');
                window.updateUnsavedIndicator();
            }
        } catch (err) {
            // Silent fail — network hiccup shouldn't break the app
        }
    }

    // Initial check + poll every 10 seconds
    syncBackupStatus();
    setInterval(syncBackupStatus, 10000);

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
            window.loadPage(navLink.dataset.page);
        }
    });

    window.onpopstate = (event) => {
        if (event.state) {
            window.loadPage(event.state.page, event.state.params);
        } else {
            const fallbackParams = new URLSearchParams(window.location.search);
            const fallbackPage = fallbackParams.get('page') || 'dashboard';
            fallbackParams.delete('page');
            window.loadPage(fallbackPage, '?' + fallbackParams.toString());
        }
    };
});
