const Agent = require('../../models/agent.model');
const Competition = require('../../models/Competition.model');

exports.getHomePageStats = async (req, res) => {
    try {
        const totalAgents = await Agent.countDocuments();

        // These are placeholders for now, as we haven't migrated these tables yet.
        const activeCompetitions = 0;
        const competitionsTodayCount = 0;
        const agentsForToday = [];
        const tasksForToday = [];
        const topAgents = [];

        // Calculate new agents this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newAgentsThisMonth = await Agent.countDocuments({
            createdAt: { $gte: startOfMonth }
        });

        // Get agent counts by classification
        const agentsByClassification = await Agent.aggregate([
            { $group: { _id: '$classification', count: { $sum: 1 } } },
            { $project: { classification: '$_id', count: 1, _id: 0 } }
        ]);

        res.json({
            total_agents: totalAgents,
            active_competitions: activeCompetitions,
            competitions_today_count: competitionsTodayCount,
            agents_for_today: agentsForToday,
            new_agents_this_month: newAgentsThisMonth,
            agents_by_classification: agentsByClassification,
            tasks_for_today: tasksForToday,
            top_agents: topAgents
        });
    } catch (error) {
        console.error('Error fetching home page stats:', error);
        res.status(500).json({ message: 'Server error while fetching stats.' });
    }
};