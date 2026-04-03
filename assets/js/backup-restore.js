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

    // ─── Table Definitions (fetched dynamically from API) ───────────────────────

    let TABLES = [];  // Populated from stats.php — no hardcoded list!

    // ─── Init ─────────────────────────────────────────────────────────────────────

    function init() {
        fetchTableMetaAndStats();  // Fetch tables from API, then render
        bindExport();
        bindImport();
        bindModal();
        bindDragDrop();
    }

    // ─── Table List & Stats ───────────────────────────────────────────────────────

    async function fetchTableMetaAndStats() {
        // Show loading state
        if (tableList) tableList.innerHTML = `
            <div class="flex items-center justify-center gap-2 py-4 col-span-full">
                <span class="material-symbols-outlined text-indigo-400 animate-spin">sync</span>
                <span class="text-xs text-gray-400">Loading tables...</span>
            </div>`;
        if (statTables) statTables.textContent = '...';
        if (statRecords) statRecords.textContent = '...';

        try {
            const res = await fetch('api/backup/stats.php', { cache: 'no-store' });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const data = await res.json();

            // Use table_meta from API (auto-detected from DB)
            if (data.table_meta && data.table_meta.length > 0) {
                TABLES = data.table_meta;  // [{name, icon, label, rows}, ...]
            }

            // Update stats
            if (statTables) statTables.textContent = data.tables ?? TABLES.length;
            if (statRecords) statRecords.textContent = (data.total_records ?? 0).toLocaleString();
            if (statsBar) statsBar.classList.remove('hidden');

            // Render table list
            renderTableList();
        } catch (err) {
            console.warn('Failed to fetch table stats:', err);
            // Fallback — show error state
            if (tableList) tableList.innerHTML = `
                <div class="flex items-center justify-center gap-2 py-4 col-span-full">
                    <span class="material-symbols-outlined text-red-400">warning</span>
                    <span class="text-xs text-red-400">Could not load tables. Is the server running?</span>
                </div>`;
            if (statTables) statTables.textContent = '0';
            if (statRecords) statRecords.textContent = '0';
        }
    }

    function renderTableList() {
        if (!tableList || TABLES.length === 0) return;

        tableList.innerHTML = TABLES.map(t => `
            <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <span class="material-symbols-outlined text-indigo-400 text-sm">${t.icon}</span>
                <span class="text-xs font-bold text-gray-700">${t.label}</span>
                <span class="ml-auto text-[10px] text-gray-400">${(t.rows ?? 0).toLocaleString()}</span>
            </div>`).join('');

        if (statsBar) {
            statTables.textContent = TABLES.length;
            statsBar.classList.remove('hidden');
        }
    }

    // ─── Export / Download ────────────────────────────────────────────────────────

    function bindExport() {
        downloadBtn.addEventListener('click', downloadBackup);
    }

    async function downloadBackup() {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Preparing...';

        exportProgress.classList.remove('hidden');
        setExportProgress(5, 'Fetching metadata...');

        try {
            // 1. Fetch metadata (schema + row counts)
            const metaRes = await fetch('api/backup/export-chunk.php?action=meta', { cache: 'no-store' });
            if (!metaRes.ok) throw new Error(`Server error: ${metaRes.status}`);
            const meta = await metaRes.json();
            if (meta.error) throw new Error(meta.error);

            const tables = meta.tables || [];
            const totalTables = tables.length;

            // Build backup object shell
            const backup = {
                backup_version: meta.backup_version || '2.0',
                app: meta.app || 'rethink-admin',
                exported_at: meta.exported_at,
                db_name: meta.db_name,
                db_charset: meta.db_charset,
                db_collation: meta.db_collation,
                table_counts: meta.table_counts || {},
                schema: meta.schema || {},
                data: {},
            };

            // Update stats bar
            if (statTables) statTables.textContent = totalTables;
            if (statRecords) statRecords.textContent = (meta.total_records ?? 0).toLocaleString();

            // 2. Fetch each table's data one-by-one
            for (let i = 0; i < totalTables; i++) {
                const tbl = tables[i];
                const tableDef = TABLES.find(t => t.name === tbl);
                const label = tableDef ? tableDef.label : tbl;
                const pct = Math.round(10 + (i / totalTables) * 75);
                setExportProgress(pct, `Exporting ${label} (${i + 1}/${totalTables})...`);

                const dataRes = await fetch(`api/backup/export-chunk.php?action=data&table=${encodeURIComponent(tbl)}`, { cache: 'no-store' });
                if (!dataRes.ok) throw new Error(`Failed to fetch table "${tbl}": ${dataRes.status}`);
                const dataJson = await dataRes.json();
                if (dataJson.error) throw new Error(dataJson.error);

                backup.data[tbl] = dataJson.rows || [];
            }

            // 3. Compute SHA-256 checksum of data section
            setExportProgress(88, 'Computing integrity checksum...');
            const dataStr = JSON.stringify(backup.data);
            if (crypto && crypto.subtle) {
                const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataStr));
                backup.checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
                backup.checksum = '';
            }

            setExportProgress(90, 'Compressing backup...');

            // 4. Compress JSON → gzip
            const jsonText = JSON.stringify(backup, null, 2);
            const filename = `rethink-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
            let blob;

            if (typeof CompressionStream !== 'undefined') {
                // Modern browsers: compress client-side
                const textBlob = new Blob([jsonText], { type: 'application/json' });
                const cs = new CompressionStream('gzip');
                const compressed = textBlob.stream().pipeThrough(cs);
                blob = await new Response(compressed).blob();
            } else {
                // Fallback: download as uncompressed .json
                blob = new Blob([jsonText], { type: 'application/json' });
            }

            setExportProgress(95, 'Creating download...');

            // 4. Trigger download
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
        const validExt = file.name.endsWith('.json') || file.name.endsWith('.json.gz');
        const validType = file.type === 'application/json' || file.type === 'application/gzip' || file.type === 'application/x-gzip';
        if (!validExt && !validType) {
            showToast('Please select a valid .json or .json.gz backup file.', 'warning');
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
        setImportProgress(5, 'Reading backup file...');

        const conflict = getConflictMode();

        try {
            // 1. Read file as ArrayBuffer
            const buffer = await selectedFile.arrayBuffer();
            let jsonText;

            // 2. Detect gzip and decompress client-side
            const bytes = new Uint8Array(buffer);
            const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

            if (isGzip && typeof DecompressionStream !== 'undefined') {
                setImportProgress(10, 'Decompressing backup...');
                const blob = new Blob([buffer]);
                const ds = new DecompressionStream('gzip');
                const decompressed = blob.stream().pipeThrough(ds);
                jsonText = await new Response(decompressed).text();
            } else if (isGzip) {
                // Fallback: send compressed file to legacy import.php (server decompresses)
                setImportProgress(10, 'Uploading to server...');
                const formData = new FormData();
                formData.append('backup', selectedFile);
                setImportProgress(30, 'Server is restoring data...');
                const response = await fetch(`api/backup/import.php?conflict=${conflict}`, {
                    method: 'POST', body: formData,
                });
                const result = await response.json();
                setImportProgress(100, result.success ? 'Restore complete!' : 'Restore failed.');
                setTimeout(() => {
                    importProgress.classList.add('hidden');
                    resetImportProgress();
                    renderImportResult(result);
                }, 800);
                importBtn.disabled = false;
                importBtn.innerHTML = '<span class="material-symbols-outlined text-sm">restore</span> Import Backup';
                return;
            } else {
                jsonText = new TextDecoder().decode(buffer);
            }

            // 3. Parse JSON
            setImportProgress(15, 'Parsing backup data...');
            const backup = JSON.parse(jsonText);

            if (!backup.data || typeof backup.data !== 'object') {
                throw new Error('Invalid backup file: missing data section.');
            }

            // 4. Verify integrity checksum (if present)
            if (backup.checksum) {
                setImportProgress(16, 'Verifying integrity checksum...');
                if (crypto && crypto.subtle) {
                    const dataStr = JSON.stringify(backup.data);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataStr));
                    const computed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                    if (computed !== backup.checksum) {
                        throw new Error('Checksum mismatch — this backup file is corrupted or incomplete. Re-download and try again.');
                    }
                } else {
                    console.warn('[Import] crypto.subtle not available — skipping checksum verification.');
                }
            }

            // 5. Send schema if present (v1.1+)
            if (backup.schema && Object.keys(backup.schema).length > 0) {
                setImportProgress(18, 'Creating tables...');
                const schemaRes = await fetch('api/backup/import-chunk.php?action=schema', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schema: backup.schema }),
                });
                const schemaResult = await schemaRes.json();
                if (schemaResult.errors && schemaResult.errors.length > 0) {
                    console.warn('[Import] Schema errors:', schemaResult.errors);
                }
            }

            // 5. Import data table-by-table
            const tableNames = Object.keys(backup.data);
            const totalTables = tableNames.length;
            const imported = {};
            const allErrors = [];
            let totalImported = 0;
            let totalSkipped = 0;

            for (let i = 0; i < totalTables; i++) {
                const tbl = tableNames[i];
                const rows = backup.data[tbl];
                if (!Array.isArray(rows) || rows.length === 0) {
                    imported[tbl] = 0;
                    continue;
                }

                const tableDef = TABLES.find(t => t.name === tbl);
                const label = tableDef ? tableDef.label : tbl;
                const pct = Math.round(20 + (i / totalTables) * 75);
                setImportProgress(pct, `Restoring ${label} (${i + 1}/${totalTables})...`);

                const res = await fetch(
                    `api/backup/import-chunk.php?action=data&table=${encodeURIComponent(tbl)}&conflict=${conflict}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rows }),
                    }
                );
                const chunkResult = await res.json();

                imported[tbl] = chunkResult.inserted || 0;
                totalImported += chunkResult.inserted || 0;
                totalSkipped += chunkResult.skipped || 0;
                if (chunkResult.errors && chunkResult.errors.length > 0) {
                    allErrors.push(...chunkResult.errors.map(e => `[${tbl}] ${e}`));
                }
            }

            // 6. Show results
            setImportProgress(100, 'Restore complete!');

            const finalResult = {
                success: true,
                conflict_mode: conflict,
                backup_version: backup.backup_version,
                exported_at: backup.exported_at,
                total_imported: totalImported,
                total_skipped: totalSkipped,
                imported,
                error_count: allErrors.length,
                errors: allErrors,
            };

            setTimeout(() => {
                importProgress.classList.add('hidden');
                resetImportProgress();
                renderImportResult(finalResult);
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

        if (window._abNextRunInterval) {
            clearInterval(window._abNextRunInterval);
        }

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
                const isAuthorized = !!abm.getActiveHandle();
                folderNameEl.textContent = '📁 ' + settings.folderName;
                if (!isAuthorized && abm.supportsFileSystemAccess()) {
                    folderNameEl.innerHTML = `📁 ${settings.folderName} <span class="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded cursor-help" title="Browser requires one-click permission to write to this folder again.">Requires Auth</span>`;
                }
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
            updateCountdown(settings, abm.isRunning());
        }

        function updateCountdown(settings, isRunning = false) {
            if (window._abNextRunInterval) clearInterval(window._abNextRunInterval);

            if (isRunning) {
                nextRunEl.textContent = 'Backing up...';
                return;
            }

            if (!settings.enabled) {
                nextRunEl.textContent = '—';
                return;
            }

            // Always show error if one exists from the last attempt
            if (settings.lastError) {
                nextRunEl.innerHTML = `<span class="text-rose-500 flex items-center gap-1 justify-center" title="${settings.lastError}">
                    <span class="material-symbols-outlined text-xs">error</span> Failed
                </span>`;
                return;
            }

            if (!settings.lastRunAt) {
                nextRunEl.textContent = 'Starting soon…';
                return;
            }

            const nextRunTarget = new Date(new Date(settings.lastRunAt).getTime() + settings.intervalMs);

            const tick = () => {
                const remaining = nextRunTarget - Date.now();
                if (remaining <= 0) {
                    nextRunEl.textContent = 'Starting soon…';
                } else {
                    nextRunEl.textContent = fmtCountdown(remaining);
                }
            };

            window._abNextRunInterval = setInterval(tick, 1000);
            tick();
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
                        a.download = `rethink-snapshot-${id}.json.gz`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('Snapshot downloaded.', 'success');
                    } else if (action === 'restore') {
                        // Reuse existing import flow — compressed blob is sent to import.php
                        // which auto-detects gzip and decompresses server-side
                        const blob = await abm.restoreFromHistory(id);
                        const file = new File([blob], `rethink-snapshot-${id}.json.gz`, { type: 'application/gzip' });
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



        /**
         * GLOBAL UI REFRESH CALLBACK (SPA-Safe)
         * Instead of keeping a stale window listener, main.js calls this 
         * whenever a background update happens.
         */
        window.refreshBackupUI = (info = {}) => {
            // Re-find elements just in case the DOM was replaced since init
            const currentToggle = document.getElementById('ab-enabled-toggle');
            if (!currentToggle) return; // Not on the backup page anymore

            const settings = abm.getSettings();
            applySettingsToUI(settings);

            // Re-check countdown with actual running state
            updateCountdown(settings, info.status === 'running' || abm.isRunning());

            renderHistory();
        };

        // ── Initial render ────────────────────────────────────────────────────
        applySettingsToUI(abm.getSettings());
        renderHistory();
    }

    // ─── Database Maintenance ──────────────────────────────────────────────────

    function initMaintenance() {
        const dbSizeEl = document.getElementById('mt-db-size');
        const totalRowsEl = document.getElementById('mt-total-rows');
        const cleanableEl = document.getElementById('mt-cleanable');
        const retentionSel = document.getElementById('mt-retention-days');
        const breakdownDiv = document.getElementById('mt-breakdown');
        const breakdownList = document.getElementById('mt-breakdown-list');
        const progressDiv = document.getElementById('mt-progress');
        const progressText = document.getElementById('mt-progress-text');
        const progressPct = document.getElementById('mt-progress-pct');
        const progressBar = document.getElementById('mt-progress-bar');
        const resultDiv = document.getElementById('mt-result');
        const resultInner = document.getElementById('mt-result-inner');
        const resultIcon = document.getElementById('mt-result-icon');
        const resultTitle = document.getElementById('mt-result-title');
        const resultSubtitle = document.getElementById('mt-result-subtitle');
        const cleanupBtn = document.getElementById('mt-cleanup-btn');
        const optimizeBtn = document.getElementById('mt-optimize-btn');

        if (!cleanupBtn || !retentionSel) return; // Exit if DOM not present

        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function setProgress(pct, text) {
            progressDiv.classList.remove('hidden');
            progressBar.style.width = pct + '%';
            progressPct.textContent = pct + '%';
            progressText.textContent = text;
        }

        function showResult(success, title, subtitle) {
            resultDiv.classList.remove('hidden');
            resultInner.className = `p-4 flex items-center gap-3 ${success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`;
            resultIcon.textContent = success ? 'check_circle' : 'error';
            resultIcon.className = `material-symbols-outlined text-2xl ${success ? 'text-emerald-500' : 'text-rose-500'}`;
            resultTitle.textContent = title;
            resultTitle.className = `font-bold text-sm ${success ? 'text-emerald-700' : 'text-rose-700'}`;
            resultSubtitle.textContent = subtitle;
        }

        async function fetchStats() {
            const days = retentionSel.value;
            try {
                const res = await fetch(`api/backup/maintenance.php?action=stats&days=${days}`, { cache: 'no-store' });
                const data = await res.json();

                dbSizeEl.textContent = formatBytes(data.db_size_bytes || 0);
                totalRowsEl.textContent = (data.total_rows || 0).toLocaleString();
                cleanableEl.textContent = (data.total_cleanable || 0).toLocaleString() + ' rows';

                // Breakdown
                const cleanableTables = (data.tables || []).filter(t => t.cleanable > 0);
                if (cleanableTables.length > 0) {
                    breakdownList.innerHTML = cleanableTables.map(t => `
                        <div class="bg-rose-50/80 border border-rose-100 rounded-lg px-3 py-2">
                            <p class="text-xs font-bold text-gray-700">${t.label || t.table}</p>
                            <p class="text-xs text-rose-600 font-medium">${t.cleanable.toLocaleString()} old rows</p>
                        </div>
                    `).join('');
                    breakdownDiv.classList.remove('hidden');
                } else {
                    breakdownDiv.classList.add('hidden');
                }
            } catch (_) {
                // Silently ignore
            }
        }

        // Fetch stats on load and when retention changes
        fetchStats();
        retentionSel.addEventListener('change', fetchStats);

        // Cleanup
        cleanupBtn.addEventListener('click', async () => {
            const days = retentionSel.value;
            const cleanableText = cleanableEl.textContent;

            if (!confirm(`Delete Activity Log entries older than ${days} days?\n\nThis will remove ${cleanableText}. This cannot be undone.`)) return;

            cleanupBtn.disabled = true;
            optimizeBtn.disabled = true;
            resultDiv.classList.add('hidden');
            setProgress(20, 'Deleting old records…');

            try {
                setProgress(50, 'Cleaning up tables…');
                const res = await fetch(`api/backup/maintenance.php?action=cleanup&days=${days}`, {
                    method: 'POST',
                });
                const data = await res.json();
                setProgress(100, 'Cleanup complete!');

                const details = Object.entries(data.per_table || {})
                    .map(([t, n]) => `${t}: ${n}`)
                    .join(', ');

                showResult(data.success !== false,
                    `Deleted ${(data.total_deleted || 0).toLocaleString()} old records`,
                    details || 'No records to clean up.'
                );

                showToast(`Cleanup complete — ${(data.total_deleted || 0).toLocaleString()} records removed.`, 'success');

                // Refresh stats
                setTimeout(fetchStats, 500);
            } catch (err) {
                setProgress(100, 'Error');
                showResult(false, 'Cleanup failed', err.message);
                showToast('Cleanup failed: ' + err.message, 'error');
            }

            setTimeout(() => progressDiv.classList.add('hidden'), 2000);
            cleanupBtn.disabled = false;
            optimizeBtn.disabled = false;
        });

        // Optimize
        optimizeBtn.addEventListener('click', async () => {
            optimizeBtn.disabled = true;
            cleanupBtn.disabled = true;
            resultDiv.classList.add('hidden');
            setProgress(20, 'Optimizing tables…');

            try {
                setProgress(50, 'Running OPTIMIZE TABLE…');
                const res = await fetch('api/backup/maintenance.php?action=optimize', {
                    method: 'POST',
                });
                const data = await res.json();
                setProgress(100, 'Optimization complete!');

                const count = Object.keys(data.tables || {}).length;
                showResult(data.success !== false,
                    `Optimized ${count} tables`,
                    'Disk space reclaimed and indexes rebuilt.'
                );
                showToast(`${count} tables optimized ✓`, 'success');

                setTimeout(fetchStats, 500);
            } catch (err) {
                setProgress(100, 'Error');
                showResult(false, 'Optimization failed', err.message);
                showToast('Optimization failed: ' + err.message, 'error');
            }

            setTimeout(() => progressDiv.classList.add('hidden'), 2000);
            optimizeBtn.disabled = false;
            cleanupBtn.disabled = false;
        });
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
        initMaintenance();
    }

    init();

})();
