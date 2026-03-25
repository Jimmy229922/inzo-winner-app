/**
 * main.js
 * Entry point for the modular winner roulette page.
 */

import { state, config } from './state.js';
import * as ui from './ui.js';
import * as wheel from './wheel.js';
import * as camera from './camera.js';
import * as db from './db.js';
import { createWinnerId, parseParticipantsInput, participantFingerprint } from './utils.js';

const dom = {};

document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((error) => {
        console.error('[winner-roulette modular] bootstrap failed', error);
        ui.toast('حدث خطأ أثناء تشغيل النسخة الجديدة', 'error');
    });
});

async function bootstrap() {
    bindDom();
    bindEventListeners();

    await db.initDB().catch((error) => {
        console.warn('[winner-roulette modular] IndexedDB not available', error);
    });

    restoreSession();
    await hydrateWinnersFromIndexedDb();

    syncControlsFromState();
    syncPredeterminedWinners();

    ui.renderParticipants();
    ui.renderWinners();
    wheel.drawWheel();
}

function bindDom() {
    dom.participantsInput = document.getElementById('participants-input');
    dom.addParticipantsBtn = document.getElementById('add-participants-btn');
    dom.excludeWinnerCb = document.getElementById('exclude-winner');
    dom.spinSpeed = document.getElementById('spin-speed');
    dom.predeterminedWinner = document.getElementById('predetermined-winner');
    dom.wheelCanvas = document.getElementById('winner-roulette-wheel');
    dom.wheelCenter = document.querySelector('.wr-wheel-center');
    dom.autoPickBtn = document.getElementById('auto-pick-btn');
    dom.resetWheelBtn = document.getElementById('reset-wheel');

    dom.saveSessionBtn = document.getElementById('save-session');
    dom.exportWinnersBtn = document.getElementById('export-winners');
    dom.sendReportBtn = document.getElementById('send-winners-report');
    dom.sendDetailsBtn = document.getElementById('send-winners-details');
    dom.openWheelOfNamesBtn = document.getElementById('open-wheelofnames');
}

function bindEventListeners() {
    dom.addParticipantsBtn?.addEventListener('click', onAddParticipants);

    dom.participantsInput?.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onAddParticipants();
        }
    });

    dom.excludeWinnerCb?.addEventListener('change', (event) => {
        state.excludeWinner = !!event.target.checked;
        persistSession();
    });

    dom.predeterminedWinner?.addEventListener('change', (event) => {
        state.predeterminedWinnerId = event.target.value || '';
        persistSession();
    });

    dom.resetWheelBtn?.addEventListener('click', () => {
        if (state.spinning) return;
        state.angle = 0;
        state.startAngle = 0;
        state.targetAngle = 0;
        wheel.drawWheel();
    });

    dom.autoPickBtn?.addEventListener('click', () => {
        if (state.spinning) return;
        onSpinRequested();
    });

    dom.wheelCanvas?.addEventListener('click', (event) => {
        if (state.spinning) return;
        if (!isCenterClick(event)) return;
        onSpinRequested();
    });

    dom.wheelCenter?.addEventListener('click', () => {
        if (state.spinning) return;
        onSpinRequested();
    });

    dom.saveSessionBtn?.addEventListener('click', () => {
        persistSession();
        ui.toast('تم حفظ الجلسة محليًا', 'success');
    });

    dom.exportWinnersBtn?.addEventListener('click', () => {
        if (!state.winners.length) {
            ui.toast('لا يوجد فائزين للتصدير', 'warning');
            return;
        }

        const blob = new Blob([JSON.stringify(state.winners, null, 2)], {
            type: 'application/json'
        });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `winners_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(link.href);
    });

    dom.sendReportBtn?.addEventListener('click', () => {
        ui.toast('ميزة إرسال التقرير ما زالت تحت النقل للنسخة الجديدة', 'info');
    });

    dom.sendDetailsBtn?.addEventListener('click', () => {
        ui.toast('ميزة إرسال التفاصيل ما زالت تحت النقل للنسخة الجديدة', 'info');
    });

    dom.openWheelOfNamesBtn?.addEventListener('click', () => {
        const labels = state.entries.map((entry) =>
            entry.account ? `${entry.name} — ${entry.account}` : entry.name
        );

        if (!labels.length) {
            ui.toast('لا توجد أسماء لفتحها في Wheel of Names', 'warning');
            return;
        }

        const url = `https://wheelofnames.com/view?entries=${encodeURIComponent(labels.join(','))}`;
        window.open(url, '_blank');
    });

    window.addEventListener('beforeunload', persistSession);
}

function onAddParticipants() {
    const raw = dom.participantsInput?.value || '';
    const parsedEntries = parseParticipantsInput(raw);

    if (!parsedEntries.length) {
        ui.toast('لم يتم العثور على سطور صالحة للإضافة', 'warning');
        return;
    }

    const existing = new Set(state.entries.map((entry) => participantFingerprint(entry)));
    let addedCount = 0;

    parsedEntries.forEach((entry) => {
        const key = participantFingerprint(entry);
        if (existing.has(key)) return;

        existing.add(key);
        state.entries.push(entry);
        addedCount += 1;
    });

    if (addedCount === 0) {
        ui.toast('كل الأسماء المدخلة موجودة بالفعل', 'info');
        return;
    }

    if (dom.participantsInput) {
        dom.participantsInput.value = '';
    }

    syncPredeterminedWinners();
    ui.renderParticipants();
    wheel.drawWheel();
    persistSession();

    ui.toast(`تمت إضافة ${addedCount} مشارك`, 'success');
}

function onSpinRequested() {
    const candidates = state.entries;

    if (!Array.isArray(candidates) || candidates.length === 0) {
        ui.toast('الرجاء إدخال مشاركين أولًا', 'warning');
        return;
    }

    state.spinning = true;
    ui.toggleButtonsMode(true);

    state.spinSnapshot = [...candidates];
    state.chosenIndex = resolveWinnerIndex(state.spinSnapshot);

    computeSpinTarget(state.chosenIndex, state.spinSnapshot.length);

    const recordingStarted = camera.startRecording();

    wheel.animateSpin(async () => {
        const winner = state.spinSnapshot?.[state.chosenIndex] || null;

        if (!winner) {
            finishSpinCycle();
            return;
        }

        await drawOverlayForDuration(winner, config.RECORD_OVERLAY_MS);

        const videoBlob = recordingStarted ? await camera.stopRecording() : null;

        if (videoBlob) {
            ui.showVideoPreview(videoBlob, winner, {
                onSave: () => {
                    state.pendingVideoBlob = videoBlob;
                    openWinnerForm(winner);
                },
                onSkip: () => {
                    state.pendingVideoBlob = null;
                    ui.toast('تم تخطي الفائز', 'info');
                    finishSpinCycle();
                }
            });
            return;
        }

        openWinnerForm(winner);
    });
}

function openWinnerForm(winner) {
    ui.showWinnerModal(winner, {
        onConfirm: async (form) => {
            await commitWinner(winner, form);
            finishSpinCycle();
        },
        onCancel: () => {
            state.pendingVideoBlob = null;
            finishSpinCycle();
        }
    });
}

async function commitWinner(sourceEntry, form) {
    const winner = {
        id: createWinnerId(),
        name: sourceEntry?.name || '',
        account: sourceEntry?.account || '',
        email: form?.email || '',
        nationalId: form?.nationalId || '',
        timestamp: new Date().toISOString(),
        recordingMimeType: state.recordingMimeType || null,
        hasVideo: !!state.pendingVideoBlob,
        hasIdImage: !!form?.idImageBlob,
        localIdImageName: form?.idImageName || null
    };

    state.winners.push(winner);

    if (state.excludeWinner) {
        state.entries = state.entries.filter((entry) => entry.id !== sourceEntry.id);
    }

    if (state.predeterminedWinnerId === sourceEntry.id) {
        state.predeterminedWinnerId = '';
    }

    const tasks = [db.saveWinnerLocal(winner)];

    if (state.pendingVideoBlob) {
        tasks.push(db.saveVideoToDB(winner.id, state.pendingVideoBlob));
    }

    if (form?.idImageBlob) {
        tasks.push(db.saveImageToDB(winner.id, form.idImageBlob));
    }

    await Promise.allSettled(tasks);

    state.pendingVideoBlob = null;

    syncPredeterminedWinners();
    ui.renderParticipants();
    ui.renderWinners();
    wheel.drawWheel();
    persistSession();

    ui.toast('تم تجهيز الفائز وحفظ البيانات محليًا', 'success');
}

function finishSpinCycle() {
    state.spinning = false;
    state.spinSnapshot = null;
    state.chosenIndex = null;

    ui.toggleButtonsMode(false);
    wheel.drawWheel();
}

function resolveWinnerIndex(snapshot) {
    if (state.predeterminedWinnerId) {
        const forcedIndex = snapshot.findIndex((entry) => entry.id === state.predeterminedWinnerId);
        if (forcedIndex >= 0) return forcedIndex;
    }

    return secureRandomInt(snapshot.length);
}

function computeSpinTarget(winnerIndex, totalEntries) {
    const slice = (Math.PI * 2) / totalEntries;
    const targetAngleBase = winnerIndex * slice + slice / 2 + Math.PI;
    const rotations = 4 + secureRandomInt(3); // 4..6
    const offset = (secureRandomFloat() - 0.5) * slice * 0.6;

    state.startAngle = state.angle;
    state.targetAngle = targetAngleBase + rotations * Math.PI * 2 + offset + 1e-6;
    state.spinDuration = getSpinDuration(dom.spinSpeed?.value || 'normal');
}

function getSpinDuration(speed) {
    switch (speed) {
        case 'fast':
            return 2800;
        case 'slow':
            return 8200;
        default:
            return 4500;
    }
}

function drawOverlayForDuration(winner, durationMs) {
    return new Promise((resolve) => {
        const startedAt = performance.now();

        function frame(now) {
            wheel.drawWinnerOverlay(winner);
            if ((now - startedAt) < durationMs) {
                requestAnimationFrame(frame);
                return;
            }

            resolve();
        }

        requestAnimationFrame(frame);
    });
}

async function hydrateWinnersFromIndexedDb() {
    if (!state.winners.length) {
        const localWinners = await db.getLocalWinners().catch(() => []);
        if (Array.isArray(localWinners) && localWinners.length > 0) {
            state.winners = localWinners;
        }
    }

    if (!state.winners.length) return;

    const hydrationTasks = state.winners.map(async (winner) => {
        if (!winner?.id) return;

        if (winner.hasVideo) {
            winner.pendingVideoBlob = await db.getVideoFromDB(winner.id).catch(() => null);
        }

        if (winner.hasIdImage) {
            winner.pendingIdImage = await db.getImageFromDB(winner.id).catch(() => null);
        }
    });

    await Promise.allSettled(hydrationTasks);
}

function syncControlsFromState() {
    if (dom.excludeWinnerCb) {
        dom.excludeWinnerCb.checked = !!state.excludeWinner;
    }

    if (dom.predeterminedWinner) {
        dom.predeterminedWinner.value = state.predeterminedWinnerId || '';
    }
}

function syncPredeterminedWinners() {
    if (!dom.predeterminedWinner) return;

    const previousValue = state.predeterminedWinnerId || '';

    dom.predeterminedWinner.innerHTML = '<option value="">عشوائي</option>';

    state.entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.account ? `${entry.name} — ${entry.account}` : entry.name;
        dom.predeterminedWinner.appendChild(option);
    });

    const hasPrevious = state.entries.some((entry) => entry.id === previousValue);

    state.predeterminedWinnerId = hasPrevious ? previousValue : '';
    dom.predeterminedWinner.value = state.predeterminedWinnerId;
}

function persistSession() {
    const payload = {
        entries: state.entries.map((entry) => ({
            id: entry.id,
            name: entry.name,
            account: entry.account
        })),
        winners: state.winners.map((winner) => ({
            id: winner.id,
            name: winner.name,
            account: winner.account,
            email: winner.email,
            nationalId: winner.nationalId,
            timestamp: winner.timestamp,
            recordingMimeType: winner.recordingMimeType,
            hasVideo: !!winner.hasVideo,
            hasIdImage: !!winner.hasIdImage,
            localIdImageName: winner.localIdImageName || null
        })),
        angle: state.angle,
        excludeWinner: !!state.excludeWinner,
        predeterminedWinnerId: state.predeterminedWinnerId || ''
    };

    try {
        localStorage.setItem(config.LS_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[winner-roulette modular] failed to persist session', error);
    }
}

function restoreSession() {
    try {
        const raw = localStorage.getItem(config.LS_KEY);
        if (!raw) return;

        const payload = JSON.parse(raw);

        state.entries = Array.isArray(payload.entries) ? payload.entries : [];
        state.winners = Array.isArray(payload.winners) ? payload.winners : [];
        state.angle = Number.isFinite(payload.angle) ? payload.angle : 0;
        state.excludeWinner = !!payload.excludeWinner;
        state.predeterminedWinnerId = payload.predeterminedWinnerId || '';
    } catch (error) {
        console.warn('[winner-roulette modular] failed to restore session', error);
    }
}

function isCenterClick(event) {
    const canvas = dom.wheelCanvas;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const distance = Math.hypot(x - cx, y - cy);

    return distance <= 80;
}

function secureRandomInt(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;

    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const buffer = new Uint32Array(1);
        window.crypto.getRandomValues(buffer);
        return buffer[0] % maxExclusive;
    }

    return Math.floor(Math.random() * maxExclusive);
}

function secureRandomFloat() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const buffer = new Uint32Array(1);
        window.crypto.getRandomValues(buffer);
        return buffer[0] / 0xffffffff;
    }

    return Math.random();
}
