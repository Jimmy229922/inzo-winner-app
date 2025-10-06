const Log = require('../models/Log');

exports.getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'newest', agent_id, populate } = req.query;
        console.log('[Logs] Received request with query:', req.query);

        let query = {};
        if (agent_id) {
            // --- FIX: Let Mongoose handle the string-to-ObjectId casting during the query. ---
            query.agent_id = agent_id;
        }

        let sortOptions = { createdAt: -1 }; // Default to newest
        if (sort === 'oldest') {
            sortOptions = { createdAt: 1 };
        }

        console.log('[Logs] Executing find with query:', JSON.stringify(query));
        let logQuery = Log.find(query)
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        if (populate === 'user') {
            logQuery = logQuery.populate('user', 'full_name').populate('agent_id', 'name phone');
        }

        const logs = await logQuery;
        console.log(`[Logs] Found ${logs.length} logs.`);

        const count = await Log.countDocuments(query);

        // Add user_name to logs for easier display
        const formattedLogs = logs.map(log => ({
            ...log,
            user_name: log.user ? log.user.full_name : 'النظام',
            created_at: log.createdAt ? log.createdAt.toISOString() : null
        }));

        res.json({
            data: formattedLogs,
            count: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        console.error('[Logs] Error fetching logs:', error);
        res.status(500).json({ message: 'Server error while fetching logs.', error: error.message });
    }
};

exports.createLog = async (req, res) => {
    try {
        const { agent_id, action_type, description, metadata } = req.body;
        // FIX: Prioritize user_id from the request body, fallback to authenticated user context.
        const userId = req.body.user_id || req.user?._id;

        const log = new Log({
            user: userId, // This now correctly uses the user ID from body or auth context.
            agent_id: agent_id,
            action_type,
            description,
            metadata
        });

        await log.save();
        res.status(201).json({ message: 'Log created successfully.', data: log });
    } catch (error) {
        console.error('[Logs] Error creating log:', error);
        res.status(400).json({ message: 'Failed to create log.', error: error.message });
    }
};