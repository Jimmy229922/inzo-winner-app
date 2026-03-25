/**
 * state.js
 * Shared state for the modular winner roulette page.
 */

export const state = {
    // Core data
    entries: [], // { id, name, account }
    winners: [], // winner metadata (blobs are persisted in IndexedDB)

    // Wheel / animation
    spinning: false,
    angle: 0,
    startAngle: 0,
    targetAngle: 0,
    spinStart: 0,
    spinDuration: 4500,
    spinSnapshot: null,
    chosenIndex: null,
    pulseTime: 0,

    // Behavior
    excludeWinner: true,
    predeterminedWinnerId: '',

    // Recording
    mediaRecorder: null,
    recordedChunks: [],
    recordingMimeType: 'video/webm',
    pendingVideoBlob: null
};

export const config = {
    LS_KEY: 'winnerRouletteModularSession.v1',
    DB_NAME: 'WinnerRouletteDB',
    DB_VERSION: 3,
    VIDEO_STORE: 'videos',
    IMAGE_STORE: 'images',
    WINNERS_STORE: 'winners',
    RECORD_OVERLAY_MS: 1800
};
