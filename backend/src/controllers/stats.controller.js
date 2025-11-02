const Agent = require('../models/agent.model');
const Competition = require('../models/Competition');
const Task = require('../models/Task');

/**
 * @desc    Get all statistics for the home page dashboard
 * @route   GET /api/stats/home
 * @access  Private
 */
exports.getHomeStats = async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 1. جلب المسابقات التي تم إنشاؤها اليوم
        const competitionsToday = await Competition.find({
            createdAt: {
                $gte: today,
                $lt: tomorrow
            }
        }).select('createdAt').lean();

        // 2. جلب إحصائيات أخرى (يمكن إضافتها هنا مستقبلاً)
        const totalAgents = await Agent.countDocuments();
        const activeCompetitions = await Competition.countDocuments({ is_active: true });

        // --- FIX: Implement fetching today's tasks and agents ---
        const dayOfWeekIndex = today.getUTCDay();
        let agentsForToday = [];
        let tasksForToday = [];

        if (dayOfWeekIndex !== 6) { // Not Saturday
            agentsForToday = await Agent.find({ audit_days: { $in: [dayOfWeekIndex] } })
                .select('name agent_id classification avatar_url')
                .lean();

            if (agentsForToday.length > 0) {
                const agentIds = agentsForToday.map(a => a._id);
                tasksForToday = await Task.find({
                    agent_id: { $in: agentIds },
                    task_date: { $gte: today, $lt: tomorrow }
                }).lean();
            }
        }

        // Fetch other stats (can be expanded later)
        const newAgentsThisMonth = await Agent.countDocuments({ createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) } });
        const agentsByClassification = await Agent.aggregate([ { $group: { _id: '$classification', count: { $sum: 1 } } } ]);
        // top_agents can be implemented later

        res.json({
            // البيانات الأساسية للرسم البياني
            competitions_today_hourly: competitionsToday,

            // بيانات إضافية للبطاقات العلوية
            total_agents: totalAgents,
            active_competitions: activeCompetitions,
            competitions_today_count: competitionsToday.length,

            // بيانات المهام اليومية
            agents_for_today: agentsForToday,
            tasks_for_today: tasksForToday,
            new_agents_this_month: newAgentsThisMonth,
            agents_by_classification: (agentsByClassification || []).reduce((acc, item) => { 
                if (item && item._id) {
                    acc[item._id] = item.count; 
                }
                return acc; 
            }, {}),
            top_agents: [] // Placeholder for future implementation
        });

    } catch (error) {
        console.error("Error fetching home stats:", error);
        res.status(500).json({ message: 'Server error while fetching home stats.', error: error.message });
    }
};

/**
 * @desc    Get analytics for a single agent
 * @route   GET /api/stats/agent-analytics/:id
 * @access  Private
 */
exports.getAgentAnalytics = async (req, res) => {
    try {
        const { dateRange = 'all' } = req.query;
        const agentId = req.params.id;

        const query = { agent_id: agentId, status: 'completed' };

        // --- FIX: Correctly calculate date ranges without modifying the original date object ---
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate;
            switch(dateRange) {
                case '7d':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                    break;
                case '30d':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
            if (startDate) {
                startDate.setHours(0, 0, 0, 0); // Set to the beginning of the day
                query.createdAt = { $gte: startDate };
            }
        }

        const competitions = await Competition.find(query)
            .sort({ createdAt: -1 })
            .select('name createdAt views_count reactions_count participants_count')
            .lean();

        // No need to check for !competitions, as find() returns an empty array, not null/undefined
        
        res.json({
            competitions
        });

    } catch (error) {
        console.error(`Error fetching analytics for agent ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while fetching agent analytics.', error: error.message });
    }
};

/**
 * @desc    Get top performing agents
 * @route   GET /api/stats/top-agents
 * @access  Private
 */
exports.getTopAgents = async (req, res) => {
    try {
        const { dateRange = 'all' } = req.query;
        const now = new Date();
        const query = { status: 'completed' };

        // تحديد نطاق التاريخ للبحث
        if (dateRange !== 'all') {
            let startDate;
            switch(dateRange) {
                case 'week':
                    const firstDayOfWeek = now.getDate() - now.getDay(); // Sunday is the first day
                    startDate = new Date(now.getFullYear(), now.getMonth(), firstDayOfWeek);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate.setHours(0, 0, 0, 0);
                    break;
            }
            if (startDate) {
                query.createdAt = { $gte: startDate };
            }
        }

        // 1. Get all agents
        const allAgents = await Agent.find({})
            .select('name agent_id classification avatar_url rank')
            .lean();

        // 2. Get competition stats
        const competitionStats = await Competition.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$agent_id',
                    competitions_count: { $sum: 1 },
                    total_views: { $sum: '$views_count' },
                    total_reactions: { $sum: '$reactions_count' },
                    total_participants: { $sum: '$participants_count' },
                    last_competition: { $max: '$createdAt' }
                }
            }
        ]);

        // 3. Map agents to their stats
        const topAgents = allAgents.map(agent => {
            const stats = competitionStats.find(s => s._id.toString() === agent._id.toString());

            return {
                _id: agent._id,
                name: agent.name,
                agent_id: agent.agent_id,
                classification: agent.classification,
                avatar_url: agent.avatar_url,
                rank: agent.rank,
                competitions_count: stats ? stats.competitions_count : 0,
                total_views: stats ? stats.total_views : 0,
                total_reactions: stats ? stats.total_reactions : 0,
                total_participants: stats ? stats.total_participants : 0,
                last_competition: stats ? stats.last_competition : null,
                average_participants: stats && stats.competitions_count > 0 ? (stats.total_participants / stats.competitions_count).toFixed(1) : 0
            };
        });

        res.json(topAgents);
    } catch (error) {
        console.error("Error fetching top agents:", error);
        res.status(500).json({ message: 'Server error while fetching top agents.', error: error.message });
    }
};