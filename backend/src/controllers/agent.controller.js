const Agent = require('../models/agent.model');
const path = require('path'); // Added
const Competition = require('../models/Competition');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const AgentRankChange = require('../models/AgentRankChange');
const Log = require('../models/Log');
const Winner = require('../models/Winner'); // Added
const { logActivity } = require('../utils/logActivity');
const { translateField, formatValue } = require('../utils/fieldTranslations');
const { postToTelegram, sendPhotoToTelegram, sendMediaGroupToTelegram } = require('../utils/telegram');
const { broadcastEvent } = require('../utils/notification');

// Helper function to introduce a delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates the next renewal date for an agent.
 * @param {object} agent The agent object, which must have renewal_period and last_renewal_date or createdAt.
 * @returns {Date|null} The next renewal date or null if not applicable.
 */
const calculateNextRenewalDate = (agent) => {
    if (!agent.renewal_period || agent.renewal_period === 'none') {
        return null;
    }

    const lastRenewal = agent.last_renewal_date || agent.createdAt;
    if (!lastRenewal) return null;

    let nextRenewalDate = new Date(lastRenewal);

    switch (agent.renewal_period) {
        case 'weekly':
            nextRenewalDate.setDate(nextRenewalDate.getDate() + 7);
            break;
        case 'biweekly':
            nextRenewalDate.setDate(nextRenewalDate.getDate() + 14);
            break;
        case 'monthly': {
            const originalDay = nextRenewalDate.getDate();
            nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
            if (nextRenewalDate.getDate() !== originalDay) {
                nextRenewalDate.setDate(0); // Set to the last day of the previous month
            }
            break;
        }
    }
    return nextRenewalDate;
};

exports.getAllAgents = async (req, res) => { // NOSONAR
    try {
        const { page = 1, limit = 10, search, classification, sort, eligibleForBalance, for_tasks, select, agent_ids } = req.query;

        let query = {};

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (classification && classification !== 'all') {
            query.classification = classification;
        }

        if (req.query.eligibleForBroadcast === 'true') {
            query.telegram_chat_id = { $nin: [null, '', 0] };
        } else if (eligibleForBalance === 'true') {
            query.$or = [ // This was the incorrect part
                { remaining_balance: { $gt: 0 } },
                { remaining_deposit_bonus: { $gt: 0 } }
            ];
        }

        if (for_tasks === 'today') {
            const dayOfWeekIndex = new Date().getDay();
            query.audit_days = { $in: [dayOfWeekIndex] };
        }

        // --- NEW: Handle bulk checking for existing agents ---
        if (agent_ids) {
            query.agent_id = { $in: agent_ids.split(',').map(id => id.trim()) };
        }

        let sortOptions = { createdAt: -1 };
        if (sort === 'name_asc') sortOptions = { name: 1 };

        const agents = await Agent.find(query)
            .select(select || '')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // --- NEW: Calculate and add next renewal date to each agent ---
        const agentsWithNextRenewal = agents.map(agent => ({
            ...agent,
            next_renewal_date: calculateNextRenewalDate(agent)
        }));

        const count = await Agent.countDocuments(query);

        res.json({
            data: agentsWithNextRenewal,
            count: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching agents.', error: error.message });
    }
};

exports.getAgentById = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id).lean();
        if (!agent) return res.status(404).json({ message: 'Agent not found.' });
        res.json({ data: agent });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching agent.', error: error.message });
    }
};

exports.getAgentCompetitionsSummary = async (req, res) => {
    try {
        const agentId = req.params.id;
        
        // Get agent details
        const agent = await Agent.findById(agentId).lean();
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }
        
        // Get all competitions for this agent
        const competitions = await Competition.find({ agent_id: agentId })
            .sort({ createdAt: -1 })
            .lean();
        
        // Compute compliance per competition and normalize processed date
        const dayMs = 24 * 60 * 60 * 1000;
        const enriched = competitions.map(c => {
            // Use ends_at as fallback if request wasn't explicitly sent
            const sentAt = c.winner_request_sent_at || c.ends_at || null;
            // Use processed_at (stats entry) as fallback if winners weren't selected via system
            const selectedAt = c.winners_selected_at || c.processed_at || null;
            
            let is_compliant = false;
            let compliance_details = null;
            
            if (sentAt && selectedAt) {
                const deltaMs = new Date(selectedAt).getTime() - new Date(sentAt).getTime();
                // Allow a small buffer (e.g. 1 hour) or just strict 24h? 
                // User said "same day", so 24h is good.
                // Note: deltaMs could be negative if they process BEFORE it ends (which is compliant)
                const within = deltaMs <= dayMs;
                is_compliant = within;
                
                const hours = Math.round(deltaMs / (60 * 60 * 1000));
                if (hours < 0) {
                     compliance_details = `ØªÙ… Ø§Ù„Ø¥Ù†Ø¬Ø§Ø² Ù…Ø¨ÙƒØ±Ø§Ù‹ (${Math.abs(hours)} Ø³Ø§Ø¹Ø©)`;
                } else {
                     compliance_details = within ? `ØªÙ… Ø§Ù„Ø¥Ù†Ø¬Ø§Ø² Ø®Ù„Ø§Ù„ ${hours} Ø³Ø§Ø¹Ø©` : `ØªØ£Ø®Ø± ${hours} Ø³Ø§Ø¹Ø©`;
                }
            } else if (!sentAt && selectedAt) {
                // If we don't know when it ended, but it is processed, assume compliant?
                // Or maybe just leave as false? 
                // Better to be strict, but if ends_at is missing, something is wrong with data.
                is_compliant = true; // Benefit of the doubt if data missing
                compliance_details = 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙˆÙ‚Øª ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø© (Ù…Ù‚Ø¨ÙˆÙ„)';
            }

            return {
                ...c,
                processed_at: selectedAt,
                is_compliant,
                compliance_details
            };
        });

        // Calculate statistics
        const totalCompetitions = enriched.length;
        const activeCompetitions = enriched.filter(c => c.status === 'active').length;
        const completedCompetitions = enriched.filter(c => c.status === 'completed').length;
        const pendingCompetitions = enriched.filter(c => c.status === 'pending').length;
        
        // Calculate total winners and prizes
        const totalWinners = enriched.reduce((sum, c) => sum + (c.winners_count || 0), 0);
        const totalPrizeAmount = enriched.reduce((sum, c) => sum + ((c.winners_count || 0) * (c.prize_per_winner || 0)), 0);
        
        // Calculate compliance rate (competitions sent vs expected)
        // Compliance rate: percent of competitions with high compliance among those with a selection
        const compsWithSelection = enriched.filter(c => c.winners_selected_at && c.winner_request_sent_at);
        const compliantCount = compsWithSelection.filter(c => c.is_compliant).length;
        const complianceRate = compsWithSelection.length > 0 ? Math.round((compliantCount / compsWithSelection.length) * 100) : 0;
        
        const statistics = {
            total_competitions: totalCompetitions,
            active_competitions: activeCompetitions,
            completed_competitions: completedCompetitions,
            pending_competitions: pendingCompetitions,
            total_winners: totalWinners,
            total_prize_amount: totalPrizeAmount,
            compliance_rate: Math.round(complianceRate)
        };
        
        res.json({
            agent: {
                id: agent._id,
                name: agent.name,
                classification: agent.classification,
                status: agent.status
            },
            competitions: enriched,
            statistics: statistics
        });
        
    } catch (error) {
        console.error('Error fetching agent competitions summary:', error);
        res.status(500).json({ message: 'Server error while fetching agent competitions summary.', error: error.message });
    }
};

exports.createAgent = async (req, res) => {
    try {
        // --- FIX: Ensure new agents are created with an 'Active' status by default ---
        req.body.status = req.body.status || 'Active';
        
        // --- DEBUG: Log Ø§Ù„ØªØµÙ†ÙŠÙ Ù„Ù„ØªØ£ÙƒØ¯ Ù…Ù† Ø¥Ø±Ø³Ø§Ù„Ù‡ ---
        console.log(`[Agent Create] Creating new agent with classification: ${req.body.classification || 'R (default)'}`);
        console.log('[Agent Create] AUDIT_DAYS received:', req.body.audit_days);
        console.log('[Agent Create] AUDIT_DAYS is array:', Array.isArray(req.body.audit_days));
        console.log(`[Agent Create] Full request body:`, JSON.stringify(req.body, null, 2));
        
        const agent = new Agent(req.body);
        await agent.save();
        
        // --- DEBUG: Log Ø§Ù„ØªØµÙ†ÙŠÙ Ø¨Ø¹Ø¯ Ø§Ù„Ø­ÙØ¸ ---
        console.log(`[Agent Create] Agent saved successfully with classification: ${agent.classification}`);
        console.log('[Agent Create] AUDIT_DAYS saved to DB:', agent.audit_days);
        console.log('[Agent Create] Complete saved agent:', JSON.stringify(agent, null, 2));
        
        // Log activity
        const userId = req.user?._id;
        if (userId) {
            const { logActivity } = require('../utils/logActivity');
            await logActivity(
                userId, 
                agent._id, 
                'AGENT_CREATED', 
                `ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ ÙˆÙƒÙŠÙ„ Ø¬Ø¯ÙŠØ¯: ${agent.name} (Ø§Ù„ØªØµÙ†ÙŠÙ: ${agent.classification})`
            ).catch(err => 
                console.warn('[Agent Create] Failed to log activity:', err)
            );
        }
        
        res.status(201).json({ data: agent });
    } catch (error) {
        console.error('[Agent Create Error]:', error);
        res.status(400).json({ message: 'Failed to create agent.', error: error.message });
    }
};

exports.updateAgent = async (req, res) => {
    try {
        // --- FIX: Add detailed activity logging on agent update ---
        const agentBeforeUpdate = await Agent.findById(req.params.id).lean();
        if (!agentBeforeUpdate) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        // --- FIX: Directly use req.body for the update payload ---
        const updatedAgent = await Agent.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });

        // --- FIX: Always log activity on update from the backend for reliability ---
        const userId = req.user?._id; // Use optional chaining
        const hasProfileUpdate = ['name', 'telegram_channel_url', 'telegram_group_url', 'telegram_chat_id', 'telegram_group_name'].some(key => key in req.body);
        
        const actionType = hasProfileUpdate ? 'PROFILE_UPDATE' : 'DETAILS_UPDATE';
        const isFinancialUpdate = ['rank', 'competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'renewal_period', 'deposit_bonus_winners_count'].some(key => key in req.body);

        // ØªØ­Ø¶ÙŠØ± ÙˆØµÙ Ù…ÙØµÙ„ Ù„Ù„ØªØºÙŠÙŠØ±Ø§Øª
        const changes = Object.entries(req.body).map(([field, newValue]) => {
            const oldValue = agentBeforeUpdate[field];
            // Ù†ØªØ­Ù‚Ù‚ ÙÙ‚Ø· Ù…Ù† Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„ØªÙŠ ØªØºÙŠØ±Øª Ù‚ÙŠÙ…ØªÙ‡Ø§
            if (String(oldValue) === String(newValue)) return null;
            
            const arabicFieldName = translateField(field);
            return {
                field: arabicFieldName,
                from: formatValue(oldValue),
                to: formatValue(newValue)
            };
        }).filter(change => change !== null); // Ù†Ø²ÙŠÙ„ Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„ØªÙŠ Ù„Ù… ØªØªØºÙŠØ±

        const description = changes.length > 0 
            ? `ØªÙ… ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙˆÙƒÙŠÙ„:\n${changes.map(c => `${c.field}: Ù…Ù† "${c.from}" Ø¥Ù„Ù‰ "${c.to}"`).join('\n')}`.trim()
            : 'ØªÙ… ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙˆÙƒÙŠÙ„ Ø¨Ø¯ÙˆÙ† ØªØºÙŠÙŠØ±Ø§Øª Ù…Ù„Ø­ÙˆØ¸Ø©';

        // --- FIX: Only log if a user context exists and there were actual changes ---
        if (userId && changes.length > 0) {
             await logActivity(userId, updatedAgent._id, actionType, description, {
                 changes: changes
             });
        }

        // --- NEW DEBUG: Log the saved data to see what was actually persisted ---
        // console.log('[Agent Update] Data after saving to database:', JSON.stringify(updatedAgent, null, 2));

        res.json({ data: updatedAgent });
    } catch (error) {
        console.error('[Agent Update Error]:', error);
        res.status(400).json({ 
            message: 'Failed to update agent.', 
            error: error.message 
        });
    }
};

/**
 * @desc    Delete ALL agents from the database
 * @route   DELETE /api/agents/delete-all
 * @access  Private (Super Admin only)
 */
exports.deleteAllAgents = async (req, res) => {
    try {
        console.log('[Delete All Agents] Starting full cascade deletion for all agents and related data...');

        // Delete related documents first to avoid orphans
        const [compRes, taskRes, winnerRes, activityRes, rankRes, adminLogRes] = await Promise.all([
            Competition.deleteMany({}),
            Task.deleteMany({}),
            Winner.deleteMany({}),
            ActivityLog.deleteMany({}),
            AgentRankChange.deleteMany({}),
            Log.deleteMany({})
        ]);

        console.log(`[Delete All Agents] Deleted competitions: ${compRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted tasks: ${taskRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted winners: ${winnerRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted activity logs: ${activityRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted rank/class changes: ${rankRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted admin logs: ${adminLogRes.deletedCount}`);

        const agentRes = await Agent.deleteMany({});
        console.log(`[Delete All Agents] Deleted agents: ${agentRes.deletedCount}`);

        res.json({ message: 'All agents and related data have been deleted successfully.' });
    } catch (error) {
        console.error('Error deleting all agents:', error);
        res.status(500).json({ message: 'Failed to delete all agents.', error: error.message });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        const agentId = req.params.id;
        const agent = await Agent.findById(agentId);

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        // --- NEW: Cascade delete for all associated data ---
        console.log(`[Delete Agent] Starting cascade delete for agent: ${agent.name} (${agentId})`);

        // 1. Delete Competitions
        const competitionResult = await Competition.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${competitionResult.deletedCount} competitions.`);

        // 2. Delete Tasks
        const taskResult = await Task.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${taskResult.deletedCount} tasks.`);

        // 3. Delete Winners
        const winnerResult = await Winner.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${winnerResult.deletedCount} winners.`);

        // 4. Delete Activity Logs related to this agent
        const logResult = await ActivityLog.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${logResult.deletedCount} activity logs.`);

        // 5. Delete Agent Rank/Classification Changes
        const rankChangeResult = await AgentRankChange.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${rankChangeResult.deletedCount} rank/classification change records.`);

        // 6. Delete admin-facing logs tied to this agent (Log collection)
        const adminLogResult = await Log.deleteMany({ agent_id: agentId });
        console.log(`[Delete Agent] Deleted ${adminLogResult.deletedCount} admin log entries.`);

        // 7. Now, delete the agent itself
        await Agent.findByIdAndDelete(agentId);
        console.log(`[Delete Agent] Successfully deleted agent document.`);

        // --- FIX: Log this action ---
        const userId = req.user?._id;
        if (userId) { // Log even if agent object is gone, we have the name
            await logActivity(userId, agentId, 'AGENT_DELETED', `ØªÙ… Ø­Ø°Ù Ø§Ù„ÙˆÙƒÙŠÙ„: ${agent.name} ÙˆÙƒÙ„ Ø¨ÙŠØ§Ù†Ø§ØªÙ‡ Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø©.`);
        }

        res.json({ message: 'Agent and all associated data deleted successfully.' });
    } catch (error) {
        console.error(`[Delete Agent] Error during cascade delete for agent ${req.params.id}:`, error);
        res.status(500).json({ message: 'Failed to delete agent and associated data.', error: error.message });
    }
};

/**
 * @desc    Renew balance for eligible agents. Can be used by cron job or manual trigger.
 * @returns {Promise<number>} Count of renewed agents.
 */
exports.renewEligibleAgentBalances = async (onlineClients) => {
    // Find agents with a renewal period set
    const agentsToRenew = await Agent.find({ renewal_period: { $in: ['weekly', 'biweekly', 'monthly'] } });

    let renewedCount = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to the start of the day

    for (const agent of agentsToRenew) {
        const nextRenewalDate = calculateNextRenewalDate(agent);
        if (!nextRenewalDate) continue; // Skip if no valid renewal date

        nextRenewalDate.setHours(0, 0, 0, 0); // Normalize to the start of the day

        if (now >= nextRenewalDate) {
            // New "roll-over" renewal logic
            const newRemainingBalance = (agent.remaining_balance || 0) + (agent.consumed_balance || 0);
            agent.remaining_balance = newRemainingBalance;
            agent.consumed_balance = 0;

            const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) + (agent.used_deposit_bonus || 0);
            agent.remaining_deposit_bonus = newRemainingDepositBonus;
            agent.used_deposit_bonus = 0;

            agent.last_renewal_date = now;

            await agent.save();

            // --- NEW: Broadcast renewal notification via WebSocket ---
            if (onlineClients && onlineClients.size > 0) {
                const message = JSON.stringify({
                    type: 'agent_renewed',
                    data: { 
                        agentName: agent.name,
                        agentId: agent._id
                    }
                });
                onlineClients.forEach((client) => {
                    if (client.readyState === client.OPEN) {
                        client.send(message);
                    }
                });
            }

            // --- FIX: Log automatic renewal ---
            // We pass null for user_id as this is a system action.
            await logActivity(null, agent._id, 'AUTO_RENEWAL', `ØªÙ… ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø±ØµÙŠØ¯ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù„Ù„ÙˆÙƒÙŠÙ„ ${agent.name}.`);

            renewedCount++;
        }
    }
    return renewedCount;
};

// --- NEW: Bulk renew balances for all agents ---
exports.bulkRenewBalances = async (req, res) => {
    try {
        // FIX: Find all agents that are NOT explicitly inactive. This includes new agents ('Active') and old agents (status is undefined).
        const agents = await Agent.find({ status: { $ne: 'inactive' } });
        let processedCount = 0;

        if (!agents || agents.length === 0) {
            return res.json({ message: 'No active agents found to renew.', processedCount: 0 });
        }

        for (const agent of agents) {
            // --- FIX: Sanitize old/invalid enum values before saving ---
            // This prevents validation errors on agents with legacy data like '1d' or '2d'.
            if (agent.competition_duration && !['24h', '48h'].includes(agent.competition_duration)) {
                agent.competition_duration = null; // Set to null or a valid default
            }

            // The new logic: add consumed balance back to remaining and reset consumed.
            const newRemainingBalance = (agent.remaining_balance || 0) + (agent.consumed_balance || 0);
            agent.remaining_balance = newRemainingBalance;
            agent.consumed_balance = 0;

            // --- FIX: Roll over deposit bonus during bulk renewal ---
            const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) + (agent.used_deposit_bonus || 0);
            agent.remaining_deposit_bonus = newRemainingDepositBonus;
            agent.used_deposit_bonus = 0;
            
            // Save each agent individually for better reliability over bulkWrite
            await agent.save();
            
            processedCount++;

            // --- NEW: Add a delay to avoid overwhelming the server ---
            await sleep(500);
        }

        // --- FIX: Log this bulk action ---
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, null, 'AGENT_BULK_RENEW', `ØªÙ… ØªØ´ØºÙŠÙ„ Ø¹Ù…Ù„ÙŠØ© ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ Ù„Ù€ ${processedCount} ÙˆÙƒÙŠÙ„.`);
        }

        res.json({ message: 'Bulk renewal process completed successfully.', processedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error during bulk balance renewal.', error: error.message });
    }
};

/**
 * @desc    Bulk insert new agents
 * @route   POST /api/agents/bulk-insert
 * @access  Private
 */
exports.bulkInsertAgents = async (req, res) => {
    const agentsData = req.body;
    if (!Array.isArray(agentsData) || agentsData.length === 0) {
        return res.status(400).json({ message: 'Request body must be a non-empty array of agents.' });
    }

    try {
        const result = await Agent.insertMany(agentsData, { ordered: false }); // ordered: false continues on error
        res.status(201).json({
            message: `${result.length} agents inserted successfully.`,
            insertedCount: result.length,
        });
    } catch (error) {
        // insertMany throws a BulkWriteError which contains more details
        // FIX: The 'result' property might not exist on all error types.
        // Default to 0 if it's missing to prevent a crash.
        const insertedCount = error.result?.nInserted ?? 0;
        res.status(500).json({
            message: `ÙØ´Ù„ Ø§Ù„Ø¥Ø¯Ø±Ø§Ø¬ Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ. Ù‚Ø¯ ØªÙƒÙˆÙ† Ø¨Ø¹Ø¶ Ø£Ø±Ù‚Ø§Ù… Ø§Ù„ÙˆÙƒØ§Ù„Ø§Øª Ù…ÙƒØ±Ø±Ø©. ØªÙ… Ø¥Ø¯Ø±Ø§Ø¬ ${insertedCount} ÙˆÙƒÙŠÙ„ Ù‚Ø¨Ù„ Ø­Ø¯ÙˆØ« Ø§Ù„Ø®Ø·Ø£.`,
            error: error.message,
            insertedCount: insertedCount,
            writeErrors: error.writeErrors
        });
    }
};

/**
 * @desc    Bulk update existing agents
 * @route   PUT /api/agents/bulk-update
 * @access  Private
 */
exports.bulkUpdateAgents = async (req, res) => {
    const agentsToUpdate = req.body;
    if (!Array.isArray(agentsToUpdate) || agentsToUpdate.length === 0) {
        return res.status(400).json({ message: 'Request body must be a non-empty array of agents to update.' });
    }

    const bulkOps = agentsToUpdate.map(agent => ({
        updateOne: {
            filter: { _id: agent.id },
            update: { $set: agent }
        }
    }));

    const result = await Agent.bulkWrite(bulkOps);
    res.json({ message: 'Bulk update completed.', modifiedCount: result.modifiedCount });
};

exports.checkUniqueness = async (req, res) => {
    try {
        const { agent_id } = req.query;
        if (!agent_id) {
            return res.status(400).json({ message: 'Agent ID is required.' });
        }
        const existingAgent = await Agent.findOne({ agent_id });
        res.json({ exists: !!existingAgent });
    } catch (error) {
        res.status(500).json({ message: 'Server error while checking uniqueness.', error: error.message });
    }
};

/**
 * @desc    Manually triggers the agent balance renewal job. For testing purposes.
 * @route   POST /api/agents/trigger-renewal-test
 * @access  Private (should be restricted to Super Admin)
 */
exports.triggerRenewalJob = async (req, res) => {
    try {
        const renewedCount = await exports.renewEligibleAgentBalances();
        res.json({ message: 'Renewal job triggered successfully.', renewedCount });
    } catch (error) {
        res.status(500).json({ message: 'Failed to trigger renewal job.', error: error.message });
    }
};

/**
 * @desc    Manually renews the balance for a single agent.
 * @route   POST /api/agents/:id/renew
 * @access  Private
 */
exports.renewSingleAgentBalance = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        // --- FIX: Sanitize old/invalid enum values before saving, similar to bulk renew ---
        if (agent.competition_duration && !['24h', '48h'].includes(agent.competition_duration)) {
            console.log(`[Manual Renew] Sanitizing invalid competition_duration: '${agent.competition_duration}' for agent ${agent.name}`);
            agent.competition_duration = null; // Set to null or a valid default to pass validation
        }

        // New "roll-over" renewal logic
        const newRemainingBalance = (agent.remaining_balance || 0) + (agent.consumed_balance || 0);
        agent.remaining_balance = newRemainingBalance;
        agent.consumed_balance = 0;

        const newRemainingDepositBonus = (agent.remaining_deposit_bonus || 0) + (agent.used_deposit_bonus || 0);
        agent.remaining_deposit_bonus = newRemainingDepositBonus;
        agent.used_deposit_bonus = 0;

        agent.last_renewal_date = new Date();

        await agent.save();

        // --- FIX: Log this manual action ---
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, agent._id, 'MANUAL_RENEWAL', `ØªÙ… ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø±ØµÙŠØ¯ ÙŠØ¯ÙˆÙŠØ§Ù‹ Ù„Ù„ÙˆÙƒÙŠÙ„ ${agent.name}.`);
        }

        res.json({ message: 'Agent balance renewed successfully.', data: agent });
    } catch (error) {
        res.status(500).json({ message: 'Failed to renew agent balance.', error: error.message });
    }
};

/**
 * @route   POST /api/agents/:id/rank-change
 * @desc    Record agent rank change with reason and action
 * @access  Private
 */
exports.recordRankChange = async (req, res) => {
    try {
        const { reason, action_taken, old_rank, new_rank } = req.body;
        
        // Validate required fields
        if (!reason || !action_taken || !old_rank || !new_rank) {
            return res.status(400).json({ 
                message: 'Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©: Ø§Ù„Ø³Ø¨Ø¨ØŒ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ØŒ Ø§Ù„Ù…Ø±ØªØ¨Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø©ØŒ Ø§Ù„Ù…Ø±ØªØ¨Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©' 
            });
        }

        // Get agent details
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Ø§Ù„ÙˆÙƒÙŠÙ„ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
        }

        // Get user details
        const userId = req.user?._id;
        const userName = req.user?.username || 'Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ';

        // Create rank change record
        const rankChange = new AgentRankChange({
            agent_id: agent._id,
            agent_name: agent.name,
            agent_number: agent.agent_id,
            classification: agent.classification,
            old_rank: old_rank,
            new_rank: new_rank,
            reason: reason.trim(),
            action_taken: action_taken.trim(),
            changed_by: userId,
            changed_by_name: userName
        });

        await rankChange.save();

        // Also log in activity log
        if (userId) {
            await logActivity(
                userId, 
                agent._id, 
                'RANK_CHANGE', 
                `ØªÙ… ØªØºÙŠÙŠØ± Ù…Ø±ØªØ¨Ø© Ø§Ù„ÙˆÙƒÙŠÙ„ Ù…Ù† ${old_rank} Ø¥Ù„Ù‰ ${new_rank}. Ø§Ù„Ø³Ø¨Ø¨: ${reason}. Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡: ${action_taken}`,
                { old_rank, new_rank, reason, action_taken }
            );
        }

        res.json({ 
            message: 'ØªÙ… ØªØ³Ø¬ÙŠÙ„ ØªØºÙŠÙŠØ± Ø§Ù„Ù…Ø±ØªØ¨Ø© Ø¨Ù†Ø¬Ø§Ø­', 
            data: rankChange 
        });
    } catch (error) {
        console.error('[Record Rank Change Error]:', error);
        res.status(500).json({ 
            message: 'ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ ØªØºÙŠÙŠØ± Ø§Ù„Ù…Ø±ØªØ¨Ø©', 
            error: error.message 
        });
    }
};

/**
 * @route   POST /api/agents/:id/classification-change
 * @desc    Record agent classification change with reason and action
 * @access  Private
 */
exports.recordClassificationChange = async (req, res) => {
    try {
        const { reason, action_taken, old_classification, new_classification } = req.body;
        
        // Validate required fields
        if (!reason || !action_taken || !old_classification || !new_classification) {
            return res.status(400).json({ 
                message: 'Ø§Ù„Ø±Ø¬Ø§Ø¡ Ø¥Ø¯Ø®Ø§Ù„ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©: Ø§Ù„Ø³Ø¨Ø¨ØŒ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ØŒ Ø§Ù„ØªØµÙ†ÙŠÙ Ø§Ù„Ù‚Ø¯ÙŠÙ…ØŒ Ø§Ù„ØªØµÙ†ÙŠÙ Ø§Ù„Ø¬Ø¯ÙŠØ¯' 
            });
        }

        // Get agent details
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Ø§Ù„ÙˆÙƒÙŠÙ„ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
        }

        // Get user details
        const userId = req.user?._id;
        const userName = req.user?.username || 'Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ';

        // Create classification change record
        const classificationChange = new AgentRankChange({
            agent_id: agent._id,
            agent_name: agent.name,
            agent_number: agent.agent_id,
            classification: agent.classification,
            old_classification: old_classification,
            new_classification: new_classification,
            change_type: 'classification',
            reason: reason.trim(),
            action_taken: action_taken.trim(),
            changed_by: userId,
            changed_by_name: userName
        });

        await classificationChange.save();

        // Also log in activity log
        if (userId) {
            await logActivity(
                userId, 
                agent._id, 
                'CLASSIFICATION_CHANGE', 
                `ØªÙ… ØªØºÙŠÙŠØ± ØªØµÙ†ÙŠÙ Ø§Ù„ÙˆÙƒÙŠÙ„ Ù…Ù† ${old_classification} Ø¥Ù„Ù‰ ${new_classification}. Ø§Ù„Ø³Ø¨Ø¨: ${reason}. Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡: ${action_taken}`,
                { old_classification, new_classification, reason, action_taken }
            );
        }

        res.json({ 
            message: 'ØªÙ… ØªØ³Ø¬ÙŠÙ„ ØªØºÙŠÙŠØ± Ø§Ù„ØªØµÙ†ÙŠÙ Ø¨Ù†Ø¬Ø§Ø­', 
            data: classificationChange 
        });
    } catch (error) {
        console.error('[Record Classification Change Error]:', error);
        res.status(500).json({ 
            message: 'ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ ØªØºÙŠÙŠØ± Ø§Ù„ØªØµÙ†ÙŠÙ', 
            error: error.message 
        });
    }
};

/**
 * @desc    Toggle auditing status for an agent
 * @route   PATCH /api/agents/:id/toggle-auditing
 * @access  Private
 */
exports.toggleAuditing = async (req, res) => {
    try {
        const agentId = req.params.id;
        const { is_auditing_enabled } = req.body;

        if (typeof is_auditing_enabled !== 'boolean') {
            return res.status(400).json({ 
                message: 'ÙŠØ¬Ø¨ ØªØ­Ø¯ÙŠØ¯ Ø­Ø§Ù„Ø© Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ (true/false)',
                error: 'is_auditing_enabled must be a boolean' 
            });
        }

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: 'Ø§Ù„ÙˆÙƒÙŠÙ„ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
        }

        const oldStatus = agent.is_auditing_enabled;
        agent.is_auditing_enabled = is_auditing_enabled;
        await agent.save();

        // Log the activity
        const userId = req.user?._id;
        const userName = req.user?.full_name || 'مستخدم';
        if (userId) {
            const statusText = is_auditing_enabled ? 'تفعيل' : 'إلغاء تفعيل';
            await logActivity(
                userId,
                agent._id,
                'AUDITING_TOGGLED',
                `تم ${statusText} التدقيق للوكيل ${agent.name}`,
                { old_status: oldStatus, new_status: is_auditing_enabled }
            );
        }

        console.log(`✓ [AUDITING TOGGLE] Agent: ${agent.name}, Status: ${oldStatus} → ${is_auditing_enabled}`);

        // Broadcast the event to all connected clients
        broadcastEvent('AUDITING_TOGGLED', {
            agentId: agent._id,
            agentName: agent.name,
            isAuditingEnabled: is_auditing_enabled,
            updatedBy: req.user ? req.user.full_name : 'System',
            timestamp: new Date()
        });

        res.json({
            message: `ØªÙ… ${is_auditing_enabled ? 'ØªÙØ¹ÙŠÙ„' : 'Ø¥Ù„ØºØ§Ø¡ ØªÙØ¹ÙŠÙ„'} Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ Ø¨Ù†Ø¬Ø§Ø­`,
            data: {
                agent_id: agent._id,
                agent_name: agent.name,
                is_auditing_enabled: agent.is_auditing_enabled
            }
        });
    } catch (error) {
        console.error('[Toggle Auditing Error]:', error);
        res.status(500).json({
            message: 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚',
            error: error.message
        });
    }
};

/**
 * @desc    Send winners report with videos to Telegram
 * @route   POST /api/agents/:agentId/send-winners-report
 * @access  Private
 */
exports.sendWinnersReport = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { winnerIds, messageText } = req.body;
        const bot = req.app.locals.telegramBot;

        if (!bot) {
            return res.status(503).json({ message: 'Telegram bot is not initialized' });
        }

        if (!agentId || !winnerIds || !Array.isArray(winnerIds) || winnerIds.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        const agent = await Agent.findById(agentId);
        if (!agent || !agent.telegram_chat_id) {
            return res.status(404).json({ message: 'Agent not found or has no Telegram chat ID' });
        }

        const winners = await Winner.find({ _id: { $in: winnerIds } });
        
        // Filter winners with videos
        const winnersWithVideos = winners.filter(w => w.video_url);
        
        if (winnersWithVideos.length === 0) {
             // If no videos, just send text
             await bot.sendMessage(agent.telegram_chat_id, messageText, { parse_mode: 'HTML' });
             
             // Competition status update removed to prevent auto-completion

             return res.json({ message: 'Text report sent (no videos found)' });
        }

        // If single video, use sendVideo for better native behavior
        if (winnersWithVideos.length === 1) {
            const w = winnersWithVideos[0];
            let mediaSource = w.video_url;
            if (mediaSource && mediaSource.startsWith('/uploads')) {
                const relativePath = mediaSource.startsWith('/') ? mediaSource.slice(1) : mediaSource;
                mediaSource = path.join(__dirname, '../../', relativePath);
            }
            
            // Generate caption for single winner
            let caption;
            if (messageText && messageText.trim().length > 0) {
                // Use the message provided by the frontend (which includes warnings)
                caption = messageText;
            } else {
                // Fallback to generating caption on backend
                const prizeText = w.prize_type === 'deposit' 
                    ? `${w.prize_value}% بونص ايداع كونه فائز مسبقا ببونص تداولي` 
                    : `${w.prize_value}$ بونص تداولي`;
                
                caption = `◃ الفائز: ${w.name}\n`;
                caption += `           الجائزة: ${prizeText}\n\n`;
                caption += `********************************************************\n`;
                caption += `يرجى ابلاغ الفائزين بالتواصل معنا عبر معرف التليجرام و الاعلان عنهم بمعلوماتهم و فيديو الروليت بالقناة \n`;
                caption += `https://t.me/Ibinzo`;
            }

            await bot.sendVideo(agent.telegram_chat_id, mediaSource, { 
                caption: caption,
                parse_mode: 'HTML',
                supports_streaming: true
            });

            // Competition status update removed to prevent auto-completion

            return res.json({ message: 'Winner report sent successfully' });
        }

        // Helper to generate caption for a chunk of winners
        const generateChunkCaption = (chunkWinners, startIndex) => {
            const ordinals = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
            let msg = '';
            chunkWinners.forEach((w, i) => {
                const globalIndex = startIndex + i;
                const rank = ordinals[globalIndex] || (globalIndex + 1);
                const prizeText = w.prize_type === 'deposit' 
                    ? `${w.prize_value}% بونص ايداع كونه فائز مسبقا ببونص تداولي` 
                    : `${w.prize_value}$ بونص تداولي`;
        
                msg += `◃ الفائز ${rank}: ${w.name}\n`;
                msg += `           الجائزة: ${prizeText}\n\n`;
                msg += `********************************************************\n`;
            });
            
            msg += `يرجى ابلاغ الفائزين بالتواصل معنا عبر معرف التليجرام و الاعلان عنهم بمعلوماتهم و فيديو الروليت بالقناة \n`;
            msg += `https://t.me/Ibinzo`;
            return msg;
        };

        // Split into chunks of 6 (User requested limit to avoid Telegram issues)
        const chunkSize = 6;
        for (let i = 0; i < winnersWithVideos.length; i += chunkSize) {
            const winnersChunk = winnersWithVideos.slice(i, i + chunkSize);
            
            // Construct media group for this chunk
            const mediaItems = winnersChunk.map(w => {
                let mediaSource = w.video_url;
                if (mediaSource && mediaSource.startsWith('/uploads')) {
                    const relativePath = mediaSource.startsWith('/') ? mediaSource.slice(1) : mediaSource;
                    mediaSource = path.join(__dirname, '../../', relativePath);
                }
                return {
                    type: 'video',
                    media: mediaSource,
                    parse_mode: 'HTML',
                    supports_streaming: true
                };
            });

            // Generate caption for this chunk
            const chunkCaption = generateChunkCaption(winnersChunk, i);
            
            // Attach caption to the first item of the chunk
            if (mediaItems.length > 0) {
                mediaItems[0].caption = chunkCaption;
            }

            await sendMediaGroupToTelegram(bot, mediaItems, agent.telegram_chat_id);
            
            // Add a small delay between chunks to prevent rate limiting
            if (i + chunkSize < winnersWithVideos.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Competition status update removed to prevent auto-completion

        res.json({ message: 'Winners report sent successfully' });

    } catch (error) {
        console.error('Error sending winners report:', error);
        res.status(500).json({ message: 'Failed to send report: ' + error.message });
    }
};

/**
 * @desc    Send per-winner details (with ID image) to Telegram
 * @route   POST /api/agents/:agentId/send-winners-details
 * @access  Private
 */
exports.sendWinnersDetails = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { winnerIds, include_warn_meet: includeWarnMeet, include_warn_prev: includeWarnPrev, warnings, override_chat_id } = req.body;
        const bot = req.app.locals.telegramBot;

        if (!bot) {
            return res.status(503).json({ message: 'Telegram bot is not initialized' });
        }
        if (!agentId || !winnerIds || !Array.isArray(winnerIds) || winnerIds.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found.' });
        }

        const winners = await Winner.find({ _id: { $in: winnerIds } });
        if (!winners || winners.length === 0) {
            return res.status(404).json({ message: 'No winners found for provided IDs' });
        }

        // Map per-winner warning preferences if provided
        const warnMap = new Map();
        if (Array.isArray(warnings)) {
            warnings.forEach(w => {
                const id = w.winnerId ? String(w.winnerId) : null;
                if (id) {
                    warnMap.set(id, {
                        meet: !!w.include_warn_meet,
                        prev: !!w.include_warn_prev
                    });
                }
            });
        }

        const mapAgencyType = (agentDoc) => {
            const exclusiveRanks = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND'];
            const rank = (agentDoc?.rank || '').toUpperCase();
            const classification = (agentDoc?.classification || '').toUpperCase();
            if (classification === 'EXCLUSIVE' || classification === 'E' || exclusiveRanks.includes(rank)) {
                return 'حصرية';
            }
            return 'اعتيادية';
        };

        for (const w of winners) {
            let prizeText = '';
            if (w.prize_type === 'deposit_prev') {
                prizeText = `${w.prize_value || 0}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
            } else if (w.prize_type === 'deposit') {
                prizeText = `${w.prize_value || 0}% بونص إيداع`;
            } else {
                prizeText = `${w.prize_value || 0}$ بونص تداولي`;
            }

            const lines = [
                `الاسم: ${w.name || 'غير معروف'}`,
                `البريد الإلكتروني: ${w.email || 'غير متاح'}`,
                `قيمة الجائزة: ${prizeText}`,
                `اسم الوكيل: ${agent.name || 'غير متاح'}`,
                `نوع وكالة الوكيل: ${mapAgencyType(agent)}${agent.rank ? ` (${agent.rank})` : ''}`,
                `رقم الوكالة: ${agent.agent_id || 'غير متاح'}`
            ];

            const warnPrefs = warnMap.get(String(w._id)) || {};
            const useWarnMeet = warnPrefs.meet ?? includeWarnMeet;
            const useWarnPrev = warnPrefs.prev ?? includeWarnPrev;

            const warningBlocks = [];
            if (useWarnMeet) {
                warningBlocks.push("\u26a0\ufe0f\u0020\u064a\u0631\u062c\u0649\u0020\u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u0020\u0645\u0639\u0020\u0627\u0644\u0639\u0645\u064a\u0644\u0020\u0648\u0627\u0644\u062a\u062d\u0642\u0642\u0020\u0645\u0646\u0647\u0020\u0623\u0648\u0644\u0627\u064b");
            }
            if (useWarnPrev) {
                warningBlocks.push("\u203c\ufe0f\u0020\u064a\u0631\u062c\u0649\u0020\u0627\u0644\u062a\u062d\u0642\u0642\u0020\u0623\u0648\u0644\u064b\u0627\u0020\u0645\u0646\u0020\u0647\u0630\u0627\u0020\u0627\u0644\u0639\u0645\u064a\u0644\u060c\u0020\u062d\u064a\u062b\u0020\u0633\u0628\u0642\u0020\u0623\u0646\u0020\u0641\u0627\u0632\u0020\u0628\u062c\u0627\u0626\u0632\u0629\u0020\u0028\u0628\u0648\u0646\u0635\u0020\u062a\u062f\u0627\u0648\u0644\u064a\u0029\u0020\u062e\u0644\u0627\u0644\u0020\u0627\u0644\u0623\u064a\u0627\u0645\u0020\u0627\u0644\u0645\u0627\u0636\u064a\u0629\u002e\n\u064a\u064f\u0631\u062c\u0649\u0020\u0627\u0644\u062a\u0623\u0643\u062f\u0020\u0645\u0646\u0020\u0623\u0646\u0020\u0627\u0644\u0648\u0643\u064a\u0644\u0020\u0642\u062f\u0020\u0642\u0627\u0645\u0020\u0628\u0646\u0634\u0631\u0020\u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629\u0020\u0627\u0644\u0633\u0627\u0628\u0642\u0629\u0020\u0627\u0644\u062e\u0627\u0635\u0629\u0020\u0628\u0647\u0630\u0627\u0020\u0627\u0644\u0639\u0645\u064a\u0644\u0020\u0642\u0628\u0644\u0020\u0627\u0639\u062a\u0645\u0627\u062f\u0020\u0627\u0644\u062c\u0627\u0626\u0632\u0629\u0020\u0627\u0644\u062d\u0627\u0644\u064a\u0629");
            }
            if (warningBlocks.length > 0) {
                lines.push(warningBlocks.join("\n\n"));
            }

            const caption = lines.join('\n');

            let imageSource = w.national_id_image || null;
            if (imageSource && imageSource.startsWith('/uploads')) {
                const rel = imageSource.startsWith('/') ? imageSource.slice(1) : imageSource;
                imageSource = path.join(__dirname, '../../', rel);
            }

            // Use override_chat_id if provided, otherwise check for global AGENT_COMPETITIONS_CHAT_ID, otherwise fallback to agent's chat
            const targetChatId = override_chat_id || process.env.AGENT_COMPETITIONS_CHAT_ID || agent.telegram_chat_id;
            
            if (!targetChatId) {
                console.warn('[sendWinnersDetails] No target chat id available');
                continue; // Skip sending if no chat id
            }
            if (imageSource) {
                await sendPhotoToTelegram(bot, imageSource, caption, targetChatId);
            } else {
                await postToTelegram(bot, caption, targetChatId);
            }
        }

        const activeCompetition = await Competition.findOne({
            agent_id: agentId,
            status: { $in: ['active', 'awaiting_winners'] }
        });
        /*
        if (!override_chat_id && activeCompetition) { // Only mark completed when sending to agent chat
            activeCompetition.status = 'completed';
            await activeCompetition.save();
        }
        */

        return res.json({ message: 'Winners details sent successfully', target: override_chat_id ? 'company_group' : 'agent_group' });
    } catch (error) {
        console.error('Error sending winners details:', error);
        return res.status(500).json({ message: 'Failed to send winners details: ' + error.message });
    }
};





