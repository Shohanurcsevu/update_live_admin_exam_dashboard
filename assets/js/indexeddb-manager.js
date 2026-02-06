/**
 * IndexedDB Manager
 * 
 * Handles local storage for subjects, lessons, topics, and exams.
 */

const DB_NAME = 'ExamOfflineDB';
const DB_VERSION = 2;

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

                // Create Object Stores (Initial V1)
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

                // New Stores for V2 (Phase 2)
                if (!db.objectStoreNames.contains('questions')) {
                    const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
                    questionStore.createIndex('exam_id', 'exam_id', { unique: false });
                    questionStore.createIndex('updated_at', 'updated_at', { unique: false });
                }

                if (!db.objectStoreNames.contains('offline_attempts')) {
                    const attemptStore = db.createObjectStore('offline_attempts', { keyPath: 'id' });
                    attemptStore.createIndex('exam_id', 'exam_id', { unique: false });
                    attemptStore.createIndex('status', 'status', { unique: false });
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
            const storeNames = ['subjects', 'lessons', 'topics', 'exams', 'questions', 'offline_attempts'];
            const tx = this.db.transaction(storeNames, 'readwrite');

            for (const [table, records] of Object.entries(changes)) {
                if (!storeNames.includes(table)) continue;

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
                        if (record.exam_id) record.exam_id = parseInt(record.exam_id);

                        store.put(record);
                    }
                });
            }

            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Efficiently store multiple records in a single transaction
     */
    async bulkPut(storeName, records) {
        if (!this.db) await this.init();
        if (!records || records.length === 0) return;

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            records.forEach(record => {
                // Ensure ID is number
                if (record.id) record.id = parseInt(record.id);
                if (record.subject_id) record.subject_id = parseInt(record.subject_id);
                if (record.lesson_id) record.lesson_id = parseInt(record.lesson_id);
                if (record.topic_id) record.topic_id = parseInt(record.topic_id);
                if (record.exam_id) record.exam_id = parseInt(record.exam_id);

                store.put(record);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Check if an exam has questions downloaded
     */
    async isExamDownloaded(examId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('questions', 'readonly');
            const store = tx.objectStore('questions');
            const index = store.index('exam_id');
            const request = index.getKey(parseInt(examId));
            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(request.error);
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
        if (value === null || value === undefined) return [];
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
     * Get a single record by ID
     */
    async getById(storeName, id) {
        if (id === null || id === undefined) return null;
        const numericId = parseInt(id);
        if (isNaN(numericId)) return null;

        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(numericId);
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

    /**
     * Get Questions by Exam ID
     */
    async getQuestionsByExam(examId) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('questions', 'readonly');
            const store = tx.objectStore('questions');
            const index = store.index('exam_id');
            const request = index.getAll(parseInt(examId));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Create or Update an Offline Attempt
     */
    async saveAttempt(attempt) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_attempts', 'readwrite');
            const store = tx.objectStore('offline_attempts');
            store.put(attempt);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Get Attempt by ID
     */
    async getAttempt(attemptId) {
        if (!attemptId) return null;
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_attempts', 'readonly');
            const store = tx.objectStore('offline_attempts');
            const request = store.get(attemptId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get Pending Sync Attempts
     */
    async getPendingAttempts() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_attempts', 'readonly');
            const store = tx.objectStore('offline_attempts');
            const index = store.index('status');
            const request = index.getAll('COMPLETED');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get the most recently saved IN_PROGRESS attempt
     */
    async getLatestInProgressAttempt() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_attempts', 'readonly');
            const store = tx.objectStore('offline_attempts');
            const request = store.openCursor(null, 'prev'); // Most recent first
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.status === 'IN_PROGRESS') {
                        resolve(cursor.value);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get random questions for Daily 10 quiz
     */
    async getRandomQuestions(limit = 10) {
        console.log("IDBManager: getRandomQuestions requested", limit);
        if (!this.db) await this.init();

        try {
            const allQuestions = await this.getAll('questions');
            console.log("IDBManager: Total questions available:", allQuestions?.length || 0);

            if (!allQuestions || allQuestions.length === 0) return [];

            // Shuffle and pick
            const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
            const result = shuffled.slice(0, limit);
            console.log("IDBManager: Random selection complete", result.length);
            return result;
        } catch (error) {
            console.error("IDBManager: Error getting random questions", error);
            return [];
        }
    }
}

const idbManager = new IndexedDBManager();
