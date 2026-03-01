/**
 * Auto-Backup Manager — Rethink Admin
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs silently in the background. Every N minutes it:
 *   1. Fetches a fresh full-DB export from api/backup/auto-backup.php
 *   2. Overwrites a single file  "rethink-latest-backup.json"  in the user's
 *      chosen cloud-synced folder (OneDrive / Google Drive / Dropbox) using the
 *      File System Access API (Chrome/Edge).  Falls back to a browser download
 *      on unsupported browsers.
 *   3. Saves a timestamped snapshot to IndexedDB (last 5 kept) for quick restore.
 *   4. Dispatches window event 'autoBackupComplete' so the UI can refresh.
 *
 * Public API (on window.autoBackupManager):
 *   initAutoBackup()          — start the interval (call once from main.js)
 *   runBackupNow()            — force an immediate backup, returns Promise
 *   pickFolder()              — open OS folder picker (File System Access API)
 *   getSettings()             — return current settings object
 *   saveSettings(patch)       — merge & persist settings
 *   getHistory()              — return Promise<array> of IndexedDB snapshots
 *   deleteHistory(id)         — remove one IndexedDB entry
 *   restoreFromHistory(id)    — get Blob from IndexedDB for restore
 */
(function () {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────

    const ENDPOINT = 'api/backup/auto-backup.php';
    const FILE_NAME = 'rethink-latest-backup.json.gz';
    const DB_NAME = 'rethinkAutoBackup';
    const DB_VERSION = 2;          // bumped: added handles store
    const STORE_NAME = 'snapshots';
    const HANDLE_STORE = 'handles'; // persists FileSystemDirectoryHandle
    const MAX_HISTORY = 5;
    const LS_SETTINGS = 'ab_settings';

    const DEFAULT_SETTINGS = {
        enabled: false,           // off until user opts-in
        intervalMs: 30 * 60 * 1000, // 30 minutes default
        folderName: null,            // display name of chosen folder
        lastRunAt: null,            // ISO string of last SUCCESS
        lastAttemptAt: null,        // ISO string of last TRY
        runCount: 0,
        lastError: null,           // last error message if any
    };

    // ─── State ────────────────────────────────────────────────────────────────

    let _settings = Object.assign({}, DEFAULT_SETTINGS);
    let _dirHandle = null;   // FileSystemDirectoryHandle (File System Access API)
    let _intervalId = null;
    let _idb = null;   // IDBDatabase
    let _running = false;  // prevent concurrent runs

    // ─── Settings (localStorage) ──────────────────────────────────────────────

    function loadSettings() {
        try {
            const raw = localStorage.getItem(LS_SETTINGS);
            if (raw) _settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
        } catch (_) { /* ignore */ }
    }

    function persistSettings() {
        try {
            localStorage.setItem(LS_SETTINGS, JSON.stringify(_settings));
        } catch (_) { /* ignore */ }
    }

    // ─── IndexedDB ────────────────────────────────────────────────────────────

    function openIdb() {
        return new Promise((resolve, reject) => {
            if (_idb) { resolve(_idb); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('savedAt', 'savedAt', { unique: false });
                }
                // v2: store for persisting the FileSystemDirectoryHandle
                if (!db.objectStoreNames.contains(HANDLE_STORE)) {
                    db.createObjectStore(HANDLE_STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => { _idb = e.target.result; resolve(_idb); };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Handle Persistence ───────────────────────────────────────────────────

    async function persistHandle(handle) {
        try {
            const db = await openIdb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(HANDLE_STORE, 'readwrite');
                tx.objectStore(HANDLE_STORE).put({ key: 'dirHandle', handle });
                tx.oncomplete = resolve;
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (e) { console.warn('[AutoBackup] Could not persist handle:', e); }
    }

    async function restoreHandle() {
        try {
            const db = await openIdb();
            const entry = await new Promise((resolve, reject) => {
                const tx = db.transaction(HANDLE_STORE, 'readonly');
                const req = tx.objectStore(HANDLE_STORE).get('dirHandle');
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => reject(e.target.error);
            });
            if (!entry) return false;

            const handle = entry.handle;

            // Check if permission is already granted (no user gesture needed)
            let perm = await handle.queryPermission({ mode: 'readwrite' });

            if (perm === 'granted') {
                _dirHandle = handle;
                _settings.folderName = handle.name;
                persistSettings();
                console.log('[AutoBackup] Folder handle restored silently:', handle.name);
                return true;
            }

            // Permission needs a user gesture — fire an event so the UI can show a button
            if (perm === 'prompt') {
                window.dispatchEvent(new CustomEvent('autoBackupNeedsFolderAuth', {
                    detail: { handle, folderName: handle.name }
                }));
            }

            return false;
        } catch (e) {
            console.warn('[AutoBackup] Could not restore handle:', e);
            return false;
        }
    }

    async function idbGetAll() {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.index('savedAt').getAll();
            req.onsuccess = (e) => resolve(e.target.result.reverse()); // newest first
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbAdd(blob, meta) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.add({ blob, ...meta });
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbDelete(id) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbGet(id) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function rotateHistory() {
        const all = await idbGetAll();
        // all is sorted newest-first; delete entries beyond MAX_HISTORY
        const toDelete = all.slice(MAX_HISTORY);
        for (const entry of toDelete) {
            await idbDelete(entry.id);
        }
    }

    // ─── Folder Handle (File System Access API) ───────────────────────────────

    function supportsFileSystemAccess() {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Opens OS folder picker and persists the handle for the session.
     * The handle cannot be fully serialised to localStorage across sessions,
     * so the user re-picks on next browser session (once per session is fine).
     * Returns { success, folderName }.
     */
    async function pickFolder() {
        if (!supportsFileSystemAccess()) {
            return { success: false, error: 'File System Access API not supported in this browser.' };
        }
        try {
            _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
            _settings.folderName = _dirHandle.name;
            persistSettings();
            await persistHandle(_dirHandle); // save for next session
            return { success: true, folderName: _dirHandle.name };
        } catch (err) {
            if (err.name === 'AbortError') return { success: false, error: 'Cancelled.' };
            return { success: false, error: err.message };
        }
    }

    /**
     * Write (overwrite) a single file in the chosen folder.
     * Silently replaces any previous content. Accepts ArrayBuffer or Blob.
     */
    async function writeToFolder(data) {
        if (!_dirHandle) throw new Error('No folder selected.');
        const fileHandle = await _dirHandle.getFileHandle(FILE_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
    }

    /**
     * Fallback: trigger a regular browser download (no folder access).
     */
    function triggerFallbackDownload(data) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/gzip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = FILE_NAME;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ─── Core Backup Logic ────────────────────────────────────────────────────

    async function runBackupNow() {
        const result = { success: false, usedFallback: false, message: '' };
        if (_running) {
            result.message = 'Backup already in progress.';
            return result;
        }
        _running = true;
        _settings.lastAttemptAt = new Date().toISOString();
        _settings.lastError = null; // Clear any previous error at start of attempt
        persistSettings();

        // Notify UI that a backup has started (sync or periodic)
        window.dispatchEvent(new CustomEvent('autoBackupStarted'));



        try {
            // 1. Fetch metadata (schema + row counts, no data)
            const metaRes = await fetch('api/backup/export-chunk.php?action=meta', { cache: 'no-store' });
            if (!metaRes.ok) throw new Error(`Server error ${metaRes.status}`);
            const meta = await metaRes.json();
            if (meta.error) throw new Error(meta.error);

            const tables = meta.tables || [];
            const backup = {
                backup_version: meta.backup_version || '2.0',
                app: meta.app || 'rethink-admin',
                exported_at: meta.exported_at,
                backup_type: 'auto',
                db_name: meta.db_name,
                db_charset: meta.db_charset,
                db_collation: meta.db_collation,
                table_counts: meta.table_counts || {},
                schema: meta.schema || {},
                data: {},
            };

            const recordCount = meta.total_records || 0;

            // 2. Fetch each table's data one-by-one
            for (const tbl of tables) {
                const dataRes = await fetch(`api/backup/export-chunk.php?action=data&table=${encodeURIComponent(tbl)}`, { cache: 'no-store' });
                if (!dataRes.ok) throw new Error(`Failed to fetch table "${tbl}": ${dataRes.status}`);
                const dataJson = await dataRes.json();
                if (dataJson.error) throw new Error(dataJson.error);
                backup.data[tbl] = dataJson.rows || [];
            }

            // 3. Compute SHA-256 checksum of data section
            // Optimization: avoid another huge string copy by using a Blob/ArrayBuffer
            const dataBlob = new Blob([JSON.stringify(backup.data)], { type: 'application/json' });
            const hashBuffer = await crypto.subtle.digest('SHA-256', await dataBlob.arrayBuffer());
            backup.checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            // 4. Compress with CompressionStream (client-side gzip)
            const jsonText = JSON.stringify(backup);
            let compressedBlob;

            if (typeof CompressionStream !== 'undefined') {
                const textBlob = new Blob([jsonText], { type: 'application/json' });
                const cs = new CompressionStream('gzip');
                const compressed = textBlob.stream().pipeThrough(cs);
                compressedBlob = await new Response(compressed).blob();
            } else {
                // Fallback: store uncompressed
                compressedBlob = new Blob([jsonText], { type: 'application/json' });
            }

            const now = new Date().toISOString();

            // 4a. Write compressed file to cloud-synced folder (File System Access API)
            if (_dirHandle) {
                try {
                    await writeToFolder(compressedBlob);
                } catch (writeErr) {
                    console.warn('[AutoBackup] Could not write to folder:', writeErr.message);
                    _dirHandle = null;
                    _settings.folderName = null;
                    persistSettings();
                    throw new Error('Folder access was revoked. Please re-select your backup folder.');
                }
            } else if (supportsFileSystemAccess() && _settings.folderName) {
                result.usedFallback = true;
                triggerFallbackDownload(compressedBlob);
            } else {
                result.usedFallback = !_settings.folderName;
                if (!_dirHandle) {
                    triggerFallbackDownload(compressedBlob);
                }
            }

            // 4b. Save compressed blob to IndexedDB
            await idbAdd(compressedBlob, {
                savedAt: now,
                sizeBytes: compressedBlob.size,
                recordCount: recordCount,
                folderUsed: !!_dirHandle || (_dirHandle === null && !!_settings.folderName && !result.usedFallback),
            });
            await rotateHistory();

            // 5. Update metadata
            _settings.lastRunAt = now;
            _settings.runCount = (_settings.runCount || 0) + 1;
            _settings.lastError = null; // Clear any previous error on success
            persistSettings();

            result.success = true;
            result.message = 'Backup saved successfully.';

            // Reset pending changes flag
            window.needsBackup = false;
            localStorage.setItem('needsBackup', 'false');


        } catch (err) {
            result.success = false;
            result.message = err.message || 'Unknown error';
            _settings.lastError = result.message;
            persistSettings();
            console.error('[AutoBackup] Error:', err);
        } finally {
            _running = false; // always unlock, even if catch itself throws
        }

        // Notify UI
        window.dispatchEvent(new CustomEvent('autoBackupComplete', { detail: result }));

        return result;
    }

    // ─── Interval Management ──────────────────────────────────────────────────

    function startInterval() {
        stopInterval();
        if (!_settings.enabled) return;
        runBackupNow(); // run immediately on enable, don't wait for first interval
        _intervalId = setInterval(runBackupNow, _settings.intervalMs);
    }

    function stopInterval() {
        if (_intervalId !== null) {
            clearInterval(_intervalId);
            _intervalId = null;
        }
    }

    // ─── Periodic Background Sync Registration ────────────────────────────────
    // Registers the 'rethink-auto-backup' tag so Chrome can fire the backup
    // via the service worker even when the user is on another tab.

    async function registerPeriodicSync() {
        try {
            if (!('serviceWorker' in navigator) || !('periodicSync' in (await navigator.serviceWorker.ready))) return;
            const reg = await navigator.serviceWorker.ready;
            const tags = await reg.periodicSync.getTags();
            if (!_settings.enabled) {
                // Unregister if disabled
                if (tags.includes('rethink-auto-backup')) {
                    await reg.periodicSync.unregister('rethink-auto-backup');
                    console.log('[AutoBackup] Periodic sync unregistered.');
                }
                return;
            }
            await reg.periodicSync.register('rethink-auto-backup', {
                minInterval: _settings.intervalMs,
            });
            console.log('[AutoBackup] Periodic sync registered, min interval:', _settings.intervalMs + 'ms');
        } catch (e) {
            // Not supported (Firefox, Safari, or permission denied) — fall through to visibilitychange
            console.log('[AutoBackup] Periodic Background Sync not available:', e.message);
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async function initAutoBackup() {
        loadSettings();
        // Try to silently restore the saved folder handle from IndexedDB
        if (supportsFileSystemAccess()) {
            await restoreHandle();
        }
        if (_settings.enabled) startInterval();

        // When the tab becomes visible again, check if a backup is overdue.
        // Browsers throttle/kill setInterval in background tabs, so the interval
        // may have missed several ticks. Instead of relying on the interval alone,
        // compare elapsed time vs the configured period.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') {
                // Silent backup on hide if there are pending changes
                if (window.needsBackup && _settings.enabled && !_running) {
                    console.log('[AutoBackup] Tab hidden with pending changes — attempting silent backup.');
                    runBackupNow();
                }
                return;
            }

            if (!_settings.enabled) return;


            const lastRun = _settings.lastRunAt ? new Date(_settings.lastRunAt).getTime() : 0;
            const elapsed = Date.now() - lastRun;
            const overdue = elapsed > _settings.intervalMs;

            if (overdue) {
                // Missed one or more scheduled runs — fire immediately then reset interval
                console.log(`[AutoBackup] Overdue by ${Math.round(elapsed / 60000)}m — running now.`);
                startInterval(); // stops old interval, runs immediately, starts fresh
            } else if (_intervalId === null) {
                // Interval was cleared but not overdue yet — just restart it
                startInterval();
            }
        });

        // ── Periodic Background Sync (Chrome 80+ with PWA installed) ──────────
        // This is the only true background scheduler. The SW fires the
        // 'rethink-auto-backup' tag and messages this page to run the backup.
        await registerPeriodicSync();

        // Listen for SW messages (triggered by periodicsync in background)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'RUN_AUTO_BACKUP' && _settings.enabled) {
                    console.log('[AutoBackup] SW periodic sync fired — running backup now.');
                    runBackupNow();
                }
            });
        }
    }

    function getSettings() {
        return Object.assign({}, _settings);
    }

    function saveSettings(patch) {
        const wasEnabled = _settings.enabled;
        const wasInterval = _settings.intervalMs;
        Object.assign(_settings, patch);
        persistSettings();

        // Restart interval if enabled changed or interval changed
        if (_settings.enabled !== wasEnabled || _settings.intervalMs !== wasInterval) {
            if (_settings.enabled) startInterval();
            else stopInterval();
            registerPeriodicSync(); // re-register with new interval or unregister
        }
    }

    function getHistory() {
        return idbGetAll().then(rows => rows.map(r => ({
            id: r.id,
            savedAt: r.savedAt,
            sizeBytes: r.sizeBytes,
            recordCount: r.recordCount,
            folderUsed: r.folderUsed,
        })));
    }

    async function restoreFromHistory(id) {
        const entry = await idbGet(id);
        if (!entry) throw new Error('Snapshot not found in history.');
        return entry.blob;
    }

    function deleteHistory(id) {
        return idbDelete(id);
    }

    /**
     * Called by the global re-auth toast after the user clicks to grant permission.
     * Accepts an already-authorized handle and activates it immediately.
     */
    function _restoreHandleFromEvent(handle) {
        _dirHandle = handle;
        _settings.folderName = handle.name;
        persistSettings();
        persistHandle(handle); // keep it saved for next session too
        console.log('[AutoBackup] Handle re-authorized and restored:', handle.name);
        // Dispatch update so any open Backup UI refreshes
        window.dispatchEvent(new CustomEvent('autoBackupComplete', {
            detail: { success: true, folderRestored: true, message: 'Folder re-authorized.' }
        }));
    }

    // ─── Expose ───────────────────────────────────────────────────────────────

    window.autoBackupManager = {
        initAutoBackup,
        runBackupNow,
        isRunning: () => _running,
        pickFolder,
        getSettings,
        saveSettings,
        getHistory,
        restoreFromHistory,
        deleteHistory,
        supportsFileSystemAccess,
        _restoreHandleFromEvent,
    };

})();
