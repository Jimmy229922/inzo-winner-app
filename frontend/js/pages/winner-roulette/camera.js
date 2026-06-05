/**
 * camera.js
 * Canvas recording utilities for winner confirmation videos.
 */

import { state } from './state.js';

const MIME_TYPE = 'video/mp4';

export function startRecording() {
    try {
        const canvas = document.getElementById('winner-roulette-wheel');
        if (!canvas || typeof canvas.captureStream !== 'function') return false;
        if (typeof window.MediaRecorder === 'undefined') return false;

        const stream = canvas.captureStream(30);

        if (!window.MediaRecorder.isTypeSupported(MIME_TYPE)) {
            console.error('[camera] mp4 recording is not supported in this browser');
            resetRecorderState();
            return false;
        }
        const options = { mimeType: MIME_TYPE };
        state.recordingMimeType = MIME_TYPE;
        state.recordedChunks = [];
        state.mediaRecorder = new window.MediaRecorder(stream, options);

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                state.recordedChunks.push(event.data);
            }
        };

        state.mediaRecorder.onerror = (event) => {
            console.error('[camera] media recorder error', event?.error || event);
        };

        state.mediaRecorder.start();
        return true;
    } catch (error) {
        console.error('[camera] failed to start recording', error);
        resetRecorderState();
        return false;
    }
}

export function stopRecording() {
    return new Promise((resolve) => {
        const recorder = state.mediaRecorder;

        if (!recorder || recorder.state === 'inactive') {
            resolve(null);
            return;
        }

        recorder.onstop = () => {
            const blobType = state.recordingMimeType || MIME_TYPE;
            const blob = new Blob(state.recordedChunks, { type: blobType });
            resetRecorderState();
            resolve(blob.size > 0 ? blob : null);
        };

        recorder.stop();
    });
}

function resetRecorderState() {
    state.mediaRecorder = null;
    state.recordedChunks = [];
}
