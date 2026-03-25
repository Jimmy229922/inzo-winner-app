/**
 * ui.js
 * DOM rendering and modal helpers for the modular roulette page.
 */

import { state } from './state.js';

let modalCleanup = null;

export function toast(message, type = 'info', duration = 3000) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
        return;
    }

    // Fallback for environments where toast helper is not mounted yet.
    window.alert(message);
}

export function renderParticipants() {
    const list = document.getElementById('participants-list');
    if (!list) return;

    list.innerHTML = '';

    const count = Array.isArray(state.entries) ? state.entries.length : 0;

    if (count === 0) {
        list.innerHTML = '<div class="empty-state">لا يوجد مشاركين حتى الآن</div>';
        return;
    }

    state.entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'wr-participant-item';
        row.innerHTML = `
            <span class="seq">${index + 1}-</span>
            <span class="name">${escapeHtml(entry.name || '')}</span>
            <span class="account" dir="ltr">${escapeHtml(entry.account || '')}</span>
        `;
        list.appendChild(row);
    });
}

export function renderWinners() {
    const list = document.getElementById('winners-list-bottom');
    const badge = document.getElementById('winners-count-badge');

    const count = Array.isArray(state.winners) ? state.winners.length : 0;

    if (badge) {
        badge.textContent = String(count);
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if (!list) return;

    list.innerHTML = '';

    if (count === 0) {
        list.innerHTML = '<div class="empty-state">لم يتم اختيار أي فائز بعد</div>';
        return;
    }

    state.winners.forEach((winner, index) => {
        const row = document.createElement('div');
        row.className = 'wr-winner-item';
        row.innerHTML = `
            <div class="winner-info">
                <span class="seq">${index + 1}-</span>
                <span class="name">${escapeHtml(winner.name || '')}</span>
                <span class="account" dir="ltr">(${escapeHtml(winner.account || '')})</span>
            </div>
            <div class="winner-meta">
                <span>${winner.hasVideo ? '🎥' : '—'}</span>
                <span>${winner.hasIdImage ? '🪪' : '—'}</span>
            </div>
        `;
        list.appendChild(row);
    });
}

export function showWinnerModal(winner, handlers = {}) {
    if (typeof modalCleanup === 'function') {
        modalCleanup();
        modalCleanup = null;
    }

    const modal = document.getElementById('winner-modal');
    const winnerNameEl = document.getElementById('celebration-winner-name');
    const winnerAccountEl = document.getElementById('celebration-winner-account');
    const emailInput = document.getElementById('winner-email');
    const nationalIdInput = document.getElementById('winner-national-id');
    const idInput = document.getElementById('winner-id-image');
    const confirmBtn = document.getElementById('confirm-winner');

    if (!modal || !winnerNameEl || !winnerAccountEl || !confirmBtn) {
        console.error('[ui] missing winner modal elements');
        return;
    }

    const cancelBtn = ensureCancelButton(confirmBtn);
    const imagePreview = ensureImagePreview(idInput);

    winnerNameEl.textContent = winner?.name || '—';
    winnerAccountEl.textContent = winner?.account || '—';

    if (emailInput) emailInput.value = '';
    if (nationalIdInput) nationalIdInput.value = '';
    if (idInput) idInput.value = '';
    if (imagePreview) {
        imagePreview.style.display = 'none';
        imagePreview.src = '';
    }

    modal.style.display = 'flex';

    const onIdImageChange = () => {
        if (!idInput || !idInput.files || !idInput.files[0] || !imagePreview) return;

        const file = idInput.files[0];
        const url = URL.createObjectURL(file);

        imagePreview.src = url;
        imagePreview.style.display = 'block';

        imagePreview.onload = () => {
            URL.revokeObjectURL(url);
        };
    };

    const onConfirm = () => {
        const email = (emailInput?.value || '').trim();
        const nationalId = (nationalIdInput?.value || '').trim();
        const idImageBlob = idInput?.files?.[0] || null;

        if (email && !/.+@.+\..+/.test(email)) {
            toast('البريد الإلكتروني غير صالح', 'warning');
            return;
        }

        hideWinnerModal();
        handlers.onConfirm?.({
            email,
            nationalId,
            idImageBlob,
            idImageName: idImageBlob?.name || null
        });
    };

    const onCancel = () => {
        hideWinnerModal();
        handlers.onCancel?.();
    };

    const onBackdropClick = (event) => {
        if (event.target === modal) {
            onCancel();
        }
    };

    const onEscape = (event) => {
        if (event.key === 'Escape') {
            onCancel();
        }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onEscape);
    idInput?.addEventListener('change', onIdImageChange);

    modalCleanup = () => {
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdropClick);
        document.removeEventListener('keydown', onEscape);
        idInput?.removeEventListener('change', onIdImageChange);
    };
}

export function hideWinnerModal() {
    const modal = document.getElementById('winner-modal');
    if (modal) modal.style.display = 'none';

    if (typeof modalCleanup === 'function') {
        modalCleanup();
        modalCleanup = null;
    }
}

export function showVideoPreview(blob, winner, handlers = {}) {
    if (!blob) {
        handlers.onSave?.();
        return;
    }

    const existing = document.getElementById('wr-video-preview-overlay');
    if (existing) existing.remove();

    const url = URL.createObjectURL(blob);

    const overlay = document.createElement('div');
    overlay.id = 'wr-video-preview-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'inset: 0',
        'background: rgba(0,0,0,0.88)',
        'z-index: 120000',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'padding: 16px'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
        'width: min(560px, 100%)',
        'background: #0f172a',
        'border: 1px solid #334155',
        'border-radius: 14px',
        'padding: 16px',
        'color: #e2e8f0'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = `معاينة فيديو الفائز: ${winner?.name || ''}`;
    title.style.cssText = 'font-size: 1rem; font-weight: 700; margin-bottom: 12px;';

    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = false;
    video.loop = true;
    video.playsInline = true;
    video.src = url;
    video.style.cssText = 'width: 100%; border-radius: 8px; background: #020617;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 10px; margin-top: 12px; justify-content: flex-end;';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'حفظ الفيديو والمتابعة';
    saveBtn.className = 'wr-btn wr-btn-success';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'تخطي الفائز';
    skipBtn.className = 'wr-btn wr-btn-danger';

    actions.appendChild(skipBtn);
    actions.appendChild(saveBtn);
    card.appendChild(title);
    card.appendChild(video);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
        URL.revokeObjectURL(url);
        overlay.remove();
    };

    saveBtn.addEventListener('click', () => {
        cleanup();
        handlers.onSave?.();
    });

    skipBtn.addEventListener('click', () => {
        cleanup();
        handlers.onSkip?.();
    });

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            cleanup();
            handlers.onSkip?.();
        }
    });
}

export function toggleButtonsMode(isOperating) {
    const addBtn = document.getElementById('add-participants-btn');
    const autoBtn = document.getElementById('auto-pick-btn');
    const resetBtn = document.getElementById('reset-wheel');

    if (addBtn) addBtn.disabled = isOperating;
    if (autoBtn) autoBtn.disabled = isOperating;
    if (resetBtn) resetBtn.disabled = isOperating;
}

function ensureCancelButton(confirmBtn) {
    let cancelBtn = document.getElementById('cancel-winner');
    if (cancelBtn) return cancelBtn;

    cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-winner';
    cancelBtn.className = 'wr-btn wr-btn-secondary';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.width = '100%';
    cancelBtn.textContent = 'إلغاء';

    confirmBtn.parentElement?.appendChild(cancelBtn);
    return cancelBtn;
}

function ensureImagePreview(idInput) {
    if (!idInput || !idInput.parentElement) return null;

    let preview = document.getElementById('winner-id-image-preview');
    if (preview) return preview;

    preview = document.createElement('img');
    preview.id = 'winner-id-image-preview';
    preview.alt = 'معاينة صورة الهوية';
    preview.style.cssText = [
        'display: none',
        'margin-top: 8px',
        'max-width: 100%',
        'max-height: 120px',
        'border-radius: 8px',
        'border: 1px solid #334155',
        'object-fit: contain'
    ].join(';');

    idInput.parentElement.appendChild(preview);
    return preview;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
