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
            // Get last sync time from IndexedDB
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
