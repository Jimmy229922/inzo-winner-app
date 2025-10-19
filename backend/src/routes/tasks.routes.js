const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller'); // Import controller
const Task = require('../models/Task');

// --- NEW: Route to update a task ---
router.post('/', tasksController.updateTask);

// --- NEW: Route to reset all tasks ---
router.post('/reset-all', tasksController.resetAllTasks);
const Agent = require('../models/agent.model'); // NEW: Import Agent model
const { logActivity } = require('../utils/logActivity');

// --- NEW: Get agents with tasks for today ---
router.get('/today', async (req, res) => {
    try {
        const todayIndex = new Date().getDay(); // Sunday = 0, Monday = 1, etc.
        
        // --- FIX: Only find active agents ---
        const query = { 
            audit_days: { $in: [todayIndex] }
        };
        console.log(`[Tasks] Finding agents for today with query:`, JSON.stringify(query));
        
        const agents = await Agent.find(query)
            .select('name classification agent_id avatar_url remaining_balance remaining_deposit_bonus deposit_bonus_percentage')
            .lean();
        
        console.log(`[Tasks] Found ${agents.length} agents for today.`);

        // --- NEW: Fetch today's tasks for these agents ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const agentIds = agents.map(a => a._id);
        const tasks = await Task.find({
            agent_id: { $in: agentIds },
            task_date: { $gte: todayStart, $lte: todayEnd }
        }).lean();

        // Create a map for quick lookup
        const tasksMap = tasks.reduce((map, task) => {
            map[task.agent_id] = task;
            return map;
        }, {});

        // --- FIX: Return the correct object structure ---
        res.status(200).json({ agents, tasksMap });

    } catch (error) {
        console.error('[Tasks] Error fetching today\'s tasks:', error);
        res.status(500).json({ message: 'فشل جلب مهام اليوم.', error: error.message });
    }
});

module.exports = router;