/**
 * Backup & Restore Page Logic
 * Handles export (download) and import (upload + restore) workflows.
 */
(function () {
    'use strict';

    // ─── State ────────────────────────────────────────────────────────────────────

    let selectedFile = null;

    // ─── DOM Refs ─────────────────────────────────────────────────────────────────

    const $ = (id) => document.getElementById(id);

    const downloadBtn = $('br-download-btn');
    const fileInput = $('br-file-input');
    const dropzone = $('br-dropzone');
    const fileSelected = $('br-file-selected');
    const fileName = $('br-file-name');
    const clearFile = $('br-clear-file');
    const importBtn = $('br-import-btn');
    const tableList = $('br-table-list');
    const statTables = $('br-stat-tables');
    const statRecords = $('br-stat-records');
    const statsBar = $('br-stats-bar');

    const exportProgress = $('br-export-progress');
    const exportBar = $('br-export-bar');
    const exportStatusTxt = $('br-export-status-text');
    const exportPct = $('br-export-pct');

    const importProgress = $('br-import-progress');
    const importBar = $('br-import-bar');
    const importStatusTxt = $('br-import-status-text');
    const importPct = $('br-import-pct');

    const importResult = $('br-import-result');
    const resultHeader = $('br-result-header');
    const resultIcon = $('br-result-icon');
    const resultTitle = $('br-result-title');
    const resultSubtitle = $('br-result-subtitle');
    const resultTable = $('br-result-table');
    const resultErrors = $('br-result-errors');

    const confirmModal = $('br-confirm-modal');
    const modalIconWrap = $('br-modal-icon-wrap');
    const modalIcon = $('br-modal-icon');
    const modalBody = $('br-modal-body');
    const modalCancel = $('br-modal-cancel');
    const modalConfirm = $('br-modal-confirm');

    // ─── Table Definitions (matches backend order) ────────────────────────────────

    const TABLES = [
        { name: 'subjects', icon: 'subject', label: 'Subjects' },
        { name: 'lessons', icon: 'library_books', label: 'Lessons' },
        { name: 'topics', icon: 'topic', label: 'Topics' },
        { name: 'exams', icon: 'quiz', label: 'Exams' },
        { name: 'questions', icon: 'help_center', label: 'Questions' },
        { name: 'performance', icon: 'fact_check', label: 'Performance' },
        { name: 'question_attempts', icon: 'edit_note', label: 'Q. Attempts' },
        { name: 'question_srs', icon: 'history_edu', label: 'SRS Data' },
        { name: 'offline_exam_attempts', icon: 'offline_pin', label: 'Offline Attempts' },
        { name: 'study_sessions', icon: 'schedule', label: 'Study Sessions' },
        { name: 'activity_log', icon: 'timeline', label: 'Activity Log' },
        { name: 'mistake_bank', icon: 'psychology', label: 'Mistake Bank' },
        { name: 'flashcards', icon: 'style', label: 'Flashcards' },
        { name: 'reading_logs', icon: 'book', label: 'Reading Logs' },
        { name: 'user_streaks', icon: 'local_fire_department', label: 'Streaks' },
    ];

    // ─── Init ─────────────────────────────────────────────────────────────────────

    function init() {
        renderTableList();
        fetchRecordStats();
        bindExport();
        bindImport();
        bindModal();
        bindDragDrop();
    }

    // ─── Table List & Stats ───────────────────────────────────────────────────────

    function renderTableList() {
        tableList.innerHTML = TABLES.map(t => `
            <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <span class="material-symbols-outlined text-indigo-400 text-sm">${t.icon}</span>
                <span class="text-xs font-bold text-gray-700">${t.label}</span>
            </div>`).join('');

        if (statsBar) {
            statTables.textContent = TABLES.length;
            statsBar.classList.remove('hidden');
        }
    }

    async function fetchRecordStats() {
        // We get this from the export endpoint by peeking at headers — instead
        // just show total table count. Record count will appear after first export.
        statTables.textContent = TABLES.length;
    }

    // ─── Export / Download ────────────────────────────────────────────────────────

    function bindExport() {
        downloadBtn.addEventListener('click', downloadBackup);
    }

    async function downloadBackup() {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Preparing...';

        exportProgress.classList.remove('hidden');
        setExportProgress(10, 'Connecting to server...');

        try {
            setExportProgress(30, 'Querying database tables...');
            const response = await fetch('api/backup/export.php', { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            setExportProgress(70, 'Receiving data...');

            const blob = await response.blob();
            setExportProgress(90, 'Creating download...');

            // Extract filename from Content-Disposition header if available
            const disposition = response.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="([^"]+)"/);
            const filename = match ? match[1] : `rethink-backup-${new Date().toISOString().slice(0, 10)}.json`;

            // Trigger browser download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setExportProgress(100, 'Backup downloaded successfully!');
            exportBar.style.background = 'linear-gradient(to right, #10b981, #059669)';

            // Update record count from X-Backup-Tables header
            const tablesHeader = response.headers.get('X-Backup-Tables');
            if (tablesHeader) statTables.textContent = tablesHeader;

            showToast('Backup downloaded successfully!', 'success');

            setTimeout(() => {
                exportProgress.classList.add('hidden');
                resetExportProgress();
            }, 3000);

        } catch (err) {
            setExportProgress(100, 'Export failed: ' + err.message);
            exportBar.style.background = 'linear-gradient(to right, #ef4444, #dc2626)';
            showToast('Export failed: ' + err.message, 'error');
            setTimeout(() => {
                exportProgress.classList.add('hidden');
                resetExportProgress();
            }, 4000);
        }

        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-sm">cloud_download</span> Download Backup';
    }

    function setExportProgress(pct, text) {
        exportBar.style.width = pct + '%';
        exportStatusTxt.textContent = text;
        exportPct.textContent = pct + '%';
    }

    function resetExportProgress() {
        exportBar.style.width = '0%';
        exportBar.style.background = '';
        exportStatusTxt.textContent = 'Preparing backup...';
        exportPct.textContent = '0%';
    }

    // ─── Import ───────────────────────────────────────────────────────────────────

    function bindImport() {
        fileInput.addEventListener('change', handleFileSelect);
        importBtn.addEventListener('click', triggerImportConfirm);
        clearFile.addEventListener('click', clearSelectedFile);
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) setFile(file);
    }

    function setFile(file) {
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            showToast('Please select a valid .json backup file.', 'warning');
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        fileSelected.classList.remove('hidden');
        importBtn.disabled = false;
        // Hide previous result
        importResult.classList.add('hidden');
        importProgress.classList.add('hidden');
    }

    function clearSelectedFile() {
        selectedFile = null;
        fileInput.value = '';
        fileSelected.classList.add('hidden');
        importBtn.disabled = true;
        importResult.classList.add('hidden');
        importProgress.classList.add('hidden');
    }

    function getConflictMode() {
        return document.querySelector('input[name="br-conflict"]:checked')?.value ?? 'skip';
    }

    function triggerImportConfirm() {
        if (!selectedFile) return;
        const conflict = getConflictMode();
        const isOverwrite = conflict === 'overwrite';

        // Style modal
        modalIconWrap.className = `w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isOverwrite ? 'bg-rose-100' : 'bg-indigo-100'}`;
        modalIcon.className = `material-symbols-outlined text-3xl ${isOverwrite ? 'text-rose-500' : 'text-indigo-500'}`;
        modalIcon.textContent = isOverwrite ? 'warning' : 'shield';
        modalConfirm.className = `flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition-colors shadow ${isOverwrite ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'}`;

        if (isOverwrite) {
            modalBody.innerHTML = `You're about to import <strong>${selectedFile.name}</strong> with <strong class="text-rose-600">Overwrite</strong> mode.<br><br>
                <span class="text-rose-600 font-bold">⚠ Existing records will be replaced.</span> This cannot be undone. Make sure you have a current backup before proceeding.`;
        } else {
            modalBody.innerHTML = `You're about to import <strong>${selectedFile.name}</strong> with <strong class="text-indigo-600">Skip Duplicates</strong> mode.<br><br>
                Existing records will be preserved. Only new records from the backup will be added.`;
        }

        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
    }

    function bindModal() {
        modalCancel.addEventListener('click', closeModal);
        modalConfirm.addEventListener('click', () => {
            closeModal();
            runImport();
        });
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) closeModal();
        });
    }

    function closeModal() {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
    }

    async function runImport() {
        if (!selectedFile) return;

        importBtn.disabled = true;
        importBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Importing...';
        importResult.classList.add('hidden');
        importProgress.classList.remove('hidden');
        setImportProgress(10, 'Uploading backup file...');

        const conflict = getConflictMode();

        try {
            const formData = new FormData();
            formData.append('backup', selectedFile);

            setImportProgress(30, 'Validating backup file...');

            const response = await fetch(`api/backup/import.php?conflict=${conflict}`, {
                method: 'POST',
                body: formData,
            });

            setImportProgress(70, 'Restoring data...');

            const result = await response.json();

            setImportProgress(100, result.success ? 'Restore complete!' : 'Restore failed.');

            setTimeout(() => {
                importProgress.classList.add('hidden');
                resetImportProgress();
                renderImportResult(result);
            }, 800);

        } catch (err) {
            setImportProgress(100, 'Import error: ' + err.message);
            setTimeout(() => {
                importProgress.classList.add('hidden');
                resetImportProgress();
                renderImportResult({ success: false, message: err.message, imported: {}, errors: [err.message] });
            }, 800);
        }

        importBtn.disabled = false;
        importBtn.innerHTML = '<span class="material-symbols-outlined text-sm">restore</span> Import Backup';
    }

    function setImportProgress(pct, text) {
        importBar.style.width = pct + '%';
        importStatusTxt.textContent = text;
        importPct.textContent = pct + '%';
    }

    function resetImportProgress() {
        importBar.style.width = '0%';
        importBar.style.background = '';
        importStatusTxt.textContent = 'Uploading file...';
        importPct.textContent = '0%';
    }

    function renderImportResult(result) {
        importResult.classList.remove('hidden');

        const success = result.success === true;

        // Header styling
        resultHeader.className = `flex items-center gap-3 p-4 border-b ${success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`;
        resultIcon.className = `material-symbols-outlined text-2xl ${success ? 'text-emerald-500' : 'text-red-500'}`;
        resultIcon.textContent = success ? 'check_circle' : 'error';
        resultTitle.textContent = success ? 'Restore Successful' : 'Restore Failed';
        resultTitle.className = `font-bold text-sm ${success ? 'text-emerald-700' : 'text-red-700'}`;

        if (success) {
            const total = result.total_imported ?? 0;
            const skipped = result.total_skipped ?? 0;
            const errorCount = result.error_count ?? 0;
            resultSubtitle.textContent = `${total} records imported • ${skipped} skipped${errorCount > 0 ? ` • ${errorCount} row errors` : ''}`;
        } else {
            resultSubtitle.textContent = result.message || 'An unknown error occurred.';
        }

        // Per-table breakdown
        const importedData = result.imported || {};
        const tableRows = Object.entries(importedData)
            .filter(([, count]) => count !== undefined)
            .map(([table, count]) => {
                const tableDef = TABLES.find(t => t.name === table);
                const label = tableDef ? tableDef.label : table;
                const icon = tableDef ? tableDef.icon : 'table';
                return `
                    <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <span class="material-symbols-outlined text-gray-400 text-sm">${icon}</span>
                        <span class="text-gray-600 flex-1 truncate">${label}</span>
                        <span class="font-black text-gray-800 text-sm">${count}</span>
                    </div>`;
            }).join('');

        resultTable.innerHTML = tableRows || '<p class="text-gray-400 text-xs col-span-3">No table data available.</p>';

        // Errors list
        if (result.errors && result.errors.length > 0) {
            resultErrors.classList.remove('hidden');
            resultErrors.innerHTML = `
                <p class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Row-level Errors (${result.errors.length})</p>
                ${result.errors.map(e => `<p class="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">${e}</p>`).join('')}
            `;
        } else {
            resultErrors.classList.add('hidden');
        }

        if (success) {
            showToast(`Restored ${result.total_imported ?? 0} records successfully!`, 'success');
        } else {
            showToast(result.message || 'Import failed', 'error');
        }
    }

    // ─── Drag & Drop ─────────────────────────────────────────────────────────────

    function bindDragDrop() {
        ['dragenter', 'dragover'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.add('border-indigo-500', 'bg-indigo-50/50');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (file) setFile(file);
        });
    }

    // ─── Toast ────────────────────────────────────────────────────────────────────


    // ─── Auto-Backup UI ───────────────────────────────────────────────────────

    function initAutoBackupUI() {
        if (!window.autoBackupManager) return; // manager not loaded

        const abm = window.autoBackupManager;

        // DOM refs
        const toggleEl = document.getElementById('ab-enabled-toggle');
        const intervalSel = document.getElementById('ab-interval-select');
        const pickBtn = document.getElementById('ab-pick-folder-btn');
        const folderNameEl = document.getElementById('ab-folder-name');
        const noFsaWarn = document.getElementById('ab-no-fsa-warning');
        const folderTip = document.getElementById('ab-folder-tip');
        const runNowBtn = document.getElementById('ab-run-now-btn');
        const progressEl = document.getElementById('ab-progress');
        const progressBar = document.getElementById('ab-progress-bar');
        const progressTxt = document.getElementById('ab-progress-text');
        const progressPct = document.getElementById('ab-progress-pct');
        const lastRunEl = document.getElementById('ab-last-run');
        const nextRunEl = document.getElementById('ab-next-run');
        const runCountEl = document.getElementById('ab-run-count');
        const historyList = document.getElementById('ab-history-list');

        if (!toggleEl) return; // page not loaded

        let nextRunTimer = null;
        let nextRunTarget = null; // Date object for next run

        // ── Helpers ────────────────────────────────────────────────────────────

        function fmtTime(isoStr) {
            if (!isoStr) return 'Never';
            const d = new Date(isoStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        function fmtSize(bytes) {
            if (!bytes) return '—';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        }

        function fmtCountdown(ms) {
            if (ms <= 0) return 'now';
            const s = Math.floor(ms / 1000);
            const m = Math.floor(s / 60);
            const h = Math.floor(m / 60);
            if (h > 0) return `in ${h}h ${m % 60}m`;
            if (m > 0) return `in ${m}m ${s % 60}s`;
            return `in ${s}s`;
        }

        // ── Apply settings to UI ──────────────────────────────────────────────

        function applySettingsToUI(settings) {
            toggleEl.checked = !!settings.enabled;
            // Interval select
            const opt = intervalSel.querySelector(`option[value="${settings.intervalMs}"]`);
            if (opt) opt.selected = true;
            // Folder name
            if (settings.folderName) {
                folderNameEl.textContent = '📁 ' + settings.folderName;
                folderTip.classList.add('hidden');
            } else {
                folderNameEl.textContent = 'Choose folder…';
                folderTip.classList.remove('hidden');
            }
            // FSA warning
            if (!abm.supportsFileSystemAccess()) {
                noFsaWarn.classList.remove('hidden');
                pickBtn.disabled = false; // still clickable for UX
            }
            // Stats
            lastRunEl.textContent = fmtTime(settings.lastRunAt);
            runCountEl.textContent = settings.runCount || 0;
            // Countdown
            updateCountdown(settings);
        }

        function updateCountdown(settings) {
            clearInterval(nextRunTimer);
            nextRunTarget = null;
            if (!settings.enabled || !settings.lastRunAt) {
                nextRunEl.textContent = settings.enabled ? 'Starting soon…' : '—';
                return;
            }
            nextRunTarget = new Date(new Date(settings.lastRunAt).getTime() + settings.intervalMs);
            nextRunTimer = setInterval(() => {
                const remaining = nextRunTarget - Date.now();
                nextRunEl.textContent = fmtCountdown(remaining);
                if (remaining <= 0) clearInterval(nextRunTimer);
            }, 1000);
            nextRunEl.textContent = fmtCountdown(nextRunTarget - Date.now());
        }

        // ── Progress bar helpers ───────────────────────────────────────────────

        function setProgress(pct, text) {
            progressBar.style.width = pct + '%';
            progressTxt.textContent = text;
            progressPct.textContent = pct + '%';
        }

        function showProgress() {
            progressEl.classList.remove('hidden');
            progressBar.style.background = '';
            setProgress(0, 'Fetching data…');
        }

        function hideProgress() {
            progressEl.classList.add('hidden');
        }

        // ── History rendering ─────────────────────────────────────────────────

        async function renderHistory() {
            const items = await abm.getHistory();
            if (!items || items.length === 0) {
                historyList.innerHTML = '<p class="text-xs text-gray-400 italic">No snapshots yet. Run your first backup above.</p>';
                return;
            }
            historyList.innerHTML = items.map((item, idx) => {
                const ago = fmtTime(item.savedAt);
                const size = fmtSize(item.sizeBytes);
                const records = item.recordCount ? `${item.recordCount} records` : '';
                const cloudBadge = item.folderUsed
                    ? '<span class="text-[9px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded uppercase tracking-wider">☁ Cloud</span>'
                    : '<span class="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Local</span>';
                return `
                <div class="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3 hover:border-violet-200 transition-colors group">
                    <div class="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-violet-500 text-base">data_object</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="text-xs font-bold text-gray-700 truncate">${idx === 0 ? '⭐ Latest · ' : ''}${ago}</p>
                            ${cloudBadge}
                        </div>
                        <p class="text-[10px] text-gray-400 font-medium">${size}${records ? ' · ' + records : ''}</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button data-id="${item.id}" data-action="download"
                            class="ab-history-btn p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors" title="Download this snapshot">
                            <span class="material-symbols-outlined text-base">download</span>
                        </button>
                        <button data-id="${item.id}" data-action="restore"
                            class="ab-history-btn p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors" title="Restore from this snapshot">
                            <span class="material-symbols-outlined text-base">restore</span>
                        </button>
                        <button data-id="${item.id}" data-action="delete"
                            class="ab-history-btn p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete this snapshot">
                            <span class="material-symbols-outlined text-base">delete</span>
                        </button>
                    </div>
                </div>`;
            }).join('');

            // Wire per-row buttons
            historyList.querySelectorAll('.ab-history-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = parseInt(btn.dataset.id, 10);
                    const action = btn.dataset.action;
                    if (action === 'delete') {
                        await abm.deleteHistory(id);
                        await renderHistory();
                        showToast('Snapshot deleted.', 'info');
                    } else if (action === 'download') {
                        const blob = await abm.restoreFromHistory(id);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `rethink-snapshot-${id}.json`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('Snapshot downloaded.', 'success');
                    } else if (action === 'restore') {
                        // Reuse existing import flow via selectedFile trick
                        const blob = await abm.restoreFromHistory(id);
                        const file = new File([blob], `rethink-snapshot-${id}.json`, { type: 'application/json' });
                        setFile(file); // sets selectedFile & enables Import button
                        // Scroll to import section
                        document.getElementById('br-dropzone')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        showToast('Snapshot loaded. Review conflict mode then click Import Backup.', 'info');
                    }
                });
            });
        }

        // ── Bind controls ──────────────────────────────────────────────────────

        // Toggle
        toggleEl.addEventListener('change', () => {
            abm.saveSettings({ enabled: toggleEl.checked });
            applySettingsToUI(abm.getSettings());
            showToast(toggleEl.checked ? 'Auto-backup enabled ✓' : 'Auto-backup disabled.', toggleEl.checked ? 'success' : 'info');
        });

        // Interval
        intervalSel.addEventListener('change', () => {
            abm.saveSettings({ intervalMs: parseInt(intervalSel.value, 10) });
            applySettingsToUI(abm.getSettings());
        });

        // Folder picker
        pickBtn.addEventListener('click', async () => {
            if (!abm.supportsFileSystemAccess()) {
                showToast('Folder picker not supported. Backups will download to your Downloads folder.', 'warning');
                return;
            }
            pickBtn.disabled = true;
            const result = await abm.pickFolder();
            pickBtn.disabled = false;
            if (result.success) {
                folderNameEl.textContent = '📁 ' + result.folderName;
                folderTip.classList.add('hidden');
                showToast(`Folder selected: ${result.folderName} ✓`, 'success');
            } else if (result.error !== 'Cancelled.') {
                showToast('Could not access folder: ' + result.error, 'error');
            }
        });

        // Run Now
        runNowBtn.addEventListener('click', async () => {
            runNowBtn.disabled = true;
            runNowBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Backing up…';
            showProgress();
            setProgress(10, 'Fetching data…');

            // Fake incremental progress while awaiting
            let pct = 10;
            const ticker = setInterval(() => {
                pct = Math.min(pct + 15, 85);
                setProgress(pct, pct < 50 ? 'Querying database…' : 'Writing file…');
            }, 400);

            const result = await abm.runBackupNow();

            clearInterval(ticker);
            if (result.success) {
                setProgress(100, result.usedFallback ? 'Downloaded to browser ✓' : 'Saved to cloud folder ✓');
                progressBar.style.background = 'linear-gradient(to right, #7c3aed, #9333ea)';
            } else {
                setProgress(100, 'Backup failed: ' + result.message);
                progressBar.style.background = 'linear-gradient(to right, #ef4444, #dc2626)';
            }

            setTimeout(hideProgress, 3000);

            applySettingsToUI(abm.getSettings());
            await renderHistory();

            runNowBtn.disabled = false;
            runNowBtn.innerHTML = '<span class="material-symbols-outlined text-sm">backup</span> Run Backup Now';
        });

        // Listen for background auto-backup events to refresh UI only
        // Named function to allow removal if needed, though with SPA navigation it might still accumulate
        // Best approach: check if we already initialized or use a flag.
        if (!window._backupUIListenerAdded) {
            window.addEventListener('autoBackupComplete', async (e) => {
                const result = e.detail;
                // Toast is handled by main.js globally
                applySettingsToUI(abm.getSettings());
                await renderHistory();
            });
            window._backupUIListenerAdded = true;
        }

        // ── Initial render ────────────────────────────────────────────────────
        applySettingsToUI(abm.getSettings());
        renderHistory();
    }

    // ─── Start ────────────────────────────────────────────────────────────────

    function init() {
        renderTableList();
        fetchRecordStats();
        bindExport();
        bindImport();
        bindModal();
        bindDragDrop();
        initAutoBackupUI();
    }

    init();

})();
