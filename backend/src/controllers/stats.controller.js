const Agent = require('../models/Agent');
const Competition = require('../models/Competition');
const Task = require('../models/Task');

// This controller will handle fetching statistics for the dashboard.
exports.getHomeStats = async (req, res) => {
    try {
        // --- FIX: Implement the actual data fetching logic instead of returning dummy data ---
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        const dayOfWeekIndex = startOfToday.getDay();

        // Fetch all stats in parallel for better performance
        const [
            totalAgents,
            activeCompetitions,
            competitionsTodayCount,
            agentsForToday,
            tasksForToday,
            newAgentsThisMonth,
            agentsByClassification,
            topAgents,
            competitionsTodayHourly
        ] = await Promise.all([
            Agent.countDocuments(),
            Competition.countDocuments({ is_active: true }),
            Competition.countDocuments({ createdAt: { $gte: startOfToday, $lt: endOfToday } }),
            // Fetch agents for today's tasks (if not Saturday)
            dayOfWeekIndex !== 6 ? Agent.find({ audit_days: { $in: [dayOfWeekIndex] } }).select('name _id avatar_url classification').lean() : Promise.resolve([]),
            // Fetch tasks for today (if not Saturday)
            dayOfWeekIndex !== 6 ? Task.find({ date: { $gte: startOfToday, $lt: endOfToday } }).lean() : Promise.resolve([]),
            // Dummy data for now, can be implemented later
            Promise.resolve(0),
            Promise.resolve([]),
            Promise.resolve([]),
            Promise.resolve([])
        ]);

        const stats = {
            total_agents: totalAgents,
            active_competitions: activeCompetitions,
            competitions_today_count: competitionsTodayCount,
            agents_for_today: agentsForToday,
            tasks_for_today: tasksForToday,
            new_agents_this_month: 0,
            agents_by_classification: [],
            tasks_for_today: [],
            top_agents: [],
            competitions_today_hourly: []
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching home stats:', error);
        res.status(500).json({ message: 'Server error while fetching home stats.', error: error.message });
    }
};

exports.getTopAgentsStats = async (req, res) => {
    try {
        const { dateRange } = req.query; // 'all', 'week', 'month'
        let competitionsQuery = { views_count: { $ne: null } };

        if (dateRange && dateRange !== 'all') {
            const now = new Date();
            let startDate;
            if (dateRange === 'week') {
                const firstDayOfWeek = now.getDate() - now.getDay(); // Sunday is the first day
                startDate = new Date(now.setDate(firstDayOfWeek));
            } else if (dateRange === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            if (startDate) {
                startDate.setHours(0, 0, 0, 0);
                competitionsQuery.createdAt = { $gte: startDate };
            }
        }

        const [agents, competitions] = await Promise.all([
            Agent.find({ status: 'Active' }).select('name agent_id avatar_url classification rank createdAt').lean(),
            Competition.find(competitionsQuery).select('agent_id views_count reactions_count participants_count createdAt').sort({ createdAt: -1 }).lean()
        ]);

        res.json({ agents, competitions });

    } catch (error) {
        console.error('Error fetching top agents stats:', error);
        res.status(500).json({ message: 'Server error while fetching top agents stats.', error: error.message });
    }
};

exports.getAgentAnalytics = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { dateRange } = req.query; // 'all', '7d', '30d', 'month'

        let competitionsQuery = {
            agent_id: agentId,
            views_count: { $ne: null } // Only competitions with stats
        };

        if (dateRange && dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();

            if (dateRange === '7d') {
                startDate.setDate(now.getDate() - 7);
            } else if (dateRange === '30d') {
                startDate.setDate(now.getDate() - 30);
            } else if (dateRange === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            startDate.setHours(0, 0, 0, 0);
            competitionsQuery.createdAt = { $gte: startDate };
        }

        const competitions = await Competition.find(competitionsQuery).select('name createdAt views_count reactions_count participants_count').sort({ createdAt: -1 }).lean();

        res.json({ competitions });
    } catch (error) {
        console.error(`Error fetching analytics for agent ${req.params.agentId}:`, error);
        res.status(500).json({ message: 'Server error while fetching agent analytics.', error: error.message });
    }
};