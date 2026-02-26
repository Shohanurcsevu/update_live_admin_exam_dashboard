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
    const FILE_NAME = 'rethink-latest-backup.json';
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
        lastRunAt: null,            // ISO string
        runCount: 0,
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
     * Silently replaces any previous content.
     */
    async function writeToFolder(jsonText) {
        if (!_dirHandle) throw new Error('No folder selected.');
        const fileHandle = await _dirHandle.getFileHandle(FILE_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(jsonText);
        await writable.close();
    }

    /**
     * Fallback: trigger a regular browser download (no folder access).
     */
    function triggerFallbackDownload(jsonText) {
        const blob = new Blob([jsonText], { type: 'application/json' });
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
        if (_running) return { success: false, message: 'Backup already in progress.' };
        _running = true;
        const result = { success: false, usedFallback: false, message: '' };

        try {
            // 1. Fetch from server
            const response = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' });
            if (!response.ok) throw new Error(`Server error ${response.status}`);

            const jsonText = await response.text();
            const recordCount = parseInt(response.headers.get('X-Backup-Records') || '0', 10);
            const now = new Date().toISOString();

            // 2a. Write to cloud-synced folder (File System Access API)
            if (_dirHandle) {
                try {
                    await writeToFolder(jsonText);
                } catch (writeErr) {
                    // Handle revoked permission gracefully
                    console.warn('[AutoBackup] Could not write to folder:', writeErr.message);
                    _dirHandle = null;
                    _settings.folderName = null;
                    persistSettings();
                    throw new Error('Folder access was revoked. Please re-select your backup folder.');
                }
            } else if (supportsFileSystemAccess() && _settings.folderName) {
                // Handle lost — re-pick is needed
                result.usedFallback = true;
                triggerFallbackDownload(jsonText);
            } else {
                // No folder picked at all, or API unsupported
                result.usedFallback = !_settings.folderName;
                if (!_dirHandle) {
                    triggerFallbackDownload(jsonText);
                }
            }

            // 2b. Save to IndexedDB (always, regardless of folder)
            const blob = new Blob([jsonText], { type: 'application/json' });
            await idbAdd(blob, {
                savedAt: now,
                sizeBytes: blob.size,
                recordCount: recordCount,
                folderUsed: !!_dirHandle || (_dirHandle === null && !!_settings.folderName && !result.usedFallback),
            });
            await rotateHistory();

            // 3. Update metadata
            _settings.lastRunAt = now;
            _settings.runCount = (_settings.runCount || 0) + 1;
            persistSettings();

            result.success = true;
            result.message = 'Backup saved successfully.';

        } catch (err) {
            result.success = false;
            result.message = err.message || 'Unknown error';
            console.error('[AutoBackup] Error:', err);
        }

        _running = false;

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

    // ─── Public API ───────────────────────────────────────────────────────────

    async function initAutoBackup() {
        loadSettings();
        // Try to silently restore the saved folder handle from IndexedDB
        if (supportsFileSystemAccess()) {
            await restoreHandle();
        }
        if (_settings.enabled) startInterval();
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
