const Agent = require('../../models/agent.model');
const Competition = require('../../models/Competition.model');
const ActivityLog = require('../../models/ActivityLog'); // Assuming ActivityLog model exists
const User = require('../../models/User'); // Assuming User model exists

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

exports.getAnalyticsData = async (req, res) => {
    try {
        const { from, to, range } = req.query;
        let startDate, endDate;

        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999); // Set to end of the day
        } else if (range) {
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(endDate);
            if (range === '7') {
                startDate.setDate(endDate.getDate() - 6); // Last 7 days including today
            } else if (range === '30') {
                startDate.setDate(endDate.getDate() - 29); // Last 30 days including today
            } else if (range === '90') {
                startDate.setDate(endDate.getDate() - 89); // Last 90 days including today
            } else if (range === '365') {
                startDate.setDate(endDate.getDate() - 364); // Last 365 days including today
            }
            startDate.setHours(0, 0, 0, 0);
        } else {
            // Default to last 7 days if no filter is provided
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
        }

        const dateFilter = {
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // 1. Most Frequent Competitions
        const mostFrequentCompetitions = await Competition.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$template_id',
                    count: { $sum: 1 },
                    template_name: { $first: '$name' } // Assuming 'name' field holds the template name
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // 2. Peak Hours (from ActivityLog)
        const peakHours = await ActivityLog.aggregate([
            { $match: { ...dateFilter, type: 'COMPETITION_SENT' } }, // Filter for relevant activity
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    report_count: { $sum: 1 }
                }
            },
            { $project: { hour: '$_id', report_count: 1, _id: 0 } },
            { $sort: { hour: 1 } }
        ]);

        // 3. Country Stats (from ActivityLog, requires IP to country resolution)
        // This is a complex task. For now, we'll return a placeholder or
        // assume IP addresses are stored and can be resolved.
        // If IP addresses are not stored or resolution is not implemented,
        // this part will need significant additional work.
        const countryStats = []; // Placeholder

        // 4. Top IPs (from ActivityLog)
        const topIPs = await ActivityLog.aggregate([
            { $match: { ...dateFilter, type: 'COMPETITION_SENT', ip_address: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$ip_address',
                    report_count: { $sum: 1 }
                }
            },
            { $project: { ip: '$_id', report_count: 1, _id: 0 } },
            { $sort: { report_count: -1 } },
            { $limit: 10 }
        ]);

        // 5. Employee Performance (from ActivityLog)
        const employeePerformance = await ActivityLog.aggregate([
            { $match: { ...dateFilter, user_id: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: '$user_id',
                    report_count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users', // The collection name for the User model
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user_info'
                }
            },
            { $unwind: '$user_info' },
            {
                $project: {
                    username: '$user_info.username',
                    avatar_url: '$user_info.avatar_url',
                    report_count: 1,
                    _id: 0
                }
            },
            { $sort: { report_count: -1 } },
            { $limit: 10 }
        ]);


        res.json({
            most_frequent_competitions: mostFrequentCompetitions,
            peak_hours: peakHours,
            country_stats: countryStats, // Currently a placeholder
            top_ips: topIPs,
            employee_performance: employeePerformance
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ message: 'Server error while fetching analytics data.', error: error.message });
    }
};

// استرجاع أكثر المسابقات تفاعلاً ببيانات تفصيلية
exports.getInteractiveCompetitions = async (req, res) => {
    try {
        const { from, to, limit = 50, sort = 'combined' } = req.query;
        let startDate, endDate;
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23,59,59,999);
        } else {
            endDate = new Date();
            endDate.setHours(23,59,59,999);
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 29); // افتراضي 30 يوم
            startDate.setHours(0,0,0,0);
        }

        const matchStage = {
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // اجمع المسابقات المكتملة أو المرسلة (يمكن تعديل الشرط لاحقاً)
        const pipeline = [
            { $match: matchStage },
            {
                $project: {
                    template_id: 1,
                    name: 1,
                    question: '$name',
                    views_count: 1,
                    reactions_count: 1,
                    participants_count: 1,
                    correct_answer: 1,
                    type: 1,
                    createdAt: 1
                }
            },
            {
                $group: {
                    _id: '$template_id',
                    template_name: { $first: '$name' },
                    question: { $first: '$question' },
                    correct_answer: { $first: '$correct_answer' },
                    type: { $first: '$type' },
                    views_count: { $sum: { $ifNull: ['$views_count', 0] } },
                    reactions_count: { $sum: { $ifNull: ['$reactions_count', 0] } },
                    participants_count: { $sum: { $ifNull: ['$participants_count', 0] } },
                    send_count: { $sum: 1 }
                }
            }
        ];

        let results = await Competition.aggregate(pipeline);

        // حساب مؤشر مركب في الذاكرة
        const maxV = Math.max(...results.map(r => r.views_count || 0), 1);
        const maxR = Math.max(...results.map(r => r.reactions_count || 0), 1);
        const maxP = Math.max(...results.map(r => r.participants_count || 0), 1);
        const maxS = Math.max(...results.map(r => r.send_count || 0), 1);

        results = results.map(r => ({
            ...r,
            combined: ((r.views_count/maxV)*0.25 + (r.reactions_count/maxR)*0.30 + (r.participants_count/maxP)*0.35 + (r.send_count/maxS)*0.10)
        }));

        const sorters = {
            combined: (a,b) => b.combined - a.combined,
            views: (a,b) => (b.views_count||0) - (a.views_count||0),
            reactions: (a,b) => (b.reactions_count||0) - (a.reactions_count||0),
            participants: (a,b) => (b.participants_count||0) - (a.participants_count||0),
            sends: (a,b) => (b.send_count||0) - (a.send_count||0)
        };
        results.sort(sorters[sort] || sorters.combined);
        results = results.slice(0, parseInt(limit,10));

        res.json({
            from: startDate,
            to: endDate,
            count: results.length,
            data: results
        });
    } catch (err) {
        console.error('Error fetching interactive competitions:', err);
        res.status(500).json({ message: 'Server error fetching interactive competitions', error: err.message });
    }
};