/**
 * IndexedDB Manager
 * 
 * Handles local storage for subjects, lessons, topics, and exams.
 */

const DB_NAME = 'ExamOfflineDB';
const DB_VERSION = 1;

class IndexedDBManager {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create Object Stores
                if (!db.objectStoreNames.contains('subjects')) {
                    db.createObjectStore('subjects', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('lessons')) {
                    const lessonStore = db.createObjectStore('lessons', { keyPath: 'id' });
                    lessonStore.createIndex('subject_id', 'subject_id', { unique: false });
                }
                if (!db.objectStoreNames.contains('topics')) {
                    const topicStore = db.createObjectStore('topics', { keyPath: 'id' });
                    topicStore.createIndex('lesson_id', 'lesson_id', { unique: false });
                }
                if (!db.objectStoreNames.contains('exams')) {
                    const examStore = db.createObjectStore('exams', { keyPath: 'id' });
                    examStore.createIndex('subject_id', 'subject_id', { unique: false });
                    examStore.createIndex('lesson_id', 'lesson_id', { unique: false });
                    examStore.createIndex('topic_id', 'topic_id', { unique: false });
                    examStore.createIndex('updated_at', 'updated_at', { unique: false });
                }
                
                // Store for sync metadata
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Perform a transaction on multiple stores
     */
    async performSyncTransaction(changes) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['subjects', 'lessons', 'topics', 'exams'], 'readwrite');
            
            for (const [table, records] of Object.entries(changes)) {
                const store = tx.objectStore(table);
                records.forEach(record => {
                    if (record.is_deleted == 1) {
                        store.delete(record.id);
                    } else {
                        // Cast numeric strings to numbers for IndexedDB keys if necessary
                        record.id = parseInt(record.id);
                        if (record.subject_id) record.subject_id = parseInt(record.subject_id);
                        if (record.lesson_id) record.lesson_id = parseInt(record.lesson_id);
                        if (record.topic_id) record.topic_id = parseInt(record.topic_id);
                        
                        store.put(record);
                    }
                });
            }

            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Get all records from a store
     */
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Query by index
     */
    async getByIndex(storeName, indexName, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get Sync Metadata
     */
    async getMetadata(key) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('metadata', 'readonly');
            const store = tx.objectStore('metadata');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Set Sync Metadata
     */
    async setMetadata(key, value) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('metadata', 'readwrite');
            const store = tx.objectStore('metadata');
            store.put({ key, value });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

const idbManager = new IndexedDBManager();
