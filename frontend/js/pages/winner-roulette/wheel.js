/**
 * wheel.js
 * محرك الرسوميات الخاص بعجلة الحظ (Canvas Animation and Physics)
 */

import { state } from './state.js';

// دوال التسارع والتباطؤ للفيزياء (Easing functions)
function compositeEase(t) {
    if (t < 0.2) return Math.sin((t / 0.2) * (Math.PI / 2));
    const rem = (t - 0.2) / 0.8;
    return 1 + (rem - 1) * Math.pow(rem - 1, 4) * 0.5;
}

// حساب الفائز بناءً على الزاوية الحالية للعجلة
export function pickIndexByAngle(n, angle) {
    const twoPi = Math.PI * 2;
    const slice = twoPi / n;
    let a = (angle + Math.PI) % twoPi;
    if (a < 0) a += twoPi;
    
    let index = Math.floor(a / slice);
    
    // الانعكاس بسبب دوران الـ Canvas والمؤشر الثابت بالمنتصف تماماً
    index = (n - index) % n;
    return index;
}

// رسم العجلة (تعتمد على State فقط)
export function drawWheel() {
    const canvas = document.getElementById('winner-roulette-wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const baseSize = 520;
    canvas.width = baseSize;
    canvas.height = baseSize;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) / 2 - 15;

    // تحديث نبضات الأنيمشن الخفيف
    state.pulseTime += 0.05;
    ctx.clearRect(0, 0, W, H);

    // المرشحين
    const candidates = state.entries.filter(e => !e.selected || !state.excludeWinner);
    const candidatesSource = (state.spinning && state.spinSnapshot && state.spinSnapshot.length) 
        ? state.spinSnapshot 
        : candidates;
    
    const showWinnersOnly = state.activeCompetition && 
        state.winners.length === state.activeCompetition.totalRequired && 
        state.winners.length > 0;
    const wheelData = showWinnersOnly ? state.winners : candidatesSource;
    const n = wheelData.length === 0 ? 1 : wheelData.length;
    const slice = (Math.PI * 2) / n;

    // لوحة الألوان الأساسية
    const colors = [
        { base: 'rgb(12, 33, 64)', light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' },
        { base: 'rgb(12, 33, 64)', light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' },
        { base: 'rgb(12, 33, 64)', light: 'rgb(18, 45, 82)', dark: 'rgb(8, 22, 43)' }
    ];

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-state.angle);

    for (let i = 0; i < n; i++) {
        const start = i * slice + Math.PI / 2;
        const end = start + slice;
        const colorSet = colors[i % 3];
        const innerRadius = 60;

        ctx.beginPath();
        ctx.arc(0, 0, radius, start, end);
        ctx.arc(0, 0, innerRadius, end, start, true);
        ctx.closePath();
        
        ctx.fillStyle = (wheelData.length === 0) ? '#475569' : colorSet.base;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorSet.dark;
        ctx.stroke();

        ctx.save();
        ctx.rotate(start + slice / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const text = wheelData.length === 0 ? 'لا يوجد مشاركين' : (wheelData[i]?.name || wheelData[i]?.account || '');
        const dynamicSize = n <= 3 ? 32 : n <= 6 ? 26 : n <= 10 ? 22 : 18;
        ctx.font = `bold ${dynamicSize}px "Tajawal", sans-serif`;
        
        const isTarget = state.spinning && i === state.chosenIndex;
        ctx.fillStyle = isTarget ? '#fbbf24' : '#e2e8f0';
        
        if (isTarget) {
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 10;
        }

        ctx.fillText(text, radius - 20, 0);
        ctx.restore();
    }

    ctx.restore();

    // رسم المركز الثابت
    drawCenterLogo(ctx, cx, cy);
}

function drawCenterLogo(ctx, cx, cy) {
    const pulseRad = 60 + Math.sin(state.pulseTime) * 3;
    
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRad, 0, Math.PI * 2);
    ctx.fillStyle = '#ebf8ff';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (state.logoImage && state.logoImage.complete && state.logoImage.naturalWidth > 0 && !state.spinning) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRad - 5, 0, Math.PI * 2);
        ctx.clip();
        const imgSize = (pulseRad - 5) * 2;
        ctx.drawImage(state.logoImage, cx - imgSize / 2, cy - imgSize / 2, imgSize, imgSize);
        ctx.restore();
    } else {
        ctx.fillStyle = '#6366f1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px Tajawal';
        ctx.fillText('INZO', cx, cy);
    }
}

// دالة تحريك العجلة التي تعتمد على state.angle
export function animateSpin(onDoneCallback) {
    function step(ts) {
        const t = Math.min(1, (ts - state.spinStart) / state.spinDuration);
        const eased = compositeEase(t);
        state.angle = state.startAngle + (state.targetAngle - state.startAngle) * eased;
        
        drawWheel();
        
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            state.angle = state.targetAngle % (Math.PI * 2);
            drawWheel(); // Final paint
            if (onDoneCallback) onDoneCallback();
        }
    }
    requestAnimationFrame((ts) => {
        state.spinStart = ts;
        step(ts);
    });
}
