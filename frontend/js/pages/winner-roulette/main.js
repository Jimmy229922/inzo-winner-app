/**
 * main.js
 * المايسترو (المدير الرئيسي لصفحة الروليت)
 * يقوم بربط ملفات الـ (API, State, Wheel, UI) وتنظيم سير العمل.
 */

import { state } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as wheel from './wheel.js';
import { debounce } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('👑 Winner Roulette Modular Engine Initialized');
    
    // 1. تعريف عناصر الشاشة وضبط الأحداث الأولية
    initEventListeners();
    
    // 2. تحديث الشاشة مبدئياً
    wheel.drawWheel();
    ui.renderParticipants();
    ui.renderWinners();
});

function initEventListeners() {
    const textarea = document.getElementById('participants-textarea');
    const spinBtn = document.getElementById('spin-button');

    if (textarea) {
        textarea.addEventListener('input', debounce(() => {
            handleParticipantsInput(textarea.value);
        }, 500));
    }

    if (spinBtn) {
        spinBtn.addEventListener('click', () => {
            handleSpinRequest();
        });
    }
}

// معالجة ادخال المستخدمين الجدد
function handleParticipantsInput(text) {
    const lines = text.split('\n');
    const newEntries = [];
    
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        // Simple logic for extraction Name - Account (We could move this to utils.js later)
        const parts = line.split('-').map(s => s.trim());
        const account = parts.pop();
        const name = parts.join(' ').replace(/^\d+[\.\-]/, '').trim(); 
        
        if (name && account) {
            newEntries.push({ id: index, name, account, selected: false });
        }
    });

    state.entries = newEntries;
    ui.renderParticipants();
    wheel.drawWheel();
}

// طلب بدء الدوران
function handleSpinRequest() {
    if (state.spinning) return;
    if (state.entries.length === 0) {
        ui.toast('الرجاء إدخال مشاركين أولاً', 'warning');
        return;
    }

    // 1. تحديث الحالة
    state.spinning = true;
    state.spinStart = performance.now();
    state.spinDuration = 4000; // 4 seconds
    
    // 2. حساب الزاوية المستهدفة والفائز العشوائي
    const n = state.entries.length;
    const slice = (Math.PI * 2) / n;
    state.chosenIndex = Math.floor(Math.random() * n); // اختيار عشوائي للفائز
    
    // فيزياء دوران الروليت
    const offset = (Math.random() * 0.8 + 0.1) * slice;
    const randomRotations = (Math.floor(Math.random() * 3) + 4) * Math.PI * 2; 
    let target = state.chosenIndex * slice;
    
    // عكس الاتجاه وتطبيق المعادلات كما في الملف الأصلي
    target = (Math.PI * 2) - target;
    target -= Math.PI / 2;
    target += offset;
    
    state.startAngle = state.angle;
    state.targetAngle = state.startAngle + randomRotations + ((target - state.startAngle) % (Math.PI * 2));
    if (state.targetAngle < state.startAngle) state.targetAngle += Math.PI * 2;

    // 3. تعطيل الأزرار ثم استدعاء المحرك
    ui.toggleButtonsMode(true);
    wheel.animateSpin(() => {
        handleSpinComplete();
    });
}

// ما يحدث عند انتهاء الدوران ووقوف العجلة
function handleSpinComplete() {
    state.spinning = false;
    ui.toggleButtonsMode(false);
    
    const winner = state.entries[state.chosenIndex];
    if (!winner) return;

    // إظهار النافذة
    ui.showWinnerModal(winner, 
        (approvedWinner) => { // عند ضغط "اعتماد"
            ui.hideWinnerModal();
            state.winners.push(approvedWinner);
            ui.renderWinners();
            ui.toast('تم الحفظ بنجاح', 'success');
        },
        () => { // عند ضغط "تخطي"
            ui.hideWinnerModal();
            ui.toast('تم تخطي المشترك', 'info');
        }
    );
}
