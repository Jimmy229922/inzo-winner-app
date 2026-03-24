/**
 * db.js
 * إدارة قاعدة البيانات المحلية IndexedDB لحفظ الفائزين مؤقتاً كنسخة احتياطية.
 */

const DB_NAME = 'WinnerRouletteDB';
const DB_VERSION = 1;
const STORE_NAME = 'stagedWinners';

let dbInstance = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // استخدام id كمفتاح أساسي فريد
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

export async function saveWinnerLocal(winnerObj) {
    if (!winnerObj || !winnerObj.id) return;
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(winnerObj);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving local winner', error);
    }
}

export async function getLocalWinners() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting local winners', error);
        return [];
    }
}

export async function clearLocalWinners() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error clearing local winners', error);
    }
}
