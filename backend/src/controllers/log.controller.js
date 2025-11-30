const ActivityLog = require('../models/ActivityLog');

/**
 * @desc    Get all activity logs with filtering and pagination
 * @route   GET /api/logs
 * @access  Private (Admin/Super Admin)
 */
exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 25, sort, user_id, agent_id, action_type, populate, date_from, date_to, q } = req.query;

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

        // Date range filter (ISO date strings expected)
        if (date_from || date_to) {
            query.createdAt = {};
            if (date_from) {
                const d = new Date(date_from);
                if (!isNaN(d.getTime())) query.createdAt.$gte = d;
            }
            if (date_to) {
                const d = new Date(date_to);
                if (!isNaN(d.getTime())) query.createdAt.$lte = d;
            }
        }

        // Text search over description
        if (q && q.trim().length > 0) {
            query.description = { $regex: q.trim(), $options: 'i' };
        }

        let sortOptions = { createdAt: -1 }; // Default to newest first
        if (sort === 'oldest') {
            sortOptions = { createdAt: 1 };
        }

        const logsQuery = ActivityLog.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit, 10) || 25)
            .skip((parseInt(page, 10) - 1) * (parseInt(limit, 10) || 25))
            .lean();

        if (populate === 'user') {
            logsQuery.populate('user_id', 'full_name');
        }

        const logs = await logsQuery;
        const count = await ActivityLog.countDocuments(query);

        // Add user_name to logs for frontend convenience
        const formattedLogs = logs.map(log => ({
            ...log,
            user_name: log.user_id ? (log.user_id.full_name || (log.user_id.name || 'مستخدم')) : 'النظام'
        }));

        res.json({
            data: formattedLogs,
            count: count,
            totalPages: Math.ceil(count / (parseInt(limit, 10) || 25)),
            currentPage: parseInt(page, 10)
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

/**
 * @desc    Delete multiple logs by IDs
 * @route   DELETE /api/logs
 * @access  Private (Admin/Super Admin)
 */
exports.deleteLogs = async (req, res) => {
    try {
        const ids = req.body && req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No IDs provided for deletion.' });
        }

        const result = await ActivityLog.deleteMany({ _id: { $in: ids } });
        res.json({ deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting logs.', error: error.message });
    }
};

/**
 * @desc    Purge ALL activity logs (irreversible)
 * @route   DELETE /api/logs/purge
 * @access  Private (Super Admin only)
 */
exports.purgeAllLogs = async (req, res) => {
    try {
        // Authorization: only super_admin allowed
        const role = (req.user?.role || '').toLowerCase();
        if (role !== 'super_admin') {
            return res.status(403).json({ message: 'Forbidden: Super Admin only.' });
        }
        const result = await ActivityLog.deleteMany({});
        res.json({ deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server error while purging logs.', error: error.message });
    }
};