/**
 * camera.js
 * إدارة عمليات تسجيل الشاشة والكانفاس للحصول على فيديو التوثيق.
 */

import { state } from './state.js';

export function startRecording() {
    try {
        const canvas = document.getElementById('winner-roulette-wheel');
        if (!canvas) return;

        const stream = canvas.captureStream(30); // 30 FPS تسجيل

        // اكتشاف الصيغ المدعومة في المتصفح
        const mimeTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        
        let mimeType = '';
        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
            }
        }

        const options = mimeType ? { mimeType } : undefined;
        state.recordingMimeType = mimeType || 'video/webm';
        
        state.mediaRecorder = new MediaRecorder(stream, options);
        state.recordedChunks = [];

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                state.recordedChunks.push(e.data);
            }
        };

        state.mediaRecorder.start();
        console.log(`🎥 [Camera] Started recording with ${state.recordingMimeType}`);
        
    } catch (e) {
        console.error('🎥 [Camera] Failed to start:', e);
    }
}

export function stopRecording(callback) {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.onstop = () => {
            const blobType = state.recordingMimeType || 'video/webm';
            const blob = new Blob(state.recordedChunks, { type: blobType });
            console.log(`🎥 [Camera] Finished. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            if (callback) callback(blob);
        };
        state.mediaRecorder.stop();
    } else {
        if (callback) callback(null);
    }
}
