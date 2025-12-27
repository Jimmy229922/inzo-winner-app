const Task = require('../models/Task');
const { logActivity } = require('../utils/logActivity');
const Agent = require('../models/agent.model'); // Import Agent model to get name for logging
const CompetitionTemplate = require('../models/CompetitionTemplate');
const Competition = require('../models/Competition');
const { broadcastNotification } = require('../utils/notification');

// Helper: replicate logic from competition.controller.js for consistency
function calculateEndsAtUTC(duration) {
    if (duration === '5s') {
        const now = new Date();
        return new Date(now.getTime() + 5000).toISOString();
    }
    if (duration === '10s') {
        const now = new Date();
        return new Date(now.getTime() + 10000).toISOString();
    }
    const msDay = 86400000;
    const localToday = new Date();
    localToday.setHours(0,0,0,0);
    const localDayStartMs = localToday.getTime();
    const durationMapping = { '1d': '24h', '2d': '48h', '1w': '168h' };
    const backendDuration = durationMapping[duration] || duration;
    const durationMap = { '24h': 1, '48h': 2, '168h': 7 };
    const durationDays = durationMap[backendDuration];
    if (durationDays === undefined) return null;
    const winnerLocalStartMs = localDayStartMs + (durationDays + 1) * msDay;
    return new Date(winnerLocalStartMs).toISOString();
}

exports.updateTask = async (req, res) => {
    try {
        const { agentId, taskType, status, dayIndex } = req.body;
        const userId = req.user ? req.user._id : null;

        if (agentId === undefined || taskType === undefined || status === undefined || dayIndex === undefined) {
            return res.status(400).json({ message: 'Missing required fields in request body.' });
        }

        // Validate taskType to prevent arbitrary field injection
        const allowedTaskTypes = ['audited', 'competition_sent'];
        if (!allowedTaskTypes.includes(taskType)) {
            return res.status(400).json({ message: 'Invalid task type specified.' });
        }

        // Saturday (6) is a holiday - REMOVED BLOCK to allow manual updates
        // if (dayIndex === 6) {
        //    return res.status(400).json({ message: 'يوم السبت إجازة، لا يمكن تحديث المهام.' });
        // }

        // Calculate the date for the given dayIndex relative to the current week (assuming Sunday is the start)
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ...
        
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);

        const taskDate = new Date(sunday);
        taskDate.setDate(sunday.getDate() + dayIndex);

        // --- FIX: Use date range to find task to avoid time precision issues ---
        const startOfDay = new Date(taskDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(taskDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Find the task or create a new one
        let task = await Task.findOne({
            agent_id: agentId,
            task_date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (!task) {
            task = new Task({
                agent_id: agentId,
                task_date: startOfDay, // Ensure we save with 00:00:00
                day_index: dayIndex, // --- NEW: Save day index explicitly ---
                [taskType]: status,
                updated_by: userId
            });
        } else {
            // Only update if the status is different
            if (task[taskType] !== status) {
                task[taskType] = status;
                task.updated_by = userId;
            }
            // Ensure day_index is set if missing (migration)
            if (task.day_index === undefined) {
                task.day_index = dayIndex;
            }
        }

        const savedTask = await task.save();

        // --- NEW: Return the saved task to the client ---
        // This allows the client to update its state with the authoritative server data
        // Note: We send the response here, but continue processing (logging, competition creation) asynchronously if needed.
        // However, Express requires one response. So we must ensure we don't send another response later.
        // The original code didn't send a response until the end or error.
        // Let's buffer the response data and send it at the end.
        
        // Log the activity
        const agent = await Agent.findById(agentId).select('name');
        const agentName = agent ? agent.name : `ID ${agentId}`;
        const action = status ? 'TASK_COMPLETED' : 'TASK_UNCOMPLETED';

        // If marking competition_sent true, attempt to auto-create a competition for the agent
        let createdCompetition = null;
        /* DISABLED: Auto-creation of competitions from task list is disabled per user request.
        if (taskType === 'competition_sent' && status === true) {
            // ... code removed ...
        }
        */
        const taskTypeName = taskType === 'audited' ? 'تدقيق' : 'إرسال مسابقة';
        const statusText = status ? 'مكتمل' : 'غير مكتمل';
        const details = `تم تحديث مهمة "${taskTypeName}" للوكيل "${agentName}" ليوم ${taskDate.toLocaleDateString('ar-EG')} إلى "${statusText}".`;
        
        if(userId) {
            await logActivity(userId, agentId, action, details);
        }

        // --- NEW: Broadcast Notification for Task Update ---
        const notificationMessage = status 
            ? `تم إكمال مهمة "${taskTypeName}" للوكيل ${agentName}`
            : `تم إلغاء مهمة "${taskTypeName}" للوكيل ${agentName}`;
            
        const notificationLevel = status ? 'success' : 'cancelled';

        broadcastNotification(
            req.app,
            notificationMessage,
            notificationLevel
        );

        res.status(200).json({ message: 'Task updated successfully.', task: savedTask });

    } catch (error) {
        console.error('[Task Controller] Error updating task:', error);
        res.status(500).json({ message: 'Failed to update task.', error: error.message });
    }
};

exports.resetAllTasks = async (req, res) => {
    try {
        const userId = req.user ? req.user._id : null;

        // This is a destructive operation, but it matches the frontend store's logic of resetting the state.
        await Task.deleteMany({});

        console.log(`[Task Controller] All tasks have been reset by user ${userId}.`);

        // Log this significant system-wide event
        if (userId) {
            await logActivity(userId, null, 'ALL_TASKS_RESET', 'قام المستخدم بإعادة تعيين جميع مهام الأسبوع من صفحة التقويم.');
        }

        res.status(200).json({ message: 'All tasks have been reset successfully.' });

    } catch (error) {
        console.error('[Task Controller] Error resetting all tasks:', error);
        res.status(500).json({ message: 'Failed to reset all tasks.', error: error.message });
    }
};