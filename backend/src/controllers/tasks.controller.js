const Task = require('../models/Task');
const { logActivity } = require('../utils/logActivity');
const Agent = require('../models/agent.model'); // Import Agent model to get name for logging

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

        // Calculate the date for the given dayIndex relative to the current week (assuming Sunday is the start)
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ...
        
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);

        const taskDate = new Date(sunday);
        taskDate.setDate(sunday.getDate() + dayIndex);

        // Find the task or create a new one
        let task = await Task.findOne({
            agent_id: agentId,
            task_date: taskDate
        });

        if (!task) {
            task = new Task({
                agent_id: agentId,
                task_date: taskDate,
                [taskType]: status,
                updated_by: userId
            });
        } else {
            // Only update if the status is different
            if (task[taskType] !== status) {
                task[taskType] = status;
                task.updated_by = userId;
            }
        }

        const savedTask = await task.save();

        // Log the activity
        const agent = await Agent.findById(agentId).select('name');
        const agentName = agent ? agent.name : `ID ${agentId}`;
        const action = status ? 'TASK_COMPLETED' : 'TASK_UNCOMPLETED';
        const taskTypeName = taskType === 'audited' ? 'تدقيق' : 'إرسال منافسة';
        const statusText = status ? 'مكتمل' : 'غير مكتمل';
        const details = `تم تحديث مهمة "${taskTypeName}" للوكيل "${agentName}" ليوم ${taskDate.toLocaleDateString('ar-EG')} إلى "${statusText}".`;
        
        if(userId) {
            await logActivity(userId, agentId, action, details);
        }

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