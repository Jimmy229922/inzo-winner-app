/**
 * ui.js
 * طبقة شاشة المستخدم (DOM Manipulation & UI Updates)
 * تتعامل حصرياً مع HTML وتطبيق التغييرات البصرية.
 */

import { state } from './state.js';

// دوال إظهار وإخفاء إشعار "التوست"
export function toast(message, type = 'info', duration = 3000) {
    if (window.showToast) {
        window.showToast(message, type, duration);
    } else {
        alert(message); // Fallback
    }
}

// تحديث جدول المشاركين على الشاشة
export function renderParticipants() {
    const list = document.getElementById('participants-list');
    const countEl = document.getElementById('participants-count');
    
    if (!list) return;

    list.innerHTML = '';
    
    if (!state.entries || state.entries.length === 0) {
        list.innerHTML = '<li class="empty-state">لا يوجد مشاركين حتى الآن</li>';
        if (countEl) countEl.textContent = '0';
        return;
    }

    if (countEl) countEl.textContent = state.entries.length;

    state.entries.forEach((entry, idx) => {
        const li = document.createElement('li');
        li.className = 'wr-participant-item';
        if (entry.selected) li.classList.add('selected');
        
        li.innerHTML = `
            <span class="seq">${idx + 1}-</span>
            <span class="name">${entry.name}</span>
            <span class="account" dir="ltr">${entry.account}</span>
        `;
        list.appendChild(li);
    });
}

// تحديث جدول وجامع الفائزين
export function renderWinners() {
    const list = document.getElementById('winners-list-bottom');
    const badge = document.getElementById('winners-count-badge');
    
    if (badge) badge.textContent = state.winners ? state.winners.length : 0;
    if (!list) return;

    list.innerHTML = '';
    
    if (!state.winners || state.winners.length === 0) {
        list.innerHTML = '<li class="empty-state">لم يتم اختيار أي فائز بعد</li>';
        return;
    }

    state.winners.forEach((winner, idx) => {
        const li = document.createElement('li');
        li.className = 'wr-winner-item';
        
        li.innerHTML = `
            <div class="winner-info">
                <span class="seq">${idx + 1}-</span>
                <span class="name">${winner.name}</span>
                <span class="account">(${winner.account})</span>
            </div>
            ${winner.prize ? `<span class="prize-tag">${winner.prize}</span>` : ''}
        `;
        list.appendChild(li);
    });
}

// نافذة الاحتفال والميدالية
export function showWinnerModal(winner, onApprove, onSkip) {
    let modal = document.getElementById('winner-modal');
    if (!modal) {
        console.error('Winner modal HTML structure not found in the DOM.');
        return;
    }

    // Populate data
    document.getElementById('celebration-winner-name').textContent = winner.name || '—';
    document.getElementById('celebration-winner-account').textContent = winner.account || '—';

    // Show modal
    modal.style.display = 'flex';

    // إعدد الأزرار وإزالة الأحداث القديمة لتجنب التكرار
    const btnApprove = document.getElementById('btn-approve-winner');
    const btnSkip = document.getElementById('btn-skip-winner');

    if (btnApprove) {
        btnApprove.onclick = () => onApprove(winner);
    }
    if (btnSkip) {
        btnSkip.onclick = () => onSkip(winner);
    }
}

// إغلاق النافذة
export function hideWinnerModal() {
    let modal = document.getElementById('winner-modal');
    if (modal) modal.style.display = 'none';
}

// تفعيل أو تعطيل الأزرار العامة
export function toggleButtonsMode(isOperating) {
    const spinBtn = document.getElementById('spin-button');
    const autoBtn = document.getElementById('auto-spin-btn');
    
    if (spinBtn) spinBtn.disabled = isOperating;
    if (autoBtn) autoBtn.disabled = isOperating;
}
