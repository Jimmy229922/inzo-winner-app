const Agent = require('../models/Agent');
const Task = require('../models/Task');

/**
 * Fetches all data needed for the calendar view.
 * - All active agents with their schedules.
 * - All tasks.
 */
exports.getCalendarData = async (req, res) => {
    try {
        // We can fetch in parallel for better performance
        const [agents, tasks] = await Promise.all([
            Agent.find({ status: 'Active' })
                .select('name agent_id avatar_url schedule classification')
                .lean(),
            Task.find({}).lean()
        ]);

        res.json({
            agents,
            tasks
        });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ message: 'Server error while fetching calendar data.', error: error.message });
    }
};