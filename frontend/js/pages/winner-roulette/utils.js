/**
 * utils.js
 * Stateless helpers for the modular winner roulette flow.
 */

export function debounce(func, wait) {
    let timeout;
    return function debounced(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function throttle(func, limit) {
    let inThrottle = false;
    let lastArgs = null;

    return function throttled(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    const queued = lastArgs;
                    lastArgs = null;
                    func.apply(this, queued);
                }
            }, limit);
            return;
        }

        lastArgs = args;
    };
}

export function parseParticipantsInput(text) {
    const lines = (text || '').split(/\r?\n/);
    const entries = [];

    lines.forEach((raw, index) => {
        let line = (raw || '').trim();
        if (!line) return;

        // Remove numbering prefixes: "1-", "2.", "3)"
        line = line.replace(/^\d+[\s\-\.)_]+/, '').trim();

        // Remove invisible chars that may come from copy/paste
        line = line.replace(/[\u200B-\u200D\uFEFF]/g, '');

        // name + account patterns
        const dashed = line.match(/^(.*?)[\s\t]*[—\-–―‒−]+[\s\t]*(\d+)\s*$/);
        const spaced = line.match(/^(.*?)[\s\t]+(\d+)\s*$/);

        let name = '';
        let account = '';

        if (dashed) {
            name = (dashed[1] || '').trim();
            account = (dashed[2] || '').trim();
        } else if (spaced) {
            name = (spaced[1] || '').trim();
            account = (spaced[2] || '').trim();
        } else {
            name = line;
        }

        if (!name) return;

        entries.push({
            id: createParticipantId(name, account, index),
            name,
            account
        });
    });

    return entries;
}

export function participantFingerprint(entry) {
    const name = (entry?.name || '').trim().toLowerCase();
    const account = (entry?.account || '').trim();
    return `${name}::${account}`;
}

export function createWinnerId() {
    const randomPart = `${Math.random().toString(36).slice(2, 8)}`;
    return `winner_${Date.now()}_${randomPart}`;
}

function createParticipantId(name, account, index) {
    const base = `${name}_${account || 'na'}_${index}`
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 60);
    return `entry_${Date.now()}_${base}`;
}
