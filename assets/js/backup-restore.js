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

    function showToast(message, type = 'info') {
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
    }

    // ─── Start ────────────────────────────────────────────────────────────────────

    init();

})();
