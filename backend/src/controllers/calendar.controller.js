const Agent = require('../models/Agent');
const Task = require('../models/Task');
const mongoose = require('mongoose');

/**
 * Fetches all data needed for the calendar view.
 * - All active agents with their schedules.
 * - All tasks.
 */
exports.getCalendarData = async (req, res) => {
    try {
        // --- FIX: Use a date range for the current week to avoid timezone issues ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ...

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek); // Go back to the last Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7); // Go forward 7 days to the next Sunday

        // We can fetch in parallel for better performance
        const [agents, tasks] = await Promise.all([
            Agent.find({
                audit_days: { $exists: true, $not: { $size: 0 } } // FIX: Remove status check to include all agents with audit days
            })
                .select('name agent_id avatar_url audit_days classification remaining_balance remaining_deposit_bonus deposit_bonus_percentage')
                .lean(),
            Task.find({
                date: { $gte: startOfWeek, $lt: endOfWeek } // Fetch tasks only for the current week
            }).lean()
        ]);
        console.log(`[Calendar] Fetched ${agents.length} agents with audit days.`);

        res.json({
            agents,
            tasks
        });

    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).json({ message: 'Server error while fetching calendar data.', error: error.message });
    }
};