const Agent = require('../models/agent.model');
const Transaction = require('../models/Transaction'); // Added
const path = require('path'); // Added
const fs = require('fs'); // Added for file checks
const Competition = require('../models/Competition');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const AgentRankChange = require('../models/AgentRankChange');
const Log = require('../models/Log');
const Winner = require('../models/Winner'); // Added
const onlineClients = require('../utils/clients'); // Added for WebSocket updates
const { logActivity } = require('../utils/logActivity');
const { translateField, formatValue } = require('../utils/fieldTranslations');
const { postToTelegram, sendPhotoToTelegram, sendMediaGroupToTelegram } = require('../utils/telegram');
const { broadcastEvent } = require('../utils/notification');
const { calculateRealPrize } = require('../utils/prizeCalculator');

const WINNER_DETAILS_DEBUG_LOGS = process.env.WINNER_DETAILS_DEBUG_LOGS === '1';
const winnerDetailsDebugLog = (...args) => {
    if (WINNER_DETAILS_DEBUG_LOGS) {
        console.log(...args);
    }
};

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

exports.getAgentTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 12 } = req.query; // Default to last 12 transactions (approx 3 months if weekly)

        const transactions = await Transaction.find({ agent_id: id })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({ data: transactions });
    } catch (error) {
        console.error('Error fetching agent transactions:', error);
        res.status(500).json({ message: 'Failed to fetch transactions.', error: error.message });
    }
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
                     compliance_details = `تم الإنجاز مبكراً (${Math.abs(hours)} ساعة)`;
                } else {
                     compliance_details = within ? `تم الإنجاز خلال ${hours} ساعة` : `تأخر ${hours} ساعة`;
                }
            } else if (!sentAt && selectedAt) {
                // If we don't know when it ended, but it is processed, assume compliant?
                // Or maybe just leave as false? 
                // Better to be strict, but if ends_at is missing, something is wrong with data.
                is_compliant = true; // Benefit of the doubt if data missing
                compliance_details = 'بيانات الوقت غير مكتملة (مقبول)';
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
        if (req.body.agent_id) {
            req.body.agent_id = req.body.agent_id.trim();
            const existingAgent = await Agent.findOne({ agent_id: req.body.agent_id });
            if (existingAgent) {
                return res.status(400).json({ message: 'رقم الوكالة مستخدم بالفعل لوكيل آخر.' });
            }
        }
        
        // --- DEBUG: Log التصنيف للتأكد من إرساله ---
        // console.log(`[Agent Create] Creating new agent with classification: ${req.body.classification || 'R (default)'}`);
        // console.log('[Agent Create] AUDIT_DAYS received:', req.body.audit_days);
        // console.log('[Agent Create] AUDIT_DAYS is array:', Array.isArray(req.body.audit_days));
        // console.log(`[Agent Create] Full request body:`, JSON.stringify(req.body, null, 2));
        
        const agent = new Agent(req.body);
        await agent.save();
        
        // --- DEBUG: Log التصنيف بعد الحفظ ---
        // console.log(`[Agent Create] Agent saved successfully with classification: ${agent.classification}`);
        // console.log('[Agent Create] AUDIT_DAYS saved to DB:', agent.audit_days);
        // console.log('[Agent Create] Complete saved agent:', JSON.stringify(agent, null, 2));
        
        // Log activity
        const userId = req.user?._id;
        if (userId) {
            const { logActivity } = require('../utils/logActivity');
            await logActivity(
                userId, 
                agent._id, 
                'AGENT_CREATED', 
                `تم إنشاء وكيل جديد: ${agent.name} (التصنيف: ${agent.classification})`,
                agent.toObject()
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

        // --- NEW: Check if agent_id is being updated and ensure it's unique ---
        if (req.body.agent_id && req.body.agent_id !== agentBeforeUpdate.agent_id) {
            const existingAgent = await Agent.findOne({ 
                agent_id: req.body.agent_id.trim(), 
                _id: { $ne: req.params.id } 
            });
            if (existingAgent) {
                return res.status(400).json({ message: 'رقم الوكالة مستخدم بالفعل لوكيل آخر.' });
            }
            // Trim the agent_id
            req.body.agent_id = req.body.agent_id.trim();
        }

        // --- FIX: Directly use req.body for the update payload ---
        const updatedAgent = await Agent.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });

        // --- FIX: Always log activity on update from the backend for reliability ---
        const userId = req.user?._id; // Use optional chaining
        const hasProfileUpdate = ['name', 'agent_id', 'telegram_channel_url', 'telegram_group_url', 'telegram_chat_id', 'telegram_group_name'].some(key => key in req.body);
        
        const actionType = hasProfileUpdate ? 'PROFILE_UPDATE' : 'DETAILS_UPDATE';
        const isFinancialUpdate = ['rank', 'competition_bonus', 'deposit_bonus_count', 'deposit_bonus_percentage', 'consumed_balance', 'remaining_balance', 'used_deposit_bonus', 'remaining_deposit_bonus', 'single_competition_balance', 'winners_count', 'prize_per_winner', 'renewal_period', 'deposit_bonus_winners_count'].some(key => key in req.body);

        // تحضير وصف مفصل للتغييرات
        const changes = Object.entries(req.body).map(([field, newValue]) => {
            const oldValue = agentBeforeUpdate[field];
            // نتحقق فقط من الحقول التي تغيرت قيمتها
            if (String(oldValue) === String(newValue)) return null;
            
            const arabicFieldName = translateField(field);
            return {
                field: arabicFieldName,
                from: formatValue(oldValue),
                to: formatValue(newValue)
            };
        }).filter(change => change !== null); // نزيل الحقول التي لم تتغير

        const description = changes.length > 0 
            ? `تم تحديث بيانات الوكيل:\n${changes.map(c => `${c.field}: من "${c.from}" إلى "${c.to}"`).join('\n')}`.trim()
            : 'تم تحديث بيانات الوكيل بدون تغييرات ملحوظة';

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
        const [compRes, taskRes, winnerRes, activityRes, rankRes, adminLogRes, transRes] = await Promise.all([
            Competition.deleteMany({}),
            Task.deleteMany({}),
            Winner.deleteMany({}),
            ActivityLog.deleteMany({}),
            AgentRankChange.deleteMany({}),
            Log.deleteMany({}),
            Transaction.deleteMany({})
        ]);

        console.log(`[Delete All Agents] Deleted competitions: ${compRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted tasks: ${taskRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted winners: ${winnerRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted activity logs: ${activityRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted rank/class changes: ${rankRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted admin logs: ${adminLogRes.deletedCount}`);
        console.log(`[Delete All Agents] Deleted transactions: ${transRes.deletedCount}`);

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
            await logActivity(userId, agentId, 'AGENT_DELETED', `تم حذف الوكيل: ${agent.name} وكل بياناته المرتبطة.`, agent.toObject());
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
        // --- RACE CONDITION PROTECTION ---
        // Check if already renewed today
        if (agent.last_renewal_date) {
            const lastRenewal = new Date(agent.last_renewal_date);
            lastRenewal.setHours(0, 0, 0, 0);
            if (lastRenewal.getTime() === now.getTime()) {
                // Already renewed today, skip
                continue;
            }
        }

        const nextRenewalDate = calculateNextRenewalDate(agent);
        if (!nextRenewalDate) continue; // Skip if no valid renewal date

        nextRenewalDate.setHours(0, 0, 0, 0); // Normalize to the start of the day

        if (now >= nextRenewalDate) {
            // --- ATOMIC UPDATE & RACE CONDITION PROTECTION ---
            // We use findOneAndUpdate with a filter on 'last_renewal_date'.
            // If another process renewed this agent milliseconds ago, 'last_renewal_date' would have changed,
            // and this update will fail (return null), preventing double renewal.
            // We also use an aggregation pipeline in the update to atomically calculate the new balance.
            
            const originalAgentState = await Agent.findOneAndUpdate(
                { 
                    _id: agent._id, 
                    last_renewal_date: agent.last_renewal_date // Optimistic Locking
                },
                [
                    {
                        $set: {
                            remaining_balance: "$competition_bonus",
                            consumed_balance: 0,
                            remaining_deposit_bonus: "$deposit_bonus_count",
                            used_deposit_bonus: 0,
                            last_renewal_date: now
                        }
                    }
                ],
                { new: false } // Return the document BEFORE the update to calculate what was restored
            );

            // If originalAgentState is null, it means the agent was modified by another process (concurrent renewal).
            if (!originalAgentState) {
                console.log(`[Auto Renewal] Skipped agent ${agent.name} (Race condition detected - already renewed).`);
                continue;
            }

            // Calculate amounts from the state BEFORE update
            const balanceBefore = originalAgentState.remaining_balance || 0;
            const newRemainingBalance = agent.competition_bonus || 0;
            const amountRestored = newRemainingBalance - balanceBefore;

            // --- TRANSACTION LEDGER ---
            try {
                await Transaction.create({
                    agent_id: agent._id,
                    type: 'auto_renewal',
                    amount: amountRestored,
                    previous_balance: balanceBefore,
                    new_balance: newRemainingBalance,
                    details: `Auto-renewal: Reset balance to ${newRemainingBalance}.`,
                    performed_by: null // System
                });
            } catch (txError) {
                console.error(`[Auto Renewal] Failed to create transaction record for agent ${agent.name}:`, txError);
            }

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
            await logActivity(null, agent._id, 'AUTO_RENEWAL', `تم تجديد الرصيد تلقائياً للوكيل ${agent.name}.`);

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
        let failedCount = 0;
        let errors = [];
        let totalRestoredAmount = 0;
        let failedAgents = []; // Store full agent objects for retry

        if (!agents || agents.length === 0) {
            return res.json({ message: 'No active agents found to renew.', processedCount: 0 });
        }

        const now = new Date();

        // Helper function to process a single agent
        const processAgent = async (agent) => {
            // --- FIX: Sanitize old/invalid enum values before saving ---
            if (agent.competition_duration && !['24h', '48h', '5s'].includes(agent.competition_duration)) {
                agent.competition_duration = null; 
            }

            const balanceBefore = agent.remaining_balance || 0;
            const newBalance = agent.competition_bonus || 0;
            const amountRestored = newBalance - balanceBefore;

            // 1. Restore Balance
            agent.remaining_balance = newBalance;
            agent.consumed_balance = 0;

            // 2. Restore Deposit Bonus
            agent.remaining_deposit_bonus = agent.deposit_bonus_count || 0;
            agent.used_deposit_bonus = 0;

            // 3. Update Last Renewal Date
            agent.last_renewal_date = now;
            
            // Save the agent
            await agent.save();

            // 4. Create Transaction Record
            if (amountRestored !== 0) {
                try {
                    await Transaction.create({
                        agent_id: agent._id,
                        type: 'manual_renewal',
                        amount: amountRestored,
                        previous_balance: balanceBefore,
                        new_balance: agent.remaining_balance,
                        details: `Bulk Manual Renewal: Reset balance to ${newBalance}.`,
                        performed_by: req.user ? req.user._id : null
                    });
                } catch (txError) {
                    console.error(`[Bulk Renewal] Failed to create transaction for agent ${agent.name}:`, txError);
                }
            }
            return amountRestored;
        };

        // --- MAIN LOOP ---
        for (const agent of agents) {
            try {
                const amount = await processAgent(agent);
                processedCount++;
                totalRestoredAmount += amount;
            } catch (agentError) {
                console.error(`[Bulk Renewal] Failed to renew agent ${agent.name}:`, agentError);
                failedAgents.push({ agent, error: agentError.message }); // Store for retry
            }

            // Send progress update via WebSocket
            if (req.user && req.user._id) {
                const ws = onlineClients.get(req.user._id.toString());
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'bulk_renew_progress',
                        agentName: agent.name,
                        current: processedCount + failedAgents.length,
                        total: agents.length
                    }));
                }
            }

            // --- DELAY: 50ms is safe for 500 agents (Total ~25s) to avoid HTTP timeout ---
            await sleep(50);
        }

        // --- RETRY LOGIC ---
        if (failedAgents.length > 0) {
            console.log(`[Bulk Renewal] Retrying ${failedAgents.length} failed agents...`);
            const retryList = [...failedAgents];
            failedAgents = []; // Reset for final count

            for (const item of retryList) {
                try {
                    const amount = await processAgent(item.agent);
                    processedCount++;
                    totalRestoredAmount += amount;
                    // If successful, remove from error list (it's not added to failedAgents)
                } catch (retryError) {
                    console.error(`[Bulk Renewal] Retry failed for agent ${item.agent.name}:`, retryError);
                    failedCount++;
                    errors.push({ 
                        name: item.agent.name, 
                        agent_id: item.agent.agent_id,
                        reason: retryError.message 
                    });
                }
            }
        }

        // --- FIX: Log this bulk action ---
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, null, 'AGENT_BULK_RENEW', `تم تشغيل عملية تجديد الرصيد الجماعي. نجح: ${processedCount}، فشل نهائي: ${failedCount}. إجمالي المسترد: ${totalRestoredAmount}`);
        }

        res.json({ 
            message: 'Bulk renewal process completed.', 
            processedCount, 
            failedCount,
            totalRestoredAmount,
            errors // This array contains the final list of agents who failed even after retry
        });
    } catch (error) {
        console.error('[Bulk Renewal] Error:', error);
        res.status(500).json({ message: 'Server error during bulk balance renewal.', error: error.message });
    }
};

// --- NEW: Bulk broadcast balance to all eligible agents ---
exports.bulkBroadcastBalance = async (req, res) => {
    try {
        // Find agents with balance > 0 OR deposit bonus > 0 AND have a telegram chat ID
        const agents = await Agent.find({
            $and: [
                { telegram_chat_id: { $nin: [null, '', 0] } },
                {
                    $or: [
                        { remaining_balance: { $gt: 0 } },
                        { remaining_deposit_bonus: { $gt: 0 } }
                    ]
                }
            ]
        });

        if (!agents || agents.length === 0) {
            return res.json({ message: 'No eligible agents found for broadcast.', processedCount: 0 });
        }

        let successCount = 0;
        let errorCount = 0;
        const bot = req.app.locals.telegramBot;

        if (!bot) {
            return res.status(503).json({ message: 'Telegram bot is not initialized.' });
        }

        const renewalPeriodMap = {
            'weekly': 'أسبوعي',
            'biweekly': 'كل أسبوعين',
            'monthly': 'شهري'
        };

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            
            try {
                const renewalValue = (agent.renewal_period && agent.renewal_period !== 'none') 
                    ? (renewalPeriodMap[agent.renewal_period] || '')
                    : '';

                let benefitsText = '';
                if ((agent.remaining_balance || 0) > 0) {
                    benefitsText += `💰 <b>بونص تداولي:</b> <code>${agent.remaining_balance}$</code>\n`;
                }
                if ((agent.remaining_deposit_bonus || 0) > 0) {
                    benefitsText += `🎁 <b>بونص ايداع:</b> <code>${agent.remaining_deposit_bonus}</code> مرات بنسبة <code>${agent.deposit_bonus_percentage || 0}%</code>\n`;
                }

                const clicheText = `<b>دمت بخير شريكنا العزيز ${agent.name}</b> ...\n\nيسرنا ان نحيطك علما بأن حضرتك كوكيل لدى شركة انزو تتمتع برصيد مسابقات:\n${renewalValue ? `(<b>${renewalValue}</b>):\n\n` : ''}${benefitsText.trim()}\n\nبامكانك الاستفادة منه من خلال انشاء مسابقات اسبوعية لتنمية وتطوير العملاء التابعين للوكالة.\n\nهل ترغب بارسال مسابقة لحضرتك؟`;

                await postToTelegram(bot, clicheText, agent.telegram_chat_id);
                successCount++;
            } catch (err) {
                console.error(`[Bulk Broadcast] Failed to send to agent ${agent.name}:`, err.message);
                errorCount++;
            }

            // Send progress update via WebSocket
            if (req.user && req.user._id) {
                const ws = onlineClients.get(req.user._id.toString());
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'bulk_broadcast_progress',
                        agentName: agent.name,
                        current: i + 1,
                        total: agents.length,
                        success: successCount,
                        failed: errorCount
                    }));
                }
            }

            // Delay to avoid hitting Telegram rate limits (30 messages per second max, but safer to go slower)
            await sleep(300); 
        }

        // Log activity
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, null, 'BULK_BALANCE_SENT', `تم تعميم الأرصدة إلى ${successCount} وكيل (فشل ${errorCount}).`);
        }

        res.json({ message: 'Bulk broadcast completed.', successCount, errorCount });

    } catch (error) {
        console.error('[Bulk Broadcast] Error:', error);
        res.status(500).json({ message: 'Server error during bulk broadcast.', error: error.message });
    }
};

// --- NEW: Bulk send custom message to all eligible agents ---
exports.bulkSendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message content is required.' });
        }

        // Find agents with a valid telegram chat ID
        const agents = await Agent.find({ telegram_chat_id: { $nin: [null, '', 0] } });

        if (!agents || agents.length === 0) {
            return res.json({ message: 'No eligible agents found for broadcast.', processedCount: 0 });
        }

        let successCount = 0;
        let errorCount = 0;
        const bot = req.app.locals.telegramBot;

        if (!bot) {
            return res.status(503).json({ message: 'Telegram bot is not initialized.' });
        }

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            
            try {
                await postToTelegram(bot, message, agent.telegram_chat_id);
                successCount++;
            } catch (err) {
                console.error(`[Bulk Message] Failed to send to agent ${agent.name}:`, err.message);
                errorCount++;
            }

            // Send progress update via WebSocket
            if (req.user && req.user._id) {
                const ws = onlineClients.get(req.user._id.toString());
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'bulk_message_progress',
                        agentName: agent.name,
                        current: i + 1,
                        total: agents.length,
                        success: successCount,
                        failed: errorCount
                    }));
                }
            }

            // Delay to avoid hitting Telegram rate limits
            await sleep(300); 
        }

        // Log activity
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, null, 'BULK_BROADCAST', `تم إرسال تعميم جماعي إلى ${successCount} وكيل (فشل ${errorCount}).`);
        }

        res.json({ message: 'Bulk message broadcast completed.', successCount, errorCount });

    } catch (error) {
        console.error('[Bulk Message] Error:', error);
        res.status(500).json({ message: 'Server error during bulk message broadcast.', error: error.message });
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
            message: `فشل الإدراج الجماعي. قد تكون بعض أرقام الوكالات مكررة. تم إدراج ${insertedCount} وكيل قبل حدوث الخطأ.`,
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

        // --- RACE CONDITION PROTECTION ---
        // REMOVED: We want to allow manual renewal multiple times a day if needed (similar to bulk renew).
        /*
        if (agent.last_renewal_date) {
            const lastRenewal = new Date(agent.last_renewal_date);
            const now = new Date();
            lastRenewal.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            
            if (lastRenewal.getTime() === now.getTime()) {
                return res.status(400).json({ message: 'Agent balance has already been renewed today.' });
            }
        }
        */

        // --- FIX: Sanitize old/invalid enum values before saving, similar to bulk renew ---
        if (agent.competition_duration && !['24h', '48h'].includes(agent.competition_duration)) {
            console.log(`[Manual Renew] Sanitizing invalid competition_duration: '${agent.competition_duration}' for agent ${agent.name}`);
            agent.competition_duration = null; // Set to null or a valid default to pass validation
        }

        const balanceBefore = agent.remaining_balance || 0;
        const newRemainingBalance = agent.competition_bonus || 0;
        const amountRestored = newRemainingBalance - balanceBefore;

        agent.remaining_balance = newRemainingBalance;
        agent.consumed_balance = 0;

        agent.remaining_deposit_bonus = agent.deposit_bonus_count || 0;
        agent.used_deposit_bonus = 0;

        agent.last_renewal_date = new Date();

        await agent.save();

        // --- TRANSACTION LEDGER ---
        const userId = req.user?._id;
        try {
            await Transaction.create({
                agent_id: agent._id,
                type: 'manual_renewal',
                amount: amountRestored,
                previous_balance: balanceBefore,
                new_balance: newRemainingBalance,
                details: `Manual renewal: Reset balance to ${newRemainingBalance}.`,
                performed_by: userId || null
            });
        } catch (txError) {
            console.error(`[Manual Renewal] Failed to create transaction record for agent ${agent.name}:`, txError);
        }

        // --- FIX: Log this manual action ---
        if (userId) {
            await logActivity(userId, agent._id, 'MANUAL_RENEWAL', `تم تجديد الرصيد يدوياً للوكيل ${agent.name}.`);
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
                message: 'الرجاء إدخال جميع البيانات المطلوبة: السبب، الإجراء، المرتبة القديمة، المرتبة الجديدة' 
            });
        }

        // Get agent details
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'الوكيل غير موجود' });
        }

        // Get user details
        const userId = req.user?._id;
        const userName = req.user?.username || 'مستخدم غير معروف';

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
                `تم تغيير مرتبة الوكيل من ${old_rank} إلى ${new_rank}. السبب: ${reason}. الإجراء: ${action_taken}`,
                { old_rank, new_rank, reason, action_taken }
            );
        }

        res.json({ 
            message: 'تم تسجيل تغيير المرتبة بنجاح', 
            data: rankChange 
        });
    } catch (error) {
        console.error('[Record Rank Change Error]:', error);
        res.status(500).json({ 
            message: 'فشل تسجيل تغيير المرتبة', 
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
                message: 'الرجاء إدخال جميع البيانات المطلوبة: السبب، الإجراء، التصنيف القديم، التصنيف الجديد' 
            });
        }

        // Get agent details
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'الوكيل غير موجود' });
        }

        // Get user details
        const userId = req.user?._id;
        const userName = req.user?.username || 'مستخدم غير معروف';

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
                `تم تغيير تصنيف الوكيل من ${old_classification} إلى ${new_classification}. السبب: ${reason}. الإجراء: ${action_taken}`,
                { old_classification, new_classification, reason, action_taken }
            );
        }

        res.json({ 
            message: 'تم تسجيل تغيير التصنيف بنجاح', 
            data: classificationChange 
        });
    } catch (error) {
        console.error('[Record Classification Change Error]:', error);
        res.status(500).json({ 
            message: 'فشل تسجيل تغيير التصنيف', 
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
                message: 'يجب تحديد حالة التدقيق (true/false)',
                error: 'is_auditing_enabled must be a boolean' 
            });
        }

        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: 'الوكيل غير موجود' });
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
            message: `تم ${is_auditing_enabled ? 'تفعيل' : 'إلغاء تفعيل'} التدقيق بنجاح`,
            data: {
                agent_id: agent._id,
                agent_name: agent.name,
                is_auditing_enabled: agent.is_auditing_enabled
            }
        });
    } catch (error) {
        console.error('[Toggle Auditing Error]:', error);
        res.status(500).json({
            message: 'فشل تحديث حالة التدقيق',
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
        const { winnerIds, messageText, warnings = [] } = req.body;
        const bot = req.app.locals.telegramBot;
        const TELEGRAM_CAPTION_LIMIT = 1024;
        const TELEGRAM_MESSAGE_LIMIT = 4096;
        const FALLBACK_MEDIA_CAPTION = '<b>تقرير الفائزين</b>';
        const TELEGRAM_MEDIA_GROUP_MAX = 10;
        // Keep album mode ON so winners are sent in grouped batches (5 per message).
        const ENABLE_VIDEO_MEDIA_GROUP = true;

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

        const splitTelegramText = (text, maxLength) => {
            const raw = (text || '').toString().trim();
            if (!raw) return ['تقرير الفائزين'];
            if (raw.length <= maxLength) return [raw];

            const chunks = [];
            let remaining = raw;
            while (remaining.length > maxLength) {
                let splitAt = remaining.lastIndexOf('\n', maxLength);
                if (splitAt <= 0 || splitAt < Math.floor(maxLength * 0.6)) {
                    splitAt = maxLength;
                }

                chunks.push(remaining.slice(0, splitAt).trim());
                remaining = remaining.slice(splitAt).trim();
            }

            if (remaining.length > 0) {
                chunks.push(remaining);
            }
            return chunks;
        };

        const warnMap = new Map(
            Array.isArray(warnings)
                ? warnings.map(item => [
                    String(item.winnerId),
                    {
                        meet: !!item.include_warn_meet,
                        prev: !!item.include_warn_prev
                    }
                ])
                : []
        );

        const sendLongTextToTelegram = async (chatId, text, replyToMessageId = null) => {
            const chunks = splitTelegramText(text, TELEGRAM_MESSAGE_LIMIT);
            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                const options = { parse_mode: 'HTML' };
                if (chunkIndex === 0 && replyToMessageId) {
                    options.reply_to_message_id = replyToMessageId;
                }
                await bot.sendMessage(chatId, chunks[chunkIndex], options);
            }
        };

        const resolveMediaSource = (rawMediaSource) => {
            if (!rawMediaSource) return null;
            if (typeof rawMediaSource === 'string' && rawMediaSource.startsWith('/uploads')) {
                const relativePath = rawMediaSource.startsWith('/') ? rawMediaSource.slice(1) : rawMediaSource;
                return path.join(__dirname, '../../', relativePath);
            }
            return rawMediaSource;
        };

        const isLikelyStreamableTelegramVideo = (mediaSource) => {
            if (typeof mediaSource !== 'string') return true;
            const normalized = mediaSource.split('?')[0].toLowerCase();
            return /\.(mp4|m4v|mov)$/i.test(normalized);
        };

        const isLikelyRemoteUrl = (mediaSource) => (
            typeof mediaSource === 'string' && /^https?:\/\//i.test(mediaSource)
        );

        const isLikelyTelegramFileId = (mediaSource) => (
            typeof mediaSource === 'string' &&
            /^[A-Za-z0-9_-]{20,}$/.test(mediaSource) &&
            !mediaSource.includes('/') &&
            !mediaSource.includes('\\')
        );

        const toTelegramMediaInput = (mediaSource) => {
            if (typeof mediaSource !== 'string') return mediaSource;
            if (isLikelyRemoteUrl(mediaSource)) return mediaSource;
            if (isLikelyTelegramFileId(mediaSource)) return mediaSource;
            if (fs.existsSync(mediaSource)) return fs.createReadStream(mediaSource);
            return mediaSource;
        };

        const ensureMediaExists = (mediaSource, winnerName) => {
            if (typeof mediaSource !== 'string' || isLikelyRemoteUrl(mediaSource)) return;
            if (isLikelyTelegramFileId(mediaSource)) return;
            if (!fs.existsSync(mediaSource)) {
                throw new Error(`Video file not found for winner "${winnerName}". Path: ${mediaSource}`);
            }
            const stats = fs.statSync(mediaSource);
            if (!stats || stats.size <= 0) {
                throw new Error(`Video file is empty/corrupted for winner "${winnerName}". Path: ${mediaSource}`);
            }
        };

        const shouldFallbackToDocument = (error) => {
            const telegramDescription = (
                error?.telegramDescription ||
                error?.response?.body?.description ||
                error?.message ||
                ''
            ).toString();
            return /MEDIA_INVALID|VIDEO_CONTENT_TYPE_INVALID|wrong file identifier|video content type|not a valid|can't parse input media/i.test(telegramDescription);
        };

        const sendVideoWithDocumentFallback = async ({ chatId, mediaSource, caption = null, supportsStreaming = true }) => {
            const videoOptions = {};
            if (caption) {
                videoOptions.caption = caption;
                videoOptions.parse_mode = 'HTML';
            }
            if (supportsStreaming) {
                videoOptions.supports_streaming = true;
            }

            return await bot.sendVideo(chatId, toTelegramMediaInput(mediaSource), videoOptions);
        };

        const resolveChatIdUpgrade = async (error, fallbackChatId) => {
            const upgradedChatId = error?.response?.body?.parameters?.migrate_to_chat_id;
            if (!upgradedChatId) {
                return { chatId: fallbackChatId, migrated: false };
            }
            if (String(agent.telegram_chat_id) !== String(upgradedChatId)) {
                agent.telegram_chat_id = upgradedChatId;
                await agent.save();
            }
            return { chatId: upgradedChatId, migrated: true };
        };

        const getWinnerWarningLines = (winner) => {
            const warnPrefs = warnMap.get(String(winner._id)) || {};
            const warningLines = [];
            if (warnPrefs.meet) {
                warningLines.push('⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً');
            }
            if (warnPrefs.prev) {
                warningLines.push('‼️ يرجى التحقق أولًا من هذا العميل، حيث سبق أن فاز بجائزة (بونص تداولي) خلال الأيام الماضية');
            }
            return warningLines;
        };

        const appendWinnerWarnings = (winner, lines) => {
            const warningLines = getWinnerWarningLines(winner);
            warningLines.forEach(line => lines.push(line));
        };

        const convertLegacyWebmToMp4IfNeeded = async (mediaSource, winnerName) => {
            if (typeof mediaSource !== 'string') return mediaSource;
            if (isLikelyRemoteUrl(mediaSource) || isLikelyTelegramFileId(mediaSource)) return mediaSource;
            if (!/\.webm$/i.test(mediaSource)) return mediaSource;

            const mp4Path = mediaSource.replace(/\.webm$/i, '.mp4');
            const sourceStats = fs.statSync(mediaSource);
            if (fs.existsSync(mp4Path)) {
                const targetStats = fs.statSync(mp4Path);
                if (targetStats.size > 0 && targetStats.mtimeMs >= sourceStats.mtimeMs) {
                    return mp4Path;
                }
            }

            const { execFile } = require('child_process');
            await new Promise((resolve, reject) => {
                execFile(
                    'ffmpeg',
                    [
                        '-y',
                        '-i', mediaSource,
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart',
                        mp4Path
                    ],
                    (error) => {
                        if (error) {
                            reject(new Error(`تعذر تحويل فيديو الفائز "${winnerName}" من webm إلى mp4`));
                            return;
                        }
                        resolve();
                    }
                );
            });

            if (!fs.existsSync(mp4Path)) {
                throw new Error(`تعذر إنشاء نسخة mp4 للفائز "${winnerName}"`);
            }

            return mp4Path;
        };

        const buildWinnerCaption = (winner, winnerIndex = 0) => {
            const ordinals = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
            const rank = winner.order_number
                ? (ordinals[winner.order_number - 1] || `رقم ${winner.order_number}`)
                : (ordinals[winnerIndex] || `رقم ${winnerIndex + 1}`);

            const effectivePrizeValue = (winner.prize_value && winner.prize_value > 0) ? winner.prize_value : (
                (winner.prize_type === 'deposit_prev' || winner.prize_type === 'deposit')
                    ? (agent.deposit_bonus_percentage || 0)
                    : 0
            );

            let prizeText = '';
            if (winner.prize_type === 'deposit_prev') {
                prizeText = `${effectivePrizeValue}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
            } else if (winner.prize_type === 'deposit') {
                prizeText = `${effectivePrizeValue}% بونص إيداع`;
            } else {
                prizeText = `${effectivePrizeValue}$ بونص تداولي`;
            }

            const lines = [
                `◃ الفائز ${rank}: ${winner.name}`,
                `           الجائزة: ${prizeText}`
            ];
            appendWinnerWarnings(winner, lines);
            lines.push('');
            lines.push('********************************************************');
            lines.push('يرجى ابلاغ الفائزين بالتواصل معنا عبر معرف التليجرام و الاعلان عنهم بمعلوماتهم و فيديو الروليت بالقناة ');
            lines.push('https://t.me/Ibinzo');
            return lines.join('\n');
        };

        // جلب الفائزين مرتبين حسب order_number
        const winners = await Winner.find({ _id: { $in: winnerIds } }).sort({ order_number: 1 });
        
        // Filter winners with videos - مع الحفاظ على الترتيب
        const winnersWithVideos = winners.filter(w => w.video_url);
        
        if (winnersWithVideos.length === 0) {
             // If no videos, just send text
             await sendLongTextToTelegram(agent.telegram_chat_id, messageText);
             
             // Competition status update removed to prevent auto-completion

             return res.json({ message: 'Text report sent (no videos found)' });
        }

        let currentChatId = agent.telegram_chat_id;
        for (let i = 0; i < winnersWithVideos.length; i++) {
            const winner = winnersWithVideos[i];
            const rawMediaSource = resolveMediaSource(winner.video_url);
            ensureMediaExists(rawMediaSource, winner.name || winner._id);
            const mediaSource = await convertLegacyWebmToMp4IfNeeded(rawMediaSource, winner.name || winner._id);
            const caption = buildWinnerCaption(winner, i);

            let captionForVideo = caption;
            let longTextForReply = null;
            if ((captionForVideo || '').length > TELEGRAM_CAPTION_LIMIT) {
                captionForVideo = FALLBACK_MEDIA_CAPTION;
                longTextForReply = caption;
            }

            let sentMessage;
            try {
                sentMessage = await sendVideoWithDocumentFallback({
                    chatId: currentChatId,
                    mediaSource,
                    caption: captionForVideo,
                    supportsStreaming: true
                });
            } catch (videoError) {
                const migration = await resolveChatIdUpgrade(videoError, currentChatId);
                if (!migration.migrated) {
                    throw videoError;
                }
                currentChatId = migration.chatId;
                sentMessage = await sendVideoWithDocumentFallback({
                    chatId: currentChatId,
                    mediaSource,
                    caption: captionForVideo,
                    supportsStreaming: true
                });
            }

            if (longTextForReply) {
                await sendLongTextToTelegram(currentChatId, longTextForReply, sentMessage?.message_id);
            }

            if (i + 1 < winnersWithVideos.length) {
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

        winnerDetailsDebugLog('[sendWinnersDetails] Received request:', { 
            agentId, 
            winnerIds, 
            includeWarnMeet, 
            includeWarnPrev, 
            warnings,
            override_chat_id 
        });

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

        // جلب الفائزين مرتبين حسب order_number
        const winners = await Winner.find({ _id: { $in: winnerIds } }).sort({ order_number: 1 });
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
        winnerDetailsDebugLog('[sendWinnersDetails] warnMap built:', Object.fromEntries(warnMap));

        const mapAgencyType = (agentDoc) => {
            const exclusiveRanks = ['CENTER', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'SAPPHIRE', 'EMERALD', 'KING', 'LEGEND', 'وكيل حصري بدون مرتبة'];
            const rawRank = (agentDoc?.rank || '').toString().trim();
            const rank = /[A-Za-z]/.test(rawRank) ? rawRank.toUpperCase() : rawRank;
            const classification = (agentDoc?.classification || '').toString().trim().toUpperCase();

            if (classification === 'EXCLUSIVE' || classification === 'E' || exclusiveRanks.includes(rank) || rawRank.includes('حصري')) {
                return 'حصرية';
            }
            return 'اعتيادية';
        };

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const w of winners) {
            try {
                const effectivePrizeValue = (w.prize_value && w.prize_value > 0) ? w.prize_value : (
                    (w.prize_type === 'deposit_prev' || w.prize_type === 'deposit') 
                    ? (agent.deposit_bonus_percentage || 0) 
                    : 0
                );
                
                let prizeText = '';
                if (w.prize_type === 'deposit_prev') {
                    prizeText = `${effectivePrizeValue}% بونص إيداع كونه فائز مسبقاً ببونص تداولي`;
                } else if (w.prize_type === 'deposit') {
                    prizeText = `${effectivePrizeValue}% بونص إيداع`;
                } else {
                    prizeText = `${effectivePrizeValue}$ بونص تداولي`;
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

                winnerDetailsDebugLog(`[sendWinnersDetails] Winner ${w._id} warnings:`, { 
                    warnPrefs, 
                    useWarnMeet, 
                    useWarnPrev,
                    globalIncludeWarnMeet: includeWarnMeet,
                    globalIncludeWarnPrev: includeWarnPrev
                });

                const warningBlocks = [];
                if (useWarnMeet) {
                    warningBlocks.push("⚠️ يرجى الاجتماع مع العميل والتحقق منه أولاً");
                }
                if (useWarnPrev) {
                    warningBlocks.push("‼️ يرجى التحقق أولًا من هذا العميل، حيث سبق أن فاز بجائزة (بونص تداولي) خلال الأيام الماضية.\nيُرجى التأكد من أن الوكيل قد قام بنشر المسابقة السابقة الخاصة بهذا العميل قبل اعتماد الجائزة الحالية");
                }
                if (warningBlocks.length > 0) {
                    lines.push(warningBlocks.join("\n\n"));
                }

                const caption = lines.join('\n');

                let imageSource = w.national_id_image || null;
                if (imageSource && imageSource.startsWith('/uploads')) {
                    const rel = imageSource.startsWith('/') ? imageSource.slice(1) : imageSource;
                    imageSource = path.join(__dirname, '../../', rel);
                    
                    // Check if file exists
                    if (!fs.existsSync(imageSource)) {
                        console.warn(`[sendWinnersDetails] Image file not found for winner ${w._id}: ${imageSource}`);
                        imageSource = null; // Fallback to text
                    }
                }

                // Use override_chat_id if provided, otherwise fallback to agent's chat
                // Special case: if override_chat_id is 'COMPANY_GROUP', use the env var
                let targetChatId = agent.telegram_chat_id;
                
                if (override_chat_id === 'COMPANY_GROUP') {
                    targetChatId = process.env.AGENT_COMPETITIONS_CHAT_ID;
                } else if (override_chat_id) {
                    targetChatId = override_chat_id;
                }
                
                if (!targetChatId) {
                    console.warn('[sendWinnersDetails] No target chat id available');
                    failCount++;
                    errors.push({ winner: w.name, error: 'No chat ID available' });
                    continue; 
                }

                if (imageSource) {
                    await sendPhotoToTelegram(bot, imageSource, caption, targetChatId);
                } else {
                    await postToTelegram(bot, caption, targetChatId);
                }
                successCount++;

            } catch (innerError) {
                console.error(`[sendWinnersDetails] Failed to send winner ${w._id}:`, innerError);
                failCount++;
                errors.push({ winner: w.name, error: innerError.message });
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

        if (successCount === 0 && failCount > 0) {
            return res.status(500).json({ message: 'فشل إرسال جميع الفائزين.', errors });
        }

        return res.json({ 
            message: `تم إرسال البيانات. نجح: ${successCount}, فشل: ${failCount}`, 
            target: override_chat_id ? 'company_group' : 'agent_group',
            details: { successCount, failCount, errors }
        });

    } catch (error) {
        console.error('Error sending winners details:', error);
        return res.status(500).json({ message: 'Failed to send winners details: ' + error.message });
    }
};

/**
 * @route   POST /api/agents/validate-winners-images
 * @desc    Check if winner images exist on server before sending
 * @access  Private
 */
exports.validateWinnersImages = async (req, res) => {
    try {
        const { winnerIds } = req.body;
        if (!winnerIds || !Array.isArray(winnerIds) || winnerIds.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        const winners = await Winner.find({ _id: { $in: winnerIds } });
        const invalidWinners = [];

        for (const w of winners) {
            let isValid = true;
            let reason = '';

            if (!w.national_id_image) {
                isValid = false;
                reason = 'لم يتم رفع صورة الهوية';
            } else {
                let imagePath = w.national_id_image;
                if (imagePath.startsWith('/uploads')) {
                    const rel = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
                    const absolutePath = path.join(__dirname, '../../', rel);
                    
                    if (!fs.existsSync(absolutePath)) {
                        isValid = false;
                        reason = 'ملف صورة الهوية غير موجود على السيرفر';
                    } else {
                        // Professional Check: Ensure file is not empty (0 bytes)
                        const stats = fs.statSync(absolutePath);
                        if (stats.size === 0) {
                            isValid = false;
                            reason = 'ملف صورة الهوية تالف (حجمه 0 بايت)';
                        }
                    }
                }
            }

            // Check for video if it exists in the record
            if (w.video_url) {
                let videoPath = w.video_url;
                if (videoPath.startsWith('/uploads')) {
                    const rel = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
                    const absolutePath = path.join(__dirname, '../../', rel);
                    
                    if (!fs.existsSync(absolutePath)) {
                        isValid = false;
                        reason = reason ? reason + ' + ملف الفيديو غير موجود' : 'ملف الفيديو غير موجود على السيرفر';
                    } else {
                        // Professional Check: Ensure video file is not empty
                        const stats = fs.statSync(absolutePath);
                        if (stats.size === 0) {
                            isValid = false;
                            reason = reason ? reason + ' + ملف الفيديو تالف' : 'ملف الفيديو تالف (حجمه 0 بايت)';
                        }
                    }
                }
            } else {
                // If video is mandatory for all winners, uncomment below:
                // isValid = false;
                // reason = reason ? reason + ' + لم يتم رفع الفيديو' : 'لم يتم رفع الفيديو';
            }

            if (!isValid) {
                invalidWinners.push({
                    id: w._id,
                    name: w.name,
                    reason: reason
                });
            }
        }

        res.json({
            valid: invalidWinners.length === 0,
            invalidWinners
        });

    } catch (error) {
        console.error('Error validating winners images:', error);
        res.status(500).json({ message: 'Validation failed', error: error.message });
    }
};

exports.getAgentWinners = async (req, res) => {
    try {
        const { id } = req.params; // agentId
        const { competition_id } = req.query;

        let query = { agent_id: id };
        if (competition_id) {
            query.competition_id = competition_id;
        }

        const winners = await Winner.find(query).sort({ selected_at: -1 });

        // Group by competition to match frontend expectation
        const competitionsMap = {};
        winners.forEach(w => {
            const compId = w.competition_id.toString();
            if (!competitionsMap[compId]) {
                competitionsMap[compId] = {
                    competition_id: compId,
                    winners: []
                };
            }
            
            competitionsMap[compId].winners.push({
                id: w._id,
                name: w.name,
                account_number: w.account_number,
                email: w.email,
                prize_type: w.prize_type,
                prize_value: w.prize_value,
                video_url: w.video_url,
                national_id_image: w.national_id_image,
                selected_at: w.selected_at
            });
        });

        const competitions = Object.values(competitionsMap);

        res.json({
            competitions: competitions
        });

    } catch (error) {
        console.error('Error fetching agent winners:', error);
        res.status(500).json({ message: 'Error fetching winners', error: error.message });
    }
};





