const Agent = require('../models/Agent');
const Competition = require('../models/Competition');

// This controller will handle fetching statistics for the dashboard.
exports.getHomeStats = async (req, res) => {
    try {
        const totalAgents = await Agent.countDocuments();

        // For now, we return some real data and some dummy data.
        // This will be fully implemented later.
        const stats = {
            total_agents: totalAgents,
            active_competitions: 0,
            competitions_today_count: 0,
            agents_for_today: [],
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