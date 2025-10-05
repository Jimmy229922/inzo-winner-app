const Agent = require('../models/Agent');
const { logActivity } = require('../utils/logActivity');

exports.getAllAgents = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, classification, sort, eligibleForBalance, for_tasks, select } = req.query;

        let query = {};

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (classification && classification !== 'all') {
            query.classification = classification;
        }

        if (eligibleForBalance === 'true') {
            query.telegram_chat_id = { $ne: null };
            query.$or = [
                { remaining_balance: { $gt: 0 } },
                { remaining_deposit_bonus: { $gt: 0 } }
            ];
        }

        if (for_tasks === 'today') {
            const dayOfWeekIndex = new Date().getDay();
            query.audit_days = { $in: [dayOfWeekIndex] };
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
        // --- FIX: Add detailed activity logging on agent update ---
        const agentBeforeUpdate = await Agent.findById(req.params.id).lean();
        if (!agentBeforeUpdate) return res.status(404).json({ message: 'Agent not found.' });

        const updatedAgent = await Agent.findByIdAndUpdate(req.params.id, req.body, { new: true });

        // Compare old and new data to generate a log description
        const changes = [];
        for (const key in req.body) {
            if (JSON.stringify(agentBeforeUpdate[key]) !== JSON.stringify(req.body[key])) {
                changes.push(`'${key}' from '${agentBeforeUpdate[key] || 'empty'}' to '${req.body[key] || 'empty'}'`);
            }
        }

        if (changes.length > 0) {
            const description = `Agent profile updated. Changes: ${changes.join(', ')}.`;
            // Assuming req.user is populated by auth middleware
            const userId = req.user ? req.user._id : null; 
            await logActivity(userId, updatedAgent._id, 'AGENT_UPDATE', description, req.body);
        }

        res.json({ data: updatedAgent });

    } catch (error) {
        res.status(400).json({ message: 'Failed to update agent.', error: error.message });
    }
};

exports.deleteAgent = async (req, res) => {
    try {
        const agent = await Agent.findByIdAndDelete(req.params.id);
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
exports.renewEligibleAgentBalances = async () => {
    console.log('[Renewal Job] Checking for agents eligible for automatic balance renewal...');
    // Find agents with a renewal period set
    const agentsToRenew = await Agent.find({ renewal_period: { $in: ['weekly', 'biweekly', 'monthly'] } });

    let renewedCount = 0;
    const now = new Date();

    for (const agent of agentsToRenew) {
        const lastRenewal = agent.last_renewal_date || agent.createdAt;
        let nextRenewalDate = new Date(lastRenewal);

        switch (agent.renewal_period) {
            case 'weekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 7);
                break;
            case 'biweekly':
                nextRenewalDate.setDate(nextRenewalDate.getDate() + 14);
                break;
            case 'monthly':
                nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
                break;
        }

        if (now >= nextRenewalDate) {
            console.log(`[Renewal Job] Renewing balance for agent: ${agent.name} (ID: ${agent._id})`);
            // This is the full renewal logic
            agent.remaining_balance = agent.competition_bonus;
            agent.consumed_balance = 0;
            agent.remaining_deposit_bonus = agent.deposit_bonus_count;
            agent.used_deposit_bonus = 0;
            agent.last_renewal_date = now;

            await agent.save();
            renewedCount++;
        }
    }
    console.log(`[Renewal Job] Finished. Renewed ${renewedCount} agents.`);
    return renewedCount;
};

// --- NEW: Bulk renew balances for all agents ---
exports.bulkRenewBalances = async (req, res) => {
    try {
        console.log('[Bulk Renew] Received request to renew all agent balances.');
        // FIX: Find all agents that are NOT explicitly inactive. This includes new agents ('Active') and old agents (status is undefined).
        const agents = await Agent.find({ status: { $ne: 'inactive' } });
        console.log(`[Bulk Renew] Found ${agents.length} active agents to process.`);
        let processedCount = 0;

        if (!agents || agents.length === 0) {
            console.log('[Bulk Renew] No active agents found. Exiting.');
            return res.json({ message: 'No active agents found to renew.', processedCount: 0 });
        }

        for (const agent of agents) {
            console.log(`[Bulk Renew] Processing agent: ${agent.name} (ID: ${agent._id})`);
            console.log(`  - Before - Remaining: ${agent.remaining_balance}, Consumed: ${agent.consumed_balance}`);

            // --- FIX: Sanitize old/invalid enum values before saving ---
            // This prevents validation errors on agents with legacy data like '1d' or '2d'.
            if (agent.competition_duration && !['24h', '48h'].includes(agent.competition_duration)) {
                console.log(`  - Sanitizing invalid competition_duration: '${agent.competition_duration}'`);
                agent.competition_duration = null; // Set to null or a valid default
            }

            // The new logic: add consumed balance back to remaining and reset consumed.
            const newRemainingBalance = (agent.remaining_balance || 0) + (agent.consumed_balance || 0);
            
            agent.remaining_balance = newRemainingBalance;
            agent.consumed_balance = 0;
            
            // Save each agent individually for better reliability over bulkWrite
            await agent.save();
            console.log(`  - After - Remaining: ${agent.remaining_balance}, Consumed: ${agent.consumed_balance}`);
            
            processedCount++;
        }

        console.log(`[Bulk Renew] Process completed. Total agents renewed: ${processedCount}`);
        res.json({ message: 'Bulk renewal process completed successfully.', processedCount });
    } catch (error) {
        console.error('[Bulk Renew] An error occurred during the process:', error);
        res.status(500).json({ message: 'Server error during bulk balance renewal.', error: error.message });
    }
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
        console.error('Error checking agent uniqueness:', error);
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

        console.log(`[Manual Renew] Renewing balance for single agent: ${agent.name}`);
        agent.remaining_balance = agent.competition_bonus;
        agent.consumed_balance = 0;
        agent.remaining_deposit_bonus = agent.deposit_bonus_count;
        agent.used_deposit_bonus = 0;
        agent.last_renewal_date = new Date();

        await agent.save();
        res.json({ message: 'Agent balance renewed successfully.', data: agent });
    } catch (error) {
        res.status(500).json({ message: 'Failed to renew agent balance.', error: error.message });
    }
};