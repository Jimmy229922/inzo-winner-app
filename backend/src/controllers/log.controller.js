
const Log = require('../models/Log');

exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, agent_id } = req.query;
        const query = {};

        if (agent_id) {
            query.agent_id = agent_id;
        }

        const logs = await Log.find(query)
            .populate('user', 'full_name')
            .populate('agent_id', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((page - 1) * parseInt(limit))
            .lean();

        const formattedLogs = logs.map(log => ({
            ...log,
            user_name: log.user ? log.user.full_name : 'نظام',
            agent_name: log.agent_id ? log.agent_id.name : null
        }));

        const count = await Log.countDocuments(query);

        res.json({
            data: formattedLogs,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching logs.', error: error.message });
    }
};

exports.createLog = async (req, res) => {
    try {
        const { agent_id, action_type, description, metadata } = req.body;
        const user = req.user.userId; // Get user from auth middleware

        const newLog = new Log({
            user,
            agent_id,
            action_type,
            description,
            metadata
        });

        await newLog.save();
        res.status(201).json({ message: 'Log created successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while creating log.', error: error.message });
    }
};
                