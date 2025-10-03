
const Agent = require('../models/Agent');

// Get all agents with pagination, search, and filtering
exports.getAllAgents = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, classification, sort, eligibleForBalance, for_tasks, select, agent_ids, names } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { agent_id: { $regex: search, $options: 'i' } }
            ];
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
            const today = new Date().getDay(); // Sunday - Saturday : 0 - 6
            query.audit_days = today;
        }

        if (agent_ids || names) {
            const orConditions = [];
            if (agent_ids) {
                orConditions.push({ agent_id: { $in: agent_ids.split(',') } });
            }
            if (names) {
                orConditions.push({ name: { $in: names.split(',').map(decodeURIComponent) } });
            }
            if (orConditions.length > 0) {
                query.$or = orConditions;
            }
        }

        const sortOptions = {};
        if (sort === 'name_asc') {
            sortOptions.name = 1;
        } else {
            sortOptions.createdAt = -1; // Default to newest
        }

        const selectFields = select ? select.split(',').join(' ') : '';

        const agents = await Agent.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((page - 1) * limit)
            .select(selectFields)
            .lean();

        const count = await Agent.countDocuments(query);

        res.json({
            data: agents,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching agents.', error: error.message });
    }
};

// Get a single agent by ID
exports.getAgentById = async (req, res) => {
    try {
        const agent = await Agent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }
        res.json({ data: agent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create a new agent
exports.createAgent = async (req, res) => {
    try {
        const { agent_id, name } = req.body;
        const existingAgent = await Agent.findOne({ $or: [{ agent_id }, { name }] });
        if (existingAgent) {
            return res.status(400).json({ message: 'Agent with this ID or name already exists.' });
        }
        const newAgent = new Agent(req.body);
        await newAgent.save();
        res.status(201).json({ data: newAgent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Update an agent
exports.updateAgent = async (req, res) => {
    try {
        const updateData = { ...req.body };
        const agent = await Agent.findById(req.params.id);

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // --- إصلاح: التعامل مع القيم الرقمية التي قد تكون null ---
        // إذا تم تحديث الرصيد المستهلك أو بونص الإيداع، أعد حساب الأرصدة المتبقية
        const totalBonus = agent.competition_bonus || 0;
        const totalDepositBonus = agent.deposit_bonus_count || 0;

        // Check if consumed_balance is being updated
        if (req.body.consumed_balance !== undefined && req.body.consumed_balance !== null) {
            updateData.remaining_balance = totalBonus - req.body.consumed_balance;
        }

        // Check if used_deposit_bonus is being updated
        if (req.body.used_deposit_bonus !== undefined && req.body.used_deposit_bonus !== null) {
            updateData.remaining_deposit_bonus = totalDepositBonus - req.body.used_deposit_bonus;
        }

        const updatedAgent = await Agent.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
        res.json({ data: updatedAgent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete an agent
exports.deleteAgent = async (req, res) => {
    try {
        const agent = await Agent.findByIdAndDelete(req.params.id);
        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }
        res.json({ message: 'Agent deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Check for uniqueness
exports.checkUniqueness = async (req, res) => {
    try {
        const { agent_id } = req.query;
        if (!agent_id) {
            return res.status(400).json({ message: 'Agent ID is required.' });
        }
        const agent = await Agent.findOne({ agent_id });
        res.json({ exists: !!agent });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Bulk renew balances
exports.bulkRenewBalances = async (req, res) => {
    try {
        const result = await Agent.updateMany({}, [
            {
                $set: {
                    consumed_balance: 0,
                    remaining_balance: "$competition_bonus",
                    used_deposit_bonus: 0,
                    remaining_deposit_bonus: "$deposit_bonus_count",
                    last_renewal_date: new Date()
                }
            }
        ]);
        res.json({ message: 'Balances renewed successfully.', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error during bulk renewal.', error: error.message });
    }
};

// Bulk insert agents
exports.bulkInsertAgents = async (req, res) => {
    try {
        const agents = req.body;
        const result = await Agent.insertMany(agents, { ordered: false });
        res.status(201).json({ message: 'Bulk insert successful.', insertedCount: result.length });
    } catch (error) {
        // Handle duplicate key errors specifically
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Bulk insert failed due to duplicate agent ID or name.', error: error.message, insertedCount: error.result.nInserted });
        }
        res.status(500).json({ message: 'Server error during bulk insert.', error: error.message });
    }
};

// Bulk update agents
exports.bulkUpdateAgents = async (req, res) => {
    try {
        const agentsToUpdate = req.body;
        const bulkOps = agentsToUpdate.map(agent => ({
            updateOne: {
                filter: { _id: agent.id },
                update: { $set: agent }
            }
        }));
        const result = await Agent.bulkWrite(bulkOps);
        res.json({ message: 'Bulk update successful.', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error during bulk update.', error: error.message });
    }
};

// Delete all agents (Super Admin only)
exports.deleteAllAgents = async (req, res) => {
    try {
        // A safety check should be in the middleware, but we can double-check here
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: This action is restricted to Super Admins.' });
        }
        await Agent.deleteMany({});
        res.json({ message: 'All agents have been deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during deletion.', error: error.message });
    }
};
                