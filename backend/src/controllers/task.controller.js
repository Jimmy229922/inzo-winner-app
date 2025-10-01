const Task = require('../models/Task');
const Agent = require('../models/Agent');

/**
 * Fetches all agents scheduled for today and their task statuses.
 */
exports.getTodayTasks = async (req, res) => {
    try {
        // --- FIX: Use a date range to avoid timezone issues ---
        // Get the start of today (midnight) in the server's timezone
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        // Get the end of today
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);

        // 1. Find all agents who are scheduled for today
        const dayOfWeekIndex = startOfToday.getDay();
        // Ensure we don't fetch on Saturday (day 6)
        if (dayOfWeekIndex === 6) {
            return res.json({ agents: [], tasksMap: {} });
        }

        const query = { audit_days: { $in: [dayOfWeekIndex] } }; // FIX: Remove status check to include all agents with audit days
        console.log('[Tasks] Finding agents for today with query:', JSON.stringify(query));
        const agentsForToday = await Agent.find(query)
            .select('name agent_id classification avatar_url remaining_balance remaining_deposit_bonus deposit_bonus_percentage')
            .lean();
        console.log(`[Tasks] Found ${agentsForToday.length} agents for today.`);

        // --- FIX: If no agents are found, return early with empty data ---
        if (agentsForToday.length === 0) {
            return res.json({ agents: [], tasksMap: {} });
        }

        // 2. Find all existing tasks for these agents for today
        const agentIds = agentsForToday.map(a => a._id);
        const tasks = await Task.find({
            agent_id: { $in: agentIds },
            date: { $gte: startOfToday, $lt: endOfToday } // Find tasks within the 24-hour range of today
        }).lean();

        // 3. Combine the data
        const tasksMap = tasks.reduce((map, task) => {
            map[task.agent_id.toString()] = task;
            return map;
        }, {});

        res.json({ agents: agentsForToday, tasksMap: tasksMap });
    } catch (error) {
        console.error('Error fetching today\'s tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.', error: error.message });
    }
};

/**
 * Gets statistics for today's tasks (total and completed).
 */
exports.getTodayTaskStats = async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        const dayOfWeekIndex = startOfToday.getDay();

        if (dayOfWeekIndex === 6) { // Saturday
            return res.json({ total: 0, completed: 0 });
        }

        // 1. Find total agents scheduled for today
        const total = await Agent.countDocuments({ audit_days: { $in: [dayOfWeekIndex] } });

        if (total === 0) {
            return res.json({ total: 0, completed: 0 });
        }

        // 2. Find completed tasks for today (audited = true)
        const agentIdsForToday = (await Agent.find({ audit_days: { $in: [dayOfWeekIndex] } }).select('_id')).map(a => a._id);

        const completed = await Task.countDocuments({
            agent_id: { $in: agentIdsForToday },
            date: { $gte: startOfToday, $lt: endOfToday },
            audited: true // FIX: Completion is based on audit only
        });

        res.json({ total, completed });
    } catch (error) {
        console.error('Error fetching today\'s task stats:', error);
        res.status(500).json({ message: 'Server error while fetching task stats.', error: error.message });
    }
};

/**
 * Creates or updates a task's status (audited or competition_sent).
 */
exports.updateTaskStatus = async (req, res) => {
    // --- FIX: Handle both new and legacy request formats more robustly ---
    let { agentId, taskType, status } = req.body;
    const userId = req.user.userId;

    // Compatibility for older request format
    // This format is sent from the calendar page
    if (req.body.agentId && req.body.taskType && typeof req.body.status === 'boolean') {
        agentId = req.body.agentId;
        taskType = req.body.taskType;
        status = req.body.status;
    } else if (req.body.agent_id && req.body.updates) { // Legacy format from older tasks.js
        agentId = req.body.agent_id;
        const updateKey = Object.keys(req.body.updates)[0];
        if (updateKey) {
            taskType = updateKey;
            status = req.body.updates[updateKey];
        }
    }

    if (!agentId || !taskType || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: agentId, taskType, status.' });
    }

    try {
        // --- FIX: Use a date range to avoid timezone issues ---
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const update = {
            [taskType]: status,
            [`${taskType}_by`]: userId
        };

        // When upserting, always set the date to the start of today
        const upsertUpdate = { ...update, date: startOfToday };

        const task = await Task.findOneAndUpdate({ agent_id: agentId, date: startOfToday }, { $set: upsertUpdate }, { new: true, upsert: true });
        res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error while updating task.', error: error.message });
    }
};