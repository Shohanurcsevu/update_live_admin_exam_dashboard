/**
 * Sync Manager
 * 
 * Coordinates data synchronization between the server and IndexedDB.
 */

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.onSyncComplete = null;
        this.onSyncProgress = null;
        this.onSyncError = null;
    }

    /**
     * Start the sync process
     */
    async sync() {
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;
        console.log('Sync started...');

        try {
            // 1. Sync completed attempts first
            await this.syncAttempts();

            // 2. Get last sync time from IndexedDB for metadata sync
            const lastSync = await idbManager.getMetadata('last_server_sync');

            // Fetch deltas from server
            const url = `api/offline/sync.php${lastSync ? '?last_sync=' + encodeURIComponent(lastSync) : ''}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                // Apply changes to IndexedDB in a single transaction
                await idbManager.performSyncTransaction(result.changes);

                // Update last sync time
                await idbManager.setMetadata('last_server_sync', result.server_time);

                console.log('Sync complete at', result.server_time);
                if (this.onSyncComplete) this.onSyncComplete(result.server_time);
            } else {
                throw new Error(result.message || 'Sync failed on server');
            }

        } catch (error) {
            console.error('Sync failed:', error);
            if (this.onSyncError) this.onSyncError(error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Sync completed offline attempts to server
     */
    async syncAttempts() {
        if (!navigator.onLine) return;

        const pending = await idbManager.getPendingAttempts();
        if (pending.length === 0) return;

        console.log(`Syncing ${pending.length} pending attempts...`);

        for (const attempt of pending) {
            await this.syncSingleAttempt(attempt);
        }
    }

    /**
     * Sync a single attempt and return the result
     */
    async syncSingleAttempt(attempt) {
        if (!navigator.onLine) return { success: false, message: 'Offline' };

        try {
            const response = await fetch('api/offline/submit-attempt.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attempt_uuid: attempt.id,
                    exam_id: attempt.exam_id,
                    answers: attempt.answers,
                    start_time: attempt.start_time,
                    end_time: attempt.end_time,
                    duration_used: attempt.duration_used,
                    checksum: attempt.checksum
                })
            });

            const result = await response.json();
            if (result.success || result.already_synced) {
                // Update local status to SYNCED
                attempt.status = 'SYNCED';
                if (result.data) {
                    attempt.score = result.data.score;
                    attempt.score_with_negative = result.data.score_with_negative;
                    attempt.server_attempt_id = result.data.attempt_id;
                }
                await idbManager.saveAttempt(attempt);
                console.log(`Attempt ${attempt.id} synced successfully.`);
                return result;
            } else {
                console.error(`Failed to sync attempt ${attempt.id}:`, result.message);
                return result;
            }
        } catch (e) {
            console.error(`Sync error for attempt ${attempt.id}:`, e);
            return { success: false, message: e.message };
        }
    }

    /**
     * Initial sync check and auto-sync setup
     */
    initAutoSync() {
        // Initial sync on load
        this.sync();

        // Auto-sync every 10 minutes
        setInterval(() => {
            this.sync();
        }, 10 * 60 * 1000);

        // Sync when coming back online
        window.addEventListener('online', () => {
            console.log('Back online, triggering sync...');
            this.sync();
        });
    }
}

const syncManager = new SyncManager();
