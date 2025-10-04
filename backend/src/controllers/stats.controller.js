const Agent = require('../models/Agent');
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

        // يمكنك إضافة المزيد من الإحصائيات التي تحتاجها الصفحة الرئيسية هنا
        // const agentsForToday = ...
        // const tasksForToday = ...
        // const agentsByClassification = ...
        // const topAgents = ...

        res.json({
            // البيانات الأساسية للرسم البياني
            competitions_today_hourly: competitionsToday,

            // بيانات إضافية للبطاقات العلوية
            total_agents: totalAgents,
            active_competitions: activeCompetitions,
            competitions_today_count: competitionsToday.length,

            // بيانات يمكن تفعيلها لاحقاً
            agents_for_today: [],
            tasks_for_today: [],
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
            query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
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