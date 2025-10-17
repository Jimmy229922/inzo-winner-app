const cron = require('node-cron');
const Task = require('./models/Task'); // FIX: Correct path to model
const Competition = require('./models/Competition'); // FIX: Correct path to model
const { logActivity } = require('./utils/logActivity'); // FIX: Correct relative path
const { postToTelegram } = require('./utils/telegram'); // FIX: Correct relative path
const { renewEligibleAgentBalances } = require('./controllers/agent.controller'); // NEW: Import renewal function

let onlineClientsRef; // Reference to online clients map from server.js

/**
 * @desc    مهمة مجدولة لإعادة تعيين جميع مهام التقويم الأسبوعية.
 *          تعمل كل يوم أحد الساعة 7:00 صباحاً.
 */
const scheduleWeeklyTaskReset = () => {
    cron.schedule(
        '0 7 * * 0', // At 07:00 on Sunday.
        async () => {
            console.log('[CRON] Running weekly task reset job at 7:00 AM for Africa/Cairo timezone at', new Date().toLocaleString());
            try {
                const { modifiedCount } = await Task.updateMany({}, { $set: { audited: false, competition_sent: false } });
                console.log(`[CRON] Successfully reset (deactivated) ${modifiedCount} tasks.`);
                await logActivity(null, null, 'SYSTEM_TASK', `تم إعادة تعيين مهام التقويم الأسبوعية بنجاح. تم إلغاء تفعيل ${modifiedCount} مهمة.`);

                // --- NEW: Broadcast a message to all connected clients to force a data refresh ---
                if (onlineClientsRef && onlineClientsRef.size > 0) {
                    const message = JSON.stringify({ type: 'force_calendar_reload' });
                    onlineClientsRef.forEach((client) => {
                        if (client.readyState === client.OPEN) {
                            client.send(message);
                        }
                    });
                    console.log('[CRON] Sent force_calendar_reload message to all connected clients.');
                }
            } catch (error) {
                console.error('[CRON] Error during weekly task reset:', error);
            }
        },
        { timezone: 'Africa/Cairo' }
    );
};

/**
 * @desc    مهمة مجدولة للتحقق من المسابقات المنتهية كل دقيقة.
 */
const scheduleExpiredCompetitionCheck = () => {
    cron.schedule('* * * * *', async () => { // Runs every minute
        try {
            const now = new Date();
            const expiredCompetitions = await Competition.find({
                status: 'sent',
                ends_at: { $lte: now }
            }).populate('agent_id', 'name telegram_chat_id');

            if (expiredCompetitions.length > 0) {
                console.log(`[CRON] Found ${expiredCompetitions.length} expired competitions to process.`);
            }

            for (const comp of expiredCompetitions) {
                comp.status = 'awaiting_winners';
                comp.processed_at = new Date();
                await comp.save();

                const agent = comp.agent_id;
                if (agent && agent.telegram_chat_id) {
                                        const clicheText = `الأساتذة الكرام،\n\n` +
                                            `نحيطكم علمًا بانتهاء مدة المشاركة في المسابقة الأخيرة.\n` +
                                            `🔹 الإجابة الصحيحة: ${comp.correct_answer || 'غير محددة'}\n\n` +
                                            `يرجى تزويدنا برابط منشور المسابقة من قناتكم ليقوم القسم المختص باختيار الفائزين والتحقق من بياناتهم، ثم إرسال الأسماء إليكم للإعلان عنها.\n\n` +
                                            `مع خالص التقدير،\n` +
                                            `إدارة المسابقات – انزو`;
                    try {
                        await postToTelegram(clicheText, agent.telegram_chat_id);
                        console.log(`[CRON] Sent winner selection request for competition ${comp._id} to agent ${agent.name}`);
                        await logActivity(null, agent._id, 'COMPETITION_EXPIRED', `تم إغلاق المسابقة "${comp.name}" وإرسال طلب اختيار الفائزين تلقائياً.`);
                    } catch (telegramError) {
                        console.error(`[CRON] Failed to send Telegram message for competition ${comp._id}:`, telegramError);
                        await logActivity(null, agent._id, 'TELEGRAM_ERROR', `فشل إرسال إشعار اختيار الفائزين للمسابقة "${comp.name}"`);
                    }
                }
            }
        } catch (error) {
            console.error('[CRON] Error checking for expired competitions:', error);
        }
    });
};

/**
 * @desc    مهمة مجدولة لتجديد رصيد الوكلاء المؤهلين.
 *          تعمل كل يوم الساعة 5:00 صباحاً.
 */
const scheduleAgentBalanceRenewal = (onlineClients) => {
    cron.schedule('0 5 * * *', async () => {
        console.log('[CRON] Running agent balance renewal job at 5:00 AM for Africa/Cairo timezone at', new Date().toLocaleString());
        try {
            const renewedCount = await renewEligibleAgentBalances(onlineClients);
            if (renewedCount > 0) {
                console.log(`[CRON] Successfully renewed balances for ${renewedCount} agents.`);
                await logActivity(null, null, 'SYSTEM_TASK', `تم تجديد الرصيد تلقائياً لـ ${renewedCount} وكيل.`);
            }
        } catch (error) {
            console.error('[CRON] Error during agent balance renewal:', error);
        }
    }, { timezone: 'Africa/Cairo' });
};

/**
 * @desc    يبدأ جميع المهام المجدولة في النظام.
 */
const startAllSchedulers = (onlineClients) => {
    console.log('[Scheduler] Initializing all background jobs...');
    onlineClientsRef = onlineClients; // Store the reference
    scheduleWeeklyTaskReset();
    scheduleExpiredCompetitionCheck();
    scheduleAgentBalanceRenewal(); // NEW: Start the balance renewal job
    console.log('[Scheduler] All background jobs have been started.');
};

module.exports = { startAllSchedulers };