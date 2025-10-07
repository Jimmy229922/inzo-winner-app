const ActivityLog = require('../models/ActivityLog');

/**
 * @desc    Get all activity logs with filtering and pagination
 * @route   GET /api/logs
 * @access  Private (Admin/Super Admin)
 */
exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 25, sort, user_id, agent_id, action_type, populate } = req.query;

        let query = {};

        if (user_id && user_id !== 'all') {
            // Handle "System" user filter
            query.user_id = user_id === 'system' ? null : user_id;
        }
        if (agent_id && agent_id !== 'all') {
            query.agent_id = agent_id;
        }
        if (action_type && action_type !== 'all') {
            query.action_type = action_type;
        }

        let sortOptions = { createdAt: -1 }; // Default to newest first
        if (sort === 'oldest') {
            sortOptions = { createdAt: 1 };
        }

        const logsQuery = ActivityLog.find(query)
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        if (populate === 'user') {
            logsQuery.populate('user_id', 'full_name');
        }

        const logs = await logsQuery;
        const count = await ActivityLog.countDocuments(query);

        // Add user_name to logs for frontend convenience
        const formattedLogs = logs.map(log => ({
            ...log,
            user_name: log.user_id ? log.user_id.full_name : 'النظام'
        }));

        res.json({
            data: formattedLogs,
            count: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching logs.', error: error.message });
    }
};

/**
 * @desc    Create a new activity log entry
 * @route   POST /api/logs
 * @access  Private (Authenticated users)
 */
exports.createLog = async (req, res) => {
    try {
        const { user_id, agent_id, action_type, description, metadata } = req.body;

        const newLog = new ActivityLog({
            user_id,
            agent_id,
            action_type,
            description,
            metadata
        });

        const savedLog = await newLog.save();
        res.status(201).json({ data: savedLog });
    } catch (error) {
        res.status(400).json({ message: 'Failed to create log entry.', error: error.message });
    }
};