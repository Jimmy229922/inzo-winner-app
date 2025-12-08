const Task = require('../models/Task');
const Agent = require('../models/agent.model');
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
        let dayOfWeekIndex = startOfToday.getDay(); // Default to server's local day

        // FIX: Allow client to specify the day index to handle timezone differences
        if (req.query.day !== undefined) {
            const clientDay = parseInt(req.query.day, 10);
            if (!isNaN(clientDay) && clientDay >= 0 && clientDay <= 6) {
                dayOfWeekIndex = clientDay;
                console.log(`[TODAY TASKS] Using client-provided day index: ${dayOfWeekIndex}`);
            }
        }

        // --- FIX: Calculate the specific date for the requested day index to match updateTask logic ---
        // This ensures that if the client is asking for "Wednesday" (3), we look for tasks on "Wednesday"
        // of the current week, even if the server is currently on "Tuesday".
        const today = new Date();
        const currentDayOfWeek = today.getDay(); 
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);

        const targetTaskDate = new Date(sunday);
        targetTaskDate.setDate(sunday.getDate() + dayOfWeekIndex);
        
        const startOfTaskDay = new Date(targetTaskDate);
        startOfTaskDay.setHours(0, 0, 0, 0);
        
        const endOfTaskDay = new Date(targetTaskDate);
        endOfTaskDay.setHours(23, 59, 59, 999);

        const query = { audit_days: { $in: [dayOfWeekIndex] } }; // FIX: Remove status check to include all agents with audit days
        
        const agentsForToday = await Agent.find(query)
            .select('name agent_id classification avatar_url remaining_balance remaining_deposit_bonus deposit_bonus_percentage audit_days')
            .lean();
        


        // --- FIX: If no agents are found, return early with empty data ---
        if (agentsForToday.length === 0) {
            return res.json({ agents: [], tasksMap: {} });
        }

        // 2. Find all existing tasks for these agents for today
        const agentIds = agentsForToday.map(a => a._id);
        const tasks = await Task.find({
            agent_id: { $in: agentIds },
            task_date: { $gte: startOfTaskDay, $lt: endOfTaskDay } // FIX: Query using calculated target date
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

        // 1. Find total agents scheduled for today
        const total = await Agent.countDocuments({ audit_days: { $in: [dayOfWeekIndex] } });

        if (total === 0) {
            return res.json({ total: 0, completed: 0 });
        }

        // 2. Find completed tasks for today (audited = true)
        const agentIdsForToday = (await Agent.find({ audit_days: { $in: [dayOfWeekIndex] } }).select('_id')).map(a => a._id);

        // Calculate target date for stats as well
        const today = new Date();
        const currentDayOfWeek = today.getDay(); 
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);

        const targetTaskDate = new Date(sunday);
        targetTaskDate.setDate(sunday.getDate() + dayOfWeekIndex);
        
        const startOfTaskDay = new Date(targetTaskDate);
        startOfTaskDay.setHours(0, 0, 0, 0);
        
        const endOfTaskDay = new Date(targetTaskDate);
        endOfTaskDay.setHours(23, 59, 59, 999);

        const completed = await Task.countDocuments({
            agent_id: { $in: agentIdsForToday },
            task_date: { $gte: startOfTaskDay, $lt: endOfTaskDay }, // FIX: Use calculated date
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

        // --- NEW: Update is_auditing_enabled in Agent when audited status changes ---
        if (taskType === 'audited') {
            await Agent.findByIdAndUpdate(
                agentId,
                { $set: { is_auditing_enabled: status } },
                { new: true }
            );
            console.log(`✓ Updated is_auditing_enabled to ${status} for agent ${agentId}`);
        }
        // --- End of new fix ---

        // --- FIX: Log the activity after a successful update ---
        const agent = await Agent.findById(agentId).select('name').lean();
        if (agent) {
            const actionText = taskType === 'audited' ? 'التدقيق' : 'المسابقة';
            const statusText = status ? 'تم' : 'تم إلغاء';
            const description = `${statusText} تحديد مهمة "${actionText}" للوكيل ${agent.name} ليوم ${dateToUpdate.toLocaleDateString('ar-EG')}.`;
            await logActivity(userId, agentId, 'TASK_UPDATE', description);
        }
        // --- End of fix ---

        res.json({ message: 'Task updated successfully', data: task });
    } catch (error) {
        console.error('Error in updateTaskStatus:', error); // More detailed logging
        res.status(500).json({ message: 'Server error while updating task.', error: error.message });
    }
};
