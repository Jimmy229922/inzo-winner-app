const Agent = require('../models/agent.model');
const Competition = require('../models/Competition');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Winner = require('../models/Winner');

// Helper to calculate next renewal date (Same logic as agent controller)
const calculateNextRenewalDate = (agent) => {
    if (!agent.renewal_period || agent.renewal_period === 'none') return null;
    const lastRenewal = agent.last_renewal_date || agent.createdAt;
    if (!lastRenewal) return null;

    let nextRenewalDate = new Date(lastRenewal);
    switch (agent.renewal_period) {
        case 'weekly': nextRenewalDate.setDate(nextRenewalDate.getDate() + 7); break;
        case 'biweekly': nextRenewalDate.setDate(nextRenewalDate.getDate() + 14); break;
        case 'monthly': 
            const originalDay = nextRenewalDate.getDate();
            nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
            if (nextRenewalDate.getDate() !== originalDay) nextRenewalDate.setDate(0);
            break;
    }
    return nextRenewalDate;
};

exports.getDashboardInsights = async (req, res) => {
    try {
        const now = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(now.getDate() + 3);
        
        // Get start of today and this month
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Get Renewal Alerts (Agents expiring within 3 days)
        const agentsWithRenewal = await Agent.find({ 
            renewal_period: { $in: ['weekly', 'biweekly', 'monthly'] },
            status: { $ne: 'inactive' }
        }).select('name agent_id renewal_period last_renewal_date createdAt competition_bonus remaining_balance');

        const renewalAlerts = agentsWithRenewal.map(agent => {
            const nextDate = calculateNextRenewalDate(agent);
            if (!nextDate) return null;
            
            if (nextDate <= threeDaysFromNow) {
                const diffTime = nextDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return {
                    _id: agent._id,
                    name: agent.name,
                    agent_id: agent.agent_id,
                    next_renewal_date: nextDate,
                    days_remaining: diffDays,
                    status: diffDays < 0 ? 'expired' : 'soon'
                };
            }
            return null;
        }).filter(item => item !== null).sort((a, b) => a.days_remaining - b.days_remaining);

        // 2. Get Pending Competitions
        const pendingCompetitions = await Competition.find({
            $or: [
                { status: 'pending' },
                { 
                    status: 'active', 
                    ends_at: { $lt: now },
                    winners_selected_at: null 
                }
            ]
        }).populate('agent_id', 'name').sort({ createdAt: -1 });

        const formattedCompetitions = pendingCompetitions.map(comp => ({
            _id: comp._id,
            title: comp.name || 'مسابقة بدون عنوان',
            agent_name: comp.agent_id ? comp.agent_id.name : 'وكيل غير معروف',
            type: comp.status === 'pending' ? 'approval_needed' : 'selection_needed',
            ends_at: comp.ends_at
        }));

        // 3. Get Low Balance Agents
        const lowBalanceAgents = await Agent.find({
            status: { $ne: 'inactive' },
            remaining_balance: { $lte: 5 },
            competition_bonus: { $gt: 0 }
        }).select('name agent_id remaining_balance competition_bonus').sort({ remaining_balance: 1 });

        // 4. Get System Stats
        const totalAgentsCount = await Agent.countDocuments({});
        const activeAgentsCount = await Agent.countDocuments({ status: 'active' });
        const activeCompetitionsCount = await Competition.countDocuments({ status: 'active' });
        const totalUsersCount = await User.countDocuments({});
        
        // Total balance across all agents
        const balanceAgg = await Agent.aggregate([
            { $match: { status: { $ne: 'inactive' } } },
            { $group: { _id: null, total: { $sum: '$remaining_balance' } } }
        ]);
        const totalBalance = balanceAgg.length > 0 ? Math.round(balanceAgg[0].total) : 0;
        
        // Competitions today
        const competitionsToday = await Competition.countDocuments({
            createdAt: { $gte: startOfToday }
        });
        
        // Monthly winners count
        let monthlyWinners = 0;
        try {
            monthlyWinners = await Winner.countDocuments({
                createdAt: { $gte: startOfMonth }
            });
        } catch (e) {
            // Winner model might not exist
            monthlyWinners = 0;
        }
        
        // 5. Get Recent Activity
        const recentActivity = await ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user_id', 'full_name')
            .populate('agent_id', 'name');

        const formattedActivity = recentActivity.map(log => ({
            action: log.action_type,
            details: log.description,
            user: log.user_id ? log.user_id.full_name : 'System',
            agent: log.agent_id ? log.agent_id.name : '-',
            time: log.createdAt
        }));
        
        // 6. Today's Summary
        const completedToday = await Competition.countDocuments({
            status: 'completed',
            updatedAt: { $gte: startOfToday }
        });
        
        let winnersToday = 0;
        try {
            winnersToday = await Winner.countDocuments({
                createdAt: { $gte: startOfToday }
            });
        } catch (e) {
            winnersToday = 0;
        }
        
        // Count renewals today (agents whose last_renewal_date is today)
        const renewalsToday = await Agent.countDocuments({
            last_renewal_date: { $gte: startOfToday }
        });

        res.json({
            stats: {
                total_agents: totalAgentsCount,
                active_agents: activeAgentsCount,
                active_competitions: activeCompetitionsCount,
                total_users: totalUsersCount,
                total_balance: totalBalance,
                competitions_today: competitionsToday,
                monthly_winners: monthlyWinners
            },
            renewals: renewalAlerts,
            competitions: formattedCompetitions,
            low_balance: lowBalanceAgents,
            recent_activity: formattedActivity,
            today_summary: {
                completed_competitions: completedToday,
                new_winners: winnersToday,
                renewals_today: renewalsToday
            }
        });

    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard insights.', error: error.message });
    }
};
