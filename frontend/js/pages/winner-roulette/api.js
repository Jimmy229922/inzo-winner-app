/**
 * api.js
 * Network layer for modular winner roulette.
 */

function getAuthedFetch() {
    const fn = window?.utils?.authedFetch || window?.authedFetch || window?.fetch;
    if (!fn) throw new Error('authedFetch is not available');
    return fn;
}

function appendFile(formData, key, blob, fallbackName) {
    if (!formData || !key || !blob) return;
    if (window?.utils?.safeAppendFile) {
        window.utils.safeAppendFile(formData, key, blob, fallbackName);
        return;
    }
    formData.append(key, blob, fallbackName);
}

function normalizeArrayResponse(payload, candidates) {
    for (const key of candidates) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
}

async function readErrorMessage(response, fallbackMessage) {
    try {
        const payload = await response.json();
        if (payload?.message) return payload.message;
        if (payload?.error) return payload.error;
    } catch (_) {}

    try {
        const text = await response.text();
        if (text) return text;
    } catch (_) {}

    return fallbackMessage;
}

export async function fetchAgents() {
    const authedFetch = getAuthedFetch();
    const response = await authedFetch('/api/agents?limit=1000');
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to fetch agents'));

    const payload = await response.json();
    return normalizeArrayResponse(payload, ['data', 'agents']);
}

export async function fetchCompetitions(agentId) {
    if (!agentId) return [];

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(
        `/api/competitions?agentId=${encodeURIComponent(agentId)}&sort=-createdAt&limit=100`
    );
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to fetch competitions'));

    const payload = await response.json();
    return normalizeArrayResponse(payload, ['competitions', 'data']);
}

export async function fetchCompetitionById(competitionId) {
    if (!competitionId) return null;

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(`/api/competitions/${encodeURIComponent(competitionId)}`);
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to fetch competition details'));

    const payload = await response.json();
    return payload?.competition || payload?.data || payload || null;
}

export async function fetchWinners(agentId, competitionId) {
    if (!agentId || !competitionId) return [];

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(
        `/api/agents/${encodeURIComponent(agentId)}/winners?competition_id=${encodeURIComponent(competitionId)}&_t=${Date.now()}`
    );
    if (!response.ok) throw new Error(await readErrorMessage(response, 'Failed to fetch winners'));

    const payload = await response.json();
    if (Array.isArray(payload?.winners)) return payload.winners;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.competitions) && payload.competitions.length > 0) {
        const firstCompetition = payload.competitions[0];
        if (Array.isArray(firstCompetition?.winners)) return firstCompetition.winners;
    }
    return [];
}

export async function importWinners(agentId, competitionId, winners) {
    if (!agentId) throw new Error('agentId is required');
    if (!competitionId) throw new Error('competitionId is required');
    if (!Array.isArray(winners) || winners.length === 0) {
        throw new Error('winners payload is required');
    }

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/winners/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            competition_id: competitionId,
            winners
        })
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to save winners');
        throw new Error(message);
    }

    return response.json();
}

export async function uploadIdImage(winnerId, blob, fallbackName = 'id_image.jpg') {
    if (!winnerId || !blob) return null;

    const authedFetch = getAuthedFetch();
    const formData = new FormData();
    appendFile(formData, 'id_image', blob, fallbackName);

    const response = await authedFetch(`/api/winners/${encodeURIComponent(winnerId)}/id-image`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to upload ID image');
        throw new Error(message);
    }
    return response.json();
}

export async function uploadVideo(winnerId, blob, fallbackName = 'video.webm') {
    if (!winnerId || !blob) return null;

    const authedFetch = getAuthedFetch();
    const formData = new FormData();
    appendFile(formData, 'video', blob, fallbackName);

    const response = await authedFetch(`/api/winners/${encodeURIComponent(winnerId)}/video`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to upload video');
        throw new Error(message);
    }
    return response.json();
}

export async function validateWinnersImages(winnerIds) {
    if (!Array.isArray(winnerIds) || winnerIds.length === 0) {
        throw new Error('winnerIds is required');
    }

    const authedFetch = getAuthedFetch();
    const response = await authedFetch('/api/agents/validate-winners-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerIds })
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to validate winners files');
        throw new Error(message);
    }

    return response.json();
}

export async function sendWinnersReport(agentId, winnerIds, messageText, options = {}) {
    if (!agentId) throw new Error('agentId is required');
    if (!Array.isArray(winnerIds) || winnerIds.length === 0) throw new Error('winnerIds is required');

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/send-winners-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            winnerIds,
            messageText,
            warnings: options.warnings || []
        })
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to send winners report');
        throw new Error(message);
    }

    return response.json();
}

export async function sendWinnersDetails(agentId, winnerIds, options = {}) {
    if (!agentId) throw new Error('agentId is required');
    if (!Array.isArray(winnerIds) || winnerIds.length === 0) throw new Error('winnerIds is required');

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/send-winners-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            winnerIds,
            include_warn_meet: !!options.includeWarnMeet,
            include_warn_prev: !!options.includeWarnPrev,
            warnings: options.warnings || []
        })
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to send winners details');
        throw new Error(message);
    }

    return response.json();
}

export async function completeCompetition(competitionId) {
    if (!competitionId) throw new Error('competitionId is required');

    const authedFetch = getAuthedFetch();
    const response = await authedFetch(`/api/competitions/${encodeURIComponent(competitionId)}/complete`, {
        method: 'POST'
    });

    if (!response.ok) {
        const message = await readErrorMessage(response, 'Failed to approve competition');
        throw new Error(message);
    }

    return response.json();
}
