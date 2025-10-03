const Task = require('../models/Task');
const Agent = require('../models/Agent');

/**
 * Fetches all agents scheduled for today and their task statuses.
 */
exports.getTodayTasks = async (req, res) => {
    try {
        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Find all agents who are scheduled for today
        const dayOfWeek = today.toLocaleString('en-US', { weekday: 'long' });
        const agentsForToday = await Agent.find({ 'schedule.days': dayOfWeek, 'status': 'Active' })
            .select('name agent_id classification avatar_url remaining_balance remaining_deposit_bonus deposit_bonus_percentage')
            .lean();

        // 2. Find all existing tasks for these agents for today
        const agentIds = agentsForToday.map(a => a._id);
        const tasks = await Task.find({
            agent_id: { $in: agentIds },
            date: today
        }).lean();

        // 3. Combine the data
        const tasksMap = tasks.reduce((map, task) => {
            map[task.agent_id.toString()] = task;
            return map;
        }, {});

        res.json({ agents: agentsForToday, tasks: tasksMap });
    } catch (error) {
        console.error('Error fetching today\'s tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.', error: error.message });
    }
};

/**
 * Creates or updates a task's status (audited or competition_sent).
 */
exports.updateTaskStatus = async (req, res) => {
    const { agentId, taskType, status } = req.body; // taskType can be 'audited' or 'competition_sent'
    const userId = req.user.userId;

    if (!agentId || !taskType || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: agentId, taskType, status.' });
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const update = {
            [taskType]: status,
            [`${taskType}_by`]: userId
        };

        const task = await Task.findOneAndUpdate({ agent_id: agentId, date: today }, { $set: update }, { new: true, upsert: true });
        res.json({ message: 'Task updated successfully', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error while updating task.', error: error.message });
    }
};