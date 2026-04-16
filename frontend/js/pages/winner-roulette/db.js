/**
 * db.js
 * IndexedDB helpers for staged winners and media blobs.
 */

import { config } from './state.js';

let dbInstance = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = window.indexedDB.open(config.DB_NAME, config.DB_VERSION);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(config.VIDEO_STORE)) {
                db.createObjectStore(config.VIDEO_STORE);
            }

            if (!db.objectStoreNames.contains(config.IMAGE_STORE)) {
                db.createObjectStore(config.IMAGE_STORE);
            }

            if (!db.objectStoreNames.contains(config.WINNERS_STORE)) {
                db.createObjectStore(config.WINNERS_STORE, { keyPath: 'id' });
            }
        };
    });
}

export async function saveVideoToDB(id, blob) {
    if (!id || !blob) return;
    await putInStore(config.VIDEO_STORE, id, blob);
}

export async function getVideoFromDB(id) {
    if (!id) return null;
    return getFromStore(config.VIDEO_STORE, id);
}

export async function deleteVideoFromDB(id) {
    if (!id) return;
    await deleteFromStore(config.VIDEO_STORE, id);
}

export async function saveImageToDB(id, blob) {
    if (!id || !blob) return;
    await putInStore(config.IMAGE_STORE, id, blob);
}

export async function getImageFromDB(id) {
    if (!id) return null;
    return getFromStore(config.IMAGE_STORE, id);
}

export async function deleteImageFromDB(id) {
    if (!id) return;
    await deleteFromStore(config.IMAGE_STORE, id);
}

export async function saveWinnerLocal(winnerMeta) {
    if (!winnerMeta || !winnerMeta.id) return;
    await putWinnerMeta(winnerMeta);
}

export async function getLocalWinners() {
    return listStore(config.WINNERS_STORE);
}

export async function clearLocalWinners() {
    await clearStore(config.WINNERS_STORE);
}

export async function removeWinnerAssets(id) {
    if (!id) return;
    await Promise.allSettled([
        deleteVideoFromDB(id),
        deleteImageFromDB(id),
        deleteFromStore(config.WINNERS_STORE, id)
    ]);
}

async function putWinnerMeta(winnerMeta) {
    const cleanMeta = {
        id: winnerMeta.id,
        _id: winnerMeta._id || null,
        name: winnerMeta.name || '',
        account: winnerMeta.account || '',
        email: winnerMeta.email || '',
        nationalId: winnerMeta.nationalId || '',
        competitionId: winnerMeta.competitionId || null,
        orderNumber: Number(winnerMeta.orderNumber || 0) || null,
        prizeType: winnerMeta.prizeType || 'trading',
        prizeValue: Number(winnerMeta.prizeValue || 0),
        includeWarnMeet: !!winnerMeta.includeWarnMeet,
        includeWarnPrev: !!winnerMeta.includeWarnPrev,
        timestamp: winnerMeta.timestamp || new Date().toISOString(),
        recordingMimeType: winnerMeta.recordingMimeType || null,
        hasVideo: !!winnerMeta.hasVideo,
        hasIdImage: !!winnerMeta.hasIdImage,
        localIdImageName: winnerMeta.localIdImageName || null,
        localAssetKey: winnerMeta.localAssetKey || winnerMeta.id
    };

    await withStore(config.WINNERS_STORE, 'readwrite', (store) => store.put(cleanMeta));
}

async function putInStore(storeName, key, value) {
    await withStore(storeName, 'readwrite', (store) => store.put(value, key));
}

async function getFromStore(storeName, key) {
    return withStore(storeName, 'readonly', (store) => store.get(key));
}

async function deleteFromStore(storeName, key) {
    await withStore(storeName, 'readwrite', (store) => store.delete(key));
}

async function clearStore(storeName) {
    await withStore(storeName, 'readwrite', (store) => store.clear());
}

async function listStore(storeName) {
    return withStore(storeName, 'readonly', (store) => store.getAll());
}

async function withStore(storeName, mode, requestFactory) {
    const db = await initDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = requestFactory(store);

        if (request && typeof request.onsuccess !== 'undefined') {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            return;
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
