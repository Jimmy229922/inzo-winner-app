const Task = require('../models/Task');
const { logActivity } = require('../utils/logActivity');
const Agent = require('../models/agent.model'); // Import Agent model to get name for logging
const CompetitionTemplate = require('../models/CompetitionTemplate');
const Competition = require('../models/Competition');

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

        // If marking competition_sent true, attempt to auto-create a competition for the agent
        let createdCompetition = null;
        if (taskType === 'competition_sent' && status === true) {
            try {
                const agent = await Agent.findById(agentId).lean();
                if (!agent) {
                    return res.status(404).json({ message: 'الوكيل غير موجود لإنشاء المسابقة.' });
                }

                // Check if auditing is enabled for the agent
                if (!agent.is_auditing_enabled) {
                    await logActivity(userId, agentId, 'COMPETITION_SENT_FAILED', `التدقيق غير مفعل للوكيل ${agent.name}. يجب تفعيل التدقيق قبل إنشاء مسابقة.`);
                    return res.status(403).json({ 
                        message: 'يجب تفعيل التدقيق للوكيل قبل إنشاء مسابقة',
                        error: 'Auditing is not enabled for this agent'
                    });
                }

                // Prevent duplicate competition for the same agent on the same day
                const startOfDay = new Date(taskDate); startOfDay.setHours(0,0,0,0);
                const endOfDay = new Date(startOfDay); endOfDay.setDate(startOfDay.getDate()+1);

                // NEW: Check for ANY competition created in the last 5 minutes to prevent race conditions with manual creation
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const recentlyCreated = await Competition.findOne({
                    agent_id: agent._id,
                    createdAt: { $gte: fiveMinutesAgo }
                });

                const existingToday = await Competition.findOne({
                    agent_id: agent._id,
                    createdAt: { $gte: startOfDay, $lt: endOfDay }
                });

                if (existingToday || recentlyCreated) {
                    await logActivity(userId, agentId, 'COMPETITION_SENT', `تم بالفعل إرسال مسابقة اليوم (أو مؤخراً) للوكيل ${agent.name}.`);
                } else {
                    // Select an active template matching classification and not archived & usage within limit
                    const template = await CompetitionTemplate.findOne({
                        status: 'active',
                        is_archived: false,
                        $or: [
                            { classification: 'All' },
                            { classification: agent.classification }
                        ],
                        $expr: { $or: [ { $eq: ['$usage_limit', null] }, { $lt: ['$usage_count', '$usage_limit'] } ] }
                    }).sort({ usage_count: 1, createdAt: 1 }).lean();

                    if (!template) {
                        await logActivity(userId, agentId, 'COMPETITION_SENT_FAILED', `لا يوجد قالب نشط مناسب لإرسال مسابقة للوكيل ${agent.name}.`);
                    } else {
                        // Duration normalization
                        const legacyToEnum = { '24h':'1d','48h':'2d','168h':'1w','5s':'5s' };
                        let chosenDuration = agent.competition_duration ? (legacyToEnum[agent.competition_duration] || agent.competition_duration) : '1d';
                        const allowed = ['5s','10s','1d','2d','1w'];
                        if (!allowed.includes(chosenDuration)) chosenDuration = '1d';
                        const endsAtUTC = calculateEndsAtUTC(chosenDuration);
                        if (!endsAtUTC) {
                            await logActivity(userId, agentId, 'COMPETITION_SENT_FAILED', `مدة المسابقة غير صالحة عند إنشاء مسابقة تلقائية للوكيل ${agent.name}.`);
                        } else {
                            const compDoc = new Competition({
                                name: template.question,
                                description: template.content || template.description || template.question,
                                agent_id: agent._id,
                                template_id: template._id,
                                correct_answer: template.correct_answer,
                                duration: chosenDuration,
                                winners_count: agent.winners_count || 0,
                                prize_per_winner: agent.prize_per_winner || 0,
                                deposit_winners_count: agent.deposit_bonus_winners_count || 0,
                                status: 'sent',
                                ends_at: endsAtUTC,
                                type: template.type === 'مميزات' ? 'general' : 'general' // fallback mapping
                            });
                            await compDoc.save();
                            createdCompetition = compDoc;

                            // Update financial impact on agent (simplified: cost deduction only)
                            if ((agent.winners_count || 0) > 0 && (agent.prize_per_winner || 0) > 0) {
                                const totalCost = (agent.winners_count || 0) * (agent.prize_per_winner || 0);
                                await Agent.findByIdAndUpdate(agent._id, {
                                    $inc: {
                                        consumed_balance: totalCost,
                                        remaining_balance: -totalCost
                                    },
                                    $set: { last_competition_date: new Date() }
                                });
                            }

                            // Increment template usage counters
                            await CompetitionTemplate.findByIdAndUpdate(template._id, {
                                $inc: { usage_count: 1, usage_total: 1 },
                                $push: { times_used: { date: new Date(), competition_id: compDoc._id } },
                                $set: { is_archived: template.usage_limit !== null && template.usage_count + 1 >= template.usage_limit }
                            });

                            await logActivity(userId, agentId, 'COMPETITION_SENT', `تم إرسال مسابقة تلقائياً للوكيل ${agent.name}: ${template.question}`);
                        }
                    }
                }
            } catch (createErr) {
                console.error('[Tasks] Failed to auto-create competition:', createErr);
                await logActivity(userId, agentId, 'COMPETITION_SENT_FAILED', `خطأ تقني أثناء إنشاء المسابقة: ${createErr.message}`);
            }
        }
        const taskTypeName = taskType === 'audited' ? 'تدقيق' : 'إرسال مسابقة';
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