const Agent = require('../models/agent.model');
const { logActivity } = require('../utils/logActivity');
const { translateField, formatValue } = require('../utils/fieldTranslations');

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

        const count = await Agent.countDocuments(query);

        res.json({
            data: agents,
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

exports.createAgent = async (req, res) => {
    try {
        // --- FIX: Ensure new agents are created with an 'Active' status by default ---
        req.body.status = req.body.status || 'Active';
        const agent = new Agent(req.body);
        await agent.save();
        res.status(201).json({ data: agent });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create agent.', error: error.message });
    }
};

exports.updateAgent = async (req, res) => {
    try {
        // --- DEBUG: Log the incoming request body from the frontend ---
        console.log(`[Agent Update] Received request to update agent ${req.params.id}.`);
        console.log('[Agent Update] Request Body:', JSON.stringify(req.body, null, 2));

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

        // تحضير وصف مفصل للتغييرات
        const changes = Object.entries(req.body).map(([field, newValue]) => {
            const oldValue = agentBeforeUpdate[field];
            // نتحقق فقط من الحقول التي تغيرت قيمتها
            if (field === 'deposit_bonus_winners_count' && isFinancialUpdate) return null; // تجاهل هذا الحقل إذا كان هناك تحديث مالي آخر
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
        console.log('[Agent Update] Data after saving to database:', JSON.stringify(updatedAgent, null, 2));
        console.log(`[DEBUG] Verifying save for "deposit_bonus_winners_count". Value in DB: ${updatedAgent.deposit_bonus_winners_count}. Value from request: ${req.body.deposit_bonus_winners_count}`);

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
        await Agent.deleteMany({});
        res.json({ message: 'All agents have been deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete all agents.', error: error.message });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        const agent = await Agent.findByIdAndDelete(req.params.id);

        // --- FIX: Log this action ---
        const userId = req.user?._id;
        if (userId && agent) {
            await logActivity(userId, agent._id, 'AGENT_DELETED', `تم حذف الوكيل: ${agent.name}.`);
        }

        if (!agent) return res.status(404).json({ message: 'Agent not found.' });
        res.json({ message: 'Agent deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete agent.', error: error.message });
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
        const lastRenewal = agent.last_renewal_date || agent.createdAt;
        let nextRenewalDate = new Date(lastRenewal);

        switch (agent.renewal_period) {
            case 'weekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 6);
                break;
            case 'biweekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 13);
                break;
            case 'monthly':
                nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
                nextRenewalDate.setDate(nextRenewalDate.getDate() - 1);
                break;
        }

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
            
            // Save each agent individually for better reliability over bulkWrite
            await agent.save();
            
            processedCount++;
        }

        // --- FIX: Log this bulk action ---
        const userId = req.user?._id;
        if (userId) {
            await logActivity(userId, null, 'AGENT_BULK_RENEW', `تم تشغيل عملية تجديد الرصيد الجماعي لـ ${processedCount} وكيل.`);
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
            await logActivity(userId, agent._id, 'MANUAL_RENEWAL', `تم تجديد الرصيد يدوياً للوكيل ${agent.name}.`);
        }

        res.json({ message: 'Agent balance renewed successfully.', data: agent });
    } catch (error) {
        res.status(500).json({ message: 'Failed to renew agent balance.', error: error.message });
    }
};