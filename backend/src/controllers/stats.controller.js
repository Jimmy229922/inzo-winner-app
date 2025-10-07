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

        const now = new Date();
        if (dateRange === '7d') {
            query.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        } else if (dateRange === '30d') {
            query.createdAt = { $gte: new Date(now.setDate(now.getDate() - 30)) };
        } else if (dateRange === 'month') {
        }

        const competitions = await Competition.find(query)
            .sort({ createdAt: -1 })
            .select('name createdAt views_count reactions_count participants_count')
            .lean();

        if (!competitions) {
            return res.status(404).json({ message: 'No analytics data found for this agent.' });
        }

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
        const { dateRange = 'all', limit = 10 } = req.query;
        const now = new Date();
        const query = { status: 'completed' };

        // تحديد نطاق التاريخ للبحث
        if (dateRange !== 'all') {
            let startDate;
            switch(dateRange) {
                case '7d':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case '30d':
                    startDate = new Date(now.setDate(now.getDate() - 30));
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }
            if (startDate) {
                query.createdAt = { $gte: startDate };
            }
        }

        // جمع الإحصائيات من جدول المسابقات
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
            },
            { $sort: { competitions_count: -1, total_participants: -1 } },
            { $limit: parseInt(limit) }
        ]);

        // جلب معلومات الوكلاء
        const agentIds = competitionStats.map(stat => stat._id);
        const agents = await Agent.find({ _id: { $in: agentIds } })
            .select('name agent_id classification avatar_url');

        // دمج البيانات
        const topAgents = competitionStats.map(stat => {
            const agent = agents.find(a => a._id.toString() === stat._id.toString());
            if (!agent) return null;

            return {
                _id: agent._id,
                name: agent.name,
                agent_id: agent.agent_id,
                classification: agent.classification,
                avatar_url: agent.avatar_url,
                competitions_count: stat.competitions_count,
                total_views: stat.total_views,
                total_reactions: stat.total_reactions,
                total_participants: stat.total_participants,
                last_competition: stat.last_competition,
                average_participants: (stat.total_participants / stat.competitions_count).toFixed(1)
            };
        }).filter(Boolean);

        res.json(topAgents);
    } catch (error) {
        console.error("Error fetching top agents:", error);
        res.status(500).json({ message: 'Server error while fetching top agents.', error: error.message });
    }
};