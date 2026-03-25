/**
 * wheel.js
 * Canvas drawing and spin animation for roulette wheel.
 */

import { state } from './state.js';

function compositeEase(t) {
    if (t < 0.2) return Math.sin((t / 0.2) * (Math.PI / 2));
    const rem = (t - 0.2) / 0.8;
    return 1 + (rem - 1) * Math.pow(rem - 1, 4) * 0.5;
}

export function pickIndexByAngle(n, angle) {
    const twoPi = Math.PI * 2;
    const slice = twoPi / n;

    let a = (angle + Math.PI) % twoPi;
    if (a < 0) a += twoPi;

    let index = Math.floor(a / slice);
    index = (n - index) % n;
    return index;
}

export function drawWheel() {
    const canvas = document.getElementById('winner-roulette-wheel');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseSize = 520;
    canvas.width = baseSize;
    canvas.height = baseSize;

    const entries = getVisualEntries();
    const n = entries.length || 1;
    const slice = (Math.PI * 2) / n;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) / 2 - 15;

    state.pulseTime += 0.045;

    ctx.clearRect(0, 0, W, H);

    const colors = ['#0c2140', '#0f274a', '#123056', '#153965'];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-state.angle);

    for (let i = 0; i < n; i += 1) {
        const start = i * slice + Math.PI / 2;
        const end = start + slice;
        const innerRadius = 58;

        ctx.beginPath();
        ctx.arc(0, 0, radius, start, end);
        ctx.arc(0, 0, innerRadius, end, start, true);
        ctx.closePath();

        ctx.fillStyle = entries.length ? colors[i % colors.length] : '#475569';
        ctx.fill();

        ctx.lineWidth = 1.25;
        ctx.strokeStyle = '#061426';
        ctx.stroke();

        ctx.save();
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const text = entries.length
            ? (entries[i]?.name || entries[i]?.account || '')
            : 'لا يوجد مشاركين';

        const dynamicSize = n <= 3 ? 30 : n <= 6 ? 24 : n <= 10 ? 20 : 16;
        ctx.font = `bold ${dynamicSize}px "Tajawal", sans-serif`;

        const isTarget = state.spinning && i === state.chosenIndex;
        ctx.fillStyle = isTarget ? '#fbbf24' : '#e2e8f0';

        if (isTarget) {
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 12;
        }

        ctx.fillText(text, radius - 18, 0);
        ctx.restore();
    }

    ctx.restore();

    drawCenter(ctx, cx, cy);
}

export function drawWinnerOverlay(winner) {
    const canvas = document.getElementById('winner-roulette-wheel');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawWheel();

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '56px Arial';
    ctx.fillText('🎉', W / 2, H / 2 - 100);

    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('الفائز', W / 2, H / 2 - 38);

    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(winner?.name || '—', W / 2, H / 2 + 18);

    ctx.font = '22px Arial';
    ctx.fillStyle = '#94a3b8';
    const account = winner?.account ? `رقم الحساب: ${winner.account}` : '';
    ctx.fillText(account, W / 2, H / 2 + 64);
}

export function animateSpin(onDoneCallback) {
    function step(ts) {
        const t = Math.min(1, (ts - state.spinStart) / state.spinDuration);
        const eased = compositeEase(t);
        state.angle = state.startAngle + (state.targetAngle - state.startAngle) * eased;

        drawWheel();

        if (t < 1) {
            requestAnimationFrame(step);
            return;
        }

        state.angle = state.targetAngle % (Math.PI * 2);
        drawWheel();

        if (onDoneCallback) onDoneCallback();
    }

    requestAnimationFrame((ts) => {
        state.spinStart = ts;
        step(ts);
    });
}

function getVisualEntries() {
    if (state.spinning && Array.isArray(state.spinSnapshot) && state.spinSnapshot.length > 0) {
        return state.spinSnapshot;
    }

    return Array.isArray(state.entries) ? state.entries : [];
}

function drawCenter(ctx, cx, cy) {
    const pulseRadius = 60 + Math.sin(state.pulseTime) * 3;

    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ebf8ff';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#6366f1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Tajawal';
    ctx.fillText('INZO', cx, cy);
}
