/**
 * main.js
 * Entry point for the modular winner roulette page.
 */

import { state, config } from './state.js';
import * as ui from './ui.js';
import * as wheel from './wheel.js';
import * as camera from './camera.js';
import * as db from './db.js';
import * as api from './api.js';
import { createWinnerId, parseParticipantsInput, participantFingerprint } from './utils.js';

const dom = {};
let bootstrapPromise = null;
let beforeUnloadBound = false;
let initializedRoot = null;

export async function initWinnerRouletteModular() {
    const currentRoot = document.getElementById('winner-roulette-page');
    if (currentRoot && initializedRoot === currentRoot) return;

    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = bootstrap().finally(() => {
        bootstrapPromise = null;
    });
    return bootstrapPromise;
}

if (typeof window !== 'undefined') {
    window.initWinnerRouletteModular = initWinnerRouletteModular;

    const autoBoot = () => {
        if (!document.getElementById('winner-roulette-page')) return;
        initWinnerRouletteModular().catch((error) => {
            console.error('[winner-roulette modular] bootstrap failed', error);
            ui.toast('Failed to start winner roulette modular page', 'error');
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoBoot, { once: true });
    } else {
        autoBoot();
    }
}

async function bootstrap() {
    bindDom();
    ensureRequiredDom();
    ensureContextControls();
    bindContextDom();
    bindEventListeners();

    await db.initDB().catch((error) => {
        console.warn('[winner-roulette modular] IndexedDB not available', error);
    });

    restoreSession();
    syncControlsFromState();
    syncPredeterminedWinners();
    ui.renderParticipants();
    ui.renderWinners();
    wheel.drawWheel();

    await hydrateWinnersFromIndexedDb();
    await loadAgents();
    refreshContextStatus();

    initializedRoot = dom.root;
}

function bindDom() {
    dom.root = document.getElementById('winner-roulette-page');
    dom.pageHeader = dom.root?.querySelector('.page-header') || null;

    dom.participantsInput = document.getElementById('participants-input');
    dom.addParticipantsBtn = document.getElementById('add-participants-btn');
    dom.excludeWinnerCb = document.getElementById('exclude-winner');
    dom.spinSpeed = document.getElementById('spin-speed');
    dom.predeterminedWinner = document.getElementById('predetermined-winner');
    dom.wheelCanvas = document.getElementById('winner-roulette-wheel');
    dom.wheelCenter = document.querySelector('.wr-wheel-center');
    dom.autoPickBtn = document.getElementById('auto-pick-btn');
    dom.resetWheelBtn = document.getElementById('reset-wheel');

    dom.warnMeetCb = document.getElementById('warn-meet-client');
    dom.warnPrevCb = document.getElementById('warn-prev-winner');
    dom.depositCount = document.getElementById('wr-deposit-count');
    dom.tradingCount = document.getElementById('wr-trading-count');

    dom.saveSessionBtn = document.getElementById('save-session');
    dom.exportWinnersBtn = document.getElementById('export-winners');
    dom.sendReportBtn = document.getElementById('send-winners-report');
    dom.sendDetailsBtn = document.getElementById('send-winners-details');
    dom.openWheelOfNamesBtn = document.getElementById('open-wheelofnames');
}

function ensureRequiredDom() {
    if (!dom.root || !dom.participantsInput || !dom.wheelCanvas) {
        throw new Error('winner roulette modular DOM is not ready');
    }
}

function ensureContextControls() {
    let container = document.getElementById('wr-modular-context');
    if (container) return;

    container = document.createElement('div');
    container.id = 'wr-modular-context';
    container.style.cssText = [
        'margin-top:12px',
        'padding:12px',
        'border:1px solid rgba(99,102,241,0.28)',
        'border-radius:12px',
        'background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(14,165,233,0.06))'
    ].join(';');

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
        <div>
          <label for="wr-agent-select" style="display:block;font-size:0.82rem;margin-bottom:4px;">Agent</label>
          <select id="wr-agent-select" class="wr-agent-dropdown" style="width:100%;"></select>
        </div>
        <div>
          <label for="wr-competition-select" style="display:block;font-size:0.82rem;margin-bottom:4px;">Competition</label>
          <select id="wr-competition-select" class="wr-agent-dropdown" style="width:100%;"></select>
        </div>
        <button id="wr-approve-competition" class="wr-btn wr-btn-success" type="button" style="height:44px;">Approve</button>
      </div>
      <div id="wr-context-status" style="margin-top:8px;font-size:0.82rem;color:#475569;">Select agent and competition.</div>
    `;

    (dom.pageHeader || dom.root).appendChild(container);
}

function bindContextDom() {
    dom.agentSelect = document.getElementById('wr-agent-select');
    dom.competitionSelect = document.getElementById('wr-competition-select');
    dom.approveCompetitionBtn = document.getElementById('wr-approve-competition');
    dom.contextStatus = document.getElementById('wr-context-status');
}

function bindEventListeners() {
    if (dom.root.dataset.modularBound === '1') return;
    dom.root.dataset.modularBound = '1';

    dom.addParticipantsBtn?.addEventListener('click', onAddParticipants);
    dom.participantsInput?.addEventListener('keydown', onParticipantsKeydown);
    dom.excludeWinnerCb?.addEventListener('change', () => {
        state.excludeWinner = !!dom.excludeWinnerCb.checked;
        persistSession();
    });
    dom.predeterminedWinner?.addEventListener('change', () => {
        state.predeterminedWinnerId = dom.predeterminedWinner.value || '';
        persistSession();
    });
    dom.warnMeetCb?.addEventListener('change', () => {
        state.includeWarnMeet = !!dom.warnMeetCb.checked;
        persistSession();
    });
    dom.warnPrevCb?.addEventListener('change', () => {
        state.includeWarnPrev = !!dom.warnPrevCb.checked;
        persistSession();
    });

    dom.agentSelect?.addEventListener('change', () => onAgentChanged(dom.agentSelect.value || ''));
    dom.competitionSelect?.addEventListener('change', () => onCompetitionChanged(dom.competitionSelect.value || ''));
    dom.approveCompetitionBtn?.addEventListener('click', onApproveCompetition);

    dom.resetWheelBtn?.addEventListener('click', onResetWheel);
    dom.autoPickBtn?.addEventListener('click', onSpinRequested);
    dom.wheelCanvas?.addEventListener('click', onWheelClick);
    dom.wheelCenter?.addEventListener('click', onSpinRequested);

    dom.saveSessionBtn?.addEventListener('click', () => {
        persistSession();
        ui.toast('Session saved', 'success');
    });
    dom.exportWinnersBtn?.addEventListener('click', exportWinners);
    dom.sendReportBtn?.addEventListener('click', onSendReport);
    dom.sendDetailsBtn?.addEventListener('click', onSendDetails);
    dom.openWheelOfNamesBtn?.addEventListener('click', openWheelOfNames);

    if (!beforeUnloadBound) {
        window.addEventListener('beforeunload', persistSession);
        beforeUnloadBound = true;
    }
}

function onParticipantsKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        onAddParticipants();
    }
}

function onResetWheel() {
    if (state.spinning) return;
    state.angle = 0;
    state.startAngle = 0;
    state.targetAngle = 0;
    wheel.drawWheel();
}

function onWheelClick(event) {
    if (state.spinning) return;
    if (!isCenterClick(event)) return;
    onSpinRequested();
}

function onAddParticipants() {
    const raw = dom.participantsInput?.value || '';
    const parsedEntries = parseParticipantsInput(raw);
    if (!parsedEntries.length) {
        ui.toast('No valid lines were found', 'warning');
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
        ui.toast('All entries already exist', 'info');
        return;
    }

    dom.participantsInput.value = '';
    syncPredeterminedWinners();
    ui.renderParticipants();
    wheel.drawWheel();
    persistSession();
    ui.toast(`Added ${addedCount} participants`, 'success');
}

async function loadAgents() {
    if (!dom.agentSelect) return;

    state.loadingAgents = true;
    setContextStatus('Loading agents...');
    renderAgentOptions();

    try {
        const rawAgents = await api.fetchAgents();
        state.agents = rawAgents.map(normalizeAgent).filter((agent) => !!agent.id);
        renderAgentOptions();

        const route = readRouteContextParams();
        const preferredAgentId = route.agentId || state.selectedAgent?.id || state.agents[0]?.id || '';
        if (preferredAgentId) {
            dom.agentSelect.value = preferredAgentId;
            await onAgentChanged(preferredAgentId, { silent: true });
        }

        const preferredCompetitionId = route.competitionId || state.activeCompetition?.id || '';
        if (preferredCompetitionId && dom.competitionSelect) {
            dom.competitionSelect.value = preferredCompetitionId;
            await onCompetitionChanged(preferredCompetitionId, { silent: true });
        }
    } catch (error) {
        console.error('[winner-roulette modular] failed to load agents', error);
        ui.toast(`Failed to load agents: ${error.message}`, 'error');
        setContextStatus('Failed to load agents');
    } finally {
        state.loadingAgents = false;
    }
}

async function onAgentChanged(agentId, options = {}) {
    if (!agentId) {
        state.selectedAgent = null;
        state.activeCompetition = null;
        state.competitions = [];
        renderCompetitionOptions();
        refreshContextStatus();
        persistSession();
        return;
    }

    const selectedAgent = state.agents.find((agent) => agent.id === agentId);
    state.selectedAgent = selectedAgent || { id: agentId, name: `Agent ${agentId}`, agentId: '' };
    state.activeCompetition = null;
    state.competitions = [];
    renderCompetitionOptions();
    persistSession();
    refreshContextStatus();

    await loadCompetitionsForAgent(agentId, options);
}

async function loadCompetitionsForAgent(agentId, options = {}) {
    state.loadingCompetitions = true;
    setContextStatus('Loading competitions...');
    renderCompetitionOptions();

    try {
        const rawCompetitions = await api.fetchCompetitions(agentId);
        state.competitions = rawCompetitions
            .map(normalizeCompetition)
            .filter((competition) => !!competition.id);
        renderCompetitionOptions();

        const preferredId = options.preserveSelection
            ? (state.activeCompetition?.id || '')
            : (
                dom.competitionSelect?.value
                || state.activeCompetition?.id
                || pickDefaultCompetitionId(state.competitions)
            );
        if (preferredId) {
            const exists = state.competitions.some((competition) => competition.id === preferredId);
            if (exists) {
                dom.competitionSelect.value = preferredId;
                await onCompetitionChanged(preferredId, { silent: true });
            }
        }
    } catch (error) {
        console.error('[winner-roulette modular] failed to load competitions', error);
        ui.toast(`Failed to load competitions: ${error.message}`, 'error');
        setContextStatus('Failed to load competitions');
    } finally {
        state.loadingCompetitions = false;
    }
}

async function onCompetitionChanged(competitionId, options = {}) {
    if (!competitionId) {
        state.activeCompetition = null;
        persistSession();
        refreshContextStatus();
        return;
    }

    let selected = state.competitions.find((competition) => competition.id === competitionId);
    if (!selected) {
        const details = await api.fetchCompetitionById(competitionId).catch(() => null);
        selected = details ? normalizeCompetition(details) : null;
    }

    state.activeCompetition = selected || {
        id: competitionId,
        name: `Competition ${competitionId}`,
        status: '',
        totalRequired: 0,
        tradingWinnersRequired: 0,
        depositWinnersRequired: 0,
        prizePerWinner: 0,
        depositBonusPercentage: 0
    };
    persistSession();
    refreshContextStatus();

    if (!options.skipRemote) {
        await loadRemoteWinners();
    }
}

async function loadRemoteWinners() {
    if (!state.selectedAgent?.id || !state.activeCompetition?.id) return;

    try {
        const remote = await api.fetchWinners(state.selectedAgent.id, state.activeCompetition.id);
        const existingById = new Map(
            state.winners
                .filter((winner) => winner._id && winner.competitionId === state.activeCompetition.id)
                .map((winner) => [winner._id, winner])
        );
        const remoteMapped = remote
            .map((winner) => normalizeWinnerFromBackend(winner, state.activeCompetition.id))
            .filter((winner) => !!winner._id)
            .map((winner) => {
                const previous = existingById.get(winner._id);
                if (!previous) return winner;
                return {
                    ...winner,
                    includeWarnMeet: !!previous.includeWarnMeet,
                    includeWarnPrev: !!previous.includeWarnPrev,
                    pendingVideoBlob: previous.pendingVideoBlob || null,
                    pendingIdImage: previous.pendingIdImage || null,
                    localAssetKey: previous.localAssetKey || winner.localAssetKey || winner.id
                };
            });

        const localUnsynced = state.winners.filter((winner) =>
            !winner._id && winner.competitionId === state.activeCompetition.id
        );
        const otherCompetitions = state.winners.filter(
            (winner) => winner.competitionId && winner.competitionId !== state.activeCompetition.id
        );
        state.winners = [...otherCompetitions, ...remoteMapped, ...localUnsynced];

        await hydrateWinnersFromIndexedDb();
        ui.renderWinners();
        refreshContextStatus();
    } catch (error) {
        console.error('[winner-roulette modular] failed to load remote winners', error);
        ui.toast(`Failed to load winners: ${error.message}`, 'warning');
    }
}

function renderAgentOptions() {
    if (!dom.agentSelect) return;

    dom.agentSelect.innerHTML = '<option value="">Select agent</option>';
    state.agents.forEach((agent) => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.agentId ? `${agent.name} (#${agent.agentId})` : agent.name;
        dom.agentSelect.appendChild(option);
    });

    if (state.selectedAgent?.id) {
        dom.agentSelect.value = state.selectedAgent.id;
    }
}

function renderCompetitionOptions() {
    if (!dom.competitionSelect) return;

    dom.competitionSelect.innerHTML = '<option value="">Select competition</option>';
    state.competitions.forEach((competition) => {
        const option = document.createElement('option');
        option.value = competition.id;
        option.textContent = competition.status
            ? `${competition.name} [${competition.status}]`
            : competition.name;
        dom.competitionSelect.appendChild(option);
    });

    if (state.activeCompetition?.id) {
        dom.competitionSelect.value = state.activeCompetition.id;
    }
}

function refreshContextStatus() {
    const agent = state.selectedAgent?.name || 'none';
    const competition = state.activeCompetition?.name || 'none';
    const winners = getCompetitionWinners().length;
    refreshPrizeStats();
    setContextStatus(`Agent: ${agent} | Competition: ${competition} | Winners: ${winners}`);
}

function setContextStatus(text) {
    if (!dom.contextStatus) return;
    dom.contextStatus.textContent = text;
}

function onSpinRequested() {
    if (state.spinning) return;
    if (!state.selectedAgent?.id || !state.activeCompetition?.id) {
        ui.toast('Select agent and competition first', 'warning');
        return;
    }

    const requiredTotal = Number(state.activeCompetition?.totalRequired || 0);
    if (requiredTotal > 0 && getCompetitionWinners().length >= requiredTotal) {
        ui.toast(`Winners target reached (${requiredTotal})`, 'info');
        return;
    }

    const candidates = state.entries;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        ui.toast('Add participants first', 'warning');
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
                    ui.toast('Winner skipped', 'info');
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
    const autoPrize = getAutoPrizeInfo();
    const winnersBeforeInsert = getCompetitionWinners();
    const winner = {
        id: createWinnerId(),
        _id: null,
        name: sourceEntry?.name || '',
        account: sourceEntry?.account || '',
        email: form?.email || '',
        nationalId: form?.nationalId || '',
        competitionId: state.activeCompetition?.id || null,
        orderNumber: winnersBeforeInsert.length + 1,
        prizeType: autoPrize.prizeType,
        prizeValue: autoPrize.prizeValue,
        includeWarnMeet: !!state.includeWarnMeet,
        includeWarnPrev: !!state.includeWarnPrev,
        timestamp: new Date().toISOString(),
        recordingMimeType: state.recordingMimeType || null,
        hasVideo: !!state.pendingVideoBlob,
        hasIdImage: !!form?.idImageBlob,
        localIdImageName: form?.idImageName || null,
        localAssetKey: null,
        pendingVideoBlob: state.pendingVideoBlob || null,
        pendingIdImage: form?.idImageBlob || null
    };
    winner.localAssetKey = winner.id;

    state.winners.push(winner);

    if (state.excludeWinner) {
        state.entries = state.entries.filter((entry) => entry.id !== sourceEntry.id);
    }
    if (state.predeterminedWinnerId === sourceEntry.id) {
        state.predeterminedWinnerId = '';
    }

    const tasks = [db.saveWinnerLocal(winner)];
    if (winner.pendingVideoBlob) tasks.push(db.saveVideoToDB(winner.id, winner.pendingVideoBlob));
    if (winner.pendingIdImage) tasks.push(db.saveImageToDB(winner.id, winner.pendingIdImage));
    await Promise.allSettled(tasks);

    state.pendingVideoBlob = null;
    syncPredeterminedWinners();
    ui.renderParticipants();
    ui.renderWinners();
    wheel.drawWheel();
    persistSession();
    refreshContextStatus();
    ui.toast('Winner staged locally', 'success');
}

async function saveAllWinnersToDatabase() {
    if (!state.selectedAgent?.id || !state.activeCompetition?.id) {
        throw new Error('Select agent and competition first');
    }

    if (state.syncingWinners) return;
    state.syncingWinners = true;

    try {
        const competitionWinners = getCompetitionWinners();
        ensureWinnerOrderNumbers(competitionWinners);

        const unsavedWinners = competitionWinners.filter((winner) => !winner._id);
        if (unsavedWinners.length > 0) {
            const payload = buildImportWinnersPayload(unsavedWinners);
            const response = await api.importWinners(
                state.selectedAgent.id,
                state.activeCompetition.id,
                payload
            );
            const imported = Array.isArray(response?.winners) ? response.winners : [];

            const importedMap = resolveImportedWinnerMap(imported);
            for (let i = 0; i < unsavedWinners.length; i += 1) {
                const winner = unsavedWinners[i];
                const oldId = winner.id;
                const importedWinner = importedMap.get(`import_${oldId}`) || imported[i] || null;
                const newId = importedWinner?._id || importedWinner?.id || null;
                if (!newId) {
                    throw new Error(`Could not resolve winner id for ${winner.name}`);
                }

                winner._id = newId;
                winner.id = newId;
                await migrateWinnerAssetKeys(oldId, newId);
            }
        }

        for (const winner of competitionWinners) {
            await uploadWinnerAssets(winner);
            await db.saveWinnerLocal(winner);
        }
    } finally {
        state.syncingWinners = false;
    }

    persistSession();
    ui.renderWinners();
    refreshContextStatus();
}

async function uploadWinnerAssets(winner) {
    if (!winner?._id) return;
    const localAssetKey = winner.localAssetKey || winner.id;

    if (winner.pendingVideoBlob instanceof Blob) {
        const extension = 'mp4';
        await api.uploadVideo(winner._id, winner.pendingVideoBlob, `winner_${winner._id}.${extension}`);
        winner.hasVideo = true;
        winner.pendingVideoBlob = null;
        await db.deleteVideoFromDB(localAssetKey).catch(() => {});
    }

    if (winner.pendingIdImage instanceof Blob) {
        const fallbackName = winner.localIdImageName || `id_${winner._id}.jpg`;
        await api.uploadIdImage(winner._id, winner.pendingIdImage, fallbackName);
        winner.hasIdImage = true;
        winner.pendingIdImage = null;
        await db.deleteImageFromDB(localAssetKey).catch(() => {});
    }

    winner.localAssetKey = winner.id;
}

async function onSendReport() {
    try {
        ensureReadyForSending();
        ui.toast('Syncing winners...', 'info');
        await saveAllWinnersToDatabase();

        const winners = state.winners.filter((winner) =>
            winner._id && winner.competitionId === state.activeCompetition.id
        );
        const winnerIds = winners.map((winner) => winner._id);
        if (!winnerIds.length) {
            ui.toast('No synced winners to send', 'warning');
            return;
        }

        await validateCompetitionWinnersOnServer(winnerIds);
        const warnings = winners.map((winner) => ({
            winnerId: winner._id,
            include_warn_meet: !!(winner.includeWarnMeet || state.includeWarnMeet),
            include_warn_prev: !!(winner.includeWarnPrev || state.includeWarnPrev)
        }));
        await api.sendWinnersReport(
            state.selectedAgent.id,
            winnerIds,
            generateWinnersMessage(),
            { warnings }
        );
        ui.toast('Winners report sent', 'success');
    } catch (error) {
        console.error('[winner-roulette modular] send report failed', error);
        ui.toast(`Send report failed: ${error.message}`, 'error');
    }
}

async function onSendDetails() {
    try {
        ensureReadyForSending();
        ui.toast('Syncing winners...', 'info');
        await saveAllWinnersToDatabase();

        const winners = state.winners.filter((winner) =>
            winner._id && winner.competitionId === state.activeCompetition.id
        );
        const winnerIds = winners.map((winner) => winner._id);
        if (!winnerIds.length) {
            ui.toast('No synced winners to send', 'warning');
            return;
        }

        await validateCompetitionWinnersOnServer(winnerIds);
        const warnings = winners.map((winner) => ({
            winnerId: winner._id,
            include_warn_meet: !!(winner.includeWarnMeet || state.includeWarnMeet),
            include_warn_prev: !!(winner.includeWarnPrev || state.includeWarnPrev)
        }));

        await api.sendWinnersDetails(state.selectedAgent.id, winnerIds, {
            includeWarnMeet: !!state.includeWarnMeet,
            includeWarnPrev: !!state.includeWarnPrev,
            warnings
        });

        ui.toast('Winners details sent', 'success');
    } catch (error) {
        console.error('[winner-roulette modular] send details failed', error);
        ui.toast(`Send details failed: ${error.message}`, 'error');
    }
}

async function onApproveCompetition() {
    if (!state.activeCompetition?.id) {
        ui.toast('Select competition first', 'warning');
        return;
    }

    try {
        await saveAllWinnersToDatabase();
        await api.completeCompetition(state.activeCompetition.id);
        ui.toast('Competition approved', 'success');
    } catch (error) {
        console.error('[winner-roulette modular] approve failed', error);
        ui.toast(`Approve failed: ${error.message}`, 'error');
    }
}

function ensureReadyForSending() {
    if (!state.selectedAgent?.id || !state.activeCompetition?.id) {
        throw new Error('Select agent and competition first');
    }
    if (!getCompetitionWinners().length) {
        throw new Error('No winners available');
    }
}

function getCompetitionWinnerIds() {
    return [...new Set(getCompetitionWinners()
        .filter((winner) => !!winner._id)
        .map((winner) => winner._id))];
}

function generateWinnersMessage() {
    const winners = [...getCompetitionWinners()].sort((a, b) => {
        const orderA = Number.isFinite(Number(a.orderNumber)) ? Number(a.orderNumber) : 9999;
        const orderB = Number.isFinite(Number(b.orderNumber)) ? Number(b.orderNumber) : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    if (!winners.length) return '';

    const lines = winners.map((winner, index) => {
        const rank = winner.orderNumber || index + 1;
        const prize = (winner.prizeType === 'deposit' || winner.prizeType === 'deposit_prev')
            ? `${winner.prizeValue}% deposit bonus`
            : `$${winner.prizeValue} trading bonus`;
        return `Winner ${rank}: ${winner.name} (${winner.account}) - ${prize}`;
    });

    return `${lines.join('\n')}\n\nContact: https://t.me/Ibinzo`;
}

function exportWinners() {
    if (!state.winners.length) {
        ui.toast('No winners to export', 'warning');
        return;
    }

    const blob = new Blob([JSON.stringify(state.winners, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `winners_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function openWheelOfNames() {
    const labels = state.entries.map((entry) =>
        entry.account ? `${entry.name} - ${entry.account}` : entry.name
    );

    if (!labels.length) {
        ui.toast('No entries to open in Wheel of Names', 'warning');
        return;
    }

    const url = `https://wheelofnames.com/view?entries=${encodeURIComponent(labels.join(','))}`;
    window.open(url, '_blank');
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
            _id: winner._id || null,
            name: winner.name,
            account: winner.account,
            email: winner.email,
            nationalId: winner.nationalId,
            competitionId: winner.competitionId || null,
            orderNumber: winner.orderNumber || null,
            prizeType: winner.prizeType || 'trading',
            prizeValue: winner.prizeValue || 0,
            includeWarnMeet: !!winner.includeWarnMeet,
            includeWarnPrev: !!winner.includeWarnPrev,
            timestamp: winner.timestamp,
            recordingMimeType: winner.recordingMimeType || null,
            hasVideo: !!winner.hasVideo,
            hasIdImage: !!winner.hasIdImage,
            localIdImageName: winner.localIdImageName || null,
            localAssetKey: winner.localAssetKey || winner.id
        })),
        angle: state.angle,
        excludeWinner: !!state.excludeWinner,
        predeterminedWinnerId: state.predeterminedWinnerId || '',
        includeWarnMeet: !!state.includeWarnMeet,
        includeWarnPrev: !!state.includeWarnPrev,
        selectedAgent: state.selectedAgent || null,
        activeCompetition: state.activeCompetition || null
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
        state.winners = Array.isArray(payload.winners)
            ? payload.winners.map((winner) => ({
                ...winner,
                _id: winner._id || (isMongoObjectId(winner.id) ? winner.id : null),
                orderNumber: winner.orderNumber || null,
                localAssetKey: winner.localAssetKey || winner.id
            }))
            : [];
        state.angle = Number.isFinite(payload.angle) ? payload.angle : 0;
        state.excludeWinner = !!payload.excludeWinner;
        state.predeterminedWinnerId = payload.predeterminedWinnerId || '';
        state.includeWarnMeet = !!payload.includeWarnMeet;
        state.includeWarnPrev = !!payload.includeWarnPrev;
        state.selectedAgent = payload.selectedAgent || null;
        state.activeCompetition = payload.activeCompetition || null;
    } catch (error) {
        console.warn('[winner-roulette modular] failed to restore session', error);
    }
}

async function hydrateWinnersFromIndexedDb() {
    if (!state.winners.length) {
        const localWinners = await db.getLocalWinners().catch(() => []);
        if (Array.isArray(localWinners) && localWinners.length > 0) {
            state.winners = localWinners;
        }
    }

    if (!state.winners.length) return;

    state.winners = state.winners.map((winner) => ({
        ...winner,
        _id: winner._id || (isMongoObjectId(winner.id) ? winner.id : null),
        orderNumber: winner.orderNumber || null,
        localAssetKey: winner.localAssetKey || winner.id,
        includeWarnMeet: !!winner.includeWarnMeet,
        includeWarnPrev: !!winner.includeWarnPrev,
        hasVideo: !!winner.hasVideo,
        hasIdImage: !!winner.hasIdImage
    }));

    const hydrationTasks = state.winners.map(async (winner) => {
        if (!winner?.id) return;
        const assetKey = winner.localAssetKey || winner.id;

        if (winner.hasVideo) {
            winner.pendingVideoBlob = await db.getVideoFromDB(assetKey).catch(() => null);
            if (!winner.pendingVideoBlob && assetKey !== winner.id) {
                winner.pendingVideoBlob = await db.getVideoFromDB(winner.id).catch(() => null);
            }
        }
        if (winner.hasIdImage) {
            winner.pendingIdImage = await db.getImageFromDB(assetKey).catch(() => null);
            if (!winner.pendingIdImage && assetKey !== winner.id) {
                winner.pendingIdImage = await db.getImageFromDB(winner.id).catch(() => null);
            }
        }
    });
    await Promise.allSettled(hydrationTasks);
}

function syncControlsFromState() {
    if (dom.excludeWinnerCb) dom.excludeWinnerCb.checked = !!state.excludeWinner;
    if (dom.predeterminedWinner) dom.predeterminedWinner.value = state.predeterminedWinnerId || '';
    if (dom.warnMeetCb) dom.warnMeetCb.checked = !!state.includeWarnMeet;
    if (dom.warnPrevCb) dom.warnPrevCb.checked = !!state.includeWarnPrev;
}

function syncPredeterminedWinners() {
    if (!dom.predeterminedWinner) return;
    const previousValue = state.predeterminedWinnerId || '';

    dom.predeterminedWinner.innerHTML = '<option value="">Random</option>';
    state.entries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.account ? `${entry.name} - ${entry.account}` : entry.name;
        dom.predeterminedWinner.appendChild(option);
    });

    const hasPrevious = state.entries.some((entry) => entry.id === previousValue);
    state.predeterminedWinnerId = hasPrevious ? previousValue : '';
    dom.predeterminedWinner.value = state.predeterminedWinnerId;
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
        const forced = snapshot.findIndex((entry) => entry.id === state.predeterminedWinnerId);
        if (forced >= 0) return forced;
    }
    return secureRandomInt(snapshot.length);
}

function computeSpinTarget(winnerIndex, totalEntries) {
    const slice = (Math.PI * 2) / totalEntries;
    const targetAngleBase = winnerIndex * slice + slice / 2 + Math.PI;
    const rotations = 4 + secureRandomInt(3);
    const offset = (secureRandomFloat() - 0.5) * slice * 0.6;

    state.startAngle = state.angle;
    state.targetAngle = targetAngleBase + rotations * Math.PI * 2 + offset + 1e-6;
    state.spinDuration = getSpinDuration(dom.spinSpeed?.value || 'normal');
}

function getSpinDuration(speed) {
    if (speed === 'fast') return 2800;
    if (speed === 'slow') return 8200;
    return 4500;
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

function readRouteContextParams() {
    let agentId = '';
    let competitionId = '';

    try {
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
            agentId = hashParams.get('agent_id') || agentId;
            competitionId = hashParams.get('competition_id') || competitionId;
        }
    } catch (_) {}

    try {
        const params = new URLSearchParams(window.location.search || '');
        agentId = params.get('agent_id') || agentId;
        competitionId = params.get('competition_id') || competitionId;
    } catch (_) {}

    return { agentId, competitionId };
}

function normalizeAgent(raw) {
    return {
        id: raw?._id || raw?.id || '',
        name: raw?.name || 'Unknown Agent',
        agentId: raw?.agent_id || raw?.agentId || ''
    };
}

function normalizeCompetition(raw) {
    const tradingWinnersRequired = Number(
        raw?.trading_winners_count
        ?? raw?.tradingWinnersRequired
        ?? raw?.winners_count
        ?? 0
    ) || 0;
    const depositWinnersRequired = Number(
        raw?.deposit_winners_count
        ?? raw?.depositWinnersRequired
        ?? 0
    ) || 0;
    const fallbackTotal = tradingWinnersRequired + depositWinnersRequired;
    const totalRequired = Number(
        raw?.required_winners
        ?? raw?.totalRequired
        ?? raw?.requiredWinners
        ?? fallbackTotal
    ) || fallbackTotal;
    const prizePerWinner = Number(
        raw?.prize_per_winner
        ?? raw?.prizePerWinner
        ?? raw?.prizeValue
        ?? 0
    ) || 0;

    return {
        id: raw?._id || raw?.id || '',
        name: raw?.name || raw?.title || 'Competition',
        status: raw?.status || '',
        prizeValue: prizePerWinner,
        prizePerWinner,
        depositBonusPercentage: Number(
            raw?.deposit_bonus_percentage
            ?? raw?.depositBonusPercentage
            ?? 0
        ) || 0,
        tradingWinnersRequired,
        depositWinnersRequired,
        totalRequired,
        requiredWinners: totalRequired,
        currentWinners: Number(raw?.current_winners_count ?? raw?.currentWinners ?? 0) || 0
    };
}

function normalizeWinnerFromBackend(raw, competitionId) {
    const backendId = raw?._id || raw?.id || null;
    return {
        id: backendId || createWinnerId(),
        _id: backendId,
        name: raw?.name || '',
        account: raw?.account_number || raw?.account || '',
        email: raw?.email || '',
        nationalId: raw?.national_id || '',
        competitionId: competitionId || null,
        orderNumber: Number(raw?.order_number || 0) || null,
        prizeType: raw?.prize_type || 'trading',
        prizeValue: Number(raw?.prize_value || 0),
        includeWarnMeet: !!raw?.includeWarnMeet,
        includeWarnPrev: !!raw?.includeWarnPrev,
        timestamp: raw?.selected_at || raw?.createdAt || new Date().toISOString(),
        recordingMimeType: null,
        hasVideo: !!raw?.video_url,
        hasIdImage: !!raw?.national_id_image,
        localAssetKey: backendId || null
    };
}

function getCompetitionWinners() {
    const competitionId = state.activeCompetition?.id;
    if (!competitionId) return [];
    return state.winners.filter((winner) => winner.competitionId === competitionId);
}

function refreshPrizeStats() {
    if (!dom.depositCount || !dom.tradingCount) return;

    const competition = state.activeCompetition;
    if (!competition) {
        dom.depositCount.textContent = '0 / 0 winners';
        dom.tradingCount.textContent = '0 / 0 winners';
        return;
    }

    const winners = getCompetitionWinners();
    const depositCurrent = winners.filter(
        (winner) => winner.prizeType === 'deposit' || winner.prizeType === 'deposit_prev'
    ).length;
    const tradingCurrent = winners.filter((winner) => winner.prizeType === 'trading').length;

    dom.depositCount.textContent = `${depositCurrent} / ${competition.depositWinnersRequired || 0} winners`;
    dom.tradingCount.textContent = `${tradingCurrent} / ${competition.tradingWinnersRequired || 0} winners`;
}

function getAutoPrizeInfo() {
    const competition = state.activeCompetition;
    if (!competition) {
        return { prizeType: 'trading', prizeValue: 0 };
    }

    const winners = getCompetitionWinners();
    const currentDeposit = winners.filter(
        (winner) => winner.prizeType === 'deposit' || winner.prizeType === 'deposit_prev'
    ).length;
    const currentTrading = winners.filter((winner) => winner.prizeType === 'trading').length;

    let prizeType = 'trading';
    if (currentTrading < (competition.tradingWinnersRequired || 0)) {
        prizeType = 'trading';
    } else if (currentDeposit < (competition.depositWinnersRequired || 0)) {
        prizeType = 'deposit';
    }

    const prizeValue = prizeType === 'deposit'
        ? Number(competition.depositBonusPercentage || 0)
        : Number(competition.prizePerWinner || competition.prizeValue || 0);

    return { prizeType, prizeValue };
}

function ensureWinnerOrderNumbers(winners) {
    const sorted = [...winners].sort((a, b) => {
        const orderA = Number(a.orderNumber || 0);
        const orderB = Number(b.orderNumber || 0);
        if (orderA > 0 && orderB > 0 && orderA !== orderB) return orderA - orderB;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    const used = new Set();
    let nextOrder = 1;
    for (const winner of sorted) {
        let order = Number(winner.orderNumber || 0);
        if (!Number.isInteger(order) || order <= 0 || used.has(order)) {
            while (used.has(nextOrder)) nextOrder += 1;
            order = nextOrder;
        }
        used.add(order);
        nextOrder = Math.max(nextOrder, order + 1);
        winner.orderNumber = order;
    }
}

function buildImportWinnersPayload(winners) {
    return winners.map((winner) => ({
        id: `import_${winner.id}`,
        name: winner.name || '',
        account_number: winner.account || '',
        email: winner.email || '',
        national_id: winner.nationalId || '',
        prize_type: winner.prizeType || 'trading',
        prize_value: Number(winner.prizeValue || 0),
        order_number: Number(winner.orderNumber || 0),
        selected_at: winner.timestamp || new Date().toISOString(),
        meta: {
            email: winner.email || '',
            national_id: winner.nationalId || '',
            prize_type: winner.prizeType || 'trading',
            prize_value: Number(winner.prizeValue || 0),
            original_import_id: `import_${winner.id}`
        }
    }));
}

function resolveImportedWinnerMap(importedWinners) {
    const map = new Map();
    for (const winner of importedWinners) {
        const key = winner?.meta?.original_import_id || winner?.meta?.originalImportId;
        if (key) map.set(key, winner);
    }
    return map;
}

async function migrateWinnerAssetKeys(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;

    try {
        const oldVideo = await db.getVideoFromDB(oldId).catch(() => null);
        if (oldVideo) {
            await db.saveVideoToDB(newId, oldVideo).catch(() => {});
        }
    } catch (_) {}

    try {
        const oldImage = await db.getImageFromDB(oldId).catch(() => null);
        if (oldImage) {
            await db.saveImageToDB(newId, oldImage).catch(() => {});
        }
    } catch (_) {}

    await db.removeWinnerAssets(oldId).catch(() => {});
}

async function validateCompetitionWinnersOnServer(winnerIds) {
    const result = await api.validateWinnersImages(winnerIds);
    if (result?.valid) return;

    const problems = Array.isArray(result?.invalidWinners) ? result.invalidWinners : [];
    if (!problems.length) {
        throw new Error('Winners files validation failed');
    }

    const preview = problems
        .slice(0, 3)
        .map((problem) => `${problem.name}: ${problem.reason}`)
        .join(' | ');
    const suffix = problems.length > 3 ? ` (+${problems.length - 3} more)` : '';
    throw new Error(`Validation failed: ${preview}${suffix}`);
}

function pickDefaultCompetitionId(competitions) {
    if (!Array.isArray(competitions) || competitions.length === 0) return '';
    const priority = ['active', 'awaiting_winners', 'sent'];
    for (const status of priority) {
        const selected = competitions.find((competition) => competition.status === status);
        if (selected?.id) return selected.id;
    }
    return competitions[0]?.id || '';
}

function isMongoObjectId(value) {
    return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
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
    return Math.hypot(x - cx, y - cy) <= 80;
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

