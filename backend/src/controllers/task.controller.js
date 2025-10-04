const Task = require('../models/Task');
const Agent = require('../models/Agent');
const { logActivity } = require('../utils/logActivity');

/**
 * Fetches all agents scheduled for today and their task statuses.
 */
exports.getTodayTasks = async (req, res) => {
    try {
        // --- FIX: Use a date range to avoid timezone issues ---
        // --- FIX: Revert to using server's local time for consistency with other parts of the app ---
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);

        // 1. Find all agents who are scheduled for today
        const dayOfWeekIndex = startOfToday.getDay(); // Use getDay() for server's local timezone day index
        // Ensure we don't fetch on Saturday (day 6)
        if (dayOfWeekIndex === 6) {
            return res.json({ agents: [], tasksMap: {} });
        }

        const query = { audit_days: { $in: [dayOfWeekIndex] } }; // FIX: Remove status check to include all agents with audit days
        console.log('[Tasks] Finding agents for today with query:', JSON.stringify(query));
        const agentsForToday = await Agent.find(query)
            .select('name agent_id classification avatar_url remaining_balance remaining_deposit_bonus deposit_bonus_percentage')
            .lean();
        console.log(`[Tasks] Found ${agentsForToday.length} agents for today.`);

        // --- FIX: If no agents are found, return early with empty data ---
        if (agentsForToday.length === 0) {
            return res.json({ agents: [], tasksMap: {} });
        }

        // 2. Find all existing tasks for these agents for today
        const agentIds = agentsForToday.map(a => a._id);
        const tasks = await Task.find({
            agent_id: { $in: agentIds },
            task_date: { $gte: startOfToday, $lt: endOfToday } // FIX: Query using local timezone date range
        }).lean();

        // 3. Combine the data
        const tasksMap = tasks.reduce((map, task) => {
            map[task.agent_id.toString()] = task;
            return map;
        }, {});

        res.json({ agents: agentsForToday, tasksMap: tasksMap });
    } catch (error) {
        console.error('Error fetching today\'s tasks:', error);
        res.status(500).json({ message: 'Server error while fetching tasks.', error: error.message });
    }
};

/**
 * Gets statistics for today's tasks (total and completed).
 */
exports.getTodayTaskStats = async (req, res) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(startOfToday);
        endOfToday.setDate(startOfToday.getDate() + 1);
        const dayOfWeekIndex = startOfToday.getDay();

        if (dayOfWeekIndex === 6) { // Saturday
            return res.json({ total: 0, completed: 0 });
        }

        // 1. Find total agents scheduled for today
        const total = await Agent.countDocuments({ audit_days: { $in: [dayOfWeekIndex] } });

        if (total === 0) {
            return res.json({ total: 0, completed: 0 });
        }

        // 2. Find completed tasks for today (audited = true)
        const agentIdsForToday = (await Agent.find({ audit_days: { $in: [dayOfWeekIndex] } }).select('_id')).map(a => a._id);

        const completed = await Task.countDocuments({
            agent_id: { $in: agentIdsForToday },
            task_date: { $gte: startOfToday, $lt: endOfToday }, // FIX: Use 'task_date' to match the schema
            audited: true // FIX: Completion is based on audit only
        });

        res.json({ total, completed });
    } catch (error) {
        console.error('Error fetching today\'s task stats:', error);
        res.status(500).json({ message: 'Server error while fetching task stats.', error: error.message });
    }
};

/**
 * Creates or updates a task's status (audited or competition_sent).
 */
exports.updateTaskStatus = async (req, res) => {
    const { agentId, taskType, status, dayIndex } = req.body;
    const userId = req.user._id;

    if (!agentId || !taskType || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'Missing required fields: agentId, taskType, status.' });
    }

    try {
        // حساب التاريخ المطلوب تحديثه
        const now = new Date();
        let dateToUpdate;

        if (typeof dayIndex === 'number' && dayIndex >= 0 && dayIndex < 7) {
            // إذا كان dayIndex محدد (من التقويم)، نحسب التاريخ في الأسبوع الحالي
            const currentDay = now.getDay();
            const diff = dayIndex - currentDay;
            dateToUpdate = new Date(now);
            dateToUpdate.setDate(now.getDate() + diff);
        } else {
            // إذا لم يكن dayIndex محدد (من صفحة المهام اليومية)، نستخدم تاريخ اليوم
            dateToUpdate = now;
        }

        // تعيين الوقت إلى بداية اليوم
        dateToUpdate.setHours(0, 0, 0, 0);

        const update = {
            [taskType]: status,
            updated_by: userId // Use a single field for who updated it
        };

        const task = await Task.findOneAndUpdate(
            { agent_id: agentId, task_date: dateToUpdate }, // Use the correct field name 'task_date'
            { $set: update },
            { new: true, upsert: true, lean: true }
        );

        // --- FIX: Log the activity after a successful update ---
        const agent = await Agent.findById(agentId).select('name').lean();
        if (agent) {
            const actionText = taskType === 'audited' ? 'التدقيق' : 'المسابقة';
            const statusText = status ? 'تفعيل' : 'إلغاء تفعيل';
            const description = `تم ${statusText} مهمة "${actionText}" للوكيل ${agent.name}.`;
            await logActivity(userId, agentId, 'TASK_UPDATE', description);
        }
        // --- End of fix ---

        res.json({ message: 'Task updated successfully', data: task });
    } catch (error) {
        console.error('Error in updateTaskStatus:', error); // More detailed logging
        res.status(500).json({ message: 'Server error while updating task.', error: error.message });
    }
};