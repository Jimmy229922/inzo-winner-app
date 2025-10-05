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

// --- NEW: Bulk renew balances for all agents ---
exports.bulkRenewBalances = async (req, res) => {
    try {
        // FIX: Use the correct field 'status' instead of the obsolete 'is_active' to find agents.
        const agents = await Agent.find({ status: 'Active' });
        let processedCount = 0;

        if (!agents || agents.length === 0) {
            return res.json({ message: 'No active agents found to renew.', processedCount: 0 });
        }

        for (const agent of agents) {
            // The new logic: add consumed balance back to remaining and reset consumed.
            const newRemainingBalance = (agent.remaining_balance || 0) + (agent.consumed_balance || 0);
            
            agent.remaining_balance = newRemainingBalance;
            agent.consumed_balance = 0;
            
            // Save each agent individually for better reliability over bulkWrite
            await agent.save();
            
            processedCount++;
        }

        res.json({ message: 'Bulk renewal process completed successfully.', processedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error during bulk balance renewal.', error: error.message });
    }
};