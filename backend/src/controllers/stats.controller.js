const Agent = require('../models/agent.model');
const Competition = require('../models/Competition');
const Log = require('../models/ActivityLog'); // Corrected path
const Template = require('../models/CompetitionTemplate');
const AgentRankChange = require('../models/AgentRankChange');
const mongoose = require('mongoose');

/**
 * @desc    Get all analytics data for the dashboard
 * @route   GET /api/analytics
 * @access  Private (Admin)
 */
exports.getAnalytics = async (req, res) => {
    try {
        // --- 1. Date Filtering Logic ---
        const { from, to, range } = req.query;
        let startDate, endDate = new Date();

        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999); // Include the whole end day
        } else {
            const rangeDays = parseInt(range) || 30;
            startDate = new Date();
            if (range === 'year') {
                startDate.setFullYear(startDate.getFullYear(), 0, 1); // Start of the current year
            } else {
                startDate.setDate(startDate.getDate() - rangeDays);
            }
        }

        const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

        // --- 2. Execute All Aggregations in Parallel ---
        const [
            kpis,
            mostFrequentCompetitions,
            competitionsByDay,
            agentClassification,
            competitionPerformance,
            activityDistribution,
            completedCompetitions,
            grantedBalances,
            weeklyExcellence
        ] = await Promise.all([
            getKpiData(dateFilter),
            getMostFrequentCompetitions(dateFilter),
            getCompetitionsByDay(dateFilter),
            getAgentClassification(),
            getCompetitionPerformance(),
            getActivityDistribution(dateFilter),
            getCompletedCompetitions(dateFilter),
            getGrantedBalances(dateFilter),
            getWeeklyExcellence(dateFilter)
        ]);

        // --- 3. Combine and Send Response ---
        // Spread kpis at the root level for backward compatibility
        res.json({
            ...kpis, // This will put all KPI fields at root level
            kpis, // Also keep it nested for components that expect it
            most_frequent_competitions: mostFrequentCompetitions,
            competitions_by_day: competitionsByDay,
            agent_classification: agentClassification,
            competition_performance: competitionPerformance,
            activity_distribution: activityDistribution,
            completed_competitions: completedCompetitions,
            granted_balances: grantedBalances,
            weekly_excellence: weeklyExcellence,
        });

    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ message: 'Server error while fetching analytics data.' });
    }
};

/**
 * @desc    Get all statistics for the home page dashboard
 * @route   GET /api/stats/home
 * @access  Private
 */
exports.getHomeStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const endOfToday = new Date(today.setHours(23, 59, 59, 999));
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const dayOfWeekIndex = new Date().getDay();

        const [
            total_agents,
            active_competitions,
            competitions_today_count,
            new_agents_this_month,
            agents_by_classification,
            agents_for_today,
            tasks_for_today,
            top_agents,
            competitions_today_hourly
        ] = await Promise.all([
            Agent.countDocuments({ status: 'Active' }),
            Competition.countDocuments({ is_active: true }),
            Competition.countDocuments({ createdAt: { $gte: startOfToday, $lt: endOfToday } }),
            Agent.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Agent.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$classification', count: { $sum: 1 } } }
            ]),
            Agent.find({ audit_days: { $in: [dayOfWeekIndex] } }).select('name agent_id classification avatar_url').lean(),
            Agent.aggregate([
                { $match: { audit_days: { $in: [dayOfWeekIndex] } } },
                {
                    $lookup: {
                        from: 'tasks',
                        let: { agentId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $and: [ { $eq: ['$agent_id', '$$agentId'] }, { $gte: ['$task_date', startOfToday] }, { $lt: ['$task_date', endOfToday] } ] } } }
                        ],
                        as: 'tasks'
                    }
                },
                { $project: { _id: 1, 'tasks.audited': 1, 'tasks.competition_sent': 1 } }
            ]),
            Agent.find({ status: 'Active' }).sort({ rank: 1 }).limit(5).select('name agent_id avatar_url').lean(),
            Competition.find({ createdAt: { $gte: startOfToday, $lt: endOfToday } }).select('createdAt').lean()
        ]);

        const classificationCounts = agents_by_classification.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        res.json({
            total_agents,
            active_competitions,
            competitions_today_count,
            new_agents_this_month,
            agents_by_classification: classificationCounts,
            agents_for_today,
            tasks_for_today,
            top_agents,
            competitions_today_hourly: competitions_today_hourly || []
        });

    } catch (error) {
        console.error('Error fetching home stats:', error);
        res.status(500).json({ message: 'Server error while fetching home page statistics.' });
    }
};

/**
 * Fetches Key Performance Indicators (KPIs).
 * @param {object} dateFilter - MongoDB date filter object.
 * @returns {Promise<object>}
 */
async function getKpiData(dateFilter) {
    const [total_competitions_sent, new_agents_in_period, total_activities] = await Promise.all([
        Competition.countDocuments(dateFilter),
        Agent.countDocuments(dateFilter),
        Log.countDocuments(dateFilter)
    ]);
    
    // إضافة البيانات الجديدة
    return { 
        total_competitions_sent, 
        new_agents_in_period, 
        total_activities,
        granted_balances: 'لا يوجد بيانات', // يمكن تحديثها لاحقاً من قاعدة البيانات
        trading_bonus: 540, // القيمة الافتراضية
        number_of_winners: 18, // القيمة الافتراضية
        deposit_bonus: 'لا يوجد أي بيانات' // لا توجد بيانات حالياً
    };
}

/**
 * Fetches the most frequently used competition templates.
 * @param {object} dateFilter - MongoDB date filter object.
 * @returns {Promise<Array>}
 */
async function getMostFrequentCompetitions(dateFilter) {
    return Competition.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$template_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: Template.collection.name,
                localField: '_id',
                foreignField: '_id',
                as: 'template_details'
            }
        },
        {
            $project: {
                _id: 0,
                template_id: '$_id',
                count: 1,
                template_name: { $arrayElemAt: ['$template_details.name', 0] }
            }
        }
    ]);
}

/**
 * Fetches competitions count grouped by day of week.
 * @param {object} dateFilter - MongoDB date filter object.
 * @returns {Promise<Array>}
 */
async function getCompetitionsByDay(dateFilter) {
    const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    const results = await Competition.aggregate([
        { $match: dateFilter },
        {
            $group: {
                _id: { $dayOfWeek: '$createdAt' }, // 1=Sunday, 2=Monday, ..., 7=Saturday
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Convert to array with Arabic day names
    // MongoDB dayOfWeek: 1=Sunday, 2=Monday, ..., 7=Saturday
    const dayData = new Array(7).fill(0);
    results.forEach(item => {
        const dayIndex = item._id - 1; // Convert to 0-based index
        dayData[dayIndex] = item.count;
    });

    return arabicDays.map((day, index) => ({
        day: day,
        count: dayData[index]
    }));
}

/**
 * Fetches the distribution of agents by classification.
 * @returns {Promise<object>}
 */
async function getAgentClassification() {
    const results = await Agent.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$classification', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    // Convert array to object { A: count, B: count, ... }
    return results.reduce((acc, item) => {
        if (item._id) { // Ensure classification is not null/undefined
            acc[item._id] = item.count;
        }
        return acc;
    }, {});
}

/**
 * Fetches top 10 competitions by view count.
 * @returns {Promise<Array>}
 */
async function getCompetitionPerformance() {
    return Competition.aggregate([
        { $match: { views_count: { $gt: 0 } } },
        { $sort: { views_count: -1 } },
        { $limit: 10 },
        {
            $lookup: {
                from: Template.collection.name,
                localField: 'template_id',
                foreignField: '_id',
                as: 'template_details'
            }
        },
        {
            $project: {
                _id: 1,
                total_views: '$views_count',
                template_name: { $ifNull: [{ $arrayElemAt: ['$template_details.name', 0] }, 'قالب محذوف'] }
            }
        }
    ]);
}

/**
 * Fetches the distribution of activities from the Log.
 * @param {object} dateFilter - MongoDB date filter object.
 * @returns {Promise<Array>}
 */
async function getActivityDistribution(dateFilter) {
    return Log.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$action_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 7 }
    ]);
}

/**
 * Fetches completed competitions with all their details
 * @param {object} dateFilter - Date filtering criteria
 * @returns {Promise<Array>}
 */
async function getCompletedCompetitions(dateFilter) {
    try {
        const range = dateFilter?.createdAt || null;
        const dateMatch = range ? { $or: [{ processed_at: range }, { ends_at: range }] } : {};

        const completedCompetitions = await Competition.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'awaiting_winners'] },
                    ...dateMatch
                }
            },
            {
                $lookup: {
                    from: 'competitiontemplates',
                    localField: 'template_id',
                    foreignField: '_id',
                    as: 'template'
                }
            },
            {
                $unwind: {
                    path: '$template',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    question: { $ifNull: ['$template.question', '$name'] },
                    type: { $ifNull: ['$template.type', 'غير محدد'] },
                    competition_type: { $ifNull: ['$template.competition_type', null] },
                    classification: { $ifNull: ['$template.classification', 'غير محدد'] },
                    views: { $ifNull: ['$views_count', 0] },
                    participations: { $ifNull: ['$participants_count', 0] },
                    completed_at: { $ifNull: ['$processed_at', '$ends_at'] },
                    status: 1,
                    createdAt: 1
                }
            },
            {
                $group: {
                    _id: {
                        question: '$question',
                        type: '$type',
                        classification: '$classification'
                    },
                    send_count: { $sum: 1 },
                    total_views: { $sum: '$views' },
                    total_participations: { $sum: '$participations' },
                    last_completed: { $max: '$completed_at' },
                    competition_type: { $first: '$competition_type' }
                }
            },
            {
                $project: {
                    _id: 0,
                    question: '$_id.question',
                    type: '$_id.type',
                    competition_type: 1,
                    classification: '$_id.classification',
                    send_count: 1,
                    views: '$total_views',
                    participations: '$total_participations',
                    completed_at: '$last_completed'
                }
            },
            {
                $sort: { completed_at: -1 }
            }
        ]);

        return completedCompetitions;
    } catch (error) {
        console.error('Error fetching completed competitions:', error);
        return [];
    }
}

/**
 * Fetches granted balances (trading bonus and deposit bonus)
 * @param {object} dateFilter - Date filtering criteria
 * @returns {Promise<object>}
 */
async function getGrantedBalances(dateFilter) {
    try {
        const range = dateFilter?.createdAt || null;
        const dateMatch = range ? { 
            $or: [ 
                { processed_at: range },
                { ends_at: range } 
            ] 
        } : {};

        console.log('=== getGrantedBalances Debug ===');
        console.log('Date Filter:', dateFilter);
        console.log('Date Match:', dateMatch);

        // Debug: Check what competitions match our filter
        const allCompetitions = await Competition.find({
            status: 'completed'
        }).select('name deposit_winners_count deposit_bonus_percentage processed_at');
        
        console.log('All completed competitions:', allCompetitions.map(c => ({
            name: c.name,
            deposit_winners_count: c.deposit_winners_count,
            deposit_bonus_percentage: c.deposit_bonus_percentage,
            processed_at: c.processed_at
        })));

        const results = await Competition.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'awaiting_winners'] },
                    ...dateMatch
                }
            },
            {
                $group: {
                    _id: null,
                    // Trading bonus: sum across all completed/awaiting competitions regardless of deposit winners
                    trading_bonus_total: { $sum: { $ifNull: ['$total_cost', 0] } },
                    trading_bonus_winners: { $sum: { $ifNull: ['$winners_count', 0] } },
                    // Deposit bonus: count by deposit_bonus_percentage from competition
                    deposit_40: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$deposit_bonus_percentage', 0] }, 40] },
                                { $ifNull: ['$deposit_winners_count', 0] },
                                0
                            ]
                        }
                    },
                    deposit_50: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$deposit_bonus_percentage', 0] }, 50] },
                                { $ifNull: ['$deposit_winners_count', 0] },
                                0
                            ]
                        }
                    },
                    deposit_60: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$deposit_bonus_percentage', 0] }, 60] },
                                { $ifNull: ['$deposit_winners_count', 0] },
                                0
                            ]
                        }
                    },
                    deposit_75: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$deposit_bonus_percentage', 0] }, 75] },
                                { $ifNull: ['$deposit_winners_count', 0] },
                                0
                            ]
                        }
                    },
                    deposit_85: { 
                        $sum: { 
                            $cond: [
                                { $eq: [{ $ifNull: ['$deposit_bonus_percentage', 0] }, 85] },
                                { $ifNull: ['$deposit_winners_count', 0] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // Dynamic deposit breakdown by any percentage present
        const dynamicBreakdown = await Competition.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'awaiting_winners'] },
                    ...dateMatch,
                    deposit_winners_count: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: { $ifNull: ['$deposit_bonus_percentage', 0] },
                    winners_count: { $sum: { $ifNull: ['$deposit_winners_count', 0] } }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    percentage: '$_id',
                    winners_count: 1
                }
            }
        ]);

        const data = results.length > 0 ? results[0] : {
            trading_bonus_total: 0,
            trading_bonus_winners: 0,
            deposit_40: 0,
            deposit_50: 0,
            deposit_60: 0,
            deposit_75: 0,
            deposit_85: 0
        };

        console.log('Aggregation Results:', data);

        const response = {
            trading_bonus: {
                total_amount: data.trading_bonus_total || 0,
                winners_count: data.trading_bonus_winners || 0
            },
            deposit_bonus: [
                { percentage: 40, winners_count: data.deposit_40 || 0 },
                { percentage: 50, winners_count: data.deposit_50 || 0 },
                { percentage: 60, winners_count: data.deposit_60 || 0 },
                { percentage: 75, winners_count: data.deposit_75 || 0 },
                { percentage: 85, winners_count: data.deposit_85 || 0 }
            ],
            deposit_bonus_dynamic: dynamicBreakdown
        };

        console.log('Final Response:', response);
        console.log('=================================');

        return response;
    } catch (error) {
        console.error('Error fetching granted balances:', error);
        return {
            trading_bonus: { total_amount: 0, winners_count: 0 },
            deposit_bonus: []
        };
    }
}

/**
 * Fetches weekly excellence data comparing current week vs previous week
 * @param {object} dateFilter - Date filtering criteria (will be overridden for weekly comparison)
 * @returns {Promise<object>}
 */
async function getWeeklyExcellence(dateFilter) {
    try {
        // Calculate current week (Sunday to Saturday)
        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Current week: from last Sunday to now
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - currentDayOfWeek);
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(now);
        currentWeekEnd.setHours(23, 59, 59, 999);
        
        // Previous week: 7 days before current week start to day before current week start
        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(currentWeekStart.getDate() - 7);
        
        const previousWeekEnd = new Date(currentWeekStart);
        previousWeekEnd.setDate(currentWeekStart.getDate() - 1);
        previousWeekEnd.setHours(23, 59, 59, 999);

        console.log('=== getWeeklyExcellence Debug ===');
        console.log('Current Week:', currentWeekStart, 'to', currentWeekEnd);
        console.log('Previous Week:', previousWeekStart, 'to', previousWeekEnd);

        // Fetch current week data
        const currentWeekData = await Competition.aggregate([
            {
                $match: {
                    createdAt: { $gte: currentWeekStart, $lte: currentWeekEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    competitions_count: { $sum: 1 },
                    total_participations: { $sum: { $ifNull: ['$participants_count', 0] } }
                }
            }
        ]);

        // Fetch previous week data
        const previousWeekData = await Competition.aggregate([
            {
                $match: {
                    createdAt: { $gte: previousWeekStart, $lte: previousWeekEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    competitions_count: { $sum: 1 },
                    total_participations: { $sum: { $ifNull: ['$participants_count', 0] } }
                }
            }
        ]);

        const current = currentWeekData.length > 0 ? currentWeekData[0] : {
            competitions_count: 0,
            total_participations: 0
        };

        const previous = previousWeekData.length > 0 ? previousWeekData[0] : {
            competitions_count: 0,
            total_participations: 0
        };

        // Calculate percentage change
        const calculateChange = (current, previous) => {
            if (previous === 0) {
                return current > 0 ? 100 : 0;
            }
            return ((current - previous) / previous * 100).toFixed(1);
        };

        const response = {
            current_week: {
                competitions_count: current.competitions_count || 0,
                total_participations: current.total_participations || 0
            },
            previous_week: {
                competitions_count: previous.competitions_count || 0,
                total_participations: previous.total_participations || 0
            },
            change: {
                competitions_change: calculateChange(
                    current.competitions_count || 0,
                    previous.competitions_count || 0
                ),
                participations_change: calculateChange(
                    current.total_participations || 0,
                    previous.total_participations || 0
                )
            }
        };

        console.log('Weekly Excellence Response:', response);
        console.log('=================================');

        return response;
    } catch (error) {
        console.error('Error fetching weekly excellence data:', error);
        return {
            current_week: { competitions_count: 0, total_participations: 0 },
            previous_week: { competitions_count: 0, total_participations: 0 },
            change: { competitions_change: 0, participations_change: 0 }
        };
    }
}

/**
 * @desc    Get analytics for a single agent
 * @route   GET /api/stats/agent-analytics/:id
 * @access  Private (Admin)
 */
exports.getAgentAnalytics = async (req, res) => {
    try {
        const agentId = req.params.id;
        const { dateRange = 'all' } = req.query;

        let dateFilter = {};
        if (dateRange !== 'all') {
            const days = parseInt(dateRange) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            dateFilter = { createdAt: { $gte: startDate } };
        }

        const [
            agent,
            competitions,
            competitionStats,
            activityCount
        ] = await Promise.all([
            Agent.findById(agentId).lean(),
            Competition.find({ agent_id: agentId, ...dateFilter }).lean(),
            Competition.aggregate([
                { $match: { agent_id: new mongoose.Types.ObjectId(agentId), ...dateFilter } },
                { $group: { 
                    _id: null, 
                    total_competitions: { $sum: 1 },
                    active_competitions: { $sum: { $cond: ['$is_active', 1, 0] } },
                    total_views: { $sum: '$views_count' },
                    total_reactions: { $sum: '$reactions_count' },
                    total_participants: { $sum: '$participants_count' },
                    total_winners: { $sum: '$winners_count' }
                }}
            ]),
            Log.countDocuments({ agent_id: agentId, ...dateFilter })
        ]);

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        const stats = competitionStats[0] || {
            total_competitions: 0,
            active_competitions: 0,
            total_views: 0,
            total_reactions: 0,
            total_participants: 0,
            total_winners: 0
        };

        res.json({
            data: {
                agent: {
                    _id: agent._id,
                    name: agent.name,
                    classification: agent.classification,
                    rank: agent.rank,
                    avatar_url: agent.avatar_url
                },
                stats: {
                    ...stats,
                    activity_count: activityCount,
                    competitions: competitions
                }
            }
        });
    } catch (error) {
        console.error('[AGENT ANALYTICS ERROR]:', error);
        res.status(500).json({ message: 'Server error while fetching agent analytics', error: error.message });
    }
};

/**
 * @desc    Get top performing agents
 * @route   GET /api/stats/top-agents
 * @access  Private (Admin)
 */
exports.getTopAgents = async (req, res) => {
    try {
        const { limit = 10, classification } = req.query;

        // FIX: Remove status filter as agents don't have a 'status' field
        let matchStage = {};
        if (classification && classification !== 'all') {
            matchStage.classification = classification;
        }

        console.log('='.repeat(80));
        console.log('[TOP AGENTS DEBUG] Match stage:', matchStage);
        console.log('[TOP AGENTS DEBUG] Fetching agents without status filter');
        console.log('='.repeat(80));

        const topAgents = await Agent.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'competitions',
                    localField: '_id',
                    foreignField: 'agent_id',
                    as: 'competitions'
                }
            },
            {
                $addFields: {
                    competition_count: { $size: '$competitions' },
                    total_views: { $sum: '$competitions.views_count' },
                    total_reactions: { $sum: '$competitions.reactions_count' },
                    total_participants: { $sum: '$competitions.participants_count' },
                    total_winners: { $sum: '$competitions.winners_count' }
                }
            },
            { $sort: { rank: 1, competition_count: -1 } },
            { $limit: parseInt(limit) || 10 },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    agent_id: 1,
                    classification: 1,
                    rank: 1,
                    avatar_url: 1,
                    competition_count: 1,
                    total_views: 1,
                    total_reactions: 1,
                    total_participants: 1,
                    total_winners: 1
                }
            }
        ]);

        console.log('='.repeat(80));
        console.log('[TOP AGENTS DEBUG] Number of agents found:', topAgents.length);
        console.log('[TOP AGENTS DEBUG] Response structure:', {
            hasData: true,
            dataType: Array.isArray(topAgents) ? 'Array' : typeof topAgents,
            dataLength: topAgents.length,
            firstAgent: topAgents[0] || 'No agents'
        });
        console.log('='.repeat(80));

        res.json({ data: topAgents });
    } catch (error) {
        console.error('[TOP AGENTS ERROR]:', error);
        res.status(500).json({ message: 'Server error while fetching top agents', error: error.message });
    }
};

/**
 * @desc    Get competitions sent on a specific day of week
 * @route   GET /api/stats/competitions-by-day/:dayOfWeek
 * @access  Private (Admin)
 */
exports.getCompetitionsByDayOfWeek = async (req, res) => {
    try {
        const { dayOfWeek } = req.params;
        const { from, to, range } = req.query;

        // Map Arabic day names to MongoDB dayOfWeek values (1=Sunday...7=Saturday)
        const dayMapping = {
            'الأحد': 1,
            'الاثنين': 2,
            'الثلاثاء': 3,
            'الأربعاء': 4,
            'الخميس': 5,
            'الجمعة': 6,
            'السبت': 7
        };

        const dayNumber = dayMapping[dayOfWeek];
        if (!dayNumber) {
            return res.status(400).json({ message: 'Invalid day of week provided' });
        }

        // Date filtering logic (same as getAnalytics)
        let startDate, endDate = new Date();
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const rangeDays = parseInt(range) || 30;
            startDate = new Date();
            if (range === 'year') {
                startDate.setFullYear(startDate.getFullYear(), 0, 1);
            } else {
                startDate.setDate(startDate.getDate() - rangeDays);
            }
        }

        const competitions = await Competition.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $addFields: {
                    dayOfWeek: { $dayOfWeek: '$createdAt' }
                }
            },
            {
                $match: {
                    dayOfWeek: dayNumber
                }
            },
            {
                $lookup: {
                    from: 'agents',
                    localField: 'agent_id',
                    foreignField: '_id',
                    as: 'agent'
                }
            },
            {
                $unwind: {
                    path: '$agent',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'competitiontemplates',
                    localField: 'template_id',
                    foreignField: '_id',
                    as: 'template'
                }
            },
            {
                $unwind: {
                    path: '$template',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    question: { $ifNull: ['$template.question', '$name'] },
                    type: { $ifNull: ['$template.type', 'غير محدد'] },
                    competition_type: { $ifNull: ['$template.competition_type', null] },
                    classification: { $ifNull: ['$template.classification', 'غير محدد'] },
                    agent_name: { $ifNull: ['$agent.name', 'غير محدد'] },
                    agent_classification: { $ifNull: ['$agent.classification', 'غير محدد'] },
                    status: 1,
                    views_count: 1,
                    participants_count: 1,
                    winners_count: 1,
                    total_cost: 1,
                    deposit_winners_count: { $ifNull: ['$deposit_winners_count', 0] },
                    deposit_bonus_percentage: { $ifNull: ['$deposit_bonus_percentage', 0] },
                    createdAt: 1,
                    ends_at: 1,
                    image_url: { $ifNull: ['$template.image_url', '$image_url'] }
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        res.json({ 
            day: dayOfWeek,
            count: competitions.length,
            competitions: competitions 
        });

    } catch (error) {
        console.error('Error fetching competitions by day of week:', error);
        res.status(500).json({ message: 'Server error while fetching competitions by day' });
    }
};

/**
 * @desc    Get agent rank changes for analytics
 * @route   GET /api/analytics/rank-changes
 * @access  Private (Admin)
 */
exports.getRankChanges = async (req, res) => {
    try {
        const { from, to, limit = 50 } = req.query;
        
        let query = {};
        
        // Date filtering
        if (from || to) {
            query.createdAt = {};
            if (from) {
                query.createdAt.$gte = new Date(from);
            }
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDate;
            }
        }

        const rankChanges = await AgentRankChange.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({ 
            count: rankChanges.length,
            rankChanges: rankChanges 
        });

    } catch (error) {
        console.error('Error fetching rank changes:', error);
        res.status(500).json({ 
            message: 'حدث خطأ أثناء جلب بيانات تغييرات المرتبة',
            error: error.message 
        });
    }
};

/**
 * @desc    Get most interactive competitions aggregated by template
 * @route   GET /api/stats/interactive-competitions
 * @access  Private (Admin)
 */
exports.getInteractiveCompetitions = async (req, res) => {
    try {
        const { from, to, limit = 50, sort = 'views' } = req.query;
        let startDate, endDate;
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23,59,59,999);
        } else {
            endDate = new Date();
            endDate.setHours(23,59,59,999);
            startDate = new Date(endDate);
            // default last 30 days
            startDate.setDate(endDate.getDate() - 29);
            startDate.setHours(0,0,0,0);
        }

        const matchStage = { createdAt: { $gte: startDate, $lte: endDate } };

        const pipeline = [
            { $match: matchStage },
            {
                $project: {
                    template_id: 1,
                    name: 1,
                    question: { $ifNull: ['$name', '$question'] },
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
            },
            {
                $lookup: {
                    from: 'competitiontemplates',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'template'
                }
            },
            { $unwind: { path: '$template', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    template_id: '$_id',
                    template_name: { $ifNull: ['$template_name', '$template.name'] },
                    question: { $ifNull: ['$question', '$template.question'] },
                    correct_answer: 1,
                    // Prefer template.type to reflect latest changes globally
                    type: { $ifNull: ['$template.type', '$type'] },
                    views_count: 1,
                    reactions_count: 1,
                    participants_count: 1,
                    send_count: 1,
                    template_type: '$template.type'
                }
            }
        ];

        let results = await Competition.aggregate(pipeline);

        const sorters = {
            views: (a,b) => (b.views_count||0) - (a.views_count||0),
            reactions: (a,b) => (b.reactions_count||0) - (a.reactions_count||0),
            participants: (a,b) => (b.participants_count||0) - (a.participants_count||0),
            sends: (a,b) => (b.send_count||0) - (a.send_count||0)
        };
        results.sort(sorters[sort] || sorters.views);
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

/**
 * @desc    Get all agents with their competitions and compliance rate
 * @route   GET /api/stats/agents-competitions
 * @access  Private
 */
exports.getAgentsCompetitions = async (req, res) => {
    try {
        const { from, to, range, classification } = req.query;
        
        // Date filtering
        let startDate, endDate = new Date();
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const rangeDays = parseInt(range) || 30;
            startDate = new Date();
            if (range === 'year') {
                startDate.setFullYear(startDate.getFullYear(), 0, 1);
            } else {
                startDate.setDate(startDate.getDate() - rangeDays);
            }
        }

        // Build agent filter
        const agentFilter = {};
        if (classification) {
            agentFilter.classification = classification;
        }

        // Get all agents with competitions
        const agents = await Agent.find(agentFilter)
            .select('name agent_id classification avatar_url')
            .lean();

        // Get competitions for each agent
        const agentsWithCompetitions = await Promise.all(agents.map(async (agent) => {
            try {
                const competitions = await Competition.find({
                    agent_id: agent._id,
                    createdAt: { $gte: startDate, $lte: endDate }
                })
                .sort({ createdAt: -1 })
                .lean();

                if (competitions.length === 0) {
                    return null; // Skip agents with no competitions
                }

                // Get template names for competitions
                const templateIds = competitions
                    .map(c => c.template_id)
                    .filter(id => id);
                
                let templates = [];
                if (templateIds.length > 0) {
                    templates = await Template.find({ _id: { $in: templateIds } })
                        .select('_id name')
                        .lean();
                }
                
                const templateMap = {};
                templates.forEach(t => {
                    templateMap[t._id.toString()] = t.name;
                });

                // Calculate compliance rate
                // Compliance means: winners confirmed on the same day competition ends OR the day after
                let compliantCount = 0;
                let totalCompletedCompetitions = 0;

                const competitionsWithCompliance = competitions.map(comp => {
                    let isCompliant = false;
                    let complianceDetails = {
                        winners_confirmed_on_time: false,
                        expected_confirmation_date: null,
                        actual_confirmation_date: null,
                        confirmation_status: 'pending' // pending, on_time, late, early
                    };

                    if (comp.processed_at && comp.ends_at) {
                        totalCompletedCompetitions++;

                        const endsDate = new Date(comp.ends_at);
                        endsDate.setHours(0, 0, 0, 0);

                        const dayAfterEnds = new Date(endsDate);
                        dayAfterEnds.setDate(dayAfterEnds.getDate() + 1);

                        const processedDate = new Date(comp.processed_at);
                        processedDate.setHours(0, 0, 0, 0);

                        complianceDetails.expected_confirmation_date = dayAfterEnds;
                        complianceDetails.actual_confirmation_date = processedDate;

                        // Check if processed on the same day as ends_at OR the day after
                        if (processedDate.getTime() === endsDate.getTime() || processedDate.getTime() === dayAfterEnds.getTime()) {
                            complianceDetails.winners_confirmed_on_time = true;
                            complianceDetails.confirmation_status = 'on_time';
                            isCompliant = true;
                            compliantCount++;
                        } else if (processedDate.getTime() < endsDate.getTime()) {
                            complianceDetails.confirmation_status = 'early';
                        } else {
                            complianceDetails.confirmation_status = 'late';
                        }
                    }

                    return {
                        ...comp,
                        template_name: comp.template_id ? (templateMap[comp.template_id.toString()] || 'غير محدد') : 'غير محدد',
                        is_compliant: isCompliant,
                        compliance_details: complianceDetails
                    };
                });

                const complianceRate = totalCompletedCompetitions > 0 
                    ? Math.round((compliantCount / totalCompletedCompetitions) * 100) 
                    : 0;

                // Get latest competition
                const latestCompetition = competitionsWithCompliance[0] || null;

                // Aggregate stats
                const totalViews = competitions.reduce((sum, c) => sum + (c.views_count || 0), 0);
                const totalReactions = competitions.reduce((sum, c) => sum + (c.reactions_count || 0), 0);
                const totalParticipants = competitions.reduce((sum, c) => sum + (c.participants_count || 0), 0);

                return {
                    agent: {
                        _id: agent._id,
                        name: agent.name,
                        agent_id: agent.agent_id,
                        classification: agent.classification,
                        avatar_url: agent.avatar_url
                    },
                    latest_competition: latestCompetition ? {
                        _id: latestCompetition._id,
                        name: latestCompetition.name,
                        description: latestCompetition.description,
                        template_name: latestCompetition.template_name,
                        views_count: latestCompetition.views_count || 0,
                        reactions_count: latestCompetition.reactions_count || 0,
                        participants_count: latestCompetition.participants_count || 0,
                        created_at: latestCompetition.createdAt,
                        ends_at: latestCompetition.ends_at,
                        processed_at: latestCompetition.processed_at,
                        is_compliant: latestCompetition.is_compliant,
                        status: latestCompetition.status
                    } : null,
                    statistics: {
                        total_competitions: competitions.length,
                        total_views: totalViews,
                        total_reactions: totalReactions,
                        total_participants: totalParticipants,
                        compliance_rate: complianceRate,
                        compliant_competitions: compliantCount
                    },
                    all_competitions: competitionsWithCompliance
                };
            } catch (err) {
                console.error(`Error processing agent ${agent.name}:`, err);
                return null;
            }
        }));

        // Filter out null entries (agents with no competitions)
        const filteredAgents = agentsWithCompetitions.filter(a => a !== null);

        // Calculate aggregated statistics
        const aggregatedStats = {
            total_agents: filteredAgents.length,
            total_competitions: filteredAgents.reduce((sum, a) => sum + a.statistics.total_competitions, 0),
            total_views: filteredAgents.reduce((sum, a) => sum + a.statistics.total_views, 0),
            total_reactions: filteredAgents.reduce((sum, a) => sum + a.statistics.total_reactions, 0),
            total_participants: filteredAgents.reduce((sum, a) => sum + a.statistics.total_participants, 0),
            average_compliance_rate: filteredAgents.length > 0
                ? Math.round(filteredAgents.reduce((sum, a) => sum + a.statistics.compliance_rate, 0) / filteredAgents.length)
                : 0
        };

        res.json({
            from: startDate,
            to: endDate,
            aggregated_stats: aggregatedStats,
            agents: filteredAgents
        });

    } catch (error) {
        console.error('Error fetching agents competitions:', error);
        res.status(500).json({ message: 'Server error while fetching agents competitions data.', error: error.message });
    }
};

/**
 * @desc    Get recipient agents for completed competitions matching a given question
 * @route   GET /api/stats/completed-competition-recipients
 * @query   question (required), from/to or range (optional)
 * @access  Private (Admin)
 */
exports.getCompletedCompetitionRecipients = async (req, res) => {
    try {
        const { question, from, to, range } = req.query;
        if (!question || String(question).trim() === '') {
            return res.status(400).json({ message: 'Missing required parameter: question' });
        }

        // Date filter consistent with completed competitions logic
        let startDate, endDate = new Date();
        if (from && to) {
            startDate = new Date(from);
            endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
        } else if (range) {
            const days = range === 'year' ? null : parseInt(range) || 30;
            endDate = new Date();
            endDate.setHours(23,59,59,999);
            startDate = new Date(endDate);
            if (range === 'year') {
                startDate.setFullYear(startDate.getFullYear(), 0, 1);
                startDate.setHours(0,0,0,0);
            } else {
                startDate.setDate(endDate.getDate() - (days - 1));
                startDate.setHours(0,0,0,0);
            }
        } else {
            // default last 30 days
            endDate = new Date();
            endDate.setHours(23,59,59,999);
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 29);
            startDate.setHours(0,0,0,0);
        }

        const dateMatch = {
            $or: [
                { processed_at: { $gte: startDate, $lte: endDate } },
                { ends_at: { $gte: startDate, $lte: endDate } }
            ]
        };

        const recipients = await Competition.aggregate([
            {
                $match: {
                    status: { $in: ['completed', 'awaiting_winners'] },
                    ...dateMatch
                }
            },
            {
                $lookup: {
                    from: 'competitiontemplates',
                    localField: 'template_id',
                    foreignField: '_id',
                    as: 'template'
                }
            },
            { $unwind: { path: '$template', preserveNullAndEmptyArrays: true } },
            {
                $match: {
                    $or: [
                        { 'template.question': String(question) },
                        { name: String(question) }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'agents',
                    localField: 'agent_id',
                    foreignField: '_id',
                    as: 'agent'
                }
            },
            { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$agent._id',
                    name: { $first: '$agent.name' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1, name: 1 } },
            {
                $project: {
                    _id: 0,
                    name: { $ifNull: ['$name', 'غير معروف'] },
                    count: 1
                }
            }
        ]);

        return res.json({
            question: String(question),
            from: startDate,
            to: endDate,
            count: recipients.length,
            agents: recipients
        });
    } catch (error) {
        console.error('Error fetching competition recipients:', error);
        return res.status(500).json({ message: 'Server error while fetching competition recipients', error: error.message });
    }
};

/**
 * @desc    Purge all rank changes (Super Admin only)
 * @route   DELETE /api/stats/rank-changes
 * @access  Private (Super Admin only)
 */
exports.purgeAllRankChanges = async (req, res) => {
    try {
        // Check if user is super_admin
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'غير مصرح لك بحذف تغييرات المراتب' });
        }

        const AgentRankChange = require('../models/AgentRankChange');
        const result = await AgentRankChange.deleteMany({});

        console.log(`[Purge Rank Changes] Super admin ${req.user.email} deleted ${result.deletedCount} rank changes`);

        res.json({
            success: true,
            message: `تم حذف ${result.deletedCount} تغيير مرتبة بنجاح`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error purging rank changes:', error);
        res.status(500).json({ 
            message: 'حدث خطأ أثناء حذف تغييرات المراتب',
            error: error.message 
        });
    }
};

/**
 * @desc    Delete a single rank change (Super Admin only)
 * @route   DELETE /api/stats/rank-changes/:id
 * @access  Private (Super Admin only)
 */
exports.deleteRankChange = async (req, res) => {
    try {
        // Check if user is super_admin
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'غير مصرح لك بحذف تغييرات المراتب' });
        }

        const { id } = req.params;
        const AgentRankChange = require('../models/AgentRankChange');
        
        const rankChange = await AgentRankChange.findByIdAndDelete(id);
        
        if (!rankChange) {
            return res.status(404).json({ message: 'التغيير غير موجود' });
        }

        console.log(`[Delete Rank Change] Super admin ${req.user.email} deleted rank change ${id}`);

        res.json({
            success: true,
            message: 'تم حذف التغيير بنجاح'
        });
    } catch (error) {
        console.error('Error deleting rank change:', error);
        res.status(500).json({ 
            message: 'حدث خطأ أثناء حذف التغيير',
            error: error.message 
        });
    }
};
